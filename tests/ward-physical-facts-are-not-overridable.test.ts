import { describe, expect, it } from "vitest";

import { OVERRIDE_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * ⚠️ **NO REASON TYPED INTO A FORM CREATES A BED.**
 *
 * `PULL_PATIENT` (`ward-flow-reducer.ts`) enforces two facts about the physical world —
 * `unit.allocatable.value <= 0` and `remainingSpeciallingCapacity(unit, admissions) <= 0` —
 * UNCONDITIONALLY, before it ever asks `eligibilityRefusal` for a verdict. `eligibilityRefusal`
 * returns early, allowing the placement, the instant the event carries a member of
 * `OVERRIDE_REASONS`. The doc comment on `eligibilityRefusal` is explicit that this is safe only
 * because the two physical checks run FIRST and are not reason-aware — "the moment a physical gate
 * … is added to [the overridable list], this early return silently lets a typed reason buy past
 * it, and nothing here will go red."
 *
 * Nothing before this file drove that claim through the reducer. The realistic breaking edit is a
 * tidy-up that folds the bed and specialling checks into the eligibility verdict eligibility()
 * already computes both of — which looks like a simplification and would silently let a recorded
 * reason conjure a bed.
 *
 * Each test below pairs a REFUSAL (a valid override reason against a unit with no physical room)
 * with a POSITIVE CONTROL (the identical dispatch, identical reason, against a unit that does have
 * room). Without the control, a `PULL_PATIENT` broken to refuse everything would make the refusal
 * assertion pass for the wrong reason — the property under test is that the physical fact refuses
 * even when clinical judgement is bypassed, not merely that a refusal exists somewhere.
 */

const NOW = NOW_ANCHOR;

// A real seeded unit, not a fixture invented for this file — `rgh-adult-secure` is authored with
// `speciallingCapacity: 1`, which is exactly the figure the specialling test below needs.
const UNIT_ID = "rgh-adult-secure";

const MOVEMENT_NO_BED = "WF-PF-NOBED";
const MOVEMENT_HAS_BED = "WF-PF-HASBED";
const MOVEMENT_SPECIALLED_FIRST = "WF-PF-SP1";
const MOVEMENT_SPECIALLED_BLOCKED = "WF-PF-SP2";
const MOVEMENT_SPECIALLED_CONTROL = "WF-PF-SP3";
const MOVEMENT_STALE = "WF-PF-STALE";
const MOVEMENT_STALE_NO_REASON = "WF-PF-STALE-NR";

// Membership-checked by `eligibilityRefusal` itself, so any entry works; pin one so the test does
// not silently start passing a value that has fallen out of the list.
const VALID_REASON = OVERRIDE_REASONS[0];

function unitIn(state: WardFlowState): Unit {
  const found = state.units.find((candidate) => candidate.id === UNIT_ID);
  if (!found) throw new Error(`state is missing unit ${UNIT_ID}`);
  return found;
}

function movementIn(state: WardFlowState, id: Movement["id"]): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

/**
 * Rewrites a seeded movement into `accepted_awaiting_bed` at `UNIT_ID`, the same idiom
 * `tests/ward-specialling-capacity.test.ts` uses: rewriting rather than walking the pipeline
 * through `ACCEPT_IN_PRINCIPLE` keeps this file testing the pull, not the acceptance.
 */
function staged(source: Movement, id: Movement["id"], specialling: boolean): Movement {
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

function pull(state: WardFlowState, movementId: Movement["id"], overrideReason?: (typeof OVERRIDE_REASONS)[number]) {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW,
    movementId,
    unitId: UNIT_ID,
    overrideReason,
  });
}

