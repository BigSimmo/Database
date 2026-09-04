// tests/ward-stage-reached-at.test.ts
//
// Guards the two timestamp defects a reviewer found in `stageReachedAt`
// (ward-management-console.tsx), both of which put a WRONG TIME on the movement workspace's
// current-step sentence rather than a missing one — a false statement, not a gap.
//
// ⚠️ WHY THESE ARE PROPERTIES OVER DRIVEN STATE, NOT DOM ASSERTIONS. The seeded fixture carries
// an empty `stageChanges` on every movement by design, so a rendering test over the seed cannot
// reach either defect: one needs a movement that revisits a stage, the other needs the gap between
// going en route and being collected. Both are produced by driving the real reducer.
//
// ⚠️ `stageReachedAt` IS IMPORTED, NOT RE-IMPLEMENTED. The first version of this file mirrored it,
// because the function was private. That guarded nothing: reverting either fix in the component
// left every assertion here green, since they were exercising the copy — measured by mutation,
// which caught only a source-text pin. The function is now exported and driven directly.

import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { stageReachedAt } from "@/components/ward-management/ward-management-console";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

function movementIn(state: WardFlowState, id: string): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function accepted(before: WardFlowState, after: WardFlowState, label: string) {
  expect(after.rejections.length, `${label} was rejected, so nothing below is driven state`).toBe(
    before.rejections.length,
  );
}

const MOVEMENT_ID = "WF-012";
const UNIT_A = "rph-adult-secure";
const t = (offset: number): Instant => NOW_ANCHOR + offset;

describe("stageReachedAt reports the current visit, not the first one ever", () => {
  it("dates a re-reached stage from the LATEST transition, not a withdrawn earlier one", () => {
    let state = seedWardFlowState();

    const s1 = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: t(10),
      movementId: MOVEMENT_ID,
      unitIds: [UNIT_A],
    });
    accepted(state, s1, "REFER_TO_UNITS");

    const s2 = wardFlowReducer(s1, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: t(20),
      movementId: MOVEMENT_ID,
      unitId: UNIT_A,
    });
    accepted(s1, s2, "ACCEPT_IN_PRINCIPLE (first)");

    const s3 = wardFlowReducer(s2, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: t(30),
      movementId: MOVEMENT_ID,
      reason: "the_decision_changed",
    });
    accepted(s2, s3, "WITHDRAW_ACCEPTANCE");

    const s4 = wardFlowReducer(s3, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: t(40),
      movementId: MOVEMENT_ID,
      unitIds: [UNIT_A],
    });
    accepted(s3, s4, "REFER_TO_UNITS (again)");

    state = wardFlowReducer(s4, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: t(50),
      movementId: MOVEMENT_ID,
      unitId: UNIT_A,
    });
    accepted(s4, state, "ACCEPT_IN_PRINCIPLE (second)");

    const movement = movementIn(state, MOVEMENT_ID);

    // The premise: the stage really was reached twice. Without this the assertion below is
    // satisfied by a movement that only ever visited the stage once, and proves nothing.
    const visits = movement.stageChanges.filter((change) => change.to === "accepted_awaiting_bed");
    expect(
      visits.length,
      "this movement did not reach accepted_awaiting_bed twice, so first-vs-last cannot differ " +
        "and this test would pass against the defect it exists to catch",
    ).toBe(2);
    expect(visits[0].at, "the two visits must have different times, or there is nothing to tell apart").not.toBe(
      visits[1].at,
    );

    expect(
      stageReachedAt(movement, "accepted_awaiting_bed"),
      "the workspace must date the acceptance from the CURRENT one, not the one that was withdrawn",
    ).toBe(t(50));
    expect(
      stageReachedAt(movement, "accepted_awaiting_bed"),
      "agrees with acceptedAt, which the reducer also rewrote on re-acceptance",
    ).toBe(movement.acceptedAt);
  });
});

describe("stageReachedAt dates `moving` from collection, not from the crew setting off", () => {
  /**
   * ⚠️ FLOORED ON THE DISCRIMINATING POPULATION. Only a movement carrying BOTH `enRouteAt` and
   * `collectedAt`, with different values, can tell the two apart. Three seeded movements do
   * (WF-006, WF-007, WF-014); if the fixture stops containing any, this walks nothing and would
   * pass against the defect, so the floor fails first and says so.
   */
  const seeded = seedWardFlowState().movements.filter(
    (movement) =>
      movement.transport?.enRouteAt !== undefined &&
      movement.transport.collectedAt !== undefined &&
      movement.transport.enRouteAt !== movement.transport.collectedAt,
  );

  it("finds seeded movements where en route and collected differ", () => {
    expect(
      seeded.length,
      "no seeded movement has a gap between enRouteAt and collectedAt, so the assertion below " +
        "cannot discriminate the two fields",
    ).toBeGreaterThan(0);
  });

  it("never reports the moving stage as earlier than the patient was collected", () => {
    for (const movement of seeded) {
      const reached = stageReachedAt({ ...movement, stageChanges: [] }, "moving");
      expect(
        reached,
        `${movement.id}: the reducer enters 'moving' on PATIENT_COLLECTED, so the workspace must ` +
          `date it from collectedAt (${movement.transport?.collectedAt}) and not from enRouteAt ` +
          `(${movement.transport?.enRouteAt}), which is always earlier and belongs to the ` +
          `preceding handover-ready transport state`,
      ).toBe(movement.transport?.collectedAt);
    }
  });

  it("reports no time at all when transport is en route but the patient is not yet collected", () => {
    const source = seeded[0];
    const notCollected: Movement = {
      ...source,
      stageChanges: [],
      transport: { ...source.transport!, collectedAt: undefined },
    };
    expect(
      stageReachedAt(notCollected, "moving"),
      "a movement whose patient has not been collected has not reached 'moving', so there is no " +
        "time to report — falling back to enRouteAt would invent one",
    ).toBeUndefined();
  });
});
