export type SavedFavouritesBandStatus = "ready" | "loading" | "unauthorized" | "error";
export type SavedFavouritesPartialStatus = Exclude<SavedFavouritesBandStatus, "ready">;

export function resolveSavedFavouritesPresentation(input: {
  status: SavedFavouritesBandStatus;
  sourceStatus: SavedFavouritesBandStatus;
  itemCount: number;
}): { status: SavedFavouritesBandStatus; partialStatus: SavedFavouritesPartialStatus | null } {
  if (input.itemCount > 0 && input.sourceStatus !== "ready") {
    return { status: "ready", partialStatus: input.sourceStatus };
  }
  return { status: input.status, partialStatus: null };
}

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
}): {
  status: SavedFavouritesBandStatus;
  registryStatus: SavedFavouritesBandStatus;
  sourceStatus: SavedFavouritesBandStatus;
} {
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
  // an honest nonzero count visible instead of hiding behind a whole-band fault.
  const status = input.itemCount > 0 && folded !== "ready" ? "ready" : folded;
  return { status, registryStatus, sourceStatus: folded };
}
