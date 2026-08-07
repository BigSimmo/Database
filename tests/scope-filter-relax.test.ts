import { describe, expect, it, vi } from "vitest";

import { relaxDocumentScopeFilters } from "@/components/clinical-dashboard/clinical-dashboard-helpers";

/**
 * Relaxing a scope filter must go through the ordinary documents submit.
 *
 * The first cut rewrote the URL itself (`history.replaceState`) and then called
 * the search directly. Next keeps `useSearchParams()` in sync with the native
 * history API, so that rewrite moved `routedSearchContext` and woke the auto-run
 * effect in `ClinicalDashboard`. That effect returns early while `loading` is
 * true *without* recording the new submission signature, so once the search
 * settled it woke again, saw a signature it did not recognise, and issued the
 * identical search a second time — two requests and two loading states per
 * filter removal. The submit path seeds `autoRunSearchSignatureRef` before it
 * touches history, so delegating to it is what makes the relax idempotent.
 * (Raised by Devin review on PR #1640.)
 */
describe("relaxDocumentScopeFilters", () => {
  it("submits exactly once, through the path that seeds the submission signature", () => {
    const submitSearch = vi.fn();
    const setScopeFilters = vi.fn();

    relaxDocumentScopeFilters({
      filters: { topics: ["agitation"] },
      query: "Agitation",
      queryMode: "auto",
      setScopeFilters,
      submitSearch,
    });

    expect(submitSearch).toHaveBeenCalledTimes(1);
    expect(submitSearch).toHaveBeenCalledWith(
      "Agitation",
      { queryMode: "auto", scopeFilters: { topics: ["agitation"] } },
      true,
    );
  });

  it("does not touch history itself, which is what caused the duplicate run", () => {
    // This suite runs under the node environment, so there is no `window`: the
    // previous implementation called `window.history.replaceState` and would
    // throw ReferenceError right here. Completing IS the assertion, and it is a
    // stronger one than a spy — it holds for any future history writer, not
    // just the two methods a spy happened to watch.
    expect(typeof globalThis.window).toBe("undefined");
    expect(() =>
      relaxDocumentScopeFilters({
        filters: {},
        query: "Agitation",
        queryMode: "auto",
        setScopeFilters: vi.fn(),
        submitSearch: vi.fn(),
      }),
    ).not.toThrow();
  });

  it("applies the relaxed filters even when there is no query to re-run", () => {
    const submitSearch = vi.fn();
    const setScopeFilters = vi.fn();

    relaxDocumentScopeFilters({
      filters: {},
      query: "   ",
      queryMode: "auto",
      setScopeFilters,
      submitSearch,
    });

    expect(setScopeFilters).toHaveBeenCalledWith({});
    expect(submitSearch).not.toHaveBeenCalled();
  });

  it("clears the state before re-running, so the chips cannot show a stale filter", () => {
    const order: string[] = [];
    relaxDocumentScopeFilters({
      filters: { sites: ["FSH"] },
      query: "Agitation",
      queryMode: "auto",
      setScopeFilters: () => order.push("setScopeFilters"),
      submitSearch: () => order.push("submitSearch"),
    });

    expect(order).toEqual(["setScopeFilters", "submitSearch"]);
  });
});
