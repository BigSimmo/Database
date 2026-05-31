import { describe, expect, it } from "vitest";
import { summarizeFailures, type SearchEvalResult } from "../scripts/eval-search";

function result(overrides: Partial<SearchEvalResult> = {}): SearchEvalResult {
  return {
    id: "custom-question",
    question: "agitation and arousal",
    category: "routine",
    supported: true,
    expectedHitTop3: true,
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
  it("does not apply full-suite aggregate hit thresholds to a targeted question run", () => {
    expect(summarizeFailures([result()])).toEqual([]);
  });

  it("still reports case-level failures for targeted question runs", () => {
    expect(summarizeFailures([result({ failures: ["expected document not in top 3"] })])).toContain(
      "supported case-level search failure(s)",
    );
  });
});
