import { describe, expect, it } from "vitest";
import { evaluateOpsAlerts, renderDigest, resolveHealthUrl } from "../scripts/ops-digest.mjs";

describe("resolveHealthUrl", () => {
  it("appends the deep health path to a bare base URL", () => {
    expect(resolveHealthUrl("https://app.example")).toBe("https://app.example/api/health?deep=1");
    expect(resolveHealthUrl("https://app.example/")).toBe("https://app.example/api/health?deep=1");
  });

  it("leaves a full health URL untouched", () => {
    expect(resolveHealthUrl("https://app.example/api/health?deep=1")).toBe("https://app.example/api/health?deep=1");
  });

  it("returns undefined for empty input", () => {
    expect(resolveHealthUrl("")).toBeUndefined();
    expect(resolveHealthUrl(undefined)).toBeUndefined();
  });
});

describe("renderDigest", () => {
  it("renders an unreachable digest when the probe failed", () => {
    const md = renderDigest(null, { error: "timeout after 20000ms" });
    expect(md).toContain("unreachable");
    expect(md).toContain("timeout after 20000ms");
  });

  it("renders SLO, cache, and spend sections from a healthy payload", () => {
    const md = renderDigest({
      status: "ok",
      demoMode: false,
      uptimeSeconds: 7200,
      checks: { supabase: "ok", supabaseConfig: "ok" },
      slo: {
        windowMinutes: 60,
        totalQueries: 100,
        hybridRpcErrorQueries: 0,
        hybridRpcErrorRate: 0,
        degradedQueries: 4,
        degradedRate: 0.04,
        truncationFallbackQueries: 1,
        truncationFallbackRate: 0.01,
        timeoutFallbackQueries: 0,
        timeoutFallbackRate: 0,
      },
      cache: { lookups: 50, hits: 40, hitRate: 0.8 },
      spend: {
        windowMinutes: 60,
        answers: 100,
        usd: 1.23,
        usdByRoute: { fast: 0.4, strong: 0.83 },
        projectedDailyUsd: 29.52,
        alertDailyUsdThreshold: 50,
        alerting: false,
        sampleTruncated: false,
      },
    });
    expect(md).toContain("🟢 ok");
    expect(md).toContain("Answer SLO");
    expect(md).toContain("degraded/source-only: 4 (4.0%)");
    expect(md).toContain("Cache:** 40/50 hits (80.0%)");
    expect(md).toContain("Spend");
    expect(md).toContain("$1.23");
    expect(md).toContain("projected/day: $29.52");
    expect(md).toContain("fast $0.40");
  });

  it("flags an over-threshold spend and a truncated sample", () => {
    const md = renderDigest({
      status: "ok",
      spend: {
        windowMinutes: 60,
        answers: 5000,
        usd: 200,
        usdByRoute: {},
        projectedDailyUsd: 4800,
        alertDailyUsdThreshold: 100,
        alerting: true,
        sampleTruncated: true,
      },
    });
    expect(md).toContain("OVER THRESHOLD");
    expect(md).toContain("sample truncated");
  });
});

describe("evaluateOpsAlerts", () => {
  const healthy = {
    status: "ok",
    slo: { hybridRpcErrorRate: 0, degradedRate: 0.1 },
    cache: { hitRate: 0.8 },
    coalescing: { coalescingRate: 0.2 },
    spend: { alerting: false },
  };

  it("keeps liveness independent while alerting on SLO thresholds", () => {
    const result = evaluateOpsAlerts({
      ...healthy,
      slo: { hybridRpcErrorRate: 0.006, degradedRate: 0.21 },
    });

    expect(result).toEqual({
      alerting: true,
      severity: "warning",
      reasons: ["hybrid_rpc_error_rate_above_0_5_percent", "degraded_answer_rate_above_20_percent"],
    });
    expect(healthy.status).toBe("ok");
  });

  it("escalates degraded answers above fifty percent", () => {
    expect(evaluateOpsAlerts({ ...healthy, slo: { hybridRpcErrorRate: 0, degradedRate: 0.51 } })).toMatchObject({
      alerting: true,
      severity: "critical",
      reasons: ["degraded_answer_rate_above_50_percent"],
    });
  });

  it("alerts on missing deep-probe blocks and projected spend", () => {
    const result = evaluateOpsAlerts({ status: "ok", slo: healthy.slo, spend: { alerting: true } });

    expect(result.reasons).toEqual([
      "missing_cache_block",
      "missing_coalescing_block",
      "projected_spend_over_threshold",
    ]);
  });

  it("treats an unreachable probe as critical", () => {
    expect(evaluateOpsAlerts(null, { error: "timeout" })).toEqual({
      alerting: true,
      severity: "critical",
      reasons: ["probe_unreachable"],
    });
  });
});
