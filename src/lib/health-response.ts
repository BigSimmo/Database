import { ragProgrammeHealth } from "@/lib/rag/rag-rollout";
import { NextResponse } from "next/server";
import { allowDeepHealthProbe } from "@/lib/deep-probe-auth";
import { env, isDemoMode } from "@/lib/env";
import type { AnswerSloSnapshot, SloProbeClient } from "@/lib/observability/answer-slo";
import { cacheMetricsSnapshot, type CacheMetricsSnapshot } from "@/lib/observability/cache-metrics";
import {
  answerCoalescingMetricsSnapshot,
  type AnswerCoalescingMetricsSnapshot,
} from "@/lib/observability/answer-coalescing-metrics";
import type { SpendProbeClient, SpendSnapshot } from "@/lib/observability/spend-metrics";
import { resolveDeploymentCommitSha } from "@/lib/observability/sentry-release";
import type { SiteContentPublicHealthProjection } from "@/lib/site-content/site-content-health";

type HealthResponseOptions = {
  forceDeep?: boolean;
  allowUnauthenticatedDeep?: boolean;
  includeSlo?: boolean;
  includeCache?: boolean;
  includeCoalescing?: boolean;
  includeSpend?: boolean;
  includeOperatorDiagnostics?: boolean;
  /**
   * The site-content control-plane audit. Default on, but `/api/health/ready` turns it OFF —
   * see the block guarding it below for why that endpoint must not ask this question.
   */
  includeSiteContent?: boolean;
};

/**
 * Deadline for the site-content evidence read. It exists so a slow control-plane audit degrades
 * one field instead of hanging a request, and it is bounded on BOTH sides by measurement rather
 * than chosen for roundness:
 *
 * - It must sit well ABOVE the audit's healthy cost. `read_site_content_health()` was measured at
 *   about 7.1 s against the live database on 2026-09-14 (`docs/deployment-architecture.md`
 *   § Readiness). A deadline under that does not bound a fault, it manufactures one — the abort
 *   lands in the `catch` below as `checks.siteContent = "error"`, which is indistinguishable from
 *   a genuine corpus inconsistency and drops the whole probe to 503. That would break the one
 *   surface this endpoint still exists to provide, because `scripts/lib/deployment-rag-activation.mjs`
 *   reads exactly this response and fails `check:production-readiness` on a non-2xx.
 * - It must sit BELOW the readiness prober's own whole-response budget, which is
 *   `AbortSignal.timeout(15000)` in that same file. A deadline above it would never be reached:
 *   the caller would give up first, turning a diagnosable one-field timeout into an opaque
 *   `health_probe_failed`.
 *
 * Ten seconds carries roughly 40% headroom over the measured cost and leaves the rest of the
 * deep probe about five seconds inside the caller's budget. `tests/health-response-deep-probe.test.ts`
 * pins both bounds, because the value being below the measured cost is the defect this replaced.
 */
export const SITE_CONTENT_PROBE_TIMEOUT_MS = 10_000;

