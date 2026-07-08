import { describe, expect, it } from "vitest";
import type { SearchResult } from "../src/lib/types";
import { deriveConfidence, scoreValue } from "../src/lib/rag";

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
});
