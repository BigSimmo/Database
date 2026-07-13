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
});
