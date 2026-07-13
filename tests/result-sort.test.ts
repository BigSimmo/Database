import { describe, expect, it } from "vitest";

import { readResultSort, resultSortHref, sortResultItems } from "@/lib/result-sort";

describe("result sorting", () => {
  it("accepts only the supported URL values", () => {
    expect(readResultSort("alpha")).toBe("alpha");
    expect(readResultSort("relevance")).toBe("relevance");
    expect(readResultSort("recent")).toBe("relevance");
    expect(readResultSort(null)).toBe("relevance");
  });

  it("sorts titles naturally without mutating relevance order", () => {
    const items = [{ title: "Form 10" }, { title: "alpha" }, { title: "Form 2" }];
    expect(sortResultItems(items, "alpha", (item) => item.title).map((item) => item.title)).toEqual([
      "alpha",
      "Form 2",
      "Form 10",
    ]);
    expect(sortResultItems(items, "relevance", (item) => item.title)).toEqual(items);
    expect(items.map((item) => item.title)).toEqual(["Form 10", "alpha", "Form 2"]);
  });

  it("persists A-Z in the URL and removes the default value", () => {
    const current = new URLSearchParams("q=transport&run=1");
    expect(resultSortHref("/forms", current, "alpha")).toBe("/forms?q=transport&run=1&sort=alpha");
    expect(resultSortHref("/forms", new URLSearchParams("q=transport&run=1&sort=alpha"), "relevance")).toBe(
      "/forms?q=transport&run=1",
    );
  });
});
