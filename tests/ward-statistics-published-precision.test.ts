// tests/ward-statistics-published-precision.test.ts
import { describe, expect, it } from "vitest";

import { MINUTES_PER_DAY } from "../src/components/ward-management/ward-clock";
import { type Admission } from "../src/components/ward-management/ward-admissions";
import { wardStatistics } from "../src/components/ward-management/ward-statistics";

/**
 * EVERY PUBLISHED AVERAGE CARRIES ONLY THE PRECISION IT CLAIMS.
 *
 * 🔴 THE DEFECT, FOUND BY OPENING THE PAGE ON 2026-09-06. Every ward statistics page published
 * `average length of stay 44.33680555555556 days` — fourteen decimal places of apparent precision
 * on a clinical figure derived from invented data, on a prototype about to be published. One figure
 * had three treatments: the field's own comment said "whole days", nothing rounded, the compare
 * screen applied `.toFixed(1)`, and the per-ward screen rendered it raw.
 *
 * ⚠️ **NO TEST SAW IT AND THE EXISTING ONES WERE NOT WRONG.** `ward-statistics-ward-nulls.dom.test.tsx`
 * asks whether a null is ever shown as a zero — the right question, and it passes. `ward-statistics.test.ts`
 * asks whether the arithmetic is right — also right, and it passes, because **the arithmetic WAS
 * right.** Precision is a third question and nothing asked it.
 *
 * 🔴 **THE FIXTURE IS CHOSEN SO IT CANNOT DIVIDE EVENLY, AND THAT IS THE POINT OF THE FIRST
 * ASSERTION IN EACH TEST.** The sibling figure `averageEmptyBedMinutes` looked untouched by this
 * defect and was not: it rendered a tidy "300 minutes" purely because the seed happened to divide,
 * with nothing rounding it either. **A fixture that divides evenly makes this whole file pass over
 * nothing** — so each test first proves its own input is a real test case by asserting the
 * UNROUNDED value has more precision than the published one, and only then checks the published
 * value. Swap in a tidy fixture and the anti-vacuity assertion fails by name.
 */

const UNIT = "rph-adult-secure";
const DAY_ZERO = 8 * 60;

function anAdmission(overrides: Partial<Admission>): Admission {
  return {
    id: "ADM-1",
    unitId: UNIT,
    specialling: false,
    referralId: "REF-1",
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: DAY_ZERO,
    arrivedAt: DAY_ZERO,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    ...overrides,
  } as Admission;
}

/** Decimal places actually present in a number, as published. */
function decimalPlaces(value: number): number {
  const text = String(value);
  const point = text.indexOf(".");
  return point === -1 ? 0 : text.length - point - 1;
}

describe("a published average carries only the precision it claims", () => {
  it("rounds the average length of stay to one decimal, on a fixture that cannot divide evenly", () => {
    // Three stays whose total is not divisible by three, so the raw mean repeats.
    const admissions = [
      anAdmission({ id: "ADM-1", arrivedAt: DAY_ZERO, leftAt: DAY_ZERO + 1 * MINUTES_PER_DAY }),
      anAdmission({ id: "ADM-2", arrivedAt: DAY_ZERO, leftAt: DAY_ZERO + 2 * MINUTES_PER_DAY }),
      anAdmission({ id: "ADM-3", arrivedAt: DAY_ZERO, leftAt: DAY_ZERO + 4 * MINUTES_PER_DAY }),
    ] as Admission[];

    const raw = (1 + 2 + 4) / 3; // 2.3333333333333335
    expect(
      decimalPlaces(raw),
      "this fixture divides evenly, so it cannot detect a missing rounding step — choose stays whose total is not divisible by their count",
    ).toBeGreaterThan(1);

    const published = wardStatistics(UNIT, admissions, DAY_ZERO + 10 * MINUTES_PER_DAY).averageLengthOfStayDays;
    expect(published).not.toBeNull();
    expect(
      decimalPlaces(published as number),
      `average length of stay published as ${published}, which claims precision the figure does not have`,
    ).toBeLessThanOrEqual(1);
  });

  it("rounds the average empty-bed time to whole minutes, on a fixture that cannot divide evenly", () => {
    // The figure that LOOKED fine. Two gaps whose total is odd, so the raw mean carries a half.
    const admissions = [
      anAdmission({ id: "ADM-1", pulledAt: DAY_ZERO, arrivedAt: DAY_ZERO + 10 }),
      anAdmission({ id: "ADM-2", pulledAt: DAY_ZERO, arrivedAt: DAY_ZERO + 13 }),
    ] as Admission[];

    const raw = (10 + 13) / 2; // 11.5
    expect(
      decimalPlaces(raw),
      "this fixture divides evenly, so it cannot detect a missing rounding step — the live seed's tidy '300 minutes' was exactly this accident",
    ).toBeGreaterThan(0);

    const published = wardStatistics(UNIT, admissions, DAY_ZERO + MINUTES_PER_DAY).averageEmptyBedMinutes;
    expect(published).not.toBeNull();
    expect(
      decimalPlaces(published as number),
      `average empty-bed time published as ${published} minutes, which claims precision the figure does not have`,
    ).toBe(0);
  });

  it("still returns null rather than a rounded zero when there is nothing to average", () => {
    /*
     * 🔴 THE ROUNDING HELPER IS THE EXACT PLACE THIS MODULE'S CENTRAL RULE COULD DIE QUIETLY.
     * `null` means "there was nothing to measure" and a nought means "measured, and it was none";
     * `ward-statistics.ts` calls collapsing the two "the single most likely way this page could
     * lie". A `roundTo` written to take `number` rather than `number | null` would turn every
     * unmeasurable average into `0` — inside a commit whose subject line is about tidying decimals.
     *
     * `ward-statistics-ward-nulls.dom.test.tsx` would in fact catch that, because it forbids any
     * digit inside a nullable measure and a nought is a digit. **This asserts it here anyway.**
     * Relying on a sibling file to catch your own helper's failure mode leaves neither test
     * carrying the reason, and they are then deleted together by whoever tidies next.
     */
    const stats = wardStatistics(UNIT, [], DAY_ZERO);
    expect(stats.averageLengthOfStayDays).toBeNull();
    expect(stats.averageEmptyBedMinutes).toBeNull();
  });
});
