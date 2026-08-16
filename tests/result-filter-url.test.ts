/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";

import {
  readResultFilterValue,
  readResultFilterValues,
  replaceResultFilterUrl,
  writeResultFilterValue,
  writeResultFilterValues,
} from "@/lib/result-filter-url";

const allowed = new Set(["all", "high", "low"] as const);

describe("result filter URL state", () => {
  it("reads stable values, de-duplicates them and ignores invalid values", () => {
    const params = new URLSearchParams("risk=low,unknown,high,low&q=mania&ids=a,b");
    expect(readResultFilterValues(params, "risk", allowed)).toEqual(["high", "low"]);
  });

  it("de-duplicates values after trimming whitespace", () => {
    const params = new URLSearchParams("risk=high,%20high,low");
    expect(readResultFilterValues(params, "risk", allowed)).toEqual(["high", "low"]);
  });

  it("writes sorted facets while preserving unrelated parameters", () => {
    const params = new URLSearchParams("q=mania&ids=a,b&focus=1");
    writeResultFilterValues(params, "risk", ["low", "high", "low"], allowed);
    expect(params.toString()).toBe("q=mania&ids=a%2Cb&focus=1&risk=high%2Clow");
  });

  it("de-duplicates written values after trimming whitespace", () => {
    const params = new URLSearchParams();
    writeResultFilterValues(params, "risk", ["high", " high" as "high", "low"], allowed);
    expect(params.get("risk")).toBe("high,low");
  });

  it("omits empty facets and default lenses", () => {
    const params = new URLSearchParams("q=mania&risk=high&scope=high");
    writeResultFilterValues(params, "risk", [], allowed);
    writeResultFilterValue(params, "scope", "all", "all", allowed);
    expect(params.toString()).toBe("q=mania");
  });

  it("falls back for an invalid lens", () => {
    expect(readResultFilterValue(new URLSearchParams("scope=unknown"), "scope", allowed, "all")).toBe("all");
  });

  it("replaces the current URL without adding history or dropping unrelated state", () => {
    window.history.replaceState(null, "", "/forms?q=mania&ids=a,b&focus=1#results");
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");

    replaceResultFilterUrl((params) => writeResultFilterValues(params, "risk", ["low", "high"], allowed));

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/forms?q=mania&ids=a%2Cb&focus=1&risk=high%2Clow#results");
    expect(window.location.pathname).toBe("/forms");
    expect(window.location.hash).toBe("#results");
  });

  it("composes rapid refinements from the current URL instead of a stale render snapshot", () => {
    window.history.replaceState(null, "", "/services?q=crisis&group=community");

    replaceResultFilterUrl((params) => writeResultFilterValues(params, "risk", ["high"], allowed));
    replaceResultFilterUrl((params) => writeResultFilterValues(params, "signal", ["low"], allowed));

    expect(window.location.search).toBe("?q=crisis&group=community&risk=high&signal=low");
  });
});
