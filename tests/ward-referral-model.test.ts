// tests/ward-referral-model.test.ts
import { describe, expect, it } from "vitest";

import {
  REFERRAL_DECLINE_REASONS,
  REFERRAL_SOURCES,
  REFERRAL_STATES,
  SEX_DESIGNATIONS,
  type Referral,
} from "../src/components/ward-management/ward-model";
import { referrals } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits, siteByCode } from "../src/components/ward-management/ward-sites";

describe("bed category — SexDesignation", () => {
  it("SEX_DESIGNATIONS is exactly the three designations, Undesignated first", () => {
    expect(SEX_DESIGNATIONS).toEqual(["Undesignated", "Female only", "Male only"]);
  });

  /**
   * Seed rule 1. `sexDesignation` is a CONSTRAINT on who may occupy a bed, never a value to
   * compare a referral's `sex` against for equality — a matching rule of the shape
   * `bed.sexDesignation === referral.sex` would exclude every undesignated bed, which is most of
   * the network, while looking entirely reasonable in review. This floor is deliberately not
   * "more than half": a fixture where every bed carries a designation would let that exact
   * equality bug pass every other test in this file, so the majority must be overwhelming and at
   * least one bed of each named designation must exist to prove the constraint is genuinely
   * expressible, not merely declared in the type.
   */
  it("seeds a clear majority of units Undesignated, with at least one Female only and one Male only", () => {
    const units = allUnits();
    const undesignated = units.filter((unit) => unit.sexDesignation === "Undesignated");
    const femaleOnly = units.filter((unit) => unit.sexDesignation === "Female only");
    const maleOnly = units.filter((unit) => unit.sexDesignation === "Male only");

    expect(femaleOnly.length).toBeGreaterThanOrEqual(1);
    expect(maleOnly.length).toBeGreaterThanOrEqual(1);
    // Every unit's designation is exactly one of the three — non-vacuity for the partition below.
    expect(undesignated.length + femaleOnly.length + maleOnly.length).toBe(units.length);
    // "Clear majority", not a bare majority: undesignated units must be the overwhelming norm.
    expect(undesignated.length).toBeGreaterThan(units.length * 0.8);
  });

  /** Seed rule 2. */
  it("seeds at least one forensic unit", () => {
    expect(allUnits().filter((unit) => unit.forensic).length).toBeGreaterThanOrEqual(1);
  });

  it("never merges `forensic` with `security` — a forensic unit here is Secure, but security still varies independently of forensic elsewhere in the fixture", () => {
    const units = allUnits();
    const forensicUnits = units.filter((unit) => unit.forensic);
    expect(forensicUnits.every((unit) => unit.security === "Secure")).toBe(true);
    // Plenty of non-forensic units are also Secure — `security` is not derived from `forensic`.
    const nonForensicSecure = units.filter((unit) => !unit.forensic && unit.security === "Secure");
    expect(nonForensicSecure.length).toBeGreaterThanOrEqual(1);
  });
});

describe("bed category — the Youth unit", () => {
  /**
   * Seed rule 3. The East Metropolitan Youth Unit (EMyU) at Bentley Health Service is a real
   * unit supplied by the product owner on 2026-08-27, not an invention — this test pins the name
   * verbatim, capitalisation included, and its site. Without it, every youth referral fails the
   * cohort gate in `ward-eligibility.ts` against the whole network for a structural reason.
   */
  it("seeds exactly one Youth unit: the East Metropolitan Youth Unit (EMyU) at Bentley Health Service (BTY)", () => {
    const youthUnits = allUnits().filter((unit) => unit.cohort === "Youth");
    expect(youthUnits).toHaveLength(1);
    expect(youthUnits[0]?.name).toBe("East Metropolitan Youth Unit (EMyU)");
    expect(youthUnits[0]?.siteCode).toBe("BTY");

    const bentley = siteByCode("BTY");
    expect(bentley?.name).toBe("Bentley Health Service");
    expect(bentley?.units.some((unit) => unit.id === youthUnits[0]?.id)).toBe(true);
  });
});

