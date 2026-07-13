import { describe, expect, it } from "vitest";

import { documentPageHref } from "../src/lib/document-viewer-navigation";

describe("document viewer useful-page navigation", () => {
  it("creates a destination-page URL without carrying an unrelated citation chunk", () => {
    const href = documentPageHref("document/id", 3);

    expect(href).toBe("/documents/document%2Fid?page=3#pdf-preview-section");
    expect(href).not.toContain("chunk=");
  });

  it("normalizes invalid page numbers to the first page", () => {
    expect(documentPageHref("document-id", 0)).toBe("/documents/document-id?page=1#pdf-preview-section");
    expect(documentPageHref("document-id", Number.NaN)).toBe("/documents/document-id?page=1#pdf-preview-section");
    expect(documentPageHref("document-id", Number.POSITIVE_INFINITY)).toBe(
      "/documents/document-id?page=1#pdf-preview-section",
    );
  });

  it("clamps negative page numbers to the first page", () => {
    expect(documentPageHref("document-id", -5)).toBe("/documents/document-id?page=1#pdf-preview-section");
    expect(documentPageHref("document-id", Number.NEGATIVE_INFINITY)).toBe(
      "/documents/document-id?page=1#pdf-preview-section",
    );
  });

  it("truncates fractional page numbers toward zero", () => {
    expect(documentPageHref("document-id", 2.9)).toBe("/documents/document-id?page=2#pdf-preview-section");
    expect(documentPageHref("document-id", 2.1)).toBe("/documents/document-id?page=2#pdf-preview-section");
  });

  it("preserves large integer page numbers", () => {
    expect(documentPageHref("document-id", 1_000_000)).toBe(
      "/documents/document-id?page=1000000#pdf-preview-section",
    );
  });

  it("encodes documentId characters that are meaningful in a URL", () => {
    expect(documentPageHref("doc id&chunk=1", 1)).toBe(
      "/documents/doc%20id%26chunk%3D1?page=1#pdf-preview-section",
    );
  });
});
