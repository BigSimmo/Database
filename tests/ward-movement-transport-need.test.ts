// tests/ward-movement-transport-need.test.ts
//
// THE THIRD TRANSPORT STATE — owner ruling R-2026-09-04-C.
//
// Before this, `Movement.transport` was the only thing the model held about transport, and its
// absence meant two opposite operational situations at once: NO TRANSPORT IS NEEDED (finished) and
// NO TRANSPORT HAS BEEN BOOKED (outstanding). A screen could honestly say no more than "no
// transport recorded" for either. `Movement.transportNeed` is the recorded answer, shaped exactly
// like `Referral.medicalClearance`, and `transportNeedState` names all three so a caller cannot
// collapse two of them with `?? false`.
//
// ⚠️ WHY THE FIXTURE IS ASSERTED TO CARRY NOTHING, AND WHY THAT IS THE TEST RATHER THAN A GAP.
// The ruling requires "not recorded" to remain the default for existing data: a backfill that
// guessed one of the other two for a legacy movement would manufacture the very certainty the
// third state exists to provide honestly. Every seeded and generated movement is existing data, so
// the fixture answers for none of them — and the reducer tests below are what stop that absence
// from meaning the field simply does not work.
import { describe, expect, it } from "vitest";

import { transportNeedState } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/** An open movement from the seed — the reducer refuses a closed one. */
function openMovement(): Movement {
  const movement = seedWardFlowState().movements.find((candidate) => candidate.closure === undefined);
  if (movement === undefined) throw new Error("the seed holds no open movement");
  return movement;
}

describe("transportNeedState names three states and never collapses two of them", () => {
  it("reads a recorded yes and a recorded no as different answers", () => {
    expect(transportNeedState({ transportNeed: { needed: true, at: NOW } })).toBe("needed");
    expect(transportNeedState({ transportNeed: { needed: false, at: NOW } })).toBe("not_needed");
  });

  it("reads an unanswered movement as not_recorded, which is neither of the other two", () => {
    const state = transportNeedState({ transportNeed: undefined });
    expect(state).toBe("not_recorded");
    // Stated as three separate assertions rather than one equality: the failure this guards
    // against is `not_recorded` being folded into `not_needed`, and that is what "is not" says.
    expect(state).not.toBe("not_needed");
    expect(state).not.toBe("needed");
  });

  it("does NOT infer the answer from a booked transport job", () => {
    // A booked job proves need; its absence proves nothing, which is the whole gap this field
    // closes. A movement carrying a job and no recorded answer must still read `not_recorded` —
    // honest, and visibly so — rather than being upgraded by an inference nobody made.
    const withJob = seedWardFlowState().movements.find((movement) => movement.transport !== undefined);
    expect(withJob, "the seed holds no movement with a transport job, so this test proves nothing").toBeDefined();
    expect(withJob!.transportNeed).toBeUndefined();
    expect(transportNeedState(withJob!)).toBe("not_recorded");
  });
});

describe("the seed records no transport need at all, which the ruling requires", () => {
  it("leaves every one of the fifty movements not_recorded", () => {
    const seeded = seedWardFlowState();
    expect(seeded.movements).toHaveLength(50);
    const answered = seeded.movements.filter((movement) => movement.transportNeed !== undefined);
    // Named rather than counted: a backfill would show up here as the ids it invented answers for.
    expect(answered.map((movement) => movement.id)).toEqual([]);
    for (const movement of seeded.movements) {
      expect(transportNeedState(movement), `${movement.id} carries a transport need nobody recorded`).toBe(
        "not_recorded",
      );
    }
  });
});