describe("front-door contract — fixed lists", () => {
  it("REFERRAL_SOURCES and REFERRAL_STATES match the front-door contract exactly", () => {
    expect(REFERRAL_SOURCES).toEqual(["community", "crisis_service", "police", "ambulance", "inter_hospital"]);
    expect(REFERRAL_STATES).toEqual(["queued", "accepted", "declined"]);
  });

  it("REFERRAL_DECLINE_REASONS matches the front-door contract exactly", () => {
    expect(REFERRAL_DECLINE_REASONS).toEqual([
      "no_suitable_bed",
      "age_band_not_provided_here",
      "sex_designation_unavailable",
      "secure_bed_unavailable",
      "out_of_catchment",
      "referred_elsewhere",
    ]);
  });

  /**
   * Every decline reason must describe the SERVICE's answer or the NETWORK's state, never the
   * person referred — the same bar `BED_RELEASE_BLOCKERS` holds to, which is why "Pending case
   * review outcome" was excluded there ("case review" reads as about the patient's own case, not
   * the bed). A denylist only catches an anticipated wording, so this checks for the recognisable
   * shapes a person-describing reason would take, not just one literal phrase.
   */
  it("REFERRAL_DECLINE_REASONS contains no entry describing a person", () => {
    const personDescribingFragments = [
      "not appropriate",
      "not unwell",
      "not ready",
      "behaviour",
      "behavior",
      "engagement",
      "risk",
      "presentation",
      "diagnosis",
      "history",
      "capacity to consent",
      "insight",
      "compliance",
      "non-compliant",
    ];
    for (const reason of REFERRAL_DECLINE_REASONS) {
      const words = reason.replace(/_/g, " ");
      for (const fragment of personDescribingFragments) {
        expect(words).not.toContain(fragment);
      }
    }
  });

  it("no Mental Health Act figure, timeframe or threshold appears in any decline reason", () => {
    for (const reason of REFERRAL_DECLINE_REASONS) {
      expect(reason).not.toMatch(/\d/);
    }
  });
});

describe("referrals fixture — the awkward cases (seed rule 4)", () => {
  it("is non-empty, so every check below is not vacuously true", () => {
    expect(referrals.length).toBeGreaterThan(0);
  });

  /**
   * Seed rule 4(a). Proved structurally against the real fixture — not asserted against a
   * specific id alone — so this stays true even if the exact referral that satisfies it changes.
   * A referral is structurally unmatchable when no unit anywhere shares its `ageBand` cohort, or
   * (when a secure bed is needed) no unit sharing that cohort is `"Secure"`.
   */
  it("seeds at least one queued referral that no unit in the whole network could structurally satisfy", () => {
    const structurallyImpossible = referrals.filter((referral) => {
      if (referral.state !== "queued") return false;
      const candidates = allUnits().filter((unit) => unit.cohort === referral.ageBand);
      const viable = referral.secureBedNeeded ? candidates.filter((unit) => unit.security === "Secure") : candidates;
      return viable.length === 0;
    });
    expect(structurallyImpossible.length).toBeGreaterThanOrEqual(1);
  });

  it("RF-001 is exactly that case: Youth + a secure bed needed, and the network's only Youth unit is Open", () => {
    const rf001 = referrals.find((referral) => referral.id === "RF-001");
    expect(rf001).toMatchObject({ ageBand: "Youth", secureBedNeeded: true, state: "queued" });
    const youthUnits = allUnits().filter((unit) => unit.cohort === "Youth");
    expect(youthUnits.every((unit) => unit.security === "Open")).toBe(true);
  });

  /** Seed rule 4(b). */
  it("seeds at least one declined referral, with a decline reason drawn from the fixed list", () => {
    const declined = referrals.filter((referral) => referral.state === "declined");
    expect(declined.length).toBeGreaterThanOrEqual(1);
    for (const referral of declined) {
      expect(referral.declineReason).toBeDefined();
      expect(REFERRAL_DECLINE_REASONS).toContain(referral.declineReason);
    }
  });

  /** Seed rule 4(c). */
  it("seeds at least one youth referral", () => {
    expect(referrals.filter((referral) => referral.ageBand === "Youth").length).toBeGreaterThanOrEqual(1);
  });

  /**
   * Seed rule 4(d) — the fixture shape that catches the equality-shaped matching bug before
   * Task 2 can even write it: a referral whose sex a DESIGNATED bed correctly excludes, while an
   * UNDESIGNATED bed correctly accepts the same referral. `bed.sexDesignation === referral.sex`
   * would (wrongly) refuse this referral everywhere, because `"Undesignated" !== "Male"` reads as
   * a mismatch even though an undesignated bed accepts every sex.
   */
  it("seeds at least one referral whose sex a designated bed would exclude, but an undesignated bed accepts", () => {
    const found = referrals.find((referral) => {
      if (referral.state !== "accepted" || !referral.acceptedUnitId) return false;
      const acceptedUnit = allUnits().find((unit) => unit.id === referral.acceptedUnitId);
      if (acceptedUnit?.sexDesignation !== "Undesignated") return false;
      // A designated bed elsewhere in the network that names the OTHER sex — it would correctly
      // exclude this referral by name, proving the designation is a real, working constraint.
      const oppositeDesignation = referral.sex === "Male" ? "Female only" : "Male only";
      return allUnits().some((unit) => unit.sexDesignation === oppositeDesignation);
    });
    expect(found).toBeDefined();
  });

  it("RF-003 is exactly that case: Male, accepted at an Undesignated bed, while the network's Female-only bed exists and would exclude it", () => {
    const rf003 = referrals.find((referral) => referral.id === "RF-003");
    expect(rf003).toMatchObject({ sex: "Male", state: "accepted", acceptedUnitId: "scgh-adult-open" });
    const acceptedUnit = allUnits().find((unit) => unit.id === rf003?.acceptedUnitId);
    expect(acceptedUnit?.sexDesignation).toBe("Undesignated");
    expect(allUnits().some((unit) => unit.sexDesignation === "Female only")).toBe(true);
  });

  it("every acceptedUnitId and originSiteCode in the fixture resolves to a real unit/site — no dangling reference", () => {
    for (const referral of referrals) {
      if (referral.acceptedUnitId) {
        expect(allUnits().some((unit) => unit.id === referral.acceptedUnitId)).toBe(true);
      }
      expect(referral.originSiteCode).not.toMatch(/^$/);
    }
  });
});

