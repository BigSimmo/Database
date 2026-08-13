/**
 * Slot capacities for the mode navigation bar, narrowest first. Every density
 * profile uses this same progression; the profile only decides how much
 * container width its real labels need before each capacity is safe.
 */
export const MODE_NAV_BANDS = [3, 4, 5] as const;

export type ModeNavBand = (typeof MODE_NAV_BANDS)[number];

/**
 * Calibrated label families for the shared bar. A profile is chosen from the
 * declared destinations, never measured at runtime, so navigation stays stable
 * through hydration, rotation, and browser zoom.
 */
export const MODE_NAV_DENSITY_PROFILES = ["two-item", "compact-four", "balanced-four", "extended"] as const;

export type ModeNavDensityProfile = (typeof MODE_NAV_DENSITY_PROFILES)[number];

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
