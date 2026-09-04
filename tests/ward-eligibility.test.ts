import { describe, expect, it } from "vitest";

import {
  eligibility,
  referralEligibility,
  requiresAuthorisedDestination,
} from "../src/components/ward-management/ward-eligibility";
import type { LegalStatus, Movement, Referral, Unit } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR, unitById } from "../src/components/ward-management/ward-sites";

const NOW = 10 * 60 + 42;

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "u-test",
    siteCode: "RPH",
    name: "Test Unit",
    cohort: "Adult",
    security: "Open",
    authorised: true,
    beds: 20,
    empty: { value: 3, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: 2, source: "ward", confirmedAt: NOW - 10, staleAfterMinutes: 120 },
    held: 0,
    blocked: 0,
    sexMix: { Female: 10, Male: 8 },
    speciallingCapacity: 1,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  };
}

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "WF-001",
    originEdId: "ed-rph",
    openedAt: NOW - 300,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Flow coordinator",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

/**
 * A minimal ward referral, for the one cross-function test below that checks `eligibility` and
 * `referralEligibility` agree. Deliberately not shared with `ward-referral-matching.test.ts`'s own
 * `referral()` factory — that file's subject is which beds accept whom across many referral
 * shapes; this file's subject is the movement path, and this single fixture exists only to prove
 * the two paths give the same forensic verdict for the same bed, not to re-test referral matching.
 */
function referral(overrides: Partial<Omit<Referral, "destinations">> = {}): Referral {
  return {
    id: "RF-TEST",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Male",
          secureBedNeeded: true,
          involuntaryBedNeeded: false,
        },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...overrides,
  };
}

describe("authorisation", () => {
  it("requires an authorised destination for every non-voluntary status", () => {
    expect(requiresAuthorisedDestination("Voluntary")).toBe(false);
    expect(requiresAuthorisedDestination("Referred for psychiatric examination")).toBe(true);
    expect(requiresAuthorisedDestination("Detained awaiting examination")).toBe(true);
    expect(requiresAuthorisedDestination("Involuntary inpatient")).toBe(true);
  });

  it("blocks a detained patient from an unauthorised unit", () => {
    const verdict = eligibility(
      movement({ legalStatus: "Detained awaiting examination" }),
      unit({ authorised: false }),
      NOW,
    );
    expect(verdict.eligible).toBe(false);
    expect(verdict.gates.find((gate) => gate.gate === "authorisation")?.pass).toBe(false);
  });

  it("treats unknown-status movements as requiring authorisation, failing safe", () => {
    const verdict = eligibility(
      // A movement whose legal status never arrived. Cast deliberately: the point of the
      // test is the runtime fail-safe, not the type system.
      movement({ legalStatus: undefined as unknown as LegalStatus }),
      unit({ authorised: false }),
      NOW,
    );
    expect(verdict.eligible).toBe(false);
  });
});

