import { describe, expect, it } from "vitest";

import { foldSavedFavouritesStatus } from "@/components/clinical-dashboard/saved-registry-favourites-status";

describe("foldSavedFavouritesStatus", () => {
  it("reports loading while an authenticated account favourites request is pending", () => {
    expect(
      foldSavedFavouritesStatus({
        isAuthenticated: true,
        accountReady: false,
        accountLoadError: null,
        registryStatus: "ready",
        itemCount: 0,
      }).status,
    ).toBe("loading");
  });

  it("reports error when the account favourites request failed with no items", () => {
    expect(
      foldSavedFavouritesStatus({
        isAuthenticated: true,
        accountReady: true,
        accountLoadError: "Saved items could not be loaded.",
        registryStatus: "ready",
        itemCount: 0,
      }).status,
    ).toBe("error");
  });

  it("does not claim ready zero while account data is unsettled", () => {
    const folded = foldSavedFavouritesStatus({
      isAuthenticated: true,
      accountReady: false,
      accountLoadError: null,
      registryStatus: "ready",
      itemCount: 0,
    });
    expect(folded.status).not.toBe("ready");
  });

  it("reports a partial count when unaffected items already exist beside a registry fault", () => {
    expect(
      foldSavedFavouritesStatus({
        isAuthenticated: true,
        accountReady: true,
        accountLoadError: null,
        registryStatus: "error",
        itemCount: 2,
      }).status,
    ).toBe("partial");
  });

  it("surfaces registry unauthorized when the account layer is settled and empty", () => {
    expect(
      foldSavedFavouritesStatus({
        isAuthenticated: true,
        accountReady: true,
        accountLoadError: null,
        registryStatus: "unauthorized",
        itemCount: 0,
      }).status,
    ).toBe("unauthorized");
  });

  it("stays ready for an empty library when only a mutation would have failed", () => {
    // foldSavedFavouritesStatus only receives load errors. A failed first-save
    // after a successful empty GET must leave the empty state truthful.
    expect(
      foldSavedFavouritesStatus({
        isAuthenticated: true,
        accountReady: true,
        accountLoadError: null,
        registryStatus: "ready",
        itemCount: 0,
      }).status,
    ).toBe("ready");
  });
});
