import { describe, expect, it } from "vitest";

import {
  foldSavedFavouritesStatus,
  resolveSavedFavouritesPresentation,
} from "@/components/clinical-dashboard/saved-registry-favourites-status";

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

  it("keeps ready when unaffected items already exist beside a registry fault", () => {
    const folded = foldSavedFavouritesStatus({
      isAuthenticated: true,
      accountReady: true,
      accountLoadError: null,
      registryStatus: "error",
      itemCount: 2,
    });
    expect(folded).toEqual({ status: "ready", registryStatus: "error", sourceStatus: "error" });
    expect(resolveSavedFavouritesPresentation({ ...folded, itemCount: 2 })).toEqual({
      status: "ready",
      partialStatus: "error",
    });
  });

  it.each(["loading", "unauthorized", "error"] as const)(
    "preserves a partial %s source state beside an honest loaded count",
    (sourceStatus) => {
      expect(resolveSavedFavouritesPresentation({ status: "ready", sourceStatus, itemCount: 3 })).toEqual({
        status: "ready",
        partialStatus: sourceStatus,
      });
    },
  );

  it("preserves an account-source failure beside unaffected loaded items", () => {
    const folded = foldSavedFavouritesStatus({
      isAuthenticated: true,
      accountReady: true,
      accountLoadError: "Saved items could not be loaded.",
      registryStatus: "ready",
      itemCount: 2,
    });
    expect(folded).toEqual({ status: "ready", registryStatus: "ready", sourceStatus: "error" });
    expect(resolveSavedFavouritesPresentation({ ...folded, itemCount: 2 })).toEqual({
      status: "ready",
      partialStatus: "error",
    });
  });

  it("keeps a whole-source failure when no favourites loaded", () => {
    expect(resolveSavedFavouritesPresentation({ status: "error", sourceStatus: "error", itemCount: 0 })).toEqual({
      status: "error",
      partialStatus: null,
    });
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
