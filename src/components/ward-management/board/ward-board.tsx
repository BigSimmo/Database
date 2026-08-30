"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  isPastExpectedDischarge,
  stayBand,
  STAY_BANDS,
  type Admission,
  type StayBandId,
} from "@/components/ward-management/ward-admissions";
import { tentativeDiagnosisPhrase } from "@/components/ward-management/ward-diagnosis";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { capacityBreakdown, releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import {
  ARROW_HORIZON_DAYS,
  arrowTargets,
  constraintSentence,
  headlineAvailable,
  sinceYesterday,
} from "@/components/ward-management/ward-board-derivations";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { derivedBedReleases } from "@/components/ward-management/ward-discharge-dates";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { BedRelease, HomeRegion, Sex, Site, Unit } from "@/components/ward-management/ward-model";
import { CAPACITY_FIGURE_LABELS } from "@/components/ward-management/ward-morning-rollup";
import { wardSites } from "@/components/ward-management/ward-sites";
import { teamForRegion } from "@/components/ward-management/ward-teams";

import { asAtStamp, WardDailySheet } from "./ward-daily-sheet";

import styles from "./board.module.css";

/**
 * The ward board, first pass: one ward's beds on a screen.
 *
 * **The deliverable is the rendered page, not the test.** This pass is deliberately the ugly
 * version — one component, one stylesheet, no decomposition — because every defect that has
 * reached a screen in this feature was found by rendering it and looking, and none of them were
 * found by a test. Polish is a later pass; being LOOKABLE is this one.
 *
 * Three rules govern what is below, each of which this prototype has broken before:
 *
 *   1. **Colour never carries a fact alone.** The stay band sets a fill shade, and the day count
 *      is printed on the same tile in text. The number IS the band (the bands are ranges of that
 *      one number), so a greyscale print, a colour-blind reader, or forced-colors mode loses
 *      nothing. The same applies to the past-expected-date marker: a heavy outline AND the words
 *      "past date".
 *   2. **A pulled-but-not-arrived bed is OCCUPIED.** The ward gave the bed away at the pull; the
 *      person may still be in an emergency department. `bedIsOccupied` already says so and this
 *      component must never re-decide it — such a tile renders as taken, reading "empty, waiting"
 *      instead of a day count, and is never drawn as a free bed.
 *   3. **No figure from the Mental Health Act, and no free text about anybody.** Every word on a
 *      tile comes from `STAY_BANDS` (the product owner's four, verbatim) or from a day count.
 *      Nothing here is a threshold, a target, or a legal clock.
 *
 * It reads the synthetic seed directly rather than the shared ward-flow provider: this is a
 * read-only design-scratch board over the frozen fixture, and `WARD_ADMISSIONS_ANCHOR` is the
 * instant that fixture is authored against, so every stay length is the one the seed intends.
 * A live board would take `now`, `units` and the admissions from the provider instead.
 */

/** The four band fills, in `STAY_BANDS` order. One hue, four deepening steps — see the
 *  `--wb-band-*` tokens in `board.module.css`. Keyed by band id rather than by array index so a
 *  reordering of `STAY_BANDS` cannot silently re-map a shade onto the wrong band. */
const BAND_CLASS: Record<StayBandId, string> = {
  "under-2-weeks": styles.band1,
  "2-weeks-1-month": styles.band2,
  "1-3-months": styles.band3,
  "over-3-months": styles.band4,
};

type Tile =
  | {
      kind: "occupied";
      key: string;
      days: number;
      bandId: StayBandId | null;
      bandLabel: string;
      pastDate: boolean;
      /**
       * Whether this person is currently at an emergency department. **On the TILE, not only in
       * the person panel** — added 2026-08-30 after looking at the rendered board, where the panel
       * carrying this marker is `display: none` at desktop width. The marker existed, every
       * assertion passed, and a charge nurse scanning the grid saw nothing: jsdom applies no
       * stylesheet, so a DOM query finds an element CSS has hidden.
       *
       * The grid is what a ward reads. A fact that only appears once somebody clicks the right
       * bed is not on the board.
       */
      awayAtEd: boolean;
    }
  | { kind: "waiting"; key: string }
  | { kind: "blocked"; key: string }
  | { kind: "held"; key: string }
  | { kind: "empty"; key: string };

/** Where a unit's own record lives. Resolved by walking `wardSites` rather than through
 *  `unitById`, which `tests/ward-flow-single-source.test.ts` restricts to three named fixture
 *  files. Returns `undefined` for an unknown id and never falls back to a different ward. */
function findUnit(unitId: string): { unit: Unit; site: Site } | undefined {
  for (const site of wardSites) {
    const unit = site.units.find((candidate) => candidate.id === unitId);
    if (unit !== undefined) return { unit, site };
  }
  return undefined;
}

/**
 * One tile per bed, in `unit.beds` of them.
 *
 * A unit's beds divide into FOUR: **occupied** (including pulled — the ward gave the bed away and
 * the person may still be in an emergency department), **blocked** (out of service), **held**
 * (physically empty, but not yet confirmed as one the ward will actually offer), and **available**
 * — drawn on screen as the plain "empty" tile, because that is the bed a coordinator can fill
 * right now. Tiles are laid out occupied, then blocked, then held, then available, and
 * `occupied + blocked + held + available === unit.beds`.
 *
 * **The blocked tiles are the fix for a defect found by rendering this page and looking at it.**
 * The first pass knew only occupied and empty, so it drew `beds − occupied` empty tiles and every
 * out-of-service bed appeared as one a coordinator could fill. On `fsh-adult-secure` that put four
 * fillable-looking tiles under a header saying three beds free — both figures correct, and the
 * board contradicting itself on screen. No test caught it; `tests/ward-board-consistency.test.ts`
 * was written afterwards and pins the arithmetic across all 23 units.
 *
 * **The held tiles are the same class of fix, for a different unit.** On `rph-adult-secure` the
 * header already said "1 bed you can fill today" (`headlineAvailable`, `min(allocatable, empty)`
 * = `min(1, 2)`), but the first pass still drew BOTH physically-empty beds as plain "Empty" tiles —
 * the header and the grid disagreeing about how many beds a coordinator can actually take someone
 * to. **Held is not invented here**: `unitCapacity` (`ward-derivations.ts`) already partitions
 * every unit into `available + held + blocked + occupied === unit.beds`, and is the same function
 * `ward-screen.tsx` and `flow-diagram.tsx` read for their own "Held" figure — this board reads its
 * `held` count rather than re-deriving a second, possibly-drifting version of the same split.
 *
 * **Which tile is blocked or held is NOT knowable and is not invented.** `Unit.blocked` is a COUNT
 * and `unitCapacity`'s `held` is derived from two more counts (`unit.allocatable.value`,
 * `unit.empty.value`) — the model holds no per-bed record and no admission carries a bed number —
 * so these are drawn purely because they have to be drawn somewhere. The claim being made on
 * screen is "this many of this ward's beds are out of service" / "this many are empty but not yet
 * offered", which is exactly what the data supports, and nothing on either tile identifies a
 * particular bed. That is the same discipline the tiles already hold for bed numbering: `unit.beds`
 * tiles in a grid, none of them a bed anybody could name.
 *
 * The tiles carry NO bed identity: an `Admission` records the unit, never a bed number, so
 * numbering these "Bed 1..20" would invent an identity nothing in the model holds and a ward would
 * read it as real. They are a count of beds, in a grid, and nothing more.
 *
 * If a unit somehow holds more occupants than it has beds, every occupant is still drawn — the
 * over-count is the fact worth seeing, and truncating the list to `unit.beds` would hide exactly
 * the people a double-allocation put there. The blocked tiles are drawn in that case too: beds out
 * of service do not stop being out of service because the ward is over-full, and the held/available
 * counts floor at zero rather than going negative and cancelling them out.
 */
function buildTiles(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  now: Instant,
): Tile[] {
  const occupants = admissionsForUnit(admissions, unit.id).filter(bedIsOccupied);

  const tiles: Tile[] = occupants.map((admission) => {
    const days = daysInBed(admission, now);
    // Rule 2. `daysInBed` is null for a pulled bed nobody has reached yet — the bed is gone, the
    // stay has not started. Never an empty tile, and never a zero-day stay.
    if (days === null) return { kind: "waiting", key: admission.id };
    const band = stayBand(admission, now);
    return {
      kind: "occupied",
      key: admission.id,
      days,
      bandId: band?.id ?? null,
      bandLabel: band?.label ?? "Stay not banded",
      pastDate: isPastExpectedDischarge(admission, now),
      awayAtEd: admission.awayAtEmergencyDepartmentSince !== null,
    };
  });

  // Guarded against a negative or non-integer count in the fixture rather than trusted: a bad
  // `blocked` would otherwise either throw the loop or silently draw nothing.
  const blockedCount = Math.max(0, Math.floor(unit.blocked));
  for (let index = 0; index < blockedCount; index += 1) {
    tiles.push({ kind: "blocked", key: `blocked-${index}` });
  }

  // Derived by subtraction, NOT read from `unit.empty.value`. The two agree on every seeded unit
  // (that is what the consistency test pins), but the tiles must add up to the beds even if a
  // future feed disagrees with itself — a grid that silently drew a different number of tiles
  // than the ward has beds is a worse failure than one that shows the shortfall as empty.
  const emptyPoolCount = Math.max(0, unit.beds - occupants.length - blockedCount);

  // `unitCapacity`'s `held` comes from `unit.allocatable.value`/`unit.empty.value` directly, not
  // from this function's own admissions-derived `emptyPoolCount` above — so it is clamped into
  // that pool exactly as `blockedCount` already is, in case a future feed disagrees with itself.
  // A held count that overshot the physically-empty pool would otherwise draw more tiles than the
  // ward has beds, which is the same failure class `blockedCount`'s own guard exists to prevent.
  const heldCount = Math.max(0, Math.min(Math.floor(unitCapacity(unit, [...bedReleases]).held), emptyPoolCount));
  for (let index = 0; index < heldCount; index += 1) {
    tiles.push({ kind: "held", key: `held-${index}` });
  }

  const emptyCount = Math.max(0, emptyPoolCount - heldCount);
  for (let index = 0; index < emptyCount; index += 1) {
    tiles.push({ kind: "empty", key: `empty-${index}` });
  }
  return tiles;
}

/**
 * One person in one of this ward's beds, as the right-hand panel states them.
 *
 * Every field is copied from the `Admission` or derived from it by an existing helper. Nothing
 * here is looked up, defaulted, or filled in: an absent fact arrives as `null` and is RENDERED as
 * absent, which is the same discipline `isPastExpectedDischarge` and `derivedBedReleases` already
 * hold to a few files away.
 */
type Occupant = {
  key: string;
  /** Whole days in the bed, or `null` for a bed given away to somebody who has not arrived. */
  days: number | null;
  /** The stay band's own label, or `null` when there is no stay to band. */
  bandLabel: string | null;
  pastDate: boolean;
  sex: Sex;
  /** `null` for an admission created by an ED arrival: Task 17, 2026-08-30. The fact does not
   *  exist on a movement and the owner has an open ruling on whether suburb or region is recorded,
   *  so the board says so rather than guessing or hiding the person. */
  homeRegion: HomeRegion | null;
  /**
   * The tentative diagnosis AS IT READS — words and block code together, from
   * `tentativeDiagnosisPhrase` — or `null` where the record holds none.
   *
   * Carried already-phrased rather than as the bare code, so this component never assembles its own
   * wording and the one renderer in `ward-admissions.ts` is the only place a block turns into a
   * sentence. A bare "F30–F39" on a ward board would be a string a reader cannot check.
   */
  tentativeDiagnosis: string | null;
  /**
   * Whole hours this person has been away at an emergency department, or `null` while they are on
   * the ward. Rounded down, and floored at zero so a clock nudged backwards cannot print "-1
   * hours".
   *
   * **The bed is still theirs and nothing here says otherwise.** This is a fact about where the
   * person is, not about the bed: the tile still draws as occupied, the stay still counts, and no
   * capacity figure reads it.
   */
  awayAtEdHours: number | null;
  /** Whole days from `now` to the ward's own expected date — NEGATIVE when it has passed, `null`
   *  when nobody has set one. */
  expectedDays: number | null;
  dischargeDateMoves: number;
  dischargeDateSetBy: string | null;
  confirmed: boolean;
  dischargeConfirmedBy: string | null;
  blockReason: string | null;
};

/** The expected date, or `null` for both of the ways it can be missing — unset, and unusable.
 *  A non-finite instant is exactly as absent as a null one; neither may become a date on screen. */
function expectedInstant(admission: Admission): Instant | null {
  const expected = admission.expectedDischargeAt;
  return expected === null || !Number.isFinite(expected) ? null : expected;
}

/**
 * Whole days from `now` to the ward's own expected date, or `null` when there is none.
 *
 * The same `Math.floor((expected - now) / MINUTES_PER_DAY)` `arrowTargets` uses, deliberately
 * WITHOUT its floor at zero. That floor is right there — the destinations panel groups people by
 * how soon the nearest one leaves, and a negative "soonest" is meaningless in an ordering — and it
 * would be wrong here, where the sign is the fact: this panel distinguishes a date still ahead
 * from one already passed, and clamping would silently present every passed date as "under a day
 * away". The two panels therefore agree on magnitude and differ only where they are documented to.
 */
function daysUntilExpected(admission: Admission, now: Instant): number | null {
  const expected = expectedInstant(admission);
  if (expected === null || !Number.isFinite(now)) return null;
  return Math.floor((expected - now) / MINUTES_PER_DAY);
}

/**
 * Who is in this ward's beds, soonest expected out first.
 *
 * **Scoped with `admissionsForUnit(admissions, unit.id)` and filtered with `bedIsOccupied` — the
 * same two calls `buildTiles` makes**, so the panel and the grid are looking at one set of people
 * and can never disagree about who is in a bed. That is not a stylistic preference: the sibling
 * destinations panel shipped earlier today reading `admissions` unscoped, and offered "Kimberley
 * 28 people" on a twenty-bed ward. Its derivation was correct and all nine of its assertions
 * passed; the defect was in the CALL, where no test of that derivation could see it. The check
 * that catches this class is arithmetic a ward can do in its head — these rows plus the empty,
 * held and out-of-service tiles must equal `unit.beds` — and the new suite asserts exactly that.
 *
 * `bedIsOccupied` includes `"pulled"`, so a bed given away to somebody still in an emergency
 * department appears here with no stay rather than being dropped: they hold one of the ward's beds
 * and the grid already draws them.
 *
 * Ordering is total and deterministic — expected date ascending, anyone with no date last, then by
 * id. Ordering by id on a tie is arbitrary but STABLE, which is what the panel needs: two renders
 * of the same fixture must not reshuffle. A passed date sorts to the top on its own, because its
 * instant is the smallest, which is where a flow meeting wants it.
 */
function buildOccupants(unit: Unit, admissions: readonly Admission[], now: Instant): Occupant[] {
  const inBeds = admissionsForUnit(admissions, unit.id).filter(bedIsOccupied);

  return [...inBeds]
    .sort((a, b) => {
      const aAt = expectedInstant(a);
      const bAt = expectedInstant(b);
      if (aAt !== null && bAt !== null && aAt !== bAt) return aAt - bAt;
      if (aAt === null && bAt !== null) return 1;
      if (aAt !== null && bAt === null) return -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((admission) => ({
      key: admission.id,
      days: daysInBed(admission, now),
      bandLabel: stayBand(admission, now)?.label ?? null,
      pastDate: isPastExpectedDischarge(admission, now),
      sex: admission.sex,
      homeRegion: admission.homeRegion,
      tentativeDiagnosis: tentativeDiagnosisPhrase(admission.tentativeDiagnosis),
      awayAtEdHours:
        admission.awayAtEmergencyDepartmentSince === null
          ? null
          : Math.max(0, Math.floor((now - admission.awayAtEmergencyDepartmentSince) / 60)),
      expectedDays: daysUntilExpected(admission, now),
      dischargeDateMoves: admission.dischargeDateMoves,
      dischargeDateSetBy: admission.dischargeDateSetBy,
      // Read as a decision that was TAKEN, never inferred from how close the date is, how long ago
      // it was set, or how often it moved — `ward-discharge-dates.ts` records at length why each
      // of those proxies renders a ward decision nobody made. A non-finite instant is not a
      // decision either, so it degrades to unconfirmed rather than to a confirmation at `NaN`.
      confirmed: admission.dischargeConfirmedAt !== null && Number.isFinite(admission.dischargeConfirmedAt),
      dischargeConfirmedBy: admission.dischargeConfirmedBy,
      blockReason: admission.blockReason,
    }));
}

/** The expected date in words. Never a calendar date: the model holds instants on a synthetic
 *  operating day and no calendar at all, so a printed "14 March" would be invented. */
function expectedPhrase(expectedDays: number | null): string {
  if (expectedDays === null) return "No expected date set";
  // Sign, not magnitude, is what changes the sentence — see `daysUntilExpected` on why the zero
  // floor `arrowTargets` applies would be wrong here.
  if (expectedDays < 0) {
    const past = -expectedDays;
    return `${past} day${past === 1 ? "" : "s"} past the ward's expected date`;
  }
  // Floors to 0 for anything inside the next day. "Within a day" rather than "today": the model
  // has no calendar, so it cannot say which day anything falls on.
  if (expectedDays === 0) return "Expected out within a day";
  return `Expected out in ${expectedDays} day${expectedDays === 1 ? "" : "s"}`;
}

/** How many times the WARD moved its own plan. Never a measure of the person — `dischargeDateMoves`
 *  says the plan kept changing, and this sentence must not be readable as saying anybody was slow.
 *  Guarded against a negative or non-integer count rather than trusted, the same way `unit.blocked`
 *  is guarded in `buildTiles`. */
function movesPhrase(moves: number): string {
  if (!Number.isFinite(moves) || moves < 1) return "not moved since";
  const whole = Math.floor(moves);
  if (whole === 1) return "moved once since";
  if (whole === 2) return "moved twice since";
  return `moved ${whole} times since`;
}

/**
 * The two outgoing bases the triage bar toggles between — the product owner's own words for what
 * he wanted to switch: "daily discharges … and toggles to daily expects". They are the `state`
 * values a derived forward `BedRelease` can carry (`ward-discharge-dates.ts`), so the toggle
 * selects a real field on real records rather than a display mode invented here.
 */
const OUTGOING_BASES = ["confirmed", "predicted"] as const;
type OutgoingBasis = (typeof OUTGOING_BASES)[number];

/**
 * The basis in the words the HOME PAGE already uses for it.
 *
 * `CAPACITY_FIGURE_LABELS` is the single vocabulary the morning page, the hospital rollup and the
 * ward rollup all render (`ward-morning-rollup.ts`, spec D3/D14), so the toggle names the two
 * figures it switches between with the labels those figures already carry. Typing "Confirmed" and
 * "Predicted" here instead would pass every test today and cost the cheap rename tomorrow, which
 * is the exact failure that constant exists to prevent.
 */
const OUTGOING_BASIS_LABEL: Record<OutgoingBasis, string> = {
  confirmed: CAPACITY_FIGURE_LABELS.confirmedToday,
  predicted: CAPACITY_FIGURE_LABELS.predictedToday,
};

/**
 * Each `ReleaseBand` id, in words.
 *
 * A FORMATTING of ids that already exist (`RELEASE_BANDS` in `ward-bed-availability.ts`), never a
 * new vocabulary: "by-1600" and "By 16:00" are the same fact spelled for a reader. Keyed by band
 * id in a total `Record`, the same discipline `BAND_CLASS` holds, so adding a fifth band is a
 * compile error rather than a row that silently renders its raw id.
 */
const RELEASE_BAND_PHRASE: Record<ReleaseBand, string> = {
  now: "Expected now",
  "by-midday": "Expected by midday",
  "by-1600": "Expected by 16:00",
  tonight: "Expected tonight",
  // WB-DB-7, 2026-08-30. Said plainly rather than folded into "tonight", which is what the four
  // time-of-day bands would have done to it silently.
  tomorrow: "Expected tomorrow",
};

/**
 * The beds this ward expects to free TODAY, on one of the two bases the toggle selects.
 *
 * **Filtered exactly as `capacityBreakdown` counts** — same unit filter, same
 * `releaseBand(...) !== "beyond-today"` cut, same `state` test — so the number of rows this returns
 * is the number printed on the triage bar above them. That equality is the check a reader can
 * perform without trusting anything: the bar says four, the list has four rows. It is asserted
 * across all 23 seeded units in `tests/ward-board-triage.dom.test.tsx`, and it is the reason this
 * function re-uses `releaseBand` rather than comparing instants of its own.
 *
 * **These are BEDS, not people, and the panel says so on screen.** A `BedRelease` deliberately
 * carries nothing whatever about the departing patient — not an id, not a sex, not a destination
 * (see its own field-set doc comment) — so a row here cannot name, and must never appear to name,
 * whoever is leaving. Recovering the person by unpicking the derived release id would defeat the
 * one privacy property that type exists to hold.
 */
function outgoingToday(
  unit: Unit,
  bedReleases: readonly BedRelease[],
  basis: OutgoingBasis,
  now: Instant,
): BedRelease[] {
  // `state === basis` already excludes `"discharged"` — the two bases are the only other states a
  // `BedRelease` can carry — so `capacityBreakdown`'s explicit `"discharged"` skip needs no separate
  // clause here. It is the same cut, reached by the narrower test.
  return bedReleases.filter(
    (release) => release.unitId === unit.id && release.state === basis && releaseBand(release, now) !== "beyond-today",
  );
}

/**
 * One person on their way into a bed on this ward.
 *
 * Two states, and the difference between them is the whole point of the list: `"pulled"` means the
 * ward has ALREADY GIVEN THE BED AWAY and the person is travelling — that bed is gone from the
 * ward's count and the grid draws it as "Empty, waiting" — while `"waitlisted"` means accepted in
 * principle with no bed given, holding nothing and changing no figure. Presenting them as one
 * undifferentiated "incoming" list would let a reader plan against a bed that is already spoken
 * for, so each row states which it is.
 *
 * **Nothing here is invented and nothing is missing on purpose.** The record holds no arrival
 * time, no transport and no estimated time of arrival; a pulled admission carries `pulledAt` (when
 * the bed went) and that is the only clock there is. `arrivedAt` is null in both states by
 * construction, so no row can show a stay.
 */
type Incoming = {
  key: string;
  state: "pulled" | "waitlisted";
  sex: Sex;
  /** `null` for an admission created by an ED arrival - see `Occupant.homeRegion`. */
  homeRegion: HomeRegion | null;
  /** Whole hours since the ward gave the bed away, or `null` for a waitlisted person and for a
   *  pull with no usable instant. Never a guess at when anybody will arrive. */
  bedGoneHours: number | null;
};

/**
 * Who is coming in to this ward, bed-already-given first.
 *
 * Scoped with `admissionsForUnit(admissions, unit.id)` — the same call `buildTiles` and
 * `buildOccupants` make, and for the same reason: a per-person panel handed the whole network's
 * 267 records is this feature's most recently shipped defect. `admissionsForUnit` drops departed
 * admissions and keeps waitlisted ones, which is exactly this list's population.
 *
 * Pulled before waitlisted because a given-away bed is the more urgent fact, then longest-waiting
 * first inside the pulled group, then by id — total, deterministic, and stable across renders.
 */
function buildIncoming(unit: Unit, admissions: readonly Admission[], now: Instant): Incoming[] {
  const arriving = admissionsForUnit(admissions, unit.id).filter(
    (admission) => admission.state === "pulled" || admission.state === "waitlisted",
  );

  return arriving
    .map((admission) => {
      const pulledAt = admission.pulledAt;
      const usablePull =
        admission.state === "pulled" && pulledAt !== null && Number.isFinite(pulledAt) && Number.isFinite(now);
      return {
        key: admission.id,
        state: admission.state === "pulled" ? ("pulled" as const) : ("waitlisted" as const),
        sex: admission.sex,
        homeRegion: admission.homeRegion,
        bedGoneHours: usablePull && pulledAt !== null ? Math.max(0, Math.floor((now - pulledAt) / 60)) : null,
      };
    })
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === "pulled" ? -1 : 1;
      const aHours = a.bedGoneHours ?? -1;
      const bHours = b.bedGoneHours ?? -1;
      if (aHours !== bHours) return bHours - aHours;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
}

/** How long ago the bed went, in words. Whole hours, floored — the record's own resolution is
 *  minutes and an hour is as fine as anybody reads a board. */
function bedGonePhrase(hours: number | null): string {
  if (hours === null) return "Bed given away — when is not recorded";
  if (hours === 0) return "Bed given away within the hour";
  return `Bed given away ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/** The DOM id of a tile's own button, so closing the slide-out can hand focus back to exactly the
 *  control that opened it. Derived from the tile key, which is unique within one board. */
function tileDomId(key: string): string {
  return `ward-board-tile-${key}`;
}

/**
 * One person's discharge plan, rendered identically wherever it appears.
 *
 * **One renderer, two places, on purpose.** The slide-out shows the selected person and the
 * printed sheet shows all of them; two copies of this markup would drift the first time either
 * changed, and the two readings of the same record would then disagree on paper and on screen.
 * `idPrefix` is the only difference between them, and it exists so the printed list keeps the
 * `ward-board-person-*` test ids the existing suite already pins while the slide-out's copy sits
 * under a distinct prefix and cannot be double-counted by a query for either.
 */
function PersonEntry({ occupant, idPrefix }: { occupant: Occupant; idPrefix: string }) {
  return (
    <>
      <p className={styles.personStay}>
        {occupant.days === null ? (
          /* Rule 2 again, in the panel: the bed is gone, the stay has not started. Never a
             zero-day stay, which would present somebody as newly arrived somewhere they
             have not reached. */
          <span className={styles.personNoStay}>No stay yet — not arrived</span>
        ) : (
          <>
            <span className={styles.personDays} data-testid={`${idPrefix}-${occupant.key}-days`}>
              {occupant.days} day{occupant.days === 1 ? "" : "s"}
            </span>
            {/* The band in words, unlike the tile — a tile has no room for it and prints
                the number instead, but this panel does, and the words are what survive a
                greyscale sheet. `null` only where there is no stay to band. */}
            {occupant.bandLabel !== null && <span className={styles.personBand}>{occupant.bandLabel}</span>}
          </>
        )}
        {occupant.pastDate && <span className={styles.pastMark}>Past date</span>}
      </p>
      <p className={styles.personWho}>
        {occupant.sex}, {occupant.homeRegion === null ? "home region not recorded" : `from ${occupant.homeRegion}`}
      </p>
      {/*
       * THE TENTATIVE DIAGNOSIS, and the word "tentative" leads the line rather than trailing it.
       * A reader scanning a column of people takes the first words of each line, so a qualification
       * at the end is the half that gets skipped — and a broad ICD-10-AM block read as settled is
       * exactly the misreading this whole field had to be justified against.
       *
       * BOTH states are stated, never one. Silence for the unrecorded case would leave a reader
       * unable to tell "nobody wrote one down" from "this board does not show them", and the second
       * of those was true until 2026-08-29, so the ambiguity is live. "Not recorded" is also not a
       * finding: it never reads as "no mental illness" and never as an empty slot a ward is expected
       * to fill in — the same distinction `blockReason` above draws between silence and a ward's
       * own answer.
       */}
      {/*
       * AWAY AT AN EMERGENCY DEPARTMENT. Owner decision, 2026-08-30.
       *
       * Stated FIRST among this person's facts, above the diagnosis, because it changes what every
       * line below it means: a stay length, a discharge plan and a diagnosis all read differently
       * about somebody who is not on the ward. Without it the tile is an ordinary occupant and a
       * charge nurse reading the grid believes they are in the bed.
       *
       * Says the bed is still theirs, in the same breath, because the honest reading of "away" on
       * a bed board is otherwise "so the bed is free" — and it is not. The ward is holding it.
       *
       * Rendered ONLY when the record holds it. Unlike the diagnosis directly below, there is no
       * "not recorded" branch: an absent value here means the person is on the ward, which is the
       * ordinary case and needs no sentence. The diagnosis states both states because its absence
       * is genuinely ambiguous; this one's is not.
       */}
      {occupant.awayAtEdHours !== null && (
        <p className={styles.personAway} data-testid="ward-board-person-away">
          {occupant.awayAtEdHours === 0
            ? "At an emergency department — the bed is still theirs."
            : `At an emergency department for ${occupant.awayAtEdHours} ${occupant.awayAtEdHours === 1 ? "hour" : "hours"} — the bed is still theirs.`}
        </p>
      )}
      <p className={styles.personLine}>
        {occupant.tentativeDiagnosis !== null
          ? `Tentative diagnosis: ${occupant.tentativeDiagnosis}.`
          : "Tentative diagnosis: none recorded."}
      </p>
      <p className={styles.personExpected}>{expectedPhrase(occupant.expectedDays)}</p>
      {/* Provenance only where there IS a date. With none, "set by nobody, never moved"
          would describe a plan that does not exist. */}
      {occupant.expectedDays !== null && (
        <p className={styles.personLine}>
          {occupant.dischargeDateSetBy !== null
            ? `Date set by ${occupant.dischargeDateSetBy}`
            : "Date set — the role that set it is not recorded"}
          , and {movesPhrase(occupant.dischargeDateMoves)}.{" "}
          {/* Confirmed and unconfirmed are BOTH stated, because the difference is the
              point: a plan the ward may revise, against a decision it has taken. Silence
              for the unconfirmed case would leave a reader unable to tell "not decided"
              from "not displayed". "Not yet its decision" never reads as a refusal — an
              unset `dischargeConfirmedAt` means nobody has decided, never that anybody
              declined. */}
          {occupant.confirmed
            ? occupant.dischargeConfirmedBy !== null
              ? `Confirmed by ${occupant.dischargeConfirmedBy} — a decision, not a plan.`
              : "Confirmed — a decision, not a plan; the role that confirmed it is not recorded."
            : "Not confirmed — the ward's plan, not yet its decision."}
        </p>
      )}
      {/* Drawn from `BED_RELEASE_BLOCKERS` — the owner's list, about the BED, never about
          the person. Absent when nothing is recorded, and an absent blocker is silence:
          it never renders as "nothing outstanding", which would be a ward's finding rather
          than this panel's ignorance. Same distinction `derivedBedReleases` draws for
          `waitingOn`. */}
      {occupant.blockReason !== null && <p className={styles.personBlocker}>Held up by: {occupant.blockReason}.</p>}
    </>
  );
}

export function WardBoard({ unitId }: { unitId: string }) {
  /*
   * SELECTION, and the one thing it is allowed to mean.
   *
   * The product owner has overruled the decision recorded at 281bdf83f, which built the people
   * panel as a list with no selection at all; that call was his to make and this is it. What that
   * commit's reasoning STILL binds is the part about identity: an `Admission` records the ward and
   * NEVER a bed, so a tile carries no bed identity and nothing here may number a tile, call it
   * "Bed 7", or let the grid read as a floor plan — the order is seed order.
   *
   * Selection is therefore honest in exactly one direction. An occupied or waiting tile stands for
   * a PERSON, and `selectedKey` holds that person's admission id, which is a real handle on a real
   * record. A blocked, held or empty tile stands for no particular bed — those tiles are counts
   * drawn somewhere rather than locations — so selecting one shows what the ward records about
   * that CLASS of bed and says, on the panel, that which bed is not recorded.
   *
   * Held as a key rather than an index so a re-render cannot slide the selection onto a different
   * person, and so nothing in this component ever has an ordinal to print.
   */
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  /*
   * Which of the two outgoing figures the "Going out today" list is built from. The toggle changes
   * what the board EMPHASISES; it hides no figure — all six stay on the triage bar in every state,
   * because a control that can remove the blocked-releases figure from a coordinator's screen is a
   * control that can hide the thing they most need to chase.
   */
  const [outgoingBasis, setOutgoingBasis] = useState<OutgoingBasis>("confirmed");
  /*
   * The tile to hand focus back to once the slide-out closes.
   *
   * A REF rather than a second piece of state, and the distinction is not cosmetic. The focus call
   * has to happen after React has committed the render that removed the panel — inside the click
   * handler it would move focus and then have it undone by the commit — but a state variable
   * written from inside that effect is a cascading render, which `react-hooks/set-state-in-effect`
   * fails the build on and which is right: nothing about "which control to focus" is part of what
   * this component renders. So the ref is set in the handler, read once after the close has
   * committed, and cleared without re-rendering anything.
   */
  const focusBackTo = useRef<string | null>(null);

  useEffect(() => {
    if (selectedKey !== null) return;
    const key = focusBackTo.current;
    if (key === null) return;
    focusBackTo.current = null;
    document.getElementById(tileDomId(key))?.focus();
  }, [selectedKey]);

  const closeDetail = useCallback(() => {
    focusBackTo.current = selectedKey;
    setSelectedKey(null);
  }, [selectedKey]);

  /* Escape closes the slide-out from anywhere inside the board's three zones — the tiles and the
   * panel itself — and focus returns to the tile that opened it. Bound to the zones container
   * rather than to `window` so this board never intercepts a key press meant for something else on
   * the page, and NOT a focus trap: Tab continues out of the panel into the rest of the page,
   * because the panel is not modal and does not cover what it describes. */
  const onZoneKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeDetail();
    },
    [closeDetail],
  );

  const found = findUnit(unitId);
  if (found === undefined) {
    // Task A: a "Ward not found" page with no `<ClinicalRail />` was a dead end — there was no way
    // back to anything else in Ward Flow from it. Every other dynamic-route screen mounts the rail
    // in BOTH its return branches (see `ed-screen.tsx`'s own not-found branch), and this one now
    // does too.
    return (
      <div className={styles.screen} data-testid="ward-board-unknown-unit">
        <ClinicalRail />
        <main id="main-content" className={styles.main}>
          <h1 className={styles.unitName}>Ward not found</h1>
          <p className={styles.constraint}>No ward is recorded with the id “{unitId}”.</p>
        </main>
      </div>
    );
  }

  const { unit, site } = found;
  const now = WARD_ADMISSIONS_ANCHOR;
  const admissions = wardAdmissions;
  // Derived from the same admissions this page draws, so the header cannot disagree with the
  // tiles about who is in a bed. `availableNow` — the only figure the header prints — is
  // `min(allocatable, empty)` and reads neither of these two lists, but they are passed honestly
  // rather than as empty arrays: the releases really are the ones these admissions imply. No
  // leave beds are modelled on this board, and no leave figure is rendered from them.
  const bedReleases = derivedBedReleases([...admissions], now);
  const leaveBeds = [] as const;

  const available = headlineAvailable(unit, admissions, bedReleases, [...leaveBeds], now);
  const constraint = constraintSentence(unit, admissions, bedReleases, [...leaveBeds], now);
  const tiles = buildTiles(unit, admissions, bedReleases, now);
  // Read straight back out, purely to say how many held tiles are on screen in the footnote below
  // — never re-derived. `buildTiles` already clamped this into the physically-empty pool; the
  // footnote must describe exactly what got drawn, not a second, unclamped copy of the figure.
  const heldTileCount = tiles.filter((tile) => tile.kind === "held").length;

  /*
   * Scoped to THIS unit with the same helper `buildTiles` uses, so the panel and the grid can
   * never disagree about who is in a bed.
   *
   * **Written first as `arrowTargets(admissions, now)` and caught by rendering the page, not by a
   * test.** `admissions` is the whole network's 267 records, so the panel read every ward in the
   * state: it offered "Kimberley 28 people" on a twenty-bed ward and totalled about 180 against
   * eighteen occupants. Nothing failed — `arrowTargets` was correct and its nine assertions still
   * passed, because the defect was in the CALL and every one of them supplies its own admissions.
   * A derivation's tests cannot see a caller handing it the wrong set.
   */
  const targets = arrowTargets(admissionsForUnit(admissions, unit.id), now);
  /* Scoped inside `buildOccupants` with the same `admissionsForUnit(...)` + `bedIsOccupied` pair
   * `buildTiles` uses — see that function's own comment for the defect this prevents. */
  const occupants = buildOccupants(unit, admissions, now);

  /*
   * THE TRIAGE BAR'S SIX FIGURES, scoped to this one ward.
   *
   * `capacityBreakdown` is the same function the morning page's ward-level rollup calls, given this
   * unit and the releases these admissions imply — so the board's bar and the home page's cards are
   * one arithmetic, not two. The labels come from `CAPACITY_FIGURE_LABELS`, the single vocabulary
   * spec D3/D14 requires to be identical at service, hospital and ward level; the words are never
   * retyped here, which is what stops this board drifting from the home page's.
   *
   * `availableNow` is the same figure the header above already prints through `headlineAvailable` —
   * that helper IS `capacityBreakdown(...).availableNow` floored, so the two cannot disagree.
   */
  const breakdown = capacityBreakdown(unit, [...bedReleases], [...leaveBeds], now);
  const figures: { key: keyof typeof CAPACITY_FIGURE_LABELS; value: number }[] = [
    { key: "availableNow", value: breakdown.availableNow },
    { key: "confirmedToday", value: breakdown.confirmedToday },
    { key: "predictedToday", value: breakdown.predictedToday },
    { key: "blockedToday", value: breakdown.blockedToday },
    { key: "held", value: breakdown.held },
    { key: "leaveUsable", value: breakdown.leaveUsable },
  ];

  const incoming = buildIncoming(unit, admissions, now);
  const outgoing = outgoingToday(unit, bedReleases, outgoingBasis, now);
  /*
   * `sinceYesterday` counts whatever it is given and deliberately cannot use `admissionsForUnit`,
   * which drops departed admissions and would make `discharged` permanently zero — see its own doc
   * comment. So this is the ONE list on this page filtered by hand, keeping `"left"` admissions in,
   * and it is filtered by `unit.id` all the same: the whole network's records through here would
   * report the state's departures as this ward's.
   */
  const movement = sinceYesterday(
    admissions.filter((admission) => admission.unitId === unit.id),
    now,
  );

  /* Taken from the SAME `now` every figure above was derived from, which is the whole of DB-12 —
     see the stamp's own comment in the heading below. */
  const stamp = asAtStamp(now);

  const selectedTile = selectedKey === null ? null : (tiles.find((tile) => tile.key === selectedKey) ?? null);
  const selectedOccupant =
    selectedTile === null || (selectedTile.kind !== "occupied" && selectedTile.kind !== "waiting")
      ? null
      : (occupants.find((occupant) => occupant.key === selectedTile.key) ?? null);
  const blockedTileCount = tiles.filter((tile) => tile.kind === "blocked").length;
  const emptyTileCount = tiles.filter((tile) => tile.kind === "empty").length;

  return (
    <div className={styles.screen} data-testid="ward-board">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <p className={styles.prototypeBadge}>Synthetic prototype — not a medical device</p>

        {/*
         * A `<div>`, NOT a `<header>` — found by printing the page and looking, not by a test.
         * The global print reset in `globals.css` carries `header, nav, button { display: none
         * !important }` to strip workspace chrome from a printed sheet. This block is a page
         * header, not workspace chrome, so as a `<header>` it vanished in print and a printed ward
         * board carried no ward name, no hospital and no headline figure at all — a sheet of
         * anonymous numbered boxes that could have come from any ward in the state. Other pages
         * fight that rule back with a `display: block !important` override; not using the element
         * is simpler and cannot be undone by a later reset. Nothing here is a landmark: the page's
         * one landmark is the `<main>` above.
         */}
        <div className={styles.header}>
          <h1 className={styles.unitName} data-testid="ward-board-unit-name">
            {unit.name}
          </h1>
          <p className={styles.siteName} data-testid="ward-board-site-name">
            {site.name}
          </p>
          <p className={styles.headline} data-testid="ward-board-headline">
            <span className={styles.headlineValue}>{available}</span>
            <span className={styles.headlineLabel}>bed{available === 1 ? "" : "s"} you can fill today</span>
          </p>
          {/* `constraintSentence` returns null — never an empty string — when nothing is
            constraining, so nothing is rendered rather than a blank line that reads as a sentence
            which failed to load. */}
          {constraint !== null && (
            <p className={styles.constraint} data-testid="ward-board-constraint">
              {constraint}
            </p>
          )}
          {/*
           * THE "AS AT" STAMP — spec DB-10, DB-11 and DB-12, and it is load-bearing rather than
           * provenance.
           *
           * DB-11 dropped the frozen 08:00 view outright: this board and its printed sheet are one
           * LIVE picture, and the owner was shown the cost of that and took it. What was traded for
           * the freeze is exactly this line. Two sheets taken an hour apart are then visibly two
           * moments rather than two competing claims — so DB-10 puts the stamp in the HEADING, read
           * as part of the title, and says in terms that small print at the foot of the page does
           * not discharge the requirement.
           *
           * **It reads `now` — the same variable every figure on this page reads (DB-12).** Never
           * `wallClockNow()`. Ward Flow screens take their `now` from a shared value a demo control
           * can move, so a stamp on the wall clock beside figures from a moved clock would assert a
           * moment that is not the moment being shown. A stamp that can lie is worse than no stamp,
           * because the freeze was removed on the strength of it. That is invisible to any test
           * that does not move the clock, which is why `tests/ward-daily-sheet.dom.test.tsx`
           * renders this board at two different instants and asserts the stamp AND the figures both
           * moved.
           *
           * The DATE that DB-10 also asks for is absent, and since `b1198cf6e` that is a CHOICE
           * rather than a limitation: the clock gained a real date, so this could print one. It
           * does not, because a real date beside invented figures is the one combination that
           * makes a prototype look like a record. See `asAtStamp`'s own doc comment.
           */}
          <p className={styles.asAt} data-testid="ward-board-as-at">
            {stamp.time === null ? (
              "As at — the moment shown is not recorded."
            ) : (
              <>
                <span className={styles.asAtValue}>As at {stamp.time}</span>
                <span className={styles.asAtNote}>{stamp.dayNote}</span>
              </>
            )}
          </p>
          {/*
           * THE BOARD DOES NOT ADVANCE, AND SAYS SO. Owner decision, 2026-08-30, taken in
           * preference to making it live.
           *
           * Every other Ward Flow screen now follows a clock that starts at the real time of page
           * load and runs. This board deliberately does not: it reads the admissions fixture at
           * `WARD_ADMISSIONS_ANCHOR`, the instant that fixture is authored against, so every stay
           * length is the one the seed intends.
           *
           * **The alternative was considered and refused, and the reason belongs here rather than
           * in a message.** Making the board live means re-anchoring the fixture by an offset, and
           * `shiftInstants` — the one function that does that — is not idempotent and carries no
           * marker saying a state has already been shifted. A second applier would silently double
           * every offset, so a patient who has been in a bed nine days would read as eighteen. A
           * wrong clock looks wrong; a wrong length of stay looks plausible, and this board's whole
           * subject is how long people have been in beds.
           *
           * So the honest thing is to say what this is. If the board is ever made live, the change
           * is to move admissions into the provider so there is ONE applier — never a second call
           * site — and this note comes out in the same commit.
           */}
          <p className={styles.asAtFixed} data-testid="ward-board-fixed-note">
            This board is a fixed snapshot and does not advance while you watch. Other screens follow the live clock, so
            the times will differ.
          </p>
        </div>

        {/*
         * THE DAILY SHEET — D19's handover sheet, and page one of anything printed from this board.
         *
         * Rendered here, directly under the heading block, because on paper the two are one page: the
         * heading carries the ward, the hospital, the headline figure, the sentence that qualifies it
         * and the stamp, and the sheet carries D19's four groups beneath them. That page is what a
         * charge nurse takes into the morning meeting.
         *
         * **Every value handed down is one the board already computed.** Not one of them is derived a
         * second time here or inside the sheet — see that component's own doc comment. A sheet with
         * its own copy of the available figure, the since-yesterday counts or the overdue set would be
         * a second answer to a question somebody is asking out loud with the screen in front of them.
         */}
        <WardDailySheet
          movement={movement}
          incomingPulled={incoming.filter((person) => person.state === "pulled").length}
          incomingWaitlisted={incoming.filter((person) => person.state === "waitlisted").length}
          outgoingCount={outgoing.length}
          outgoingBasisLabel={OUTGOING_BASIS_LABEL[outgoingBasis]}
          destinations={targets}
          people={occupants}
        />

        {/*
         * THE TRIAGE BAR — the day's six figures for this one ward, in the home page's own words.
         *
         * **Every label comes from `CAPACITY_FIGURE_LABELS`** (`ward-morning-rollup.ts`), the single
         * capacity vocabulary spec D3/D14 requires to be identical at service, hospital and ward
         * level. Retyping "Available now" here would pass every test today and cost the cheap rename
         * tomorrow — and, worse, would let this board and the morning page start calling one figure
         * two things. The values come from `capacityBreakdown` for THIS unit, which is the same
         * function the morning page's ward rollup calls, so the two surfaces are one arithmetic.
         *
         * **The toggle changes emphasis; it never hides a figure.** All six are on the bar in every
         * state. A control able to take the blocked-releases figure off a coordinator's screen is a
         * control able to hide the one thing they most need to chase, so the toggle instead selects
         * which of Confirmed today / Predicted today the "Going out today" list below is built from —
         * the owner's own "daily discharges … and toggles to daily expects". The selected figure is
         * marked in WORDS ("shown in Going out") as well as by weight, because a mark carried by
         * weight alone is a mark a greyscale sheet loses.
         */}
        <section className={styles.triage} aria-labelledby="ward-board-triage-heading" data-testid="ward-board-triage">
          <h2 id="ward-board-triage-heading" className={styles.triageHeading}>
            Today on this ward
          </h2>
          <dl className={styles.triageFigures}>
            {figures.map(({ key, value }) => {
              const led =
                (outgoingBasis === "confirmed" && key === "confirmedToday") ||
                (outgoingBasis === "predicted" && key === "predictedToday");
              return (
                <div
                  key={key}
                  className={`${styles.triageFigure}${led ? ` ${styles.triageFigureLed}` : ""}`}
                  data-testid={`ward-board-figure-${key}`}
                  data-figure-led={led ? "true" : "false"}
                >
                  <dt className={styles.triageLabel}>{CAPACITY_FIGURE_LABELS[key]}</dt>
                  <dd className={styles.triageValue}>{value}</dd>
                  {led && <dd className={styles.triageLedNote}>shown in Going out</dd>}
                </div>
              );
            })}
          </dl>
          <div
            className={styles.triageToggle}
            role="group"
            aria-label="Which of today's departures the Going out list shows"
          >
            <span className={styles.triageToggleLabel}>Going out shows</span>
            {OUTGOING_BASES.map((basis) => (
              <button
                key={basis}
                type="button"
                className={`${styles.triageToggleButton}${outgoingBasis === basis ? ` ${styles.triageToggleButtonOn}` : ""}`}
                aria-pressed={outgoingBasis === basis}
                onClick={() => setOutgoingBasis(basis)}
                data-testid={`ward-board-basis-${basis}`}
              >
                {OUTGOING_BASIS_LABEL[basis]}
              </button>
            ))}
          </div>
        </section>

        {/*
         * THE THREE ZONES, and the reading they are arranged to give: LEFT who is coming in and what
         * is going out, MIDDLE the beds themselves, RIGHT whichever one the reader has chosen. Left
         * to right that is in → in a bed → out, which is the flow this whole prototype is about.
         *
         * The right zone is a SLIDE-OUT rather than a permanent column: it is absent until a tile is
         * chosen, so it costs no width on a screen where nobody has chosen one, and it takes its own
         * grid track rather than sitting over the beds — a panel that covered the grid would force a
         * reader to close it to do the thing they opened it for. On a phone there is no third column
         * at all and it falls into the flow directly beneath the grid, which is the same arrangement
         * without the overlay a phone sheet would impose.
         */}
        <div
          className={`${styles.zones}${selectedTile !== null ? ` ${styles.zonesOpen}` : ""}`}
          onKeyDown={onZoneKeyDown}
        >
          <div className={styles.flowColumn}>
            {/*
             * COMING IN. Two states with a real difference between them: `"pulled"` means this ward
             * has ALREADY given the bed away and the person is travelling — the grid draws that bed
             * as "Empty, waiting" and it is gone from the ward's count — while `"waitlisted"` means
             * accepted in principle with nothing held. Merging them would let a reader plan against
             * a bed that is already spoken for.
             */}
            <section
              className={styles.flowPanel}
              aria-labelledby="ward-board-incoming-heading"
              data-testid="ward-board-incoming"
            >
              <h2 id="ward-board-incoming-heading" className={styles.flowHeading}>
                Coming in
              </h2>
              <p className={styles.flowIntro} data-testid="ward-board-incoming-count">
                {incoming.length === 0
                  ? "Nobody is recorded as coming in to this ward."
                  : `${incoming.length} recorded as coming in.`}
              </p>
              {incoming.length > 0 && (
                <ol className={styles.flowList} data-testid="ward-board-incoming-list">
                  {incoming.map((person) => (
                    <li
                      key={person.key}
                      className={styles.flowRow}
                      data-testid={`ward-board-incoming-${person.key}`}
                      data-incoming-state={person.state}
                    >
                      <p className={styles.flowRowLead}>
                        {person.state === "pulled" ? "Bed already given away" : "Waiting — no bed given"}
                      </p>
                      <p className={styles.flowRowLine}>
                        {person.sex},{" "}
                        {person.homeRegion === null ? "home region not recorded" : `from ${person.homeRegion}`}
                      </p>
                      {person.state === "pulled" && (
                        <p className={styles.flowRowLine}>{bedGonePhrase(person.bedGoneHours)}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {/* Said rather than left as an absence a reader might read as "not yet loaded". The
                record holds when a bed was given away and nothing else about the journey. */}
              <p className={styles.flowNote}>
                No arrival time is shown: the record holds when a bed was given away, and nothing about when anybody
                will get here.
              </p>
            </section>

            {/*
             * GOING OUT TODAY, on whichever of the two bases the triage bar's toggle selects. The row
             * count here EQUALS the figure on the bar above by construction — `outgoingToday` applies
             * the same filter `capacityBreakdown` counts with — so a reader can check the board
             * against itself without trusting either.
             */}
            <section
              className={styles.flowPanel}
              aria-labelledby="ward-board-outgoing-heading"
              data-testid="ward-board-outgoing"
            >
              <h2 id="ward-board-outgoing-heading" className={styles.flowHeading}>
                Going out today
              </h2>
              {/* The basis is stated in WORDS as well as by the toggle's pressed state, so a printed
                sheet — where the toggle is gone with every other button — still says which of the
                two lists it is. */}
              <p className={styles.flowIntro} data-testid="ward-board-outgoing-count">
                Showing {OUTGOING_BASIS_LABEL[outgoingBasis]}: {outgoing.length} bed{outgoing.length === 1 ? "" : "s"}.
              </p>
              {outgoing.length === 0 ? (
                <p className={styles.flowRowLine}>No bed on this ward carries that today.</p>
              ) : (
                <ol className={styles.flowList} data-testid="ward-board-outgoing-list">
                  {outgoing.map((release) => {
                    const band = releaseBand(release, now);
                    return (
                      <li key={release.id} className={styles.flowRow} data-testid={`ward-board-outgoing-${release.id}`}>
                        <p className={styles.flowRowLead}>
                          {band === "beyond-today" ? "Expected today" : RELEASE_BAND_PHRASE[band]}
                        </p>
                        {/* A ROLE, never a personal name — `BedRelease.confirmedBy`'s own rule. */}
                        <p className={styles.flowRowLine}>Reported by {release.confirmedBy}</p>
                        {release.blocker !== null && (
                          <p className={styles.flowRowBlocker}>
                            Held up by: {release.blocker}
                            {release.blockedBy !== null ? ` — recorded by ${release.blockedBy}` : ""}.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {/* The honest limit of this list, stated on it. A `BedRelease` deliberately carries
                NOTHING about the departing patient — not an id, not a sex, not a destination — so
                these rows are beds and can never become people without breaking that. */}
              <p className={styles.flowNote}>
                These are beds, not people: a bed release records nothing at all about who is leaving. A person&apos;s
                own discharge plan is on their tile&apos;s panel, and on the printed sheet.
              </p>
            </section>

            {/* SINCE YESTERDAY — `sinceYesterday`'s first consumer. The last whole day, which carries
              no clinical or legal meaning and is simply the window between one morning and the
              next. */}
            <section
              className={styles.flowPanel}
              aria-labelledby="ward-board-since-heading"
              data-testid="ward-board-since-yesterday"
            >
              <h2 id="ward-board-since-heading" className={styles.flowHeading}>
                Since yesterday
              </h2>
              <ul className={styles.sinceList}>
                <li className={styles.sinceItem} data-testid="ward-board-since-discharged">
                  <span className={styles.sinceValue}>{movement.discharged}</span> left this ward
                </li>
                <li className={styles.sinceItem} data-testid="ward-board-since-pulled">
                  <span className={styles.sinceValue}>{movement.pulled}</span> bed{movement.pulled === 1 ? "" : "s"}{" "}
                  given away
                </li>
                <li className={styles.sinceItem} data-testid="ward-board-since-dates-moved">
                  <span className={styles.sinceValue}>{movement.datesMoved}</span> expected date
                  {movement.datesMoved === 1 ? "" : "s"} moved
                </li>
              </ul>
              {/* `discharged` counts departures of every destination and must never be summed across
                wards as beds returned to the network — see `sinceYesterday`'s own doc comment. */}
              <p className={styles.flowNote}>
                A transfer to another psychiatric ward counts here: this ward gets its bed back, the state does not.
              </p>
            </section>
          </div>

          <div className={styles.gridColumn}>
            {/* The legend explains the shades. It is not what makes the board readable without colour —
              the day count on every tile does that — it just saves a reader working the ranges out. */}
            <ul className={styles.legend} data-testid="ward-board-legend">
              {STAY_BANDS.map((band) => (
                <li key={band.id} className={styles.legendItem}>
                  <span className={`${styles.legendSwatch} ${BAND_CLASS[band.id]}`} aria-hidden="true" />
                  {band.label}
                </li>
              ))}
              <li className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.legendSwatchPast}`} aria-hidden="true" />
                Past the ward&apos;s own expected date
              </li>
              {/* Listed beside the stay bands because a reader counting fillable beds needs to know
                this tile exists. The tile says so in words on its own face too — this is the index,
                not the explanation. */}
              <li className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.legendSwatchBlocked}`} aria-hidden="true" />
                Out of service — not fillable
              </li>
              {/* Task B. Same reasoning as the blocked entry just above: the tile itself says "Held" in
                words, this is only the index. */}
              <li className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${styles.legendSwatchHeld}`} aria-hidden="true" />
                Empty, not yet offered — not fillable
              </li>
            </ul>

            {/*
             * THE TILES ARE NOW BUTTONS, and two things follow that are not negotiable.
             *
             * **The print restore.** `globals.css`'s print reset carries `header, nav, button {
             * display: none !important }`, so an unrestored tile button vanishes from paper and the
             * printed board is an empty grid — the exact defect this branch spent today fixing on
             * four other surfaces. `board.module.css`'s print block forces `.bed` back to
             * `display: flex !important`; a class selector outranks the bare element selector, so the
             * restore holds without touching the global reset.
             *
             * **Still no bed identity.** The button's accessible name is the tile's own content — a
             * day count, or the word Empty / Held / Out of service — and never an ordinal. Nothing
             * numbers these tiles and nothing may: the order is seed order, not a floor plan.
             */}
            <ol className={styles.beds} data-testid="ward-board-beds">
              {tiles.map((tile, index) => {
                const selected = tile.key === selectedKey;
                return (
                  <li
                    key={tile.key}
                    className={styles.bedSlot}
                    data-testid={`ward-board-bed-${index + 1}`}
                    data-bed-kind={tile.kind}
                  >
                    <button
                      type="button"
                      id={tileDomId(tile.key)}
                      className={tileClassName(tile, selected)}
                      aria-pressed={selected}
                      aria-controls={selected ? "ward-board-detail" : undefined}
                      onClick={() => (selected ? closeDetail() : setSelectedKey(tile.key))}
                    >
                      {tile.kind === "occupied" && (
                        <>
                          <span className={styles.days} data-testid={`ward-board-bed-${index + 1}-days`}>
                            {tile.days}
                          </span>
                          <span className={styles.daysUnit}>day{tile.days === 1 ? "" : "s"}</span>
                          {/* The band in words, for the screen reader only: the visible number already
                            states it, and printing both on a 390px-wide tile would crowd out the
                            number this whole tile exists to show. */}
                          <span className="sr-only">{tile.bandLabel}</span>
                          {tile.pastDate && (
                            <span className={styles.pastMark} data-testid={`ward-board-bed-${index + 1}-past`}>
                              Past date
                            </span>
                          )}
                          {/* Words, never a fill or a colour — the same rule the past-date badge
                            above follows, and for the same reader: greyscale, forced-colors, or
                            paper. The short form is what fits a 390px tile; the full sentence,
                            including that the bed is still theirs, is in the person panel. */}
                          {tile.awayAtEd && (
                            <span className={styles.awayMark} data-testid={`ward-board-bed-${index + 1}-away`}>
                              At ED
                            </span>
                          )}
                        </>
                      )}
                      {/* Rule 2 on screen: taken, but nobody is in it yet. */}
                      {tile.kind === "waiting" && <span className={styles.waiting}>Empty, waiting</span>}
                      {/* Rule 1 on screen for the third bed state: the words say it, not the fill. A
                        coordinator reading this board in greyscale, in forced-colors, or on paper
                        must still be able to tell an unfillable bed from a fillable one, and "Out of
                        service" is what does that — the hatched fill only makes it quicker. */}
                      {tile.kind === "blocked" && <span className={styles.blockedLabel}>Out of service</span>}
                      {/* Task B on screen: physically empty, but not yet one of the beds this ward is
                        offering — a different fact from "Empty" (fillable now) and from "Out of
                        service" (never fillable today). The word is what makes it unambiguous; the
                        dotted edge and dot pattern only make it quicker to spot. */}
                      {tile.kind === "held" && <span className={styles.heldLabel}>Held</span>}
                      {tile.kind === "empty" && <span className={styles.emptyLabel}>Empty</span>}
                      {/* Selection in WORDS, beside the heavier edge that carries it visually. A sheet
                        that has made no decision must not show a filled element — a fill reads as a
                        decision taken — and a weight alone is a mark a greyscale reader can miss. */}
                      {selected && <span className={styles.selectedMark}>Selected</span>}
                    </button>
                  </li>
                );
              })}
            </ol>

            {/*
             * The arithmetic a ward can do in its head, kept ON SCREEN even though the per-person list
             * has moved to the slide-out and the printed sheet. "18 of this ward's 20 beds are taken"
             * beside a grid of 20 tiles is the check that catches a panel fed the wrong collection —
             * the sibling panel that shipped "Kimberley 28 people" on a twenty-bed ward this morning
             * was invisible in a list and would have been obvious here. Both numbers come from the
             * same two values the grid and the printed list are built from, so no third figure exists
             * to drift.
             */}
            <p className={styles.occupancy} data-testid="ward-board-people-count">
              {occupants.length} of this ward&apos;s {unit.beds} bed{unit.beds === 1 ? "" : "s"}{" "}
              {occupants.length === 1 ? "is" : "are"} taken. Soonest expected out first; anyone with no date set is
              last.
            </p>
            {/*
             * THE LINE THAT QUALIFIES EVERY DIAGNOSIS ON THIS PAGE, and it replaced — deliberately,
             * on 2026-08-29 — the sentence that used to stand here saying the record held none.
             *
             * The owner reversed that decision ("It can give a tentative diagnosis. This is because
             * most referrals will require a diagnosis"), so the honest line is no longer about an
             * absence; it is about what the values ARE. It stays in exactly this position, under the
             * grid rather than inside the slide-out, for the reason the old line was put here: it is
             * on the page whether or not anybody has selected a tile, and it prints.
             *
             * It is the ONE place the qualification is stated in full, and every per-person line
             * repeats the word "tentative" rather than relying on a reader having scrolled past this.
             */}
            <p className={styles.peopleAbsence}>
              Any diagnosis shown is tentative: a broad category a referral gave on the way in, not a diagnosis this
              ward has confirmed.
            </p>
            {/*
             * THE EMPTY-SELECTION STATE, and it is deliberately not a blank panel and not somebody
             * chosen for the reader. Auto-selecting an occupant would read as the system having
             * picked a person out of the ward, which is a judgement this board does not make and
             * could not justify; leaving an empty box on screen reads as a panel that failed to load.
             * So the slide-out is simply absent, and the grid says in words that nothing is chosen and
             * that nothing will be chosen on the reader's behalf.
             */}
            {selectedTile === null && (
              <p className={styles.selectHint} data-testid="ward-board-select-hint">
                Nothing is selected. Choose a bed to see who is in it — nobody is chosen for you.
              </p>
            )}
          </div>

          {/*
           * THE SLIDE-OUT. Present only while something is selected, so it costs no width otherwise,
           * and it takes its own grid track rather than covering the beds it describes — a reader who
           * has just chosen a tile wants to compare it with the others, and a panel over the grid
           * would make them close it to do that.
           *
           * NOT modal and NOT a focus trap: Tab leaves it into the rest of the page, Escape closes it
           * from anywhere in the zones, and focus returns to the exact tile that opened it. The tile's
           * own `aria-pressed` is what says which one is open.
           */}
          {selectedTile !== null && (
            <aside
              className={styles.detail}
              id="ward-board-detail"
              aria-labelledby="ward-board-detail-heading"
              data-testid="ward-board-detail"
              data-detail-kind={selectedTile.kind}
            >
              <div className={styles.detailBar}>
                <h2 id="ward-board-detail-heading" className={styles.detailHeading}>
                  {selectedTile.kind === "occupied" || selectedTile.kind === "waiting"
                    ? "Who is in this bed"
                    : selectedTile.kind === "empty"
                      ? "An empty bed"
                      : selectedTile.kind === "held"
                        ? "A held bed"
                        : "A bed out of service"}
                </h2>
                <button
                  type="button"
                  className={styles.detailClose}
                  onClick={closeDetail}
                  data-testid="ward-board-detail-close"
                >
                  Close
                </button>
              </div>

              {selectedTile.kind === "occupied" || selectedTile.kind === "waiting" ? (
                selectedOccupant !== null ? (
                  <div className={styles.person} data-testid="ward-board-detail-person">
                    <PersonEntry occupant={selectedOccupant} idPrefix="ward-board-selected-person" />
                    {/* Rule 2 spelled out where a reader is looking at one person rather than at the
                      grid: this bed is gone from the ward's count, and the person is not here. */}
                    {selectedTile.kind === "waiting" && (
                      <p className={styles.personLine}>
                        This ward has already given this bed away. It is taken, not free, and nobody has arrived.
                      </p>
                    )}
                  </div>
                ) : (
                  /* Unreachable while the grid and the list are built from the same two calls, and
                   said rather than rendered blank if it ever is: an empty panel would read as a
                   loading failure, and inventing a person to fill it is the one thing this board
                   must never do. */
                  <p className={styles.personLine}>No record could be read for this bed.</p>
                )
              ) : (
                <div data-testid="ward-board-detail-bed-class">
                  <p className={styles.detailLead}>
                    {selectedTile.kind === "empty"
                      ? `One of this ward's ${emptyTileCount} bed${emptyTileCount === 1 ? "" : "s"} a coordinator can fill right now.`
                      : selectedTile.kind === "held"
                        ? `One of this ward's ${heldTileCount} bed${heldTileCount === 1 ? "" : "s"} that are empty but not yet confirmed as ones this ward will offer.`
                        : `One of this ward's ${blockedTileCount} bed${blockedTileCount === 1 ? "" : "s"} that are out of service and cannot be filled today.`}
                  </p>
                  {/* The constraint the header already carries, repeated here only where it bites: a
                    reader looking at a fillable bed is exactly the reader who needs to know what
                    will and will not go in it. `constraintSentence` returns null rather than an
                    empty string when nothing constrains. */}
                  {selectedTile.kind === "empty" && constraint !== null && (
                    <p className={styles.personLine}>{constraint}</p>
                  )}
                  {/*
                   * THE LINE THAT KEEPS SELECTION HONEST. `Unit.blocked` is a count and
                   * `unitCapacity`'s held/available split is derived from two more counts; no record
                   * anywhere says WHICH bed. So a reader who has just clicked one of these tiles is
                   * told, on the panel, that they have selected a class of bed and not a location.
                   */}
                  <p className={styles.detailNotLocation}>
                    Which bed is not recorded. An admission records the ward it is on and never a bed, so this tile is
                    one of a count and not a place on the ward.
                  </p>
                </div>
              )}
            </aside>
          )}
        </div>

        {/*
         * WHERE THESE BEDS FREE UP TO — from `arrowTargets`, which existed fully tested with zero
         * consumers until this board became its first.
         *
         * **It has moved out of the left column, and the reason is a measured one rather than a
         * preference.** In a 17rem sidebar it was 746px tall — 55% of a 1362px column, and by itself
         * taller than the whole middle column beside it (439px) — because the longest team name,
         * "Goldfields-Esperance Community Mental Health Team (placeholder)", needs roughly 380px to
         * sit on one line and had 272px to do it in. Eight entries each wrapped to two lines, and the
         * panel's height was almost entirely the cost of that wrapping. **The content is wide; the
         * column was not.** Nothing here was shortened, generalised or dropped to fix it: all eight
         * regions, their counts, their soonest days and their team names are on the page exactly as
         * before, in a full-width band where each one fits on a single line.
         *
         * The alternative considered and REJECTED was stating the naming convention once in the intro
         * and dropping the per-row team name. It reads well against today's fixture — every value in
         * `COMMUNITY_TEAMS` is "<Region> Community Mental Health Team (placeholder)" — but that file's
         * own comment says the product owner may later supply real team names, at which point a
         * sentence claiming the convention becomes a false statement on a clinical screen that no test
         * would catch. A layout must not depend on a fixture happening to be formulaic.
         *
         * It sits BELOW the three zones rather than inside one, for the same reason the triage bar
         * sits above them: this is a ward-level aggregate, not a per-bed or per-column fact. The
         * left-to-right reading is untouched — coming in and going out are still LEFT, the beds
         * MIDDLE, the chosen bed RIGHT — and this band is the tail of the "Going out today" list,
         * read last, which is where a departure story ends.
         *
         * **There are deliberately no drawn arrows, and that is a correctness decision rather than
         * a simplification.** Connector geometry on the coordinator's diagrams is measured in
         * JavaScript from the live screen layout and never re-measured for print, so a printed
         * route line points at whichever ward has since moved under it — proven on paper this
         * session, and the reason those connectors are now hidden in print entirely. Drawing
         * eighteen bed-to-region arrows would import that failure and add a spaghetti of lines
         * nobody can follow. The connection is carried by a shared REGION NAME on both sides
         * instead. Words survive greyscale, a stripped-background print and forced-colors;
         * measured coordinates survive none of it.
         *
         * Scoped to `ARROW_HORIZON_DAYS`, so this is a short list a flow meeting can read, not a
         * second copy of the bed list. Someone with no expected date is absent entirely rather
         * than defaulted — nobody has said when they are leaving, so the board says nothing.
         */}
        {targets.length > 0 && (
          <aside className={styles.destinations} aria-labelledby="ward-board-destinations-heading">
            <h2 id="ward-board-destinations-heading" className={styles.destinationsHeading}>
              Where these beds free up to
            </h2>
            <p className={styles.destinationsIntro}>Expected within {ARROW_HORIZON_DAYS} days, soonest first.</p>
            <ol className={styles.destinationList} data-testid="ward-board-destinations">
              {targets.map((target) => {
                const team = teamForRegion(target.region);
                return (
                  <li
                    key={target.region}
                    className={styles.destination}
                    data-testid={`ward-board-destination-${target.region}`}
                  >
                    <p className={styles.destinationRegion}>{target.region}</p>
                    <p className={styles.destinationCount}>
                      {target.count} {target.count === 1 ? "person" : "people"}
                      {" · "}
                      {target.nearestDays === 0
                        ? "soonest due now or overdue"
                        : `soonest in ${target.nearestDays} day${target.nearestDays === 1 ? "" : "s"}`}
                    </p>
                    {/* `teamForRegion` returns null for a region with no recorded team rather than a
                      placeholder string, so a missing team must never be swallowed by the panel's
                      general shape. It used to render as NOTHING, which reads as a row that happens
                      to be shorter; it is now said in words, because "there is nobody to ring about
                      this region" is exactly the kind of fact a coordinator chasing a discharge
                      needs to see rather than infer from a gap. */}
                    {team !== null ? (
                      <p className={styles.destinationTeam}>{team}</p>
                    ) : (
                      <p className={styles.destinationTeamAbsent}>No community team is recorded for this region.</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </aside>
        )}

        {/*
         * WHO IS IN THESE BEDS — every occupant with their discharge plan, and on paper only.
         *
         * **This is the 281bdf83f deliverable, kept whole rather than lost to the slide-out.** That
         * commit's panel listed every occupant with when they are expected out, who set the date, how
         * many times it has moved, whether the ward has confirmed it and what is holding it up. The
         * owner has replaced it ON SCREEN with a per-selection panel, which is his call; none of that
         * makes the printed sheet worse, and a sheet carrying only whoever was last clicked would be
         * a page whose content depends on an interaction that left no mark on it. So the screen shows
         * one person on request and the paper shows all of them, which is what each medium is good
         * at: the screen is interactive and the sheet is not.
         *
         * It is `display: none` on screen and restored in the print block — the only hidden content on
         * this board, and hidden in the direction that ADDS to the sheet rather than removing from it.
         * The rendered rows are what the existing suite in `tests/ward-board-people-panel.dom.test.tsx`
         * asserts against (rows + blocked + held + empty === `unit.beds`, ordering, provenance, no
         * diagnosis), so every one of those invariants still has a live subject after the rebuild.
         *
         * The list is NOT truncated and must not become so. Eighteen people is a long sheet, and a
         * "top 5" with the rest hidden is worse than no list, because nobody reading it can tell that
         * anything is missing.
         */}
        <aside className={styles.people} aria-labelledby="ward-board-people-heading">
          <h2 id="ward-board-people-heading" className={styles.peopleHeading}>
            Who is in these beds
          </h2>
          <p className={styles.peopleIntro}>
            Every occupant of this ward, soonest expected out first; anyone with no date set is last.
          </p>
          {/* An empty list under a heading reads as a panel that failed to load rather than as a ward
            with nobody in it, so the absence is said in words. `constraintSentence` returns null for
            the same reason a few lines up. */}
          {occupants.length === 0 && <p className={styles.personLine}>Nobody is recorded in a bed on this ward.</p>}
          <ol className={styles.peopleList} data-testid="ward-board-people">
            {occupants.map((occupant) => (
              <li
                key={occupant.key}
                className={`${styles.person}${occupant.key === selectedKey ? ` ${styles.personSelected}` : ""}`}
                data-testid={`ward-board-person-${occupant.key}`}
              >
                {/* Selection on paper is WEIGHT and a word, never a fill: on a sheet that has made no
                  decision a filled element reads as a decision made. */}
                {occupant.key === selectedKey && <p className={styles.personSelectedMark}>Selected on screen</p>}
                <PersonEntry occupant={occupant} idPrefix="ward-board-person" />
              </li>
            ))}
          </ol>
        </aside>

        <p className={styles.footnote} data-testid="ward-board-footnote">
          {tiles.length} tile{tiles.length === 1 ? "" : "s"}, one per recorded bed. A tile carries no bed number — an
          admission records the ward it is on, never a bed. “Empty, waiting” is a bed this ward has already given away
          to somebody who has not arrived yet; it is taken, not free.
          {/* Only said on a ward that HAS one. Rendered unconditionally it read "this ward records 0
            of them, and which particular beds are out of service is not recorded" — a paragraph
            explaining, at length, a tile the reader cannot see and this ward does not have. Found
            by rendering `rph-adult-secure`, which has no blocked beds, not by looking at `fsh`
            where the sentence happened to make sense. */}
          {unit.blocked > 0 && (
            <>
              {" "}
              “Out of service” beds cannot be filled either — this ward records {unit.blocked} of them, and which
              particular {unit.blocked === 1 ? "bed is" : "beds are"} out of service is not recorded, so the tiles
              marked here are a count and not a location.
            </>
          )}
          {/* Task B, same "only said on a ward that HAS one" discipline as the blocked sentence just
            above — `rph-adult-secure` has one held bed, `fsh-adult-secure` has none, and this ward
            board must not describe a tile the reader cannot see. `heldTileCount` is what was
            actually drawn (already clamped into the physically-empty pool), never the raw,
            unclamped `unitCapacity(...).held` figure — the footnote must describe the screen, not
            a number that could disagree with it. */}
          {heldTileCount > 0 && (
            <>
              {" "}
              “Held” beds are empty but not yet confirmed as ones this ward will offer — this ward has {
                heldTileCount
              }{" "}
              of them right now, and which particular {heldTileCount === 1 ? "bed is" : "beds are"} held is not
              recorded, so the tiles marked here are a count and not a location.
            </>
          )}
        </p>
      </main>
    </div>
  );
}

/**
 * An EXHAUSTIVE switch on `tile.kind`, not a chain of early returns ending in the occupied case as
 * the fall-through — which is how the blocked tile was broken the moment it was added.
 *
 * The chain read `if empty … if waiting … otherwise treat it as occupied`, so the new third kind
 * silently took the occupied branch, read a `bandId` it does not have, and rendered with the class
 * name `"undefined"` and an occupied fill. **Nothing failed.** `"undefined"` is a legal class name
 * that matches no rule, the tile still drew, and it drew in a plausible-looking colour. It was
 * found by sampling the rendered background of every tile kind on the page — not by a test, and
 * not by reading the diff, where the missing branch is an absence rather than a mistake.
 *
 * The `never` binding below is the guard against the next kind: adding a fifth `Tile` variant and
 * forgetting this function becomes a compile error instead of another silently mis-styled tile.
 */
function tileClassName(tile: Tile, selected: boolean): string {
  /* Selection is a WEIGHT — a heavier edge — and never a fill. On a sheet that has made no
     decision a filled element reads as a decision made, which is the failure the whole
     colour-never-alone rule exists to prevent; and a fill would additionally collide with the four
     band shades, so a selected band-2 tile would stop being readable as band 2. The word "Selected"
     on the tile face is the channel that survives greyscale and a stripped-background print. */
  const mark = selected ? ` ${styles.bedSelected}` : "";
  switch (tile.kind) {
    case "empty":
      return `${styles.bed} ${styles.bedEmpty}${mark}`;
    case "waiting":
      return `${styles.bed} ${styles.bedWaiting}${mark}`;
    case "blocked":
      return `${styles.bed} ${styles.bedBlocked}${mark}`;
    case "held":
      return `${styles.bed} ${styles.bedHeld}${mark}`;
    case "occupied": {
      const band = tile.bandId === null ? "" : ` ${BAND_CLASS[tile.bandId]}`;
      const past = tile.pastDate ? ` ${styles.bedPast}` : "";
      return `${styles.bed} ${styles.bedOccupied}${band}${past}${mark}`;
    }
    default: {
      // Unreachable while the switch is exhaustive; a new variant fails to assign here.
      const unhandled: never = tile;
      throw new Error(`Unhandled ward-board tile kind: ${JSON.stringify(unhandled)}`);
    }
  }
}
