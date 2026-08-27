import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";

/**
 * Every figure the capacity board shows, derived in one place so no screen computes its own
 * version. Phase 5, spec D5 and D6.
 *
 * The rule this file exists to enforce: **nothing predicted, confirmed-but-unreleased, or on leave
 * is ever added into `availableNow`.** A coordinator must be able to point at that number and say
 * "that is a bed I can fill this minute", and it must never have been softened by an expectation.
 */

const MIDDAY_MINUTES = 12 * 60; // 720
const LATE_AFTERNOON_MINUTES = 16 * 60; // 960

/**
 * The evening shift ends at 22:00. Named once here rather than repeated as a literal anywhere a
 * band boundary is checked.
 */
export const EVENING_SHIFT_END_MINUTES = 22 * 60; // 1320

export const RELEASE_BANDS = ["now", "by-midday", "by-1600", "tonight"] as const;
export type ReleaseBand = (typeof RELEASE_BANDS)[number];

/**
 * `Instant` is minutes since midnight on the synthetic operating day, not a wall-clock time of
 * day that wraps — so the band is derived from the RAW instant, compared directly against the
 * named minute constants, never from a wrapped time-of-day (e.g. via `formatInstant`). A release
 * expected a full day after `now` (`now + 1440`) must land in `"beyond-today"` even though it
 * falls at the same clock time as `now` itself; wrapping first would put it back in an earlier
 * band and silently resurrect a release that should have dropped off the board. Do not "fix" this
 * back to a wrapped time-of-day comparison.
 */
export function releaseBand(release: BedRelease, now: Instant): ReleaseBand | "beyond-today" {
  if (release.state === "released") {
    // RELEASE_BED restates confirmedAt to the release instant. "Released today" is this
    // operating day only: advancing the demo clock across midnight must drop yesterday's
    // released rows into the same beyond-today exclusion the discharge board already states
    // at its foot. Same-day released beds stay "now" even when expectedAt was later today.
    if (Math.floor(release.confirmedAt / MINUTES_PER_DAY) !== Math.floor(now / MINUTES_PER_DAY)) {
      return "beyond-today";
    }
    return "now";
  }
  if (release.expectedAt > EVENING_SHIFT_END_MINUTES) return "beyond-today";
  if (release.expectedAt <= now) return "now";
  if (release.expectedAt <= MIDDAY_MINUTES) return "by-midday";
  if (release.expectedAt <= LATE_AFTERNOON_MINUTES) return "by-1600";
  return "tonight";
}

export type CapacityBreakdown = {
  availableNow: number;
  confirmedToday: number;
  predictedToday: number;
  held: number;
  leaveUsable: number;
  excludedBeyondToday: number;
};

export function capacityBreakdown(
  unit: Unit,
  releases: BedRelease[],
  leave: LeaveBed[],
  now: Instant,
): CapacityBreakdown {
  // Copied verbatim from `unitCapacity` in ward-derivations.ts — the one number a coordinator
  // acts on must not drift from the five-state bed grid's own arithmetic.
  const availableNow = Math.min(unit.allocatable.value, unit.empty.value);
  const held = Math.max(unit.empty.value - availableNow, 0);

  const unitReleases = releases.filter((release) => release.unitId === unit.id);

  let confirmedToday = 0;
  let predictedToday = 0;
  let excludedBeyondToday = 0;

  for (const release of unitReleases) {
    if (release.state === "released") continue;
    const band = releaseBand(release, now);
    if (band === "beyond-today") {
      excludedBeyondToday += 1;
      continue;
    }
    if (release.state === "confirmed") confirmedToday += 1;
    else if (release.state === "predicted") predictedToday += 1;
  }

  const leaveUsable = leave.filter((bed) => bed.unitId === unit.id && bed.usable).length;

  return {
    availableNow,
    confirmedToday,
    predictedToday,
    held,
    leaveUsable,
    excludedBeyondToday,
  };
}
