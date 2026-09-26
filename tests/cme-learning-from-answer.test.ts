import { describe, expect, it } from "vitest";

import { cmeLearningFromSourceHref, parseCmeLearningPrefill } from "@/lib/cme/learning-source";

describe("Log as CPD from a clinical answer", () => {
  it("fills the new entry with the cited source's title and link", () => {
    const href = cmeLearningFromSourceHref({ title: "Clozapine monitoring guideline", href: "/documents/abc?page=4" });
    expect(href).not.toBeNull();
    const url = new URL(href!, "https://example.test");
    expect(url.pathname).toBe("/cme/new");
    expect(parseCmeLearningPrefill(Object.fromEntries(url.searchParams))).toEqual({
      title: "Clozapine monitoring guideline",
      sourceUrl: "/documents/abc?page=4",
    });
  });

  it("carries nothing but the source title and link, so a typed question never reaches the address", () => {
    const href = cmeLearningFromSourceHref({ title: "Lithium guideline", href: "/documents/li" })!;
    const url = new URL(href, "https://example.test");
    expect([...url.searchParams.keys()].sort()).toEqual(["sourceUrl", "title"]);
  });

  it("keeps a long title inside the form's limit rather than losing it", () => {
    const href = cmeLearningFromSourceHref({ title: "x".repeat(300), href: "/documents/long" })!;
    const url = new URL(href, "https://example.test");
    expect(parseCmeLearningPrefill(Object.fromEntries(url.searchParams)).title).toHaveLength(200);
  });

  it("offers no link for a source with no usable title or address", () => {
    expect(cmeLearningFromSourceHref({ title: "  ", href: "/documents/x" })).toBeNull();
    expect(cmeLearningFromSourceHref({ title: "Guideline", href: "javascript:alert(1)" })).toBeNull();
  });
});
