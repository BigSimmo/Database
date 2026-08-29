import { describe, expect, it } from "vitest";

import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import {
  HOME_REGIONS,
  SEXES,
  SEX_DESIGNATIONS,
  type CapacityFigure,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import {
  ARROW_HORIZON_DAYS,
  acceptingBedCounts,
  arrowTargets,
  constraintSentence,
  derivedSexMix,
  headlineAvailable,
  sinceYesterday,
} from "@/components/ward-management/ward-board-derivations";

/** 10:00 on the synthetic operating day. Fixtures are self-contained so no seed fixture change
 *  can silently move a boundary this file pins. */
const NOW = 10 * 60;

const UNIT_ID = "U-BOARD-TEST";

function figure(value: number): CapacityFigure {
  return { value, source: "ward", confirmedAt: NOW, staleAfterMinutes: 240 };
}

function testUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: UNIT_ID,
    siteCode: "TST",
    name: "Test Ward",
    cohort: "Adult",
    security: "Open",
    authorised: true,
    beds: 20,
    empty: figure(4),
    allocatable: figure(4),
    held: 0,
    blocked: 0,
    sexMix: { Female: 0, Male: 0 },
    speciallingCapacity: 4,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  };
}

function admission(overrides: Partial<Admission> = {}): Admission {
  return {
    id: "WA-T01",
    unitId: UNIT_ID,
    referralId: "WR-T01",
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    // `null` on purpose: nothing in this file reads or asserts on the tentative diagnosis, so
    // a value here would be a fact nobody uses. The field is present because `Admission`
    // declares it non-optional — a record where nobody wrote one down is present-and-empty.
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: null,
    arrivedAt: NOW - MINUTES_PER_DAY * 2,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    ...overrides,
  };
}

describe("the accepts rule is never an equality", () => {
  /**
   * Non-vacuity for the whole file. `"Undesignated"` is a member of `SEX_DESIGNATIONS` and is not
   * a member of `SEXES` — which is precisely why `unit.sexDesignation === admission.sex` excludes
   * every undesignated bed while reading as a plausible match. If this ever stops being true the
   * invariance test below stops discriminating and must be rewritten, not deleted.
   */
  it("has an Undesignated value that equals neither sex", () => {
    expect(SEX_DESIGNATIONS).toContain("Undesignated");
    for (const sex of SEXES) {
      expect(sex).not.toBe("Undesignated");
    }
  });

  /**
   * THE test in this file, stated as an invariance rather than an example search.
   *
   * Every bed on this unit is undesignated, so the count accepting a man and the count accepting
   * a woman must be EXACTLY EQUAL, and both must be the free-bed total. An equality-shaped rule
   * makes both zero while the free total stays four, so it cannot survive this. A test that
   * instead searched the fixture for "an undesignated bed that accepts a man" would pass the
   * moment any such example existed — including one an equality bug still permitted.
   */
  it("counts a man and a woman identically when every bed is undesignated", () => {
    const unit = testUnit({ sexDesignation: "Undesignated" });
    const free = headlineAvailable(unit, [], [], [], NOW);
    const counts = acceptingBedCounts(unit, [], [], [], NOW);

    expect(free).toBe(4);
    expect(counts.forMale).toBe(counts.forFemale);
    expect(counts.forFemale).toBe(free);
    expect(counts.forMale).toBe(free);
  });

  /**
   * The same invariance with the ward's occupancy deliberately lopsided. Designation is a fact
   * about the BED, so who is already in the other beds cannot move it — a rule that derived
   * acceptance from `sexMix` or from the derived occupancy instead would break symmetry here
   * while still passing the empty-ward case above.
   */
  it("keeps that symmetry when every occupant is one sex", () => {
    const unit = testUnit({ sexDesignation: "Undesignated", sexMix: { Female: 16, Male: 0 } });
    const admissions = [
      admission({ id: "WA-T01", sex: "Female" }),
      admission({ id: "WA-T02", sex: "Female" }),
      admission({ id: "WA-T03", sex: "Female" }),
    ];
    const counts = acceptingBedCounts(unit, admissions, [], [], NOW);

    expect(counts.forMale).toBe(counts.forFemale);
    expect(counts.forFemale).toBe(headlineAvailable(unit, admissions, [], [], NOW));
  });

  /**
   * The gate id this module reads out of the shared verdict really exists. Without this, renaming
   * the gate in `ward-eligibility.ts` would make `acceptingBedCounts` fail closed to zero
   * everywhere and the invariance test above would go red for a reason nobody could read.
   */
  it("reads a gate the shared verdict actually publishes", () => {
    const probe: Referral = {
      id: "WR-PROBE",
      ageBand: "Adult",
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      homeRegion: HOME_REGIONS[0],
      source: "community",
      raisedAt: NOW,
      urgency: 2,
      originSiteCode: "TST",
      transportNeeded: false,
      state: "queued",
    };
    const gateNames = referralEligibility(probe, testUnit(), NOW).gates.map((gate) => gate.gate);
    expect(gateNames).toContain("sex_designation");
  });

  it("reports the real counts, not booleans, when a designation narrows acceptance", () => {
    const unit = testUnit({ sexDesignation: "Male only" });
    const counts = acceptingBedCounts(unit, [], [], [], NOW);

    expect(counts.forFemale).toBeLessThan(counts.forMale);
    expect(counts.forFemale).toBe(0);
    expect(counts.forMale).toBe(4);
  });
});

