import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";
import type { AnswerSloSnapshot } from "@/lib/observability/answer-slo";
import { cacheMetricsSnapshot, type CacheMetricsSnapshot } from "@/lib/observability/cache-metrics";
import { allowDeepHealthProbe } from "@/lib/deep-probe-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const supabaseConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

  const checks: Record<string, "ok" | "missing" | "error" | "skipped" | "unauthorized"> = {
    supabaseConfig: supabaseConfigured ? "ok" : "missing",
    openaiConfig: env.OPENAI_API_KEY ? "ok" : "missing",
  };

  let slo: AnswerSloSnapshot | null = null;
  let cache: CacheMetricsSnapshot | null = null;
  if (deep) {
    if (!allowDeepHealthProbe(request)) {
      checks.supabase = "unauthorized";
    } else {
      // In-process retrieval cache hit-rate — the hot-path half of the
      // silent-degradation counters. It reads a cumulative counter (no DB), so
      // it is available to any authorized deep probe, including in demo mode.
      cache = cacheMetricsSnapshot();
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
          if (health.ok) {
            // Reliability telemetry only — a failure here must NOT flip liveness to
            // 503, so it stays out of `checks` (which gates `ready`).
            try {
              slo = await answerSloSnapshot(admin);
            } catch {
              slo = null;
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
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
