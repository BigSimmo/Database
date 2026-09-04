// tests/ward-movement-step-back-reducer.test.ts
//
// Task 5 of the ward-flow movement step-track plan (2026-09-04), owner rulings E and F: the
// coordinator's own record correction (`STEP_BACK_STAGE`) and the separate "withdraw the
// acceptance" (`WITHDRAW_ACCEPTANCE`). PURE — no DOM, no rendering. The DOM half of Task 5 is
// deferred by Ward Lead's explicit ruling (another session is reading `ward-management-console.tsx`
// for review right now), so this file covers only the model/event/reducer surface: tests 1-23 of
// the build brief. Tests 24-28 (the DOM control) are NOT built here.
//
// Pattern: `seedWardFlowState()` / drive the reducer with real events, per
// `ward-referral-reducer.test.ts` and `ward-movement-stage-changes.test.ts`. Refusals are asserted
// via `after.rejections` (`.reason`, `.attempted`), exactly as those files do.

import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Instant } from "../src/components/ward-management/ward-clock";
import {
  MOVEMENT_STAGES,
  STEP_BACK_REASONS,
  type Movement,
  type MovementStage,
  type Unit,
} from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

function movementIn(state: WardFlowState, id: string): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function unitIn(state: WardFlowState, id: string): Unit {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

function t(offsetMinutes: number): Instant {
  return NOW_ANCHOR + offsetMinutes;
}

/** No new rejection was raised by the step that produced `after` from `before` — mirrors
 *  `ward-movement-stage-changes.test.ts`'s own helper of the same name and purpose. */
function assertStepAccepted(before: WardFlowState, after: WardFlowState, label: string) {
  expect(after.rejections.length, `${label} must not be rejected`).toBe(before.rejections.length);
}

const MOVEMENT_ID = "WF-012";
const UNIT_DECLINED = "rgh-adult-secure";
const UNIT_ACCEPTED = "rph-adult-secure";

/**
 * Drives WF-012 from its seeded `placement_requested` to `accepted_awaiting_bed`, accepted at
 * `UNIT_ACCEPTED` — the same movement/unit pair `ward-movement-stage-changes.test.ts` already
 * proves works, reused here rather than depending on Task 6's fixture state (brief's own
 * instruction for tests 8-9: "drive the events yourself so the test does not depend on Task 6's
 * fixture state").
 */
function buildAcceptedFixture(): WardFlowState {
  const s0 = seedWardFlowState();
  const s1 = wardFlowReducer(s0, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: t(10),
    movementId: MOVEMENT_ID,
    unitIds: [UNIT_DECLINED],
  });
  assertStepAccepted(s0, s1, "REFER_TO_UNITS (first referral)");

  const s2 = wardFlowReducer(s1, {
    type: "DECLINE",
    role: "ward",
    now: t(20),
    movementId: MOVEMENT_ID,
    unitId: UNIT_DECLINED,
    reason: "no_bed",
  });
  assertStepAccepted(s1, s2, "DECLINE");

  const s3 = wardFlowReducer(s2, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: t(30),
    movementId: MOVEMENT_ID,
    unitIds: [UNIT_ACCEPTED],
  });
  assertStepAccepted(s2, s3, "REFER_TO_UNITS (re-referral)");

  const s4 = wardFlowReducer(s3, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    now: t(40),
    movementId: MOVEMENT_ID,
    unitId: UNIT_ACCEPTED,
  });
  assertStepAccepted(s3, s4, "ACCEPT_IN_PRINCIPLE");
  return s4;
}

/** Extends `buildAcceptedFixture` through `PULL_PATIENT`, landing at `pulled` with
 *  `acceptedUnitId` set, `pullExpiresAt` set and `admissionId` set. */
function buildPulledFixture(): WardFlowState {
  const accepted = buildAcceptedFixture();
  const pulled = wardFlowReducer(accepted, {
    type: "PULL_PATIENT",
    role: "ward",
    now: t(50),
    movementId: MOVEMENT_ID,
    unitId: UNIT_ACCEPTED,
  });
  assertStepAccepted(accepted, pulled, "PULL_PATIENT");
  return pulled;
}