describe("headlineAvailable", () => {
  it("takes the figure from the shared capacity breakdown", () => {
    // `availableNow` is `min(allocatable, empty)`. A unit that confirmed 5 allocatable beds and
    // then took arrivals down to 2 physically empty has 2 fillable beds, never 5.
    const unit = testUnit({ allocatable: figure(5), empty: figure(2) });
    expect(headlineAvailable(unit, [], [], [], NOW)).toBe(2);
  });

  it("returns 0, never a guess, when the unit's figures cannot be resolved", () => {
    const unit = testUnit({ allocatable: figure(Number.NaN) });
    expect(headlineAvailable(unit, [], [], [], NOW)).toBe(0);
  });

  it("returns 0 rather than a negative bed count", () => {
    const unit = testUnit({ allocatable: figure(-3), empty: figure(-3) });
    expect(headlineAvailable(unit, [], [], [], NOW)).toBe(0);
  });
});

describe("constraintSentence", () => {
  it("returns null — never an empty string — when nothing constrains", () => {
    const unit = testUnit({ sexDesignation: "Undesignated", speciallingCapacity: 4 });
    expect(constraintSentence(unit, [], [], [], NOW)).toBeNull();
  });

  it("returns null when there is no bed to qualify", () => {
    const unit = testUnit({ allocatable: figure(0), empty: figure(0), speciallingCapacity: 0 });
    expect(constraintSentence(unit, [], [], [], NOW)).toBeNull();
  });

  /**
   * The "one exported function" property, pinned. Every number in the sentence is taken from
   * `acceptingBedCounts`' own output rather than restated as a literal, so a `constraintSentence`
   * that re-counted independently and disagreed would go red here even though its prose was
   * unchanged.
   */
  it("builds its numbers from acceptingBedCounts, not from a parallel count", () => {
    const unit = testUnit({
      sexDesignation: "Male only",
      speciallingCapacity: 1,
      // A lopsided hand-maintained mix, deliberately disagreeing with the designation. A second
      // count derived from occupancy rather than from the bed's own designation would read this
      // and give a different answer.
      sexMix: { Female: 12, Male: 0 },
    });
    const counts = acceptingBedCounts(unit, [], [], [], NOW);

    expect(counts.forFemale).toBe(0);
    expect(counts.specialled).toBe(1);
    expect(constraintSentence(unit, [], [], [], NOW)).toBe(
      `${counts.forFemale === 0 ? "None" : `Only ${counts.forFemale}`} will take a woman. ` +
        `Only ${counts.specialled} can be watched one-to-one.`,
    );
  });

  it("names the specialling constraint on its own when the beds take either sex", () => {
    const unit = testUnit({ sexDesignation: "Undesignated", speciallingCapacity: 1 });
    expect(constraintSentence(unit, [], [], [], NOW)).toBe("Only 1 can be watched one-to-one.");
  });

  it("says None rather than 'Only 0' when the ward can staff no one-to-one", () => {
    const unit = testUnit({ sexDesignation: "Undesignated", speciallingCapacity: 0 });
    expect(constraintSentence(unit, [], [], [], NOW)).toBe("None can be watched one-to-one.");
  });
});

