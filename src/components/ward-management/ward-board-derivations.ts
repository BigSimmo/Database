import { admissionsForUnit, bedIsOccupied, type Admission } from "@/components/ward-management/ward-admissions";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import {
  HOME_REGIONS,
  SEXES,
  type BedRelease,
  type HomeRegion,
  type LeaveBed,
  type Referral,
  type Sex,
  type Unit,
} from "@/components/ward-management/ward-model";

/**
 * The figures at the top of one ward's board.
 *
 * The board leads with ONE number — beds you can fill today — and immediately under it ONE
 * sentence naming what stops that number being true. On a real psychiatric ward the commonest
 * reason a bed is not a bed is the sex mix, and the second is having nobody free to watch someone
 * one-to-one, so those are the two things the sentence names.
 *
 * Pure functions only: no React, no state, no I/O, and no wall-clock read — `now` always arrives
 * as a parameter, the same discipline every other module in this feature holds to.
 *
 * Three rules govern this file, each written out at the function it governs:
 *
 *   1. **Every bed dimension is "does this bed ACCEPT this person", never an equality.** This is
 *      the longest comment in the file, on `bedAcceptsSex` below, because it is the single most
 *      likely way this module ships a serious bug.
 *   2. **The available figure is READ, never re-derived.** It comes out of `capacityBreakdown`
 *      (`ward-bed-availability.ts`) and nothing here does bed arithmetic of its own. A second
 *      copy of that sum is how two screens come to disagree about the one number a coordinator
 *      acts on.
 *   3. **One function decides "accepts", and the sentence is built FROM it.** `constraintSentence`
 *      takes every number it prints out of `acceptingBedCounts`' return value. It never re-counts
 *      in parallel, however obviously the parallel version would agree today.
 */

/**
 * How far ahead the board looks for people heading home, in whole days.
 *
 * A DISPLAY WINDOW for a ward board and nothing else. It is not a target, not a threshold, not a
 * clinical figure, and above all NOT a figure from the Mental Health Act — nothing in this file
 * has any legal meaning whatsoever. It is here as a named constant rather than a literal so that
 * the one place it could be misread is the one place it is written down.
 */
export const ARROW_HORIZON_DAYS = 7;

/** The name of the gate in the shared eligibility verdict that answers the accepts-question for
 *  sex. Written once so the lookup below and its non-vacuity test cannot drift apart. */
const SEX_DESIGNATION_GATE = "sex_designation";

/**
 * Whether a free bed on this unit may hold a person of `sex`.
 *
 * **THIS IS AN ACCEPTS-RULE AND MUST NEVER BECOME AN EQUALITY.** `Unit.sexDesignation` is
 * `"Undesignated" | "Female only" | "Male only"`, and `"Undesignated"` — the normal case and the
 * clear majority of the seeded network — accepts a person of EITHER sex. Writing
 * `unit.sexDesignation === sex` looks entirely reasonable in review: two fields, both about sex,
 * compared. It is wrong, and it is wrong silently, because it excludes every undesignated bed —
 * most of the network — while still returning `true` for the handful of designated ones, so a
 * test that merely searched for "a bed that accepts a man" would still find one and pass. The
 * same shape applies to `Unit.authorised`: an authorised bed accepts both voluntary and
 * involuntary admissions, so it is a CAPABILITY the bed has, never a value to match against.
 *
 * The rule itself is deliberately NOT written here. `ward-eligibility.ts` already decides
 * "does this bed accept this person" for every dimension, and its `sex_designation` gate is that
 * decision for this one. Two components each deciding what "accepts" means is how this project
 * ended up with three screens holding one label and two of them disagreeing — so this function
 * asks the existing verdict and reads its answer, rather than restating the rule in a second
 * place that would then have to be kept in step by hand.
 *
 * The unit handed to the verdict carries `sexMix` DERIVED from the people actually in the beds
 * (`derivedSexMix`), never the hand-maintained count on `Unit`. Only the `sex_designation` gate is
 * read today and that gate does not look at `sexMix` at all — but feeding the verdict the derived
 * truth means that widening which gates are read later cannot silently reintroduce a stale
 * hand-maintained number, which is exactly the failure this whole task exists to remove.
 *
 * Only the gates whose answer DEPENDS ON THE PERSON'S SEX are read. `sex_mix` is deliberately not
 * one of them: it asks whether the ward would place a lone person of a sex given how many beds
 * are free, which is a judgement about the ward's composition rather than a property of the bed,
 * and folding it in would make "how many beds accept a man" depend on the free-bed total through
 * a threshold — a count that changes when an unrelated bed frees up. Every other gate (age,
 * security, forensic, freshness, allocatable) is sex-independent and belongs to the headline
 * number, not to the split beneath it. See the flag in this task's report.
 *
 * Fails CLOSED: if the gate cannot be found — it was renamed, or the verdict shape changed — this
 * returns `false`, so the board understates what it can offer rather than promising a bed it has
 * not checked. `tests/ward-board-derivations.test.ts` pins the gate's existence so that failure
 * mode announces itself instead of quietly zeroing the board.
 */
