// tests/ward-statistics.test.ts
import { describe, expect, it } from "vitest";

import { allUnits } from "../src/components/ward-management/ward-sites";
import {
  allWardStatistics,
  wardStatistics,
  type DischargeDateOutcomes,
} from "../src/components/ward-management/ward-statistics";
import { stayBand, type Admission } from "../src/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "../src/components/ward-management/ward-clock";

/**
 * Every admission below is CONSTRUCTED, never found by searching a fixture.
 *
 * `tests/ward-admission-model.test.ts` records why: an assertion that scans a collection for an
 * example satisfying a property passes as soon as ANY example exists, including one a live
 * defect still permits. A sister session's single most important test was fake for exactly that
 * reason. Every property below is asserted against an input built here, with distinct numbers
 * chosen so a plausible-looking bug changes the answer rather than hiding behind a coincidence.
 */
const DAY_ZERO = 8 * 60;
const UNIT = "rph-adult-secure";
const OTHER_UNIT = "fsh-adult-secure";

function anAdmission(overrides: Partial<Admission> = {}): Admission {
  return {
    id: "ADM-1",
    unitId: UNIT,
    referralId: "REF-1",
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    // `null` on purpose: nothing in this file reads or asserts on the tentative diagnosis, so
    // a value here would be a fact nobody uses. The field is present because `Admission`
    // declares it non-optional — a record where nobody wrote one down is present-and-empty.
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: DAY_ZERO,
    arrivedAt: DAY_ZERO,
    awayAtEmergencyDepartmentSince: null,
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

describe("wardStatistics — null versus zero", () => {
  /**
   * THE MOST IMPORTANT RULE IN THIS FILE. A ward with no discharges has no average length of
   * stay; it does not have an average of zero days. Reading `0` for "no data" is the plausible
   * mistake this guards: `0` and "nothing to average" are different claims, and a board that
   * prints "0 days" where it means "no data yet" tells a false and reassuring story. Every
   * averaging figure is checked against an empty admissions list.
   */
  it("returns null, never 0, for every averaging figure when there is nothing to average", () => {
    const statistics = wardStatistics(UNIT, [], DAY_ZERO);

    expect(statistics.averageLengthOfStayDays).toBeNull();
    expect(statistics.averageEmptyBedMinutes).toBeNull();
    expect(statistics.averageWaitlistWaitMinutes).toBeNull();

    // Explicitly NOT zero — the mistake this whole test exists to catch.
    expect(statistics.averageLengthOfStayDays).not.toBe(0);
    expect(statistics.averageEmptyBedMinutes).not.toBe(0);
  });

  /**
   * The non-averaging figures are genuine counts, not averages, so an empty ward correctly
   * reports zero for them — `0` here is a true statement ("nobody"), unlike the averages above.
   */
  it("reports zero — correctly, not null — for the count-based figures with no data", () => {
    const statistics = wardStatistics(UNIT, [], DAY_ZERO);

    expect(statistics.readyToLeaveCannot).toBe(0);
    expect(statistics.longStays).toBe(0);
    expect(statistics.dischargeDateOutcomes).toEqual<DischargeDateOutcomes>({
      met: 0,
      missed: 0,
      moved: 0,
      consideredCount: 0,
    });
  });
});

describe("wardStatistics — empty-bed time (pulledAt to arrivedAt)", () => {
  /**
   * THE SECOND MOST IMPORTANT RULE. Empty-bed time is the gap between the ward giving the bed
   * away (`pulledAt`) and the person physically turning up (`arrivedAt`) — a number nobody
   * currently has, because the transport delay belongs to neither clock alone.
   *
   * The three plausible swaps this guards against, each wrong in its own way:
   *   - `pulledAt` -> `now`: overstates every empty-bed figure by however long ago the person
   *     already arrived, because it keeps counting after the bed stopped being empty.
   *   - `arrivedAt` -> `leftAt`: answers a completely different question (how long they stayed),
   *     not how long the bed sat empty before they got there.
   *   - `arrivedAt` -> `now`: same category of mistake as the first, from the other end.
   *
   * `pulledAt`, `arrivedAt`, `leftAt` and `now` are chosen here to be four DIFFERENT numbers, so
   * any of those three swaps produces a different, wrong answer rather than accidentally matching
   * the correct one.
   */
  it("measures pull to arrival, and none of the other three plausible swaps", () => {
    const pulledAt = DAY_ZERO;
    const arrivedAt = DAY_ZERO + 30; // 30 minutes of empty-bed time
    const leftAt = DAY_ZERO + 30 + 500; // arrival to departure: 500 minutes
    const now = DAY_ZERO + 30 + 1000; // arrival to now: 1000 minutes; pull to now: 1030 minutes

    const admission = anAdmission({ state: "left", pulledAt, arrivedAt, leftAt });
    const statistics = wardStatistics(UNIT, [admission], now);

    expect(statistics.averageEmptyBedMinutes).toBe(30);
    // Named individually so a red run says exactly which wrong clock pairing produced it.
    expect(statistics.averageEmptyBedMinutes).not.toBe(1030); // pulledAt -> now
    expect(statistics.averageEmptyBedMinutes).not.toBe(500); // arrivedAt -> leftAt
    expect(statistics.averageEmptyBedMinutes).not.toBe(1000); // arrivedAt -> now
  });

  it("excludes an admission that has not arrived — the bed is still empty, not measurably so yet", () => {
    const stillWaitingForTransport = anAdmission({ state: "pulled", pulledAt: DAY_ZERO, arrivedAt: null });
    const statistics = wardStatistics(UNIT, [stillWaitingForTransport], DAY_ZERO + 200);
    expect(statistics.averageEmptyBedMinutes).toBeNull();
  });
});

describe("wardStatistics — average length of stay", () => {
  /**
   * REQUIRED: an admission still in a bed and one that has already left, asserted in the SAME
   * test so neither half can pass while the other is silently broken.
   *
   * `now` is used as the end clock ONLY for the admission still occupying a bed; `leftAt` is used
   * for the admission that has gone. Reading `now` for a departed admission would keep their stay
   * growing after they left; reading `leftAt` (or nothing) for a current occupant would report
   * their stay as zero or missing while they are plainly still in the bed.
   */
  it("measures a current occupant to now, and a departed admission to leftAt, in the same average", () => {
    const now = DAY_ZERO + 6 * MINUTES_PER_DAY;

    const stillHere = anAdmission({ id: "ADM-current", state: "occupied", arrivedAt: DAY_ZERO, leftAt: null });
    const alreadyLeft = anAdmission({
      id: "ADM-departed",
      state: "left",
      arrivedAt: DAY_ZERO,
      leftAt: DAY_ZERO + 2 * MINUTES_PER_DAY,
      leavingDestination: "discharged-to-the-community",
    });

    const statistics = wardStatistics(UNIT, [stillHere, alreadyLeft], now);

    // stillHere: 6 days (arrivedAt -> now). alreadyLeft: 2 days (arrivedAt -> leftAt). Average: 4.
    expect(statistics.averageLengthOfStayDays).toBe(4);
    // Named wrong answers a broken swap would produce, so a red run says which swap happened.
    expect(statistics.averageLengthOfStayDays).not.toBe(6); // both measured to now
    expect(statistics.averageLengthOfStayDays).not.toBe(2); // both measured to leftAt (or 0 for stillHere)
  });

  it("excludes an admission that has not arrived — there is no stay to measure yet", () => {
    const waitlisted = anAdmission({ state: "waitlisted", pulledAt: null, arrivedAt: null });
    const statistics = wardStatistics(UNIT, [waitlisted], DAY_ZERO + 5 * MINUTES_PER_DAY);
    expect(statistics.averageLengthOfStayDays).toBeNull();
  });
});

describe("wardStatistics — long stays reuse stayBand, never re-band it locally", () => {
  /**
   * `over-3-months` is the ONLY band this figure counts, and the boundary values (14, 30, 90 days)
   * are the exact ones `ward-admissions.ts`'s own `STAY_BANDS` and `tests/ward-admission-model.test.ts`
   * pin — reused here rather than re-derived, so this test would catch a divergence between the
   * two rather than just re-proving the same arithmetic a second time.
   *
   * **This figure is the one thing the band change was NOT allowed to move, and this is where that
   * is checked rather than assumed.** The product owner replaced the first two boundaries (1 week
   * and 4 weeks became 2 weeks and 1 month) and left the third alone at 90 days, so `over-3-months`
   * keeps both its id and its ceiling and the long-stay count is arithmetically the same set of
   * people it was before. Verified, not inferred: the four stays below span all four of the NEW
   * bands and exactly one of them counts.
   *
   * The second stay was 7 days when this test was written against the previous bands, which put it
   * in the second band. Under the owner's bands 7 days is in the FIRST, so it stopped representing
   * a distinct band and this test quietly covered three bands while claiming four. It is 20 days
   * now — squarely inside `2-weeks-1-month` — which is the coverage the test name promises.
   */
  it("counts exactly the admissions whose stayBand is over-3-months, not the other three bands", () => {
    const now = DAY_ZERO + 200 * MINUTES_PER_DAY;
    const daysAgo = (days: number) => now - days * MINUTES_PER_DAY;

    const underTwoWeeks = anAdmission({ id: "ADM-under-2-weeks", state: "occupied", arrivedAt: daysAgo(5) });
    const twoWeeksToAMonth = anAdmission({ id: "ADM-2-weeks-1-month", state: "occupied", arrivedAt: daysAgo(20) });
    const oneToThreeMonths = anAdmission({ id: "ADM-1-3-months", state: "occupied", arrivedAt: daysAgo(89) });
    const overThreeMonths = anAdmission({ id: "ADM-over-3-months", state: "occupied", arrivedAt: daysAgo(100) });

    // The four really are four different bands — asserted rather than trusted, because the whole
    // value of the count below is that it discriminates.
    expect(
      [underTwoWeeks, twoWeeksToAMonth, oneToThreeMonths, overThreeMonths].map(
        (admission) => stayBand(admission, now)?.id ?? null,
      ),
    ).toEqual(["under-2-weeks", "2-weeks-1-month", "1-3-months", "over-3-months"]);

    const statistics = wardStatistics(UNIT, [underTwoWeeks, twoWeeksToAMonth, oneToThreeMonths, overThreeMonths], now);

    expect(statistics.longStays).toBe(1);
  });

  it("does not count a long-ago stay against a unit it does not belong to", () => {
    const now = DAY_ZERO + 200 * MINUTES_PER_DAY;
    const longStayElsewhere = anAdmission({
      id: "ADM-elsewhere",
      unitId: OTHER_UNIT,
      state: "occupied",
      arrivedAt: now - 100 * MINUTES_PER_DAY,
    });
    const statistics = wardStatistics(UNIT, [longStayElsewhere], now);
    expect(statistics.longStays).toBe(0);
  });

  /**
   * A departed admission is deliberately excluded from `longStays`. `stayBand` (reused, not
   * re-implemented, from `ward-admissions.ts`) measures from `arrivedAt` to whatever `now` is
   * passed in — it has no idea an admission has since left — so applying it to a departed
   * admission would keep reporting their stay as growing after they were gone. This unit test
   * pins that as deliberate so a future reader does not "fix" longStays to include departed
   * admissions and silently reintroduce that overcount.
   */
  it("excludes a departed admission even though its historical stay would otherwise band as over-3-months", () => {
    const now = DAY_ZERO + 200 * MINUTES_PER_DAY;
    const departedAfterALongStay = anAdmission({
      id: "ADM-departed-long",
      state: "left",
      arrivedAt: now - 100 * MINUTES_PER_DAY,
      leftAt: now - 10 * MINUTES_PER_DAY,
      leavingDestination: "discharged-to-the-community",
    });
    const statistics = wardStatistics(UNIT, [departedAfterALongStay], now);
    expect(statistics.longStays).toBe(0);
  });
});

describe("wardStatistics — ready to leave, cannot", () => {
  /**
   * REQUIRED: counts admissions carrying a `blockReason`, and is NOT subtracted from any other
   * figure. The two admissions below have deliberately DIFFERENT lengths of stay (2 days and 6
   * days), so if a bug excluded the blocked admission from the length-of-stay average (treating
   * "blocked" as though it removed the admission from the ward entirely), the average would come
   * out as 6 instead of 4 — a different, wrong number, not a coincidental match.
   */
  it("counts a blocked admission without removing it from the length-of-stay average", () => {
    const now = DAY_ZERO + 6 * MINUTES_PER_DAY;
    const blocked = anAdmission({
      id: "ADM-blocked",
      state: "occupied",
      arrivedAt: DAY_ZERO + 4 * MINUTES_PER_DAY, // 2 days by `now`
      blockReason: "Awaiting transport",
    });
    const notBlocked = anAdmission({
      id: "ADM-not-blocked",
      state: "occupied",
      arrivedAt: DAY_ZERO, // 6 days by `now`
      blockReason: null,
    });

    const statistics = wardStatistics(UNIT, [blocked, notBlocked], now);

    expect(statistics.readyToLeaveCannot).toBe(1);
    // Both admissions still contribute: (2 + 6) / 2 = 4, not 6 (which is what excluding the
    // blocked admission from the average would produce).
    expect(statistics.averageLengthOfStayDays).toBe(4);
  });

  it("does not count an admission with no blockReason", () => {
    const statistics = wardStatistics(UNIT, [anAdmission({ blockReason: null })], DAY_ZERO + MINUTES_PER_DAY);
    expect(statistics.readyToLeaveCannot).toBe(0);
  });

  /**
   * A departed admission is excluded even if its `blockReason` was never cleared: someone who has
   * already left is no longer being held up from leaving, whatever the record still says.
   */
  it("excludes a departed admission from readyToLeaveCannot even if blockReason is still set", () => {
    const departedButStillFlagged = anAdmission({
      state: "left",
      leftAt: DAY_ZERO + MINUTES_PER_DAY,
      leavingDestination: "discharged-to-the-community",
      blockReason: "Awaiting transport",
    });
    const statistics = wardStatistics(UNIT, [departedButStillFlagged], DAY_ZERO + 2 * MINUTES_PER_DAY);
    expect(statistics.readyToLeaveCannot).toBe(0);
  });
});

describe("wardStatistics — discharge dates met versus moved", () => {
  it("counts a discharge that happened on or before the expected date as met", () => {
    const admission = anAdmission({
      state: "left",
      expectedDischargeAt: DAY_ZERO + 5 * MINUTES_PER_DAY,
      leftAt: DAY_ZERO + 5 * MINUTES_PER_DAY, // exactly on the expected date
      leavingDestination: "discharged-to-the-community",
    });
    const statistics = wardStatistics(UNIT, [admission], DAY_ZERO + 6 * MINUTES_PER_DAY);
    expect(statistics.dischargeDateOutcomes).toEqual<DischargeDateOutcomes>({
      met: 1,
      missed: 0,
      moved: 0,
      consideredCount: 1,
    });
  });

  it("counts a discharge that happened after the expected date as missed, not met", () => {
    const admission = anAdmission({
      state: "left",
      expectedDischargeAt: DAY_ZERO + 5 * MINUTES_PER_DAY,
      leftAt: DAY_ZERO + 7 * MINUTES_PER_DAY,
      leavingDestination: "discharged-to-the-community",
    });
    const statistics = wardStatistics(UNIT, [admission], DAY_ZERO + 8 * MINUTES_PER_DAY);
    expect(statistics.dischargeDateOutcomes.met).toBe(0);
    expect(statistics.dischargeDateOutcomes.missed).toBe(1);
    expect(statistics.dischargeDateOutcomes.consideredCount).toBe(1);
  });

  it("does not count an admission still in the bed as met or missed — there is no outcome yet", () => {
    const stillWaitingOnItsPlan = anAdmission({
      state: "occupied",
      expectedDischargeAt: DAY_ZERO + 5 * MINUTES_PER_DAY,
      leftAt: null,
    });
    const statistics = wardStatistics(UNIT, [stillWaitingOnItsPlan], DAY_ZERO + 2 * MINUTES_PER_DAY);
    expect(statistics.dischargeDateOutcomes.met).toBe(0);
    expect(statistics.dischargeDateOutcomes.missed).toBe(0);
    expect(statistics.dischargeDateOutcomes.consideredCount).toBe(0);
  });

  it("counts dischargeDateMoves independently of met/missed, for an admission still in the bed", () => {
    const revisedButStillHere = anAdmission({
      state: "occupied",
      expectedDischargeAt: DAY_ZERO + 5 * MINUTES_PER_DAY,
      dischargeDateMoves: 2,
      leftAt: null,
    });
    const statistics = wardStatistics(UNIT, [revisedButStillHere], DAY_ZERO + 2 * MINUTES_PER_DAY);
    expect(statistics.dischargeDateOutcomes.moved).toBe(1);
    expect(statistics.dischargeDateOutcomes.consideredCount).toBe(0);
  });

  it("does not count an admission with no expected discharge date at all", () => {
    const noPlanSet = anAdmission({ expectedDischargeAt: null, dischargeDateMoves: 0 });
    const statistics = wardStatistics(UNIT, [noPlanSet], DAY_ZERO + MINUTES_PER_DAY);
    expect(statistics.dischargeDateOutcomes).toEqual<DischargeDateOutcomes>({
      met: 0,
      missed: 0,
      moved: 0,
      consideredCount: 0,
    });
  });
});

describe("wardStatistics — waitlist wait (flagged, not implemented)", () => {
  /**
   * `Admission` carries no timestamp for when it entered the `"waitlisted"` state — `pulledAt`,
   * `arrivedAt`, `expectedDischargeAt`, `dischargeDateSetAt` and `leftAt` are the only instants on
   * the record, and none of them mark that moment. The equivalent "waiting since" figure that
   * already exists in this codebase (`referralWaitLabel` in `ward-referrals.ts`) is measured from
   * `Referral.raisedAt` — a field that lives on the referral, not the admission, and this
   * function's only permitted input is `Admission[]`.
   *
   * So this figure is deliberately always `null`, never a fabricated timestamp. This is reported
   * in the task write-up as a flagged gap, not silently invented around.
   */
  it("is always null, never computed from a fabricated waitlist-start time", () => {
    const admission = anAdmission({ state: "occupied", pulledAt: DAY_ZERO, arrivedAt: DAY_ZERO + 30 });
    const statistics = wardStatistics(UNIT, [admission], DAY_ZERO + 200);
    expect(statistics.averageWaitlistWaitMinutes).toBeNull();
  });
});

describe("allWardStatistics", () => {
  it("pairs every unit with its own statistics, in the given unit order", () => {
    const units = allUnits().slice(0, 3);
    const admissions: Admission[] = [
      anAdmission({ id: "ADM-a", unitId: units[0]!.id, state: "occupied", arrivedAt: DAY_ZERO }),
      anAdmission({ id: "ADM-b", unitId: units[2]!.id, state: "occupied", arrivedAt: DAY_ZERO }),
    ];
    const now = DAY_ZERO + 3 * MINUTES_PER_DAY;

    const results = allWardStatistics(units, admissions, now);

    expect(results.map((entry) => entry.unit.id)).toEqual(units.map((unit) => unit.id));
    expect(results[0]!.statistics.averageLengthOfStayDays).toBe(3);
    expect(results[1]!.statistics.averageLengthOfStayDays).toBeNull(); // no admissions on units[1]
    expect(results[2]!.statistics.averageLengthOfStayDays).toBe(3);
  });

  it("returns an empty list for an empty unit list, rather than falling back to every unit", () => {
    expect(allWardStatistics([], [anAdmission()], DAY_ZERO)).toEqual([]);
  });
});
