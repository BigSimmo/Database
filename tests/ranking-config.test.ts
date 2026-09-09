import { describe, expect, it } from "vitest";
import {
  defaultRankingConfig,
  freshnessDecayPenalty,
  resolveRankingConfig,
  type FreshnessConfig,
} from "../src/lib/ranking-config";

function expectInvalidOverride(value: unknown, errorPattern: RegExp) {
  expect(() => resolveRankingConfig(JSON.stringify(value))).toThrow(errorPattern);
}

describe("ranking-config defaults (W6 — zero behavior change)", () => {
  it("reproduces the exact prior second-stage rerank constants", () => {
    const w = defaultRankingConfig.secondStage;
    expect(w.positionBase).toBe(0.09);
    expect(w.positionStep).toBe(0.004);
    expect(w.memorySummaryBoost).toBe(0.035);
    expect(w.documentLookupTitleBoost).toBe(0.045);
    expect(w.tableThresholdEvidenceBoost).toBe(0.065);
    expect(w.doseAmountBoost).toBe(0.18);
    expect(w.tableVisualBoost).toBe(0.08);
    expect(w.visualBoost).toBe(0.04);
    expect(w.visualIntelligenceMax).toBe(0.035);
    expect(w.visualIntelligencePivot).toBe(0.55);
    expect(w.visualIntelligenceSlope).toBe(0.08);
    expect(w.outdatedPenalty).toBe(0.035);
    expect(w.unknownCurrentnessPenalty).toBe(0);
    expect(w.poorExtractionPenalty).toBe(0.035);
    expect(w.lowIndexQualityPenalty).toBe(0.035);
    expect(w.lowIndexQualityThreshold).toBe(0.55);
  });

  it("enables gentle document-diversity demotion by default (eval-gated 2026-07-03)", () => {
    expect(defaultRankingConfig.documentDiversityPenalty).toBe(0.02);
    expect(defaultRankingConfig.documentDiversityPenaltyCap).toBe(0.12);
  });

  it("defaults freshness to the ramped linear curve (eval-gated 2026-07-03), keeping the cliff params", () => {
    expect(defaultRankingConfig.freshness).toMatchObject({
      mode: "linear",
      publicationCliffYears: 8,
      publicationPenalty: -0.015,
      reviewCliffYears: 5,
      reviewPenalty: -0.01,
    });
  });

  it("uses the one constrained tuner improvement and keeps every other class neutral", () => {
    for (const [queryClass, weights] of Object.entries(defaultRankingConfig.featureFusion)) {
      expect(weights).toEqual({
        hybridRelevance: 1,
        lexicalCoverage: 1,
        reciprocalRankFusion: 1,
        titleSectionRelevance: 1,
        metadataRelevance: 1,
        clinicalEvidence: queryClass === "broad_summary" ? 0.9 : 1,
      });
    }
  });
});

