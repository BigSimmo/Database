// tests/ward-referral-model.test.ts
import { describe, expect, it } from "vitest";

import { referralEligibility } from "../src/components/ward-management/ward-eligibility";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import {
  HOME_REGIONS,
  REFERRAL_DECLINE_REASONS,
  REFERRAL_SOURCES,
  REFERRAL_STATES,
  SEX_DESIGNATIONS,
  type Referral,
  type Unit,
} from "../src/components/ward-management/ward-model";
import { referrals } from "../src/components/ward-management/ward-movements";
import {
  DECLINE_REASON_LABELS,
  hasConfirmedCapacity,
  matchReason,
  networkHasCohort,
  recentlyDecidedReferrals,
  referralCandidates,
  referralQueueOrder,
  referralWaitLabel,
} from "../src/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allUnits, siteByCode, unitById } from "../src/components/ward-management/ward-sites";

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

  /**
   * M1 fix: `brm-adult-secure` used to be simultaneously the network's only forensic unit, its
   * only Male-only unit, AND `allocatable: 0` — so deleting either the `forensic` gate or the
   * `sex_designation` gate would not have changed a single candidate list, because the other
   * (allocatable) already excluded that unit for every referral. Fixed by giving
   * `brm-adult-secure` a usable allocatable count (making `forensic` the one thing that excludes
   * it) and moving Male-only to `fsh-adult-secure`, a real, usable, non-forensic unit (making
   * `sex_designation` load-bearing there instead). These two tests prove each gate is now the
   * SOLE reason its unit is excluded, for a referral every other gate accepts — not merely that
   * the designation/forensic flag is set.
   */
  it("brm-adult-secure is excluded by the forensic gate alone, not also by unavailability", () => {
    const unit = unitById("brm-adult-secure")!;
    expect(unit.forensic).toBe(true);
    expect(unit.allocatable.value).toBeGreaterThan(0);
    const compatible: Referral = {
      id: "RF-CHECK-FORENSIC",
      ageBand: "Adult",
      sex: "Male",
      secureBedNeeded: true,
      involuntaryBedNeeded: false,
      homeRegion: "Kimberley",
      source: "community",
      raisedAt: NOW_ANCHOR - 10,
      urgency: 2,
      originSiteCode: "BRM",
      transportNeeded: false,
      state: "queued",
    };
    const verdict = referralEligibility(compatible, unit, NOW_ANCHOR);
    const forensicGate = verdict.gates.find((gate) => gate.gate === "forensic");
    expect(forensicGate?.pass).toBe(false);
    expect(verdict.gates.filter((gate) => gate.gate !== "forensic").every((gate) => gate.pass)).toBe(true);
  });

  it("fsh-adult-secure's Male-only designation alone excludes a Female referral every other gate accepts", () => {
    const unit = unitById("fsh-adult-secure")!;
    expect(unit.sexDesignation).toBe("Male only");
    expect(unit.forensic).toBe(false);
    const compatible: Referral = {
      id: "RF-CHECK-DESIGNATION",
      ageBand: "Adult",
      sex: "Female",
      secureBedNeeded: true,
      involuntaryBedNeeded: false,
      homeRegion: "Perth Metropolitan",
      source: "community",
      raisedAt: NOW_ANCHOR - 10,
      urgency: 2,
      originSiteCode: "FSH",
      transportNeeded: false,
      state: "queued",
    };
    const verdict = referralEligibility(compatible, unit, NOW_ANCHOR);
    const designationGate = verdict.gates.find((gate) => gate.gate === "sex_designation");
    expect(designationGate?.pass).toBe(false);
    expect(verdict.gates.filter((gate) => gate.gate !== "sex_designation").every((gate) => gate.pass)).toBe(true);
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
      "belongs_to_another_service",
      "referred_elsewhere",
    ]);
  });

  /**
   * Phase 8 Task 6. `"out_of_catchment"` claimed a check the system cannot perform: nothing in
   * this model holds a catchment for anybody, and `homeRegion` cannot supply one (a catchment is
   * a service's boundary, a home region is where a person lives, and ten WA regions do not map
   * onto five health services). The reason was RENAMED, not removed — "this request belongs to
   * another service" is a real administrative answer a coordinator can give and can know, and
   * removing it would push coordinators onto a reason that means something else.
   *
   * Which is why distinctness is asserted here rather than left implied by the array pin above:
   * `"belongs_to_another_service"` (another service should answer this request) and
   * `"referred_elsewhere"` (this request has already been sent on) are two different answers, and
   * collapsing them into one is the cheap "tidy-up" this test exists to refuse.
   */
  it("renames the catchment reason and keeps it distinct from referred_elsewhere", () => {
    expect(REFERRAL_DECLINE_REASONS).toContain("belongs_to_another_service");
    expect(REFERRAL_DECLINE_REASONS).toContain("referred_elsewhere");
    expect(REFERRAL_DECLINE_REASONS).not.toContain("out_of_catchment" as never);
    expect(new Set(REFERRAL_DECLINE_REASONS).size).toBe(REFERRAL_DECLINE_REASONS.length);

    // The labels a coordinator actually reads must stay two different sentences too — a shared
    // label collapses the two answers on screen even when the enum keeps them apart.
    expect(DECLINE_REASON_LABELS.belongs_to_another_service).toBe("Belongs to another service");
    expect(DECLINE_REASON_LABELS.belongs_to_another_service).not.toBe(DECLINE_REASON_LABELS.referred_elsewhere);

    // And the renamed reason must not reintroduce the claim it was renamed to drop.
    for (const reason of REFERRAL_DECLINE_REASONS) {
      expect(reason).not.toMatch(/catchment/i);
      expect(DECLINE_REASON_LABELS[reason]).not.toMatch(/catchment/i);
    }
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

  /**
   * Review finding M2: the check above sweeps the ENUM KEYS, which nobody reads. The strings a
   * coordinator actually picks from in the decline `<select>` (and now reads back on the board's
   * decided row) are `DECLINE_REASON_LABELS`' VALUES, and nothing swept those — so changing
   * `no_suitable_bed`'s label to "No suitable bed within 24 hours" left the key untouched, passed
   * the digit check above, and rendered the figure on a clinical surface.
   *
   * The key-set pin is the other half: a label map that silently loses a key falls back to the
   * raw enum value at every consumer, and a label map that gains one puts a string on screen that
   * no reason can ever produce. Both halves are asserted here rather than in a DOM test, because
   * this is a property of the copy itself and must hold before any screen renders it.
   */
  it("no digit appears in any decline reason LABEL, and the label map covers exactly the reasons", () => {
    expect(Object.keys(DECLINE_REASON_LABELS).sort()).toEqual([...REFERRAL_DECLINE_REASONS].sort());
    for (const reason of REFERRAL_DECLINE_REASONS) {
      expect(DECLINE_REASON_LABELS[reason]).not.toMatch(/\d/);
    }
  });

  /**
   * Fix round B (this task's new field): `HOME_REGIONS` is the fixed list `homeRegion` is
   * membership-checked against — real Western Australian regions, never an address, never free
   * text. See `docs/ward-flow-phase-6-7-decisions.md` ("A sixth answer, given mid-build").
   */
  it("HOME_REGIONS is exactly the ten WA regions, Perth Metropolitan first", () => {
    expect(HOME_REGIONS).toEqual([
      "Perth Metropolitan",
      "Peel",
      "South West",
      "Great Southern",
      "Wheatbelt",
      "Goldfields-Esperance",
      "Mid West",
      "Gascoyne",
      "Pilbara",
      "Kimberley",
    ]);
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

  /**
   * H2 fix: `originSiteCode` used to be checked with `not.toMatch(/^$/)` — a non-empty check, not
   * a resolution. `"123 Wellington Street, Perth"` survives a non-empty check just as easily as
   * a real code does, and so does `"NOT-A-SITE"` — this file already imports `siteByCode`, which
   * is the real check that was one call away. `homeRegion` gets the equivalent membership check,
   * the field this task adds.
   */
  it("every acceptedUnitId, originSiteCode and homeRegion in the fixture resolves to a real unit/site/region — no dangling reference, no address", () => {
    for (const referral of referrals) {
      if (referral.acceptedUnitId) {
        expect(allUnits().some((unit) => unit.id === referral.acceptedUnitId)).toBe(true);
      }
      expect(
        siteByCode(referral.originSiteCode),
        `${referral.id} originSiteCode does not resolve to a real site`,
      ).toBeDefined();
      expect(HOME_REGIONS, `${referral.id} homeRegion is not a member of HOME_REGIONS`).toContain(referral.homeRegion);
    }
  });

  /**
   * C1 fix (Critical, fix round A's own review): the seed used to record RF-006 as `accepted` at
   * `brm-adult-secure`, a forensic unit `referralEligibility` refuses unconditionally (D7) — an
   * acceptance the live reducer (`ACCEPT_REFERRAL`, which calls this same function) would have
   * refused. This is the four-line test the review named as the one that would have caught it at
   * Task 1: every referral this fixture records as accepted must actually be eligible for the
   * unit it is recorded as accepted into, checked against the real function, not re-derived.
   */
  it("every accepted referral's acceptedUnitId is a unit referralEligibility actually says yes to", () => {
    const accepted = referrals.filter((referral) => referral.state === "accepted");
    expect(accepted.length).toBeGreaterThan(0);
    for (const referral of accepted) {
      const unit = unitById(referral.acceptedUnitId!);
      expect(
        unit,
        `${referral.id} acceptedUnitId ${referral.acceptedUnitId} does not resolve to a real unit`,
      ).toBeDefined();
      const verdict = referralEligibility(referral, unit!, NOW_ANCHOR);
      expect(
        verdict.eligible,
        `${referral.id} is recorded accepted at ${unit!.name} but referralEligibility refuses it: ${JSON.stringify(verdict.gates.filter((g) => !g.pass))}`,
      ).toBe(true);
    }
  });
});

/**
 * Task 1's privacy discipline, from the binding phase spec: a referral carries exactly five
 * facts about the person referred — `ageBand`, `sex`, `secureBedNeeded`, `involuntaryBedNeeded`,
 * `homeRegion` — and nothing else. No free text anywhere, unlike `Decline` (which carries an
 * optional `note`). Following the Phase 4/5 pattern (`tests/ward-flow-reducer.test.ts`'s
 * `BedRelease` allowlist, `tests/ward-bed-availability-model.test.ts`'s `LeaveBed` allowlist): an
 * ALLOWLIST of the exact field set, checked against the type's own shape via a fully-populated
 * canonical instance — never against what a single partial fixture entry happens to show — so a
 * future field named `patientId`, `notes`, `diagnosis` or `dob` is caught rather than merely
 * discouraged.
 *
 * `involuntaryBedNeeded` was added mid-build, deliberately, once (Task 2, "A fifth answer, given
 * mid-build") and `homeRegion` a second time in Phase 7 fix round B (this task, "A sixth answer,
 * given mid-build") — both recorded in `docs/ward-flow-phase-6-7-decisions.md`. This list widens
 * from four to five fields here on purpose; widening it again is a governance decision, not an
 * implementation one, and this test is what makes that true rather than aspirational.
 *
 * H3 fix (this task): the canonical-literal test below is real, but it is checked by TypeScript,
 * not by this test — `Required<Referral>` forces the literal to supply every field, so an extra
 * field added to `Referral` and left off the literal is a COMPILE error, invisible to `vitest run`
 * (vitest does not typecheck). `npm run test:focused` on this file, which is what an implementer
 * runs while working, could not fail on a new field — confirmed twice by two different people
 * before this fix. The "runtime companion" test after it closes that gap by building a REAL
 * referral through the reducer's own `RECEIVE_REFERRAL` write path and checking its keys under
 * plain vitest, no `tsc` involved. Both halves are kept, deliberately: the canonical-literal test
 * is the exhaustive, type-checked half (catches a missing field, under `tsc` only); the
 * reducer-built test is the runtime half (catches a field the reducer actually starts WRITING,
 * under vitest, which is the shape I2's fix and the intake-form risk both describe).
 */
describe("Referral privacy — structural", () => {
  const ALLOWED_REFERRAL_FIELDS = [
    "id",
    "ageBand",
    "sex",
    "secureBedNeeded",
    "involuntaryBedNeeded",
    "homeRegion",
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
    // Phase 8 Task 2 widened this list by two; Task 2R NARROWED IT BACK BY ONE. `arrivedAt` is
    // gone from `Referral` entirely — a referral no longer records arriving anywhere, because
    // `Admission` (`ward-admissions.ts`) is the one record of a person occupying a bed and it is
    // the only thing that closes. Removing the entry here is a TIGHTENING: this list is compared
    // for exact equality against a `Required<Referral>` literal below, so leaving a stale
    // `"arrivedAt"` in it would fail rather than quietly permit a field, and the literal itself
    // stops compiling if the field is not also dropped there. Nothing was loosened to make the
    // removal pass.
    //
    // `localBedSought` STAYS. It answers a different question — that somebody looked for a bed
    // closer to home, at a time, by a ROLE — which no admission records and Task 2R does not
    // touch. It is a fact about the REFERRAL, in the same operational family as `raisedAt`,
    // `decidedAt` and `decidedBy`, which is why it does not widen the five person-facts this type
    // holds, and why `homeAddress`, `notes` or `diagnosis` still fails here. It deliberately has
    // no note, reason or outcome field; the runtime companion below drives that write path so a
    // reducer that started writing one anyway fails under plain vitest, with no `tsc` step.
    "localBedSought",
  ].sort();

  it("a fully-populated Referral (every optional field set) has exactly the allowed field set", () => {
    // `Required<Referral>` forces this literal to supply every field the type has, including the
    // optional ones — so its key set is the type's COMPLETE field set, not a subset any one real
    // (partly-decided) referral would show. TYPE-CHECKED half of the guard — see this describe
    // block's own doc comment for why a runtime companion follows.
    const canonical: Required<Referral> = {
      id: "REF-CANON",
      ageBand: "Adult",
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      homeRegion: "Perth Metropolitan",
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
      // A role, never a person — and no note, reason or outcome field exists to populate.
      localBedSought: { at: NOW_ANCHOR + 2, by: "coordinator" },
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

  /**
   * RUNTIME half of the guard (H3 fix) — see this describe block's own doc comment. Built through
   * `RECEIVE_REFERRAL`, the real write path a future intake form (Task 4) will use, rather than a
   * hand-built object: if that path is ever extended to accept and store a sixth fact — the exact
   * failure scenario I2 closes, a text field whose value lands on a live referral — this test
   * fails under plain `vitest run`, with no `tsc` step required, because the new key would not be
   * a member of `ALLOWED_REFERRAL_FIELDS`.
   */
  it("a referral the reducer actually builds carries only keys drawn from the allowed set (runtime companion to the type-checked guard above)", () => {
    const state = seedWardFlowState();
    const after = wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      homeRegion: "Perth Metropolitan",
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
    });
    expect(after.rejections).toEqual([]);
    const created = after.referrals.at(-1)!;
    for (const key of Object.keys(created)) {
      expect(ALLOWED_REFERRAL_FIELDS).toContain(key);
    }
  });

  /**
   * Phase 8 Task 2 — the SAME runtime half, extended to the write path that task added. Task 2R
   * removed the other one: `REFERRAL_ARRIVED` no longer exists, so the arrival half of this test
   * went with it rather than being kept as a test of nothing.
   *
   * The type-checked guard above cannot fail under `vitest run` (`Required<Referral>` is checked
   * by `tsc`, and vitest does not typecheck), so widening the allowlist without this would have
   * recorded the new field as deliberate while proving nothing at runtime about what the reducer
   * actually writes. This event is exactly where an extra key would appear: a local-bed record
   * that grew a note or an outcome would fail here by key name under plain vitest.
   */
  it("a referral the reducer records a local bed search against carries only keys drawn from the allowed set", () => {
    const seeded = seedWardFlowState();

    const queued = seeded.referrals.filter(
      (referral) => referral.state === "queued" && referral.localBedSought === undefined,
    );
    expect(queued.length, "the seed holds no queued referral without a local-bed record").toBeGreaterThan(0);
    const sought = wardFlowReducer(seeded, {
      type: "RECORD_LOCAL_BED_SOUGHT",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: queued[0].id,
    });
    expect(sought.rejections).toEqual([]);
    const afterSearch = sought.referrals.find((referral) => referral.id === queued[0].id)!;
    // A role and a time, and nothing else — no note, no reason, no outcome.
    expect(Object.keys(afterSearch.localBedSought!).sort()).toEqual(["at", "by"]);
    for (const key of Object.keys(afterSearch)) {
      expect(ALLOWED_REFERRAL_FIELDS).toContain(key);
    }
  });
});

/**
 * Task 5 (Phase 7, "The front door"): pure-function coverage for the board/match-view
 * derivations in `ward-referrals.ts`. `referral-board.tsx`/`referral-match.tsx` themselves are
 * covered by the DOM suite (`tests/ward-referral-screens.dom.test.tsx`); this file covers the
 * logic those components render, independent of React.
 */
describe("Task 5 — referral board ordering (referralQueueOrder, recentlyDecidedReferrals)", () => {
  it("orders the real fixture's two queued referrals by urgency, then by longest wait — RF-001 (raised 40 min ago) before RF-005 (raised 20 min ago), both tier 2", () => {
    const queuedIds = referralQueueOrder(referrals).map((referral) => referral.id);
    expect(queuedIds).toEqual(["RF-001", "RF-005"]);
  });

  it("never includes an accepted or declined referral in the queued order", () => {
    const queued = referralQueueOrder(referrals);
    // M4 (fix round C): `.every()` on an EMPTY array is `true`, so `filter(() => false)` — which
    // drops every referral including the queued ones — passed this test untouched. The sibling
    // test above catches that by pinning `["RF-001","RF-005"]`, but this guard proved nothing on
    // its own. A non-empty result is what makes the `every` mean anything.
    expect(queued.length).toBeGreaterThan(0);
    expect(queued.every((referral) => referral.state === "queued")).toBe(true);
  });

  /**
   * Urgency must win over wait time even when wait time alone would suggest the opposite order —
   * otherwise a test built only from fixture data that happens to already agree on both keys
   * could pass with either key driving the sort alone. A synthetic pair proves urgency is the
   * primary key: the tier-1 referral raised MOST RECENTLY still sorts before the tier-3 referral
   * raised LONGEST ago.
   */
  it("ranks a more urgent, more recently raised referral ahead of a less urgent, longer-waiting one", () => {
    const urgentRecent: Referral = { ...referrals[0], id: "RF-SYNTH-URGENT", urgency: 1, raisedAt: NOW_ANCHOR - 5 };
    const calmOld: Referral = { ...referrals[0], id: "RF-SYNTH-CALM", urgency: 3, raisedAt: NOW_ANCHOR - 500 };
    const ordered = referralQueueOrder([calmOld, urgentRecent]).map((referral) => referral.id);
    expect(ordered).toEqual(["RF-SYNTH-URGENT", "RF-SYNTH-CALM"]);
  });

  it("orders the real fixture's decided referrals most-recently-decided first", () => {
    const decided = recentlyDecidedReferrals(referrals);
    expect(decided.length).toBeGreaterThan(0);
    expect(decided.every((referral) => referral.state !== "queued")).toBe(true);
    const decidedAts = decided.map((referral) => referral.decidedAt);
    const sorted = [...decidedAts].sort((a, b) => (b ?? -Infinity) - (a ?? -Infinity));
    expect(decidedAts).toEqual(sorted);
  });
});

describe("Task 5 — referral wait label (referralWaitLabel)", () => {
  it("renders a plain elapsed-wait duration, never a countdown/overdue phrasing", () => {
    const referral: Referral = { ...referrals[0], raisedAt: NOW_ANCHOR - 65 };
    expect(referralWaitLabel(referral, NOW_ANCHOR)).toBe("1h 05m waiting");
  });
});

describe("Task 5 — match view failure branches (referralCandidates, matchReason, networkHasCohort, hasConfirmedCapacity)", () => {
  const units = allUnits();

  /**
   * RF-001 in the real fixture: Youth, Female, secureBedNeeded true. The network's one Youth
   * unit (EMyU, `bty-youth`) is Open, not Secure — so RF-001 fails the age gate everywhere except
   * EMyU, and fails the security gate at EMyU itself. Zero units accept it, on the real,
   * unmodified fixture — a genuine "no bed accepts" case, not a fabricated one.
   */
  it("RF-001: no bed accepts, and the full network is still listed — never a truncated or empty candidate list", () => {
    const referral = referrals.find((candidate) => candidate.id === "RF-001")!;
    const candidates = referralCandidates(referral, units, NOW_ANCHOR);
    expect(candidates).toHaveLength(units.length);
    const accepting = candidates.filter((candidate) => candidate.verdict.eligible);
    expect(accepting).toHaveLength(0);
    // Every declining unit still carries its own real reason — never a blank.
    for (const candidate of candidates) {
      expect(matchReason(candidate).length).toBeGreaterThan(0);
    }
  });

  it("RF-001's age band (Youth) genuinely exists in the network — the real fixture's own zero-match case is operational (security), not structural", () => {
    const referral = referrals.find((candidate) => candidate.id === "RF-001")!;
    expect(networkHasCohort(referral, units)).toBe(true);
  });

  it("a synthetic age band with no unit anywhere in the network is reported as a structural gap, distinct from the operational 'no bed accepts' case", () => {
    const referral: Referral = { ...referrals[0], ageBand: "Youth" };
    const unitsWithNoYouthBed = units.filter((unit) => unit.cohort !== "Youth");
    expect(networkHasCohort(referral, unitsWithNoYouthBed)).toBe(false);
    // Non-vacuity: the same referral against the REAL, unmodified network does have a Youth unit.
    expect(networkHasCohort(referral, units)).toBe(true);
  });

  it("a forensic bed is excluded from every accepting list, for every real referral in the fixture", () => {
    // Every referral's cohort, sex, security and legal-status requirements differ — a forensic
    // unit whose OWN cohort does not match a given referral fails the `age` gate first, never
    // reaching the `forensic` gate at all (gates are evaluated in a fixed order, and only the
    // FIRST failing one is ever shown as "the" reason). This test asserts the one thing that is
    // true regardless of gate order: a forensic unit is NEVER eligible and NEVER in the accepting
    // list, for any referral. The next test below proves the forensic gate's own wording
    // specifically, for the one referral shape where it is genuinely the first gate to fail.
    for (const referral of referrals) {
      const candidates = referralCandidates(referral, units, NOW_ANCHOR);
      const forensicCandidates = candidates.filter((candidate) => candidate.unit.forensic);
      expect(forensicCandidates.length).toBeGreaterThan(0);
      for (const candidate of forensicCandidates) {
        expect(candidate.verdict.eligible).toBe(false);
      }
      const acceptingIds = candidates.filter((candidate) => candidate.verdict.eligible).map((c) => c.unit.id);
      const forensicIds = forensicCandidates.map((candidate) => candidate.unit.id);
      expect(acceptingIds.some((id) => forensicIds.includes(id))).toBe(false);
    }
  });

  it("a forensic bed's stated reason names the forensic exclusion when every earlier gate would otherwise pass", () => {
    const forensicUnit = units.find((unit) => unit.forensic)!;
    // Matches the forensic unit's own cohort/security/authorisation exactly, and needs neither a
    // secure nor an involuntary bed — every gate ahead of `forensic` in evaluation order (age,
    // legal_status, sex_designation) passes, so `forensic` is genuinely the first gate to fail,
    // and the reason text this referral sees is the forensic gate's own wording, not a stand-in.
    const referral: Referral = {
      ...referrals[0],
      ageBand: forensicUnit.cohort,
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
    };
    const [candidate] = referralCandidates(referral, [forensicUnit], NOW_ANCHOR);
    expect(candidate.verdict.eligible).toBe(false);
    expect(matchReason(candidate)).toMatch(/forensic/i);
  });

  it("a unit that has never confirmed its allocatable capacity reads 'Never confirmed', never zero or a fabricated number, and is not offered", () => {
    const base = unitById("scgh-adult-open")!;
    // `confirmedAt` deleted entirely (absent), same convention `tests/ward-morning-rollup.test.ts`
    // uses for "never confirmed" — never a sentinel like `0` or a fabricated timestamp. `empty`
    // stays a real, fresh figure so `capacity_freshness` is the ONLY gate this unit fails —
    // proving the override is actually reached, rather than masked by an earlier gate.
    const neverConfirmedUnit: Unit = {
      ...base,
      id: "synth-never-confirmed",
      allocatable: { value: 2, source: "ward", staleAfterMinutes: 90 } as Unit["allocatable"],
    };
    delete (neverConfirmedUnit.allocatable as Partial<Unit["allocatable"]>).confirmedAt;
    expect(hasConfirmedCapacity(neverConfirmedUnit)).toBe(false);

    const referral: Referral = {
      ...referrals[0],
      ageBand: "Adult",
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
    };
    const [candidate] = referralCandidates(referral, [neverConfirmedUnit], NOW_ANCHOR);
    expect(candidate.verdict.eligible).toBe(false);
    const reason = matchReason(candidate);
    expect(reason).toMatch(/never confirmed/i);
    expect(reason).not.toContain("NaN");
    expect(reason).not.toContain(" 0 ");
  });

  it("matchReason reports 'Eligible now' for a genuinely eligible pairing", () => {
    const unit = unitById("scgh-adult-open")!;
    const referral: Referral = {
      ...referrals[0],
      ageBand: "Adult",
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
    };
    const [candidate] = referralCandidates(referral, [unit], NOW_ANCHOR);
    expect(candidate.verdict.eligible).toBe(true);
    expect(matchReason(candidate)).toBe("Eligible now");
  });
});
