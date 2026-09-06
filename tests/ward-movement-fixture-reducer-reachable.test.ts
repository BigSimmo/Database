// tests/ward-movement-fixture-reducer-reachable.test.ts
//
// Task 6 of the ward-flow movement step-track plan (2026-09-04), sweep R64: is the AUTHORED
// fixture (`wardMovements`) a state the reducer could actually produce? PURE — no DOM, no
// rendering. Imports `wardMovements` directly, never a driven one, except where named (the
// cross-task consistency rule below, which needs both a static check and a driven counter-case).

import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { wardAdmissions } from "../src/components/ward-management/ward-admissions-seed";
import { MOVEMENT_STAGES, type Movement, type MovementStage } from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

function byStage(stage: MovementStage): Movement[] {
  return wardMovements.filter((movement) => movement.stage === stage);
}

// ---------------------------------------------------------------------------------------------
// Test 35 — counting discipline, proven against a known non-zero count before it is trusted
// anywhere else. `String.raw` on purpose: a template literal or `new RegExp("...\\d...")` here
// would silently drop the escape and match nothing, which reads exactly like "no generated
// records found" — the false-zero class of bug this project has already hit three times.
// ---------------------------------------------------------------------------------------------

const GENERATED_ID_PATTERN = new RegExp(String.raw`^WF-3\d\d$`);

function isGeneratedId(id: string): boolean {
  return GENERATED_ID_PATTERN.test(id);
}