describe("physical facts cannot be overridden — no allocatable bed", () => {
  /**
   * Two movements staged at the same real unit: one where the unit has been forced to zero
   * allocatable beds, one where it has not. Everything else about the two states — bed releases,
   * admissions, specialling capacity — is identical, so the only thing that can explain a
   * difference in outcome is the allocatable figure itself.
   */
  function bench(allocatableValue: number): WardFlowState {
    const seeded = seedWardFlowState();
    const base = seeded.units.find((candidate) => candidate.id === UNIT_ID);
    if (!base) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);

    const unit: Unit = {
      ...base,
      beds: 20,
      empty: { ...base.empty, value: Math.max(allocatableValue, 0), confirmedAt: NOW },
      allocatable: { ...base.allocatable, value: allocatableValue, confirmedAt: NOW },
    };

    const sources = seeded.movements.slice(0, 2);
    if (sources.length !== 2) throw new Error("the seed no longer holds two movements to rewrite");

    return {
      ...seeded,
      units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
      movements: [staged(sources[0], MOVEMENT_NO_BED, false), staged(sources[1], MOVEMENT_HAS_BED, false)],
      admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
      bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
      rejections: [],
    };
  }

  it("refuses PULL_PATIENT with a valid overrideReason when the unit has zero allocatable beds", () => {
    const state = pull(bench(0), MOVEMENT_NO_BED, VALID_REASON);

    expect(state.rejections).toHaveLength(1);
    // The exact substring the bed guard at `ward-flow-reducer.ts:1136` produces, and nowhere
    // else in the file — grepped and confirmed single-occurrence. A rejection matching only a
    // looser pattern like /allocatable bed/i could also be produced by the `allocatable_bed`
    // eligibility gate's own detail text, which would not prove THIS guard fired.
    expect(state.rejections[0].reason, "the refusal must be the bed guard's own distinctive text").toContain(
      "no allocatable bed remains at",
    );

    // Refused means refused: no stage change, no bed handed out.
    expect(movementIn(state, MOVEMENT_NO_BED).stage).toBe("accepted_awaiting_bed");
    expect(movementIn(state, MOVEMENT_NO_BED).admissionId).toBeUndefined();
    expect(unitIn(state).allocatable.value, "the unit's bed count must not move on a refused pull").toBe(0);
  });

  it("positive control — the identical dispatch, identical reason, succeeds when a bed is free", () => {
    const state = pull(bench(1), MOVEMENT_HAS_BED, VALID_REASON);

    expect(state.rejections, "the SAME override reason must not itself be why this fails").toEqual([]);
    expect(movementIn(state, MOVEMENT_HAS_BED).stage).toBe("pulled");
    expect(movementIn(state, MOVEMENT_HAS_BED).admissionId).toBeDefined();
    expect(unitIn(state).allocatable.value, "a successful pull consumes the bed it was given").toBe(0);
  });
});

describe("physical facts cannot be overridden — no specialling capacity left", () => {
  /**
   * `rgh-adult-secure` is authored with `speciallingCapacity: 1`. The unit keeps six allocatable
   * beds throughout so "no bed" can never be the reason anything here is refused — only the
   * one-to-one staffing figure is exercised.
   */
  function bench(): WardFlowState {
    const seeded = seedWardFlowState();
    const base = seeded.units.find((candidate) => candidate.id === UNIT_ID);
    if (!base) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);
    if (base.speciallingCapacity !== 1) {
      throw new Error(`${UNIT_ID} is authored with ${base.speciallingCapacity} specialling capacity, not 1`);
    }

    const unit: Unit = {
      ...base,
      beds: 20,
      empty: { ...base.empty, value: 6, confirmedAt: NOW },
      allocatable: { ...base.allocatable, value: 6, confirmedAt: NOW },
    };

    const sources = seeded.movements.slice(0, 3);
    if (sources.length !== 3) throw new Error("the seed no longer holds three movements to rewrite");

    return {
      ...seeded,
      units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
      movements: [
        staged(sources[0], MOVEMENT_SPECIALLED_FIRST, true),
        staged(sources[1], MOVEMENT_SPECIALLED_BLOCKED, true),
        staged(sources[2], MOVEMENT_SPECIALLED_CONTROL, true),
      ],
      admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
      bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
      rejections: [],
    };
  }

  it("refuses PULL_PATIENT with a valid overrideReason once the unit's one specialling slot is taken", () => {
    // Fill the ward's single one-to-one slot first (no override needed — it is uncontested).
    const filled = pull(bench(), MOVEMENT_SPECIALLED_FIRST);
    expect(filled.rejections, "the first pull must succeed, or the rest of this test proves nothing").toEqual([]);
    expect(movementIn(filled, MOVEMENT_SPECIALLED_FIRST).stage).toBe("pulled");

    const state = pull(filled, MOVEMENT_SPECIALLED_BLOCKED, VALID_REASON);

    expect(state.rejections).toHaveLength(1);
    // The exact substring the specialling guard at `ward-flow-reducer.ts:1199` produces, and
    // nowhere else in the file — grepped and confirmed single-occurrence.
    expect(state.rejections[0].reason, "the refusal must be the specialling guard's own distinctive text").toContain(
      "specialling capacity left",
    );

    // Refused means refused: no stage change, no bed handed out.
    expect(movementIn(state, MOVEMENT_SPECIALLED_BLOCKED).stage).toBe("accepted_awaiting_bed");
    expect(movementIn(state, MOVEMENT_SPECIALLED_BLOCKED).admissionId).toBeUndefined();
  });

  it("positive control — the identical dispatch, identical reason, succeeds when a specialling slot is free", () => {
    const state = pull(bench(), MOVEMENT_SPECIALLED_CONTROL, VALID_REASON);

    expect(state.rejections, "the SAME override reason must not itself be why this fails").toEqual([]);
    expect(movementIn(state, MOVEMENT_SPECIALLED_CONTROL).stage).toBe("pulled");
    expect(movementIn(state, MOVEMENT_SPECIALLED_CONTROL).admissionId).toBeDefined();
  });
});

