/**
 * Plans an exact reorder of the favourites in one set (or Unsorted).
 *
 * The request must name every current member exactly once, so a stale page
 * cannot silently drop or duplicate an item. Positions are written as
 * (index + 1) * 10, the same spacing `reorder_user_favourite` uses, and only
 * rows whose order actually changes are returned.
 */
export type FavouriteOrderRow = { contentType: string; contentKey: string; sortOrder: number };
export type FavouriteOrderRef = { contentType: string; contentKey: string };

function orderKey(ref: FavouriteOrderRef) {
  return `${ref.contentType}\u0000${ref.contentKey}`;
}

export function planFavouriteItemOrder(
  current: readonly FavouriteOrderRow[],
  requested: readonly FavouriteOrderRef[],
): { ok: true; updates: FavouriteOrderRow[] } | { ok: false } {
  const currentOrder = new Map(current.map((row) => [orderKey(row), row.sortOrder]));
  const requestedKeys = new Set(requested.map(orderKey));
  if (
    requested.length !== current.length ||
    requestedKeys.size !== requested.length ||
    requested.some((ref) => !currentOrder.has(orderKey(ref)))
  ) {
    return { ok: false };
  }
  const updates = requested.flatMap((ref, index) => {
    const sortOrder = (index + 1) * 10;
    return currentOrder.get(orderKey(ref)) === sortOrder
      ? []
      : [{ contentType: ref.contentType, contentKey: ref.contentKey, sortOrder }];
  });
  return { ok: true, updates };
}
