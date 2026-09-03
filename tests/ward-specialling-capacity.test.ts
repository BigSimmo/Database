import { describe, expect, it } from "vitest";

import { remainingSpeciallingCapacity, type Admission } from "../src/components/ward-management/ward-admissions";
import { capacityBreakdown } from "../src/components/ward-management/ward-bed-availability";
import { OVERRIDE_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * A WARD THAT CAN WATCH ONE PERSON ONE-TO-ONE ACCEPTED AN UNLIMITED NUMBER.
 *
 * `eligibility()` gated on `!movement.specialling || unit.speciallingCapacity > 0`. That figure is
 * authored per unit in `ward-sites.ts` and no reducer path has ever changed it, so the only
 * question anything could ask was whether a ward had ANY one-to-one capacity — never whether it had
 * any LEFT. And `Admission` held no field of that shape at all, so there was nothing to count even
 * if something had tried: a count built first would have been a number with nothing to count.
 *
 * Owner ruling 2026-09-01, ruling 1 of fourteen: one-to-one nursing is recorded as THE WARD'S
 * STAFFING OF THE BED, not as a fact about the patient. `Admission.specialling` is that record.
 *
 * **Every test here drives the REDUCER, not a screen.** A test asserting that a ward's page shows a
 * specialling gate passes against a build in which the refusal was never written — the gate in
 * `ward-eligibility.ts` renders a verdict, and rendering a verdict does not stop a transition. The
 * property that matters is that `PULL_PATIENT` cannot produce the state.
 */

const NOW = NOW_ANCHOR;

/**
 * A real seeded unit, so nothing here tests a fixture invented for the test. `rgh-adult-secure` is
 * authored with `speciallingCapacity: 1`, which is the interesting number: a ward that can staff
 * exactly one, where the defect handed out as many as asked for.
 */
const UNIT_ID = "rgh-adult-secure";

/**
 * `Movement.id` is a template-literal type requiring the `WF-` prefix, so these ids carry it. Not
 * cosmetic: vitest runs no `tsc`, so the first draft of this file went green on all eleven tests
 * with ids the type forbids, and only `tsc -p tsconfig.typecheck.json` said so.
 */
const SPECIALLED_A = "WF-SP-A";
const SPECIALLED_B = "WF-SP-B";
const ORDINARY = "WF-ORD";
const COHORT_MISMATCH = "WF-COHORT-MISMATCH";

function unitIn(state: WardFlowState): Unit {
  const found = state.units.find((candidate) => candidate.id === UNIT_ID);
  if (!found) throw new Error(`state is missing unit ${UNIT_ID}`);
  return found;
}

function movementIn(state: WardFlowState, id: string): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function headroom(state: WardFlowState): number {
  return remainingSpeciallingCapacity(unitIn(state), state.admissions);
}

function occupantsOf(state: WardFlowState): Admission[] {
  return state.admissions.filter((admission) => admission.unitId === UNIT_ID);
}

/**
 * `UNIT_ID` widened to six free/allocatable beds on twenty, confirmed at `NOW` — shared by
 * `bench()` and the cohort-mismatch fixture below so both start from the identical "no bed check
 * in this file can ever be the reason a pull is refused" ground. Two hand-copied versions of this
 * override is exactly the kind of drift that let `bench()`'s old movement selection go unnoticed
 * for as long as it did (see `bench()`'s own comment below).
 */
function widenedUnit(base: Unit): Unit {
  return {
    ...base,
    beds: 20,
    empty: { ...base.empty, value: 6, confirmedAt: NOW },
    allocatable: { ...base.allocatable, value: 6, confirmedAt: NOW },
  };
}

/**
 * Rewrites a seeded movement into one accepted and awaiting a bed at `UNIT_ID`, clearing every
 * field a real walk through `ACCEPT_IN_PRINCIPLE` would have cleared. Shared by `bench()` and the
 * cohort-mismatch fixture below rather than each holding its own copy of the field list — two
 * copies is how one of them drifts and quietly leaves a stale `declines` entry or a stray
 * `admissionId` behind, which would then refuse a pull for the wrong reason.
 */
function stagedForPull(source: Movement, id: Movement["id"], specialling: boolean): Movement {
  return {
    ...source,
    id,
    specialling,
    stage: "accepted_awaiting_bed",
    acceptedUnitId: UNIT_ID,
    referredUnitIds: [],
    declines: [],
    closure: undefined,
    transport: undefined,
    pullExpiresAt: undefined,
    admissionId: undefined,
  };
}

/**
 * Three movements accepted at one ward, two of them needing one-to-one observation.
 *
 * They are built by REWRITING seeded movements rather than by walking the pipeline to
 * `accepted_awaiting_bed`: that walk passes through `ACCEPT_IN_PRINCIPLE`, whose own eligibility
 * checks would decide which of these three cases is even reachable, and this file is testing the
 * pull rather than the acceptance. The unit keeps six allocatable beds so that "no bed" can never
 * be the reason anything below is refused, and its own seeded occupants and bed releases are
 * cleared so the arithmetic starts from a known zero rather than from whatever the night's fixture
 * happens to hold.
 */
function bench(): WardFlowState {
  const seeded = seedWardFlowState();
  const base = seeded.units.find((candidate) => candidate.id === UNIT_ID);
  if (!base) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);
  if (base.speciallingCapacity !== 1) {
    throw new Error(`${UNIT_ID} is authored with ${base.speciallingCapacity} specialling capacity, not 1`);
  }

  const unit = widenedUnit(base);

  // ⚠️ CHOSEN BY CLINICAL FIT, NOT BY POSITION — AND THE POSITION IS WHAT WAS WRONG.
  //
  // This was `seeded.movements.slice(0, 3)`, which took whatever the first three happened to be
  // and copied their `cohort` through `stagedForPull` below. The second of them, `WF-002`, is an
  // OLDER ADULT, and `rgh-adult-secure` is an adult secure ward — so this file staged an
  // older-adult patient into an adult ward and asserted eleven things about the result. Nothing
  // failed, because at the time `PULL_PATIENT` checked beds, bed readiness and specialling, and
  // nothing else. The fixture was relying on the engine not looking. Found by Ward Builder Three,
  // and closed by Ward Builder Two, which landed the cohort gate itself — `eligibilityRefusal` at
  // `ward-flow-reducer.ts:1278`, proven by the "specialling capacity — the cohort gate" describe
  // block below.
  //
  // ⚠️ THE DEFECT IS THE SELECTION, NOT THE ONE MOVEMENT. Fixing `WF-002` alone would leave the
  // fixture's clinical coherence resting on the seed's array order, so re-ordering the seed —
  // which is nobody's idea of a dangerous edit — would quietly reintroduce it somewhere else.
  // Selecting by fit means the mismatch cannot come back, and the guard below makes a seed that
  // can no longer supply three suitable patients a loud failure rather than a silent skip.
  //
  // Security is matched too, though only cohort was wrong: a secure ward can lawfully hold an
  // open-status patient, so this is coherence rather than necessity, and it costs nothing —
  // the seed holds several adult/secure movements.
  const sources = seeded.movements.filter(
    (candidate) => candidate.cohort === unit.cohort && candidate.security === unit.security,
  );
  if (sources.length < 3) {
    throw new Error(
      `the seed no longer holds three ${unit.security} ${unit.cohort} movements to rewrite ` +
        `(found ${sources.length}) — this file must not fall back to a clinically wrong placement`,
    );
  }

  return {
    ...seeded,
    units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
    movements: [
      stagedForPull(sources[0], SPECIALLED_A, true),
      stagedForPull(sources[1], SPECIALLED_B, true),
      stagedForPull(sources[2], ORDINARY, false),
    ],
    admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
    bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
    rejections: [],
  };
}

