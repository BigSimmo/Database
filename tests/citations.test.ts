import { describe, expect, it } from "vitest";
import {
  citationFromResult,
  documentCitationHref,
  formatCompactCitationLabel,
  formatCitationLabel,
} from "../src/lib/citations";
import type { SearchResult } from "../src/lib/types";

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
    expect(documentCitationHref(citationFromResult(result))).toBe(
      "/documents/doc-1?page=12&chunk=chunk-1",
    );
  });
});
