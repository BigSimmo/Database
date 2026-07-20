import { describe, expect, it } from "vitest";
import { buildCaseTrend, buildTrendRows } from "../scripts/eval-trend.mjs";

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
