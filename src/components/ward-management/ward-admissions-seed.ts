import type { Admission, LeavingDestination } from "@/components/ward-management/ward-admissions";
import type { BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { HomeRegion, Sex } from "@/components/ward-management/ward-model";

/**
 * The synthetic people occupying beds across the network.
 *
 * Until this fixture existed the prototype knew a ward had 20 beds and 3 empty and NOTHING about
 * anybody in one, so every occupancy figure was a number a ward hand-maintained. Two features are
 * derived from what is here — the ward board and the out-of-area ledger — and both are only as
 * honest as this file.
 *
 * **The one constraint everything else is shaped around:** for every unit, the people in the beds
 * must agree EXACTLY with that unit's own recorded `sexMix` in `ward-sites.ts`, for both sexes.
 * That is what lets the hand-maintained count be replaced by the derived one without a single
 * ward's figures moving, and `tests/ward-admissions-seed.test.ts` is what holds it true. Every
 * occupant below is therefore written out explicitly, one line each: nothing in this file reads a
 * unit's `sexMix` back and tops itself up to match, because a fixture that derived itself from the
 * number it is checked against could never disagree with it, and the check would be a check that
 * cannot fail.
 *
 * The same standing rules as `ward-admissions.ts` govern every value here, and this file adds no
 * vocabulary of its own:
 *
 *   1. **No figure from the Mental Health Act.** Not a duration, not a timeframe, not a threshold.
 *      The stay lengths, expected dates and transport delays below are invented operational
 *      numbers exactly like every bed count in `ward-sites.ts`; none of them is a legal clock and
 *      none may ever be read as one.
 *   2. **Chosen, never typed.** Every sex, home region, blocker and destination below comes from
 *      an existing fixed runtime array (`SEXES`, `HOME_REGIONS`, `BED_RELEASE_BLOCKERS`,
 *      `LEAVING_DESTINATIONS`). There is no free text anywhere in this file.
 *   3. **No diagnosis, no name, no date of birth, no record number, no address.** An `Admission`
 *      cannot express any of those, and nothing here works around that.
 *
 * **This fixture carries no travel band and no distance.** Where somebody is from is recorded as a
 * region; how far that is from their bed is looked up through `ward-distance.ts` by whoever needs
 * it, never stored here. The seed deliberately contains occupants whose region/site pair that
 * table does not record at all, so the ledger's separate "not recorded" group has real content.
 */

/**
 * The synthetic "now" every instant in this file is authored against — the same operating-day
 * anchor `ward-sites.ts` and `ward-movements.ts` are authored against, and it must stay equal to
 * it.
 *
 * **Written out here rather than imported, deliberately and reluctantly.** The single-source guard
 * in `tests/ward-flow-single-source.test.ts` restricts every read of that constant anywhere under
 * `src` to three named files, and this one is not among them; adding it would mean editing that
 * test. So this is a second copy, and a second copy is exactly the shape this codebase distrusts —
 * the two can drift. It is flagged rather than hidden: if the shared anchor ever moves, this value
 * moves with it in the same change.
 */
export const WARD_ADMISSIONS_ANCHOR: Instant = 10 * 60 + 42;

/**
 * How long before somebody arrives the bed was given away, in minutes.
 *
 * An INVENTED operational figure, like every bed number in this prototype. It exists so that a
 * seeded occupant's `pulledAt` and `arrivedAt` are two genuinely different instants — the bed is
 * gone from the pull, the stay runs from the arrival — rather than the same number twice, which is
 * how a reader (or a later refactor) comes to believe the two clocks are interchangeable. Nothing
 * legal, nothing clinical, nothing measured.
 */
const PULL_TO_ARRIVAL_MINUTES = 5 * 60;

/**
 * A part-day offset added to every arrival so a stay of `n` days lands squarely inside day `n`
 * rather than on the boundary. Exactly-on-the-boundary arrivals would make the band a seeded stay
 * falls into depend on rounding, and `STAY_BANDS`'s ceilings are exclusive.
 */
const ARRIVAL_PART_DAY_MINUTES = 90;

/**
 * Who set the expected discharge date, as a ROLE and never a personal name.
 *
 * Both strings are quoted verbatim from `Admission.dischargeDateSetBy`'s own doc comment, which is
 * the only place this field's vocabulary is written down — the field is typed `string | null` and
 * has no fixed runtime array of its own, unlike every other category on the record. That gap is
 * flagged in this task's report; nothing here invents a vocabulary to fill it.
 */
const DISCHARGE_DATE_SETTERS = ["Flow coordinator", "Nurse unit manager"] as const;

/**
 * One seeded occupant of a bed, written as a tuple so a whole ward reads as a list of people
 * rather than as pages of object literals.
 *
 *   - `stayDays` — whole days this person has been in the bed, or `null` for a bed that has been
 *     GIVEN AWAY to somebody who has not arrived yet. That bed is occupied (`bedIsOccupied` counts
 *     `"pulled"`), it counts in the ward's sex mix, and it has no stay at all.
 *   - `dischargeInDays` — whole days from the anchor to the ward's own expected discharge date.
 *     Negative means the date has already passed and the person is still here. `null` means nobody
 *     has set one, which is an ordinary state and never a stand-in for "not yet due".
 */
type Occupant = readonly [
  sex: Sex,
  homeRegion: HomeRegion,
  stayDays: number | null,
  dischargeInDays: number | null,
  extras?: OccupantExtras,
];

type OccupantExtras = {
  /** What is holding this bed up, drawn from `BED_RELEASE_BLOCKERS`. */
  readonly blockReason?: BedReleaseBlocker;
};

/**
 * Builds one ward's occupants from the list above.
 *
 * Ids follow `ward-movements.ts`'s house scheme — a short stable prefix and a sequence, stable
 * across edits to other wards. The referral id carries the admission's own suffix: in this
 * synthetic network each admission came from exactly one referral, and none of the eight referrals
 * still at the front door in `ward-movements.ts` has been admitted, so these ids are a disjoint
 * historical block rather than a join into that queue.
 *
 * Lifecycle coherence is enforced HERE, at construction, so no hand-edited line can produce a
 * pulled admission that has somehow already arrived. The whole-set coherence assertion in the test
 * file is the guard for anything later added as a literal rather than through this builder.
 */
function unitOccupants(unitId: string, tag: string, occupants: readonly Occupant[]): Admission[] {
  return occupants.map(([sex, homeRegion, stayDays, dischargeInDays, extras], index) => {
    const suffix = `${tag}-${String(index + 1).padStart(2, "0")}`;
    const blockReason = extras?.blockReason ?? null;

    if (stayDays === null) {
      // The bed is gone; the person is not here. No stay, no plan, no blocker.
      return {
        id: `AD-${suffix}`,
        unitId,
        referralId: `RF-${suffix}`,
        sex,
        homeRegion,
        state: "pulled",
        pulledAt: WARD_ADMISSIONS_ANCHOR - PULL_TO_ARRIVAL_MINUTES - index * 30,
        arrivedAt: null,
        expectedDischargeAt: null,
        dischargeDateMoves: 0,
        dischargeDateSetAt: null,
        dischargeDateSetBy: null,
        blockReason: null,
        leavingDestination: null,
        leftAt: null,
      };
    }

    const arrivedAt = WARD_ADMISSIONS_ANCHOR - stayDays * MINUTES_PER_DAY - ARRIVAL_PART_DAY_MINUTES;
    const hasDate = dischargeInDays !== null;

    return {
      id: `AD-${suffix}`,
      unitId,
      referralId: `RF-${suffix}`,
      sex,
      homeRegion,
      state: "occupied",
      pulledAt: arrivedAt - PULL_TO_ARRIVAL_MINUTES,
      arrivedAt,
      expectedDischargeAt: hasDate ? WARD_ADMISSIONS_ANCHOR + dischargeInDays * MINUTES_PER_DAY : null,
      dischargeDateMoves: hasDate ? index % 3 : 0,
      dischargeDateSetAt: hasDate ? WARD_ADMISSIONS_ANCHOR - (6 + (index % 5) * 5) * 60 : null,
      dischargeDateSetBy: hasDate ? DISCHARGE_DATE_SETTERS[index % DISCHARGE_DATE_SETTERS.length] : null,
      blockReason,
      leavingDestination: null,
      leftAt: null,
    };
  });
}

/** A completed admission — the bed is back. See `departures` below for why each one is here. */
type Departure = {
  readonly id: string;
  readonly unitId: string;
  readonly sex: Sex;
  readonly homeRegion: HomeRegion;
  /** Whole days the completed stay lasted. */
  readonly stayDays: number;
  /** Minutes before the anchor that this person left. */
  readonly leftMinutesAgo: number;
  readonly destination: LeavingDestination;
};

function departed(departure: Departure): Admission {
  const leftAt = WARD_ADMISSIONS_ANCHOR - departure.leftMinutesAgo;
  const arrivedAt = leftAt - departure.stayDays * MINUTES_PER_DAY;
  return {
    id: departure.id,
    unitId: departure.unitId,
    referralId: departure.id.replace(/^AD-/, "RF-"),
    sex: departure.sex,
    homeRegion: departure.homeRegion,
    state: "left",
    pulledAt: arrivedAt - PULL_TO_ARRIVAL_MINUTES,
    arrivedAt,
    expectedDischargeAt: leftAt,
    dischargeDateMoves: 1,
    dischargeDateSetAt: leftAt - 2 * MINUTES_PER_DAY,
    dischargeDateSetBy: DISCHARGE_DATE_SETTERS[0],
    blockReason: null,
    leavingDestination: departure.destination,
    leftAt,
  };
}

/** Somebody accepted in principle with no bed given. Consumes nothing and counts in no mix. */
function waiting(id: string, unitId: string, sex: Sex, homeRegion: HomeRegion): Admission {
  return {
    id,
    unitId,
    referralId: id.replace(/^AD-/, "RF-"),
    sex,
    homeRegion,
    state: "waitlisted",
    pulledAt: null,
    arrivedAt: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
  };
}

/**
 * Everyone currently holding a bed, ward by ward, in the order `ward-sites.ts` declares them.
 *
 * Each ward's list is exactly as long as that ward's own occupied-bed count (`beds` less `empty`
 * less `blocked`), and its sexes are exactly that ward's recorded `sexMix`. Both are hand-written
 * here, so changing one person's sex makes the seed disagree with the network and the consistency
 * test goes red — which is the point.
 *
 * Stay lengths are spread so all four `STAY_BANDS` appear many times over rather than once each: a
 * band with a single instance makes a banding test pass on a coincidence.
 */
const occupiedBeds: Admission[] = [
  ...unitOccupants("rph-adult-secure", "RPHS", [
    ["Female", "South West", 34, -2, { blockReason: "Awaiting accommodation" }],
    ["Male", "Kimberley", 5, 3],
    ["Male", "Peel", null, null],
    ["Female", "Perth Metropolitan", 3, null],
    ["Male", "Great Southern", 12, 4],
    ["Female", "Mid West", 45, 6],
    ["Male", "Kimberley", 130, -2],
    ["Female", "South West", 5, 9],
    ["Male", "Goldfields-Esperance", 20, 2],
    ["Female", "Pilbara", 60, 8],
    ["Male", "Peel", 2, null],
    ["Female", "Wheatbelt", 95, 3],
    ["Male", "Gascoyne", 33, 5],
    ["Female", "Perth Metropolitan", 6, -3],
    ["Male", "Great Southern", 210, 10, { blockReason: "Awaiting clean" }],
    ["Female", "Mid West", 17, 4],
    ["Male", "Kimberley", 75, 2],
    ["Female", "South West", 4, 5],
  ]),
  ...unitOccupants("rph-older-adult", "RPHO", [
    ["Female", "Goldfields-Esperance", 9, null],
    ["Male", "Pilbara", 115, 1],
    ["Female", "Peel", 40, -1],
    ["Male", "Wheatbelt", 1, 7],
    ["Female", "Gascoyne", 26, 3],
    ["Male", "Perth Metropolitan", 3, null],
    ["Female", "Great Southern", 12, 4],
    ["Male", "Mid West", 45, 6],
    ["Female", "Kimberley", 130, -2],
    ["Male", "South West", 5, 9],
    ["Female", "Goldfields-Esperance", 20, 2],
    ["Male", "Pilbara", 60, 8],
  ]),
  ...unitOccupants("scgh-adult-open", "SCGA", [
    ["Female", "Pilbara", null, null],
    ["Male", "Peel", 210, null],
    ["Female", "South West", 61, -1, { blockReason: "Awaiting transport" }],
    ["Female", "Peel", 2, null],
    ["Male", "Wheatbelt", 95, 3],
    ["Female", "Gascoyne", 33, 5],
    ["Male", "Perth Metropolitan", 6, -3],
    ["Female", "Great Southern", 210, 10],
    ["Male", "Mid West", 17, 4],
    ["Female", "Kimberley", 75, 2],
    ["Male", "South West", 4, 5],
    ["Female", "Goldfields-Esperance", 9, null],
    ["Male", "Pilbara", 115, 1],
    ["Female", "Peel", 40, -1],
    ["Male", "Wheatbelt", 1, 7],
    ["Female", "Gascoyne", 26, 3],
    ["Male", "Perth Metropolitan", 3, null, { blockReason: "Awaiting pharmacy" }],
    ["Female", "Great Southern", 12, 4],
    ["Male", "Mid West", 45, 6],
  ]),
  ...unitOccupants("scgh-older-adult", "SCGO", [
    ["Female", "Kimberley", 130, -2],
    ["Male", "South West", 5, 9],
    ["Female", "Goldfields-Esperance", 20, 2],
    ["Male", "Pilbara", 60, 8],
    ["Female", "Peel", 2, null],
    ["Male", "Wheatbelt", 95, 3],
    ["Female", "Gascoyne", 33, 5],
    ["Male", "Perth Metropolitan", 6, -3],
    ["Female", "Great Southern", 210, 10],
    ["Male", "Mid West", 17, 4],
    ["Female", "Kimberley", 75, 2],
    ["Male", "South West", 4, 5],
    ["Female", "Goldfields-Esperance", 9, null],
    ["Male", "Pilbara", 115, 1],
    ["Female", "Peel", 40, -1],
  ]),
  ...unitOccupants("fsh-adult-secure", "FSHS", [
    ["Male", "Perth Metropolitan", 122, 6],
    ["Male", "Wheatbelt", 1, 7],
    ["Male", "Gascoyne", 26, 3],
    ["Male", "Perth Metropolitan", 3, null],
    ["Male", "Great Southern", 12, 4],
    ["Male", "Mid West", 45, 6],
    ["Male", "Kimberley", 130, -2],
    ["Male", "South West", 5, 9],
    ["Male", "Goldfields-Esperance", 20, 2],
    ["Male", "Pilbara", 60, 8],
    ["Male", "Peel", 2, null],
    ["Male", "Wheatbelt", 95, 3],
    ["Male", "Gascoyne", 33, 5, { blockReason: "Awaiting placement confirmation" }],
    ["Male", "Perth Metropolitan", 6, -3],
  ]),
  ...unitOccupants("fsh-older-adult", "FSHO", [
    ["Female", "Great Southern", 210, 10],
    ["Male", "Mid West", 17, 4],
    ["Female", "Kimberley", 75, 2],
    ["Male", "South West", 4, 5],
    ["Female", "Goldfields-Esperance", 9, null],
    ["Male", "Pilbara", 115, 1],
    ["Female", "Peel", 40, -1],
    ["Male", "Wheatbelt", 1, 7],
    ["Female", "Gascoyne", 26, 3],
    ["Male", "Perth Metropolitan", 3, null],
    ["Female", "Great Southern", 12, 4],
  ]),
  ...unitOccupants("arm-adult-open", "ARMA", [
    ["Female", "Perth Metropolitan", 12, null],
    ["Male", "Perth Metropolitan", 48, -4, { blockReason: "Awaiting receiving-service acceptance" }],
    ["Female", "Mid West", 45, 6],
    ["Male", "Kimberley", 130, -2],
    ["Female", "South West", 5, 9],
    ["Male", "Goldfields-Esperance", 20, 2],
    ["Female", "Pilbara", 60, 8],
    ["Male", "Peel", 2, null],
    ["Female", "Wheatbelt", 95, 3],
    ["Male", "Gascoyne", 33, 5],
    ["Female", "Perth Metropolitan", 6, -3],
    ["Male", "Great Southern", 210, 10],
    ["Female", "Mid West", 17, 4],
    ["Male", "Kimberley", 75, 2],
    ["Female", "South West", 4, 5],
    ["Male", "Goldfields-Esperance", 9, null],
  ]),
  ...unitOccupants("sjgm-adult-open", "SJGA", [
    ["Female", "Pilbara", 115, 1],
    ["Male", "Peel", 40, -1],
    ["Female", "Wheatbelt", 1, 7, { blockReason: "Awaiting service coordination" }],
    ["Male", "Gascoyne", 26, 3],
    ["Female", "Perth Metropolitan", 3, null],
    ["Male", "Great Southern", 12, 4],
    ["Female", "Mid West", 45, 6],
    ["Male", "Kimberley", 130, -2],
    ["Female", "South West", 5, 9],
    ["Male", "Goldfields-Esperance", 20, 2],
    ["Female", "Pilbara", 60, 8],
    ["Male", "Peel", 2, null],
    ["Female", "Wheatbelt", 95, 3],
    ["Male", "Gascoyne", 33, 5],
  ]),
  ...unitOccupants("rgh-adult-secure", "RGHS", [
    ["Female", "Perth Metropolitan", 6, -3],
    ["Male", "Great Southern", 210, 10],
    ["Female", "Mid West", 17, 4],
    ["Male", "Kimberley", 75, 2],
    ["Female", "South West", 4, 5],
    ["Male", "Goldfields-Esperance", 9, null],
    ["Female", "Pilbara", 115, 1],
    ["Male", "Peel", 40, -1],
    ["Female", "Wheatbelt", 1, 7],
    ["Male", "Gascoyne", 26, 3],
    ["Female", "Perth Metropolitan", 3, null],
    ["Male", "Great Southern", 12, 4],
    ["Female", "Mid West", 45, 6],
  ]),
  ...unitOccupants("fre-adult-open", "FREA", [
    ["Female", "Kimberley", 130, -2],
    ["Male", "South West", 5, 9],
    ["Female", "Goldfields-Esperance", 20, 2],
    ["Male", "Pilbara", 60, 8],
    ["Female", "Peel", 2, null, { blockReason: "Awaiting accommodation" }],
    ["Male", "Wheatbelt", 95, 3],
    ["Female", "Gascoyne", 33, 5],
    ["Male", "Perth Metropolitan", 6, -3],
    ["Female", "Great Southern", 210, 10],
    ["Male", "Mid West", 17, 4],
    ["Female", "Kimberley", 75, 2],
    ["Male", "South West", 4, 5],
    ["Female", "Goldfields-Esperance", 9, null],
    ["Male", "Pilbara", 115, 1],
    ["Female", "Peel", 40, -1],
    ["Male", "Wheatbelt", 1, 7],
    ["Female", "Gascoyne", 26, 3],
    ["Male", "Perth Metropolitan", 3, null],
  ]),
  ...unitOccupants("fre-older-adult", "FREO", [
    ["Female", "Great Southern", 12, 4],
    ["Male", "Mid West", 45, 6],
    ["Female", "Kimberley", 130, -2],
    ["Male", "South West", 5, 9],
    ["Female", "Goldfields-Esperance", 20, 2],
    ["Male", "Pilbara", 60, 8],
    ["Female", "Peel", 2, null],
    ["Male", "Wheatbelt", 95, 3],
    ["Female", "Gascoyne", 33, 5],
    ["Male", "Perth Metropolitan", 6, -3],
    ["Female", "Great Southern", 210, 10],
  ]),
  ...unitOccupants("bty-adult-secure", "BTYS", [
    ["Female", "Mid West", 17, 4],
    ["Male", "Kimberley", 75, 2],
    ["Female", "South West", 4, 5],
    ["Male", "Goldfields-Esperance", 9, null],
    ["Female", "Pilbara", 115, 1, { blockReason: "Awaiting transport" }],
    ["Male", "Peel", 40, -1],
    ["Female", "Wheatbelt", 1, 7],
    ["Male", "Gascoyne", 26, 3],
    ["Female", "Perth Metropolitan", 3, null],
    ["Male", "Great Southern", 12, 4],
    ["Female", "Mid West", 45, 6],
    ["Male", "Kimberley", 130, -2],
    ["Female", "South West", 5, 9],
    ["Male", "Goldfields-Esperance", 20, 2],
  ]),
  ...unitOccupants("bty-older-adult", "BTYO", [
    ["Female", "Pilbara", 60, 8],
    ["Male", "Peel", 2, null],
    ["Female", "Wheatbelt", 95, 3],
    ["Male", "Gascoyne", 33, 5],
    ["Female", "Perth Metropolitan", 6, -3],
    ["Male", "Great Southern", 210, 10],
    ["Female", "Mid West", 17, 4],
    ["Male", "Kimberley", 75, 2],
    ["Female", "South West", 4, 5],
    ["Male", "Goldfields-Esperance", 9, null],
  ]),
  ...unitOccupants("bty-youth", "BTYY", [
    ["Male", "Wheatbelt", null, null],
    ["Female", "Pilbara", 115, 1],
    ["Male", "Peel", 40, -1],
    ["Female", "Wheatbelt", 1, 7],
    ["Male", "Gascoyne", 26, 3],
    ["Female", "Perth Metropolitan", 3, null],
    ["Male", "Great Southern", 12, 4],
  ]),
  ...unitOccupants("gry-adult-secure", "GRYS", [
    ["Female", "Mid West", 45, 6],
    ["Male", "Kimberley", 130, -2],
    ["Female", "South West", 5, 9],
    ["Male", "Goldfields-Esperance", 20, 2, { blockReason: "Awaiting receiving-service acceptance" }],
    ["Female", "Pilbara", 60, 8],
    ["Male", "Peel", 2, null],
    ["Female", "Wheatbelt", 95, 3],
    ["Male", "Gascoyne", 33, 5],
    ["Female", "Perth Metropolitan", 6, -3],
    ["Male", "Great Southern", 210, 10],
    ["Female", "Mid West", 17, 4],
    ["Male", "Kimberley", 75, 2],
    ["Female", "South West", 4, 5],
  ]),
  ...unitOccupants("gry-older-adult", "GRYO", [
    ["Female", "Goldfields-Esperance", 9, null],
    ["Male", "Pilbara", 115, 1],
    ["Female", "Peel", 40, -1],
    ["Male", "Wheatbelt", 1, 7],
    ["Female", "Gascoyne", 26, 3],
    ["Male", "Perth Metropolitan", 3, null],
    ["Female", "Great Southern", 12, 4],
    ["Male", "Mid West", 45, 6],
    ["Female", "Kimberley", 130, -2],
  ]),
  ...unitOccupants("alb-adult-open", "ALBA", [
    ["Female", "Great Southern", 150, 2],
    ["Female", "South West", 5, 9],
    ["Male", "Goldfields-Esperance", 20, 2],
    ["Female", "Pilbara", 60, 8],
    ["Male", "Peel", 2, null],
    ["Female", "Wheatbelt", 95, 3],
    ["Male", "Gascoyne", 33, 5],
  ]),
  ...unitOccupants("bun-adult-open", "BUNA", [
    ["Female", "Perth Metropolitan", 6, -3],
    ["Male", "Great Southern", 210, 10],
    ["Female", "Mid West", 17, 4],
    ["Male", "Kimberley", 75, 2],
    ["Female", "South West", 4, 5, { blockReason: "Awaiting family or carer arrangement" }],
    ["Male", "Goldfields-Esperance", 9, null],
    ["Female", "Pilbara", 115, 1],
  ]),
  ...unitOccupants("brm-adult-secure", "BRMS", [
    ["Male", "Kimberley", 7, -1],
    ["Male", "Peel", 40, -1],
    ["Male", "Wheatbelt", 1, 7],
    ["Male", "Gascoyne", 26, 3],
    ["Male", "Perth Metropolitan", 3, null],
  ]),
  ...unitOccupants("ger-adult-open", "GERA", [
    ["Female", "Mid West", 91, 5, { blockReason: "Awaiting family or carer arrangement" }],
    ["Female", "Great Southern", 12, 4],
    ["Female", "Mid West", 45, 6],
    ["Female", "Kimberley", 130, -2],
    ["Female", "South West", 5, 9],
    ["Female", "Goldfields-Esperance", 20, 2],
  ]),
  ...unitOccupants("kun-adult-open", "KUNA", [
    ["Female", "Kimberley", 4, 1],
    ["Female", "Pilbara", 60, 8],
    ["Male", "Peel", 2, null],
    ["Female", "Wheatbelt", 95, 3],
    ["Male", "Gascoyne", 33, 5],
  ]),
  ...unitOccupants("sjgs-adult-open", "SJSA", [
    ["Female", "Perth Metropolitan", 6, -3],
    ["Male", "Great Southern", 210, 10],
    ["Female", "Mid West", 17, 4],
    ["Male", "Kimberley", 75, 2],
    ["Female", "South West", 4, 5],
    ["Male", "Goldfields-Esperance", 9, null],
    ["Female", "Pilbara", 115, 1],
    ["Male", "Peel", 40, -1],
  ]),
  ...unitOccupants("sjgs-adult-secure", "SJSS", [
    ["Female", "Wheatbelt", 1, 7],
    ["Male", "Gascoyne", 26, 3],
    ["Female", "Perth Metropolitan", 3, null],
    ["Male", "Great Southern", 12, 4],
    ["Female", "Mid West", 45, 6],
    ["Male", "Kimberley", 130, -2, { blockReason: "Awaiting clean" }],
    ["Female", "South West", 5, 9],
  ]),
];

/**
 * Admissions that have ENDED. None of them holds a bed, so none counts in any ward's sex mix.
 *
 * Five, each carrying a different destination, because `LEAVING_DESTINATIONS` is the one list in
 * this feature where an entry's meaning differs from its neighbours': exactly one destination does
 * NOT return a bed to the state.
 *
 * **`AD-LEFT-02` is the only transfer to another psychiatric ward in the whole seed, and that is
 * deliberate.** It is the single seeded case of a departure that frees the SENDING ward's bed and
 * gives the network nothing — the person still occupies a psychiatric bed, just a different one.
 * Any statewide release figure that quietly counted it would otherwise pass every test in this
 * repository, because there would be no seeded case to catch it. Changing this one destination is
 * the mutation that proves the coverage test can fail; do not add a second transfer without
 * knowing you have weakened that proof.
 *
 * `AD-LEFT-01` (Perth Metropolitan, at Armadale) and `AD-LEFT-04` (Great Southern, at Albany) are
 * both departures from beds that `ward-distance.ts` bands as out of area, so the ledger's exit path
 * has seeded content and does not depend on that single transfer record either.
 */
const departures: Admission[] = [
  departed({
    id: "AD-LEFT-01",
    unitId: "arm-adult-open",
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    stayDays: 23,
    leftMinutesAgo: 300,
    destination: "discharged-to-the-community",
  }),
  departed({
    id: "AD-LEFT-02",
    unitId: "rph-adult-secure",
    sex: "Male",
    homeRegion: "Kimberley",
    stayDays: 41,
    leftMinutesAgo: 180,
    destination: "transferred-to-another-psychiatric-ward",
  }),
  departed({
    id: "AD-LEFT-03",
    unitId: "fre-adult-open",
    sex: "Female",
    homeRegion: "Wheatbelt",
    stayDays: 9,
    leftMinutesAgo: 900,
    destination: "transferred-to-a-general-hospital",
  }),
  departed({
    id: "AD-LEFT-04",
    unitId: "alb-adult-open",
    sex: "Male",
    homeRegion: "Great Southern",
    stayDays: 112,
    leftMinutesAgo: 1200,
    destination: "moved-to-residential-care",
  }),
  departed({
    id: "AD-LEFT-05",
    unitId: "scgh-adult-open",
    sex: "Male",
    homeRegion: "Goldfields-Esperance",
    stayDays: 6,
    leftMinutesAgo: 2600,
    destination: "left-against-advice",
  }),
];

/**
 * Accepted in principle, no bed given. They hold nothing, so they change no occupancy figure —
 * they are here because a ward board shows who is coming as well as who is here, and because
 * `admissionsForUnit` returning them is a behaviour with no seeded case otherwise.
 */
const waitlist: Admission[] = [
  waiting("AD-WAIT-01", "scgh-adult-open", "Female", "Peel"),
  waiting("AD-WAIT-02", "fsh-older-adult", "Male", "Perth Metropolitan"),
  waiting("AD-WAIT-03", "bty-youth", "Female", "Goldfields-Esperance"),
];

/**
 * The seed, in lifecycle order: people in beds, then people gone, then people waiting.
 *
 * Consumed by the ward board and by the out-of-area ledger. Neither may add a field to `Admission`
 * to make something here expressible — that is a governance decision, not an implementation one.
 */
export const wardAdmissions: Admission[] = [...occupiedBeds, ...departures, ...waitlist];