export async function healthResponse(request: Request, options: HealthResponseOptions = {}) {
  const deep = options.forceDeep || new URL(request.url).searchParams.get("deep") === "1";
  const tokenAuthorized = allowDeepHealthProbe(request);
  const operatorDiagnostics = tokenAuthorized && options.includeOperatorDiagnostics !== false;
  const supabaseConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const openAIConfigured = Boolean(env.OPENAI_API_KEY);
  const checks: Record<string, "ok" | "missing" | "error" | "skipped" | "unauthorized"> = {
    supabaseConfig: supabaseConfigured ? "ok" : "missing",
    openaiConfig: openAIConfigured ? "ok" : env.RAG_PROVIDER_MODE === "offline" ? "skipped" : "missing",
    siteContent: "skipped",
  };
  let slo: AnswerSloSnapshot | null = null;
  let cache: CacheMetricsSnapshot | null = null;
  let coalescing: AnswerCoalescingMetricsSnapshot | null = null;
  let spend: SpendSnapshot | null = null;
  let siteContent: SiteContentPublicHealthProjection | null = null;

  if (deep) {
    if (!options.allowUnauthenticatedDeep && !tokenAuthorized) {
      checks.supabase = "unauthorized";
    } else {
      // Cache hit-rate is operator-gated internal telemetry (the in-process
      // hot-path half of the silent-degradation counters). Expose it only to a
      // genuinely token-authorized deep probe — never the unauthenticated
      // readiness endpoint, which exposes no diagnostic details — and only when
      // not explicitly suppressed. Reads a cumulative counter (no DB), so it is
      // available even in demo mode. Like `slo`, it never flips liveness.
      if (operatorDiagnostics && options.includeCache !== false) {
        cache = cacheMetricsSnapshot();
      }
      if (operatorDiagnostics && options.includeCoalescing !== false) {
        coalescing = answerCoalescingMetricsSnapshot();
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
          // NOT on the readiness path, deliberately. `read_site_content_health()` is a
          // whole-corpus integrity audit — record counts, digest comparisons, tombstone
          // reconciliation — and it costs about seven seconds against the live database.
          // Railway allows each healthcheck attempt ten, so between 2026-09-11 and 2026-09-14
          // this single call failed 24 production deploys: every merge built, started, answered
          // this endpoint too slowly, and was rolled back, silently pinning the live site to
          // three-day-old code. Readiness answers "can THIS CONTAINER serve requests"; whether
          // the shared control plane is internally consistent is a monitoring question, and it
          // keeps its home on the token-gated `/api/health?deep=1` and in
          // `npm run check:production-readiness`. `tests/health-response-deep-probe.test.ts`
          // pins both halves of that split.
          if (health.ok && options.includeSiteContent !== false) {
            try {
              const [{ readSiteContentHealthEvidence }, { classifySiteContentHealth, classifySiteContentPartition }] =
                await Promise.all([
                  import("@/lib/site-content/site-content-publication"),
                  import("@/lib/site-content/site-content-health"),
                ]);
              const evidence = await readSiteContentHealthEvidence(
                admin,
                AbortSignal.timeout(SITE_CONTENT_PROBE_TIMEOUT_MS),
              );
              const partition = classifySiteContentPartition({
                expectedSiteStaticManifestDigest: env.SITE_CONTENT_EXPECTED_STATIC_MANIFEST_DIGEST,
                activePublicSiteRelease: evidence.activePublicSiteRelease,
                publicSiteChangeEpoch: evidence.publicSiteChangeEpoch,
                pendingPublicSiteChangeCount: evidence.outstandingHeadCount,
              });
              const classification = classifySiteContentHealth({
                ...evidence,
                partition,
                now: new Date().toISOString(),
              });
              siteContent = classification.publicProjection;
              checks.siteContent = classification.operationStop ? "error" : "ok";
            } catch {
              checks.siteContent = "error";
            }
          }
          // `operatorDiagnostics &&` matches `spendSnapshot` below and makes the gate real: the
          // SLO aggregate is a deliberate CROSS-TENANT read (see its entry in
          // scripts/lib/tenancy-scan.mjs, which states this exact gate). Without it the
          // snapshot also ran for any caller passing `allowUnauthenticatedDeep`, so the only
          // thing holding the claim true was `/api/health/ready` opting out via
          // `includeSlo: false` — one flag at one caller, not a gate.
          if (health.ok && operatorDiagnostics && options.includeSlo !== false) {
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
          if (health.ok && operatorDiagnostics && options.includeSpend !== false) {
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
      deploymentCommitSha: resolveDeploymentCommitSha(),
      checks,
      ...(slo ? { slo } : {}),
      ...(cache ? { cache } : {}),
      ...(coalescing ? { coalescing } : {}),
      ...(spend ? { spend } : {}),
      ...(siteContent ? { siteContent } : {}),
      ...(deep && operatorDiagnostics
        ? { ragProgramme: { ...ragProgrammeHealth(), siteContentFreshness: siteContent?.state ?? "unavailable" } }
        : {}),
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
