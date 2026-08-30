import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { TRANSPORT_PROVIDERS } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE SENDING TEAM BOOKS THE TRANSPORT, AND THE ESCORT QUESTION IS ANSWERED BY A PERSON.
 *
 * `TR-D1` (OWNER, 2026-08-30): **the sending ward or ED arranges transport.** Once a receiving ward
 * accepts, the team currently holding the patient books the transport out. ⚠️ **His reason is the
 * whole design: the sending team knows the facts the booking needs** — whether an escort is
 * required, whether the patient is settled enough to travel. **The bed coordinator was REJECTED for
 * this**: it owns the bed search and does not know the patient's state. `TR-D5` generalises it to
 * every movement, which is why the ward is a booker too and not only the ED.
 *
 * ⚠️ **AND THIS EVENT EXISTS BECAUSE THE REDUCER WAS ANSWERING THAT QUESTION ITSELF.**
 * `HANDOVER_READY` fabricates a transport job on the spot and fills the escort question by
 * DERIVING it: `escortRequired: movement.legalStatus !== "Voluntary"`. **That is a clinical
 * judgement, made by nobody, presented on screen as though a clinician had made it** — and it is
 * wrong in both directions. A voluntary patient can need an escort; a detained one settled enough
 * to travel may not. `TR-D1` names escort as one of the two facts the sending team is booking
 * BECAUSE it knows them.
 *
 * ⚠️ **BLANK, NEVER PRE-FILLED** (owner, relayed): the booking control opens with the escort
 * question unanswered. A pre-filled answer is a judgement nobody made wearing the clothes of one
 * somebody did — the same defect as the derivation, moved into the UI where it looks like a
 * default rather than a claim. This file pins the model half: the event REQUIRES an answer, so
 * there is no value the form can omit and no default for the reducer to invent.
 *
 * ✅ **THE FABRICATION IS GONE, 2026-08-31.** A test here asserted it was PRESENT, with the removal
 * steps in its own body and worded so it could not stay green afterwards — the debt could not be
 * forgotten or quietly inherited. The booking control landed at `caacf1eda`, the derivation went
 * with it in the same hour, and that test failed exactly as designed and was deleted by its own
 * instructions. **`HANDOVER_READY` now REQUIRES a booked transport rather than inventing one**, and
 * the two changes shipped together because a stage reachable with no transport, on a model where
 * nothing else creates one, is a patient marked ready to hand over with no way to move them.
 */
const NOW = NOW_ANCHOR;

function heldBedMovement() {
  const state = seedWardFlowState();
  const movement = state.movements.find((candidate) => candidate.stage === "bed_held");
  expect(movement, "the fixture must hold a movement with a bed held, or nothing here is exercised").toBeDefined();
  return { state, movementId: movement!.id, sendingEd: movement!.originEdId };
}

function book(overrides: Record<string, unknown> = {}) {
  const { state, movementId } = heldBedMovement();
  return wardFlowReducer(state, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now: NOW,
    movementId,
    provider: TRANSPORT_PROVIDERS[0],
    escortRequired: true,
    ...overrides,
  } as never);
}

