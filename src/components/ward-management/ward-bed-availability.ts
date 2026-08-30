import { dayOf, MINUTES_PER_DAY, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
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

/**
 * WB-DB-7 added `"tomorrow"` on 2026-08-30, and it is not a fifth bucket bolted onto four.
 *
 * The owner asked for the horizon to roll forward twenty-four hours instead of stopping at the end
 * of the evening shift. Widening it alone would have been one line and would have LIED: the four
 * bands below are TIMES OF DAY, and a discharge expected at 09:00 tomorrow falls through
 * `<= MIDDAY` and `<= LATE_AFTERNOON` and lands in `"tonight"`. It compiles, every test passes, and
 * a ward reads at handover that a bed frees tonight when it frees tomorrow morning.
 *
 * That is the same defect as `Instant` meaning two things: an absolute instant compared against a
 * time-of-day constant, in a fourth place. So the fix is the same shape rather than a new band -
 * `releaseBand` decides WHICH DAY first and only then which part of that day, and "tomorrow" falls
 * out of the model instead of being added to it.
 */
export const RELEASE_BANDS = ["now", "by-midday", "by-1600", "tonight", "tomorrow"] as const;
export type ReleaseBand = (typeof RELEASE_BANDS)[number];

/**
 * WHICH DAY FIRST, THEN WHICH PART OF THAT DAY. Rewritten 2026-08-30; read the reason before
 * changing it back.
 *
 * The three named constants are minutes from the start of DAY ZERO. Until the demo clock moved,
 * every instant WAS a minute of day zero, so comparing a raw instant against them was correct —
 * and the comment that used to sit here defended exactly that, for a real reason restated below.
 *
 * **Once the clock ran past midnight that comparison collapsed.** An instant on day one is 1440 or
 * more, so every release on day one exceeded `EVENING_SHIFT_END_MINUTES` and came back
 * `"beyond-today"`: the whole band vocabulary reduced to one value, and "beyond today" came to
 * mean "beyond day zero". Confirmed by running it rather than inferred —
 * `tests/ward-release-band-day-boundary.test.ts` failed with `expected 'beyond-today' to be
 * 'by-midday'` for an 09:00 discharge read at 08:00 on day one.
 *
 * **The rule the old comment protected still holds and is still enforced.** A release a full day
 * after `now` must NOT wrap back into an earlier band — `now + 1440` falls at the same clock time
 * as `now` and is emphatically not "now". That is why the DAY comparison comes first and
 * short-circuits before any minute-of-day comparison is reached. Wrapping first was the danger;
 * wrapping only after the day is settled is not.
 *
 * **DB-7 HAS SINCE LANDED and this paragraph's premise is gone.** It said the horizon was
 * deliberately unchanged and that a later day was still `"beyond-today"`. The owner answered on
 * 2026-08-30: the horizon rolls a full twenty-four hours and a later day is `"tomorrow"`. The
 * morning page carries the stated notice that its figures rose because the rule changed. Kept as a
 * record rather than deleted, because the reasoning above is why the change was dangerous to make
 * carelessly, and that is still true
 */
export function releaseBand(release: BedRelease, now: Instant): ReleaseBand | "beyond-today" {
  if (release.state === "discharged") {
    // A ROLLING twenty-four hours, not the calendar day. A bed discharged at 23:00 stopped counting
    // at midnight under the old comparison - an hour later, and by the calendar rather than by
    // anything a ward would recognise. The night shift reads this board at 02:00 and the beds
    // discharged on their own shift had already dropped off it.
    if (now - release.confirmedAt >= MINUTES_PER_DAY) return "beyond-today";
    return "now";
  }

  // WHICH DAY FIRST. This is the whole correction: every comparison below is against a time of day,
  // so it may only be reached once the day is known to be today. `expectedAt` is an absolute
  // instant and `MIDDAY_MINUTES` is 720 - comparing them directly is the category error that made
  // a 09:00-tomorrow discharge render as "tonight".
  const daysAhead = dayOf(release.expectedAt) - dayOf(now);
  if (daysAhead >= 2) return "beyond-today";
  if (daysAhead === 1) return "tomorrow";

  // Anything already due, or dated earlier than today, is a bed a ward can act on now. A release
  // whose expected time has simply passed is not a mistake - it is a ward that has not yet
  // confirmed - and it belongs in front of somebody rather than in an excluded count.
  if (release.expectedAt <= now) return "now";

  const timeOfDay = minuteOfDay(release.expectedAt);
  if (timeOfDay <= MIDDAY_MINUTES) return "by-midday";
  if (timeOfDay <= LATE_AFTERNOON_MINUTES) return "by-1600";
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
    if (release.state === "discharged") continue;
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
