import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

function unit(state: ReturnType<typeof seeded>, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

function admission(state: ReturnType<typeof seeded>, id: string) {
  const found = state.admissions.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing admission ${id}`);
  return found;
}

/** Live occupants of one ward, counted here rather than imported, so this file asserts the property
 *  itself — everything except an admission that has ended. */
function liveCount(state: ReturnType<typeof seeded>, unitId: string) {
  return state.admissions.filter((candidate) => candidate.unitId === unitId && candidate.state !== "departed").length;
}

/** The first admission actually in a bed — chosen FROM state rather than hard-coded, so a seed
 *  change cannot silently make every test below exercise a different case than it names. */
function anOccupant(state: ReturnType<typeof seeded>) {
  const found = state.admissions.find((candidate) => candidate.state === "occupied");
  if (!found) throw new Error("the seed contains nobody occupying a bed");
  return found;
}

describe("recording that a patient has left", () => {
  /*
   * WHY THIS FILE EXISTS. Before `RECORD_LEAVING` the model had 36 events and not one of them
   * discharged anybody. Patients arrived and stayed forever, and the only person who had ever left
   * a bed was one written that way in the seed — so the discharge half of this prototype's own
   * argument, following a person through to their bed being free again, had never run.
   */

  it("ends the admission, with the instant and the destination", () => {
    const state = seeded();
    const person = anOccupant(state);

    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
      leavingDestination: "discharged-to-the-community",
    });

    expect(next.rejections).toHaveLength(0);
    const departed = admission(next, person.id);
    expect(departed.state).toBe("departed");
    expect(departed.leftAt).toBe(NOW);
    expect(departed.leavingDestination).toBe("discharged-to-the-community");
  });

  it("frees the bed: the ward's empty count rises by exactly one", () => {
    /*
     * The inverse of `PATIENT_ARRIVED`, which lowers `empty` by one. This is the assertion that
     * makes a discharge mean something to the rest of the app rather than only to the record: a
     * discharge that ended the admission but left the bed counted as occupied would show a ward as
     * full while a bed stood empty, and nothing else would notice.
     */
    const state = seeded();
    const person = anOccupant(state);
    const before = unit(state, person.unitId).empty.value;

    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
      leavingDestination: "discharged-to-the-community",
    });

    expect(next.rejections).toHaveLength(0);
    expect(unit(next, person.unitId).empty.value).toBe(before + 1);
    expect(unit(next, person.unitId).empty.confirmedAt).toBe(NOW);
  });

  it("does NOT raise allocatable — that stays the ward's own claim, made through the release flow", () => {
    const state = seeded();
    const person = anOccupant(state);
    const before = unit(state, person.unitId).allocatable.value;

    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
      leavingDestination: "discharged-to-the-community",
    });

    expect(unit(next, person.unitId).allocatable.value).toBe(before);
  });

  it("takes the departing person out of the ward's live occupants, without erasing them", () => {
    const state = seeded();
    const person = anOccupant(state);
    const before = liveCount(state, person.unitId);

    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
      leavingDestination: "discharged-to-the-community",
    });

    expect(liveCount(next, person.unitId)).toBe(before - 1);
    // Ended, never deleted: the board, the discharge dates and the community hub all still need to
    // see that this person went, and where.
    expect(next.admissions).toHaveLength(state.admissions.length);
  });

  it("lowers the sex mix for that person's sex, and leaves the other sex alone", () => {
    /*
     * ⚠️ THIS ASSERTION USED TO BE `toBe(Math.max(0, before - 1))` AND COULD NOT FAIL.
     * The expectation was computed with the same expression as the implementation, so deleting the
     * clamp from the reducer left this test green - and the title claimed "never below zero", a
     * property it could not reach, because `anOccupant` guarantees the count is at least one.
     * Ward Verifier found it. **An expectation that restates the implementation tests that the
     * code equals itself.** Write the number you expect, or derive it a different way.
     *
     * The "for that person only" half was never asserted at all, so the other sex is now checked
     * too - a reducer that zeroed both would have passed the old test.
     */
    const state = seeded();
    const person = anOccupant(state);
    const otherSex = person.sex === "Female" ? "Male" : "Female";
    const before = unit(state, person.unitId).sexMix[person.sex] ?? 0;
    const otherBefore = unit(state, person.unitId).sexMix[otherSex] ?? 0;
    expect(before).toBeGreaterThan(0);

    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
      leavingDestination: "discharged-to-the-community",
    });

    expect(unit(next, person.unitId).sexMix[person.sex] ?? 0).toBe(before - 1);
    expect(unit(next, person.unitId).sexMix[otherSex] ?? 0).toBe(otherBefore);
  });

  it("holds the sex mix at zero rather than going negative, from a state that should not exist", () => {
    /*
     * The clamp is defensive: the model does not produce a ward whose sex mix reads zero while
     * somebody of that sex occupies a bed. **That is exactly why it needs a test that BUILDS the
     * impossible state**, because no ordinary discharge can drive it, and an untestable guard is
     * indistinguishable from a guard that was deleted.
     *
     * Delete `Math.max(0, ...)` from the reducer and this test reads -1 and fails. That is the
     * whole point of it.
     */
    const state = seeded();
    const person = anOccupant(state);
    const corrupted = {
      ...state,
      units: state.units.map((candidate) =>
        candidate.id === person.unitId ? { ...candidate, sexMix: { ...candidate.sexMix, [person.sex]: 0 } } : candidate,
      ),
    };

    const next = wardFlowReducer(corrupted, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
      leavingDestination: "discharged-to-the-community",
    });

    expect(unit(next, person.unitId).sexMix[person.sex] ?? 0).toBe(0);
  });

  it("records a transfer to another psychiatric ward as leaving this ward, whatever it means statewide", () => {
    /*
     * The one destination of the five that is not a statewide release. The person has left THIS
     * ward — so this ward's bed frees and the admission ends exactly as for any other destination —
     * but they still occupy a bed somewhere in the system. That distinction lives in
     * `LEAVING_DESTINATIONS.countsAsStatewideRelease`; this event's job is to record which one
     * happened, not to interpret it.
     */
    const state = seeded();
    const person = anOccupant(state);
    const before = unit(state, person.unitId).empty.value;

    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
      leavingDestination: "transferred-to-another-psychiatric-ward",
    });

    expect(next.rejections).toHaveLength(0);
    expect(admission(next, person.id).leavingDestination).toBe("transferred-to-another-psychiatric-ward");
    expect(unit(next, person.unitId).empty.value).toBe(before + 1);
  });

  describe("what it refuses", () => {
    it("refuses an unknown admission", () => {
      const state = seeded();
      const next = wardFlowReducer(state, {
        type: "RECORD_LEAVING",
        role: "ward",
        now: NOW,
        admissionId: "AD-NOT-A-REAL-ONE",
        actingUnitId: "scgh-adult-open",
        leavingDestination: "discharged-to-the-community",
      });

      expect(next.rejections).toHaveLength(1);
      expect(next.rejections[0].reason).toMatch(/no admission found/i);
      expect(next.admissions).toEqual(state.admissions);
    });

    it("refuses a ward discharging another ward's patient", () => {
      const state = seeded();
      const person = anOccupant(state);
      const otherUnit = state.units.find((candidate) => candidate.id !== person.unitId);
      if (!otherUnit) throw new Error("the seed has only one unit");

      const next = wardFlowReducer(state, {
        type: "RECORD_LEAVING",
        role: "ward",
        now: NOW,
        admissionId: person.id,
        actingUnitId: otherUnit.id,
        leavingDestination: "discharged-to-the-community",
      });

      expect(next.rejections).toHaveLength(1);
      expect(next.rejections[0].reason).toMatch(/belongs to unit/i);
      expect(admission(next, person.id).state).toBe("occupied");
    });

    it("refuses a second discharge rather than overwriting the first instant", () => {
      /*
       * A no-op would be the tempting reading of "they have already left". It is the wrong one: a
       * second event would rewrite `leftAt` to a later instant and silently shorten the recorded
       * stay of somebody who walked out hours earlier.
       */
      const state = seeded();
      const person = anOccupant(state);
      const once = wardFlowReducer(state, {
        type: "RECORD_LEAVING",
        role: "ward",
        now: NOW,
        admissionId: person.id,
        actingUnitId: person.unitId,
        leavingDestination: "discharged-to-the-community",
      });
      const twice = wardFlowReducer(once, {
        type: "RECORD_LEAVING",
        role: "ward",
        now: NOW + 180,
        admissionId: person.id,
        actingUnitId: person.unitId,
        leavingDestination: "left-against-advice",
      });

      expect(twice.rejections).toHaveLength(1);
      expect(twice.rejections[0].reason).toMatch(/already left/i);
      expect(admission(twice, person.id).leftAt).toBe(NOW);
      expect(admission(twice, person.id).leavingDestination).toBe("discharged-to-the-community");
      // And the bed is not freed twice.
      expect(unit(twice, person.unitId).empty.value).toBe(unit(once, person.unitId).empty.value);
    });

    it("refuses to discharge somebody who never reached a bed", () => {
      /*
       * A waitlisted or pulled admission has never occupied a bed, so ending it is not a discharge.
       * Giving back a pull is `RELEASE_PULL`'s job; routing it through here would credit the ward a
       * bed it never lost.
       */
      const state = seeded();
      const notInABed = state.admissions.find(
        (candidate) => candidate.state === "waitlisted" || candidate.state === "pulled",
      );
      if (!notInABed) throw new Error("the seed contains nobody waiting or pulled");

      const next = wardFlowReducer(state, {
        type: "RECORD_LEAVING",
        role: "ward",
        now: NOW,
        admissionId: notInABed.id,
        actingUnitId: notInABed.unitId,
        leavingDestination: "discharged-to-the-community",
      });

      expect(next.rejections).toHaveLength(1);
      expect(next.rejections[0].reason).toMatch(/only somebody occupying a bed/i);
      expect(unit(next, notInABed.unitId).empty.value).toBe(unit(state, notInABed.unitId).empty.value);
    });

    it("refuses a role that is not the ward", () => {
      const state = seeded();
      const person = anOccupant(state);
      const next = wardFlowReducer(state, {
        type: "RECORD_LEAVING",
        role: "coordinator",
        now: NOW,
        admissionId: person.id,
        actingUnitId: person.unitId,
        leavingDestination: "discharged-to-the-community",
      });

      expect(next.rejections).toHaveLength(1);
      expect(admission(next, person.id).state).toBe("occupied");
    });
  });
});
