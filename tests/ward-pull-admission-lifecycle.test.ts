import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "../src/components/ward-management/ward-admissions";
import { capacityBreakdown } from "../src/components/ward-management/ward-bed-availability";
import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * A PULLED PATIENT HAS NOT ARRIVED, AND A CANCELLED PULL LEAVES NOBODY BEHIND.
 *
 * Owner ruling, 2026-09-01: *"a patient is not marked as arrived until the ward says they have
 * arrived. The pull just means the bed is allocated to them."*
 *
 * Two defects sat in `PULL_PATIENT`/`RELEASE_PULL` and neither was red:
 *
 *   1. The pull created an `Admission` stamped `state: "occupied"` with `arrivedAt` set to the
 *      instant of the pull — three stages before anybody had travelled anywhere. `daysInBed`
 *      counts from `arrivedAt`, so every stay begun by a pull was inflated by the whole transport
 *      delay, in the same direction every time, as a plausible number rather than a broken one.
 *   2. `RELEASE_PULL` gave the bed back to the unit and left that admission standing — a phantom
 *      occupant on the ward board, counted by `bedIsOccupied`, belonging to a movement that was
 *      back in the queue waiting for a bed the board said was taken.
 */

const NOW = NOW_ANCHOR;
const MOVEMENT_ID = "WF-009";
const UNIT_ID = "rph-adult-secure";

function admissionsAt(state: WardFlowState, unitId: string) {
  return state.admissions.filter((admission) => admission.unitId === unitId);
}

/**
 * EVERY BED FIGURE THIS PROJECT DERIVES FOR ONE UNIT, IN ONE OBJECT.
 *
 * ⚠️ **Deliberately NOT a list of the places a phantom occupant was expected to show up.** The
 * whole risk of deleting a record is the reference somebody else still holds, and enumerating the
 * consumers I happened to think of would test my imagination rather than the state. So this reads
 * the two derivations every capacity surface in the feature is built on (`unitCapacity` and
 * `capacityBreakdown`), the occupancy the ward board and the community hub both count
 * (`bedIsOccupied`), and the raw admission population — and the assertion is that the whole thing
 * balances back to where it started. A dangling reference shows up as a sum that no longer adds up,
 * whichever count is holding it.
 */
function bedFigures(state: WardFlowState, unitId: string) {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) throw new Error(`state is missing unit ${unitId}`);
  const atUnit = admissionsAt(state, unitId);
  return {
    capacity: unitCapacity(unit, state.bedReleases),
    breakdown: capacityBreakdown(unit, state.bedReleases, state.leaveBeds, NOW),
    empty: unit.empty.value,
    allocatable: unit.allocatable.value,
    sexMix: { ...unit.sexMix },
    admissionsAtUnit: atUnit.length,
    occupantsAtUnit: atUnit.filter(bedIsOccupied).length,
    admissionsEverywhere: state.admissions.length,
  };
}

/** Walk a seeded movement as far as an accepted bed, which is the last state before a pull. */
function acceptedAwaitingBed(): WardFlowState {
  let state: WardFlowState = seedWardFlowState();
  for (const event of [
    { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [UNIT_ID] },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: UNIT_ID },
  ] as const) {
    state = wardFlowReducer(state, { ...event, now: NOW, movementId: MOVEMENT_ID } as never);
  }
  expect(state.rejections, "the walk to an accepted bed must succeed, or nothing below proves anything").toEqual([]);
  return state;
}

function pull(state: WardFlowState): WardFlowState {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW,
    movementId: MOVEMENT_ID,
    unitId: UNIT_ID,
  });
}

function movementOf(state: WardFlowState) {
  const found = state.movements.find((candidate) => candidate.id === MOVEMENT_ID);
  if (!found) throw new Error(`state is missing ${MOVEMENT_ID}`);
  return found;
}

