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
  /** Demotion subtracted per EXTRA chunk from the same document (0 = diversity OFF). CI-16. */
  documentDiversityPenalty: number;
  /** Maximum cumulative diversity demotion for any single chunk. */
  documentDiversityPenaltyCap: number;
  freshness: FreshnessConfig;
};

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

/**
 * Build a RankingConfig by deep-merging an optional JSON override (partial) over the
 * defaults. Unknown keys are ignored and non-numeric values fall back to the default, so a
 * malformed override can only ever degrade to current behavior — never crash retrieval.
 * Exported for unit testing.
 */
export function resolveRankingConfig(raw?: string | null): RankingConfig {
  let parsed: Record<string, unknown> = {};
  if (raw && raw.trim()) {
    try {
      parsed = asRecord(JSON.parse(raw));
    } catch {
      parsed = {};
    }
  }
  const d = defaultRankingConfig;
  const ss = asRecord(parsed.secondStage);
  const fr = asRecord(parsed.freshness);
  return {
    secondStage: {
      positionBase: num(ss.positionBase, d.secondStage.positionBase),
      positionStep: num(ss.positionStep, d.secondStage.positionStep),
      memorySummaryBoost: num(ss.memorySummaryBoost, d.secondStage.memorySummaryBoost),
      documentLookupTitleBoost: num(ss.documentLookupTitleBoost, d.secondStage.documentLookupTitleBoost),
      tableThresholdEvidenceBoost: num(ss.tableThresholdEvidenceBoost, d.secondStage.tableThresholdEvidenceBoost),
      doseAmountBoost: num(ss.doseAmountBoost, d.secondStage.doseAmountBoost),
      tableVisualBoost: num(ss.tableVisualBoost, d.secondStage.tableVisualBoost),
      visualBoost: num(ss.visualBoost, d.secondStage.visualBoost),
      visualIntelligenceMax: num(ss.visualIntelligenceMax, d.secondStage.visualIntelligenceMax),
      visualIntelligencePivot: num(ss.visualIntelligencePivot, d.secondStage.visualIntelligencePivot),
      visualIntelligenceSlope: num(ss.visualIntelligenceSlope, d.secondStage.visualIntelligenceSlope),
      outdatedPenalty: num(ss.outdatedPenalty, d.secondStage.outdatedPenalty),
      unknownCurrentnessPenalty: Math.max(
        0,
        num(ss.unknownCurrentnessPenalty, d.secondStage.unknownCurrentnessPenalty),
      ),
      poorExtractionPenalty: num(ss.poorExtractionPenalty, d.secondStage.poorExtractionPenalty),
      lowIndexQualityPenalty: num(ss.lowIndexQualityPenalty, d.secondStage.lowIndexQualityPenalty),
      lowIndexQualityThreshold: num(ss.lowIndexQualityThreshold, d.secondStage.lowIndexQualityThreshold),
    },
    documentDiversityPenalty: Math.max(0, num(parsed.documentDiversityPenalty, d.documentDiversityPenalty)),
    documentDiversityPenaltyCap: Math.max(0, num(parsed.documentDiversityPenaltyCap, d.documentDiversityPenaltyCap)),
    freshness: {
      // Honor a valid explicit override; otherwise fall back to the default mode (not a hardcoded
      // "step") so the eval-gated default actually takes effect at runtime.
      mode: fr.mode === "linear" || fr.mode === "step" ? fr.mode : d.freshness.mode,
      publicationCliffYears: num(fr.publicationCliffYears, d.freshness.publicationCliffYears),
      publicationPenalty: num(fr.publicationPenalty, d.freshness.publicationPenalty),
      reviewCliffYears: num(fr.reviewCliffYears, d.freshness.reviewCliffYears),
      reviewPenalty: num(fr.reviewPenalty, d.freshness.reviewPenalty),
      linearRampYears: Math.max(0.0001, num(fr.linearRampYears, d.freshness.linearRampYears)),
    },
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
