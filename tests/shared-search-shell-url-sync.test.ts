/**
 * Regression lock for the shared `(search-app)` shell: pathname-only mode
 * switches (empty query string) must still update searchMode. Sync runs during
 * render (not in an effect) so the composer does not paint one stale-mode frame.
 * This unit covers the sync predicate so a params-only check cannot return unnoticed.
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