/** Extends `buildPulledFixture` through booking, handover and collection, landing at `moving`
 *  with `transport.collectedAt` set and `transport.cancelledAt` still undefined. */
function buildMovingFixture(): WardFlowState {
  const pulled = buildPulledFixture();
  const booked = wardFlowReducer(pulled, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now: t(60),
    movementId: MOVEMENT_ID,
    provider: "Ambulance service",
    escortRequired: true,
  });
  assertStepAccepted(pulled, booked, "BOOK_TRANSPORT");

  const ready = wardFlowReducer(booked, {
    type: "HANDOVER_READY",
    role: "ed",
    now: t(70),
    movementId: MOVEMENT_ID,
  });
  assertStepAccepted(booked, ready, "HANDOVER_READY");

  const acceptedTransport = wardFlowReducer(ready, {
    type: "TRANSPORT_ACCEPTED",
    role: "officer",
    now: t(80),
    movementId: MOVEMENT_ID,
  });
  assertStepAccepted(ready, acceptedTransport, "TRANSPORT_ACCEPTED");

  const enRoute = wardFlowReducer(acceptedTransport, {
    type: "TRANSPORT_EN_ROUTE",
    role: "officer",
    now: t(90),
    movementId: MOVEMENT_ID,
  });
  assertStepAccepted(acceptedTransport, enRoute, "TRANSPORT_EN_ROUTE");

  const collected = wardFlowReducer(enRoute, {
    type: "PATIENT_COLLECTED",
    role: "officer",
    now: t(100),
    movementId: MOVEMENT_ID,
  });
  assertStepAccepted(enRoute, collected, "PATIENT_COLLECTED");
  return collected;
}

