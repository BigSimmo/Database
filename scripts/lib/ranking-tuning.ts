import type { RagQueryClass } from "../../src/lib/types";
import { neutralRankingFeatureWeights, type RankingFeatureWeights } from "../../src/lib/ranking-config";

export const RANKING_SNAPSHOT_VERSION = 1;

export const rankingFeatureKeys = [
  "hybridRelevance",
  "lexicalCoverage",
  "reciprocalRankFusion",
  "titleSectionRelevance",
  "metadataRelevance",
  "clinicalEvidence",
] as const satisfies readonly (keyof RankingFeatureWeights)[];

export type RankingCandidateFeatures = RankingFeatureWeights & {
  /** Signed governance, extraction-quality, and clinical safety adjustment. Never tuned. */
  fixedAdjustment: number;
};

export type RankingSnapshotCandidate = {
  candidateHash: string;
  relevanceGrade: 0 | 1 | 2 | 3;
  documentMatch: boolean;
  contentMatch: boolean;
  features: RankingCandidateFeatures;
  hardNegative?: {
    category:
      | "dose_administration_boilerplate"
      | "wrong_medication_document"
      | "mismatched_threshold"
      | "flowchart_missing_action"
      | "document_version_duplicate"
      | "comparison_single_document_crowding";
    risk: "high" | "medium";
  };
};

export type RankingSnapshotCase = {
  id: string;
  query: string;
  queryClass: RagQueryClass;
  expectedLabels: {
    documents: string[];
    content: string[];
  };
  candidates: RankingSnapshotCandidate[];
};

export type RankingSnapshot = {
  schema: "rag-ranking-candidate-snapshot";
  version: typeof RANKING_SNAPSHOT_VERSION;
  sourceCaseCount: number;
  /**
   * ISO timestamp of snapshot generation; drives the 30-day freshness gate. Required since the
   * first provenance-stamped regeneration (2026-07-20) so a hand-edit cannot silently remove
   * the freshness protection.
   */
  generatedAt: string;
  /** GitHub Actions run id of the eval-canary run whose artifact produced this snapshot. */
  sourceRunId?: string;
  sanitization: {
    candidateIdentity: "sha256";
    excludes: string[];
  };
  cases: RankingSnapshotCase[];
};

export type RankingMetrics = {
  caseCount: number;
  missingPositiveCases: number;
  mrrAt10: number;
  ndcgAt10: number;
  hardNegativeAccuracy: number;
  documentRecallAt5: number;
  contentRecallAt5: number;
  highRiskHardNegativeFailures: number;
  objective: number;
};

export type QueryClassTuningResult = {
  queryClass: RagQueryClass;
  selected: "neutral" | "improved";
  weights: RankingFeatureWeights;
  distanceFromCurrent: number;
  baseline: RankingMetrics;
  metrics: RankingMetrics;
};

const queryClasses: RagQueryClass[] = [
  "document_lookup",
  "table_threshold",
  "medication_dose_risk",
  "comparison",
  "broad_summary",
  "unsupported_or_general",
];

const hardNegativeCategories: NonNullable<RankingSnapshotCandidate["hardNegative"]>["category"][] = [
  "dose_administration_boilerplate",
  "wrong_medication_document",
  "mismatched_threshold",
  "flowchart_missing_action",
  "document_version_duplicate",
  "comparison_single_document_crowding",
];

const requiredSanitizationExcludes = [
  "raw_uuid",
  "source_passage",
  "patient_data",
  "provider_metadata",
  "document_storage_path",
] as const;

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
}

