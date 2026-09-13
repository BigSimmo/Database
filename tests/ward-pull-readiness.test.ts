import { describe, expect, it } from "vitest";

import { bedsPendingPreparation, openBedsNow } from "../src/components/ward-management/ward-bed-availability";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { BedRelease, Unit } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/*
 * WHY THIS FILE EXISTS. Owner ruling, 2026-09-01: "A pull cannot occur unless the bed is actually
 * available and open, not pending (i.e. being cleaned)."
 *
 * Before it, a patient could be pulled to a bed that was still being cleaned. `PULL_PATIENT` refused only
 * when `allocatable` hit zero, and `availableNow` reads no readiness field at all — which
 * `ward-bed-availability.ts` documented as deliberate, reasoning that a bed being prepared is still
 * worth counting because the pull takes hours anyway. The owner overruled that reasoning.
 *
 * ⚠️ THE TEST THAT WOULD PASS ON A WRONG VALUE HERE is one asserting a screen says "pending". That is
 * satisfied by a label. Every assertion below is about a STATE TRANSITION being refused.
 */

function seeded() {
  return seedWardFlowState();
}

function unitOf(state: WardFlowState, id: string): Unit {
  const found = state.units.find((candidate: Unit) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

/** A movement accepted at a unit and standing at the exact stage a pull acts on. */
function acceptedAt(unitId: string, movementId: string): WardFlowState {
  let state = seeded();
  state = wardFlowReducer(state, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: NOW,
    movementId,
    unitIds: [unitId],
  });
  state = wardFlowReducer(state, { type: "ACCEPT_IN_PRINCIPLE", role: "ward", now: NOW, movementId, unitId });
  return state;
}

/** Every free bed at this unit recorded as discharged and still being made ready. */
function allFreeBedsBeingPrepared(state: WardFlowState, unitId: string): WardFlowState {
  const unit = unitOf(state, unitId);
  const free = Math.min(unit.allocatable.value, unit.empty.value);
  const prepared: BedRelease[] = Array.from({ length: free }, (_unused, index) => ({
    id: `BR-PREP-${index}`,
    unitId,
    state: "discharged",
    expectedAt: NOW,
    waitingOn: null,
    blocker: null,
    // Required alongside `blocker`. Vitest never noticed it missing - it runs no typecheck, so this
    // file was green and uncompilable at the same time.
    blockedBy: null,
    preparing: true,
    preparationNote: "Being cleaned",
    confirmedAt: NOW,
    confirmedBy: "Ward",
  }));
  return { ...state, bedReleases: [...state.bedReleases, ...prepared] };
}

describe("a patient cannot be pulled to a bed that is not ready", () => {
  const UNIT = "rph-adult-secure";
  const MOVEMENT = "WF-009";

  it("pulls normally when the free bed is open", () => {
    const state = acceptedAt(UNIT, MOVEMENT);
    // Non-vacuity: the case below must fail for READINESS, not because there was never a bed.
    expect(openBedsNow(unitOf(state, UNIT), state.bedReleases)).toBeGreaterThan(0);

    const next = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: MOVEMENT,
      unitId: UNIT,
    });

    expect(next.rejections).toHaveLength(0);
    expect(next.movements.find((m) => m.id === MOVEMENT)?.stage).toBe("pulled");
  });

  it("REFUSES the pull when every free bed is still being made ready", () => {
    const state = allFreeBedsBeingPrepared(acceptedAt(UNIT, MOVEMENT), UNIT);
    const unit = unitOf(state, UNIT);
    // The ward still claims beds it can staff — so a refusal here cannot be the allocatable check.
    expect(unit.allocatable.value).toBeGreaterThan(0);
    expect(bedsPendingPreparation(UNIT, state.bedReleases)).toBeGreaterThan(0);
    expect(openBedsNow(unit, state.bedReleases)).toBe(0);

    const next = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: MOVEMENT,
      unitId: UNIT,
    });

    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toContain("still being made ready");
    // The transition did NOT happen. This is the assertion a label-based test cannot make.
    expect(next.movements.find((m) => m.id === MOVEMENT)?.stage).toBe("accepted_awaiting_bed");
  });

  it("leaves the ward's own numbers alone while refusing", () => {
    /*
     * The owner was asked directly whether a bed being cleaned should DROP the ward's number or only
     * REFUSE the pull, and chose the refusal: the ward has not changed what it can staff, so its
     * figures must not lurch as cleaning starts and stops. This pins that choice.
     */
    const state = allFreeBedsBeingPrepared(acceptedAt(UNIT, MOVEMENT), UNIT);
    const before = unitOf(state, UNIT);

    const next = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: MOVEMENT,
      unitId: UNIT,
    });
    const after = unitOf(next, UNIT);

    expect(after.allocatable.value).toBe(before.allocatable.value);
    expect(after.empty.value).toBe(before.empty.value);
  });

  it("refuses a coordinator's pull too, not only a ward's", () => {
    // The role was widened to ward + coordinator by the same ruling. Readiness is not role-dependent.
    const state = allFreeBedsBeingPrepared(acceptedAt(UNIT, MOVEMENT), UNIT);

    const next = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "coordinator",
      now: NOW,
      movementId: MOVEMENT,
      unitId: UNIT,
    });

    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toContain("still being made ready");
  });

  it("lets a coordinator pull when the bed IS open, so the widened role actually works", () => {
    const state = acceptedAt(UNIT, MOVEMENT);

    const next = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "coordinator",
      now: NOW,
      movementId: MOVEMENT,
      unitId: UNIT,
    });

    expect(next.rejections).toHaveLength(0);
    expect(next.movements.find((m) => m.id === MOVEMENT)?.stage).toBe("pulled");
  });
});