function bedAcceptsSex(unit: Unit, sex: Sex, admissions: readonly Admission[], now: Instant): boolean {
  const probe: Referral = {
    id: `board-probe-${unit.id}-${sex}`,
    // The probe is a QUESTION, not a person: it is constructed here, read by one pure function,
    // and discarded. It is never stored, never rendered, and never derived from anybody. Every
    // field other than `sex` is set to a neutral value that the sex gate does not read, so the
    // gate's answer is a fact about the bed alone.
    //
    // Typed `WardReferral` rather than `Referral` because it asks a question only a ward can be
    // asked: whether a BED accepts this sex. The type now says so.
    ageBand: unit.cohort,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex,
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
        },
        state: "queued",
      },
    ],
    homeRegion: HOME_REGIONS[0],
    source: "community",
    raisedAt: now,
    urgency: 2,
    originSiteCode: unit.siteCode,
    transportNeeded: false,
  };
  const probeWard = probe.destinations[0].destination;
  if (probeWard.kind !== "psychiatric_ward") throw new Error("the board probe must be a ward question");
  const unitWithDerivedMix: Unit = { ...unit, sexMix: derivedSexMix(admissions, unit.id) };
  const gate = referralEligibility(probe, probeWard, unitWithDerivedMix, now).gates.find(
    (candidate) => candidate.gate === SEX_DESIGNATION_GATE,
  );
  return gate?.pass ?? false;
}

/**
 * The one number the board leads with: beds this ward can fill right now.
 *
 * **Read from `capacityBreakdown`, never re-derived.** That module is the single place the
 * available figure is computed — `min(allocatable, empty)`, with nothing expected, confirmed but
 * unreleased, or on leave ever added in, and nothing subtracted for a bed being cleaned. Doing
 * the arithmetic again here would produce a second answer to the question a coordinator points at
 * and acts on, and the two copies would diverge the first time one of them was corrected.
 *
 * Degrades to `0`, never to a guess. A unit whose figures cannot be resolved — a non-finite or
 * negative capacity value — yields no answer rather than a substituted fallback, because a board
 * that invents a bed sends someone to a ward that has none. Zero reads on screen as "no bed here
 * right now", which is the conservative direction; a fabricated 3 does not.
 *
 * `admissions` is accepted for signature symmetry with the rest of this module and is not read:
 * occupancy already reached the availability figures through the ward's own `empty` count, and
 * subtracting admissions again here would double-count every person in a bed.
 */
export function headlineAvailable(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  leaveBeds: readonly LeaveBed[],
  now: Instant,
): number {
  void admissions;
  const { availableNow } = capacityBreakdown(unit, [...bedReleases], [...leaveBeds], now);
  if (!Number.isFinite(availableNow) || availableNow <= 0) return 0;
  return Math.floor(availableNow);
}