describe("resolveRankingConfig override merge", () => {
  it("returns defaults only when no override is supplied", () => {
    expect(resolveRankingConfig(undefined)).toEqual(defaultRankingConfig);
    expect(resolveRankingConfig("")).toEqual(defaultRankingConfig);
    expect(resolveRankingConfig("   ")).toEqual(defaultRankingConfig);
  });

  it("fails closed for malformed JSON and non-object roots", () => {
    expect(() => resolveRankingConfig("{not json")).toThrow(/RAG_RANKING_CONFIG/i);
    expectInvalidOverride([1, 2, 3], /RAG_RANKING_CONFIG/i);
    expectInvalidOverride(null, /RAG_RANKING_CONFIG/i);
  });

  it("fails closed for unknown keys at every supported level", () => {
    expectInvalidOverride({ documentDiversityPenality: 0.03 }, /unrecognized|unknown/i);
    expectInvalidOverride({ secondStage: { doseAmountBost: 0.22 } }, /unrecognized|unknown/i);
    expectInvalidOverride({ featureFusion: { comparison: { lexicalCoverge: 1.1 } } }, /unrecognized|unknown/i);
    expectInvalidOverride({ freshness: { mod: "linear" } }, /unrecognized|unknown/i);
  });

  it("fails closed for invalid types rather than silently substituting defaults", () => {
    expectInvalidOverride({ secondStage: { doseAmountBoost: "big" } }, /doseAmountBoost/i);
    expectInvalidOverride({ featureFusion: { document_lookup: { clinicalEvidence: "high" } } }, /clinicalEvidence/i);
    expectInvalidOverride({ freshness: { mode: "gradual" } }, /mode/i);
  });

  it("rejects pathological or domain-invalid numeric values", () => {
    expectInvalidOverride({ secondStage: { doseAmountBoost: 1_000_000 } }, /doseAmountBoost/i);
    expectInvalidOverride({ secondStage: { lowIndexQualityThreshold: 1.1 } }, /lowIndexQualityThreshold/i);
    expectInvalidOverride({ documentDiversityPenalty: -0.01 }, /documentDiversityPenalty/i);
    expectInvalidOverride({ freshness: { publicationCliffYears: -1 } }, /publicationCliffYears/i);
    expectInvalidOverride({ freshness: { publicationPenalty: 1 } }, /publicationPenalty/i);
  });

  it("deep-merges valid provided fields and keeps defaults for the rest", () => {
    const cfg = resolveRankingConfig(
      JSON.stringify({
        secondStage: { doseAmountBoost: 0.22, unknownCurrentnessPenalty: 0.03 },
        featureFusion: { comparison: { lexicalCoverage: 1.1 } },
        documentDiversityPenalty: 0.03,
      }),
    );
    expect(cfg.secondStage.doseAmountBoost).toBe(0.22);
    expect(cfg.secondStage.unknownCurrentnessPenalty).toBe(0.03);
    expect(cfg.secondStage.positionBase).toBe(0.09);
    expect(cfg.documentDiversityPenalty).toBe(0.03);
    expect(cfg.featureFusion.comparison.lexicalCoverage).toBe(1.1);
    expect(cfg.featureFusion.comparison.hybridRelevance).toBe(1);
    expect(cfg.featureFusion.document_lookup.lexicalCoverage).toBe(1);
  });

  it("accepts the linear freshness mode", () => {
    const cfg = resolveRankingConfig(JSON.stringify({ freshness: { mode: "linear", linearRampYears: 4 } }));
    expect(cfg.freshness.mode).toBe("linear");
    expect(cfg.freshness.linearRampYears).toBe(4);
  });

  it("fails closed when a linear ramp exceeds either freshness cliff after merge", () => {
    expectInvalidOverride({ freshness: { publicationCliffYears: 1, linearRampYears: 2 } }, /linearRampYears/i);
    expectInvalidOverride({ freshness: { reviewCliffYears: 2, linearRampYears: 3 } }, /linearRampYears/i);
    expectInvalidOverride({ freshness: { linearRampYears: 6 } }, /linearRampYears/i);
  });

  it("keeps a linear ramp that equals both cliffs and ignores ramp length in step mode", () => {
    const equal = resolveRankingConfig(
      JSON.stringify({
        freshness: { publicationCliffYears: 2, reviewCliffYears: 2, linearRampYears: 2 },
      }),
    );
    expect(equal.freshness.linearRampYears).toBe(2);
    const step = resolveRankingConfig(JSON.stringify({ freshness: { mode: "step", linearRampYears: 10 } }));
    expect(step.freshness.mode).toBe("step");
    expect(step.freshness.linearRampYears).toBe(10);
  });
});

describe("freshnessDecayPenalty", () => {
  const step = { ...defaultRankingConfig.freshness, mode: "step" as const };

  it("step mode reproduces the original publication/review cliffs exactly", () => {
    expect(freshnessDecayPenalty(null, "publication", step)).toBe(0);
    expect(freshnessDecayPenalty(7.9, "publication", step)).toBe(0);
    expect(freshnessDecayPenalty(8, "publication", step)).toBe(-0.015);
    expect(freshnessDecayPenalty(20, "publication", step)).toBe(-0.015);
    expect(freshnessDecayPenalty(4.9, "review", step)).toBe(0);
    expect(freshnessDecayPenalty(5, "review", step)).toBe(-0.01);
  });

  it("linear mode ramps monotonically from the ramp start up to the cliff", () => {
    const linear: FreshnessConfig = { ...step, mode: "linear", linearRampYears: 3 };
    expect(freshnessDecayPenalty(5, "publication", linear)).toBe(0);
    const mid = freshnessDecayPenalty(6.5, "publication", linear);
    expect(mid).toBeLessThan(0);
    expect(mid).toBeGreaterThan(-0.015);
    expect(freshnessDecayPenalty(8, "publication", linear)).toBe(-0.015);
    expect(freshnessDecayPenalty(20, "publication", linear)).toBe(-0.015);
    expect(freshnessDecayPenalty(7, "publication", linear)).toBeLessThan(mid);
  });
});
