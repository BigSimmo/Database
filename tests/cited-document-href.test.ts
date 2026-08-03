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

const sameDocumentPage12: SearchResult = {
  ...source,
  id: "chunk-9",
  page_number: 12,
  chunk_index: 5,
  content: "Monitoring at steady state.",
};

describe("citedDocumentHref", () => {
  it("pins the chunk that sits on the locator page when the document spans several", () => {
    // Two candidates from one document on different pages. Picking the first and
    // pairing it with the locator's page produced ?page=12&chunk=<page-4 chunk>,
    // and `loadAuthorizedDocumentDetail` makes the chunk's page authoritative
    // (`effectivePage = selectedChunk?.page_number ?? requestedPage`), so a
    // control labelled "p. 12" opened page 4.
    expect(citedDocumentHref("doc-1", "p. 12", [source, sameDocumentPage12])).toBe(
      "/documents/doc-1?page=12&chunk=chunk-9",
    );
  });

  it("omits the chunk rather than pinning one from a different page", () => {
    // Only a page-4 chunk exists, but the banner advertises p. 12. Opening the
    // page without a chunk lands where the label promised; pinning the chunk
    // would silently redirect to page 4.
    expect(citedDocumentHref("doc-1", "p. 12", [source])).toBe("/documents/doc-1?page=12");
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