describe("clinical and operational gates", () => {
  it("refuses a cohort mismatch", () => {
    const verdict = eligibility(movement({ cohort: "Older adult" }), unit({ cohort: "Adult" }), NOW);
    const cohortGate = verdict.gates.find((gate) => gate.gate === "cohort");
    expect(cohortGate?.pass).toBe(false);
    // Grammar: "an older adult movement", never "a older adult movement".
    expect(cohortGate?.detail).toContain("an older adult movement");
  });

  it("gives the cohort gate a different detail string on pass than on fail", () => {
    const failing = eligibility(movement({ cohort: "Older adult" }), unit({ cohort: "Adult" }), NOW);
    const passing = eligibility(movement({ cohort: "Adult" }), unit({ cohort: "Adult" }), NOW);
    const failDetail = failing.gates.find((gate) => gate.gate === "cohort")?.detail;
    const passDetail = passing.gates.find((gate) => gate.gate === "cohort")?.detail;
    expect(failDetail).not.toBe(passDetail);
  });

  it("gives the security gate a different detail string on pass than on fail", () => {
    const failing = eligibility(movement({ security: "Secure" }), unit({ security: "Open" }), NOW);
    const passing = eligibility(movement({ security: "Open" }), unit({ security: "Open" }), NOW);
    const failGate = failing.gates.find((gate) => gate.gate === "security");
    const passGate = passing.gates.find((gate) => gate.gate === "security");
    expect(failGate?.pass).toBe(false);
    expect(passGate?.pass).toBe(true);
    expect(failGate?.detail).not.toBe(passGate?.detail);
  });

  it("refuses when the ward cannot staff the required specialling", () => {
    const verdict = eligibility(movement({ specialling: true }), unit({ speciallingCapacity: 0 }), NOW);
    expect(verdict.gates.find((gate) => gate.gate === "specialling")?.pass).toBe(false);
  });

  it("refuses a unit that has already declined this movement", () => {
    const declined = movement({ declines: [{ unitId: "u-test", at: NOW - 60, reason: "no_bed" }] });
    const verdict = eligibility(declined, unit(), NOW);
    expect(verdict.gates.find((gate) => gate.gate === "prior_decline")?.pass).toBe(false);
  });

  it("drops a unit whose allocatable figure has gone stale rather than showing it hopefully", () => {
    const stale = unit({
      allocatable: { value: 4, source: "ward", confirmedAt: NOW - 200, staleAfterMinutes: 120 },
    });
    const verdict = eligibility(movement(), stale, NOW);
    expect(verdict.gates.find((gate) => gate.gate === "capacity_freshness")?.pass).toBe(false);
  });

  it("passes every gate for a well-matched voluntary movement", () => {
    const verdict = eligibility(movement(), unit(), NOW);
    expect(verdict.eligible).toBe(true);
    expect(verdict.gates.every((gate) => gate.pass)).toBe(true);
  });
});

/**
 * The ward's own sex designation, on the MOVEMENT path.
 *
 * `referralEligibility` has gated on `unit.sexDesignation` since Phase 7; `eligibility` never
 * did, so a Female Adult movement needing a Secure bed was returned as eligible for
 * `fsh-adult-secure` — the network's Male-only Secure bed — because every gate the movement path
 * builds passed. `sex_mix` is not a substitute and is deliberately left exactly as it was: it
 * asks whether mixing sexes is acceptable given who is ALREADY on the ward, and passes for
 * either sex whenever more than one bed is free. Designation is a property of the bed; mix is a
 * property of its occupants. Both must hold.
 */
describe("sex designation, on the movement path", () => {
  it("refuses a Female movement at the network's live Male-only Secure bed", () => {
    const maleOnly = unitById("fsh-adult-secure");
    // Non-vacuity: the demonstration is only worth anything if the seeded unit still is what the
    // test says it is. A renamed id would otherwise make this pass by finding nothing.
    expect(maleOnly).toBeDefined();
    expect(maleOnly?.sexDesignation).toBe("Male only");

    const verdict = eligibility(
      movement({ sex: "Female", cohort: "Adult", security: "Secure" }),
      maleOnly as Unit,
      NOW_ANCHOR,
    );

    expect(verdict.gates.find((gate) => gate.gate === "sex_designation")?.pass).toBe(false);
    expect(verdict.eligible).toBe(false);
  });

  it("still offers that same bed to a Male movement, so the gate is not a blanket refusal", () => {
    const verdict = eligibility(
      movement({ sex: "Male", cohort: "Adult", security: "Secure" }),
      unitById("fsh-adult-secure") as Unit,
      NOW_ANCHOR,
    );
    expect(verdict.gates.find((gate) => gate.gate === "sex_designation")?.pass).toBe(true);
    expect(verdict.eligible).toBe(true);
  });

  it("accepts either sex at an undesignated ward, which is most of the network", () => {
    for (const sex of ["Female", "Male"] as const) {
      const verdict = eligibility(movement({ sex }), unit({ sexDesignation: "Undesignated" }), NOW);
      const gate = verdict.gates.find((g) => g.gate === "sex_designation");
      expect(gate?.pass).toBe(true);
      expect(gate?.detail).toContain("accepts either sex");
    }
  });

  it("refuses a Male movement at a Female-only ward, the same rule for the other sex", () => {
    const verdict = eligibility(movement({ sex: "Male" }), unit({ sexDesignation: "Female only" }), NOW);
    expect(verdict.gates.find((gate) => gate.gate === "sex_designation")?.pass).toBe(false);
  });

  it("states the rule the way the referral path states it, so the two paths do not diverge", () => {
    const ward = unit({ sexDesignation: "Male only", name: "Test Unit" });
    const refused = eligibility(movement({ sex: "Female" }), ward, NOW);
    const accepted = eligibility(movement({ sex: "Male" }), ward, NOW);
    expect(refused.gates.find((gate) => gate.gate === "sex_designation")?.detail).toBe(
      "Test Unit is male only and does not accept this movement's sex",
    );
    expect(accepted.gates.find((gate) => gate.gate === "sex_designation")?.detail).toBe(
      "Test Unit is male only and accepts this movement's sex",
    );
  });
});

