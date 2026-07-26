import { describe, expect, it } from "vitest";
import {
  documentsSearchHref,
  documentSearchRequestBody,
  documentReaderHref,
  documentEvidenceHref,
  mockDocumentsSearchHref,
  mockDocumentReaderHref,
  mockDocumentEvidenceHref,
  DEFAULT_DOCUMENT_FLOW_QUERY,
  DEFAULT_DOCUMENT_FLOW_DOCUMENT,
  DEFAULT_DOCUMENT_FLOW_PAGE,
  DEFAULT_DOCUMENT_FLOW_CHUNK,
} from "../src/lib/document-flow-routes";

describe("document-flow-routes", () => {
  it("documentsSearchHref builds correct url with options", () => {
    const href = documentsSearchHref({ query: "clozapine", focus: true, run: true });
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/documents/search");
    expect(url.searchParams.get("mode")).toBe("documents");
    expect(url.searchParams.get("q")).toBe("clozapine");
    expect(url.searchParams.get("focus")).toBe("1");
    expect(url.searchParams.get("run")).toBe("1");
  });

  it("documentSearchRequestBody builds correct request payload", () => {
    const params = new URLSearchParams({ scope_filter: "policy", query_mode: "exact" });
    const body = documentSearchRequestBody(params, "clozapine");
    expect(body.query).toBe("clozapine");
    expect(body.mode).toBe("documents");
    expect(body.documentLimit).toBe(24);
    expect(body.includeRelatedDocuments).toBe(true);
  });

  it("documentReaderHref builds correct url with defaults", () => {
    const href = documentReaderHref();
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/documents/source");
    expect(url.searchParams.get("document")).toBe(DEFAULT_DOCUMENT_FLOW_DOCUMENT);
    expect(url.searchParams.get("q")).toBe(DEFAULT_DOCUMENT_FLOW_QUERY);
    expect(url.searchParams.get("page")).toBe(String(DEFAULT_DOCUMENT_FLOW_PAGE));
    expect(url.searchParams.get("chunk")).toBe(DEFAULT_DOCUMENT_FLOW_CHUNK);
  });

  it("documentEvidenceHref builds correct url with options", () => {
    const href = documentEvidenceHref({ document: "doc-1", evidence: "ev-1", query: "q", page: 1, chunk: "c1" });
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/documents/source/evidence");
    expect(url.searchParams.get("document")).toBe("doc-1");
    expect(url.searchParams.get("evidence")).toBe("ev-1");
    expect(url.searchParams.get("q")).toBe("q");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("chunk")).toBe("c1");
  });

  it("mock routes replace standard routes", () => {
    expect(mockDocumentsSearchHref("test")).toContain("/mockups/document-search/search");
    expect(mockDocumentReaderHref()).toContain("/mockups/document-search/source");
    expect(mockDocumentEvidenceHref()).toContain("/mockups/document-search/source/evidence");
  });
});
