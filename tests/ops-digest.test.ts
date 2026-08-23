import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeOpsStatus,
  renderDigest,
  resolveHealthUrl,
  serializeGitHubOutputs,
  updateHybridRpcHourlyEvidence,
} from "../scripts/ops-digest.mjs";

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

describe("ops digest workflow contract", () => {
  it("publishes alerting, highest severity, and the compact machine-readable summary", () => {
    const workflow = readFileSync(new URL("../.github/workflows/ops-digest.yml", import.meta.url), "utf8");
    const script = readFileSync(new URL("../scripts/ops-digest.mjs", import.meta.url), "utf8");
    expect(script).toContain("alerting=${safeSummary.alerting}");
    expect(script).toContain("severity=${singleLine(safeSeverity)}");
    expect(script).toContain("alert_summary=${singleLine(JSON.stringify(safeSummary))}");
    expect(workflow).toContain("steps.digest.outputs.severity");
    expect(workflow).toContain("steps.digest.outputs.alert_summary");
    expect(workflow).toContain("OPS_DIGEST_STATUS: ${{ steps.digest.outputs.status }}");
    expect(workflow).toContain("JSON.parse(process.env.OPS_DIGEST_ALERT_SUMMARY");
    expect(workflow).toContain("publish_alert_comment");
    expect(workflow).toContain("publishAttentionComment");
    expect(workflow).toContain("ops-digest-rpc-history");
    expect(workflow).not.toContain('const status = "${{ steps.digest.outputs.status }}"');
    expect(workflow).not.toContain("const alertSummary = '${{ steps.digest.outputs.alert_summary }}'");
  });

  it("allow-lists workflow values and prevents output-command injection", () => {
    expect(normalizeOpsStatus("ok\nowned=true")).toBe("unknown");
    const output = serializeGitHubOutputs("ok\nowned=true", {
      alerting: true,
      severity: "page\nowned=true",
      count: 1,
      codes: ["OPS_SAFE", "OPS_BAD\nowned=true"],
    });
    expect(output).toBe(
      'status=unknown\nalerting=true\nseverity=unknown\nalert_summary={"alerting":true,"severity":"unknown","count":1,"codes":["OPS_SAFE"]}\n',
    );
    expect(output).not.toContain("\nowned=true");
  });
});

describe("hybrid RPC hourly evidence", () => {
  it("requires three contiguous identity-complete hourly windows for the same RPC", () => {
    let history: unknown;
    for (const observedAt of ["2026-08-23T01:20:00Z", "2026-08-23T02:20:00Z", "2026-08-23T03:20:00Z"]) {
      const result = updateHybridRpcHourlyEvidence(
        history,
        {
          slo: {
            hybridRpcIdentityEvidenceComplete: true,
            hybridRpcErrorCounts: { hybrid_search: 1, keyword_search: observedAt.endsWith("02:20:00Z") ? 1 : 0 },
          },
        },
        new Date(observedAt),
      );
      history = result.history;
      if (observedAt.endsWith("03:20:00Z")) expect(result.repeatedRpcNames).toEqual(["hybrid_search"]);
    }
  });

  it("breaks the paging sequence when an hourly identity snapshot is incomplete", () => {
    const result = updateHybridRpcHourlyEvidence(
      {
        version: 1,
        windows: [
          { hour: "2026-08-23T01:00:00.000Z", rpcNames: ["hybrid_search"] },
          { hour: "2026-08-23T02:00:00.000Z", rpcNames: ["hybrid_search"] },
        ],
      },
      { slo: { hybridRpcIdentityEvidenceComplete: false, hybridRpcErrorCounts: { hybrid_search: 1 } } },
      new Date("2026-08-23T03:20:00Z"),
    );
    expect(result.repeatedRpcNames).toEqual([]);
  });
});

describe("renderDigest", () => {
  it("renders an unreachable digest when the probe failed", () => {
    const md = renderDigest(null, { error: "timeout after 20000ms" });
    expect(md).toContain("unreachable");
    expect(md).toContain("timeout after 20000ms");
    expect(md).toContain("OPS_ANSWER_SLO_UNKNOWN");
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
    expect(md).toContain("Alert state:** none (0)");
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
    expect(md).toContain("OPS_PROJECTED_DAILY_SPEND_WARNING");
  });
});
