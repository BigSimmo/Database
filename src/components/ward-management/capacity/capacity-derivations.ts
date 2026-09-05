// src/components/ward-management/capacity/capacity-derivations.ts
//
// The computation behind Ward Flow's merged Capacity screen (MERGE 02, folding `capacity` and
// `morning`). Design lock: docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md §5.
//
// ⚠️ **THIS SCREEN ANSWERS "WHERE IS THE MISMATCH", NEVER "WHERE COULD THIS PERSON GO".** An
// earlier design put a single patient's shortlist here and the owner corrected it — this file
// computes AGGREGATE supply-versus-demand only. Nothing here ranks a unit for a patient, nothing
// returns a per-patient suggestion, and nothing here imports from `ward-eligibility.ts`. If a
// future change needs a per-patient answer, that belongs on the movement/shortlist surfaces that
// already exist (`shortlistCandidates`, `eligibility`), never bolted on here.
import { dayOf } from "@/components/ward-management/ward-clock";
import type { Instant } from "@/components/ward-management/ward-clock";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Cohort, Movement, Security, Unit, BedRelease } from "@/components/ward-management/ward-model";

/**
 * The four bed kinds a coordinator actually reasons about, in the order the design lock fixes
 * them. `bedKindGaps` returns rows in exactly this order — never sorted by size of gap, so the
 * page reads the same shape every time a coordinator opens it.
 */
export type BedKindId = "locked_adult" | "open_adult" | "older_adult" | "youth";

export type BedKindGap = {
  id: BedKindId;
  /** "A locked adult bed" — the thing being counted, for the row heading. */
  need: string;
  /** "Detained, or assessed as needing one" — who this kind of bed is for, in plain words. */
  who: string;
  /** Open movements needing this kind. Never includes a closed movement — see `isOpen`. */
  waiting: number;
  /** Beds of this kind currently allocatable anywhere in the network. */
  bedsThatFit: number;
  /** `bedsThatFit - waiting`. Negative is a shortfall; the sign is the whole point of the row. */
  gap: number;
};

/**
 * A movement's cohort and security together say what kind of bed it needs. Real `COHORTS` values
 * are `"Adult" | "Older adult" | "Youth"` (`ward-model.ts`) and `Security` is `"Open" | "Secure"` —
 * six combinations, four kinds, because an older-adult or youth movement needs a bed of that age
 * group regardless of security: the ward home board never splits those two cohorts by lock state,
 * so this screen does not invent a split the rest of the app does not have.
 */
function bedKindOfMovement(cohort: Cohort, security: Security): BedKindId {
  if (cohort === "Older adult") return "older_adult";
  if (cohort === "Youth") return "youth";
  // Only "Adult" is left, and that is the one cohort this screen does split by security.
  return security === "Secure" ? "locked_adult" : "open_adult";
}

/**
 * The same split, for bed SUPPLY rather than demand. A unit's `cohort` names the age group it
 * serves; within an Adult-cohort unit, `lockedBedsFree`/`openBedsFree` (`ward-bed-designation.ts`)
 * give the two counts this screen needs without any subtraction of its own. An older-adult or
 * youth unit's whole allocatable count fits either security level of its own cohort's demand, for
 * the same reason the demand side does not split those two cohorts by security.
 *
 * ⚠️ **DELIBERATELY IGNORES `unit.authorised`.** `bedsThatFit` asks "is this bed the right KIND",
 * never "may this ward lawfully detain" — those are different facts (design lock §5.7,
 * `tests/ward-locked-not-authorised.test.ts`) and merging them here would make a shortfall
 * disappear behind a bed nobody may actually place a detained patient in.
 */
function bedsOfKindAtUnit(unit: Unit, kind: BedKindId): number {
  switch (kind) {
    case "locked_adult":
      return unit.cohort === "Adult" ? lockedBedsFree(unit) : 0;
    case "open_adult":
      return unit.cohort === "Adult" ? openBedsFree(unit) : 0;
    case "older_adult":
      return unit.cohort === "Older adult" ? lockedBedsFree(unit) + openBedsFree(unit) : 0;
    case "youth":
      return unit.cohort === "Youth" ? lockedBedsFree(unit) + openBedsFree(unit) : 0;
  }
}

