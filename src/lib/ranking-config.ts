import { z } from "zod";

import type { RagQueryClass } from "./types";

// Central, tunable ranking configuration for the app-layer retrieval rerank (W6).
//
// Rationale: the second-stage rerank weights, the document-diversity control, and the
// freshness decay were previously hard-coded magic numbers scattered across rag.ts and
// clinical-search.ts. Tuning them meant editing (and redeploying) code — the same friction
// CI-18 calls out. This module makes them one config object with an optional JSON override
// (RAG_RANKING_CONFIG), so `tune:search-weights` and eval-gated experiments can adjust
// ranking without code edits.
//
// Defaults were eval-gated ON (2026-07-03). The secondStage weights still equal the constants
// they replaced, but the two behaviors #213 shipped OFF are now ON by default because the golden
// retrieval + rag-only quality evals showed a strict improvement with no regression on the safety
// bar (retrieval mrr@10 0.728 -> 0.757, document/content recall@5 stays 1.0, grounded_supported
// 0.967 -> 1.0, unsupported_correct unchanged, citation/numeric failure 0):
//   * documentDiversityPenalty = 0.02 (gentle same-document crowding demotion, capped 0.12; RC7/CI-16),
//   * freshness.mode = "linear" (ramped decay instead of the harsh cliff; CI-17).
// The RAG_RANKING_CONFIG JSON override still allows further per-deployment tuning, and setting
// documentDiversityPenalty:0 + freshness.mode:"step" restores the exact pre-flip behavior.

export type SecondStageWeights = {
  /** Position-decay boost applied to the top result, decaying by positionStep per rank. */
  positionBase: number;
  positionStep: number;
  /** Boost for memory-card evidence on broad-summary / comparison queries. */
  memorySummaryBoost: number;
  /** Boost when a document-lookup query hits a title/label. */
  documentLookupTitleBoost: number;
  /** Boost when a table/threshold or dose-risk query has table-fact evidence. */
  tableThresholdEvidenceBoost: number;
  /** Boost when a dose-risk query surfaces an explicit dose amount. */
  doseAmountBoost: number;
  /** Boost for table-visual and (lower) other-visual evidence unit types. */
  tableVisualBoost: number;
  visualBoost: number;
  /** Visual-intelligence source-quality boost: min(max, (quality - pivot) * slope). */
  visualIntelligenceMax: number;
  visualIntelligencePivot: number;
  visualIntelligenceSlope: number;
  /** Penalties for governance/quality signals. */
  outdatedPenalty: number;
  /**
   * Penalty for document_status "unknown" (currentness never established).
   * Ships 0 = OFF (audit item D4): per the #118 lesson, governance weighting
   * needs golden-eval proof before activation — enable via RAG_RANKING_CONFIG
   * only behind a fresh green golden retrieval + answer-quality run.
   */
  unknownCurrentnessPenalty: number;
  poorExtractionPenalty: number;
  lowIndexQualityPenalty: number;
  lowIndexQualityThreshold: number;
};

export type FreshnessConfig = {
  /** "step" = original cliff (default, zero-change); "linear" = ramped decay curve (CI-17). */
  mode: "step" | "linear";
  publicationCliffYears: number;
  publicationPenalty: number;
  reviewCliffYears: number;
  reviewPenalty: number;
  /** In "linear" mode, years over which the penalty ramps up to reach the cliff. */
  linearRampYears: number;
};

export type RankingConfig = {
  secondStage: SecondStageWeights;
  /** Query-class-specific multipliers over deterministic relevance features. */
  featureFusion: Record<RagQueryClass, RankingFeatureWeights>;
  /** Demotion subtracted per EXTRA chunk from the same document (0 = diversity OFF). CI-16. */
  documentDiversityPenalty: number;
  /** Maximum cumulative diversity demotion for any single chunk. */
  documentDiversityPenaltyCap: number;
  freshness: FreshnessConfig;
};

export type RankingFeatureWeights = {
  hybridRelevance: number;
  lexicalCoverage: number;
  reciprocalRankFusion: number;
  titleSectionRelevance: number;
  metadataRelevance: number;
  clinicalEvidence: number;
};

