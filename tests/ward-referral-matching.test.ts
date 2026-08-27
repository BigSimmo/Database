// tests/ward-referral-matching.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { referralEligibility } from "../src/components/ward-management/ward-eligibility";
import { referralCandidates } from "../src/components/ward-management/ward-referrals";
import type { Referral, Unit } from "../src/components/ward-management/ward-model";

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

function referral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: "RF-TEST",
    ageBand: "Adult",
    sex: "Female",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    source: "community",
    raisedAt: NOW - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    state: "queued",
    ...overrides,
  };
}

function gate(verdict: ReturnType<typeof referralEligibility>, name: string) {
  return verdict.gates.find((g) => g.gate === name);
}

describe("age", () => {
  it("accepts a referral whose age band matches the unit's cohort", () => {
    const verdict = referralEligibility(referral({ ageBand: "Older adult" }), unit({ cohort: "Older adult" }), NOW);
    expect(gate(verdict, "age")?.pass).toBe(true);
  });

  it("rejects a referral whose age band does not match the unit's cohort", () => {
    const verdict = referralEligibility(referral({ ageBand: "Youth" }), unit({ cohort: "Adult" }), NOW);
    expect(gate(verdict, "age")?.pass).toBe(false);
  });

  it("gives the age gate a different detail string on pass than on fail", () => {
    const passing = referralEligibility(referral({ ageBand: "Adult" }), unit({ cohort: "Adult" }), NOW);
    const failing = referralEligibility(referral({ ageBand: "Youth" }), unit({ cohort: "Adult" }), NOW);
    expect(gate(passing, "age")?.detail).not.toBe(gate(failing, "age")?.detail);
  });
});

describe("legal_status", () => {
  // D3 rule 2 / spec's second most important test: a referral that does NOT need an involuntary
  // bed is accepted by ANY bed, authorised or not — this is the "not needed" half of the
  // accepts-rule, and it is what makes the rule an accepts-rule rather than an equality. Mutating
  // the gate to strict equality (`unit.authorised === referral.involuntaryBedNeeded`) breaks
  // exactly this case, because an authorised unit would then wrongly refuse a referral that
  // doesn't need one.
  it("a referral that does not need an involuntary bed is accepted by an authorised unit", () => {
    const verdict = referralEligibility(referral({ involuntaryBedNeeded: false }), unit({ authorised: true }), NOW);
    expect(gate(verdict, "legal_status")?.pass).toBe(true);
  });

  it("a referral that does not need an involuntary bed is also accepted by an unauthorised (voluntary-only) unit", () => {
    const verdict = referralEligibility(referral({ involuntaryBedNeeded: false }), unit({ authorised: false }), NOW);
    expect(gate(verdict, "legal_status")?.pass).toBe(true);
  });

  // The "needed" half of the accepts-rule: only a bed that can hold someone involuntarily may
  // accept it. This is the case a bare "always pass" gate (the dimension's pre-Phase-7 state) can
  // never catch, because it would pass here too.
  it("a referral that needs an involuntary bed is accepted by an authorised unit", () => {
    const verdict = referralEligibility(referral({ involuntaryBedNeeded: true }), unit({ authorised: true }), NOW);
    expect(gate(verdict, "legal_status")?.pass).toBe(true);
  });

  it("a referral that needs an involuntary bed is refused by an unauthorised (voluntary-only) unit", () => {
    const verdict = referralEligibility(referral({ involuntaryBedNeeded: true }), unit({ authorised: false }), NOW);
    expect(gate(verdict, "legal_status")?.pass).toBe(false);
  });

  it("gives the legal_status gate a different detail string for an authorised unit than an unauthorised one, when a referral needs an involuntary bed", () => {
    const authorised = referralEligibility(referral({ involuntaryBedNeeded: true }), unit({ authorised: true }), NOW);
    const unauthorised = referralEligibility(
      referral({ involuntaryBedNeeded: true }),
      unit({ authorised: false }),
      NOW,
    );
    expect(gate(authorised, "legal_status")?.detail).not.toBe(gate(unauthorised, "legal_status")?.detail);
  });

  it("neither detail string judges the person — both describe the bed or the requirement", () => {
    const authorised = referralEligibility(referral({ involuntaryBedNeeded: true }), unit({ authorised: true }), NOW);
    const unauthorised = referralEligibility(
      referral({ involuntaryBedNeeded: true }),
      unit({ authorised: false }),
      NOW,
    );
    const notNeeded = referralEligibility(referral({ involuntaryBedNeeded: false }), unit({ authorised: true }), NOW);
    for (const detail of [
      gate(authorised, "legal_status")?.detail,
      gate(unauthorised, "legal_status")?.detail,
      gate(notNeeded, "legal_status")?.detail,
    ]) {
      expect(detail).toBeDefined();
      expect(detail).not.toMatch(/patient|person|unsuitable|assessed/i);
    }
  });
});

