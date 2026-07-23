import { describe, expect, it } from "vitest";
import {
  buildAnswerQualityCaseTrend,
  buildAnswerQualityVariabilityRows,
  buildCaseTrend,
  buildTrendRows,
} from "../scripts/eval-trend.mjs";

const payload = (overrides: Record<string, unknown> = {}) => ({
  label: "run-a.json",
  payload: {
    summary: {
      document_recall_at_5: 1,
      content_recall_at_5: 1,
      mrr_at_10: 0.8921,
      content_mrr_at_10: 0.9228,
      irrelevant_source_rate_at_10: 0.1083,
      median_latency_ms: 11895,
      p90_latency_ms: 34045,
      failed_cases: [],
    },
    results: [
      {
        id: "lithium-therapy-monitoring",
        reciprocalRankAt10: 1,
        contentReciprocalRankAt10: 0.75,
        failures: [],
        retrievalStrategy: "text_fast_path",
      },
      {
        id: "flowchart-next-step",
        reciprocalRankAt10: 0.2,
        contentReciprocalRankAt10: 0.78,
        failures: [],
        retrievalStrategy: "text_fast_path",
      },
    ],
    ...overrides,
  },
});

describe("eval-trend aggregation", () => {
  it("builds one summary row per artifact in input order", () => {
    const failing = payload({
      summary: {
        document_recall_at_5: 0.9167,
        content_recall_at_5: 0.9653,
        mrr_at_10: 0.8138,
        failed_cases: ["a", "b", "c"],
      },
    });
    failing.label = "run-b.json";
    const rows = buildTrendRows([payload(), failing]);
    expect(rows.map((row: { label: string }) => row.label)).toEqual(["run-a.json", "run-b.json"]);
    expect(rows[0]).toMatchObject({ cases: 2, failed: 0, mrr_at_10: 0.8921, doc_recall_at_5: 1 });
    expect(rows[1]).toMatchObject({ failed: 3, mrr_at_10: 0.8138, doc_recall_at_5: 0.9167 });
  });

  it("tracks a single case's reciprocal rank across runs and flags absences", () => {
    const trend = buildCaseTrend([payload()], "flowchart-next-step");
    expect(trend[0]).toMatchObject({ found: true, rr_at_10: 0.2, strategy: "text_fast_path", passed: true });
    const missing = buildCaseTrend([payload()], "not-a-case");
    expect(missing[0]).toMatchObject({ found: false, rr_at_10: null, passed: null });
  });
});

const answerResult = (overrides: Record<string, unknown> = {}) => ({
  id: "neuroleptic-side-effect-escalation",
  failures: [],
  grounded: true,
  expectedHit: true,
  citations: 3,
  missingFiles: [],
  sourceDangerWarningCount: 0,
  unverifiedNumericTokenCount: 0,
  hasFaithfulnessWarning: false,
  route: "fast",
  latencyRoute: "fast",
  routingReason: "clinical_risk_or_complex_query",
  model: "gpt-test",
  openAIRequestIds: ["req-test"],
  routeCeilingExceeded: false,
  latencyMs: 1200,
  timings: {
    routeDeadlineExceeded: false,
    budgetExhaustedByRetrieval: false,
  },
  ...overrides,
});

const answerReport = (label: string, sha: string, result: Record<string, unknown>) => ({
  label,
  payload: {
    run_context: { git_sha: sha },
    rag: { results: [result] },
  },
});

describe("eval-trend answer-quality variability", () => {
  it("marks pass-to-content-failure changes on the same tree as variability, not a deterministic regression", () => {
    const rows = buildAnswerQualityVariabilityRows([
      answerReport("baseline", "same-sha", answerResult()),
      answerReport(
        "confirmation",
        "same-sha",
        answerResult({ failures: ["citation count below required minimum"], citations: 1 }),
      ),
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        case: "neuroleptic-side-effect-escalation",
        classification: "same_tree_content_variability",
        same_tree: true,
        runs: 2,
      }),
    ]);
  });

  it("separates latency and provider-route variability from content changes", () => {
    const latencyRows = buildAnswerQualityVariabilityRows([
      answerReport("baseline", "same-sha", answerResult()),
      answerReport(
        "slow",
        "same-sha",
        answerResult({
          failures: ["route latency ceiling exceeded: 5000ms total"],
          routeCeilingExceeded: true,
          latencyMs: 5000,
          timings: { routeDeadlineExceeded: true, budgetExhaustedByRetrieval: false },
        }),
      ),
    ]);
    expect(latencyRows[0]).toMatchObject({ classification: "latency_variability", same_tree: true });

    const providerRows = buildAnswerQualityVariabilityRows([
      answerReport("baseline", "same-sha", answerResult()),
      answerReport(
        "fallback",
        "same-sha",
        answerResult({
          route: "extractive",
          latencyRoute: "fallback",
          routingReason: "generation_fallback:provider_timeout",
          model: null,
        }),
      ),
    ]);
    expect(providerRows[0]).toMatchObject({ classification: "provider_route_variability", same_tree: true });
  });

  it("identifies a repeated content failure and emits stable per-case signatures", () => {
    const failed = answerResult({ failures: ["citation count below required minimum"], citations: 1 });
    const payloads = [answerReport("run-a", "same-sha", failed), answerReport("run-b", "same-sha", failed)];
    expect(buildAnswerQualityVariabilityRows(payloads)[0]).toMatchObject({
      classification: "repeated_content_failure",
      same_tree: true,
    });

    const trend = buildAnswerQualityCaseTrend(payloads, "neuroleptic-side-effect-escalation");
    expect(trend[0]).toMatchObject({ found: true, passed: false, git_sha: "same-sha" });
    expect(trend[0].diagnostic_signature).toMatch(/^[a-f0-9]{16}$/);
    expect(trend[1].diagnostic_signature).toBe(trend[0].diagnostic_signature);
  });
});
