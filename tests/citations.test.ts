import { describe, expect, it } from "vitest";
import {
  citationFromResult,
  documentCitationHref,
  formatCompactCitationLabel,
  formatCitationLabel,
  uniqueCitations,
} from "../src/lib/citations";
import type { Citation, SearchResult } from "../src/lib/types";

const result: SearchResult = {
  id: "chunk-1",
  document_id: "doc-1",
  title: "RANZCP guideline",
  file_name: "ranzcp.pdf",
  page_number: 12,
  chunk_index: 3,
  section_heading: "Lithium",
  content: "Monitor renal and thyroid function.",
  image_ids: [],
  similarity: 0.82,
  images: [],
};

const citation = (overrides: Partial<Citation> = {}): Citation => ({
  chunk_id: "chunk-1",
  document_id: "doc-1",
  title: "Lithium source",
  file_name: "lithium.pdf",
  page_number: 1,
  chunk_index: 0,
  ...overrides,
});

describe("citations", () => {
  it("creates readable labels", () => {
    expect(formatCitationLabel(citationFromResult(result))).toBe("RANZCP guideline, p. 12");
  });

  it("creates compact mobile labels", () => {
    expect(
      formatCompactCitationLabel({
        ...citationFromResult(result),
        title: "Synthetic Lithium Monitoring Guideline",
      }),
    ).toBe("Lithium p.12");
  });

  it("links to source document, page, and chunk", () => {
    expect(documentCitationHref(citationFromResult(result))).toBe("/documents/doc-1?page=12&chunk=chunk-1");
  });

  it("deduplicates visible citations by document page and chunk", () => {
    const citations = uniqueCitations([
      citation(),
      citation({ title: "Renamed local title" }),
      citation({ chunk_id: "chunk-2" }),
    ]);

    expect(citations).toHaveLength(2);
    expect(citations.map((item) => item.chunk_id)).toEqual(["chunk-1", "chunk-2"]);
    expect(citations[0].title).toBe("Lithium source");
  });
});