/**
 * ⚠️ **DECIDED, 2026-09-02. THIS BLOCK WAS "UNDECIDED — A MEASUREMENT, NOT A CONTRACT" AND IS NOW
 * A CONTRACT.** It recorded that `PULL_PATIENT` never refused on a stale bed count, with a recorded
 * reason or without one — because `capacity_freshness` was not in `SUITABILITY_GATES`, so
 * `eligibilityRefusal` never reached it either way. It carried an instruction to revisit rather
 * than to endorse, and this is that revisit.
 *
 * **The owner ruled that a stale bed count IS REFUSABLE AND IS ANSWERABLE.** "I have confirmed the
 * current bed state with the ward directly" is a named person taking responsibility for a fact,
 * which is what an override reason is for. So `capacity_freshness` moved into `SUITABILITY_GATES`.
 *
 * ⚠️ **THE NARROW READING, RULED EXPLICITLY: this buys past a STALE COUNT, never past
 * `allocatable_bed`.** "The bed information is known to be out of date" does NOT mean "the ward
 * looks full but is not". No reason typed into a form creates a bed, and the two tests above this
 * one are what hold that line.
 *
 * See `docs/ward-flow/owner-rulings-2026-09-02-staleness-and-legal-status.md`.
 */
describe("a stale bed count refuses, and a recorded reason answers it (owner ruling 2026-09-02)", () => {
  function benchStale(): WardFlowState {
    const seeded = seedWardFlowState();
    const base = seeded.units.find((candidate) => candidate.id === UNIT_ID);
    if (!base) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);

    // Six allocatable beds and no specialling need, so those two guards cannot be why anything
    // below succeeds or fails — only the staleness of `allocatable.confirmedAt` is exercised.
    // `staleAfterMinutes` is set explicitly here (60) rather than trusting the seed's authored
    // figure, and `confirmedAt` is put 200 minutes before `NOW` — 140 minutes past the window.
    const unit: Unit = {
      ...base,
      beds: 20,
      empty: { ...base.empty, value: 6, confirmedAt: NOW },
      allocatable: { ...base.allocatable, value: 6, confirmedAt: NOW - 200, staleAfterMinutes: 60 },
    };

    // Both movements are staged from the SAME source (`sources[0]`), which the sibling describe
    // block above already proves clears every suitability gate at this unit — `sources[1]` does
    // not (it fails `cohort`), and picking it here would make the "no rejections" assertion below
    // pass or fail on suitability rather than on staleness, exactly the attribution problem this
    // whole file exists to avoid.
    const sources = seeded.movements.slice(0, 1);
    if (sources.length !== 1) throw new Error("the seed no longer holds a movement to rewrite");

    return {
      ...seeded,
      units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
      movements: [staged(sources[0], MOVEMENT_STALE, false), staged(sources[0], MOVEMENT_STALE_NO_REASON, false)],
      admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
      bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
      rejections: [],
    };
  }

  it("refuses a stale bed count when nobody vouches for it, and admits when somebody does", () => {
    const bench = benchStale();

    // Confirm the fixture actually IS stale before trusting anything the pull does with it —
    // otherwise a passing test here would prove nothing about staleness at all.
    const verdict = eligibility(movementIn(bench, MOVEMENT_STALE), unitIn(bench), NOW);
    const freshnessGate = verdict.gates.find((gate) => gate.gate === "capacity_freshness");
    expect(freshnessGate?.pass, "the fixture must actually be stale, or this test proves nothing").toBe(false);

    // ⚠️ WITHOUT A REASON: refused. This is the half that did not exist before the ruling — the
    // gate was computed and then never consulted, so a coordinator acted on an old number with
    // nothing said.
    const refused = pull(bench, MOVEMENT_STALE_NO_REASON);
    expect(refused.rejections, "a stale count now stops the placement").toHaveLength(1);
    expect(refused.rejections[0].reason).toContain("capacity_freshness");
    expect(movementIn(refused, MOVEMENT_STALE_NO_REASON).stage).not.toBe("pulled");

    // ⚠️ WITH A REASON: admitted. A stale count is information, not a wall.
    const allowed = pull(bench, MOVEMENT_STALE, VALID_REASON);
    expect(allowed.rejections, "and a named person may vouch for the current state").toEqual([]);
    expect(movementIn(allowed, MOVEMENT_STALE).stage).toBe("pulled");
    expect(movementIn(allowed, MOVEMENT_STALE).admissionId).toBeDefined();
  });
});
