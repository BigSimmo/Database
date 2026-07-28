export type SavedFavouritesBandStatus = "ready" | "loading" | "unauthorized" | "error";

/**
 * Fold account-favourites readiness with downstream registry status.
 * An authenticated account request that has not settled (or failed) must not
 * report `ready` with zero items — that reads as "no favourites" when the
 * saved-items list was never loaded.
 */
export function foldSavedFavouritesStatus(input: {
  isAuthenticated: boolean;
  accountReady: boolean;
  accountError: string | null;
  registryStatus: SavedFavouritesBandStatus;
  itemCount: number;
}): { status: SavedFavouritesBandStatus; registryStatus: SavedFavouritesBandStatus } {
  const accountStatus: SavedFavouritesBandStatus =
    input.isAuthenticated && !input.accountReady
      ? "loading"
      : input.isAuthenticated && input.accountError
        ? "error"
        : "ready";

  const registryStatus = input.registryStatus;
  const folded: SavedFavouritesBandStatus =
    accountStatus === "loading" ? "loading" : accountStatus === "error" ? "error" : registryStatus;

  // Unaffected items (local differentials, or one registry that succeeded) keep
  // an honest nonzero count visible instead of hiding behind a whole-band fault.
  const status = input.itemCount > 0 && folded !== "ready" ? "ready" : folded;
  return { status, registryStatus };
}
