import { describe, expect, it } from "vitest";

import { rateClinicalSource } from "@/lib/sources/catalogue-core";
import {
  SOURCE_RATING_WEIGHTS,
  type ClinicalSourceCatalogueEntry,
  type ClinicalSourceReferenceInput,
} from "@/lib/sources/catalogue-types";
import {
  SOURCE_BAND_LABELS,
  SOURCE_BAND_TONES,
  SOURCE_CATALOGUE_STATUS_GROUPS,
  SOURCE_QUALITY_BAND_SCALE,
  SOURCE_RATING_DIMENSIONS,
  SOURCE_RATING_TOTAL_POINTS,
  qualityBandForScore,
  sourceBandBrowseHref,
} from "@/lib/sources/rating-method";
import { sourceAttentionFlags } from "@/lib/sources/source-status-presentation";

/**
 * `/sources/method` and the Guide Centre publish the rating method. Before this
 * module existed the 50/70/85 thresholds were literals inside `assessSource` and
 * re-typed as prose on the page, so the catalogue could publish a method it no
 * longer applied. These tests are what keeps the two level.
 */
describe("published source rating method", () => {
  it("takes its dimension points from the scoring weights and totals 100", () => {
    expect(Object.fromEntries(SOURCE_RATING_DIMENSIONS.map((d) => [d.key, d.points]))).toEqual(SOURCE_RATING_WEIGHTS);
    expect(SOURCE_RATING_DIMENSIONS).toHaveLength(Object.keys(SOURCE_RATING_WEIGHTS).length);
    expect(SOURCE_RATING_TOTAL_POINTS).toBe(100);
  });

  it("orders the dimensions by weight so the published order is the actual weighting", () => {
    const points = SOURCE_RATING_DIMENSIONS.map((dimension) => dimension.points);
    expect(points).toEqual([...points].toSorted((left, right) => right - left));
  });

  it("bands every score in 0–100 into exactly the window it publishes", () => {
    for (let score = 0; score <= SOURCE_RATING_TOTAL_POINTS; score += 1) {
      const published = SOURCE_QUALITY_BAND_SCALE.find(
        (definition) =>
          definition.minScore !== null &&
          definition.maxScore !== null &&
          score >= definition.minScore &&
          score <= definition.maxScore,
      );
      // Below the lowest window there is no scored band, and the scorer says D.
      expect(qualityBandForScore(score), `score ${score}`).toBe(published?.band ?? "D");
    }
  });

  it("leaves no gap or overlap between the published score windows", () => {
    const scored = SOURCE_QUALITY_BAND_SCALE.filter((definition) => definition.minScore !== null);
    const ascending = [...scored].toSorted((left, right) => (left.minScore ?? 0) - (right.minScore ?? 0));
    for (const [index, definition] of ascending.entries()) {
      const next = ascending[index + 1];
      expect(definition.maxScore).toBe(next ? (next.minScore ?? 0) - 1 : SOURCE_RATING_TOTAL_POINTS);
    }
    // The two unscored bands are decided before any score, so they carry no window.
    for (const definition of SOURCE_QUALITY_BAND_SCALE.filter((entry) => entry.minScore === null)) {
      expect(definition.maxScore).toBeNull();
      expect(["D", "excluded"]).toContain(definition.band);
    }
  });

  it("keeps the band labels, tones and browse routes in one vocabulary", () => {
    for (const definition of SOURCE_QUALITY_BAND_SCALE) {
      expect(SOURCE_BAND_LABELS[definition.band]).toBe(definition.label);
      expect(SOURCE_BAND_TONES[definition.band]).toBe(definition.tone);
      expect(sourceBandBrowseHref(definition.band)).toBe(`/sources/search?band=${definition.band}`);
    }
    expect(SOURCE_QUALITY_BAND_SCALE.map((definition) => definition.band)).toEqual(["A", "B", "C", "D", "excluded"]);
  });

  it("agrees with the catalogue on the tone of every status the catalogue itself flags", () => {
    const published = new Map(
      SOURCE_CATALOGUE_STATUS_GROUPS.flatMap((group) => group.statuses).map((status) => [status.label, status.tone]),
    );

    const entry = (overrides: Partial<ClinicalSourceCatalogueEntry>) =>
      ({
        documentStatus: "current",
        lifecycleStatus: "active",
        supersededBy: [],
        ...overrides,
      }) as ClinicalSourceCatalogueEntry;

    const flagged = [
      ...sourceAttentionFlags(entry({ documentStatus: "outdated" })),
      ...sourceAttentionFlags(entry({ documentStatus: "review_due" })),
      ...sourceAttentionFlags(entry({ lifecycleStatus: "excluded" })),
      ...sourceAttentionFlags(entry({ lifecycleStatus: "inactive" })),
    ];

    expect(flagged.map((flag) => flag.label)).toEqual(["Outdated", "Review due", "Excluded", "Inactive"]);
    for (const flag of flagged) {
      expect(published.get(flag.label), flag.label).toBe(flag.tone);
    }
  });
});

/**
 * The refactor that moved the thresholds out of `assessSource` must not have
 * moved the boundaries with them. These are the same fixtures the scorer's own
 * boundary test uses, asserted here against the published table.
 */
describe("scorer and published table on the same boundaries", () => {
  // The same full-marks fixture `tests/source-catalogue-core.test.ts` scores, so
  // the two suites cannot disagree about what 100 looks like.
  const reference = (overrides: Partial<ClinicalSourceReferenceInput> = {}): ClinicalSourceReferenceInput => ({
    sourceId: "akg-guideline",
    documentId: null,
    title: "Example clinical guideline",
    aliases: [],
    publisher: "Armadale Kalamunda Group",
    publisherCode: "AKG",
    canonicalUrl: "https://www.ranzcp.org/example",
    datasetLocation: null,
    version: "1",
    publicationDate: "2025-01-01",
    reviewDate: "2026-01-01",
    expiryDate: null,
    jurisdiction: "Australia/WA",
    evidenceType: "guideline",
    documentStatus: "current",
    validationStatus: "approved",
    contentMode: "link_only",
    lifecycleStatus: "active",
    supersedes: [],
    supersededBy: [],
    topics: ["governance"],
    usage: { modeId: "dictionary", recordId: "mse", recordLabel: "Mental state examination", field: "definition" },
    referenceText: null,
    ...overrides,
  });

  it("gives a full-marks source the top published band", () => {
    const rating = rateClinicalSource(reference());
    expect(rating.score).toBe(SOURCE_RATING_TOTAL_POINTS);
    expect(rating.band).toBe(qualityBandForScore(rating.score));
    expect(rating.band).toBe("A");
  });

  it("still bands an excluded source before any score is consulted", () => {
    const rating = rateClinicalSource(reference({ lifecycleStatus: "excluded" }));
    expect(rating.band).toBe("excluded");
    // The score is unchanged; exclusion is a governance outcome laid over it.
    expect(rating.score).toBeGreaterThanOrEqual(0);
  });
});