const ROWS: { id: BedKindId; need: string; who: string }[] = [
  { id: "locked_adult", need: "A locked adult bed", who: "Detained, or assessed as needing one" },
  { id: "open_adult", need: "An open adult bed", who: "Not detained, and not assessed as needing a locked bed" },
  { id: "older_adult", need: "An older-adult bed", who: "Older adult, locked or open — the age group is the need" },
  { id: "youth", need: "A youth bed", who: "Youth, locked or open — the age group is the need" },
];

/** One row per bed kind, in the locked order above. */
export function bedKindGaps(movements: Movement[], units: Unit[], now: Instant): BedKindGap[] {
  // `now` is accepted for parity with every other Ward Flow derivation and because a caller
  // computing `movements`/`units` upstream typically already has it — `isOpen` itself does not
  // read a clock, and neither does this function.
  void now;

  const open = movements.filter(isOpen);

  return ROWS.map(({ id, need, who }) => {
    const waiting = open.filter((movement) => bedKindOfMovement(movement.cohort, movement.security) === id).length;
    const bedsThatFit = units.reduce((total, unit) => total + bedsOfKindAtUnit(unit, id), 0);
    return { id, need, who, waiting, bedsThatFit, gap: bedsThatFit - waiting };
  });
}

/** The "All four together" row. Sums the rows — never recomputed independently, so the total can
 *  never disagree with what is sitting above it. */
export function bedKindTotals(rows: BedKindGap[]): { waiting: number; bedsThatFit: number; gap: number } {
  return rows.reduce(
    (totals, row) => ({
      waiting: totals.waiting + row.waiting,
      bedsThatFit: totals.bedsThatFit + row.bedsThatFit,
      gap: totals.gap + row.gap,
    }),
    { waiting: 0, bedsThatFit: 0, gap: 0 },
  );
}

export type NetworkWardRow = {
  unit: Unit;
  /** Beds free and usable now — `lockedBedsFree(unit) + openBedsFree(unit)`, which the two
   *  functions' own clamping keeps equal to `unit.allocatable.value` in every case. */
  ready: number;
  /** Of `ready`, how many are locked. */
  lockedReady: number;
  /**
   * ⚠️ **DELIBERATELY `undefined`, ON EVERY ROW, AND THAT IS NOT A PLACEHOLDER.**
   *
   * "Expected to free today" is a real figure elsewhere in this codebase (`BedRelease`,
   * `releaseBand`, `capacityBreakdown` in `ward-bed-availability.ts`) but it is built from a
   * `BedRelease[]` list that is reducer state, not a fact carried on `Unit` — and this function's
   * signature, fixed by the merge's shared contract, takes only `units` and `now`. There is no
   * honest way to answer "how many will free today" from a `Unit` alone: nothing on the type
   * records a future discharge.
   *
   * Every existing per-unit derivation that answers this question (`capacityBreakdown`,
   * `unitCapacity`) takes the release list as a parameter rather than importing the fixture
   * (`bedReleases` in `ward-movements.ts`) directly — and this file does the same rather than
   * break that pattern by reaching past its own inputs for a global. Reaching for the global would
   * also silently ignore whatever `units` a caller actually passed, which defeats the point of
   * taking `units` as a parameter at all.
   *
   * Returning `undefined` here rather than `0` matters: a coordinator reading `0` believes nothing
   * is freeing today, which is a specific, false, and dangerous claim to fabricate on a capacity
   * screen. `undefined` says "not tracked on this screen" instead, and it is on the caller of this
   * function to render that as an honest absence rather than a number.
   */
  freeing: number | undefined;
  /** When the ward last confirmed its allocatable count — `unit.allocatable.confirmedAt`, the
   *  ward-sourced figure, not `unit.empty` (the feed's). */
  confirmedAt: Instant;
  /**
   * 🔴 **BEDS THAT ARE FREE BUT NOT YET USABLE — the count `ready` deliberately does NOT subtract.**
   *
   * Owner ruling 2026-09-05, after Ward Lead measured that "Ready" counted beds the application
   * itself refuses to admit a patient into: `ward-flow-reducer.ts` rejects `PULL_PATIENT` with
   * *"every free bed at X is still being made ready"*. At the seeded anchor `arm-adult-open` shows
   * Ready 2 while only 1 is pullable, because `WR-008` is discharged and still being cleaned. A
   * coordinator commits two patients and the second is refused at the moment of action, after the
   * ward has already been told.
   *
   * ⚠️ **THE RULING WAS EXPLICITLY *NOT* TO CHANGE THE NUMBER.** An earlier ruling of his avoids the
   * figure lurching as cleaning starts and stops, so `ready` stays exactly as it was and this sits
   * BESIDE it: "Ready 2 · 1 still being made ready". Do not subtract this from `ready`.
   *
   * `undefined` without `releases`, never 0 — same reasoning as `freeing` above. "Nothing is being
   * cleaned" and "we were not told" are different facts and only one of them is safe to imply.
   */
  pendingPreparation?: number;
};