describe("BOOK_TRANSPORT", () => {
  it("books a job the sending ED asked for, with the escort answer it gave", () => {
    const { movementId } = heldBedMovement();
    const state = book();
    expect(state.rejections, "the booking must be accepted, or nothing below is exercised").toEqual([]);

    const movement = state.movements.find((candidate) => candidate.id === movementId)!;
    expect(movement.transport).toBeDefined();
    expect(movement.transport!.provider).toBe(TRANSPORT_PROVIDERS[0]);
    expect(movement.transport!.escortRequired).toBe(true);
    expect(movement.transport!.acceptedAt, "booking is not acceptance — the provider has not answered").toBeUndefined();
  });

  it("⚠️ CARRIES THE ANSWER GIVEN, not one derived from the patient's legal status", () => {
    // The defect this event exists to end, stated as a test rather than a comment. A DETAINED
    // patient booked with no escort must record no escort: the sending team is the one that knows
    // whether this person is settled enough to travel, and `legalStatus` cannot know it.
    const { state, movementId } = heldBedMovement();
    const movement = state.movements.find((candidate) => candidate.id === movementId)!;
    expect(movement.legalStatus, "this case only bites for a patient the old derivation would have escorted").not.toBe(
      "Voluntary",
    );

    const booked = wardFlowReducer(state, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW,
      movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      ...{},
    } as never);
    expect(booked.rejections).toEqual([]);
    const after = booked.movements.find((candidate) => candidate.id === movementId)!;
    expect(
      after.transport!.escortRequired,
      "the reducer overrode a clinician's answer with one derived from legal status",
    ).toBe(false);
  });

  it("lets the sending WARD book too, because TR-D5 generalises beyond bed placement", () => {
    expect(book({ role: "ward" }).rejections).toEqual([]);
  });

  it("⚠️ REFUSES THE COORDINATOR, which TR-D1 rejected by name and for a stated reason", () => {
    // Not an oversight and not tidiness: the coordinator owns the bed search and does not know the
    // patient's state, which is exactly the knowledge the booking needs.
    const state = book({ role: "coordinator" });
    expect(state.rejections.length).toBe(1);
    expect(state.movements.some((movement) => movement.transport?.escortRequired === true)).toBe(
      seedWardFlowState().movements.some((movement) => movement.transport?.escortRequired === true),
    );
  });

  it("refuses a provider that is not on the fixed list", () => {
    const state = book({ provider: "Uber" });
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("provider");
  });

  it("⚠️ REFUSES A MISSING ESCORT ANSWER — the whole point of the event", () => {
    // `undefined` rather than a wrong boolean, because the control opens BLANK. If the reducer
    // accepted it and stored `false`, the screen would show "no escort required" for a question
    // nobody answered — the derivation defect wearing a different hat.
    const state = book({ escortRequired: undefined });
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("escort");
  });

  it("refuses to book on a movement whose bed is not held yet", () => {
    const state = seedWardFlowState();
    const early = state.movements.find((candidate) => candidate.stage === "placement_requested")!;
    const booked = wardFlowReducer(state, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW,
      movementId: early.id,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: true,
    } as never);
    expect(booked.rejections.length).toBe(1);
    expect(booked.movements.find((candidate) => candidate.id === early.id)!.transport).toBeUndefined();
  });

  it("🔴 REFUSES A HANDOVER WITH NO TRANSPORT BOOKED — the half that replaced the fabrication", () => {
    // ⚠️ THIS TEST DID NOT EXIST WHEN THE PRECONDITION DID. Removing `HANDOVER_READY`'s fabrication
    // and adding `if (!movement.transport) reject` were written together, the whole suite went
    // green, and a mutation deleting the new guard ALSO left 68 tests green. The walks were all
    // repaired to book first, so every one of them satisfied the precondition and none of them
    // tested it. **Repairing the callers of a new rule removes the only evidence the rule works.**
    const { state, movementId } = heldBedMovement();
    const before = state.movements.find((candidate) => candidate.id === movementId)!;
    expect(before.transport, "the fixture must have no transport, or this proves nothing").toBeUndefined();

    const refused = wardFlowReducer(state, {
      type: "HANDOVER_READY",
      role: "ed",
      now: NOW,
      movementId,
    } as never);
    expect(refused.rejections.length).toBe(1);
    expect(refused.rejections[0]!.reason).toContain("transport is booked");
    expect(
      refused.movements.find((candidate) => candidate.id === movementId)!.stage,
      "a refused handover must leave the stage alone",
    ).toBe("bed_held");
  });

  it("allows the handover once transport IS booked, so the guard is a precondition and not a wall", () => {
    // The other direction, without which "always refuse" would satisfy the test above.
    const { movementId } = heldBedMovement();
    const booked = book();
    const ready = wardFlowReducer(booked, {
      type: "HANDOVER_READY",
      role: "ed",
      now: NOW,
      movementId,
    } as never);
    expect(ready.rejections).toEqual([]);
    expect(ready.movements.find((candidate) => candidate.id === movementId)!.stage).toBe("handover_ready");
    expect(
      ready.movements.find((candidate) => candidate.id === movementId)!.transport!.escortRequired,
      "the booked answer must survive the handover, not be recomputed by it",
    ).toBe(true);
  });

  it("refuses to book twice, because a second job would replace one a provider may have accepted", () => {
    const { movementId } = heldBedMovement();
    const once = book();
    const twice = wardFlowReducer(once, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW,
      movementId,
      provider: TRANSPORT_PROVIDERS[1],
      escortRequired: false,
    } as never);
    expect(twice.rejections.length).toBe(1);
    expect(
      twice.movements.find((candidate) => candidate.id === movementId)!.transport!.provider,
      "the first booking must survive the refused second one",
    ).toBe(TRANSPORT_PROVIDERS[0]);
  });
});
