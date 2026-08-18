import { describe, expect, it } from "vitest";

import { shouldRunUniversalAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches-state";

describe("universal also-matches submission state", () => {
  it("keeps non-Answer mode panels independent of the shared-home URL", () => {
    expect(shouldRunUniversalAlsoMatches("services", "?mode=services")).toBe(true);
  });

  it("allows the server render until client URL state is available", () => {
    expect(shouldRunUniversalAlsoMatches("answer", null)).toBe(true);
  });

  it("requires both run=1 and a query for Answer mode", () => {
    expect(shouldRunUniversalAlsoMatches("answer", "?mode=answer&q=acamprosate&run=1")).toBe(true);
    expect(shouldRunUniversalAlsoMatches("answer", "?mode=answer&q=acamprosate")).toBe(false);
    expect(shouldRunUniversalAlsoMatches("answer", "?mode=answer&run=1")).toBe(false);
  });

  it("does not revive a persisted Answer panel on an unsubmitted hidden-mode home", () => {
    expect(shouldRunUniversalAlsoMatches("answer", "?mode=answer&focus=1")).toBe(false);
  });
});
