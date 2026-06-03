import { describe, expect, it } from "vitest";
import { expectedFileCoverage, expectedFileHit } from "../scripts/eval-utils";
import { summarizeFailures, type SearchEvalResult } from "../scripts/eval-search";

function result(overrides: Partial<SearchEvalResult> = {}): SearchEvalResult {
  return {
    id: "custom-question",
    question: "agitation and arousal",
    category: "routine",
    supported: true,
    expectedFileCount: 1,
    expectedHitTop3: true,
    expectedAllHitTop5: null,
    missingExpectedFiles: [],
    resultCount: 1,
    topScore: 0.97,
    topFiles: ["MHSP.AgitationArousalPharmaMgt.pdf"],
    latencyMs: 300,
    retrievalStrategy: "text_fast_path",
    searchCacheHit: false,
    embeddingSkipped: true,
    embeddingCacheHit: false,
    fallbackToEmbedding: false,
    visualEvidence: 0,
    failures: [],
    ...overrides,
  };
}

describe("search eval thresholds", () => {
  it("does not count unsupported cases with no expected files as expected hits", () => {
    expect(expectedFileHit([], [{ file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf" }])).toBe(false);
    expect(expectedFileCoverage([], [{ file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf" }]).allHit).toBe(false);
  });

  it("requires all expected files for multi-document coverage", () => {
    const partial = expectedFileCoverage(
      ["MHSP.AdmissionCommunityPts.pdf", "MHSP.Discharge.pdf"],
      [{ file_name: "MHSP.Discharge.pdf" }],
      5,
    );

    expect(partial.anyHit).toBe(true);
    expect(partial.allHit).toBe(false);
    expect(partial.missingFiles).toEqual(["MHSP.AdmissionCommunityPts.pdf"]);
  });

  it("does not apply full-suite aggregate hit thresholds to a targeted question run", () => {
    expect(summarizeFailures([result()])).toEqual([]);
  });

  it("still reports case-level failures for targeted question runs", () => {
    expect(summarizeFailures([result({ failures: ["expected document not in top 3"] })])).toContain(
      "supported case-level search failure(s)",
    );
  });

  it("reports multi-document case-level failures when only one expected file is present", () => {
    expect(
      summarizeFailures([
        result({
          expectedFileCount: 2,
          expectedHitTop3: true,
          expectedAllHitTop5: false,
          missingExpectedFiles: ["MHSP.AdmissionCommunityPts.pdf"],
          failures: ["expected documents missing from top 5: MHSP.AdmissionCommunityPts.pdf"],
        }),
      ]),
    ).toContain("supported case-level search failure(s)");
  });
});