export type AcceptingBedCounts = {
  /** Free beds that may hold a woman. */
  forFemale: number;
  /** Free beds that may hold a man. */
  forMale: number;
  /** How many of those free beds could be watched one-to-one, given what the ward can still
   *  staff. */
  specialled: number;
};

/**
 * How many of the currently-free beds accept a woman, how many accept a man, and how many
 * one-to-one observations the ward can still staff.
 *
 * **This is the ONE function that decides what "accepts" means for the board.** Both surfaces that
 * show these figures — the headline sentence and the bed grid — call it. "How many of these beds
 * accept this person" is a VERDICT, not arithmetic, and two components each computing their own
 * version is how this project ended up with three screens holding one label and two of them
 * disagreeing. If a third surface needs the same figures it calls this; it does not re-count.
 *
 * The two sex counts are all-or-nothing today because a designation is a fact about the whole
 * unit rather than about an individual bed — a `"Male only"` ward with four free beds reports
 * `forFemale: 0, forMale: 4`. They are still counts rather than booleans, so the sentence beneath
 * the headline can say how many beds are actually left, and so that a future per-bed designation
 * changes only the inside of this function.
 *
 * `specialled` is capped at the free-bed total. The ward may be able to staff six one-to-one
 * observations while having three beds free; reporting six would be a promise of three beds that
 * do not exist. A negative or non-finite `speciallingCapacity` reads as zero — no answer rather
 * than a guess, the same conservative direction `headlineAvailable` takes.
 */
export function acceptingBedCounts(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  leaveBeds: readonly LeaveBed[],
  now: Instant,
): AcceptingBedCounts {
  const free = headlineAvailable(unit, admissions, bedReleases, leaveBeds, now);
  const capacity = unit.speciallingCapacity;
  const staffable = Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : 0;

  return {
    forFemale: bedAcceptsSex(unit, "Female", admissions, now) ? free : 0,
    forMale: bedAcceptsSex(unit, "Male", admissions, now) ? free : 0,
    specialled: Math.min(free, staffable),
  };
}

/** "None" rather than "Only 0". A sentence that says "Only 0 will take a man" reads as a
 *  formatting accident and invites a reader to wonder whether the figure is real. */
function countPhrase(count: number): string {
  return count === 0 ? "None" : `Only ${count}`;
}

/**
 * The sentence under the headline, naming what stops the headline number being true.
 *
 * **Every number in it comes out of `acceptingBedCounts`.** It never re-counts in parallel, even
 * where the parallel version would obviously agree today: the point is structural, not arithmetic
 * — two counts that agree now are two counts that can stop agreeing later, one edit at a time,
 * with nothing failing in between. The free-bed total it compares against is
 * `headlineAvailable`, which is the same figure the headline itself prints and the same figure
 * `acceptingBedCounts` divides up, so the sentence cannot disagree with the number it sits under.
 *
 * Returns `null` — never an empty string — when there is nothing constraining. An empty string
 * renders as a blank line under the headline, which reads as a sentence that failed to load
 * rather than as an absence of constraint. `null` makes the caller decide to render nothing.
 *
 * Also returns `null` when there is no bed to qualify. With zero fillable beds there is nothing
 * for a constraint to reduce, and "None will take a man" beneath a headline of zero would state a
 * restriction the ward does not actually have. A sentence must never claim a constraint that
 * does not exist.
 *
 * Sex leads, specialling follows, because that is the order these two bite on a real ward.
 */
export function constraintSentence(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  leaveBeds: readonly LeaveBed[],
  now: Instant,
): string | null {
  const free = headlineAvailable(unit, admissions, bedReleases, leaveBeds, now);
  if (free <= 0) return null;

  const counts = acceptingBedCounts(unit, admissions, bedReleases, leaveBeds, now);
  const clauses: string[] = [];

  if (counts.forFemale < free) clauses.push(`${countPhrase(counts.forFemale)} will take a woman.`);
  if (counts.forMale < free) clauses.push(`${countPhrase(counts.forMale)} will take a man.`);
  if (counts.specialled < free) clauses.push(`${countPhrase(counts.specialled)} can be watched one-to-one.`);

  return clauses.length > 0 ? clauses.join(" ") : null;
}