export const neutralRankingFeatureWeights: RankingFeatureWeights = {
  hybridRelevance: 1,
  lexicalCoverage: 1,
  reciprocalRankFusion: 1,
  titleSectionRelevance: 1,
  metadataRelevance: 1,
  clinicalEvidence: 1,
};

const ragQueryClasses: RagQueryClass[] = [
  "document_lookup",
  "table_threshold",
  "medication_dose_risk",
  "comparison",
  "broad_summary",
  "unsupported_or_general",
];

function defaultFeatureFusion(): Record<RagQueryClass, RankingFeatureWeights> {
  const fusion = Object.fromEntries(
    ragQueryClasses.map((queryClass) => [queryClass, { ...neutralRankingFeatureWeights }]),
  ) as Record<RagQueryClass, RankingFeatureWeights>;
  // Snapshot v1 coordinate tuning: 1.0 -> 0.9 improved broad-summary objective
  // 0.969703 -> 0.989912 with document recall 1.0, content recall 0.9, and no
  // hard-negative failures. Every other class retained the neutral configuration.
  fusion.broad_summary.clinicalEvidence = 0.9;
  return fusion;
}

export const defaultRankingConfig: RankingConfig = {
  secondStage: {
    positionBase: 0.09,
    positionStep: 0.004,
    memorySummaryBoost: 0.035,
    documentLookupTitleBoost: 0.045,
    tableThresholdEvidenceBoost: 0.065,
    doseAmountBoost: 0.18,
    tableVisualBoost: 0.08,
    visualBoost: 0.04,
    visualIntelligenceMax: 0.035,
    visualIntelligencePivot: 0.55,
    visualIntelligenceSlope: 0.08,
    outdatedPenalty: 0.035,
    unknownCurrentnessPenalty: 0,
    poorExtractionPenalty: 0.035,
    lowIndexQualityPenalty: 0.035,
    lowIndexQualityThreshold: 0.55,
  },
  // Per-class overrides are accepted only when the offline tuner improves the objective while
  // recall and high-risk hard-negative constraints remain green.
  featureFusion: defaultFeatureFusion(),
  documentDiversityPenalty: 0.02,
  documentDiversityPenaltyCap: 0.12,
  freshness: {
    mode: "linear",
    publicationCliffYears: 8,
    publicationPenalty: -0.015,
    reviewCliffYears: 5,
    reviewPenalty: -0.01,
    linearRampYears: 3,
  },
};

// Ranking scores are deliberately small in the evaluated defaults (generally << 1).
// A ceiling of 10 remains broad enough for experiments while preventing an accidental
// extreme value from overwhelming every other retrieval signal. Threshold-like values
// use their natural [0, 1] domain, while freshness penalties may only demote.
const rankingMagnitudeSchema = z.number().finite().min(0).max(10);
const unitIntervalSchema = z.number().finite().min(0).max(1);
const freshnessYearsSchema = z.number().finite().min(0).max(100);
const freshnessRampYearsSchema = z.number().finite().gt(0).max(100);
const freshnessPenaltySchema = z.number().finite().min(-1).max(0);

const secondStageOverrideSchema = z
  .object({
    positionBase: rankingMagnitudeSchema.optional(),
    positionStep: rankingMagnitudeSchema.optional(),
    memorySummaryBoost: rankingMagnitudeSchema.optional(),
    documentLookupTitleBoost: rankingMagnitudeSchema.optional(),
    tableThresholdEvidenceBoost: rankingMagnitudeSchema.optional(),
    doseAmountBoost: rankingMagnitudeSchema.optional(),
    tableVisualBoost: rankingMagnitudeSchema.optional(),
    visualBoost: rankingMagnitudeSchema.optional(),
    visualIntelligenceMax: rankingMagnitudeSchema.optional(),
    visualIntelligencePivot: unitIntervalSchema.optional(),
    visualIntelligenceSlope: rankingMagnitudeSchema.optional(),
    outdatedPenalty: rankingMagnitudeSchema.optional(),
    unknownCurrentnessPenalty: rankingMagnitudeSchema.optional(),
    poorExtractionPenalty: rankingMagnitudeSchema.optional(),
    lowIndexQualityPenalty: rankingMagnitudeSchema.optional(),
    lowIndexQualityThreshold: unitIntervalSchema.optional(),
  })
  .strict();

