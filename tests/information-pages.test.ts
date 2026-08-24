import { describe, expect, it } from "vitest";

import { isToolDetailWithFooterSearch } from "@/lib/information-pages";

describe("isToolDetailWithFooterSearch", () => {
  it("keeps catalog result docks distinct from record pages", () => {
    expect(isToolDetailWithFooterSearch("/services/search")).toBe(false);
    expect(isToolDetailWithFooterSearch("/forms/search")).toBe(false);
    expect(isToolDetailWithFooterSearch("/services")).toBe(false);
    expect(isToolDetailWithFooterSearch("/forms")).toBe(false);
    expect(isToolDetailWithFooterSearch("/medications")).toBe(false);
  });

  it("matches service, form, and medication record pages", () => {
    expect(isToolDetailWithFooterSearch("/services/13yarn")).toBe(true);
    expect(isToolDetailWithFooterSearch("/forms/transport-forms")).toBe(true);
    expect(isToolDetailWithFooterSearch("/medications/lithium")).toBe(true);
  });
});
