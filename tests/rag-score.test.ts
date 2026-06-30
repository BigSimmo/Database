import { describe, expect, it } from "vitest";
import type { SearchResult } from "../src/lib/types";
import { scoreValue } from "../src/lib/rag";

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