const featureWeightsOverrideSchema = z
  .object({
    hybridRelevance: rankingMagnitudeSchema.optional(),
    lexicalCoverage: rankingMagnitudeSchema.optional(),
    reciprocalRankFusion: rankingMagnitudeSchema.optional(),
    titleSectionRelevance: rankingMagnitudeSchema.optional(),
    metadataRelevance: rankingMagnitudeSchema.optional(),
    clinicalEvidence: rankingMagnitudeSchema.optional(),
  })
  .strict();

const featureFusionOverrideSchema = z
  .object({
    document_lookup: featureWeightsOverrideSchema.optional(),
    table_threshold: featureWeightsOverrideSchema.optional(),
    medication_dose_risk: featureWeightsOverrideSchema.optional(),
    comparison: featureWeightsOverrideSchema.optional(),
    broad_summary: featureWeightsOverrideSchema.optional(),
    unsupported_or_general: featureWeightsOverrideSchema.optional(),
  })
  .strict();

const freshnessOverrideSchema = z
  .object({
    mode: z.enum(["step", "linear"]).optional(),
    publicationCliffYears: freshnessYearsSchema.optional(),
    publicationPenalty: freshnessPenaltySchema.optional(),
    reviewCliffYears: freshnessYearsSchema.optional(),
    reviewPenalty: freshnessPenaltySchema.optional(),
    linearRampYears: freshnessRampYearsSchema.optional(),
  })
  .strict();

const rankingConfigOverrideSchema = z
  .object({
    secondStage: secondStageOverrideSchema.optional(),
    featureFusion: featureFusionOverrideSchema.optional(),
    documentDiversityPenalty: rankingMagnitudeSchema.optional(),
    documentDiversityPenaltyCap: rankingMagnitudeSchema.optional(),
    freshness: freshnessOverrideSchema.optional(),
  })
  .strict();

type RankingConfigOverride = z.infer<typeof rankingConfigOverrideSchema>;

