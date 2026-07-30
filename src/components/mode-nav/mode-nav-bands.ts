/**
 * Slot capacities for the mode navigation bar, narrowest first. These mirror
 * the `@container mode-nav (min-width: …)` bands in `globals.css`; changing one
 * without the other is what `tests/mode-nav-contract.test.ts` guards against.
 */
export const MODE_NAV_BANDS = [3, 4, 5] as const;

export type ModeNavBand = (typeof MODE_NAV_BANDS)[number];

/** Below this a bar is a label, not navigation, so nothing renders. */
export const MODE_NAV_MIN_ITEMS = 2;

export type ModeNavBandPlan = {
  /** Item index → the narrowest band at which it appears. Absent = always folded. */
  firstVisibleBand: Map<number, ModeNavBand>;
  /** The widest band at which More still appears, or null when it is never needed. */
  moreUntil: ModeNavBand | null;
};

/**
 * Decides which destinations survive each width band.
 *
 * For a capacity of C slots: if every item fits, all of them show and there is
 * no overflow entry; otherwise the first C-1 show and the tail folds into More,
 * which occupies the last slot.
 *
 * Derived from the item COUNT alone — a static fact known at render — so this
 * never measures layout. Runtime measurement ("priority plus") would let the
 * bar's contents change under the user between screens and orientations, which
 * is the one thing navigation must not do.
 *
 * Because a wider band is always a superset of a narrower one, the slots that
 * stay never move as the container narrows; the overflow only fills from the
 * tail.
 */
export function planModeNavBands(count: number): ModeNavBandPlan {
  const firstVisibleBand = new Map<number, ModeNavBand>();
  let moreUntil: ModeNavBand | null = null;

  for (const capacity of MODE_NAV_BANDS) {
    const visible = count <= capacity ? count : capacity - 1;
    for (let index = 0; index < visible; index += 1) {
      if (!firstVisibleBand.has(index)) firstVisibleBand.set(index, capacity);
    }
    if (count > capacity) moreUntil = capacity;
  }

  return { firstVisibleBand, moreUntil };
}