/**
 * The one fixture in this file that DELIBERATELY stages a clinical mismatch — every other bench
 * here exists to prove the mismatch cannot happen by accident. Same widened unit as `bench()`, one
 * movement instead of three, selected for the opposite property: cohort must NOT match, and
 * nothing else about it may be wrong, or a refusal below could be the bed/specialling guard firing
 * rather than the cohort gate (see the ⚠️ on `ward-flow-reducer.ts:1274-1277`).
 */
function cohortMismatchBench(): WardFlowState {
  const seeded = seedWardFlowState();
  const base = seeded.units.find((candidate) => candidate.id === UNIT_ID);
  if (!base) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);

  const unit = widenedUnit(base);

  // Cohort must differ (the gate under test) and security must still be compatible (a fact
  // unrelated to cohort — mismatching it too would leave two failing gates instead of one, and
  // Test 1 below exists precisely to catch that).
  const mismatched = seeded.movements.find(
    (candidate) => candidate.cohort !== unit.cohort && (candidate.security === "Open" || unit.security === "Secure"),
  );
  if (!mismatched) {
    throw new Error(
      `the seed no longer holds a movement whose cohort differs from ${UNIT_ID}'s (${unit.cohort}) while ` +
        `remaining security-compatible — this file must not fall back to inventing one`,
    );
  }

  return {
    ...seeded,
    units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
    movements: [stagedForPull(mismatched, COHORT_MISMATCH, false)],
    admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
    bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
    rejections: [],
  };
}