describe("a pull allocates a bed and marks nobody as arrived", () => {
  it("records the pulled person as pulled, with no arrival anybody asserted", () => {
    const before = acceptedAwaitingBed();
    const state = pull(before);
    expect(state.rejections).toEqual([]);

    expect(state.admissions.length, "the pull creates exactly one person in a bed").toBe(before.admissions.length + 1);
    const pulled = state.admissions[state.admissions.length - 1];

    expect(pulled.state, "the ward has given the bed away; the person is not in it yet").toBe("pulled");
    expect(
      pulled.arrivedAt,
      "nobody has said this person arrived — the pull is three stages before PATIENT_ARRIVED, and " +
        "daysInBed counts from arrivedAt, so a stamp here inflates every length of stay by the " +
        "transport delay",
    ).toBeNull();
    expect(pulled.pulledAt, "the bed is gone from this instant, and this event IS the pull").toBe(NOW);
    expect(pulled.unitId).toBe(UNIT_ID);
    expect(
      movementOf(state).admissionId,
      "the movement names the record its own pull created, so release and arrival act on that one " +
        "rather than searching for whichever pulled admission at this ward they find first",
    ).toBe(pulled.id);
  });

  it("still consumes the bed, because a bed given away is not available", () => {
    // The guard on the fix: `bedIsOccupied` has always counted `"pulled"`, and this pins that the
    // state change did not quietly free a bed that is spoken for.
    const before = acceptedAwaitingBed();
    const state = pull(before);
    const pulled = state.admissions[state.admissions.length - 1];
    expect(bedIsOccupied(pulled), "the bed is gone from the pull, whoever is standing in it").toBe(true);
    expect(bedFigures(state, UNIT_ID).allocatable).toBe(bedFigures(before, UNIT_ID).allocatable - 1);
  });

  it("marks the person arrived only when the ward says they arrived", () => {
    let state = pull(acceptedAwaitingBed());
    const admissionId = movementOf(state).admissionId;
    for (const event of [
      { type: "BOOK_TRANSPORT", role: "ed", provider: "Ambulance service", escortRequired: true },
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
    ] as const) {
      state = wardFlowReducer(state, { ...event, now: NOW, movementId: MOVEMENT_ID } as never);
    }
    expect(state.rejections, "the walk to the ward door must succeed").toEqual([]);

    const enRoute = state.admissions.find((candidate) => candidate.id === admissionId);
    expect(enRoute?.state, "in transport, still not arrived").toBe("pulled");
    expect(enRoute?.arrivedAt, "still nobody has said they got here").toBeNull();

    state = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "officer",
      now: NOW + 30,
      movementId: MOVEMENT_ID,
    });
    expect(state.rejections).toEqual([]);

    const arrived = state.admissions.find((candidate) => candidate.id === admissionId);
    expect(arrived?.state, "the ward has now said so").toBe("occupied");
    expect(arrived?.arrivedAt, "the stay clock starts at the arrival, not at the pull").toBe(NOW + 30);
    expect(arrived?.pulledAt, "and the pull instant survives — they are two different clocks").toBe(NOW);
    expect(
      state.admissions.length,
      "arrival marks the person the pull created; it must never append a second one",
    ).toBe(pull(acceptedAwaitingBed()).admissions.length);
  });
});

describe("releasing a pull leaves nothing behind", () => {
  it("restores every bed figure for the unit to exactly what it was before the pull", () => {
    const beforePull = acceptedAwaitingBed();
    const beforeFigures = bedFigures(beforePull, UNIT_ID);

    const pulled = pull(beforePull);
    expect(pulled.rejections).toEqual([]);
    const pulledFigures = bedFigures(pulled, UNIT_ID);
    // NON-VACUITY. If the pull changed nothing, the round trip below would balance for the wrong
    // reason and this test would pass against a reducer that does nothing at all.
    expect(pulledFigures, "the pull must actually change the ward's figures").not.toEqual(beforeFigures);

    const released = wardFlowReducer(pulled, {
      type: "RELEASE_PULL",
      role: "ward",
      now: NOW + 5,
      movementId: MOVEMENT_ID,
      actingUnitId: UNIT_ID,
      reason: "ward_withdrew_the_bed",
    });
    expect(released.rejections).toEqual([]);

    expect(
      bedFigures(released, UNIT_ID),
      "a released pull is the allocation being RETRACTED, so every figure derived for this ward — " +
        "its capacity, its breakdown, its occupancy and its admission population — must land back " +
        "exactly where it started. An admission left standing shows up here as a sum that no longer " +
        "adds up, without this test having to guess which count was holding it.",
    ).toEqual(beforeFigures);
  });

  it("deletes the pulled record rather than ending it, so no discharge is invented", () => {
    const pulled = pull(acceptedAwaitingBed());
    const admissionId = movementOf(pulled).admissionId;
    expect(admissionId, "the pull must have created something for the release to remove").toBeDefined();

    const released = wardFlowReducer(pulled, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW + 5,
      movementId: MOVEMENT_ID,
      actingUnitId: UNIT_ID,
      reason: "patient_no_longer_coming",
    });
    expect(released.rejections).toEqual([]);

    expect(
      released.admissions.find((candidate) => candidate.id === admissionId),
      "nobody was ever in this bed; a `departed` record would put a discharge in the ward's history " +
        "for an admission that never happened, and every discharge count would rise",
    ).toBeUndefined();
    expect(
      movementOf(released).admissionId,
      "and the join goes with it — an id pointing at a deleted admission is the dangling reference " +
        "this whole fix is about",
    ).toBeUndefined();
    expect(movementOf(released).stage, "the patient survives and keeps their acceptance").toBe("accepted_awaiting_bed");
    expect(
      released.admissionSequence,
      "the id source is monotonic and is NOT rewound: reusing an id a released pull already spent " +
        "would give two different people one admission id in a single session",
    ).toBe(pulled.admissionSequence);
  });
});