describe("arrowTargets", () => {
  it("excludes an expected discharge 8 days out and includes one at 6", () => {
    const admissions = [
      admission({
        id: "WA-FAR",
        homeRegion: "Kimberley",
        expectedDischargeAt: NOW + 8 * MINUTES_PER_DAY,
      }),
      admission({
        id: "WA-NEAR",
        homeRegion: "Peel",
        expectedDischargeAt: NOW + 6 * MINUTES_PER_DAY,
      }),
    ];
    const targets = arrowTargets(admissions, NOW);

    expect(targets.map((target) => target.region)).toEqual(["Peel"]);
    expect(targets[0]?.nearestDays).toBe(6);
  });

  it("includes the horizon day itself", () => {
    expect(ARROW_HORIZON_DAYS).toBe(7);
    const admissions = [
      admission({ id: "WA-EDGE", homeRegion: "Wheatbelt", expectedDischargeAt: NOW + 7 * MINUTES_PER_DAY }),
    ];
    expect(arrowTargets(admissions, NOW).map((target) => target.region)).toEqual(["Wheatbelt"]);
  });

  it("groups two admissions from one region into a single entry", () => {
    const admissions = [
      admission({ id: "WA-A", homeRegion: "South West", expectedDischargeAt: NOW + 4 * MINUTES_PER_DAY }),
      admission({ id: "WA-B", homeRegion: "South West", expectedDischargeAt: NOW + 2 * MINUTES_PER_DAY }),
    ];
    const targets = arrowTargets(admissions, NOW);

    expect(targets).toHaveLength(1);
    expect(targets[0]?.region).toBe("South West");
    expect(targets[0]?.count).toBe(2);
    expect(targets[0]?.nearestDays).toBe(2);
  });

  it("orders regions nearest-first", () => {
    const admissions = [
      admission({ id: "WA-A", homeRegion: "Pilbara", expectedDischargeAt: NOW + 5 * MINUTES_PER_DAY }),
      admission({ id: "WA-B", homeRegion: "Peel", expectedDischargeAt: NOW + 1 * MINUTES_PER_DAY }),
      admission({ id: "WA-C", homeRegion: "Mid West", expectedDischargeAt: NOW + 3 * MINUTES_PER_DAY }),
    ];
    expect(arrowTargets(admissions, NOW).map((target) => target.region)).toEqual(["Peel", "Mid West", "Pilbara"]);
  });

  it("keeps an already-overdue plan at the front rather than dropping it", () => {
    const admissions = [
      admission({ id: "WA-LATE", homeRegion: "Gascoyne", expectedDischargeAt: NOW - 3 * MINUTES_PER_DAY }),
      admission({ id: "WA-SOON", homeRegion: "Peel", expectedDischargeAt: NOW + 1 * MINUTES_PER_DAY }),
    ];
    const targets = arrowTargets(admissions, NOW);

    expect(targets.map((target) => target.region)).toEqual(["Gascoyne", "Peel"]);
    expect(targets[0]?.nearestDays).toBe(0);
  });

  it("ignores an admission with no expected date at all", () => {
    expect(arrowTargets([admission({ expectedDischargeAt: null })], NOW)).toEqual([]);
  });

  it("ignores someone who is not in a bed", () => {
    const admissions = [
      admission({ id: "WA-WAIT", state: "waitlisted", expectedDischargeAt: NOW + 2 * MINUTES_PER_DAY }),
      admission({
        id: "WA-GONE",
        state: "left",
        leftAt: NOW - 60,
        leavingDestination: "discharged-to-the-community",
        expectedDischargeAt: NOW + 2 * MINUTES_PER_DAY,
      }),
    ];
    expect(arrowTargets(admissions, NOW)).toEqual([]);
  });
});

describe("derivedSexMix", () => {
  /**
   * `"pulled"` counts. The ward gave the bed away at the pull, so the person is part of this
   * ward's mix from that moment even though `arrivedAt` is still null. Requiring arrival here
   * would understate the mix by exactly the beds most at risk of being offered twice.
   */
  it("counts only admissions actually holding a bed, pulled included", () => {
    const admissions = [
      admission({ id: "WA-1", sex: "Female", state: "occupied" }),
      admission({ id: "WA-2", sex: "Male", state: "pulled", pulledAt: NOW - 120, arrivedAt: null }),
      admission({ id: "WA-3", sex: "Male", state: "waitlisted", arrivedAt: null }),
      admission({
        id: "WA-4",
        sex: "Female",
        state: "left",
        leftAt: NOW - 60,
        leavingDestination: "discharged-to-the-community",
      }),
      admission({ id: "WA-5", unitId: "U-OTHER", sex: "Male", state: "occupied" }),
    ];

    expect(derivedSexMix(admissions, UNIT_ID)).toEqual({ Female: 1, Male: 1 });
  });

  it("returns a total record with a zero for a sex nobody on the ward is", () => {
    expect(derivedSexMix([admission({ sex: "Female" })], UNIT_ID)).toEqual({ Female: 1, Male: 0 });
  });
});

describe("sinceYesterday", () => {
  it("counts departures, pulls and moved dates inside the last day only", () => {
    const admissions = [
      admission({
        id: "WA-OUT",
        state: "left",
        leftAt: NOW - 120,
        leavingDestination: "discharged-to-the-community",
      }),
      admission({
        id: "WA-OUT-OLD",
        state: "left",
        leftAt: NOW - MINUTES_PER_DAY - 60,
        leavingDestination: "discharged-to-the-community",
      }),
      admission({ id: "WA-PULL", state: "pulled", pulledAt: NOW - 30, arrivedAt: null }),
      admission({ id: "WA-PULL-OLD", state: "occupied", pulledAt: NOW - MINUTES_PER_DAY - 30 }),
      admission({
        id: "WA-MOVED",
        dischargeDateMoves: 2,
        dischargeDateSetAt: NOW - 200,
        dischargeDateSetBy: "Flow coordinator",
        expectedDischargeAt: NOW + MINUTES_PER_DAY,
      }),
      admission({
        id: "WA-SET-ONCE",
        dischargeDateMoves: 0,
        dischargeDateSetAt: NOW - 200,
        dischargeDateSetBy: "Flow coordinator",
        expectedDischargeAt: NOW + MINUTES_PER_DAY,
      }),
    ];

    expect(sinceYesterday(admissions, NOW)).toEqual({ discharged: 1, pulled: 1, datesMoved: 1 });
  });

  it("reports zeroes rather than throwing on an empty ward", () => {
    expect(sinceYesterday([], NOW)).toEqual({ discharged: 0, pulled: 0, datesMoved: 0 });
  });
});