function pull(
  state: WardFlowState,
  movementId: string,
  overrideReason?: (typeof OVERRIDE_REASONS)[number],
): WardFlowState {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW,
    movementId,
    unitId: UNIT_ID,
    overrideReason,
  });
}

/**
 * ⚠️ THE FIXTURE'S OWN PREMISE, ASSERTED RATHER THAN ASSUMED — AND IT IS HERE BECAUSE THE
 * PREMISE WAS WRONG FOR THE WHOLE LIFE OF THIS FILE AND NOTHING SAID SO.
 *
 * `bench()` used to take the first three seeded movements by position, so `WF-002` — an OLDER
 * ADULT — was staged into `rgh-adult-secure`, an adult ward, and eleven tests asserted on the
 * result. Nothing failed: at the time, `PULL_PATIENT` checked beds, bed readiness and specialling
 * capacity, and nothing else. **The fixture was relying on the engine not looking.** It now does:
 * the cohort gate landed at `ward-flow-reducer.ts:1278` (`eligibilityRefusal`), proven directly by
 * the "specialling capacity — the cohort gate" describe block below.
 *
 * Selecting by clinical fit fixes it, but a construction detail is not a checked property — a
 * later edit could reintroduce the position-based selection and every specialling assertion would
 * go on passing exactly as it did before. This test is what makes the premise falsifiable.
 */
describe("the bench is a clinically coherent placement, not just a convenient one", () => {
  it("stages nobody into a ward that is wrong for them", () => {
    const state = bench();
    const unit = unitIn(state);
    const staged = [SPECIALLED_A, SPECIALLED_B, ORDINARY].map((id) => movementIn(state, id));
    expect(staged.length, "the bench no longer stages three movements, so this asserts nothing").toBe(3);

    for (const movement of staged) {
      expect(
        movement.cohort,
        `${movement.id} has cohort "${movement.cohort}" but ${unit.name} is a "${unit.cohort}" ward ` +
          `— a placement no clinician would make, and the eleven tests below this one are not what ` +
          `would catch it: they exercise specialling capacity, not cohort`,
      ).toBe(unit.cohort);
    }
  });
});

/**
 * `fcb8af1daa` added the cohort gate to `PULL_PATIENT` (the `eligibilityRefusal` call at
 * `ward-flow-reducer.ts:1278`) after eleven tests above spent their whole life staging an older
 * adult into an adult secure ward and asserting on the result, unaware anything was wrong. The
 * fixture was fixed to select by clinical fit instead — see `bench()`'s own comment — which closed
 * the hole but stopped demonstrating it: nothing in this file any longer stages a mismatch, so
 * nothing proves the gate that was added still exists. This block is that proof, on a fixture
 * built specifically to reintroduce the one mismatch `bench()` now refuses to.
 */
