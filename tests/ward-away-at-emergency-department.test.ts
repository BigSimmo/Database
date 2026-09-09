import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "../src/components/ward-management/ward-admissions";
import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded(): WardFlowState {
  return seedWardFlowState();
}

function admission(state: WardFlowState, id: string) {
  const found = state.admissions.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing admission ${id}`);
  return found;
}

function unit(state: WardFlowState, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

/**
 * Somebody actually in a bed and NOT already away, chosen FROM state rather than hard-coded — the
 * same discipline `tests/ward-record-leaving.test.ts` uses, so a seed change cannot silently make
 * every test below exercise a different case than the one it names.
 */
function anOccupantOnTheWard(state: WardFlowState) {
  const found = state.admissions.find(
    (candidate) => candidate.state === "occupied" && candidate.awayAtEmergencyDepartmentSince === null,
  );
  if (!found) throw new Error("the seed contains nobody occupying a bed who is on the ward");
  return found;
}

/** Somebody the SEED already marks as away — the rows that could never be cleared before this. */
function aSeededAwayOccupant(state: WardFlowState) {
  const found = state.admissions.find((candidate) => candidate.awayAtEmergencyDepartmentSince !== null);
  if (!found) throw new Error("the seed marks nobody as away at an emergency department");
  return found;
}

describe("recording that a patient is away at an emergency department, and back", () => {
  /*
   * WHY THIS FILE EXISTS. `Admission.awayAtEmergencyDepartmentSince` shipped on 2026-08-30 with a
   * renderer, a seed and NO EVENT AT EITHER END: nothing could set it and — the worse half —
   * nothing could clear it. The ward board renders "At an emergency department for N hours — the
   * bed is still theirs" from `now - awayAtEmergencyDepartmentSince`, so the seeded rows counted
   * upward without bound as the demo clock advanced, and every occupant WITHOUT the badge read as
   * physically in their bed.
   *
   * Nothing was red. A field nobody writes is indistinguishable from a field nobody added, so no
   * typecheck and no test could see it.
   */

  it("records the instant the person left the ward", () => {
    const state = seeded();
    const person = anOccupantOnTheWard(state);

    const next = wardFlowReducer(state, {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });

    expect(next.rejections).toHaveLength(0);
    expect(admission(next, person.id).awayAtEmergencyDepartmentSince).toBe(NOW);
  });

  it("clears it again on return, which is the half that did not exist", () => {
    const state = seeded();
    const person = anOccupantOnTheWard(state);

    const away = wardFlowReducer(state, {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });
    const back = wardFlowReducer(away, {
      type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW + 240,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });

    expect(back.rejections).toHaveLength(0);
    expect(admission(back, person.id).awayAtEmergencyDepartmentSince).toBeNull();
  });

  it("can clear a row the SEED marked away, which is the one that grew without bound", () => {
    const state = seeded();
    const person = aSeededAwayOccupant(state);
    expect(person.awayAtEmergencyDepartmentSince).not.toBeNull();

    const back = wardFlowReducer(state, {
      type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });

    expect(back.rejections).toHaveLength(0);
    expect(admission(back, person.id).awayAtEmergencyDepartmentSince).toBeNull();
  });

  /**
   * ⚠️ THE PROPERTY THIS WHOLE FEATURE IS CONSTRAINED BY. The ward is holding the bed because the
   * person is coming back, so a trip to an emergency department must move NO capacity figure in
   * either direction. Asserted on the real derivation a coordinator reads, not on the raw fields:
   * a change that freed the bed through `unitCapacity` while leaving `Unit.empty` alone would pass
   * a fields-only check and still offer a coordinator a bed that is taken.
   */
  it("moves no capacity figure, in either direction", () => {
    const state = seeded();
    const person = anOccupantOnTheWard(state);
    const before = unitCapacity(unit(state, person.unitId), state.bedReleases);

    const away = wardFlowReducer(state, {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });

    expect(away.rejections).toHaveLength(0);
    expect(unitCapacity(unit(away, person.unitId), away.bedReleases)).toEqual(before);
    // The person is still counted as occupying their bed while they are away. This is the field's
    // own ruling and the reason it is not an `AdmissionState`.
    expect(bedIsOccupied(admission(away, person.id))).toBe(true);
    // And nothing on the unit itself moved either — stated separately from the derivation above so
    // a future `unitCapacity` that stopped reading `empty` could not hide a change here.
    expect(unit(away, person.unitId)).toEqual(unit(state, person.unitId));

    const back = wardFlowReducer(away, {
      type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW + 300,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });
    expect(back.rejections).toHaveLength(0);
    expect(unitCapacity(unit(back, person.unitId), back.bedReleases)).toEqual(before);
    expect(unit(back, person.unitId)).toEqual(unit(state, person.unitId));
  });

  it("refuses a second departure, which would shorten a trip already under way", () => {
    const state = seeded();
    const person = anOccupantOnTheWard(state);

    const away = wardFlowReducer(state, {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });
    const again = wardFlowReducer(away, {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW + 360,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });

    expect(again.rejections).toHaveLength(1);
    expect(again.rejections[0]?.reason).toContain("already recorded as away");
    // The original instant survives the refusal — the six hours are not quietly reset to zero.
    expect(admission(again, person.id).awayAtEmergencyDepartmentSince).toBe(NOW);
  });

  it("refuses a return for somebody who was never away, rather than reporting a no-op as success", () => {
    const state = seeded();
    const person = anOccupantOnTheWard(state);

    const back = wardFlowReducer(state, {
      type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });

    expect(back.rejections).toHaveLength(1);
    expect(back.rejections[0]?.reason).toContain("not recorded as away");
  });

  it("refuses a ward acting on another ward's patient", () => {
    const state = seeded();
    const person = anOccupantOnTheWard(state);
    const other = state.units.find((candidate) => candidate.id !== person.unitId);
    if (!other) throw new Error("the seed contains only one unit");

    const next = wardFlowReducer(state, {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: other.id,
    });

    expect(next.rejections).toHaveLength(1);
    expect(admission(next, person.id).awayAtEmergencyDepartmentSince).toBeNull();
  });

  it("refuses somebody who has not reached the ward — a pulled bed is the mirror image of this", () => {
    const state = seeded();
    const pulled = state.admissions.find((candidate) => candidate.state !== "occupied");
    if (!pulled) throw new Error("the seed contains nobody who is not occupying a bed");

    const next = wardFlowReducer(state, {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: pulled.id,
      actingUnitId: pulled.unitId,
    });

    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toContain("only somebody occupying a bed");
  });

  it("refuses every role but the ward that holds the bed", () => {
    const state = seeded();
    const person = anOccupantOnTheWard(state);

    // Read from the table so this cannot pass by naming a role list of its own; the table itself is
    // pinned by hand in `tests/ward-event-permissions.test.ts`.
    expect([...EVENT_ROLE.RECORD_AWAY_AT_EMERGENCY_DEPARTMENT]).toEqual(["ward"]);
    expect([...EVENT_ROLE.RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT]).toEqual(["ward"]);

    for (const role of ["coordinator", "ed", "officer", "community", "demo"] as const) {
      const next = wardFlowReducer(state, {
        type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
        role,
        now: NOW,
        admissionId: person.id,
        actingUnitId: person.unitId,
      });
      expect(next.rejections, `${role} was allowed to record a ward's own occupant as away`).toHaveLength(1);
      expect(admission(next, person.id).awayAtEmergencyDepartmentSince).toBeNull();
    }
  });
});
