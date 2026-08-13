import { describe, expect, it } from "vitest";

import {
  documentSourceRedirectTarget,
  isDocumentSourcePath,
  resolveDocumentSourceRedirect,
} from "@/lib/document-source-redirect";

const demoId = "11111111-1111-4111-8111-111111111111";

describe("resolveDocumentSourceRedirect", () => {
  it("redirects a valid id with sanitised page and chunk", () => {
    const params = new URLSearchParams({ id: demoId, page: "2", chunk: "safety plan" });
    expect(documentSourceRedirectTarget(params)).toBe(`/documents/${demoId}?page=2&chunk=safety+plan`);
  });

  it("falls back to document search for an invalid id with no query", () => {
    const { pathname, params } = resolveDocumentSourceRedirect(new URLSearchParams({ id: "not-a-uuid", page: "2" }));
    expect(pathname).toBe("/documents/search");
    expect(params.size).toBe(0);
  });

  it("falls back when id is missing entirely", () => {
    expect(documentSourceRedirectTarget(new URLSearchParams())).toBe("/documents/search");
  });

  it("drops non-positive, fractional, and non-numeric pages", () => {
    for (const page of ["0", "-3", "2.5", "abc", ""]) {
      const params = new URLSearchParams({ id: demoId, page });
      expect(documentSourceRedirectTarget(params)).toBe(`/documents/${demoId}`);
    }
  });

  it("trims and truncates chunk to 120 characters", () => {
    const params = new URLSearchParams({ id: demoId, chunk: `  ${"x".repeat(150)}  ` });
    const { params: out } = resolveDocumentSourceRedirect(params);
    expect(out.get("chunk")).toBe("x".repeat(120));
  });

  it("drops a whitespace-only chunk", () => {
    const params = new URLSearchParams({ id: demoId, chunk: "   " });
    expect(documentSourceRedirectTarget(params)).toBe(`/documents/${demoId}`);
  });

  it("ignores unrelated query parameters", () => {
    const params = new URLSearchParams({ id: demoId, page: "3", utm_source: "x" });
    expect(documentSourceRedirectTarget(params)).toBe(`/documents/${demoId}?page=3`);
  });
});

describe("isDocumentSourcePath", () => {
  it("matches only the two fallback routes", () => {
    expect(isDocumentSourcePath("/documents/source")).toBe(true);
    expect(isDocumentSourcePath("/documents/source/evidence")).toBe(true);
    expect(isDocumentSourcePath("/documents/search")).toBe(false);
    expect(isDocumentSourcePath("/documents/source/other")).toBe(false);
    expect(isDocumentSourcePath("/mockups/document-search/source")).toBe(false);
  });
});
