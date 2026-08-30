import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
 * ⚠️ **THE FABRICATION IS STILL THERE, DELIBERATELY, AND ONE TEST BELOW SAYS SO.** Removing it now
 * would dead-end "Mark handover ready" on a screen this session does not own, before the booking
 * control that replaces it exists. It goes the hour that control lands, and until then the pin
 * below records that the debt is known rather than forgotten.
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

  it("⚠️ RECORDS THAT HANDOVER_READY STILL FABRICATES ONE — a known debt, not a passing state", () => {
    // The derivation is still in `HANDOVER_READY` and this test exists so that fact is written
    // down where it fails rather than remembered. It stays until the booking control lands on the
    // ED screen, because removing it first dead-ends "Mark handover ready" on a screen this
    // session does not own.
    //
    // ⚠️ WHEN THAT LANDS: delete the fabrication, make `HANDOVER_READY` REQUIRE a booked transport,
    // and delete this test. It is deliberately worded so that leaving it green after the removal is
    // impossible — it asserts the defect is present.
    const source = fileURLToPath(new URL("../src/components/ward-management/ward-flow-reducer.ts", import.meta.url));
    const text = readFileSync(source, "utf8");
    expect(
      text.includes('escortRequired: movement.legalStatus !== "Voluntary"'),
      "the fabrication is gone — good. Now make HANDOVER_READY require a booked transport and delete this test.",
    ).toBe(true);
  });
});
