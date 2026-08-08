import { describe, expect, it } from "vitest";

import {
  canSkipDetailRequest,
  documentLoadKey,
  documentPageHref,
  isFullDocumentReload,
  nextLoadedDocumentKey,
} from "../src/lib/document-viewer-navigation";

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

  it("normalizes negative page numbers to the first page", () => {
    expect(documentPageHref("document-id", -5)).toBe("/documents/document-id?page=1#pdf-preview-section");
  });

  it("truncates fractional page numbers toward zero", () => {
    expect(documentPageHref("document-id", 3.9)).toBe("/documents/document-id?page=3#pdf-preview-section");
  });

  it("encodes documentId characters that are meaningful in a URL", () => {
    expect(documentPageHref("doc id&value", 2)).toBe("/documents/doc%20id%26value?page=2#pdf-preview-section");
  });
});

describe("document viewer full-reload vs navigation gating", () => {
  it("keys a load by documentId + previewAttempt", () => {
    expect(documentLoadKey("doc-1", 0)).toBe("doc-1::0");
    expect(documentLoadKey("doc-1", 2)).toBe("doc-1::2");
  });

  it("treats a first load, a new document, and an explicit retry as full reloads", () => {
    // No prior load → full reload.
    expect(isFullDocumentReload(null, documentLoadKey("doc-1", 0))).toBe(true);
    // Same document + attempt → navigation, not a full reload.
    expect(isFullDocumentReload("doc-1::0", documentLoadKey("doc-1", 0))).toBe(false);
    // Different document → full reload.
    expect(isFullDocumentReload("doc-1::0", documentLoadKey("doc-2", 0))).toBe(true);
    // Retry (previewAttempt bump) on the same document → full reload.
    expect(isFullDocumentReload("doc-1::0", documentLoadKey("doc-1", 1))).toBe(true);
  });

  it("advances the loaded key only after a successful detail load", () => {
    const loadKey = documentLoadKey("doc-1", 0);

    // Success stamps the key so later navigation is treated as navigation.
    expect(nextLoadedDocumentKey(null, loadKey, true)).toBe("doc-1::0");
    // Regression guard: a failed full load must NOT stamp the key, so the next
    // page/chunk navigation still evaluates as a full reload and re-fetches
    // signed URLs / refreshes the error instead of skipping that recovery.
    expect(nextLoadedDocumentKey(null, loadKey, false)).toBeNull();
    expect(isFullDocumentReload(nextLoadedDocumentKey(null, loadKey, false), loadKey)).toBe(true);
    // A failed navigation keeps the previously loaded key intact.
    expect(nextLoadedDocumentKey("doc-1::0", loadKey, false)).toBe("doc-1::0");
  });
});

// `/api/documents/:id` returns a window of pages centred on the requested one, so
// flipping to a neighbour asks the server for rows the client already holds. The
// route sets no Cache-Control and the service worker never caches a query-string
// request, so each of those flips was a real round trip.
describe("detail request skipping", () => {
  const window9 = { signature: "doc-a|0||authenticated|false|true|true|false|token", from: 1, to: 9 };

  it("skips a flip that lands inside the loaded window", () => {
    expect(canSkipDetailRequest(window9, window9.signature, 4)).toBe(true);
    expect(canSkipDetailRequest(window9, window9.signature, 1)).toBe(true);
    expect(canSkipDetailRequest(window9, window9.signature, 9)).toBe(true);
  });

  it("refetches once the page leaves the loaded window", () => {
    expect(canSkipDetailRequest(window9, window9.signature, 10)).toBe(false);
    expect(canSkipDetailRequest(window9, window9.signature, 0)).toBe(false);
  });

  it("refetches whenever any request-shaping input moved, in-window or not", () => {
    // A different document, chunk, retry attempt or auth identity all change the
    // signature — the page being in range must never be enough on its own.
    expect(canSkipDetailRequest(window9, "doc-b|0||authenticated|false|true|true|false|token", 4)).toBe(false);
    expect(canSkipDetailRequest(window9, "doc-a|1||authenticated|false|true|true|false|token", 4)).toBe(false);
    expect(canSkipDetailRequest(window9, "doc-a|0|chunk-1|authenticated|false|true|true|false|token", 4)).toBe(false);
    expect(canSkipDetailRequest(window9, "doc-a|0||authenticated|false|true|true|false|other-token", 4)).toBe(false);
  });

  it("never skips before a window has been loaded, or after one was invalidated", () => {
    expect(canSkipDetailRequest(null, window9.signature, 4)).toBe(false);
  });
});