export function validateRankingSnapshot(value: unknown): RankingSnapshot {
  if (!isRecord(value)) throw new Error("Ranking snapshot must be an object");
  if (value.schema !== "rag-ranking-candidate-snapshot") throw new Error("Unsupported ranking snapshot schema");
  if (value.version !== RANKING_SNAPSHOT_VERSION) throw new Error("Unsupported ranking snapshot version");
  // Floor, not an exact pin: the golden fixture only grows (36 at introduction), and fewer
  // cases means a truncated artifact that must not become the tuner's ground truth.
  if (!Array.isArray(value.cases) || value.cases.length < 36) {
    throw new Error("Ranking snapshot must contain at least 36 cases");
  }
  if (value.sourceCaseCount !== value.cases.length) {
    throw new Error("Ranking snapshot sourceCaseCount must match cases.length");
  }
  // Required, not optional: every builder-produced snapshot is stamped, and an absent value
  // would silently disable the 30-day freshness gate in tests/ranking-tuning.test.ts.
  if (typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt))) {
    throw new Error("Ranking snapshot generatedAt must be an ISO date-time string");
  }
  if (value.sourceRunId !== undefined && (typeof value.sourceRunId !== "string" || !value.sourceRunId)) {
    throw new Error("Ranking snapshot sourceRunId must be a non-empty string when present");
  }
  const sanitization = value.sanitization;
  if (!isRecord(sanitization) || sanitization.candidateIdentity !== "sha256") {
    throw new Error("Ranking snapshot sanitization.candidateIdentity must be sha256");
  }
  if (
    !Array.isArray(sanitization.excludes) ||
    sanitization.excludes.some((item) => typeof item !== "string" || !item) ||
    requiredSanitizationExcludes.some((item) => !(sanitization.excludes as unknown[]).includes(item))
  ) {
    throw new Error("Ranking snapshot sanitization.excludes is invalid");
  }

  const seenCaseIds = new Set<string>();
  let hardNegativeCount = 0;
  for (const [caseIndex, testCase] of value.cases.entries()) {
    if (!isRecord(testCase)) throw new Error(`cases[${caseIndex}] must be an object`);
    if (typeof testCase.id !== "string" || !testCase.id) throw new Error(`cases[${caseIndex}].id is required`);
    if (seenCaseIds.has(testCase.id)) throw new Error(`Duplicate case id: ${testCase.id}`);
    seenCaseIds.add(testCase.id);
    if (typeof testCase.query !== "string" || !testCase.query) {
      throw new Error(`cases[${caseIndex}].query is required`);
    }
    if (!queryClasses.includes(testCase.queryClass as RagQueryClass)) {
      throw new Error(`cases[${caseIndex}].queryClass is invalid`);
    }
    if (!isRecord(testCase.expectedLabels)) {
      throw new Error(`cases[${caseIndex}].expectedLabels is invalid`);
    }
    for (const key of ["documents", "content"] as const) {
      const labels = testCase.expectedLabels[key];
      if (!Array.isArray(labels) || labels.some((label) => typeof label !== "string" || !label.trim())) {
        throw new Error(`cases[${caseIndex}].expectedLabels.${key} is invalid`);
      }
    }
    if (!Array.isArray(testCase.candidates) || testCase.candidates.length < 2) {
      throw new Error(`cases[${caseIndex}] must contain at least two candidates`);
    }
    for (const [candidateIndex, candidate] of testCase.candidates.entries()) {
      if (!isRecord(candidate)) throw new Error(`cases[${caseIndex}].candidates[${candidateIndex}] is invalid`);
      if (typeof candidate.candidateHash !== "string" || !/^sha256:[a-f0-9]{64}$/.test(candidate.candidateHash)) {
        throw new Error(`cases[${caseIndex}].candidates[${candidateIndex}] has an invalid hash`);
      }
      if (![0, 1, 2, 3].includes(candidate.relevanceGrade as number)) {
        throw new Error(`cases[${caseIndex}].candidates[${candidateIndex}] has an invalid grade`);
      }
      if (typeof candidate.documentMatch !== "boolean" || typeof candidate.contentMatch !== "boolean") {
        throw new Error(`cases[${caseIndex}].candidates[${candidateIndex}] has invalid match flags`);
      }
      if (!isRecord(candidate.features)) {
        throw new Error(`cases[${caseIndex}].candidates[${candidateIndex}] has invalid features`);
      }
      for (const key of [...rankingFeatureKeys, "fixedAdjustment"] as const) {
        assertFiniteNumber(candidate.features[key], `candidate feature ${key}`);
      }
      if (candidate.hardNegative !== undefined) {
        if (
          !isRecord(candidate.hardNegative) ||
          !hardNegativeCategories.includes(
            candidate.hardNegative.category as NonNullable<RankingSnapshotCandidate["hardNegative"]>["category"],
          ) ||
          !["high", "medium"].includes(candidate.hardNegative.risk as string)
        ) {
          throw new Error(`cases[${caseIndex}].candidates[${candidateIndex}] has an invalid hard negative`);
        }
        hardNegativeCount += 1;
      }
    }
  }
  if (hardNegativeCount < 12) throw new Error("Ranking snapshot must contain at least 12 hard negatives");
  return value as RankingSnapshot;
}

