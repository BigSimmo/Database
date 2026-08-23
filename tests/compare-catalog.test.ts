import { describe, expect, it } from "vitest";

import {
  assignCompareId,
  filterCompareCatalog,
  firstEmptySlot,
  idsCompareHref,
  padCompareIds,
  pairCompareHref,
} from "@/components/compare";

const items = [
  { id: "mse", title: "MSE", snippet: "Mental state examination", tag: "term" },
  { id: "mmse", title: "MMSE", snippet: "Mini-mental state examination", tag: "term" },
  { id: "mood", title: "Mood", snippet: "Sustained emotional climate", tag: "term" },
];

describe("compare catalog helpers", () => {
  it("filters by title, snippet, tag, or id", () => {
    expect(filterCompareCatalog(items, "mini-mental").map((item) => item.id)).toEqual(["mmse"]);
    expect(filterCompareCatalog(items, "term").map((item) => item.id)).toEqual(["mse", "mmse", "mood"]);
  });

  it("assigns to the active slot and clears duplicates", () => {
    expect(assignCompareId(["mse", null], 1, "mmse")).toEqual(["mse", "mmse"]);
    expect(assignCompareId(["mse", "mood"], 1, "mse")).toEqual([null, "mse"]);
  });

  it("finds the first empty slot and pads to max count", () => {
    expect(firstEmptySlot(["mse", null])).toBe(1);
    expect(firstEmptySlot(["mse", "mmse"])).toBeNull();
    expect(padCompareIds(["mse"], 3)).toEqual(["mse", null, null]);
  });

  it("builds pair and ids hrefs without duplicate ids", () => {
    expect(pairCompareHref("/dictionary/compare", "mse", "mmse")).toBe("/dictionary/compare?a=mse&b=mmse");
    expect(idsCompareHref("/dsm/compare", ["mdd", "mdd", "bp2"])).toBe("/dsm/compare?ids=mdd,bp2");
    expect(idsCompareHref("/differentials/compare", ["delirium"], { q: "pain" })).toBe(
      "/differentials/compare?q=pain&ids=delirium",
    );
  });
});