/**
 * D7, on the MOVEMENT path.
 *
 * `referralEligibility` has refused a forensic bed unconditionally since Phase 7; `eligibility`
 * never did, so a movement's shortlist could show `eligible: true` for a forensic bed — measured
 * at `f2abfba77` for 18 of the 35 seeded Adult movements against the network's forensic bed,
 * `brm-adult-secure`, at the same instant the referral path refused that same unit outright. The
 * gate reads nothing but `unit.forensic`, the same field both paths receive on the same `Unit`, so
 * there was never a reason it could live on only one path.
 *
 * The local `unit()` factory above already supports building a forensic unit — its `forensic:
 * false` default sits before `...overrides` in the returned object, so `unit({ forensic: true })`
 * overrides it exactly the way every other field override in this file already works. No change to
 * the factory itself was needed; the gap was that no test in this file exercised that override.
 */
describe("forensic, on the movement path", () => {
  it("refuses a forensic unit, and the refusal names it as forensic", () => {
    const verdict = eligibility(movement(), unit({ forensic: true, name: "Test Unit" }), NOW);
    const gate = verdict.gates.find((g) => g.gate === "forensic");
    expect(gate?.pass).toBe(false);
    expect(gate?.detail).toBe("Test Unit is a forensic bed and is never offered as a destination");
    expect(verdict.eligible).toBe(false);
  });

  it("still offers an otherwise-identical non-forensic unit, so the gate is not a blanket refusal", () => {
    const verdict = eligibility(movement(), unit({ forensic: false }), NOW);
    const gate = verdict.gates.find((g) => g.gate === "forensic");
    expect(gate?.pass).toBe(true);
    expect(verdict.eligible).toBe(true);
  });

  it("agrees with referralEligibility: the same forensic unit is refused on both paths at once", () => {
    const bed = unit({
      forensic: true,
      cohort: "Adult",
      security: "Secure",
      sexDesignation: "Undesignated",
      name: "Test Secure Unit",
    });

    const subjectReferral = referral({ ageBand: "Adult" });
    const ward = subjectReferral.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
    if (!ward || ward.destination.kind !== "psychiatric_ward") {
      throw new Error(`${subjectReferral.id} has no psychiatric ward destination, so it has no bed gates to run`);
    }

    const movementVerdict = eligibility(movement({ cohort: "Adult", security: "Secure", sex: "Male" }), bed, NOW);
    const referralVerdict = referralEligibility(subjectReferral, ward.destination, bed, NOW);

    expect(movementVerdict.eligible).toBe(false);
    expect(referralVerdict.eligible).toBe(false);
    expect(movementVerdict.gates.find((g) => g.gate === "forensic")?.pass).toBe(false);
    expect(referralVerdict.gates.find((g) => g.gate === "forensic")?.pass).toBe(false);
  });
});
