// tests/ward-governance.test.ts
import { describe, expect, it } from "vitest";

import { changeReasonLabels } from "../src/components/ward-management/ward-change-reasons";
import { changeAudit, effectivenessNumbers } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

// A real, valid, open fixture movement to spread from when a test needs its own movement list —
// same approach as tests/ward-derivations.test.ts's `movementFrom`. Object.assign rather than
// spread, because `{ ...base, ...Partial<T> }` widens every overridden field back to optional
// under TypeScript's spread-merge rules even though every field is present at runtime.
const baseMovement = wardMovements.find((movement) => movement.id === "WF-002");
if (!baseMovement) throw new Error("Fixture movement WF-002 is required as a template for ward-governance tests");

function movementFrom(overrides: Partial<Movement>): Movement {
  return Object.assign({}, baseMovement, overrides);
}

describe("changeAudit", () => {
  it("returns an empty list when no movement carries any recorded change", () => {
    const movements = [
      movementFrom({ id: "WF-EMPTY-A", statusChanges: [], urgencyChanges: [], unwinds: [] }),
      movementFrom({ id: "WF-EMPTY-B", statusChanges: [], urgencyChanges: [], unwinds: [] }),
    ];
    expect(changeAudit(movements)).toEqual([]);
  });

  // Task 9's own "measured fixture facts": exactly one movement (WF-010) carries a
  // hand-authored statusChanges entry, and no movement carries a hand-authored urgencyChanges
  // or unwinds entry. This proves the real fixture surfaces that one entry, labelled, not the
  // raw `recorded_by_treating_team` reason code.
  it("finds the real fixture's one hand-authored legal status change (WF-010), labelled rather than as a raw reason code", () => {
    const { movements } = seedWardFlowState();
    const audit = changeAudit(movements);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      at: NOW_ANCHOR - 40,
      movementId: "WF-010",
      kind: "legal_status",
      by: "Duty psychiatrist",
    });
    expect(audit[0].detail).toBe("Voluntary → Detained awaiting examination · Recorded by treating team");
    expect(audit[0].detail).not.toMatch(/recorded_by_treating_team/);
  });

  it("labels a hold-released reason, never the raw snake_case value", () => {
    const seeded = seedWardFlowState();
    const heldTarget = seeded.movements.find((movement) => movement.stage === "bed_held");
    if (!heldTarget) throw new Error("fixture requires a bed_held movement");
    const after = wardFlowReducer(seeded, {
      type: "RELEASE_HOLD",
      role: "coordinator",
      now: 300,
      movementId: heldTarget.id,
      reason: "bed_needed_for_another_patient",
    });
    expect(after.rejections).toHaveLength(0);
    const entries = changeAudit(after.movements).filter((entry) => entry.kind === "hold_released");
    expect(entries).toHaveLength(1);
    expect(entries[0].detail).toBe(changeReasonLabels.bed_needed_for_another_patient);
    expect(entries[0].detail).toBe("Bed needed elsewhere");
    expect(entries[0].detail).not.toMatch(/bed_needed_for_another_patient/);
  });

  // Ordered-pair assertion by design (per the brief's own rule): each row asserts `at`, `kind`
  // AND `movementId` together as one tuple, so a mutation that sorts correctly but attaches the
  // wrong kind or the wrong movement id to an entry is still caught — two independent
  // per-field checks would not catch a swap between two entries that share neither field.
  it("collects urgency, legal status, hold-released and transport-cancelled entries across movements, newest first", () => {
    const seeded = seedWardFlowState();
    const urgencyTarget = seeded.movements.find((movement) => !movement.closure && movement.urgency !== 1);
    if (!urgencyTarget) throw new Error("fixture requires an open movement with urgency !== 1");
    const legalTarget = seeded.movements.find((movement) => !movement.closure && movement.id !== urgencyTarget.id);
    if (!legalTarget) throw new Error("fixture requires a second open movement");
    const heldTarget = seeded.movements.find((movement) => movement.stage === "bed_held");
    if (!heldTarget) throw new Error("fixture requires a bed_held movement");
    const transportTarget = seeded.movements.find(
      (movement) =>
        movement.transport !== undefined &&
        movement.transport.cancelledAt === undefined &&
        movement.transport.arrivedAt === undefined,
    );
    if (!transportTarget) throw new Error("fixture requires a movement with a live transport job");

    let state = seeded;
    state = wardFlowReducer(state, {
      type: "CHANGE_URGENCY",
      role: "coordinator",
      now: 100,
      movementId: urgencyTarget.id,
      urgency: 1,
      reason: "reassessed",
    });
    state = wardFlowReducer(state, {
      type: "CHANGE_LEGAL_STATUS",
      role: "ed",
      now: 400,
      movementId: legalTarget.id,
      legalStatus: "Involuntary inpatient",
      reason: "correcting_an_error",
    });
    state = wardFlowReducer(state, {
      type: "RELEASE_HOLD",
      role: "coordinator",
      now: 250,
      movementId: heldTarget.id,
      reason: "hold_made_in_error",
    });
    state = wardFlowReducer(state, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: 550,
      movementId: transportTarget.id,
      reason: "provider_unavailable",
    });
    expect(state.rejections).toHaveLength(0);

    const audit = changeAudit(state.movements);
    // 4 dispatched entries plus the fixture's own WF-010 legal_status entry at NOW_ANCHOR - 40
    // (602), which every seeded state carries regardless of what this test dispatches.
    expect(audit).toHaveLength(5);
    expect(audit.map((entry) => [entry.at, entry.kind, entry.movementId])).toEqual([
      [NOW_ANCHOR - 40, "legal_status", "WF-010"],
      [550, "transport_cancelled", transportTarget.id],
      [400, "legal_status", legalTarget.id],
      [250, "hold_released", heldTarget.id],
      [100, "urgency", urgencyTarget.id],
    ]);
  });
});