describe("counting discipline — the generated-id matcher, proven before it is trusted (test 35)", () => {
  it("matches exactly the 30 generated ids WF-300 through WF-329, a known non-zero count", () => {
    const generated = wardMovements.filter((movement) => isGeneratedId(movement.id));
    expect(
      generated.map((movement) => movement.id).sort(),
      "the generated-id matcher must find exactly WF-300..WF-329",
    ).toEqual(Array.from({ length: 30 }, (_, index) => `WF-${300 + index}`));
  });

  it("does not match any hand-authored WF-0xx id", () => {
    const handAuthored = wardMovements.filter((movement) => !isGeneratedId(movement.id));
    for (const movement of handAuthored) {
      expect(isGeneratedId(movement.id), `${movement.id} should not match the generated-id pattern`).toBe(false);
    }
    expect(handAuthored.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Test 29 — destination_review: a non-empty referredUnitIds OR a non-empty declines.
// ---------------------------------------------------------------------------------------------

describe("destination_review is reducer-reachable — a live referral OR a decline (test 29)", () => {
  const atDestinationReview = byStage("destination_review");

  it("floor: exactly 5 movements sit at destination_review post-sweep", () => {
    expect(
      atDestinationReview.length,
      `expected exactly 5 movements at destination_review, found ${atDestinationReview.length}: ` +
        `${atDestinationReview.map((movement) => movement.id).join(", ") || "(none)"}`,
    ).toBe(5);
  });

  it("every one of them carries a live referral, a decline, or both — named by id on failure", () => {
    for (const movement of atDestinationReview) {
      const hasReferral = movement.referredUnitIds.length > 0;
      const hasDecline = movement.declines.length > 0;
      expect(
        hasReferral || hasDecline,
        `${movement.id} is at destination_review with an empty referredUnitIds AND an empty ` +
          `declines — a state REFER_TO_UNITS/DECLINE never leave a movement in`,
      ).toBe(true);
    }
  });

  it("WF-009's every-ward-declined state is recognised as reducer-reachable under the real (OR) criterion", () => {
    const wf009 = wardMovements.find((movement) => movement.id === "WF-009")!;
    expect(wf009).toBeDefined();
    expect(wf009.stage).toBe("destination_review");
    expect(wf009.referredUnitIds).toEqual([]);
    expect(wf009.declines.length).toBeGreaterThan(0);
    const validUnderRealCriterion = wf009.referredUnitIds.length > 0 || wf009.declines.length > 0;
    expect(validUnderRealCriterion, "WF-009 must be valid under the OR criterion").toBe(true);
  });

  it("proves the OR criterion is load-bearing: the narrowed AND-only (referredUnitIds alone) criterion would wrongly flag WF-009", () => {
    const wf009 = wardMovements.find((movement) => movement.id === "WF-009")!;
    // The plan's own named trap: dropping the declines half and checking referredUnitIds.length > 0
    // alone.
    const narrowedCriterion = wf009.referredUnitIds.length > 0;
    expect(
      narrowedCriterion,
      "the narrowed (referredUnitIds-only) criterion must be false for WF-009 — proving the real " +
        "criterion needs the declines half, not merely including it for style",
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Test 30 — pulled: admissionId set, resolving to a real wardAdmissions record with state "pulled".
//
// ⚠️ NOT YET BUILT. Sweep R64's defect 5b (7 records: 4 generated + WF-004/WF-011/WF-016) needs a
// matching `Admission` record added to `wardAdmissions` in `ward-admissions-seed.ts`, mirroring
// `PULL_PATIENT`'s own construction in the reducer. `ward-admissions-seed.ts` is outside this
// build's assigned file-ownership list (`ward-model.ts`, `ward-flow-events.ts`,
// `ward-flow-reducer.ts`, `ward-movements.ts`, and the two new test files) and, unlike the three
// compile-breaking files Ward Lead explicitly widened this build's scope to cover, this is a
// FUNCTIONAL gap rather than a `tsc` failure — flagged rather than silently worked around, per
// this whole task's own "flag, do not silently patch" instruction. `it.fails` below runs this
// test for real, to the brief's full specification, and records it as an EXPECTED failure rather
// than hiding it as a skip or weakening the assertion to pass — the moment `ward-admissions-seed.ts`
// gains the 7 records, this starts reporting an unexpected pass, which is the signal to flip it to
// a plain `it`. See this build's report for the exact fix (record shape, ids, `wardAdmissions`
// composition) already worked out and ready to apply.
// ---------------------------------------------------------------------------------------------

describe("pulled is reducer-reachable — admissionId resolving to a real, matching admission (test 30)", () => {
  const atPulled = byStage("pulled");

  it("floor: exactly 7 movements sit at pulled", () => {
    expect(
      atPulled.length,
      `expected exactly 7 movements at pulled, found ${atPulled.length}: ` +
        `${atPulled.map((movement) => movement.id).join(", ") || "(none)"}`,
    ).toBe(7);
  });

  it.fails(
    "every one of them carries an admissionId resolving to a wardAdmissions record with state pulled — NOT YET TRUE, see the describe block's own comment (5b unimplemented, ward-admissions-seed.ts out of this build's scope)",
    () => {
      for (const movement of atPulled) {
        expect(movement.admissionId, `${movement.id} is at pulled with no admissionId set`).toBeDefined();
        const admission = wardAdmissions.find((candidate) => candidate.id === movement.admissionId);
        expect(
          admission,
          `${movement.id}'s admissionId ${movement.admissionId} does not resolve to any record in wardAdmissions`,
        ).toBeDefined();
        expect(
          admission?.state,
          `${movement.id}'s admission ${movement.admissionId} does not carry state "pulled"`,
        ).toBe("pulled");
      }
    },
  );
});

// ---------------------------------------------------------------------------------------------
// Test 31 — handover_ready: transport set (protects the already-shipped R64 fix from regressing).
// ---------------------------------------------------------------------------------------------

describe("handover_ready is reducer-reachable — transport set (test 31)", () => {
  const atHandoverReady = byStage("handover_ready");

  it("floor: exactly 2 movements sit at handover_ready", () => {
    expect(atHandoverReady.length, `found: ${atHandoverReady.map((movement) => movement.id).join(", ")}`).toBe(2);
  });

  it("every one of them carries a transport job", () => {
    for (const movement of atHandoverReady) {
      expect(movement.transport, `${movement.id} is at handover_ready with no transport job`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Test 32 — moving: transport.collectedAt set.
// ---------------------------------------------------------------------------------------------

describe("moving is reducer-reachable — transport.collectedAt set (test 32)", () => {
  const atMoving = byStage("moving");

  it("floor: exactly 6 movements sit at moving", () => {
    expect(atMoving.length, `found: ${atMoving.map((movement) => movement.id).join(", ")}`).toBe(6);
  });

  it("every one of them carries transport.collectedAt", () => {
    for (const movement of atMoving) {
      expect(movement.transport, `${movement.id} is at moving with no transport job at all`).toBeDefined();
      expect(movement.transport?.collectedAt, `${movement.id} is at moving with no collectedAt`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// A THIRD instance of sweep R64's own defect class, found while building this file and reported
// by Ward Lead before the fixture was repaired: `PATIENT_ARRIVED` refuses outright unless
// `movement.stage === "moving" && movement.transport?.collectedAt` (`ward-flow-reducer.ts`), but
// `stageFields`'s `case "arrived"` (`ward-movements.ts`) returned `acceptedUnitId` and `closure`
// only — no `transport` at all. Its neighbour `case "moving"`, three lines above it, already
// carries the comment explaining exactly why a transport-less record at that stage is dishonest;
// `arrived` has the identical shape and did not get the same treatment. The SAME class the
// `handover_ready` remap above this one already fixed once, applied to the instance that prompted
// it rather than to the class.
//
// ⚠️ NOT a remap, per Ward Lead's ruling: `arrived` genuinely implies a completed transport job —
// the reducer will not produce this stage without one — so adding one is stating what the stage
// already means, not inventing a fact the stage does not imply (contrast the `handover_ready` and
// `destination_review` remaps above, where the stage did NOT imply the missing fields).
//
// This describe block is written to be provably load-bearing: it is asserted RED against the
// unrepaired generator first (see this build's report for that run's exact output), then the
// fixture is repaired, then it is proven green here.
// ---------------------------------------------------------------------------------------------

describe("arrived is reducer-reachable — transport.collectedAt set (found during this build, Ward Lead 2026-09-04)", () => {
  const atArrived = byStage("arrived");

  it("floor: exactly 6 movements sit at arrived — the population WALKED, not the violation count (Ward Lead's own anti-vacuity instruction: a violation floor would fail exactly when the repair succeeds)", () => {
    expect(
      atArrived.length,
      `expected exactly 6 movements at arrived, found ${atArrived.length}: ` +
        `${atArrived.map((movement) => movement.id).join(", ") || "(none)"}`,
    ).toBe(6);
  });

  it("every one of them carries transport.collectedAt, named by id on failure — covers hand-authored AND generated records, not only the five Ward Lead named", () => {
    const missing = atArrived.filter((movement) => movement.transport?.collectedAt === undefined);
    expect(
      missing.map((movement) => movement.id),
      "the following movements are at arrived with no transport.collectedAt — a state PATIENT_ARRIVED " +
        "could never have produced (it refuses outright unless stage is moving AND transport.collectedAt is set)",
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Test 33 — accepted_awaiting_bed: acceptedUnitId set, including closed WF-008.
// ---------------------------------------------------------------------------------------------

describe("accepted_awaiting_bed is reducer-reachable — acceptedUnitId set (test 33)", () => {
  const atAccepted = byStage("accepted_awaiting_bed");

  it("floor: exactly 6 movements sit at accepted_awaiting_bed", () => {
    expect(atAccepted.length, `found: ${atAccepted.map((movement) => movement.id).join(", ")}`).toBe(6);
  });

  it("every one of them carries an acceptedUnitId, including closed WF-008", () => {
    const wf008 = atAccepted.find((movement) => movement.id === "WF-008");
    expect(wf008, "WF-008 must be included in this stage's population").toBeDefined();
    expect(wf008?.closure, "WF-008 must be closed").toBeDefined();
    for (const movement of atAccepted) {
      expect(
        movement.acceptedUnitId,
        `${movement.id} is at accepted_awaiting_bed with no acceptedUnitId`,
      ).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Test 34 — the full per-stage distribution, one assertion covering all seven stages plus total.
// ---------------------------------------------------------------------------------------------

describe("the full per-stage distribution matches the plan's post-sweep table (test 34)", () => {
  it("counts exactly 18/5/6/7/2/6/6 across the seven stages, totalling 50", () => {
    const distribution: Record<MovementStage, number> = {
      placement_requested: 0,
      destination_review: 0,
      accepted_awaiting_bed: 0,
      pulled: 0,
      handover_ready: 0,
      moving: 0,
      arrived: 0,
    };
    for (const movement of wardMovements) {
      distribution[movement.stage] += 1;
    }
    expect(distribution).toEqual({
      placement_requested: 18,
      destination_review: 5,
      accepted_awaiting_bed: 6,
      pulled: 7,
      handover_ready: 2,
      moving: 6,
      arrived: 6,
    });
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(50);
    expect(wardMovements).toHaveLength(50);
  });
});

// ---------------------------------------------------------------------------------------------
// Cross-task risk, resolved per ward lead ruling 5 of 2026-09-04: `acceptedUnitId` present at
// `destination_review` is VALID when `stageChanges` records a backwards transition into that
// stage, and INVALID when it does not — decidable from the record, which is what the record is
// for. Task 6 must not flag a stepped-back movement (F3's own, deliberate output) as an
// inconsistency; it must flag one carrying `acceptedUnitId` at `destination_review` with no such
// backward-transition record.
// ---------------------------------------------------------------------------------------------

/**
 * Local to this test file, matching the pattern `tests/ward-movement-stage-changes.test.ts`
 * already sets for a small pure predicate proven by a test rather than wired into a renderer.
 * TRUE (silent, no inconsistency) when `movement.acceptedUnitId` is unset, or when it is set and
 * `stageChanges` records a transition INTO `destination_review` from a LATER stage (a step-back).
 * FALSE (flag it) when `acceptedUnitId` is set at `destination_review` with no such record.
 */
function acceptedUnitIdAtDestinationReviewIsExplained(movement: Movement): boolean {
  if (movement.stage !== "destination_review") return true;
  if (movement.acceptedUnitId === undefined) return true;
  const destinationReviewIndex = MOVEMENT_STAGES.indexOf("destination_review");
  return movement.stageChanges.some((entry) => {
    if (entry.to !== "destination_review" || entry.from === undefined) return false;
    return MOVEMENT_STAGES.indexOf(entry.from) > destinationReviewIndex;
  });
}

const MOVEMENT_ID = "WF-012";
const UNIT_ACCEPTED = "rph-adult-secure";

function buildSteppedBackMovement(): Movement {
  const s0 = seedWardFlowState();
  const s1 = wardFlowReducer(s0, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: NOW_ANCHOR + 10,
    movementId: MOVEMENT_ID,
    unitIds: [UNIT_ACCEPTED],
  });
  expect(s1.rejections.length, "REFER_TO_UNITS must not be rejected").toBe(s0.rejections.length);
  const s2 = wardFlowReducer(s1, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    now: NOW_ANCHOR + 20,
    movementId: MOVEMENT_ID,
    unitId: UNIT_ACCEPTED,
  });
  expect(s2.rejections.length, "ACCEPT_IN_PRINCIPLE must not be rejected").toBe(s1.rejections.length);
  const s3 = wardFlowReducer(s2, {
    type: "STEP_BACK_STAGE",
    role: "coordinator",
    now: NOW_ANCHOR + 30,
    movementId: MOVEMENT_ID,
    to: "destination_review",
    reason: "the_decision_changed",
  });
  expect(s3.rejections.length, "STEP_BACK_STAGE must not be rejected").toBe(s2.rejections.length);
  const movement = s3.movements.find((candidate) => candidate.id === MOVEMENT_ID);
  if (!movement) throw new Error(`state is missing movement ${MOVEMENT_ID}`);
  // Floor, per the brief's own instruction for this cross-task risk section: proves the
  // derivation actually ran the reducer rather than returning the seed unchanged.
  expect(movement.stageChanges.length).toBeGreaterThanOrEqual(2);
  expect(movement.stageChanges.at(-1)?.from).toBeDefined();
  return movement;
}

describe("cross-task risk: acceptedUnitId at destination_review, explained by stageChanges (ward lead ruling 5)", () => {
  it("the static fixture carries no movement failing the rule (none carries acceptedUnitId at destination_review at all today)", () => {
    const atDestinationReview = byStage("destination_review");
    for (const movement of atDestinationReview) {
      expect(
        acceptedUnitIdAtDestinationReviewIsExplained(movement),
        `${movement.id} is at destination_review with acceptedUnitId set and no backward-transition record`,
      ).toBe(true);
      // Stated directly too, since the rule above is vacuously true for every movement in the
      // static fixture that has no acceptedUnitId at all — this is the anti-vacuity floor for
      // THIS assertion, not a repeat of test 29's own floor.
    }
  });

  it("stays SILENT on a movement stepped back by the reducer — F3's own, legitimate output — built by driving the reducer, UNREACHABLE on today's static fixture", () => {
    const steppedBack = buildSteppedBackMovement();
    expect(steppedBack.stage).toBe("destination_review");
    expect(steppedBack.acceptedUnitId, "a stepped-back movement still carries its acceptedUnitId (F3)").toBeDefined();
    expect(
      acceptedUnitIdAtDestinationReviewIsExplained(steppedBack),
      `${steppedBack.id} was legitimately stepped back and must NOT be flagged`,
    ).toBe(true);
  });

  it("flags RED, naming the movement, a fixture carrying acceptedUnitId at destination_review with NO backward-transition record", () => {
    const steppedBack = buildSteppedBackMovement();
    // Same shape (acceptedUnitId set, stage destination_review) but with the stageChanges history
    // erased — exactly what a fixture record authored by hand rather than produced by the reducer
    // would look like: the fact without the explanation for it.
    const unexplained: Movement = { ...steppedBack, stageChanges: [] };
    expect(
      acceptedUnitIdAtDestinationReviewIsExplained(unexplained),
      `${unexplained.id} carries acceptedUnitId at destination_review with no backward-transition ` +
        `record and must be flagged`,
    ).toBe(false);
  });
});
