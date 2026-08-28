import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";

/**
 * Every figure the capacity board shows, derived in one place so no screen computes its own
 * version. Phase 5, spec D5 and D6.
 *
 * The rule this file exists to enforce: **nothing predicted, confirmed-but-unreleased, or on leave
 * is ever added into `availableNow`.** A coordinator must be able to point at that number and say
 * "that is a bed I can fill this minute", and it must never have been softened by an expectation.
 *
 * The rule's mirror image, added by the bed-model rework of 2026-08-28 (Q4) and just as binding:
 * **nothing is ever SUBTRACTED from `availableNow` for a preparation note either.** A released bed
 * being made ready (cleaning, and whatever the owner's pending list eventually names) is still
 * offered and still counted, because pulling the next patient takes hours anyway — see
 * `BED_PREPARATION_NOTES`. `availableNow` is derived from the unit's own `allocatable`/`empty`
 * figures and reads no `BedRelease` field at all, which is what makes both halves of the rule
 * structural rather than remembered.
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
  /**
   * How many of today's releases carry the blocked flag — the figure the four-stage model
   * structurally could not produce (bed-model rework, 2026-08-28).
   *
   * **It is a CROSS-CUT, not a fourth bucket.** Every release counted here is also counted in
   * `confirmedToday` or `predictedToday`, because being stuck says nothing about how certain the
   * discharge is. Never add it to those two, and never subtract it from them: it answers "how
   * many of these is somebody having to chase", which is a different question from "how many are
   * coming". A release expected beyond tonight is excluded here exactly as it is from the other
   * two, so this figure and `excludedBeyondToday` never double-count.
   */
  blockedToday: number;
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
  let blockedToday = 0;
  let excludedBeyondToday = 0;

  for (const release of unitReleases) {
    if (release.state === "released") continue;
    const band = releaseBand(release, now);
    if (band === "beyond-today") {
      excludedBeyondToday += 1;
      continue;
    }
    // The bed-model rework's whole point (2026-08-28). `state` now carries ONLY how certain the
    // discharge is, so these two branches are exhaustive over every unreleased release and
    // nothing can fall between them — which is exactly what a release in the old fourth state
    // `"blocked"` did, silently dropping a stuck confirmed discharge out of the ward's confirmed
    // count. A blocked-but-confirmed bed is counted as confirmed here, deliberately, and the
    // block is reported alongside rather than instead. Do not re-introduce a `blocker` test into
    // this if/else — that is the defect, not a refinement of it.
    if (release.state === "confirmed") confirmedToday += 1;
    else predictedToday += 1;
    if (release.blocker !== null) blockedToday += 1;
  }

  const leaveUsable = leave.filter((bed) => bed.unitId === unit.id && bed.usable).length;

  return {
    availableNow,
    confirmedToday,
    predictedToday,
    blockedToday,
    held,
    leaveUsable,
    excludedBeyondToday,
  };
}