function parseRankingConfigOverride(raw: string): RankingConfigOverride {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid RAG_RANKING_CONFIG: malformed JSON.");
  }

  const result = rankingConfigOverrideSchema.safeParse(parsed);
  if (result.success) return result.data;

  const details = result.error.issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "<root>"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid RAG_RANKING_CONFIG: ${details}`);
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

/**
 * Build a RankingConfig by deep-merging an optional validated JSON override over the
 * evaluated defaults. A non-empty override is fail-closed: malformed JSON, unknown keys,
 * invalid types, out-of-domain values, and linear freshness ramps longer than either
 * cliff throw a configuration error rather than silently changing or reverting retrieval
 * behaviour. Exported for unit testing.
 */
export function resolveRankingConfig(raw?: string | null): RankingConfig {
  const parsed: RankingConfigOverride = raw?.trim() ? parseRankingConfigOverride(raw) : {};
  const d = defaultRankingConfig;
  const ss = parsed.secondStage ?? {};
  const fr = parsed.freshness ?? {};
  const fusion = parsed.featureFusion ?? {};
  const freshness: FreshnessConfig = {
    mode: fr.mode ?? d.freshness.mode,
    publicationCliffYears: fr.publicationCliffYears ?? d.freshness.publicationCliffYears,
    publicationPenalty: fr.publicationPenalty ?? d.freshness.publicationPenalty,
    reviewCliffYears: fr.reviewCliffYears ?? d.freshness.reviewCliffYears,
    reviewPenalty: fr.reviewPenalty ?? d.freshness.reviewPenalty,
    linearRampYears: fr.linearRampYears ?? d.freshness.linearRampYears,
  };

  if (
    freshness.mode === "linear" &&
    (freshness.linearRampYears > freshness.publicationCliffYears ||
      freshness.linearRampYears > freshness.reviewCliffYears)
  ) {
    throw new Error(
      "Invalid RAG_RANKING_CONFIG: linearRampYears must not exceed publicationCliffYears or reviewCliffYears.",
    );
  }

  return {
    secondStage: {
      positionBase: ss.positionBase ?? d.secondStage.positionBase,
      positionStep: ss.positionStep ?? d.secondStage.positionStep,
      memorySummaryBoost: ss.memorySummaryBoost ?? d.secondStage.memorySummaryBoost,
      documentLookupTitleBoost: ss.documentLookupTitleBoost ?? d.secondStage.documentLookupTitleBoost,
      tableThresholdEvidenceBoost: ss.tableThresholdEvidenceBoost ?? d.secondStage.tableThresholdEvidenceBoost,
      doseAmountBoost: ss.doseAmountBoost ?? d.secondStage.doseAmountBoost,
      tableVisualBoost: ss.tableVisualBoost ?? d.secondStage.tableVisualBoost,
      visualBoost: ss.visualBoost ?? d.secondStage.visualBoost,
      visualIntelligenceMax: ss.visualIntelligenceMax ?? d.secondStage.visualIntelligenceMax,
      visualIntelligencePivot: ss.visualIntelligencePivot ?? d.secondStage.visualIntelligencePivot,
      visualIntelligenceSlope: ss.visualIntelligenceSlope ?? d.secondStage.visualIntelligenceSlope,
      outdatedPenalty: ss.outdatedPenalty ?? d.secondStage.outdatedPenalty,
      unknownCurrentnessPenalty: ss.unknownCurrentnessPenalty ?? d.secondStage.unknownCurrentnessPenalty,
      poorExtractionPenalty: ss.poorExtractionPenalty ?? d.secondStage.poorExtractionPenalty,
      lowIndexQualityPenalty: ss.lowIndexQualityPenalty ?? d.secondStage.lowIndexQualityPenalty,
      lowIndexQualityThreshold: ss.lowIndexQualityThreshold ?? d.secondStage.lowIndexQualityThreshold,
    },
    featureFusion: Object.fromEntries(
      ragQueryClasses.map((queryClass) => [
        queryClass,
        {
          ...d.featureFusion[queryClass],
          ...(fusion[queryClass] ?? {}),
        },
      ]),
    ) as Record<RagQueryClass, RankingFeatureWeights>,
    documentDiversityPenalty: parsed.documentDiversityPenalty ?? d.documentDiversityPenalty,
    documentDiversityPenaltyCap: parsed.documentDiversityPenaltyCap ?? d.documentDiversityPenaltyCap,
    freshness,
  };
}

/**
 * Freshness penalty for a document, given its age in years (or null when unknown).
 * CI-17: in "step" mode this reproduces the original cliff exactly; in "linear" mode the
 * penalty ramps in gradually over `linearRampYears` up to the cliff, avoiding the harsh
 * step that unfairly demotes still-current stable guidelines the moment they cross the line.
 */
export function freshnessDecayPenalty(
  yearsAgo: number | null,
  kind: "publication" | "review",
  cfg: FreshnessConfig,
): number {
  if (yearsAgo === null) return 0;
  const cliff = kind === "publication" ? cfg.publicationCliffYears : cfg.reviewCliffYears;
  const penalty = kind === "publication" ? cfg.publicationPenalty : cfg.reviewPenalty;
  if (cfg.mode === "step") return yearsAgo >= cliff ? penalty : 0;
  const rampStart = cliff - cfg.linearRampYears;
  if (yearsAgo <= rampStart) return 0;
  const t = Math.min(1, (yearsAgo - rampStart) / cfg.linearRampYears);
  return round4(penalty * t);
}

/** Resolved singleton used by the retrieval path. */
export const rankingConfig: RankingConfig = resolveRankingConfig(process.env.RAG_RANKING_CONFIG);