/**
 * ⚠️ **`releases` IS OPTIONAL, AND `freeing` IS `undefined` WITHOUT IT — NOT ZERO.**
 *
 * "Expected to free today" is a real concept but it does NOT live on `Unit`: it lives in
 * `BedRelease[]`, which is reducer state. The first version of this function had no way to reach
 * it and correctly returned `undefined` rather than `0` — **because `0` would tell a coordinator
 * "nothing is freeing today" on a capacity screen, which is a fabricated fact in the direction that
 * causes harm.** That judgement was right and is preserved here: a caller who supplies no releases
 * still gets `undefined`, and the screen must render an absence in words rather than a figure.
 *
 * Optional rather than required so the parameter could be added without breaking a caller written
 * against the earlier signature.
 *
 * "Today" is `dayOf`, the model's own notion of which demonstration day an instant falls on. An
 * `Instant` carries no calendar date, so comparing against one would be inventing a fact the model
 * does not hold — the same reasoning `delays-screen.tsx` records for its "resolved today" panel.
 *
 * A release already `released` is not "freeing": the bed is free and is already counted in
 * `ready`. Counting it in both would double-count the same bed on the same row.
 */
export function networkWardRows(units: Unit[], now: Instant, releases?: BedRelease[]): NetworkWardRow[] {
  const freeingByUnit = new Map<string, number>();
  for (const release of releases ?? []) {
    // ⚠️ "discharged", NOT "released". The third bed state was RENAMED on 2026-08-30 because
    // "released" reads as release from detention. BED_RELEASE_STATES is ["expected", "confirmed",
    // "discharged"] — there is no "released" and no "cancelled", and I wrote both before checking.
    // A discharged bed is already free and already counted in `ready`; counting it again here
    // would double-count the same bed on the same row.
    if (release.state === "discharged") continue;
    if (dayOf(release.expectedAt) !== dayOf(now)) continue;
    freeingByUnit.set(release.unitId, (freeingByUnit.get(release.unitId) ?? 0) + 1);
  }
  return units.map((unit) => ({
    unit,
    ready: lockedBedsFree(unit) + openBedsFree(unit),
    lockedReady: lockedBedsFree(unit),
    freeing: releases === undefined ? undefined : (freeingByUnit.get(unit.id) ?? 0),
    // `bedsPendingPreparation` is the reducer's OWN helper — the same function whose result gates
    // PULL_PATIENT — so the screen and the refusal cannot disagree about which beds are still
    // being made ready.
    pendingPreparation: releases === undefined ? undefined : bedsPendingPreparation(unit.id, releases),
    confirmedAt: unit.allocatable.confirmedAt,
  }));
}

