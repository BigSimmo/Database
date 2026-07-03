// Non-degradation gate for the shadow re-index (Task #6 core). Given the eval summaries for
// the current live (baseline) index and a staged candidate generation, decide GO/NO-GO for
// cutover. The contract (docs/retrieval-quality-runbook.md + the re-index plan) is twofold:
//   1. Absolute bars — the candidate must independently clear the release thresholds.
//   2. No regression — the candidate must be no worse than the live baseline (within a small
//      tolerance for eval noise), so a re-index can only hold or improve quality.
// A cutover proceeds only when EVERY check passes. This module is pure and deterministic so
// the gate itself is unit-tested; the (live) shadow driver feeds it eval JSON and acts on it.

// Subsets of scripts/eval-retrieval.ts and scripts/eval-quality.ts summary output. Field
// names match those scripts so the driver can pass summaries through unchanged.
export type RetrievalGateSummary = {
  document_recall_at_5: number;
  content_recall_at_5: number;
  top_k_hit_rate: number;
  mrr_at_10?: number;
  p90_latency_ms?: number;
};

export type QualityGateSummary = {
  grounded_supported_rate: number;
  unsupported_count: number;
  unsupported_correct_rate: number;
  expected_hit_rate?: number;
  citation_failure_rate: number;
  numeric_grounding_failure_rate: number;
  source_governance_danger_failure_rate: number;
  expected_danger_warning_missing_count: number;
  stale_review_unknown_rate: number;
  review_required_rate: number;
  p95_latency_ms: number;
};

export type ReindexGateConfig = {
  retrieval: {
    documentRecallAt5Floor: number;
    contentRecallAt5Floor: number;
    topKHitRateFloor: number;
    rateRegressionTolerance: number;
    latencyRegressionMs: number;
  };
  quality: {
    groundedSupportedRateFloor: number;
    unsupportedCorrectRateFloor: number;
    citationFailureRateCeiling: number;
    numericGroundingFailureRateCeiling: number;
    sourceGovernanceDangerFailureRateCeiling: number;
    expectedDangerWarningMissingCountCeiling: number;
    staleReviewUnknownRateCeiling: number;
    reviewRequiredRateCeiling: number;
    p95LatencyMsCeiling: number;
    rateRegressionTolerance: number;
    latencyRegressionMs: number;
  };
};

// Defaults taken directly from the release thresholds in docs/retrieval-quality-runbook.md.
export const defaultReindexGateConfig: ReindexGateConfig = {
  retrieval: {
    documentRecallAt5Floor: 0.8,
    contentRecallAt5Floor: 0.8,
    topKHitRateFloor: 0.8,
    rateRegressionTolerance: 0.02,
    latencyRegressionMs: 4000,
  },
  quality: {
    groundedSupportedRateFloor: 0.9,
    unsupportedCorrectRateFloor: 1.0,
    citationFailureRateCeiling: 0,
    numericGroundingFailureRateCeiling: 0,
    sourceGovernanceDangerFailureRateCeiling: 0,
    expectedDangerWarningMissingCountCeiling: 0,
    staleReviewUnknownRateCeiling: 0.25,
    reviewRequiredRateCeiling: 0.25,
    p95LatencyMsCeiling: 25000,
    rateRegressionTolerance: 0.02,
    latencyRegressionMs: 4000,
  },
};

export type MetricCheck = {
  metric: string;
  direction: "higher_better" | "lower_better";
  baseline: number;
  candidate: number;
  bound: number | null; // absolute floor (higher_better) / ceiling (lower_better)
  tolerance: number;
  passed: boolean;
  reasons: string[];
};

export type ReindexGateDecision = {
  decision: "GO" | "NO_GO";
  checks: MetricCheck[];
  failures: string[];
};

const requiredQualityMetrics = [
  "grounded_supported_rate",
  "unsupported_count",
  "unsupported_correct_rate",
  "citation_failure_rate",
  "numeric_grounding_failure_rate",
  "source_governance_danger_failure_rate",
  "expected_danger_warning_missing_count",
  "stale_review_unknown_rate",
  "review_required_rate",
  "p95_latency_ms",
] as const satisfies readonly (keyof QualityGateSummary)[];

