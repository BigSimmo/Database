import { describe, expect, it } from "vitest";

import type { Admission } from "../src/components/ward-management/ward-admissions";
import { wardStatistics } from "../src/components/ward-management/ward-statistics";

/*
 * WHY THIS FILE EXISTS. `emptyBedMinutes` measured `arrivedAt - pulledAt` and clamped the result with
 * `Math.max(0, …)`. That looks like defensive arithmetic and is not.
 *
 * ⚠️ A NEGATIVE GAP MEANS THE RECORD IS INCOHERENT — the patient reached the ward before the bed was
 * allocated to them — NOT that they waited no time at all. Clamping converts "this cannot be true" into
 * "this patient waited zero minutes", which is a perfectly plausible figure nobody would ever query.
 *
 * ⚠️ AND IT IS NOT HYPOTHETICAL. Nine seeded records were measured on 2026-09-01 where the patient
 * arrives BEFORE the referral was raised, by gaps from 1.03 days to 115 days. The clamp would have
 * published all nine as zero-minute waits. The 115-day one is obviously broken and anybody would catch
 * it; the 1.03-day one looks like a timezone bug and would have gone straight through — the dangerous
 * cases are the ones that look almost right.
 *
 * The owner ruled on 2026-09-01 that neither this function nor the statistics screen clamps. An
 * incoherent record must stay visible as incoherent, so it is EXCLUDED from the average rather than
 * folded into it as a zero.
 */

const NOW = 10_000;
const UNIT = "rph-adult-secure";

function anAdmission(overrides: Partial<Admission>): Admission {
  return {
    id: "AD-TEST-1",
    unitId: "rph-adult-secure",
    referralId: null,
    state: "departed",
    sex: "Female",
    // ⚠️ ADDED 2026-09-02. These eight were absent and an `as Admission` cast silenced every one
    // of them, along with a phantom `cohort` field the model does not have. The cast is gone: this
    // helper is now typed so that widening `Admission` fails to compile here, which is what the
    // sibling helper in ward-community-corrected-claims.test.ts already promises and this one did not.
    specialling: false,
    homeRegion: null,
    tentativeDiagnosis: null,
    awayAtEmergencyDepartmentSince: null,
    dischargeDateMoves: 0,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    pulledAt: 1_000,
    arrivedAt: 1_060,
    leftAt: 2_000,
    expectedDischargeAt: null,
    dischargeDateSetAt: null,
    leavingDestination: "discharged-to-the-community",
    blockReason: null,
    followUp: null,
    ...overrides,
  };
}

describe("an impossible pull-to-arrival gap is excluded, never clamped to zero", () => {
  it("measures an ordinary gap, so the exclusion below is not vacuous", () => {
    const stats = wardStatistics(UNIT, [anAdmission({ pulledAt: 1_000, arrivedAt: 1_060 })], NOW);
    expect(stats.averageEmptyBedMinutes).toBe(60);
  });

  it("⚠️ EXCLUDES an admission that arrived BEFORE it was pulled, rather than counting it as zero", () => {
    // Arrived a full day before the bed was allocated. This record cannot be true.
    const stats = wardStatistics(UNIT, [anAdmission({ pulledAt: 2_440, arrivedAt: 1_000 })], NOW);
    expect(
      stats.averageEmptyBedMinutes,
      "an incoherent record must be absent, not averaged in as a zero-minute wait",
    ).toBeNull();
  });

  it("does not let one incoherent record drag a real average toward zero", () => {
    /*
     * The failure the clamp actually caused: mixing one impossible record into real ones halves the
     * measured wait, and the result still looks like a plausible number. This is the assertion that a
     * clamped implementation cannot satisfy.
     */
    const stats = wardStatistics(
      UNIT,
      [
        anAdmission({ id: "AD-TEST-1", pulledAt: 1_000, arrivedAt: 1_060 }),
        anAdmission({ id: "AD-TEST-2", pulledAt: 2_440, arrivedAt: 1_000 }),
      ],
      NOW,
    );
    expect(stats.averageEmptyBedMinutes, "the real 60-minute gap survives alone").toBe(60);
  });
});