describe("effectivenessNumbers", () => {
  // The single easiest thing to get wrong here (per the brief): a measure this cannot compute
  // must return `undefined`, never `0` — a `0` would read as an instantaneous acceptance, the
  // opposite of "unknown". This movement set genuinely cannot support either measure: neither
  // movement has ever referred a unit, so there is nothing to average, and neither has an
  // acceptance instant to measure a duration against.
  it("returns undefined for both measures against a movement set where neither can genuinely be computed", () => {
    const movements = [
      movementFrom({
        id: "WF-NR-1",
        referredUnitIds: [],
        declines: [],
        withdrawnReferrals: [],
        acceptedUnitId: undefined,
      }),
      movementFrom({
        id: "WF-NR-2",
        referredUnitIds: [],
        declines: [],
        withdrawnReferrals: [],
        acceptedUnitId: undefined,
      }),
    ];
    const result = effectivenessNumbers(movements);
    expect(result.medianMinutesToAcceptance).toBeUndefined();
    expect(result.averageUnitsContacted).toBeUndefined();
    // Guard against a regression that substitutes 0 for undefined — the literal failure mode
    // rule 4 exists to prevent.
    expect(result.medianMinutesToAcceptance).not.toBe(0);
    expect(result.averageUnitsContacted).not.toBe(0);
  });

  it("computes the median acceptance duration only over movements with a recoverable acceptance instant", () => {
    const computableFast = movementFrom({
      id: "WF-ACC-1",
      openedAt: 100,
      acceptedUnitId: "unit-a",
      referredUnitIds: [],
      declines: [],
      withdrawnReferrals: [{ unitId: "unit-b", at: 140, reason: "withdrawn — placed at Unit A" }],
    });
    const computableSlow = movementFrom({
      id: "WF-ACC-2",
      openedAt: 200,
      acceptedUnitId: "unit-c",
      referredUnitIds: [],
      declines: [],
      withdrawnReferrals: [{ unitId: "unit-d", at: 260, reason: "withdrawn — placed at Unit C" }],
    });
    // Reached acceptance (acceptedUnitId is set) but was the only unit ever referred, so
    // ACCEPT_IN_PRINCIPLE withdrew nothing and left no timestamp anywhere in this model. This
    // movement must contribute nothing to the median — neither a fabricated 0 nor a NaN — and
    // must not turn the whole measure undefined either, since the other two ARE computable.
    const uncomputable = movementFrom({
      id: "WF-ACC-3",
      openedAt: 300,
      acceptedUnitId: "unit-e",
      referredUnitIds: [],
      declines: [],
      withdrawnReferrals: [],
    });
    const result = effectivenessNumbers([computableFast, computableSlow, uncomputable]);
    // Durations: 140-100=40 and 260-200=60 minutes -> median (40+60)/2 = 50.
    expect(result.medianMinutesToAcceptance).toBe(50);
  });

  it("averages units contacted only over movements with at least one referral, counting each unit once", () => {
    const noReferral = movementFrom({
      id: "WF-UC-0",
      referredUnitIds: [],
      declines: [],
      withdrawnReferrals: [],
      acceptedUnitId: undefined,
    });
    const oneUnit = movementFrom({
      id: "WF-UC-1",
      referredUnitIds: ["unit-a"],
      declines: [],
      withdrawnReferrals: [],
      acceptedUnitId: undefined,
    });
    const threeUnits = movementFrom({
      id: "WF-UC-2",
      referredUnitIds: [],
      declines: [{ unitId: "unit-b", at: 10, reason: "no_bed" }],
      withdrawnReferrals: [{ unitId: "unit-c", at: 20, reason: "withdrawn — placed at Unit D" }],
      acceptedUnitId: "unit-d",
    });
    const result = effectivenessNumbers([noReferral, oneUnit, threeUnits]);
    // (1 + 3) / 2 = 2 — the zero-referral movement is excluded from the denominator entirely
    // rather than counted as a 0-contact patient, which would silently pull the average down.
    expect(result.averageUnitsContacted).toBe(2);
  });

  it("counts a unit once even when it appears in more than one contact category", () => {
    const movement = movementFrom({
      id: "WF-UC-DEDUP",
      referredUnitIds: ["unit-x"],
      declines: [{ unitId: "unit-x", at: 10, reason: "no_bed" }],
      withdrawnReferrals: [],
      acceptedUnitId: undefined,
    });
    const result = effectivenessNumbers([movement]);
    expect(result.averageUnitsContacted).toBe(1);
  });
});