export function scoreSnapshotCandidate(candidate: RankingSnapshotCandidate, weights: RankingFeatureWeights): number {
  return (
    candidate.features.hybridRelevance * weights.hybridRelevance +
    candidate.features.lexicalCoverage * weights.lexicalCoverage +
    candidate.features.reciprocalRankFusion * weights.reciprocalRankFusion +
    candidate.features.titleSectionRelevance * weights.titleSectionRelevance +
    candidate.features.metadataRelevance * weights.metadataRelevance +
    candidate.features.clinicalEvidence * weights.clinicalEvidence +
    candidate.features.fixedAdjustment
  );
}

export function rankSnapshotCandidates(
  testCase: RankingSnapshotCase,
  weights: RankingFeatureWeights,
): RankingSnapshotCandidate[] {
  return [...testCase.candidates].sort(
    (left, right) =>
      scoreSnapshotCandidate(right, weights) - scoreSnapshotCandidate(left, weights) ||
      left.candidateHash.localeCompare(right.candidateHash),
  );
}

function reciprocalRank(ranked: RankingSnapshotCandidate[]): number {
  const index = ranked.slice(0, 10).findIndex((candidate) => candidate.relevanceGrade > 0);
  return index < 0 ? 0 : 1 / (index + 1);
}

function ndcgAt10(ranked: RankingSnapshotCandidate[]): number {
  const dcg = ranked.slice(0, 10).reduce((sum, candidate, index) => {
    const gain = 2 ** candidate.relevanceGrade - 1;
    return sum + gain / Math.log2(index + 2);
  }, 0);
  const ideal = [...ranked]
    .sort((left, right) => right.relevanceGrade - left.relevanceGrade)
    .slice(0, 10)
    .reduce((sum, candidate, index) => {
      const gain = 2 ** candidate.relevanceGrade - 1;
      return sum + gain / Math.log2(index + 2);
    }, 0);
  return ideal === 0 ? 0 : dcg / ideal;
}

