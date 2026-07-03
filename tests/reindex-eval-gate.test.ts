import { describe, expect, it } from "vitest";
import { decideReindexGate, type QualityGateSummary, type RetrievalGateSummary } from "../src/lib/reindex-eval-gate";

function retrieval(overrides: Partial<RetrievalGateSummary> = {}): RetrievalGateSummary {
  return {
    document_recall_at_5: 0.9,
    content_recall_at_5: 0.9,
    top_k_hit_rate: 0.95,
    mrr_at_10: 0.8,
    p90_latency_ms: 8000,
    ...overrides,
  };
}

function quality(overrides: Partial<QualityGateSummary> = {}): QualityGateSummary {
  return {
    grounded_supported_rate: 0.95,
    unsupported_count: 1,
    unsupported_correct_rate: 1,
    expected_hit_rate: 0.9,
    citation_failure_rate: 0,
    numeric_grounding_failure_rate: 0,
    source_governance_danger_failure_rate: 0,
    expected_danger_warning_missing_count: 0,
    stale_review_unknown_rate: 0.1,
    review_required_rate: 0.1,
    p95_latency_ms: 18000,
    ...overrides,
  };
}

describe("decideReindexGate — retrieval", () => {
  it("returns GO when the candidate matches or beats the baseline and clears the floors", () => {
    const decision = decideReindexGate({
      baselineRetrieval: retrieval(),
      candidateRetrieval: retrieval({ content_recall_at_5: 0.92 }),
    });
    expect(decision.decision).toBe("GO");
    expect(decision.failures).toEqual([]);
  });

  it("returns NO_GO when an absolute floor is breached", () => {
    const decision = decideReindexGate({
      baselineRetrieval: retrieval({ content_recall_at_5: 0.78 }),
      candidateRetrieval: retrieval({ content_recall_at_5: 0.75 }),
    });
    expect(decision.decision).toBe("NO_GO");
    expect(decision.failures.join(" ")).toMatch(/content_recall_at_5 0.75 below absolute floor 0.8/);
  });

  it("returns NO_GO on a real regression even when both values clear the floor", () => {
    // Baseline 0.98, candidate 0.85 — both above the 0.8 floor, but a 13-point drop is a
    // regression well beyond the 0.02 tolerance.
    const decision = decideReindexGate({
      baselineRetrieval: retrieval({ document_recall_at_5: 0.98 }),
      candidateRetrieval: retrieval({ document_recall_at_5: 0.85 }),
    });
    expect(decision.decision).toBe("NO_GO");
    expect(decision.failures.join(" ")).toMatch(/document_recall_at_5 regressed/);
  });

  it("tolerates sub-threshold eval noise below the baseline", () => {
    // 0.90 -> 0.89 is within the 0.02 tolerance and still above the floor => GO.
    const decision = decideReindexGate({
      baselineRetrieval: retrieval({ content_recall_at_5: 0.9 }),
      candidateRetrieval: retrieval({ content_recall_at_5: 0.89 }),
    });
    expect(decision.decision).toBe("GO");
  });

  it("flags a p90 latency regression beyond the allowed drift", () => {
    const decision = decideReindexGate({
      baselineRetrieval: retrieval({ p90_latency_ms: 8000 }),
      candidateRetrieval: retrieval({ p90_latency_ms: 14000 }),
    });
    expect(decision.decision).toBe("NO_GO");
    expect(decision.failures.join(" ")).toMatch(/p90_latency_ms regressed/);
  });

  it("skips optional metrics when either summary omits them", () => {
    const decision = decideReindexGate({
      baselineRetrieval: { document_recall_at_5: 0.9, content_recall_at_5: 0.9, top_k_hit_rate: 0.9 },
      candidateRetrieval: { document_recall_at_5: 0.9, content_recall_at_5: 0.9, top_k_hit_rate: 0.9 },
    });
    expect(decision.decision).toBe("GO");
    expect(decision.checks.some((check) => check.metric === "mrr_at_10")).toBe(false);
    expect(decision.checks.some((check) => check.metric === "p90_latency_ms")).toBe(false);
  });
});

