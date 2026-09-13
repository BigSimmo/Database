import { describe, expect, it } from "vitest";

import {
  acceptedBlockedReason,
  arrivedBlockedReason,
  collectedBlockedReason,
  enRouteBlockedReason,
} from "../src/components/ward-management/officer/officer-screen";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";

/**
 * 🔴 THE OFFICER'S BUTTONS MUST NOT ADVERTISE AN ACTION THE REDUCER WOULD REFUSE.
 *
 * On 2026-09-04 all four `*BlockedReason` predicates on the officer screen omitted the
 * `movement.closure` guard that all four reducer cases enforce first. A clinician pressed a button
 * on a phone, the reducer refused, the movement came back byte-identical, and nothing on the screen
 * said anything. The screen also read `rejections` nowhere, so there was no channel to report it.
 *
 * ⚠️ THIS DRIVES BOTH IMPLEMENTATIONS AND READS NEITHER. A parity check written by comparing the
 * two texts would be a third hand-written mirror of the reducer and would inherit the same defect —
 * and could be satisfied by a comment. This one asks the predicate what it permits, then actually
 * dispatches the matching event and looks at whether a rejection was filed.
 */

/**
 * ⚠️ NARROWED TO THE FOUR ON PURPOSE, AND `WardFlowEvent["type"]` IS THE WRONG TYPE HERE.
 *
 * With the broad union, `{ type: action, ... }` cannot narrow, so the dispatch below needed an
 * `as WardFlowEvent` cast — and a cast plus a runner that does not typecheck is what let a
 * malformed `RECORD_EXAMINATION` (`admissionNeeded`, which is not a field of that event; the real
 * one is `outcome`) sit in this file and PASS. `outcome` arrived undefined, missed the
 * `=== "inpatient_order"` branch, fell into the closing branch by accident, and every assertion
 * held. It exercised the right path for the wrong reason.
 *
 * `Extract` keeps tsc as the guard: only these four are assignable, and every field is checked.
 */
type OfficerEvent = Extract<
  WardFlowEvent,
  { type: "TRANSPORT_ACCEPTED" | "TRANSPORT_EN_ROUTE" | "PATIENT_COLLECTED" | "PATIENT_ARRIVED" }
>;

type Case = {
  readonly action: OfficerEvent["type"];
  readonly permits: (movement: Movement, units: Unit[]) => string | undefined;
};

const CASES: readonly Case[] = [
  { action: "TRANSPORT_ACCEPTED", permits: (movement) => acceptedBlockedReason(movement) },
  { action: "TRANSPORT_EN_ROUTE", permits: (movement) => enRouteBlockedReason(movement) },
  { action: "PATIENT_COLLECTED", permits: (movement) => collectedBlockedReason(movement) },
  {
    action: "PATIENT_ARRIVED",
    permits: (movement, units) =>
      arrivedBlockedReason(
        movement,
        movement.acceptedUnitId ? units.find((unit) => unit.id === movement.acceptedUnitId) : undefined,
      ),
  },
];

const NOW = 900;

function driveFrom(state: WardFlowState, movement: Movement, action: OfficerEvent["type"]) {
  const before = state.rejections.length;
  const event: OfficerEvent = { type: action, role: "officer", now: NOW, movementId: movement.id };
  const next = wardFlowReducer(state, event);
  return { filed: next.rejections.slice(before), state: next };
}