export type SinceYesterday = {
  /** Admissions that ENDED in the last day, whatever the destination. */
  discharged: number;
  /** Beds given away in the last day. */
  pulled: number;
  /** Admissions whose expected discharge date was moved in the last day. */
  datesMoved: number;
};

/**
 * Orientation for someone opening a ward they do not know: what changed here since yesterday.
 *
 * "Since yesterday" is the last whole day — `now - MINUTES_PER_DAY` exclusive to `now` inclusive.
 * A day, not a threshold: it carries no clinical or legal meaning and is simply the window a
 * ward board covers between one morning and the next.
 *
 * **`discharged` counts departures of every destination, and is a WARD figure, never a network
 * one.** A transfer to another psychiatric ward gives this ward its bed back and gives the state
 * nothing at all — the person still occupies a psychiatric bed somewhere. `LEAVING_DESTINATIONS`
 * carries that distinction as `countsAsStatewideRelease`, and any statewide figure must read it.
 * This number must never be summed across wards and presented as beds returned to the network.
 *
 * **`datesMoved` counts ADMISSIONS, not revisions**, and it is a count of changes to the WARD'S
 * OWN PLAN — never a measure of anybody. The record holds `dischargeDateMoves` (how many times in
 * total) and `dischargeDateSetAt` (when the CURRENT date was set), so a second move inside the
 * same day is invisible to it: only the latest set instant survives. Counting the moves total
 * instead would count revisions made weeks ago as though they happened last night, which is
 * worse. Reported as a gap rather than papered over.
 *
 * This function does NOT filter by unit — it counts whatever it is given. It deliberately cannot
 * use `admissionsForUnit`, which drops departed admissions and would therefore make `discharged`
 * permanently zero. A caller wanting one ward filters by `unitId` first, keeping departures in.
 */
export function sinceYesterday(admissions: readonly Admission[], now: Instant): SinceYesterday {
  if (!Number.isFinite(now)) return { discharged: 0, pulled: 0, datesMoved: 0 };
  const windowStart = now - MINUTES_PER_DAY;
  const inWindow = (at: Instant | null): boolean => at !== null && Number.isFinite(at) && at > windowStart && at <= now;

  let discharged = 0;
  let pulled = 0;
  let datesMoved = 0;

  for (const admission of admissions) {
    if (admission.state === "left" && inWindow(admission.leftAt)) discharged += 1;
    if (inWindow(admission.pulledAt)) pulled += 1;
    if (admission.dischargeDateMoves > 0 && inWindow(admission.dischargeDateSetAt)) datesMoved += 1;
  }

  return { discharged, pulled, datesMoved };
}

export type ArrowTarget = {
  region: HomeRegion;
  /** How many people in beds here are expected to head to that region within the horizon. */
  count: number;
  /** Whole days until the nearest of them is expected to leave. Zero for anyone already past the
   *  ward's own expected date. */
  nearestDays: number;
};

/**
 * Where the people currently in these beds are expected to go, and how soon — grouped by home
 * region, nearest first.
 *
 * Scoped to expected discharges inside `ARROW_HORIZON_DAYS`, which is what keeps this a short,
 * readable list: typically three to six entries on a twenty-bed ward rather than twenty. A board
 * that listed every occupant would be a bed list, not a plan for the week.
 *
 * Counts only people actually holding a bed (`bedIsOccupied`, which includes `"pulled"` — the bed
 * is given away at the pull, not at the arrival). Someone waitlisted holds nothing here yet and
 * someone who has left is already gone; neither is heading home FROM one of these beds.
 *
 * An admission already past the ward's own expected date is INCLUDED, with `nearestDays: 0`. It
 * is the most imminent case on the board, not an expired one, and dropping it would quietly hide
 * exactly the people a flow meeting exists to discuss. Zero is a floor, never a negative day
 * count — but note it says "due now or overdue" and nothing about how overdue, and nothing
 * anywhere in this module treats a passed date as a breach of anything.
 *
 * `expectedDischargeAt` is the ward's own revisable plan and carries no legal or contractual
 * weight whatsoever. An admission with no expected date is omitted entirely rather than
 * defaulted: nobody has said when this person is expected to leave, so the board says nothing.
 *
 * Ordering is total and deterministic — nearest day, then the larger group, then the fixed
 * `HOME_REGIONS` order — so the list does not reshuffle between renders on a tie.
 */
