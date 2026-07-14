import { describe, expect, it } from "vitest";
import {
  defaultRankingConfig,
  freshnessDecayPenalty,
  resolveRankingConfig,
  type FreshnessConfig,
} from "../src/lib/ranking-config";

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
    // D4 ships OFF — unknown-currentness weighting needs golden-eval proof (#118 lesson).
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
});

describe("resolveRankingConfig override merge", () => {
  it("returns defaults for undefined, empty, and malformed JSON", () => {
    expect(resolveRankingConfig(undefined)).toEqual(defaultRankingConfig);
    expect(resolveRankingConfig("")).toEqual(defaultRankingConfig);
    expect(resolveRankingConfig("{not json")).toEqual(defaultRankingConfig);
    expect(resolveRankingConfig("[1,2,3]")).toEqual(defaultRankingConfig);
  });

  it("deep-merges provided numeric fields and keeps defaults for the rest", () => {
    const cfg = resolveRankingConfig(
      JSON.stringify({ secondStage: { doseAmountBoost: 0.22 }, documentDiversityPenalty: 0.03 }),
    );
    expect(cfg.secondStage.doseAmountBoost).toBe(0.22);
    // Untouched weights fall back to defaults.
    expect(cfg.secondStage.positionBase).toBe(0.09);
    expect(cfg.documentDiversityPenalty).toBe(0.03);
    // D4 activation path: the JSON override can set the penalty; negatives clamp to 0.
    expect(
      resolveRankingConfig(JSON.stringify({ secondStage: { unknownCurrentnessPenalty: 0.03 } })).secondStage
        .unknownCurrentnessPenalty,
    ).toBe(0.03);
    expect(
      resolveRankingConfig(JSON.stringify({ secondStage: { unknownCurrentnessPenalty: -1 } })).secondStage
        .unknownCurrentnessPenalty,
    ).toBe(0);
  });

  it("ignores non-numeric values and clamps diversity penalties to non-negative", () => {
    const cfg = resolveRankingConfig(
      JSON.stringify({ secondStage: { doseAmountBoost: "big" }, documentDiversityPenalty: -5 }),
    );
    expect(cfg.secondStage.doseAmountBoost).toBe(0.18);
    expect(cfg.documentDiversityPenalty).toBe(0);
  });

  it("accepts the linear freshness mode", () => {
    const cfg = resolveRankingConfig(JSON.stringify({ freshness: { mode: "linear", linearRampYears: 4 } }));
    expect(cfg.freshness.mode).toBe("linear");
    expect(cfg.freshness.linearRampYears).toBe(4);
  });
});

describe("freshnessDecayPenalty", () => {
  // The default is now "linear"; construct an explicit step config to validate step-mode behavior.
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
    // publication cliff 8, ramp 3 => ramp starts at year 5.
    expect(freshnessDecayPenalty(5, "publication", linear)).toBe(0);
    const mid = freshnessDecayPenalty(6.5, "publication", linear); // halfway
    expect(mid).toBeLessThan(0);
    expect(mid).toBeGreaterThan(-0.015);
    expect(freshnessDecayPenalty(8, "publication", linear)).toBe(-0.015);
    // Beyond the cliff the penalty is capped, never exceeding the full value.
    expect(freshnessDecayPenalty(20, "publication", linear)).toBe(-0.015);
    // Monotonic non-increasing as the document ages.
    expect(freshnessDecayPenalty(7, "publication", linear)).toBeLessThan(mid);
  });
});
