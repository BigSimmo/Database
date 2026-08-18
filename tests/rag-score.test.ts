import { describe, expect, it } from "vitest";
import type { SearchResult } from "../src/lib/types";
import type { SearchTelemetry } from "../src/lib/rag/rag-contracts";
import { deriveConfidence, recordSearchScoreTelemetry, scoreValue } from "../src/lib/rag/rag";

describe("scoreValue", () => {
  const base: SearchResult = {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Document",
    file_name: "document.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: null,
    content: "test",
    image_ids: [],
    similarity: 0,
    images: [],
  };

  it("returns raw similarity when hybrid score is implausibly inflated", () => {
    const result = { ...base, similarity: 0.45, hybrid_score: 0.68 };
    expect(scoreValue(result)).toBe(0.45);
  });

  it("uses capped hybrid score for normal ranking blend", () => {
    const result = { ...base, similarity: 0.6, hybrid_score: 0.68 };
    expect(scoreValue(result)).toBe(0.68);
  });

  it("caps hybrid score at 1.0", () => {
    const result = { ...base, similarity: 0, hybrid_score: 1.72 };
    expect(scoreValue(result)).toBe(1);
  });

  it("falls back to similarity when hybrid is absent", () => {
    const result = { ...base, similarity: 0.41 };
    expect(scoreValue(result)).toBe(0.41);
  });
});

describe("deriveConfidence (RC9 synthetic similarity)", () => {
  function result(overrides: Partial<SearchResult> & { id: string }): SearchResult {
    return {
      document_id: "doc-1",
      title: "Document",
      file_name: "document.pdf",
      page_number: 1,
      chunk_index: 0,
      section_heading: null,
      content: "test",
      image_ids: [],
      similarity: 0,
      images: [],
      ...overrides,
    };
  }

  it("caps synthetic-similarity citations at medium — a fabricated 0.82+ cannot mint high confidence", () => {
    // Memory-card / document-lookup fabrications reach 0.89-0.94, which used to satisfy the
    // 0.82 "high" bar with purely lexical evidence.
    const cited = [
      result({ id: "a", similarity: 0.86, hybrid_score: 0.89, similarity_origin: "synthetic_text" }),
      result({ id: "b", similarity: 0.84, hybrid_score: 0.87, similarity_origin: "synthetic_text" }),
    ];
    expect(deriveConfidence(cited, [{ chunk_id: "a" }, { chunk_id: "b" }])).toBe("medium");
  });

  it("still grants high confidence when a genuine cosine citation clears the bar", () => {
    const cited = [
      result({ id: "a", similarity: 0.85, hybrid_score: 0.85, similarity_origin: "cosine" }),
      result({ id: "b", similarity: 0.7, hybrid_score: 0.72, similarity_origin: "synthetic_text" }),
    ];
    expect(deriveConfidence(cited, [{ chunk_id: "a" }, { chunk_id: "b" }])).toBe("high");
  });

  it("treats untagged results as genuine cosine evidence (vector/hybrid layers set no origin)", () => {
    const cited = [
      result({ id: "a", similarity: 0.85, hybrid_score: 0.85 }),
      result({ id: "b", similarity: 0.83, hybrid_score: 0.84 }),
    ];
    expect(deriveConfidence(cited, [{ chunk_id: "a" }, { chunk_id: "b" }])).toBe("high");
  });

  it("returns unsupported without citations and low for weak cited evidence", () => {
    expect(deriveConfidence([result({ id: "a", similarity: 0.9 })], [])).toBe("unsupported");
    expect(deriveConfidence([result({ id: "a", similarity: 0.4 })], [{ chunk_id: "a" }])).toBe("low");
  });

  // G1 governance pin (docs/clinical-hazard-analysis.md H5a; owner decision 2026-08-17,
  // Option B). `buildDocumentSummaryResults` now tags its constant `similarity: 1` as
  // "document_context". That tag is provenance ONLY — it must not change the confidence a
  // clinician reads. The two tests below are a discriminating pair: same shape, same scores,
  // only the origin value differs, and they must disagree. If a future edit folds
  // "document_context" into the `strongestNonSynthetic` exclusion, the first goes red and
  // every document summary silently drops from "high" to "medium" (rejected Option A).
  // Conversely, if the "synthetic_text" exclusion is ever dropped, the second goes red.
  it('keeps "high" for two document-context citations at or above the 0.82 bar', () => {
    const cited = [
      result({ id: "a", similarity: 1, similarity_origin: "document_context" }),
      result({ id: "b", similarity: 0.82, similarity_origin: "document_context" }),
    ];
    expect(deriveConfidence(cited, [{ chunk_id: "a" }, { chunk_id: "b" }])).toBe("high");
  });

  it('still refuses "high" for the same scores tagged "synthetic_text"', () => {
    const cited = [
      result({ id: "a", similarity: 1, similarity_origin: "synthetic_text" }),
      result({ id: "b", similarity: 0.82, similarity_origin: "synthetic_text" }),
    ];
    expect(deriveConfidence(cited, [{ chunk_id: "a" }, { chunk_id: "b" }])).toBe("medium");
  });

  it("still needs two accepted citations before document-context evidence reaches high", () => {
    const cited = [result({ id: "a", similarity: 1, similarity_origin: "document_context" })];
    expect(deriveConfidence(cited, [{ chunk_id: "a" }])).toBe("medium");
  });
});

describe("synthetic_similarity_count telemetry (RC9)", () => {
  function result(overrides: Partial<SearchResult> & { id: string }): SearchResult {
    return {
      document_id: "doc-1",
      title: "Document",
      file_name: "document.pdf",
      page_number: 1,
      chunk_index: 0,
      section_heading: null,
      content: "test",
      image_ids: [],
      similarity: 0,
      images: [],
      ...overrides,
    };
  }

  // The RC9 counter measures imputed lexical/structural scores crossing cosine-calibrated
  // gates. "document_context" is a different provenance on a route with no match strength to
  // inflate; counting it would mix two populations into one unreadable number.
  it('counts only "synthetic_text", never "document_context" or untagged cosine rows', () => {
    const telemetry = {} as SearchTelemetry;

    recordSearchScoreTelemetry(telemetry, [
      result({ id: "a", similarity: 0.89, similarity_origin: "synthetic_text" }),
      result({ id: "b", similarity: 1, similarity_origin: "document_context" }),
      result({ id: "c", similarity: 0.91, similarity_origin: "cosine" }),
      result({ id: "d", similarity: 0.77 }),
    ]);

    expect(telemetry.synthetic_similarity_count).toBe(1);
    expect(telemetry.retrieval_candidate_count).toBe(4);
  });

  it("reports zero for a document-summary result set", () => {
    const telemetry = {} as SearchTelemetry;

    recordSearchScoreTelemetry(telemetry, [
      result({ id: "a", similarity: 1, similarity_origin: "document_context" }),
      result({ id: "b", similarity: 1, similarity_origin: "document_context" }),
    ]);

    expect(telemetry.synthetic_similarity_count).toBe(0);
  });
});