/**
 * What a ward's "freeing today" cell prints — the one place that decides it.
 *
 * ⚠️ **SPLIT OUT OF THE JSX SO ITS ABSENCE BRANCH CAN BE REACHED BY A TEST AT ALL.** Inline in the
 * cell, `row.freeing === undefined ? … : …` was only ever exercised through the fixture, and
 * `CapacityScreen` reads `bedReleases` from `useWardFlow()`, which types it `BedRelease[]` — never
 * `undefined`. So `networkWardRows` always receives releases, always returns a number, and the
 * absence branch could not run: measured 2026-09-05, 23 rows, 0 of them untracked. A branch no test
 * can reach is indistinguishable from one that does not work, and would not be missed if a refactor
 * quietly dropped it. Taking `number | undefined` as a plain argument makes both answers directly
 * constructible.
 *
 * 🔴 **A NUMBER IS PRINTED WHENEVER THERE IS ONE, INCLUDING ZERO.** `0` and `undefined` are the two
 * different facts this whole field exists to keep apart (see `NetworkWardRow.freeing`): `0` is a
 * ward that reports and has nothing freeing today, `undefined` is a ward that does not report. A
 * `?? 0` anywhere on this path collapses the second into the first and tells a coordinator
 * something false with total confidence.
 *
 * The words themselves are ordinary copy, not ward vocabulary — a redesign may reword them. What
 * must survive any rewording is the PROPERTY, which is what the tests assert: the absence reads as
 * a sentence and never as a figure.
 */
export function freeingCellText(freeing: number | undefined): string {
  return freeing === undefined ? "Not tracked here" : String(freeing);
}

/**
 * 🔴 **THE RELEASES THIS BOARD DOES NOT SHOW, COUNTED — because dropping them in silence is the
 * one thing the retired capacity board's own test forbade.**
 *
 * `networkWardRows` above counts a release into `freeing` only when `dayOf(release.expectedAt)`
 * is today. A bed genuinely expected to free the day after tomorrow is therefore left out of every
 * figure on this screen, correctly — "freeing today" must not quietly include tomorrow — **but
 * being left out of a figure is not the same as being unmentioned.** The board this screen replaced
 * surfaced the excluded count, and `ward-capacity-view.dom.test.tsx` pinned the rule in as many
 * words: *"a release beyond the horizon must be counted and shown, never quietly omitted."* That
 * pin had been standing over an unreachable mode since MERGE 02.
 *
 * ⚠️ **`discharged` IS EXCLUDED HERE FOR THE SAME REASON IT IS EXCLUDED ABOVE, AND NOT BECAUSE IT
 * IS BEYOND THE HORIZON.** A discharged bed is already free and already counted in `ready`;
 * counting it as "expected later" would be a second claim about the same bed. The two exclusions
 * look alike in the code and mean opposite things — one bed is not here yet, the other already
 * arrived — so they are two statements rather than one combined condition.
 *
 * Returns a plain number and not `undefined`: unlike `freeing`, a caller that hands over the
 * releases has genuinely been told, so nought excluded is a fact rather than an absence.
 */
export function releasesBeyondToday(releases: BedRelease[], now: Instant): number {
  return releases.filter((release) => release.state !== "discharged" && dayOf(release.expectedAt) !== dayOf(now))
    .length;
}

export function networkTotals(rows: NetworkWardRow[]): {
  wards: number;
  beds: number;
  ready: number;
  /** Summed only over rows that HAVE a figure; `undefined` when none does, never a misleading 0. */
  pendingPreparation?: number;
} {
  const tracked = rows.map((row) => row.pendingPreparation).filter((value): value is number => value !== undefined);
  return rows.reduce(
    (totals, row) => ({
      ...totals,
      wards: totals.wards + 1,
      beds: totals.beds + row.unit.beds,
      ready: totals.ready + row.ready,
    }),
    {
      wards: 0,
      beds: 0,
      ready: 0,
      pendingPreparation: tracked.length === 0 ? undefined : tracked.reduce((sum, value) => sum + value, 0),
    },
  );
}