function evaluateCheck(input: {
  metric: string;
  direction: "higher_better" | "lower_better";
  baseline: number;
  candidate: number;
  bound: number | null;
  tolerance: number;
}): MetricCheck {
  const reasons: string[] = [];
  const { metric, direction, baseline, candidate, bound, tolerance } = input;

  if (bound !== null) {
    const meetsBound = direction === "higher_better" ? candidate >= bound : candidate <= bound;
    if (!meetsBound) {
      reasons.push(
        direction === "higher_better"
          ? `${metric} ${candidate} below absolute floor ${bound}`
          : `${metric} ${candidate} above absolute ceiling ${bound}`,
      );
    }
  }

  const noRegression =
    direction === "higher_better" ? candidate >= baseline - tolerance : candidate <= baseline + tolerance;
  if (!noRegression) {
    reasons.push(
      direction === "higher_better"
        ? `${metric} regressed: candidate ${candidate} < baseline ${baseline} - tolerance ${tolerance}`
        : `${metric} regressed: candidate ${candidate} > baseline ${baseline} + tolerance ${tolerance}`,
    );
  }

  return { metric, direction, baseline, candidate, bound, tolerance, passed: reasons.length === 0, reasons };
}

function retrievalChecks(
  baseline: RetrievalGateSummary,
  candidate: RetrievalGateSummary,
  config: ReindexGateConfig["retrieval"],
): MetricCheck[] {
  const checks: MetricCheck[] = [
    evaluateCheck({
      metric: "document_recall_at_5",
      direction: "higher_better",
      baseline: baseline.document_recall_at_5,
      candidate: candidate.document_recall_at_5,
      bound: config.documentRecallAt5Floor,
      tolerance: config.rateRegressionTolerance,
    }),
    evaluateCheck({
      metric: "content_recall_at_5",
      direction: "higher_better",
      baseline: baseline.content_recall_at_5,
      candidate: candidate.content_recall_at_5,
      bound: config.contentRecallAt5Floor,
      tolerance: config.rateRegressionTolerance,
    }),
    evaluateCheck({
      metric: "top_k_hit_rate",
      direction: "higher_better",
      baseline: baseline.top_k_hit_rate,
      candidate: candidate.top_k_hit_rate,
      bound: config.topKHitRateFloor,
      tolerance: config.rateRegressionTolerance,
    }),
  ];
  // mrr@10 and p90 latency are no-regression only (no absolute bar) and skipped unless both
  // summaries carry them.
  if (typeof baseline.mrr_at_10 === "number" && typeof candidate.mrr_at_10 === "number") {
    checks.push(
      evaluateCheck({
        metric: "mrr_at_10",
        direction: "higher_better",
        baseline: baseline.mrr_at_10,
        candidate: candidate.mrr_at_10,
        bound: null,
        tolerance: config.rateRegressionTolerance,
      }),
    );
  }
  if (typeof baseline.p90_latency_ms === "number" && typeof candidate.p90_latency_ms === "number") {
    checks.push(
      evaluateCheck({
        metric: "p90_latency_ms",
        direction: "lower_better",
        baseline: baseline.p90_latency_ms,
        candidate: candidate.p90_latency_ms,
        bound: null,
        tolerance: config.latencyRegressionMs,
      }),
    );
  }
  return checks;
}