describe("every officer action the screen enables is one the reducer will accept", () => {
  /*
   * ⚠️ THE SEEDED FIXTURE DOES NOT REACH THREE OF THESE FOUR STATES, and the first version of this
   * test discovered that by going red on its own population floor: `PATIENT_COLLECTED` permitted
   * NOTHING to drive. A sweep over the raw seed would have passed those three by walking an empty
   * list — a guard hung on a precondition it does not control.
   *
   * So the chain is DRIVEN. Each action's parity is checked in a state reached by dispatching the
   * actions before it, which is the only state in which that button is ever on screen anyway.
   */
  /*
   * ⚠️ THE FIXTURE DOES NOT SUPPLY A STARTING POINT FOR `TRANSPORT_ACCEPTED`. Measured: of 50
   * seeded movements only 8 carry a transport job, and the single one at `handover_ready` with a
   * job (WF-005) has ALREADY been accepted — so the predicate correctly permits nothing, and a
   * sweep would have walked an empty list. The chain therefore starts by BUILDING that state from
   * a `pulled` movement through the two ED events that produce it, exactly as a real shift does.
   */
  function bootstrap() {
    let state = seedWardFlowState();
    const pulled = state.movements.find(
      (movement) => movement.stage === "pulled" && movement.transport === undefined && !movement.closure,
    );
    expect(pulled, "no pulled movement without transport exists to build a handover from").toBeDefined();
    const movementId = (pulled as Movement).id;
    state = wardFlowReducer(state, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW,
      movementId,
      provider: "Ambulance service",
      escortRequired: false,
    });
    state = wardFlowReducer(state, { type: "HANDOVER_READY", role: "ed", now: NOW, movementId });
    expect(state.rejections, "the two setup events were themselves refused, so the chain never started").toHaveLength(
      0,
    );
    return state;
  }

  it("drives the whole transport chain, checking parity at every step it reaches", () => {
    let state = bootstrap();
    const stepsChecked: string[] = [];

    for (const { action, permits } of CASES) {
      const permitted = state.movements.filter((movement) => permits(movement, state.units) === undefined);

      expect(
        permitted.length,
        `${action}: nothing is permitted in the state reached by the preceding actions, so this step ` +
          `drives nothing. The chain has broken — find out where, do not delete this.`,
      ).toBeGreaterThan(0);

      // Drive EVERY permitted movement, not a sample: the defect was in a predicate, and a
      // predicate is wrong for a class of movements rather than for one.
      const wrongly = permitted
        .map((movement) => ({ movement, filed: driveFrom(state, movement, action).filed }))
        .filter((entry) => entry.filed.length > 0);

      expect(
        wrongly.map((entry) => `${entry.movement.id}: ${entry.filed[0]?.reason}`),
        `${action}: the screen would render these buttons ENABLED and the reducer refuses them. A ` +
          `clinician presses and nothing happens.`,
      ).toEqual([]);

      stepsChecked.push(`${action} (${permitted.length})`);
      // Advance the chain on the first permitted movement so the next action has a population.
      state = driveFrom(state, permitted[0] as Movement, action).state;
    }

    expect(stepsChecked, "every one of the four actions must have been reached and checked").toHaveLength(CASES.length);
  });

  /*
   * 🔴 THE REACHABLE SEQUENCE THAT PRODUCED THE DEFECT, driven rather than described.
   *
   * ⚠️ THE SWEEP ABOVE CANNOT CATCH THIS ON ITS OWN. It walks the seeded fixture, and the fixture
   * need not contain a movement that is both closed AND otherwise eligible — so with the closure
   * guards deleted the sweep could still pass. This constructs that state through ordinary events
   * from two different roles, which is exactly how it arises in use.
   */
  it("a movement closed by somebody else stops advertising transport actions", () => {
    /*
     * 🔴 THE MOVEMENT MUST BE DRIVEN TO THE STATE WHERE CLOSURE IS THE *ONLY* THING BLOCKING.
     *
     * My first version picked any transport-stage movement, closed it, and asserted each predicate
     * returned something. It PASSED WITH THE CLOSURE GUARD DELETED — because on that movement the
     * stage guard was blocking anyway, and one guard was masking the absence of the other. A test
     * that cannot tell which guard fired is not testing either.
     *
     * So: drive to en route first (which is what makes Collected available), THEN close it, and
     * assert on the one action that was genuinely available a moment earlier. That is the sequence
     * the Ward Verifier drove by hand.
     */
    let state = bootstrap();
    const ready = state.movements.find((movement) => acceptedBlockedReason(movement) === undefined) as Movement;
    expect(ready, "the bootstrap did not produce a movement ready for transport acceptance").toBeDefined();

    state = wardFlowReducer(state, {
      type: "TRANSPORT_ACCEPTED",
      role: "officer",
      now: NOW,
      movementId: ready.id,
    });
    state = wardFlowReducer(state, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW,
      movementId: ready.id,
    });
    expect(state.rejections, "driving to en route was itself refused, so nothing below holds").toHaveLength(0);

    const enRoute = state.movements.find((movement) => movement.id === ready.id) as Movement;
    expect(
      collectedBlockedReason(enRoute),
      "PRECONDITION: Collected must be genuinely available here, or closing the movement proves nothing",
    ).toBeUndefined();

    // An ED user records an examination revoking the need for admission. Role-gated to `ed`, and it
    // gates on closure but NOT on stage — which is why it lands on a movement already mid-transport.
    const closed = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: ready.id,
      // ⚠️ WAS `admissionNeeded: false`, WHICH IS NOT A FIELD OF THIS EVENT. An `as WardFlowEvent`
      // cast used to sit on this call and silenced it; vitest runs no tsc, and the test PASSED —
      // `outcome` arrived `undefined`, missed the `=== "inpatient_order"` branch, and fell into the
      // closing branch by accident, so the movement closed, `after.closure` was defined, and every
      // assertion held. The right path for the wrong reason, never dispatching the `revoked`
      // examination this block describes.
      //
      // The cast is gone now — see the file header. It is named here in the past tense on purpose:
      // this is the line it hid a defect on, and that is worth knowing at the site rather than only
      // in the header.
      outcome: "revoked",
    });
    const after = closed.movements.find((movement) => movement.id === ready.id) as Movement;
    expect(after.closure, "the examination did not close the movement, so the rest proves nothing").toBeDefined();

    expect(
      collectedBlockedReason(after),
      "Collected is STILL advertised on a movement an ED user has closed. The reducer refuses it, so " +
        "the button does nothing and the phone says nothing — the exact defect of 2026-09-04.",
    ).toBeDefined();

    // And the reducer really does refuse it, so the two halves are checked against each other
    // rather than the predicate being checked against my belief about the reducer.
    const pressed = wardFlowReducer(closed, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW + 2,
      movementId: ready.id,
    });
    expect(
      pressed.rejections.length,
      "the reducer accepted Collected on a closed movement, which would make the predicate correct " +
        "and this whole test wrong",
    ).toBeGreaterThan(closed.rejections.length);
  });
});
