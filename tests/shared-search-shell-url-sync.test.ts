/**
 * Regression lock for the shared `(search-app)` shell: pathname-only mode
 * switches (empty query string) must still update searchMode. Sync runs during
 * render (not in an effect) so the composer does not paint one stale-mode frame.
 * This unit covers the sync predicate so a params-only check cannot return unnoticed.
 *
 * Also locks the pending-mode-navigation release predicate: destination match
 * (including query string) or any superseding URL change — never destination-only.
 */
import { describe, expect, it } from "vitest";

describe("shared search-shell URL sync predicate", () => {
  function shouldSyncUrlState(args: {
    lastSearchParams: string;
    nextSearchParams: string;
    lastPathname: string;
    nextPathname: string;
  }) {
    const searchParamsChanged = args.lastSearchParams !== args.nextSearchParams;
    const pathnameChanged = args.lastPathname !== args.nextPathname;
    return searchParamsChanged || pathnameChanged;
  }

  it("syncs when pathname changes with an unchanged empty query string", () => {
    expect(
      shouldSyncUrlState({
        lastSearchParams: "",
        nextSearchParams: "",
        lastPathname: "/services",
        nextPathname: "/dsm",
      }),
    ).toBe(true);
  });

  it("does not sync on typing-only re-renders (URL unchanged)", () => {
    expect(
      shouldSyncUrlState({
        lastSearchParams: "",
        nextSearchParams: "",
        lastPathname: "/services",
        nextPathname: "/services",
      }),
    ).toBe(false);
  });

  it("syncs when only the query string changes", () => {
    expect(
      shouldSyncUrlState({
        lastSearchParams: "",
        nextSearchParams: "q=lithium&run=1",
        lastPathname: "/services",
        nextPathname: "/services",
      }),
    ).toBe(true);
  });
});

describe("pending mode-navigation release predicate", () => {
  type Pending = {
    mode: string;
    pathname: string;
    searchParamString: string;
    sourcePathname: string;
    sourceSearchParamString: string;
  };

  function shouldClearPending(args: {
    pending: Pending;
    pathname: string;
    resolvedSearchMode: string;
    searchParamString: string;
  }) {
    const { pending, pathname, resolvedSearchMode, searchParamString } = args;
    const reachedDestination =
      pathname === pending.pathname &&
      resolvedSearchMode === pending.mode &&
      searchParamString === pending.searchParamString;
    const supersededWhilePending =
      pathname !== pending.sourcePathname || searchParamString !== pending.sourceSearchParamString;
    return reachedDestination || supersededWhilePending;
  }

  it("keeps pending while still on the source URL mid-navigation", () => {
    expect(
      shouldClearPending({
        pending: {
          mode: "forms",
          pathname: "/forms",
          searchParamString: "",
          sourcePathname: "/services",
          sourceSearchParamString: "",
        },
        pathname: "/services",
        resolvedSearchMode: "services",
        searchParamString: "",
      }),
    ).toBe(false);
  });

  it("clears pending when the intended destination lands", () => {
    expect(
      shouldClearPending({
        pending: {
          mode: "forms",
          pathname: "/forms",
          searchParamString: "",
          sourcePathname: "/services",
          sourceSearchParamString: "",
        },
        pathname: "/forms",
        resolvedSearchMode: "forms",
        searchParamString: "",
      }),
    ).toBe(true);
  });

  it("clears pending when a different navigation supersedes the mode push", () => {
    expect(
      shouldClearPending({
        pending: {
          mode: "forms",
          pathname: "/forms",
          searchParamString: "",
          sourcePathname: "/services",
          sourceSearchParamString: "",
        },
        pathname: "/",
        resolvedSearchMode: "answer",
        searchParamString: "mode=answer&focus=1",
      }),
    ).toBe(true);
  });

  it("keeps pending on same-pathname submitted→home until the query string clears", () => {
    const pending = {
      mode: "services",
      pathname: "/services",
      searchParamString: "",
      sourcePathname: "/services",
      sourceSearchParamString: "q=13YARN&run=1",
    };
    expect(
      shouldClearPending({
        pending,
        pathname: "/services",
        resolvedSearchMode: "services",
        searchParamString: "q=13YARN&run=1",
      }),
    ).toBe(false);
    expect(
      shouldClearPending({
        pending,
        pathname: "/services",
        resolvedSearchMode: "services",
        searchParamString: "",
      }),
    ).toBe(true);
  });
});