function qualityChecks(
  baseline: QualityGateSummary,
  candidate: QualityGateSummary,
  config: ReindexGateConfig["quality"],
): MetricCheck[] {
  const checks: MetricCheck[] = [
    evaluateCheck({
      metric: "grounded_supported_rate",
      direction: "higher_better",
      baseline: baseline.grounded_supported_rate,
      candidate: candidate.grounded_supported_rate,
      bound: config.groundedSupportedRateFloor,
      tolerance: config.rateRegressionTolerance,
    }),
    evaluateCheck({
      metric: "citation_failure_rate",
      direction: "lower_better",
      baseline: baseline.citation_failure_rate,
      candidate: candidate.citation_failure_rate,
      bound: config.citationFailureRateCeiling,
      tolerance: 0,
    }),
    evaluateCheck({
      metric: "numeric_grounding_failure_rate",
      direction: "lower_better",
      baseline: baseline.numeric_grounding_failure_rate,
      candidate: candidate.numeric_grounding_failure_rate,
      bound: config.numericGroundingFailureRateCeiling,
      tolerance: 0,
    }),
    evaluateCheck({
      metric: "source_governance_danger_failure_rate",
      direction: "lower_better",
      baseline: baseline.source_governance_danger_failure_rate,
      candidate: candidate.source_governance_danger_failure_rate,
      bound: config.sourceGovernanceDangerFailureRateCeiling,
      tolerance: 0,
    }),
    evaluateCheck({
      metric: "expected_danger_warning_missing_count",
      direction: "lower_better",
      baseline: baseline.expected_danger_warning_missing_count,
      candidate: candidate.expected_danger_warning_missing_count,
      bound: config.expectedDangerWarningMissingCountCeiling,
      tolerance: 0,
    }),
    evaluateCheck({
      metric: "p95_latency_ms",
      direction: "lower_better",
      baseline: baseline.p95_latency_ms,
      candidate: candidate.p95_latency_ms,
      bound: config.p95LatencyMsCeiling,
      tolerance: config.latencyRegressionMs,
    }),
  ];
  if (baseline.unsupported_count > 0 || candidate.unsupported_count > 0) {
    checks.push(
      evaluateCheck({
        metric: "unsupported_correct_rate",
        direction: "higher_better",
        baseline: baseline.unsupported_correct_rate,
        candidate: candidate.unsupported_correct_rate,
        bound: config.unsupportedCorrectRateFloor,
        tolerance: 0,
      }),
    );
  }
  if (typeof baseline.expected_hit_rate === "number" && typeof candidate.expected_hit_rate === "number") {
    checks.push(
      evaluateCheck({
        metric: "expected_hit_rate",
        direction: "higher_better",
        baseline: baseline.expected_hit_rate,
        candidate: candidate.expected_hit_rate,
        bound: null,
        tolerance: config.rateRegressionTolerance,
      }),
    );
  }
  checks.push(
    evaluateCheck({
      metric: "stale_review_unknown_rate",
      direction: "lower_better",
      baseline: baseline.stale_review_unknown_rate,
      candidate: candidate.stale_review_unknown_rate,
      bound: config.staleReviewUnknownRateCeiling,
      tolerance: config.rateRegressionTolerance,
    }),
    evaluateCheck({
      metric: "review_required_rate",
      direction: "lower_better",
      baseline: baseline.review_required_rate,
      candidate: candidate.review_required_rate,
      bound: config.reviewRequiredRateCeiling,
      tolerance: config.rateRegressionTolerance,
    }),
  );
  return checks;
}

function missingQualityMetrics(label: "baselineQuality" | "candidateQuality", summary: QualityGateSummary) {
  return requiredQualityMetrics.flatMap((metric) =>
    typeof summary[metric] === "number" && Number.isFinite(summary[metric]) ? [] : [`${label}.${metric}`],
  );
}

export function decideReindexGate(
  input: {
    baselineRetrieval: RetrievalGateSummary;
    candidateRetrieval: RetrievalGateSummary;
    baselineQuality?: QualityGateSummary;
    candidateQuality?: QualityGateSummary;
  },
  config: ReindexGateConfig = defaultReindexGateConfig,
): ReindexGateDecision {
  const checks = retrievalChecks(input.baselineRetrieval, input.candidateRetrieval, config.retrieval);

  const hasBaselineQuality = Boolean(input.baselineQuality);
  const hasCandidateQuality = Boolean(input.candidateQuality);
  if (hasBaselineQuality !== hasCandidateQuality) {
    // A one-sided quality summary is a driver error; fail closed rather than silently
    // gating on retrieval alone.
    return {
      decision: "NO_GO",
      checks,
      failures: ["quality summaries must be provided for both baseline and candidate, or neither"],
    };
  }
  if (input.baselineQuality && input.candidateQuality) {
    const missingMetrics = [
      ...missingQualityMetrics("baselineQuality", input.baselineQuality),
      ...missingQualityMetrics("candidateQuality", input.candidateQuality),
    ];
    if (missingMetrics.length > 0) {
      return {
        decision: "NO_GO",
        checks,
        failures: [`quality summaries are missing required metrics: ${missingMetrics.join(", ")}`],
      };
    }
    checks.push(...qualityChecks(input.baselineQuality, input.candidateQuality, config.quality));
  }

  const failures = checks.flatMap((check) => check.reasons);
  return { decision: failures.length === 0 ? "GO" : "NO_GO", checks, failures };
}