describe("specialling capacity — the cohort gate", () => {
  /**
   * ⚠️ THE MOST IMPORTANT TEST IN THIS BLOCK, AND IT EXISTS BECAUSE OF A NAMED TRAP.
   *
   * `ward-flow-reducer.ts:1274-1277` warns that a movement can fail a bed check AND an eligibility
   * gate at the same time, and that reading a refusal as proof of the eligibility gate "nearly
   * closed this finding falsely." If `cohortMismatchBench()` also failed, say, `allocatable_bed`,
   * Test 2 below could be watching THAT guard fire and never reach the cohort gate at all — and
   * would still go green. This test rules that out directly, against `eligibility()` itself,
   * before any pull runs: `cohort` must fail, and every other gate this movement is assessed
   * against must pass.
   *
   * If this test fails, Test 2 and Test 3 below prove nothing — the failure message says so.
   */
  it("the staged movement fails cohort alone; every other gate passes", () => {
    const state = cohortMismatchBench();
    const unit = unitIn(state);
    const movement = movementIn(state, COHORT_MISMATCH);

    const verdict = eligibility(movement, unit, NOW);
    const cohortGate = verdict.gates.find((gate) => gate.gate === "cohort");
    if (!cohortGate) throw new Error("eligibility() emitted no cohort gate at all — this fixture proves nothing");
    expect(cohortGate.pass, "the fixture's whole premise is a failing cohort gate").toBe(false);

    for (const gate of verdict.gates) {
      if (gate.gate === "cohort") continue;
      expect(
        gate.pass,
        `gate "${gate.gate}" unexpectedly failed (${gate.detail}) — cohort is meant to be the ONLY failing ` +
          `gate, or Test 2 below cannot tell this gate's refusal apart from that one`,
      ).toBe(true);
    }
  });

  it("refuses the pull and names the cohort gate, not a bed or specialling reason", () => {
    const state = pull(cohortMismatchBench(), COHORT_MISMATCH);

    expect(state.rejections).toHaveLength(1);
    const reason = state.rejections[0].reason;
    expect(reason, "the refusal must name the gate that actually failed").toMatch(/cohort/);
    expect(reason, "the refusal must say the placement is not eligible, not merely decline it").toMatch(/not eligible/);

    // Refused means refused: no stage change, and nobody occupying a bed at this ward.
    const movement = movementIn(state, COHORT_MISMATCH);
    expect(movement.stage).toBe("accepted_awaiting_bed");
    expect(movement.admissionId).toBeUndefined();
    expect(occupantsOf(state)).toEqual([]);
  });

  /**
   * Ward Flow's owner ruling: no clinical judgement is ever an absolute block, only an
   * accountable one — an ineligible placement becomes a recorded override, not an impossible
   * transition (see `ACCEPT_IN_PRINCIPLE`'s own doc comment on the same ruling). `cohort` is a
   * judgement gate, listed in `SUITABILITY_GATES`, so a coordinator who genuinely means it can
   * always get the patient a bed here. This test is what stops somebody "fixing" the refusal
   * above into a wall nothing can get past.
   */
  it("lets a coordinator through with a recorded override reason", () => {
    const reason = OVERRIDE_REASONS.find(
      (candidate) => candidate === "The receiving team has agreed despite the mismatch",
    );
    if (!reason) {
      throw new Error("OVERRIDE_REASONS no longer offers a reason fitting an accepted clinical-mismatch placement");
    }

    const state = pull(cohortMismatchBench(), COHORT_MISMATCH, reason);

    expect(state.rejections, "a recorded override reason must get the placement through").toEqual([]);
    expect(movementIn(state, COHORT_MISMATCH).stage).toBe("pulled");
    expect(occupantsOf(state)).toHaveLength(1);
  });
});

describe("specialling capacity — the pull", () => {
  it("starts with the ward's whole authored figure available and nobody consuming it", () => {
    const state = bench();
    expect(occupantsOf(state), "the bench must start with no occupant at this unit").toEqual([]);
    expect(headroom(state)).toBe(1);
  });

  it("lets the first one-to-one patient in, and the ward then has nobody left to watch a second", () => {
    const state = pull(bench(), SPECIALLED_A);

    expect(state.rejections, "the first pull must succeed, or every test below proves nothing").toEqual([]);
    expect(movementIn(state, SPECIALLED_A).stage).toBe("pulled");

    // PULL_PATIENT wrote the flag. Without this the derivation counts nothing and the refusal below
    // can never fire — a green suite over a field nothing writes.
    expect(occupantsOf(state)).toHaveLength(1);
    expect(occupantsOf(state)[0].specialling, "the pull must record the ward's one-to-one commitment").toBe(true);

    expect(headroom(state), "one staffable slot, one taken").toBe(0);
  });

  it("refuses the second one-to-one pull, and names specialling rather than 'no bed'", () => {
    const state = pull(pull(bench(), SPECIALLED_A), SPECIALLED_B);

    expect(state.rejections).toHaveLength(1);
    const reason = state.rejections[0].reason;

    expect(reason, "the refusal must name the constraint that actually applies").toMatch(/specialling/i);
    // The two guards immediately above this one in `PULL_PATIENT`. A refusal reporting either would
    // send a coordinator hunting for a bed this ward has six of — which is exactly how the
    // pending-preparation guard was caught hijacking a different guard's case.
    expect(reason, "the ward has six allocatable beds, so 'no bed' would be untrue").not.toMatch(/allocatable bed/i);
    expect(reason, "nothing here is being cleaned").not.toMatch(/made ready/i);

    // Refused means refused: no stage change, and no second person in a bed.
    expect(movementIn(state, SPECIALLED_B).stage).toBe("accepted_awaiting_bed");
    expect(movementIn(state, SPECIALLED_B).admissionId).toBeUndefined();
    expect(occupantsOf(state)).toHaveLength(1);
  });

  it("still lets an ordinary patient into the same ward, so the refusal did not hijack another guard", () => {
    const state = pull(pull(bench(), SPECIALLED_A), ORDINARY);

    expect(state.rejections, "a patient needing no one-to-one observation is unaffected").toEqual([]);
    expect(movementIn(state, ORDINARY).stage).toBe("pulled");
    expect(occupantsOf(state)).toHaveLength(2);
    expect(occupantsOf(state).filter((admission) => admission.specialling)).toHaveLength(1);

    // And the ward is still full for one-to-one: an ordinary occupant consumes no nurse.
    expect(headroom(state)).toBe(0);
  });
});

