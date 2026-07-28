import { describe, expect, it } from "vitest";

import { foldSavedFavouritesStatus } from "@/components/clinical-dashboard/saved-registry-favourites-status";

describe("foldSavedFavouritesStatus", () => {
  it("reports loading while an authenticated account favourites request is pending", () => {
    expect(
      foldSavedFavouritesStatus({
        isAuthenticated: true,
        accountReady: false,
        accountError: null,
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
        accountError: "Saved items could not be loaded.",
        registryStatus: "ready",
        itemCount: 0,
      }).status,
    ).toBe("error");
  });

  it("does not claim ready zero while account data is unsettled", () => {
    const folded = foldSavedFavouritesStatus({
      isAuthenticated: true,
      accountReady: false,
      accountError: null,
      registryStatus: "ready",
      itemCount: 0,
    });
    expect(folded.status).not.toBe("ready");
  });

  it("keeps ready when unaffected items already exist beside a registry fault", () => {
    expect(
      foldSavedFavouritesStatus({
        isAuthenticated: true,
        accountReady: true,
        accountError: null,
        registryStatus: "error",
        itemCount: 2,
      }).status,
    ).toBe("ready");
  });

  it("surfaces registry unauthorized when the account layer is settled and empty", () => {
    expect(
      foldSavedFavouritesStatus({
        isAuthenticated: true,
        accountReady: true,
        accountError: null,
        registryStatus: "unauthorized",
        itemCount: 0,
      }).status,
    ).toBe("unauthorized");
  });
});
