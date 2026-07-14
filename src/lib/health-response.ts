import { NextResponse } from "next/server";
import { allowDeepHealthProbe } from "@/lib/deep-probe-auth";
import { env, isDemoMode } from "@/lib/env";
import type { AnswerSloSnapshot, SloProbeClient } from "@/lib/observability/answer-slo";
import { cacheMetricsSnapshot, type CacheMetricsSnapshot } from "@/lib/observability/cache-metrics";
import type { SpendProbeClient, SpendSnapshot } from "@/lib/observability/spend-metrics";

type HealthResponseOptions = {
  forceDeep?: boolean;
  allowUnauthenticatedDeep?: boolean;
  includeSlo?: boolean;
  includeCache?: boolean;
  includeSpend?: boolean;
};

export async function healthResponse(request: Request, options: HealthResponseOptions = {}) {
  const deep = options.forceDeep || new URL(request.url).searchParams.get("deep") === "1";
  const supabaseConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const openAIConfigured = Boolean(env.OPENAI_API_KEY);
  const checks: Record<string, "ok" | "missing" | "error" | "skipped" | "unauthorized"> = {
    supabaseConfig: supabaseConfigured ? "ok" : "missing",
    openaiConfig: openAIConfigured ? "ok" : env.RAG_PROVIDER_MODE === "offline" ? "skipped" : "missing",
  };
  let slo: AnswerSloSnapshot | null = null;
  let cache: CacheMetricsSnapshot | null = null;
  let spend: SpendSnapshot | null = null;

  if (deep) {
    const tokenAuthorized = allowDeepHealthProbe(request);
    if (!options.allowUnauthenticatedDeep && !tokenAuthorized) {
      checks.supabase = "unauthorized";
    } else {
      // Cache hit-rate is operator-gated internal telemetry (the in-process
      // hot-path half of the silent-degradation counters). Expose it only to a
      // genuinely token-authorized deep probe — never the unauthenticated
      // readiness endpoint, which exposes no diagnostic details — and only when
      // not explicitly suppressed. Reads a cumulative counter (no DB), so it is
      // available even in demo mode. Like `slo`, it never flips liveness.
      if (tokenAuthorized && options.includeCache !== false) {
        cache = cacheMetricsSnapshot();
      }

      if (supabaseConfigured && !isDemoMode()) {
        try {
          const [{ createAdminClient }, { probeSupabaseHealth }, { answerSloSnapshot }] = await Promise.all([
            import("@/lib/supabase/admin"),
            import("@/lib/supabase/health"),
            import("@/lib/observability/answer-slo"),
          ]);
          const admin = createAdminClient();
          const health = await probeSupabaseHealth(admin);
          checks.supabase = health.ok ? "ok" : "error";
          if (health.ok && options.includeSlo !== false) {
            try {
              // Avoid recursively instantiating the full generated PostgREST
              // client type against the intentionally tiny SLO query surface.
              slo = await answerSloSnapshot(admin as unknown as SloProbeClient);
            } catch {
              slo = null;
            }
          }
          // Answer-generation spend, gated like `slo` (token-authorized deep probe
          // + healthy Supabase). Derives USD from already-recorded token counts and
          // a configurable price; errors are swallowed to null and never flip
          // liveness. Suppressed only when explicitly disabled.
          if (health.ok && tokenAuthorized && options.includeSpend !== false) {
            try {
              const { spendSnapshot } = await import("@/lib/observability/spend-metrics");
              // admin is structurally a SpendProbeClient; cast avoids a deep
              // instantiation check against the full PostgREST client type (TS2589),
              // matching how answer-slo/health treat the admin client.
              spend = await spendSnapshot(admin as unknown as SpendProbeClient, {
                pricing: {
                  inputPerMTok: env.OPENAI_PRICE_INPUT_PER_MTOK,
                  cachedInputPerMTok: env.OPENAI_PRICE_CACHED_INPUT_PER_MTOK,
                  outputPerMTok: env.OPENAI_PRICE_OUTPUT_PER_MTOK,
                },
                alertDailyUsd: env.SPEND_ALERT_DAILY_USD,
              });
            } catch {
              spend = null;
            }
          }
        } catch {
          checks.supabase = "error";
        }
      } else {
        checks.supabase = "skipped";
      }
    }
  }

  const ready = !Object.values(checks).some(
    (value) => value === "missing" || value === "error" || value === "unauthorized",
  );

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      demoMode: isDemoMode(),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks,
      ...(slo ? { slo } : {}),
      ...(cache ? { cache } : {}),
      ...(spend ? { spend } : {}),
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