describe("specialling capacity — the clamps", () => {
  /**
   * A ward whose authored figure is nonsense gets NO ANSWER rather than a guess, and a ward already
   * carrying more one-to-one patients than it said it could staff reports nought remaining rather
   * than a negative promise. Both are the conservative direction `headlineAvailable` and
   * `acceptingBedCounts` already take, and neither is reachable from the seed — which is exactly
   * why they are asserted here rather than left to the doc comment.
   *
   * ⚠️ **A THIRD TEST WAS WRITTEN HERE AND DELETED, and the reason is worth more than the test was.**
   * It asserted that a NEGATIVE authored figure reads as zero. No single mutation can kill it: the
   * inner `Math.max(0, Math.floor(authored))` and the outer floor on the result both clamp that
   * case, so removing either one leaves the assertion green. It would have looked like coverage and
   * been decoration. The negative case is real and the doc comment still states it — it is simply
   * asserted by the floor test below, which a mutation does kill.
   */
  it("reads a non-finite authored figure as no capacity at all", () => {
    const state = bench();
    const broken: Unit = { ...unitIn(state), speciallingCapacity: Number.NaN };
    expect(remainingSpeciallingCapacity(broken, state.admissions)).toBe(0);

    const infinite: Unit = { ...unitIn(state), speciallingCapacity: Number.POSITIVE_INFINITY };
    expect(remainingSpeciallingCapacity(infinite, state.admissions)).toBe(0);
  });

  it("floors an over-subscribed ward at nought rather than promising a negative slot", () => {
    const state = pull(pull(bench(), SPECIALLED_A), ORDINARY);
    // Force the ordinary occupant into a one-to-one bed too, which the reducer would have refused.
    // The DERIVATION must still answer sensibly about a state it did not create — a seeded fixture
    // or a hand-edited scenario can reach this shape without any event ever running.
    const overSubscribed: WardFlowState = {
      ...state,
      admissions: state.admissions.map((admission) =>
        admission.unitId === UNIT_ID ? { ...admission, specialling: true } : admission,
      ),
    };
    expect(occupantsOf(overSubscribed).filter((admission) => admission.specialling)).toHaveLength(2);
    expect(headroom(overSubscribed)).toBe(0);
  });
});