describe("decideReindexGate — quality", () => {
  it("returns GO when retrieval and quality both hold", () => {
    const decision = decideReindexGate({
      baselineRetrieval: retrieval(),
      candidateRetrieval: retrieval(),
      baselineQuality: quality(),
      candidateQuality: quality(),
    });
    expect(decision.decision).toBe("GO");
  });

  it("returns NO_GO when any hard-zero failure rate is non-zero", () => {
    const decision = decideReindexGate({
      baselineRetrieval: retrieval(),
      candidateRetrieval: retrieval(),
      baselineQuality: quality(),
      candidateQuality: quality({ citation_failure_rate: 0.05 }),
    });
    expect(decision.decision).toBe("NO_GO");
    expect(decision.failures.join(" ")).toMatch(/citation_failure_rate 0.05 above absolute ceiling 0/);
  });

  it("skips unsupported_correct_rate when there are no unsupported cases", () => {
    const decision = decideReindexGate({
      baselineRetrieval: retrieval(),
      candidateRetrieval: retrieval(),
      baselineQuality: quality({ unsupported_count: 0, unsupported_correct_rate: 0 }),
      candidateQuality: quality({ unsupported_count: 0, unsupported_correct_rate: 0 }),
    });
    expect(decision.decision).toBe("GO");
    expect(decision.checks.some((check) => check.metric === "unsupported_correct_rate")).toBe(false);
  });

  it("returns NO_GO when an expected danger warning is missing", () => {
    const decision = decideReindexGate({
      baselineRetrieval: retrieval(),
      candidateRetrieval: retrieval(),
      baselineQuality: quality(),
      candidateQuality: quality({ expected_danger_warning_missing_count: 1 }),
    });
    expect(decision.decision).toBe("NO_GO");
    expect(decision.failures.join(" ")).toMatch(/expected_danger_warning_missing_count 1 above absolute ceiling 0/);
  });

  it("returns NO_GO when grounded_supported_rate falls below the floor", () => {
    const decision = decideReindexGate({
      baselineRetrieval: retrieval(),
      candidateRetrieval: retrieval(),
      baselineQuality: quality({ grounded_supported_rate: 0.92 }),
      candidateQuality: quality({ grounded_supported_rate: 0.85 }),
    });
    expect(decision.decision).toBe("NO_GO");
    expect(decision.failures.join(" ")).toMatch(/grounded_supported_rate 0.85 below absolute floor 0.9/);
  });

  it("returns NO_GO when p95 latency exceeds the ceiling", () => {
    const decision = decideReindexGate({
      baselineRetrieval: retrieval(),
      candidateRetrieval: retrieval(),
      baselineQuality: quality(),
      candidateQuality: quality({ p95_latency_ms: 26000 }),
    });
    expect(decision.decision).toBe("NO_GO");
    expect(decision.failures.join(" ")).toMatch(/p95_latency_ms 26000 above absolute ceiling 25000/);
  });

  it("fails closed when only one side supplies a quality summary", () => {
    const decision = decideReindexGate({
      baselineRetrieval: retrieval(),
      candidateRetrieval: retrieval(),
      candidateQuality: quality(),
    });
    expect(decision.decision).toBe("NO_GO");
    expect(decision.failures.join(" ")).toMatch(/quality summaries must be provided for both/);
  });

  it("fails closed when quality summaries omit required source governance rates", () => {
    const withoutGovernanceRates = quality() as Partial<QualityGateSummary>;
    delete withoutGovernanceRates.stale_review_unknown_rate;
    delete withoutGovernanceRates.review_required_rate;

    const decision = decideReindexGate({
      baselineRetrieval: retrieval(),
      candidateRetrieval: retrieval(),
      baselineQuality: quality(),
      candidateQuality: withoutGovernanceRates as QualityGateSummary,
    });
    expect(decision.decision).toBe("NO_GO");
    expect(decision.failures.join(" ")).toMatch(/candidateQuality\.stale_review_unknown_rate/);
    expect(decision.failures.join(" ")).toMatch(/candidateQuality\.review_required_rate/);
  });
});