export function evaluateRankingCases(cases: RankingSnapshotCase[], weights: RankingFeatureWeights): RankingMetrics {
  if (cases.length === 0) {
    return {
      caseCount: 0,
      missingPositiveCases: 0,
      mrrAt10: 0,
      ndcgAt10: 0,
      hardNegativeAccuracy: 1,
      documentRecallAt5: 1,
      contentRecallAt5: 1,
      highRiskHardNegativeFailures: 0,
      objective: 0,
    };
  }

  let mrr = 0;
  let ndcg = 0;
  let documentRecall = 0;
  let contentRecall = 0;
  let correctHardNegatives = 0;
  let hardNegativeCount = 0;
  let highRiskFailures = 0;
  let missingPositiveCases = 0;

  for (const testCase of cases) {
    const ranked = rankSnapshotCandidates(testCase, weights);
    const topFive = ranked.slice(0, 5);
    const firstRelevantIndex = ranked.findIndex((candidate) => candidate.relevanceGrade > 0);
    if (firstRelevantIndex < 0) missingPositiveCases += 1;
    mrr += reciprocalRank(ranked);
    ndcg += ndcgAt10(ranked);
    documentRecall += topFive.some((candidate) => candidate.documentMatch) ? 1 : 0;
    contentRecall += topFive.some((candidate) => candidate.contentMatch) ? 1 : 0;
    ranked.forEach((candidate, index) => {
      if (!candidate.hardNegative || firstRelevantIndex < 0) return;
      hardNegativeCount += 1;
      const passed = index > firstRelevantIndex;
      if (passed) correctHardNegatives += 1;
      if (!passed && candidate.hardNegative.risk === "high") highRiskFailures += 1;
    });
  }

  const mrrAt10 = round6(mrr / cases.length);
  const ndcgScore = round6(ndcg / cases.length);
  const hardNegativeAccuracy = round6(hardNegativeCount ? correctHardNegatives / hardNegativeCount : 1);
  return {
    caseCount: cases.length,
    missingPositiveCases,
    mrrAt10,
    ndcgAt10: ndcgScore,
    hardNegativeAccuracy,
    documentRecallAt5: round6(documentRecall / cases.length),
    contentRecallAt5: round6(contentRecall / cases.length),
    highRiskHardNegativeFailures: highRiskFailures,
    objective: round6(0.55 * mrrAt10 + 0.35 * ndcgScore + 0.1 * hardNegativeAccuracy),
  };
}

function coordinateVariants(current: RankingFeatureWeights): RankingFeatureWeights[] {
  const variants: RankingFeatureWeights[] = [];
  for (const key of rankingFeatureKeys) {
    for (const delta of [-0.1, -0.05, 0.05, 0.1]) {
      variants.push({ ...current, [key]: round6(Math.max(0, current[key] + delta)) });
    }
  }
  return variants;
}

function distanceFromCurrent(weights: RankingFeatureWeights, current: RankingFeatureWeights): number {
  return round6(rankingFeatureKeys.reduce((sum, key) => sum + Math.abs(weights[key] - current[key]), 0));
}

function stableWeightKey(weights: RankingFeatureWeights): string {
  return rankingFeatureKeys.map((key) => `${key}:${weights[key].toFixed(6)}`).join("|");
}

export function tuneRankingSnapshot(snapshot: RankingSnapshot): QueryClassTuningResult[] {
  const current = { ...neutralRankingFeatureWeights };
  return queryClasses.map((queryClass) => {
    const cases = snapshot.cases.filter((testCase) => testCase.queryClass === queryClass);
    const baseline = evaluateRankingCases(cases, current);
    const eligible = coordinateVariants(current)
      .map((weights) => ({ weights, metrics: evaluateRankingCases(cases, weights) }))
      .filter(
        ({ metrics }) =>
          metrics.objective > baseline.objective + 0.0000001 &&
          metrics.documentRecallAt5 >= baseline.documentRecallAt5 &&
          metrics.contentRecallAt5 >= baseline.contentRecallAt5 &&
          metrics.highRiskHardNegativeFailures === 0,
      )
      .map((candidate) => ({
        ...candidate,
        distanceFromCurrent: distanceFromCurrent(candidate.weights, current),
      }))
      .sort(
        (left, right) =>
          left.distanceFromCurrent - right.distanceFromCurrent ||
          right.metrics.objective - left.metrics.objective ||
          stableWeightKey(left.weights).localeCompare(stableWeightKey(right.weights)),
      );
    const selected = eligible[0];
    if (!selected) {
      return {
        queryClass,
        selected: "neutral",
        weights: { ...current },
        distanceFromCurrent: 0,
        baseline,
        metrics: baseline,
      };
    }
    return {
      queryClass,
      selected: "improved",
      weights: selected.weights,
      distanceFromCurrent: selected.distanceFromCurrent,
      baseline,
      metrics: selected.metrics,
    };
  });
}