export function arrowTargets(admissions: readonly Admission[], now: Instant): ArrowTarget[] {
  if (!Number.isFinite(now)) return [];
  const buckets = new Map<HomeRegion, { count: number; nearestDays: number }>();

  for (const admission of admissions) {
    if (!bedIsOccupied(admission)) continue;
    const expected = admission.expectedDischargeAt;
    if (expected === null || !Number.isFinite(expected)) continue;

    const days = Math.max(0, Math.floor((expected - now) / MINUTES_PER_DAY));
    if (days > ARROW_HORIZON_DAYS) continue;

    // Task 17, 2026-08-30: an admission created by an ARRIVAL through the emergency-department
    // pathway records no home region yet - the fact does not exist on a movement, and the owner has
    // an open ruling on whether suburb or region is the thing actually recorded. Skipping it here
    // is the honest reading: this map answers "how many people are in a bed far from a named home
    // region", and somebody with no recorded region is not evidence for or against any region.
    //
    // It is a SKIP, not a silent drop. Nothing here invents a region, and the arrivals still appear
    // on the ward's own board as occupants; they are absent only from a figure that is about
    // regions. When the ruling lands this branch goes.
    if (admission.homeRegion === null) continue;

    const bucket = buckets.get(admission.homeRegion);
    if (bucket === undefined) buckets.set(admission.homeRegion, { count: 1, nearestDays: days });
    else {
      bucket.count += 1;
      bucket.nearestDays = Math.min(bucket.nearestDays, days);
    }
  }

  return [...buckets.entries()]
    .map(([region, bucket]) => ({ region, count: bucket.count, nearestDays: bucket.nearestDays }))
    .sort(
      (a, b) =>
        a.nearestDays - b.nearestDays ||
        b.count - a.count ||
        HOME_REGIONS.indexOf(a.region) - HOME_REGIONS.indexOf(b.region),
    );
}

/**
 * Who is actually in the beds on this unit, by sex.
 *
 * **This replaces the hand-maintained `Unit.sexMix`, and that replacement is the point.** A count
 * a ward types in is a number nothing derives and nothing can check: it can disagree with the
 * ward's own occupancy indefinitely, and no test, type change or gate can reach it — which is
 * this repository's most reliable way to ship a silent failure. Derived from the admissions
 * themselves, the mix cannot drift from the people in the beds, because there is no second copy
 * to drift.
 *
 * Counts only admissions holding a bed, via `bedIsOccupied` — and that INCLUDES `"pulled"`. The
 * ward gave the bed away at the pull; the person may still be in an emergency department awaiting
 * transport, so `arrivedAt` is null and the bed reads as empty to anyone checking arrival. It is
 * not empty, and a mix that ignored pulls would understate exactly the beds most at risk of being
 * offered to a second person.
 *
 * Always returns a TOTAL record over `SEXES`, so a sex nobody on the ward is comes back as an
 * explicit `0` rather than `undefined`. A caller reading a missing key as a falsy zero works by
 * accident; this works by construction.
 */
export function derivedSexMix(admissions: readonly Admission[], unitId: string): Record<Sex, number> {
  const mix = Object.fromEntries(SEXES.map((sex) => [sex, 0])) as Record<Sex, number>;
  for (const admission of admissionsForUnit(admissions, unitId)) {
    if (bedIsOccupied(admission)) mix[admission.sex] += 1;
  }
  return mix;
}
