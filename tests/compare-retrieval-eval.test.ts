import { describe, expect, it } from "vitest";
import { comparePerCaseRanks, compareRetrievalEval } from "../scripts/compare-retrieval-eval";

// A complete retrieval eval summary as emitted by summarizeGoldenRetrievalResults, trimmed to the
// fields the comparison reads.
function summary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    case_count: 24,
    document_recall_at_5: 1,
    content_recall_at_5: 1,
    top_k_hit_rate: 0.95,
    content_mrr_at_10: 0.9,
    content_mrr_case_count: 12,
    mrr_at_10: 0.88,
    median_latency_ms: 400,
    p90_latency_ms: 900,
    force_embedding_failure_count: 0,
    failed_cases: [],
    latency_failed_cases: [],
    retrieval_layer_counts: { index_units: 111991 },
    ...overrides,
  };
}

function row(comparison: ReturnType<typeof compareRetrievalEval>, name: string) {
  const found = comparison.rows.find((entry) => entry.name === name);
  if (!found) throw new Error(`missing row: ${name}`);
  return found;
}

describe("compareRetrievalEval", () => {
  it("reports content_mrr_at_10 and content_mrr_case_count deltas", () => {
    const comparison = compareRetrievalEval(
      summary({ content_mrr_at_10: 0.9, content_mrr_case_count: 12 }),
      summary({ content_mrr_at_10: 0.95, content_mrr_case_count: 12 }),
    );
    expect(comparison.missingRequired).toEqual([]);

    const passageMrr = row(comparison, "content_mrr_at_10");
    expect(passageMrr.baseline).toEqual({ present: true, value: 0.9 });
    expect(passageMrr.candidate).toEqual({ present: true, value: 0.95 });

    const passageCases = row(comparison, "content_mrr_case_count");
    expect(passageCases.candidate).toEqual({ present: true, value: 12 });
  });

  it("flags a missing required metric instead of coercing it to zero", () => {
    const candidate = summary();
    delete candidate.content_mrr_at_10;
    const comparison = compareRetrievalEval(summary(), candidate);

    expect(comparison.missingRequired).toContain("candidate.content_mrr_at_10");
    // The row is still emitted, but the candidate is marked absent rather than a misleading 0.
    expect(row(comparison, "content_mrr_at_10").candidate).toEqual({ present: false, value: 0 });
  });

  it("also fails closed when a core retrieval metric is missing on the baseline", () => {
    const baseline = summary();
    delete baseline.content_recall_at_5;
    const comparison = compareRetrievalEval(baseline, summary());
    expect(comparison.missingRequired).toContain("baseline.content_recall_at_5");
  });

  it("keeps optional context metrics best-effort when absent", () => {
    const withoutOptional = summary();
    delete withoutOptional.mrr_at_10;
    delete withoutOptional.p90_latency_ms;
    delete withoutOptional.retrieval_layer_counts;
    const comparison = compareRetrievalEval(withoutOptional, withoutOptional);

    // Optional metrics never contribute to missingRequired.
    expect(comparison.missingRequired).toEqual([]);
    expect(row(comparison, "mrr_at_10").baseline.present).toBe(false);
    expect(row(comparison, "p90_latency_ms").candidate.present).toBe(false);
    expect(row(comparison, "index_units_layer_count").baseline.present).toBe(false);
  });
});

// Per-case results as written by eval-retrieval's --json-out (trimmed to the compared fields).
function perCase(id: string, rr: number, contentRR: number): Record<string, unknown> {
  return { id, reciprocalRankAt10: rr, contentReciprocalRankAt10: contentRR };
}

describe("comparePerCaseRanks", () => {
  it("reports zero regressions for an identical pair", () => {
    const results = [perCase("a", 1, 1), perCase("b", 0.33, 0.5)];
    const comparison = comparePerCaseRanks(results, results);
    expect(comparison.regressions).toEqual([]);
    expect(comparison.comparedCaseCount).toBe(2);
    expect(comparison.missingInCandidate).toEqual([]);
    expect(comparison.missingInBaseline).toEqual([]);
  });

  it("flags any per-case rr drop even when the case would still pass its top-5 gate", () => {
    const comparison = comparePerCaseRanks([perCase("patient-property", 1, 1)], [perCase("patient-property", 0.11, 1)]);
    expect(comparison.regressions).toEqual([
      { caseId: "patient-property", metric: "reciprocalRankAt10", baseline: 1, candidate: 0.11 },
    ]);
  });

  it("tracks doc-level and content-level rank drops independently", () => {
    const comparison = comparePerCaseRanks([perCase("a", 0.5, 1)], [perCase("a", 0.5, 0.33)]);
    expect(comparison.regressions).toEqual([
      { caseId: "a", metric: "contentReciprocalRankAt10", baseline: 1, candidate: 0.33 },
    ]);
  });

  it("does not count an improvement as a regression", () => {
    const comparison = comparePerCaseRanks([perCase("a", 0.33, 0.5)], [perCase("a", 1, 1)]);
    expect(comparison.regressions).toEqual([]);
  });

  it("surfaces non-identical case sets so callers can fail closed", () => {
    const comparison = comparePerCaseRanks(
      [perCase("kept", 1, 1), perCase("dropped", 1, 1)],
      [perCase("kept", 1, 1), perCase("added", 1, 1)],
    );
    expect(comparison.missingInCandidate).toEqual(["dropped"]);
    expect(comparison.missingInBaseline).toEqual(["added"]);
    expect(comparison.comparedCaseCount).toBe(1);
  });
});
