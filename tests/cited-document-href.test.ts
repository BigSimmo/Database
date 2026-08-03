import { describe, expect, it } from "vitest";

import { citedDocumentHref } from "@/components/clinical-dashboard/source-actions";
import type { SearchResult } from "@/lib/types";

const source: SearchResult = {
  id: "chunk-1",
  document_id: "doc-1",
  title: "WA Clozapine Protocol",
  file_name: "clozapine.pdf",
  page_number: 4,
  chunk_index: 0,
  section_heading: "Titration",
  content: "Start at 12.5 mg.",
  image_ids: [],
  similarity: 0.9,
  images: [],
};

describe("citedDocumentHref", () => {
  it("opens the cited document at the locator page when a matching source exists", () => {
    expect(citedDocumentHref("doc-1", "p. 12", [source])).toBe("/documents/doc-1?page=12&chunk=chunk-1");
  });

  it("falls back to the source page when no locator is provided", () => {
    expect(citedDocumentHref("doc-1", undefined, [source])).toBe("/documents/doc-1?page=4&chunk=chunk-1");
  });

  it("still builds a document href when the candidate list has no match", () => {
    expect(citedDocumentHref("doc-missing", "p. 3", [source])).toBe("/documents/doc-missing?page=3");
  });

  it("refuses synthetic unidentified source ids", () => {
    expect(citedDocumentHref("__unidentified_0__", "p. 1", [source])).toBeNull();
  });
});