describe("STEP_BACK_STAGE — refusals", () => {
  it("refuses an empty/undefined reason (test 1)", () => {
    const built = buildAcceptedFixture();
    const movement = movementIn(built, MOVEMENT_ID);
    expect(movement.stage).toBe("accepted_awaiting_bed");
    const after = wardFlowReducer(built, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(45),
      movementId: movement.id,
      to: "destination_review",
      reason: undefined as never,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("STEP_BACK_REASONS");
  });

  it("refuses a reason not in STEP_BACK_REASONS, naming the list (test 2)", () => {
    const built = buildAcceptedFixture();
    const after = wardFlowReducer(built, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      to: "destination_review",
      reason: "not_a_real_reason" as never,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("STEP_BACK_REASONS");
  });

  it("refuses a ward caller, naming the attempted role (test 3)", () => {
    const built = buildAcceptedFixture();
    const after = wardFlowReducer(built, {
      type: "STEP_BACK_STAGE",
      role: "ward",
      now: t(45),
      movementId: MOVEMENT_ID,
      to: "destination_review",
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("ward");
  });

  it("refuses an ed caller, naming the attempted role (test 3)", () => {
    const built = buildAcceptedFixture();
    const after = wardFlowReducer(built, {
      type: "STEP_BACK_STAGE",
      role: "ed",
      now: t(45),
      movementId: MOVEMENT_ID,
      to: "destination_review",
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("ed");
  });

  it("refuses an officer caller, naming the attempted role (test 3)", () => {
    const built = buildAcceptedFixture();
    const after = wardFlowReducer(built, {
      type: "STEP_BACK_STAGE",
      role: "officer",
      now: t(45),
      movementId: MOVEMENT_ID,
      to: "destination_review",
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("officer");
  });

  it("refuses stepping back a closed movement (test 4)", () => {
    const seeded = seedWardFlowState();
    const closed = movementIn(seeded, "WF-008");
    expect(closed.stage).toBe("accepted_awaiting_bed");
    expect(closed.closure).toBeDefined();
    const after = wardFlowReducer(seeded, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: closed.id,
      to: "placement_requested",
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain(closed.closure!.reason);
  });

  it("refuses a same-stage target (test 5)", () => {
    const built = buildAcceptedFixture();
    const movement = movementIn(built, MOVEMENT_ID);
    expect(movement.stage).toBe("accepted_awaiting_bed");
    const after = wardFlowReducer(built, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      to: "accepted_awaiting_bed",
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("STEP_BACK_STAGE");
  });

  it("refuses a forward target (test 5)", () => {
    const built = buildAcceptedFixture();
    const movement = movementIn(built, MOVEMENT_ID);
    expect(movement.stage).toBe("accepted_awaiting_bed");
    const after = wardFlowReducer(built, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      to: "pulled",
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("STEP_BACK_STAGE");
  });
});

describe("STEP_BACK_STAGE — a successful step-back", () => {
  it("appends exactly one stageChanges entry, from the pre-transition stage (test 6)", () => {
    const built = buildAcceptedFixture();
    const before = movementIn(built, MOVEMENT_ID);
    expect(before.stage).toBe("accepted_awaiting_bed");
    const after = wardFlowReducer(built, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      to: "destination_review",
      reason: "the_decision_changed",
    });
    assertStepAccepted(built, after, "STEP_BACK_STAGE");
    const updated = movementIn(after, MOVEMENT_ID);
    expect(updated.stage).toBe("destination_review");
    expect(updated.stageChanges.length - before.stageChanges.length).toBe(1);
    const entry = updated.stageChanges.at(-1)!;
    expect(entry.from).toBe("accepted_awaiting_bed");
    expect(entry.to).toBe("destination_review");
    expect(entry.by).toBe("coordinator");
    expect(entry.reason).toBe("the_decision_changed");
  });

  it("appends exactly one unwinds entry with kind stage_corrected (test 7)", () => {
    const built = buildAcceptedFixture();
    const before = movementIn(built, MOVEMENT_ID);
    const after = wardFlowReducer(built, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      to: "destination_review",
      reason: "the_decision_changed",
    });
    assertStepAccepted(built, after, "STEP_BACK_STAGE");
    const updated = movementIn(after, MOVEMENT_ID);
    expect(updated.unwinds.length - before.unwinds.length).toBe(1);
    expect(updated.unwinds.at(-1)).toMatchObject({ kind: "stage_corrected", by: "coordinator" });
  });
});

describe("STEP_BACK_STAGE — F3, does not undo what it steps back past", () => {
  it("F3a: stepping back past Accepted does not clear acceptedUnitId (test 8)", () => {
    const pulled = buildPulledFixture();
    const before = movementIn(pulled, MOVEMENT_ID);
    expect(before.stage).toBe("pulled");
    // Anti-vacuity floor: the field really is set before the step-back.
    expect(before.acceptedUnitId).toBeDefined();
    const after = wardFlowReducer(pulled, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(55),
      movementId: MOVEMENT_ID,
      to: "destination_review",
      reason: "the_bed_was_lost",
    });
    assertStepAccepted(pulled, after, "STEP_BACK_STAGE");
    const updated = movementIn(after, MOVEMENT_ID);
    expect(updated.stage).toBe("destination_review");
    expect(updated.acceptedUnitId).toBe(before.acceptedUnitId);
  });

  it("F3b: stepping back past Accepted does not rewrite acceptedAt (test 9)", () => {
    const pulled = buildPulledFixture();
    const before = movementIn(pulled, MOVEMENT_ID);
    expect(before.acceptedAt).toBeDefined();
    const after = wardFlowReducer(pulled, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(55),
      movementId: MOVEMENT_ID,
      to: "destination_review",
      reason: "the_bed_was_lost",
    });
    assertStepAccepted(pulled, after, "STEP_BACK_STAGE");
    const updated = movementIn(after, MOVEMENT_ID);
    expect(updated.acceptedAt).toBe(before.acceptedAt);
  });

  it("does not release the bed (test 10)", () => {
    const pulled = buildPulledFixture();
    const before = movementIn(pulled, MOVEMENT_ID);
    const unitBefore = unitIn(pulled, before.acceptedUnitId!);
    // Anti-vacuity floor: a known, non-zero starting value.
    expect(unitBefore.allocatable.value).toBeGreaterThanOrEqual(0);
    const after = wardFlowReducer(pulled, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(55),
      movementId: MOVEMENT_ID,
      to: "destination_review",
      reason: "the_bed_was_lost",
    });
    assertStepAccepted(pulled, after, "STEP_BACK_STAGE");
    const unitAfter = unitIn(after, before.acceptedUnitId!);
    expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value);
  });

  it("does not touch pullExpiresAt or admissionId (test 11)", () => {
    const pulled = buildPulledFixture();
    const before = movementIn(pulled, MOVEMENT_ID);
    // Anti-vacuity floor: both fields really are set before the step-back.
    expect(before.pullExpiresAt).toBeDefined();
    expect(before.admissionId).toBeDefined();
    const after = wardFlowReducer(pulled, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(55),
      movementId: MOVEMENT_ID,
      to: "destination_review",
      reason: "the_bed_was_lost",
    });
    assertStepAccepted(pulled, after, "STEP_BACK_STAGE");
    const updated = movementIn(after, MOVEMENT_ID);
    expect(updated.pullExpiresAt).toBe(before.pullExpiresAt);
    expect(updated.admissionId).toBe(before.admissionId);
  });

  it("does not cancel transport, stepping back from Moving (test 12)", () => {
    const moving = buildMovingFixture();
    const before = movementIn(moving, MOVEMENT_ID);
    expect(before.stage).toBe("moving");
    // Anti-vacuity floor: collectedAt really is set before the step-back.
    expect(before.transport?.collectedAt).toBeDefined();
    expect(before.transport?.cancelledAt).toBeUndefined();
    const after = wardFlowReducer(moving, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: t(105),
      movementId: MOVEMENT_ID,
      to: "handover_ready",
      reason: "recorded_in_error",
    });
    assertStepAccepted(moving, after, "STEP_BACK_STAGE");
    const updated = movementIn(after, MOVEMENT_ID);
    expect(updated.stage).toBe("handover_ready");
    expect(updated.transport?.collectedAt).toBe(before.transport?.collectedAt);
    expect(updated.transport?.cancelledAt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// Test 13 (regression floor) is deliberately NOT duplicated here. It is
// `tests/ward-movement-stage-changes.test.ts` re-run after this file lands, per the brief: "Not a
// new test: re-run tests/ward-movement-stage-changes.test.ts after Task 5 lands." See this
// build's report for what that re-run actually found — its own derived-case-count assertion is
// `toBeGreaterThanOrEqual(10)`, not a fixed "10", so it does not need editing; its SECOND test
// ("every derived case appends exactly one stageChanges entry") does need a driver added for each
// of the two new cases, and that file is outside this build's owned scope. See the report.
// ---------------------------------------------------------------------------------------------

describe("WITHDRAW_ACCEPTANCE — refusals", () => {
  it("refuses an empty/undefined reason (test 14)", () => {
    const built = buildAcceptedFixture();
    const after = wardFlowReducer(built, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      reason: undefined as never,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("STEP_BACK_REASONS");
  });

  it("refuses a reason not in STEP_BACK_REASONS, naming the list (test 15)", () => {
    const built = buildAcceptedFixture();
    const after = wardFlowReducer(built, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      reason: "not_a_real_reason" as never,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("STEP_BACK_REASONS");
  });

  it("refuses a ward caller, naming the attempted role (test 16)", () => {
    const built = buildAcceptedFixture();
    const after = wardFlowReducer(built, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "ward",
      now: t(45),
      movementId: MOVEMENT_ID,
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("ward");
  });

  it("refuses an ed caller, naming the attempted role (test 16)", () => {
    const built = buildAcceptedFixture();
    const after = wardFlowReducer(built, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "ed",
      now: t(45),
      movementId: MOVEMENT_ID,
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("ed");
  });

  it("refuses an officer caller, naming the attempted role (test 16)", () => {
    const built = buildAcceptedFixture();
    const after = wardFlowReducer(built, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "officer",
      now: t(45),
      movementId: MOVEMENT_ID,
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("officer");
  });

  it("requires movement.stage === accepted_awaiting_bed, refusing a pulled movement (test 17)", () => {
    const pulled = buildPulledFixture();
    const movement = movementIn(pulled, MOVEMENT_ID);
    expect(movement.stage).toBe("pulled");
    const after = wardFlowReducer(pulled, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: t(55),
      movementId: MOVEMENT_ID,
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("pulled");
  });

  it("refuses withdrawing an acceptance for a closed movement (test 18)", () => {
    const seeded = seedWardFlowState();
    const closed = movementIn(seeded, "WF-008");
    expect(closed.stage).toBe("accepted_awaiting_bed");
    expect(closed.closure).toBeDefined();
    const after = wardFlowReducer(seeded, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: closed.id,
      reason: "recorded_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain(closed.closure!.reason);
  });
});

describe("WITHDRAW_ACCEPTANCE — a successful withdrawal", () => {
  it("clears acceptedUnitId (test 19)", () => {
    const built = buildAcceptedFixture();
    const before = movementIn(built, MOVEMENT_ID);
    expect(before.acceptedUnitId).toBeDefined();
    const after = wardFlowReducer(built, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      reason: "recorded_in_error",
    });
    assertStepAccepted(built, after, "WITHDRAW_ACCEPTANCE");
    const updated = movementIn(after, MOVEMENT_ID);
    expect(updated.acceptedUnitId).toBeUndefined();
  });

  it("clears acceptedAt (test 20)", () => {
    const built = buildAcceptedFixture();
    const before = movementIn(built, MOVEMENT_ID);
    expect(before.acceptedAt).toBeDefined();
    const after = wardFlowReducer(built, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      reason: "recorded_in_error",
    });
    assertStepAccepted(built, after, "WITHDRAW_ACCEPTANCE");
    const updated = movementIn(after, MOVEMENT_ID);
    expect(updated.acceptedAt).toBeUndefined();
  });

  it("reverts stage to destination_review and appends stageChanges + unwinds entries carrying the withdrawn unit (test 21)", () => {
    const built = buildAcceptedFixture();
    const before = movementIn(built, MOVEMENT_ID);
    const withdrawnUnitId = before.acceptedUnitId!;
    expect(withdrawnUnitId).toBeDefined();
    const after = wardFlowReducer(built, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      reason: "recorded_in_error",
    });
    assertStepAccepted(built, after, "WITHDRAW_ACCEPTANCE");
    const updated = movementIn(after, MOVEMENT_ID);
    expect(updated.stage).toBe("destination_review");
    expect(updated.stageChanges.length - before.stageChanges.length).toBe(1);
    expect(updated.stageChanges.at(-1)).toMatchObject({
      from: "accepted_awaiting_bed",
      to: "destination_review",
    });
    expect(updated.unwinds.length - before.unwinds.length).toBe(1);
    expect(updated.unwinds.at(-1)).toMatchObject({
      kind: "acceptance_withdrawn",
      unitId: withdrawnUnitId,
    });
  });

  it("does not add the withdrawn unit back to referredUnitIds (test 22)", () => {
    const built = buildAcceptedFixture();
    const before = movementIn(built, MOVEMENT_ID);
    const withdrawnUnitId = before.acceptedUnitId!;
    const after = wardFlowReducer(built, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: t(45),
      movementId: MOVEMENT_ID,
      reason: "recorded_in_error",
    });
    assertStepAccepted(built, after, "WITHDRAW_ACCEPTANCE");
    const updated = movementIn(after, MOVEMENT_ID);
    expect(updated.referredUnitIds).not.toContain(withdrawnUnitId);
    expect(updated.referredUnitIds).toEqual([]);

    /*
     * 🔴 THIS ASSERTION WAS ONE LINE FROM CATCHING A FALSE CLAIM THREE FILES AWAY, AND DID NOT.
     *
     * `ward-movements.ts` carried a comment saying a `destination_review` movement with no live
     * referral AND no decline "is a state `REFER_TO_UNITS`/`DECLINE` never leave a movement in",
     * and the fixture generator remapped that shape on the strength of it. The line above proves
     * half of it false — `referredUnitIds` comes back `[]`. The other half needs a movement that
     * reached acceptance WITHOUT a decline, which this fixture is not (see below).
     *
     * ⚠️ **The claim was not wrong when it was written. It expired the day WITHDRAW_ACCEPTANCE was
     * added — by us, tonight — and nothing warned anybody.** A reachability claim in a comment is a
     * measurement with a shelf life, and the feature that falsifies one is rarely in the same file.
     *
     * The remap survives for a DIFFERENT reason, established by driving rather than by reading:
     * `WITHDRAW_ACCEPTANCE` writes a `stageChanges` entry AND an `unwinds` entry in the same
     * update, and every generated movement carries both empty. So the generated shape — that
     * stage, both lists empty, and no history saying how it got there — really is unreachable.
     * Asserted here so the surviving reason is pinned where the expired one was.
     */
    /*
     * ⚠️ AND MY FIRST VERSION OF THIS ASSERTION WAS WRONG, WHICH IS THE USEFUL PART. I wrote
     * `expect(updated.declines).toEqual([])` on the strength of a driven reproduction somebody
     * else ran from a clean seed. It went RED: `buildAcceptedFixture()` reaches acceptance THROUGH
     * a decline, so this movement carries one. **The falsifying state needs a decline-free path,
     * which this test's fixture is not** — so this test was NOT one line from catching the claim,
     * and saying it was would have been a tidy story rather than a true one.
     *
     * What this test CAN pin is the half that makes the generator's remap survive: the trace.
     */
    expect(updated.declines.length, "this fixture reaches acceptance through a decline").toBeGreaterThan(0);
    expect(updated.stageChanges.length, "the trace that makes the generated shape unreachable").toBeGreaterThan(0);
    expect(updated.unwinds.length, "the other half of that trace").toBeGreaterThan(0);
  });
});

describe("WITHDRAW_ACCEPTANCE — reachability of the 'nothing accepted' refusal (test 23)", () => {
  /**
   * ⚠️ **UNREACHABLE ON TODAY'S REDUCER, per the brief's own warning.** Every path into
   * `accepted_awaiting_bed` either sets `acceptedUnitId` (`ACCEPT_IN_PRINCIPLE`) or leaves an
   * existing one untouched (`RELEASE_PULL`, and this build's own `STEP_BACK_STAGE` stepping back
   * into it — F3 above proves the latter directly). There is no dispatchable path that produces
   * `stage === "accepted_awaiting_bed"` with `acceptedUnitId` unset, so a dedicated refusal test
   * for it would have to hand-cast an illegal `Movement`, which the brief explicitly says proves
   * nothing about what the reducer can produce. Reported rather than silently skipped, with the
   * floor below in its place.
   */
  it("floor: driving ACCEPT_IN_PRINCIPLE DOES produce a movement with acceptedUnitId set — proving the reachability check above is not itself broken", () => {
    const built = buildAcceptedFixture();
    const movement = movementIn(built, MOVEMENT_ID);
    expect(movement.stage).toBe("accepted_awaiting_bed");
    expect(movement.acceptedUnitId).toBeDefined();
  });
});

// ---------------------------------------------------------------------------------------------
// Sanity check on MOVEMENT_STAGES / STEP_BACK_REASONS themselves, so a future reordering of
// either array is caught here rather than only as a mysterious failure above.
// ---------------------------------------------------------------------------------------------

describe("fixtures this file depends on", () => {
  it("MOVEMENT_STAGES lists destination_review strictly before accepted_awaiting_bed, before pulled, before moving", () => {
    const destinationReviewIndex = MOVEMENT_STAGES.indexOf("destination_review" as MovementStage);
    const acceptedIndex = MOVEMENT_STAGES.indexOf("accepted_awaiting_bed" as MovementStage);
    const pulledIndex = MOVEMENT_STAGES.indexOf("pulled" as MovementStage);
    const movingIndex = MOVEMENT_STAGES.indexOf("moving" as MovementStage);
    expect(destinationReviewIndex).toBeLessThan(acceptedIndex);
    expect(acceptedIndex).toBeLessThan(pulledIndex);
    expect(pulledIndex).toBeLessThan(movingIndex);
  });

  it("STEP_BACK_REASONS holds exactly the four reasons this file dispatches", () => {
    expect(STEP_BACK_REASONS).toEqual([
      "recorded_in_error",
      "the_decision_changed",
      "the_patient_situation_changed",
      "the_bed_was_lost",
    ]);
  });
});
