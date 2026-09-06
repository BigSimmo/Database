// tests/ward-movement-absence-reachability.test.ts
import { describe, expect, it } from "vitest";

import type { Movement } from "../src/components/ward-management/ward-model";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * REACHABILITY, DRIVEN — never read.
 *
 * ⚠️ **THIS FILE EXISTS BECAUSE TWO OF MY OWN "IMPOSSIBLE STATE" CLAIMS WERE WRONG IN ONE NIGHT,
 * AND BOTH WERE WRONG THE SAME WAY: I READ A REJECTION GUARD AND CONCLUDED WHAT COULD NOT EXIST.**
 *
 *   - I claimed 17 of 30 generated movements were impossible because `ACCEPT_IN_PRINCIPLE` rejects
 *     unless `referredUnitIds.includes(event.unitId)`. The same update sets `referredUnitIds: []`.
 *     The guard is a PRECONDITION CONSUMED BY THE TRANSITION, not an invariant that survives it.
 *   - I claimed "flagged urgent AND closed" was unreachable because `FLAG_MOVEMENT_URGENT` refuses
 *     a closed movement. Nothing refuses the other ORDER, and the closure spreads the flag through.
 *
 * The rule those two produce: **a guard tells you what is checked, never what survives the update.**
 * So every claim here is settled by dispatching real events at real seeded state and looking at what
 * comes out — not by reading the reducer, which is exactly what produced both errors.
 *
 * ⚠️ A test that only asserted the UNREACHABLE half would be the same mistake in test form: it can
 * pass because the state is genuinely impossible, or because the transitions were never attempted.
 * The REACHABLE half is the control — it proves this file can actually drive the reducer.
 */

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

function find(state: ReturnType<typeof seeded>, id: string): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing ${id}`);
  return found;
}

/**
 * Derived from the seed, never named — a hard-coded id silently stops discriminating the day the
 * fixture gives it an examination or a flag. The floor below is what stops a narrowed derivation
 * from reading as a clean pass.
 */
function closableUnflaggedOpenMovements(state: ReturnType<typeof seeded>): Movement[] {
  return state.movements.filter(
    (movement) => isOpen(movement) && !movement.closure && !movement.examination && !movement.flaggedUrgent,
  );
}

describe("the control: this file can drive the reducer at all", () => {
  it("finds enough candidates in the seed for the probes below to mean something", () => {
    const candidates = closableUnflaggedOpenMovements(seeded());
    // Floor the population the probes actually walk, not the whole fixture — a fixture that grew to
    // 500 closed movements would still leave these probes with nothing to drive.
    expect(
      candidates.length,
      `open, unexamined, unflagged movements available to drive: ${candidates.map((m) => m.id).join(", ")}`,
    ).toBeGreaterThan(4);
  });
});

describe("REACHABLE: flagged urgent AND closed", () => {
  /**
   * ⚠️ I REPORTED THIS AS UNREACHABLE. It is not, and this test is the retraction in executable
   * form. `FLAG_MOVEMENT_URGENT` refuses a movement that is ALREADY closed; no handler refuses
   * closing one that is already flagged, and every closure is built with `{ ...movement, closure }`,
   * which carries `flaggedUrgent` straight through.
   */
  it("is produced by flagging first and closing second", () => {
    const state = seeded();
    const target = closableUnflaggedOpenMovements(state)[0];
    expect(target, "no candidate movement to drive").toBeDefined();

    const flagged = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
    });
    expect(flagged.rejections, "flagging an open movement was refused").toEqual([]);
    expect(find(flagged, target.id).flaggedUrgent).toBe(true);

    // `community_order` is a closing outcome; `inpatient_order` returns before the closure.
    const closed = wardFlowReducer(flagged, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: target.id,
      outcome: "community_order",
    });
    expect(closed.rejections, "closing a flagged movement was refused").toEqual([]);

    const after = find(closed, target.id);
    expect(after.closure, "the movement did not actually close").toBeDefined();
    expect(after.flaggedUrgent, "the closure cleared the urgent flag").toBe(true);
  });

  it("is refused in the other order, which is the guard I misread", () => {
    const state = seeded();
    const target = closableUnflaggedOpenMovements(state)[0];
    const closed = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: target.id,
      outcome: "community_order",
    });
    const refused = wardFlowReducer(closed, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW + 1,
      movementId: target.id,
    });
    expect(refused.rejections.length, "flagging a closed movement should be refused").toBeGreaterThan(0);
    expect(find(refused, target.id).flaggedUrgent).toBe(false);
  });
});

describe("NOT REACHABLE by any reducer path: a closure carrying no reason", () => {
  /**
   * The page prints "This is where it stopped. Nothing on the record says why." when a closed
   * movement's reason is absent or empty. `MovementClosure.reason` is a required `string`, so
   * "absent" is not expressible at all; the live question is whether any transition can write an
   * EMPTY one.
   *
   * ⚠️ Driven across every closing event rather than argued from the three literals in the source.
   * Reading them is what I did first, and reading is what this file exists to stop.
   */
  it("every closing transition writes a non-empty reason", () => {
    let closuresObserved = 0;

    for (const outcome of ["community_order", "revoked"] as const) {
      const state = seeded();
      for (const target of closableUnflaggedOpenMovements(state)) {
        const next = wardFlowReducer(state, {
          type: "RECORD_EXAMINATION",
          role: "ed",
          now: NOW,
          movementId: target.id,
          outcome,
        });
        const closure = find(next, target.id).closure;
        if (!closure) continue;
        closuresObserved += 1;
        expect(closure.reason.trim(), `${target.id} closed via ${outcome} with an empty reason`).not.toBe("");
      }
    }

    // The anti-vacuity floor: without it, a change that stopped these transitions closing anything
    // would leave the loop asserting nothing and reporting green.
    expect(closuresObserved, "no closure was actually produced — the probe asserted nothing").toBeGreaterThan(8);
  });

  it("arrival's closure also carries a reason", () => {
    // Driven from whatever the seed already has in flight rather than constructed, because
    // PATIENT_ARRIVED requires stage "moving" AND a collected transport job.
    const state = seeded();
    const movingWithCollection = state.movements.filter(
      (movement) => movement.stage === "moving" && movement.transport?.collectedAt !== undefined,
    );
    expect(movingWithCollection.length, "no movement is in flight to arrive").toBeGreaterThan(0);

    // ⚠️ ROLE "officer", NOT "ward" — `EVENT_ROLE.PATIENT_ARRIVED` is `["officer"]` alone. The first
    // draft used "ward", every dispatch was refused on permission, and the test went red saying the
    // movement "did not arrive". That red was correct and useful: a probe that had instead asserted
    // only "no closure has an empty reason" would have passed on a run where nothing arrived at all.
    let arrivalsObserved = 0;
    for (const target of movingWithCollection) {
      const next = wardFlowReducer(state, {
        type: "PATIENT_ARRIVED",
        role: "officer",
        now: NOW + 1,
        movementId: target.id,
      });
      const closure = find(next, target.id).closure;
      // An arrival can still be refused for a reason that is nothing to do with this claim — the
      // accepting unit having no physically empty bed. Those are skipped rather than asserted on,
      // and the floor below is what stops every one being skipped in silence.
      if (!closure) continue;
      arrivalsObserved += 1;
      expect(closure.reason.trim(), `${target.id} arrived with an empty closure reason`).not.toBe("");
    }
    expect(arrivalsObserved, "no arrival was actually produced — the probe asserted nothing").toBeGreaterThan(0);
  });
});