describe("specialling capacity — giving the slot back", () => {
  /**
   * ⚠️ **ASSERTED, NOT ASSUMED.** Both restores look free — the derivation reads `bedIsOccupied`, a
   * released pull deletes the admission and a departure moves it to `departed`, so neither handler
   * needs a line of its own. "Free" is a reason to check, not a reason to skip: the defect this file
   * closes was a figure nothing maintained, and a restore nobody asserted is the same shape of trust.
   */
  it("gives the slot back when the pull is released, and the ward can then take somebody else", () => {
    const pulled = pull(bench(), SPECIALLED_A);
    expect(headroom(pulled)).toBe(0);

    const released = wardFlowReducer(pulled, {
      type: "RELEASE_PULL",
      role: "ward",
      now: NOW,
      movementId: SPECIALLED_A,
      // `ReleasePullReason` — NOT `PULL_RELEASE_REASONS` in `ward-admissions.ts`, which is a
      // different list about the same subject in human-readable wording. The event takes this one,
      // and only `tsc` can tell them apart: both are strings at runtime.
      reason: "pull_made_in_error",
      actingUnitId: UNIT_ID,
    });

    expect(released.rejections).toEqual([]);
    expect(headroom(released), "a released pull was never an occupant, so the slot is free again").toBe(1);

    // The restored slot is really usable. A figure that reads right while the reducer refuses anyway
    // is a number nobody can act on.
    const nextPatient = pull(released, SPECIALLED_B);
    expect(nextPatient.rejections).toEqual([]);
    expect(headroom(nextPatient)).toBe(0);
  });

  it("gives the slot back when the person leaves the ward", () => {
    const start = bench();
    const occupant: Admission = {
      id: "AD-1TO1",
      unitId: UNIT_ID,
      specialling: true,
      referralId: null,
      sex: "Female",
      homeRegion: null,
      tentativeDiagnosis: null,
      state: "occupied",
      pulledAt: NOW - 600,
      arrivedAt: NOW - 480,
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
      followUp: null,
    };
    const staffed: WardFlowState = { ...start, admissions: [...start.admissions, occupant] };
    expect(headroom(staffed), "somebody physically in the bed consumes the slot too").toBe(0);

    const left = wardFlowReducer(staffed, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: "AD-1TO1",
      actingUnitId: UNIT_ID,
      leavingDestination: "discharged-to-the-community",
    });

    expect(left.rejections).toEqual([]);
    expect(headroom(left), "a departed admission occupies no bed and consumes no nurse").toBe(1);
  });
});

describe("specialling capacity — no bed figure moves", () => {
  /**
   * The authored figure keeps its meaning: `Unit.speciallingCapacity` is headroom BEYOND the ward's
   * current load, and the seed authors no specialled occupant anywhere. So the derived figure equals
   * the authored one on every ward tonight, and every screen printing the authored number prints the
   * same number after this change as before it.
   */
  it("derives exactly the authored figure for every ward in the seed, so no screen number moves", () => {
    const seeded = seedWardFlowState();

    expect(
      seeded.admissions.filter((admission) => admission.specialling),
      "the seed authors no specialled occupant; if it starts to, this file's premise changes",
    ).toEqual([]);

    for (const unit of seeded.units) {
      expect(
        remainingSpeciallingCapacity(unit, seeded.admissions),
        `${unit.id} would print a different number than it printed before this change`,
      ).toBe(Math.max(0, unit.speciallingCapacity));
    }

    // Non-vacuity: the loop really runs over wards that have a figure to disagree about.
    expect(seeded.units.filter((unit) => unit.speciallingCapacity > 0).length).toBeGreaterThan(5);
  });

  /**
   * ⚠️ **BOTH READERS, NOT ONE.** `unitCapacity` (the five-state bed grid) and `capacityBreakdown`
   * (the coordinator's own figures) each compute availability from the same unit independently. A
   * change that freed a bed through one and not the other leaves one screen right and one wrong,
   * which is the failure this prototype produces most reliably.
   */
  it("refusing a specialling pull moves neither capacity reader", () => {
    const before = pull(bench(), SPECIALLED_A);
    const capacityBefore = unitCapacity(unitIn(before), before.bedReleases);
    const breakdownBefore = capacityBreakdown(unitIn(before), before.bedReleases, before.leaveBeds, NOW);

    const after = pull(before, SPECIALLED_B);
    expect(after.rejections, "this test is about a REFUSED pull").toHaveLength(1);

    expect(unitCapacity(unitIn(after), after.bedReleases)).toEqual(capacityBefore);
    expect(capacityBreakdown(unitIn(after), after.bedReleases, after.leaveBeds, NOW)).toEqual(breakdownBefore);
  });

  it("costs a specialling pull exactly the beds an ordinary pull costs, through both readers", () => {
    const specialled = pull(bench(), SPECIALLED_A);
    const ordinary = pull(bench(), ORDINARY);
    expect(specialled.rejections).toEqual([]);
    expect(ordinary.rejections).toEqual([]);

    expect(unitCapacity(unitIn(specialled), specialled.bedReleases)).toEqual(
      unitCapacity(unitIn(ordinary), ordinary.bedReleases),
    );
    expect(capacityBreakdown(unitIn(specialled), specialled.bedReleases, specialled.leaveBeds, NOW)).toEqual(
      capacityBreakdown(unitIn(ordinary), ordinary.bedReleases, ordinary.leaveBeds, NOW),
    );
  });
});
