import { dayOf, minuteOfDay, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
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
 * AN OPEN OWNER DECISION, NAMED HERE SO IT CANNOT BE MISTAKEN FOR A SETTLED ONE.
 *
 * He was asked what a discharge expected TOMORROW should be called, and deferred it with his other
 * open questions: *"Do your best for now to build what's there knowing that it is liable to
 * change."* So the current answer is below, and it is provisional:
 *
 *   **Anything on a later day is `"beyond-today"` and is excluded, exactly as before.**
 *
 * That is the PRE-EXISTING behaviour, chosen deliberately over inventing a `"tomorrow"` band. A
 * placeholder that looks like a decision is worse than an unchanged one: the next reader finds a
 * plausible band, assumes somebody chose it, and builds on it.
 *
 * **It is also the correction to my own recommendation.** I recommended adding a `"tomorrow"`
 * band — a VALUE answer to a SHAPE problem. The arithmetic could not survive a day boundary at
 * all, so the new member would have become the bucket for everything the arithmetic mishandled,
 * and it would have looked like a decision. When a fix is a new value and the defect is in the
 * shape, the fix hides the defect.
 *
 * **What changes when he answers, one place each:** `RELEASE_BANDS` gains a member and every
 * screen rendering a band label needs wording for it; `releaseBand`'s day comparison stops
 * short-circuiting; and DB-7's rolling horizon replaces the 22:00 cutoff, which raises the morning
 * page's predicted count and owes that page a stated notice.
 *
 * `tests/ward-release-band-day-boundary.test.ts` asserts the current answer BY NAME, so deciding it
 * is not a search — and a search cannot prove it found everything.
 */
export const TOMORROW_BAND_UNRESOLVED =
  "Owner deferred 2026-08-30: what a discharge expected tomorrow is called. Current answer is the " +
  "unchanged one — a later day is beyond-today and excluded. See RELEASE_BANDS and releaseBand.";

export const RELEASE_BANDS = ["now", "by-midday", "by-1600", "tonight"] as const;
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
 * **The horizon is deliberately unchanged and no count on any screen moves.** A later day is still
 * `"beyond-today"`, and a discharge after 22:00 today is still `"beyond-today"`. DB-7 — a rolling
 * 24 hours, and what to call a discharge expected tomorrow — is a separate change that RAISES the
 * morning page's predicted count and owes that page a stated notice in the same commit. See
 * `TOMORROW_BAND_UNRESOLVED` below.
 */
export function releaseBand(release: BedRelease, now: Instant): ReleaseBand | "beyond-today" {
  if (release.state === "discharged") {
    // RELEASE_BED restates confirmedAt to the release instant. "Discharged today" is this
    // operating day only: advancing the demo clock across midnight must drop yesterday's
    // released rows into the same beyond-today exclusion the discharge board already states
    // at its foot. Same-day released beds stay "now" even when expectedAt was later today.
    if (Math.floor(release.confirmedAt / MINUTES_PER_DAY) !== Math.floor(now / MINUTES_PER_DAY)) {
      return "beyond-today";
    }
    return "now";
  }
  // WHICH DAY, first and short-circuiting. A later day never reaches the minute comparisons below,
  // which is what stops a discharge a full day out wrapping back into an earlier band.
  if (dayOf(release.expectedAt) > dayOf(now)) return "beyond-today";
  // WHICH PART OF THIS DAY. `minuteOfDay` rather than the raw instant, so the same clock time
  // bands the same way whatever day the demonstration has reached.
  const minute = minuteOfDay(release.expectedAt);
  // BEFORE the `<= now` test, and the order is load-bearing rather than stylistic. The original
  // put the evening cutoff first, so a release reported at 23:22 is "beyond-today" and NOT "now"
  // even though its instant has already passed. Putting `<= now` above this reversed that and
  // turned an excluded release into an available bed — caught by `ward-capacity-view.dom.test.tsx`,
  // which advances the clock to 1342 and flags a release there. This rewrite changes WHICH BAND a
  // release falls in across a day boundary, and must change no count on any screen.
  if (minute > EVENING_SHIFT_END_MINUTES) return "beyond-today";
  if (release.expectedAt <= now) return "now";
  if (minute <= MIDDAY_MINUTES) return "by-midday";
  if (minute <= LATE_AFTERNOON_MINUTES) return "by-1600";
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