describe("sex_designation", () => {
  // Most beds are undesignated, so a rule of the form `bed.sexDesignation === referral.sex` would
  // exclude every referral from most of the network while looking entirely reasonable in review.
  // This test exists to make that mistake impossible to ship.
  it("an undesignated bed accepts a referral of either sex", () => {
    const bed = unit({ sexDesignation: "Undesignated" });
    for (const sex of ["Female", "Male"] as const) {
      const verdict = referralEligibility(referral({ sex }), bed, NOW);
      expect(gate(verdict, "sex_designation")?.pass).toBe(true);
    }
  });

  it("a Female only bed accepts a female referral and rejects a male referral", () => {
    const bed = unit({ sexDesignation: "Female only" });
    expect(gate(referralEligibility(referral({ sex: "Female" }), bed, NOW), "sex_designation")?.pass).toBe(true);
    expect(gate(referralEligibility(referral({ sex: "Male" }), bed, NOW), "sex_designation")?.pass).toBe(false);
  });

  it("a Male only bed accepts a male referral and rejects a female referral", () => {
    const bed = unit({ sexDesignation: "Male only" });
    expect(gate(referralEligibility(referral({ sex: "Male" }), bed, NOW), "sex_designation")?.pass).toBe(true);
    expect(gate(referralEligibility(referral({ sex: "Female" }), bed, NOW), "sex_designation")?.pass).toBe(false);
  });
});

/**
 * D4: `sex_designation` (a property of the bed) and `sex_mix` (an occupancy fact) answer
 * different questions, neither is derived from the other, and neither replaces the other. These
 * two tests each construct a unit that passes one gate while failing the other, in each
 * direction, so a future collapse of the two gates into one fails here immediately.
 */
describe("sex_designation and sex_mix are independent", () => {
  it("a unit can pass sex_designation while failing sex_mix", () => {
    const bed = unit({
      sexDesignation: "Undesignated",
      sexMix: { Female: 0, Male: 5 },
      allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
    });
    const verdict = referralEligibility(referral({ sex: "Female" }), bed, NOW);
    expect(gate(verdict, "sex_designation")?.pass).toBe(true);
    expect(gate(verdict, "sex_mix")?.pass).toBe(false);
  });

  it("a unit can fail sex_designation while passing sex_mix", () => {
    const bed = unit({
      sexDesignation: "Female only",
      sexMix: { Female: 0, Male: 5 },
      allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
    });
    const verdict = referralEligibility(referral({ sex: "Male" }), bed, NOW);
    expect(gate(verdict, "sex_designation")?.pass).toBe(false);
    expect(gate(verdict, "sex_mix")?.pass).toBe(true);
  });
});

describe("forensic", () => {
  it("a forensic bed never accepts a Phase 7 referral", () => {
    const verdict = referralEligibility(referral(), unit({ forensic: true }), NOW);
    expect(gate(verdict, "forensic")?.pass).toBe(false);
  });

  it("a non-forensic bed passes the forensic gate", () => {
    const verdict = referralEligibility(referral(), unit({ forensic: false }), NOW);
    expect(gate(verdict, "forensic")?.pass).toBe(true);
  });

  it("the forensic gate's detail describes the bed, not a judgement on the referral", () => {
    const verdict = referralEligibility(referral(), unit({ forensic: true, name: "Bunbury Adult Secure" }), NOW);
    const detail = gate(verdict, "forensic")?.detail ?? "";
    expect(detail).toContain("Bunbury Adult Secure");
    expect(detail.toLowerCase()).not.toMatch(/unsuitable|assessed|not appropriate/);
  });
});

describe("security (secureBedNeeded)", () => {
  it("accepts a secure-bed-needed referral into a Secure unit", () => {
    const verdict = referralEligibility(referral({ secureBedNeeded: true }), unit({ security: "Secure" }), NOW);
    expect(gate(verdict, "security")?.pass).toBe(true);
  });

  it("rejects a secure-bed-needed referral from an Open unit", () => {
    const verdict = referralEligibility(referral({ secureBedNeeded: true }), unit({ security: "Open" }), NOW);
    expect(gate(verdict, "security")?.pass).toBe(false);
  });

  it("accepts a referral not needing a secure bed into an Open unit", () => {
    const verdict = referralEligibility(referral({ secureBedNeeded: false }), unit({ security: "Open" }), NOW);
    expect(gate(verdict, "security")?.pass).toBe(true);
  });
});

