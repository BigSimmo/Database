export type SavedFavouritesBandStatus = "ready" | "loading" | "partial" | "unauthorized" | "error";

/**
 * Fold account-favourites readiness with downstream registry status.
 * An authenticated account request that has not settled (or failed) must not
 * report `ready` with zero items — that reads as "no favourites" when the
 * saved-items list was never loaded.
 */
export function foldSavedFavouritesStatus(input: {
  isAuthenticated: boolean;
  accountReady: boolean;
  /** Only GET /api/account/favourites failures. Mutation/save errors must not
      pass through here — they would mark an already-loaded empty library as
      unavailable and offer a GET Retry for a failed write. */
  accountLoadError: string | null;
  registryStatus: SavedFavouritesBandStatus;
  itemCount: number;
}): { status: SavedFavouritesBandStatus; registryStatus: SavedFavouritesBandStatus } {
  const accountStatus: SavedFavouritesBandStatus =
    input.isAuthenticated && !input.accountReady
      ? "loading"
      : input.isAuthenticated && input.accountLoadError
        ? "error"
        : "ready";

  const registryStatus = input.registryStatus;
  const folded: SavedFavouritesBandStatus =
    accountStatus === "loading" ? "loading" : accountStatus === "error" ? "error" : registryStatus;

  // Unaffected items (local differentials, or one registry that succeeded) keep
  // an honest nonzero count visible, but retain the fact that another source
  // failed. Without `partial`, the count looks complete when it is only a lower
  // bound. A pending sibling source keeps the established ready-with-items
  // behaviour until it settles; `partial` is reserved for an actual fault.
  const status =
    folded === "partial" || (input.itemCount > 0 && (folded === "error" || folded === "unauthorized"))
      ? "partial"
      : input.itemCount > 0 && folded === "loading"
        ? "ready"
        : folded;
  return { status, registryStatus };
}