describe("RECORD_TRANSPORT_NEED is the producer, so the field is not one only a fixture can write", () => {
  it("records a yes and a no, each with the instant it was answered", () => {
    const seeded = seedWardFlowState();
    const movement = openMovement();

    const needed = wardFlowReducer(seeded, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ed",
      now: NOW + 5,
      movementId: movement.id,
      needed: true,
    });
    expect(needed.rejections).toEqual([]);
    const afterYes = needed.movements.find((candidate) => candidate.id === movement.id)!;
    expect(afterYes.transportNeed).toEqual({ needed: true, at: NOW + 5 });
    expect(transportNeedState(afterYes)).toBe("needed");

    // BOTH answers are exercised: a test that only ever recorded `true` would leave the branch
    // that distinguishes "no" from "unanswered" untraversed while reporting the event as covered.
    const notNeeded = wardFlowReducer(seeded, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ed",
      now: NOW + 5,
      movementId: movement.id,
      needed: false,
    });
    expect(notNeeded.rejections).toEqual([]);
    const afterNo = notNeeded.movements.find((candidate) => candidate.id === movement.id)!;
    expect(afterNo.transportNeed).toEqual({ needed: false, at: NOW + 5 });
    expect(transportNeedState(afterNo)).toBe("not_needed");
  });

  it("lets a later answer overwrite an earlier one, keeping the newer instant", () => {
    // A patient who could walk at 09:00 may need an escort by 11:00. Refusing the correction would
    // leave the board asserting something the sending team no longer believes — the same reasoning
    // `RECORD_MEDICAL_CLEARANCE` is written with, and deliberately unlike `RECORD_EXAMINATION`.
    const first = wardFlowReducer(seedWardFlowState(), {
      type: "RECORD_TRANSPORT_NEED",
      role: "ed",
      now: NOW,
      movementId: openMovement().id,
      needed: false,
    });
    const second = wardFlowReducer(first, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now: NOW + 120,
      movementId: openMovement().id,
      needed: true,
    });
    expect(second.rejections).toEqual([]);
    expect(second.movements.find((candidate) => candidate.id === openMovement().id)!.transportNeed).toEqual({
      needed: true,
      at: NOW + 120,
    });
  });

  it("refuses an unknown movement id rather than defaulting to one", () => {
    const seeded = seedWardFlowState();
    const after = wardFlowReducer(seeded, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ed",
      now: NOW,
      movementId: "WF-DOES-NOT-EXIST",
      needed: true,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("WF-DOES-NOT-EXIST");
    expect(after.movements).toEqual(seeded.movements);
  });

  it("refuses a closed movement", () => {
    const seeded = seedWardFlowState();
    const closed = seeded.movements.find((movement) => movement.closure !== undefined);
    expect(closed, "the seed holds no closed movement, so this test proves nothing").toBeDefined();
    const after = wardFlowReducer(seeded, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ed",
      now: NOW,
      movementId: closed!.id,
      needed: false,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("closed movement");
    expect(after.movements.find((candidate) => candidate.id === closed!.id)!.transportNeed).toBeUndefined();
  });

  it("refuses the coordinator, and accepts the three senders — the BOOK_TRANSPORT split", () => {
    // `TR-D1` rejects the coordinator from BOOKING by name: it owns the bed search and does not
    // know whether this patient can travel. Whether transport is needed at all is that same
    // knowledge one step earlier. The three accepted roles are the control — a role gate that
    // refused everybody would pass the refusal half of this test on its own.
    const seeded = seedWardFlowState();
    const refused = wardFlowReducer(seeded, {
      type: "RECORD_TRANSPORT_NEED",
      role: "coordinator",
      now: NOW,
      movementId: openMovement().id,
      needed: true,
    });
    expect(refused.rejections).toHaveLength(1);
    expect(refused.movements.find((candidate) => candidate.id === openMovement().id)!.transportNeed).toBeUndefined();

    for (const role of ["ed", "ward", "community"] as const) {
      const allowed = wardFlowReducer(seeded, {
        type: "RECORD_TRANSPORT_NEED",
        role,
        now: NOW,
        movementId: openMovement().id,
        needed: true,
      });
      expect(allowed.rejections, `${role} was refused, and it is a permitted sender`).toEqual([]);
    }
  });
});