describe("reused gates carry over unchanged", () => {
  it("refuses when no same-sex occupants and only one allocatable bed (sex_mix)", () => {
    const bed = unit({
      sexMix: { Female: 0, Male: 4 },
      allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
    });
    const verdict = referralEligibility(referral({ sex: "Female" }), bed, NOW);
    expect(gate(verdict, "sex_mix")?.pass).toBe(false);
  });

  it("a referral always passes specialling, since it carries no specialling-need fact", () => {
    const verdict = referralEligibility(referral(), unit({ speciallingCapacity: 0 }), NOW);
    expect(gate(verdict, "specialling")?.pass).toBe(true);
  });

  it("drops a unit whose allocatable figure has gone stale rather than showing it hopefully", () => {
    const stale = unit({ allocatable: { value: 4, source: "ward", confirmedAt: NOW - 200, staleAfterMinutes: 120 } });
    const verdict = referralEligibility(referral(), stale, NOW);
    expect(gate(verdict, "capacity_freshness")?.pass).toBe(false);
  });

  it("refuses a unit with zero allocatable beds", () => {
    const empty = unit({ allocatable: { value: 0, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 } });
    const verdict = referralEligibility(referral(), empty, NOW);
    expect(gate(verdict, "allocatable_bed")?.pass).toBe(false);
  });

  it("passes every gate for a well-matched referral", () => {
    const verdict = referralEligibility(referral(), unit(), NOW);
    expect(verdict.eligible).toBe(true);
    expect(verdict.gates.every((g) => g.pass)).toBe(true);
  });
});

describe("referralCandidates", () => {
  it("returns every unit, never a truncated list", () => {
    const units = [unit({ id: "u1" }), unit({ id: "u2" }), unit({ id: "u3" })];
    const candidates = referralCandidates(referral(), units, NOW);
    expect(candidates).toHaveLength(units.length);
    expect(candidates.map((c) => c.unit.id)).toEqual(["u1", "u2", "u3"]);
  });

  it("preserves the given order rather than sorting or ranking by suitability", () => {
    const units = [
      unit({ id: "u3", cohort: "Youth" }), // would not match — an ordering that "helpfully"
      unit({ id: "u1", cohort: "Adult" }), // sorted matches first would read as a recommendation
      unit({ id: "u2", cohort: "Adult" }),
    ];
    const candidates = referralCandidates(referral({ ageBand: "Adult" }), units, NOW);
    expect(candidates.map((c) => c.unit.id)).toEqual(["u3", "u1", "u2"]);
  });

  it("pairs each unit with its own verdict", () => {
    const units = [unit({ id: "match", cohort: "Adult" }), unit({ id: "mismatch", cohort: "Youth" })];
    const candidates = referralCandidates(referral({ ageBand: "Adult" }), units, NOW);
    expect(candidates.find((c) => c.unit.id === "match")?.verdict.eligible).toBe(true);
    const mismatchVerdict = candidates.find((c) => c.unit.id === "mismatch")?.verdict;
    expect(mismatchVerdict && gate(mismatchVerdict, "age")?.pass).toBe(false);
  });
});

/**
 * Spec D15 / the fourth most important test: matching must stay independent of the four-stage
 * bed-release model (`BedRelease`, `BED_RELEASE_STATES`, `BED_RELEASE_CONFIDENCE_LEVELS`), which
 * no ward clinician has yet validated. A source-text contract rather than a runtime assertion,
 * because the whole point is that no code path in these two files reads that model AT ALL — not
 * even one that happens to agree with `unit.allocatable` today.
 *
 * Checked against `import` statements specifically (not the whole file) so this test does not
 * collide with a doc comment that names `BedRelease` in prose, the way the naive whole-file
 * check first written here did — that version failed on this file's OWN explanatory comment
 * about staying independent of the release model, which is exactly the false positive a
 * structural test must not produce.
 */
describe("matching stays independent of the four-stage bed model", () => {
  const BED_RELEASE_IDENTIFIER = /\bBedRelease\b|\bBED_RELEASE_STATES\b|\bBED_RELEASE_CONFIDENCE_LEVELS\b/;

  function importsMention(source: string, needle: RegExp) {
    const importStatements = source.match(/import\s+[\s\S]*?;/g) ?? [];
    return importStatements.some((statement) => needle.test(statement));
  }

  it("ward-eligibility.ts never imports BedRelease", () => {
    const eligibilitySource = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/ward-eligibility.ts"),
      "utf8",
    );
    expect(importsMention(eligibilitySource, BED_RELEASE_IDENTIFIER)).toBe(false);
  });

  it("ward-referrals.ts never imports BedRelease", () => {
    const referralsSource = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/ward-referrals.ts"),
      "utf8",
    );
    expect(importsMention(referralsSource, BED_RELEASE_IDENTIFIER)).toBe(false);
  });
});