/**
 * Task 1's privacy discipline, from the binding phase spec: a referral carries exactly four
 * facts about the person referred — `ageBand`, `sex`, `secureBedNeeded`, `involuntaryBedNeeded` —
 * and nothing else. No free text anywhere, unlike `Decline` (which carries an optional `note`).
 * Following the Phase 4/5 pattern (`tests/ward-flow-reducer.test.ts`'s `BedRelease` allowlist,
 * `tests/ward-bed-availability-model.test.ts`'s `LeaveBed` allowlist): an ALLOWLIST of the exact
 * field set, checked against the type's own shape via a fully-populated canonical instance —
 * never against what a single partial fixture entry happens to show — so a future field named
 * `patientId`, `notes`, `diagnosis` or `dob` is caught rather than merely discouraged.
 *
 * `involuntaryBedNeeded` was added mid-build, deliberately, once — see
 * `docs/ward-flow-phase-6-7-decisions.md` ("A fifth answer, given mid-build"). This list widens
 * from three to four fields here on purpose; widening it again is a governance decision, not an
 * implementation one, and this test is what makes that true rather than aspirational.
 */
describe("Referral privacy — structural", () => {
  const ALLOWED_REFERRAL_FIELDS = [
    "id",
    "ageBand",
    "sex",
    "secureBedNeeded",
    "involuntaryBedNeeded",
    "source",
    "raisedAt",
    "urgency",
    "originSiteCode",
    "transportNeeded",
    "state",
    "acceptedUnitId",
    "declineReason",
    "decidedAt",
    "decidedBy",
  ].sort();

  it("a fully-populated Referral (every optional field set) has exactly the allowed field set", () => {
    // `Required<Referral>` forces this literal to supply every field the type has, including the
    // optional ones — so its key set is the type's COMPLETE field set, not a subset any one real
    // (partly-decided) referral would show.
    const canonical: Required<Referral> = {
      id: "REF-CANON",
      ageBand: "Adult",
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      source: "community",
      raisedAt: NOW_ANCHOR,
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      state: "accepted",
      acceptedUnitId: "rph-adult-secure",
      declineReason: "no_suitable_bed",
      decidedAt: NOW_ANCHOR + 5,
      decidedBy: "Flow coordinator",
    };
    expect(Object.keys(canonical).sort()).toEqual(ALLOWED_REFERRAL_FIELDS);
  });

  it("gives every real referral in the fixture only keys drawn from that same allowed set", () => {
    expect(referrals.length).toBeGreaterThan(0);
    for (const referral of referrals) {
      for (const key of Object.keys(referral)) {
        expect(ALLOWED_REFERRAL_FIELDS).toContain(key);
      }
    }
  });
});
