import { describe, expect, it } from "vitest";

import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-events";
import { BLOCKERS_MEANING_NOTHING_IS_BLOCKING } from "../src/components/ward-management/ward-model";
import {
  STAGE_TRANSITION_BLOCKERS,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { operationalScore } from "../src/components/ward-management/ward-priority";
import { allEmergencyDepartments, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

/** An open movement, chosen FROM state rather than hard-coded. */
function anOpenMovement(state: WardFlowState) {
  const found = state.movements.find((candidate) => !candidate.closure && candidate.stage !== "arrived");
  if (!found) throw new Error("the seed contains no open movement");
  return found;
}

/**
 * ⚠️ THE ACCEPTANCE TEST FOR THE OWNER'S 2026-09-01 RULING, AND IT IS THE POINT OF THIS FILE.
 *
 * `Movement.blocker` — the FREE-PROSE field, not `BedRelease.blocker`, which is a
 * `BedReleaseBlocker` enum about a bed being freed and merely shares the name — was audited as a
 * candidate for being DERIVED from `stage`, `transport`, `acceptedUnitId` and `closure`. The owner
 * ruled against it, and these five values are the evidence:
 *
 *   - The first two are TWO DIFFERENT SITUATIONS THAT BOTH HAVE NO BLOCKER. A derivation yields one
 *     value when nothing is blocking; the field is the only thing that says which of the two it is.
 *   - The last three name activity by parties this model has no field for at all — a family, a
 *     specialling roster, an escort provider. There is nothing in state to compute them from.
 *
 * A later change that narrows this field to a chosen vocabulary, or replaces it with a derivation,
 * loses these by a different route than deriving would and passes every other test in the suite,
 * because no other test asserts a value the model can no longer represent. This one does.
 */
const MUST_STAY_EXPRESSIBLE = [
  "None — in transit",
  "None — handover complete",
  "Awaiting family collateral before destination decision",
  "Awaiting specialling roster confirmation",
  "Escort provider organising secure transport",
] as const;

describe("Movement.blocker — free prose, and it must stay that way", () => {
  it("still holds all five values the owner's ruling turns on, byte for byte", () => {
    const seeded = seedWardFlowState();
    const target = anOpenMovement(seeded);

    for (const value of MUST_STAY_EXPRESSIBLE) {
      const next = wardFlowReducer(seeded, {
        type: "RECORD_MOVEMENT_BLOCKER",
        role: "coordinator",
        now: NOW,
        movementId: target.id,
        blocker: value,
      });

      expect(next.rejections, `"${value}" was refused — the field has been narrowed`).toHaveLength(0);
      expect(movement(next, target.id).blocker, `"${value}" did not survive being stored verbatim`).toBe(value);
    }
  });

  it("keeps the two no-blocker sentences DIFFERENT, which is what a derivation could not do", () => {
    // Stated as its own assertion rather than left implicit in the list above: if these two ever
    // collapse to one value — the shape any computed approach forces — "in transit" and "handover
    // complete" become the same reading on the console, and they are not the same situation.
    expect(STAGE_TRANSITION_BLOCKERS.collected).toBe("None — in transit");
    expect(STAGE_TRANSITION_BLOCKERS.arrived).toBe("None — handover complete");
    expect(STAGE_TRANSITION_BLOCKERS.collected).not.toBe(STAGE_TRANSITION_BLOCKERS.arrived);
  });

  it("carries those five in the hand-authored fixture, so the ruling's own evidence is real", () => {
    // Non-vacuity: the fixture was actually read.
    expect(wardMovements.length).toBeGreaterThan(10);
    const authored = new Set(wardMovements.map((candidate) => candidate.blocker));
    for (const value of MUST_STAY_EXPRESSIBLE) {
      expect(authored.has(value), `the fixture no longer carries "${value}"`).toBe(true);
    }
  });

  it("refuses a blank, because a blank is indistinguishable from a field nobody reached", () => {
    const seeded = seedWardFlowState();
    const target = anOpenMovement(seeded);

    for (const blank of ["", "   "]) {
      const next = wardFlowReducer(seeded, {
        type: "RECORD_MOVEMENT_BLOCKER",
        role: "coordinator",
        now: NOW,
        movementId: target.id,
        blocker: blank,
      });
      expect(next.rejections).toHaveLength(1);
      expect(movement(next, target.id).blocker).toBe(target.blocker);
    }
  });

  it("trims, so a stored value cannot score as an obstruction on whitespace alone", () => {
    const seeded = seedWardFlowState();
    const target = anOpenMovement(seeded);

    const next = wardFlowReducer(seeded, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      blocker: "  None — in transit  ",
    });

    expect(next.rejections).toHaveLength(0);
    expect(movement(next, target.id).blocker).toBe("None — in transit");
    // The reason the trim matters: `hasActiveBlocker` in ward-priority.ts trims before matching its
    // "nothing is blocking" shapes, so an untrimmed store would still have been inactive — but a
    // consumer comparing two identical statements for equality would not have seen them as equal.
    const factors = operationalScore(movement(next, target.id), NOW).factors;
    expect(factors.map((factor) => factor.label)).not.toContain("Active blocker");
  });

  it("refuses a closed movement rather than describing an obstruction to something that is over", () => {
    const seeded = seedWardFlowState();
    const closed = seeded.movements.find((candidate) => candidate.closure);
    if (!closed) throw new Error("the seed contains no closed movement");

    const next = wardFlowReducer(seeded, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW,
      movementId: closed.id,
      blocker: "Awaiting single-room clean",
    });

    expect(next.rejections).toHaveLength(1);
    expect(movement(next, closed.id).blocker).toBe(closed.blocker);
  });

  /**
   * ⚠️ THIS PINNED "AND NO OFFICER" UNTIL 2026-09-01, AND THE PIN WAS OVERTURNED WITH ITS REASON.
   *
   * The exclusion rested on a premise stated in `ward-flow-events.ts`: the transport legs already
   * restate this field through the events an officer raises. An officer raises exactly four events,
   * and `TRANSPORT_ACCEPTED` and `TRANSPORT_EN_ROUTE` restated nothing — so the two legs that made
   * the standing sentence false were the two that left it stale, and the only party who watches the
   * vehicle could not correct it. Both restate now, and the premise STILL does not carry the
   * exclusion: the coordinator, the ward and the emergency department all raise restating events
   * too, so applied evenly the argument empties the list rather than trimming it.
   *
   * `demo` stays refused and is the reason this test keeps a refusal at all: it is a clock and a
   * scenario switch, not an observer of anything.
   */
  it("permits the five roles that raise, own or physically move a movement — never the demo role", () => {
    // Read from the table so this cannot pass by naming a list of its own; the table itself is
    // pinned by hand in `tests/ward-event-permissions.test.ts`.
    expect([...EVENT_ROLE.RECORD_MOVEMENT_BLOCKER]).toEqual(["ed", "community", "ward", "coordinator", "officer"]);

    const seeded = seedWardFlowState();
    const target = anOpenMovement(seeded);
    const next = wardFlowReducer(seeded, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "demo",
      now: NOW,
      movementId: target.id,
      blocker: "Awaiting single-room clean",
    });
    expect(next.rejections, "demo was allowed to record a blocker").toHaveLength(1);
  });

  it("records the caller's prose and NOTHING about who said it", () => {
    const seeded = seedWardFlowState();
    const target = anOpenMovement(seeded);

    const byWard = wardFlowReducer(seeded, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "ward",
      now: NOW,
      movementId: target.id,
      blocker: "Awaiting single-room clean",
    });
    const byEd = wardFlowReducer(seeded, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "ed",
      now: NOW,
      movementId: target.id,
      blocker: "Awaiting single-room clean",
    });

    const byOfficer = wardFlowReducer(seeded, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "officer",
      now: NOW,
      movementId: target.id,
      blocker: "Awaiting single-room clean",
    });

    // Byte-identical whoever raised it. That is what makes the five-role permission safe: no
    // attribution is written, so none of the five can introduce a false one. `officer` is included
    // here because it was the role added last and is therefore the one whose safety is unproven by
    // habit.
    expect(movement(byWard, target.id)).toEqual(movement(byEd, target.id));
    expect(movement(byOfficer, target.id)).toEqual(movement(byEd, target.id));
  });
});

describe("Movement.blocker — the staleness that made it wrong on screen", () => {
  /*
   * THE DEFECT, IN ONE SENTENCE. `RAISE_REFERRAL` stamped "Awaiting coordinator referral" at
   * creation and no stage transition ever touched it again, so a patient whose transport was
   * already en route still read as waiting for a coordinator on the movement console's "Response"
   * and "Current blocker" lines — and somebody chased the wrong patient.
   */

  /** Raises a real movement through the reducer and returns its id. */
  function raised(state: WardFlowState) {
    const department = allEmergencyDepartments()[0];
    const next = wardFlowReducer(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: department.id,
      draft: {
        urgency: 2,
        cohort: "Adult",
        security: "Open",
        sex: "Male",
        specialling: false,
        legalStatus: "Voluntary",
        legalFormCode: null,
      },
    });
    expect(next.rejections).toHaveLength(0);
    const created = next.movements[next.movements.length - 1];
    if (!created) throw new Error("RAISE_REFERRAL created no movement");
    return { state: next, movementId: created.id };
  }

  it("still says 'Awaiting coordinator referral' at creation, because at creation that is true", () => {
    const { state, movementId } = raised(seedWardFlowState());
    expect(movement(state, movementId).blocker).toBe("Awaiting coordinator referral");
  });

  it("stops saying it the moment a coordinator refers — the transition that used to leave it", () => {
    const { state, movementId } = raised(seedWardFlowState());
    const unitId = state.units[0]?.id;
    if (!unitId) throw new Error("the seed contains no units");

    const referred = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW + 10,
      movementId,
      unitIds: [unitId],
    });

    expect(referred.rejections).toHaveLength(0);
    expect(movement(referred, movementId).blocker).toBe(STAGE_TRANSITION_BLOCKERS.referred);
    expect(movement(referred, movementId).blocker).not.toBe("Awaiting coordinator referral");
  });

  /**
   * The whole journey, asserted at every step rather than only at the end. The old field was
   * correct at exactly one instant in this sequence — the first — and this walk is what proves it
   * is now correct at all of them.
   */
  it("is restated at every transition, so it can never describe an earlier stage", () => {
    let state = seedWardFlowState();
    const raise = raised(state);
    state = raise.state;
    const movementId = raise.movementId;
    const unit = state.units.find((candidate) => candidate.empty.value > 0 && candidate.allocatable.value > 0);
    if (!unit) throw new Error("the seed contains no unit with a free bed");

    const step = (event: Parameters<typeof wardFlowReducer>[1], expected: string) => {
      const before = state.rejections.length;
      state = wardFlowReducer(state, event);
      expect(state.rejections.length, `${event.type} was refused: ${state.rejections.at(-1)?.reason}`).toBe(before);
      expect(movement(state, movementId).blocker, `${event.type} left the blocker describing an earlier stage`).toBe(
        expected,
      );
    };

    step(
      { type: "REFER_TO_UNITS", role: "coordinator", now: NOW + 10, movementId, unitIds: [unit.id] },
      STAGE_TRANSITION_BLOCKERS.referred,
    );
    step(
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", now: NOW + 20, movementId, unitId: unit.id },
      STAGE_TRANSITION_BLOCKERS.accepted,
    );
    step(
      { type: "PULL_PATIENT", role: "ward", now: NOW + 30, movementId, unitId: unit.id },
      // ⚠️ A PULL DOES NOT RESTATE IT, and that is deliberate rather than an omission. The seed
      // carries three different sentences for three `pulled` movements ("Escort provider organising
      // secure transport", "Awaiting single-room clean", "Ward finalising bed clean"), so the stage
      // demonstrably does NOT determine the value here — writing one would be inventing a fact.
      // Acceptance is still the true statement until transport is booked.
      STAGE_TRANSITION_BLOCKERS.accepted,
    );
    step(
      {
        type: "BOOK_TRANSPORT",
        role: "ed",
        now: NOW + 40,
        movementId,
        provider: "Ambulance service",
        escortRequired: false,
      },
      STAGE_TRANSITION_BLOCKERS.transportBooked,
    );
    // ⚠️ HANDOVER_READY does NOT restate it, for the same evidence-led reason the pull does not:
    // the seed carries two DIFFERENT sentences for two `handover_ready` movements that both hold a
    // transport job ("Transport escort confirming departure time" and "Awaiting transport escort"),
    // so the stage does not determine the value and writing one would be inventing a fact. And a
    // handover being ready does not make a provider answer — the sentence it inherits is still
    // true, which is the actual test rather than "the stage moved".
    step({ type: "HANDOVER_READY", role: "ed", now: NOW + 50, movementId }, STAGE_TRANSITION_BLOCKERS.transportBooked);
    /*
     * ⚠️ THESE TWO PINNED `transportBooked` UNTIL 2026-09-01, AND THE PIN WAS OVERTURNED.
     *
     * Its stated rationale was: *"What is true throughout is that the provider has not yet
     * collected anybody."* That sentence is true and it is not what the field SAYS. The stored
     * value was `"Awaiting a transport provider response"`, and by `TRANSPORT_ACCEPTED` the
     * provider HAS responded — `transport.acceptedAt` on the same movement holds the response the
     * sentence claims is outstanding. A rationale that argues for a value the words do not carry
     * pins the wrong thing; the console renders these words to a coordinator, not the rationale.
     *
     * The evidence-led argument the pull and the handover rest on does not reach here either. It
     * says a STAGE does not determine this field, and both of these are told a FACT — `acceptedAt`,
     * then `enRouteAt` — that contradicts the standing sentence outright. That is a different test,
     * and it is the one the reducer now applies.
     */
    step(
      { type: "TRANSPORT_ACCEPTED", role: "officer", now: NOW + 55, movementId },
      STAGE_TRANSITION_BLOCKERS.transportAccepted,
    );
    step(
      { type: "TRANSPORT_EN_ROUTE", role: "officer", now: NOW + 60, movementId },
      STAGE_TRANSITION_BLOCKERS.transportEnRoute,
    );
    step(
      { type: "PATIENT_COLLECTED", role: "officer", now: NOW + 70, movementId },
      STAGE_TRANSITION_BLOCKERS.collected,
    );
    step({ type: "PATIENT_ARRIVED", role: "officer", now: NOW + 80, movementId }, STAGE_TRANSITION_BLOCKERS.arrived);

    // The end of the journey, spelled out: an arrived patient reads "None — handover complete" and
    // is not scored as an obstruction, where before this change they read "Awaiting coordinator
    // referral" and carried ten points for a blocker that had never existed.
    const arrived = movement(state, movementId);
    expect(arrived.blocker).toBe("None — handover complete");
    expect(operationalScore(arrived, NOW + 80).factors.map((factor) => factor.label)).not.toContain("Active blocker");
  });

  it("a human's prose survives until the situation next changes", () => {
    const { state, movementId } = raised(seedWardFlowState());
    const unitId = state.units[0]?.id;
    if (!unitId) throw new Error("the seed contains no units");

    const said = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "ward",
      now: NOW + 5,
      movementId,
      blocker: "Awaiting family collateral before destination decision",
    });
    expect(movement(said, movementId).blocker).toBe("Awaiting family collateral before destination decision");

    // Not touched by an event that does not change the movement's situation.
    const urgency = wardFlowReducer(said, {
      type: "CHANGE_URGENCY",
      role: "coordinator",
      now: NOW + 6,
      movementId,
      urgency: 1,
      reason: "reassessed",
    });
    expect(urgency.rejections).toHaveLength(0);
    expect(movement(urgency, movementId).blocker).toBe("Awaiting family collateral before destination decision");

    // And replaced when it does. The situation genuinely moved on; a note about the previous one is
    // the staleness this whole change exists to end.
    const referred = wardFlowReducer(urgency, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW + 10,
      movementId,
      unitIds: [unitId],
    });
    expect(movement(referred, movementId).blocker).toBe(STAGE_TRANSITION_BLOCKERS.referred);
  });

  it("says nothing is blocking a movement that was closed without arriving", () => {
    const seeded = seedWardFlowState();
    // A movement with a live referral and no acceptance — the only shape `WITHDRAW_REFERRAL`
    // accepts. Chosen FROM state rather than hard-coded, so a seed change cannot make this test
    // silently exercise a refusal instead.
    const open = seeded.movements.find(
      (candidate) => !candidate.closure && candidate.referredUnitIds.length > 0 && !candidate.acceptedUnitId,
    );
    if (!open) throw new Error("the seed contains no withdrawable movement");

    const withdrawn = wardFlowReducer(seeded, {
      type: "WITHDRAW_REFERRAL",
      role: "ed",
      now: NOW,
      movementId: open.id,
    });

    expect(withdrawn.rejections).toHaveLength(0);
    expect(movement(withdrawn, open.id).blocker).toBe(STAGE_TRANSITION_BLOCKERS.didNotProceed);
  });
});

/**
 * ⚠️ THE DEFECT THIS SECTION EXISTS FOR, AND IT WAS INTRODUCED BY THE FIX DIRECTLY ABOVE.
 *
 * `RECORD_MOVEMENT_BLOCKER` accepts any non-blank prose. `hasActiveBlocker` (ward-priority.ts)
 * decided "nothing is blocking" by CASE-SENSITIVE match against a small vocabulary. That was safe
 * while the only writers were the fixture and the reducer, both writing from a fixed set — and it
 * stopped being safe the moment a person could type into the field.
 *
 * A nurse clearing a blocker with "none — resolved", "no blocker", "Nothing outstanding", "N/A" or
 * "Cleared" left the movement scoring TEN POINTS as actively obstructed in `operationalScore`, so
 * it sat above patients who really were blocked. Nothing failed. **That is the computed kind of
 * wrong rather than the displayed kind**: a wrong sentence is read by a person who can disbelieve
 * it; a wrong score is acted on by a system that cannot.
 *
 * ⚠️ **NO TEST IN THE SUITE WOULD HAVE CAUGHT IT — verified, not assumed.**
 * `ward-movement-blocker.test.ts` exercised only the reducer's own sentinels;
 * `ward-priority.test.ts` covered the fixture's values and the adversarial "None of the secure
 * units can take him". Neither typed a human clearing phrase in any casing. These are the tests
 * that close that.
 */
describe("Movement.blocker — clearing is represented, never guessed at", () => {
  const seededTarget = () => {
    const state = seedWardFlowState();
    const target = anOpenMovement(state);
    return { state, target };
  };

  it("a lowercase clearing phrase does NOT leave the movement scoring as blocked", () => {
    // ⚠️ THE ASSERTION THAT WOULD HAVE CAUGHT THE DEFECT. Before the repair this was stored happily
    // and scored ten points; now the reducer refuses it and names the control that does the job.
    const { state, target } = seededTarget();
    for (const typed of ["none — in transit", "no blocker", "NONE — CLEARED"]) {
      const next = wardFlowReducer(state, {
        type: "RECORD_MOVEMENT_BLOCKER",
        role: "coordinator",
        now: NOW,
        movementId: target.id,
        blocker: typed,
      });
      expect(next.rejections, `"${typed}" was stored`).toHaveLength(1);
      expect(next.rejections[0]?.reason).toContain("CLEAR_MOVEMENT_BLOCKER");
    }

    // And the control that DOES the job leaves the movement unblocked in the score, which is the
    // property that actually matters — asserted through `operationalScore`, not through the string.
    const cleared = wardFlowReducer(state, {
      type: "CLEAR_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
    });
    expect(cleared.rejections).toHaveLength(0);
    expect(operationalScore(movement(cleared, target.id), NOW).factors.map((factor) => factor.label)).not.toContain(
      "Active blocker",
    );
  });

  /**
   * ⚠️ THE TEST THAT PINS THE RECOGNISER ITSELF, and it exists because the first version of this
   * file did NOT. Reverting `hasActiveBlocker` to its old case-sensitive pattern left every other
   * assertion here green — the reducer's near-miss refusal was catching the lowercase inputs before
   * they could reach the score, so the pattern-versus-closed-set change was untested. A guard that
   * cannot fail is not a guard, so this is the one assertion the two implementations disagree on.
   *
   * `"None — resolved"` is correctly cased and is NOT a member of the closed set, so it is stored
   * as written and scores as an ACTIVE blocker. The old regex matched any `"None"` followed by a
   * dash and would have called it inactive.
   *
   * ⚠️ That is a DELIBERATE trade and the stricter direction. Reading "None — resolved" on screen
   * and seeing the patient scored as blocked is a visible disagreement a person can act on. The
   * alternative — a pattern that guesses at intent — is what swallowed
   * `"None of the secure units can take him"`, where the same guess is silently WRONG in the
   * dangerous direction. The Clear control is how somebody says nothing is blocking, and the
   * label on the text field says so.
   */
  it("an unrecognised 'None — …' phrasing scores as BLOCKED, because the set is closed", () => {
    const { state, target } = seededTarget();
    const next = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      blocker: "None — resolved",
    });

    expect(next.rejections, "correctly-cased prose is stored, not refused").toHaveLength(0);
    expect(movement(next, target.id).blocker).toBe("None — resolved");
    expect(operationalScore(movement(next, target.id), NOW).factors.map((factor) => factor.label)).toContain(
      "Active blocker",
    );

    // ...and the control that exists for this leaves it genuinely unblocked.
    const cleared = wardFlowReducer(next, {
      type: "CLEAR_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW + 5,
      movementId: target.id,
    });
    expect(operationalScore(movement(cleared, target.id), NOW).factors.map((factor) => factor.label)).not.toContain(
      "Active blocker",
    );
  });

  it("'None of the secure units can take him' STILL scores as blocked — the adversarial case", () => {
    // ⚠️ This is the reason the recogniser was not simply made case-insensitive. A `/^none/i`
    // pattern swallows this sentence, and it is a real blocker: every secure unit is full.
    const { state, target } = seededTarget();
    const next = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      blocker: "None of the secure units can take him",
    });

    expect(next.rejections).toHaveLength(0);
    expect(movement(next, target.id).blocker).toBe("None of the secure units can take him");
    expect(operationalScore(movement(next, target.id), NOW).factors.map((factor) => factor.label)).toContain(
      "Active blocker",
    );
  });

  it("the two legacy seed values still clear, so the fixture is not silently re-scored", () => {
    // The hand-authored "nothing here" values, asserted through the score rather than through
    // membership of the list — a list the recogniser had stopped reading would pass a membership
    // check and fail this one.
    const { state, target } = seededTarget();
    for (const legacy of ["No blocker", "None — in transit", "None — handover complete"]) {
      const stored = { ...movement(state, target.id), blocker: legacy };
      expect(
        operationalScore(stored, NOW).factors.map((factor) => factor.label),
        legacy,
      ).not.toContain("Active blocker");
    }
  });

  it("every sentinel the reducer itself writes is in the closed set the score reads", () => {
    // The drift this pair is most likely to develop: a seventh transition sentinel added to
    // `STAGE_TRANSITION_BLOCKERS` that nobody adds to `BLOCKERS_MEANING_NOTHING_IS_BLOCKING`, so a
    // settled movement scores as obstructed. Only the "None — …" ones are inactive by design.
    for (const sentinel of Object.values(STAGE_TRANSITION_BLOCKERS)) {
      if (!sentinel.startsWith("None")) continue;
      expect(
        BLOCKERS_MEANING_NOTHING_IS_BLOCKING as readonly string[],
        `the reducer writes "${sentinel}" but the score does not recognise it as inactive`,
      ).toContain(sentinel);
    }
    // Non-vacuity: the loop above really had something to check.
    expect(Object.values(STAGE_TRANSITION_BLOCKERS).filter((value) => value.startsWith("None")).length).toBe(3);
  });

  it("refuses clearing a movement that already records nothing holding it up", () => {
    const { state, target } = seededTarget();
    const cleared = wardFlowReducer(state, {
      type: "CLEAR_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
    });
    const again = wardFlowReducer(cleared, {
      type: "CLEAR_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW + 10,
      movementId: target.id,
    });

    expect(again.rejections).toHaveLength(1);
    expect(again.rejections[0]?.reason).toContain("already records that nothing is holding it up");
  });

  it("says CLEARED rather than 'No blocker' — an absence with its reason, like the other two", () => {
    const { state, target } = seededTarget();
    const cleared = wardFlowReducer(state, {
      type: "CLEAR_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
    });
    // "No blocker" means nobody ever recorded one; this means somebody looked and said it is gone.
    // The same distinction "None — in transit" and "None — handover complete" exist to preserve.
    expect(movement(cleared, target.id).blocker).toBe("None — cleared");
    expect(movement(cleared, target.id).blocker).not.toBe("No blocker");
  });

  it("permits exactly the roles that may record one — never narrower", () => {
    expect([...EVENT_ROLE.CLEAR_MOVEMENT_BLOCKER]).toEqual([...EVENT_ROLE.RECORD_MOVEMENT_BLOCKER]);
  });

  /**
   * ⚠️ THE TRANSPORT OFFICER, ADMITTED 2026-09-01 AFTER BEING EXCLUDED ON A FALSE PREMISE.
   *
   * The exclusion read: the transport legs already restate this field through the events an officer
   * raises. An officer raises exactly four events, and two of them — `TRANSPORT_ACCEPTED` and
   * `TRANSPORT_EN_ROUTE` — restated nothing, so the two legs that made the standing sentence false
   * were the two that left it stale, and the only party who could see the vehicle could not correct
   * it. Both restate now, and the premise still does not carry the exclusion: every other permitted
   * role raises restating events too, so applied evenly the argument admits nobody.
   *
   * What the officer uniquely observes has no event at all. Between `TRANSPORT_EN_ROUTE` and
   * `PATIENT_COLLECTED` an ambulance diverted to a higher-priority job leaves the movement reading
   * "Awaiting collection — transport is en route" while the vehicle turned around.
   */
  it("lets the transport officer record what only they can see, and take it back", () => {
    const { state, target } = seededTarget();

    const diverted = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "officer",
      now: NOW,
      movementId: target.id,
      blocker: "Ambulance diverted to a higher-priority job",
    });
    expect(diverted.rejections, "an officer was refused the blocker they alone observe").toHaveLength(0);
    expect(movement(diverted, target.id).blocker).toBe("Ambulance diverted to a higher-priority job");

    // And may retract it. A role that can record but not clear leaves a sentence only somebody who
    // cannot see the vehicle is allowed to remove.
    const resolved = wardFlowReducer(diverted, {
      type: "CLEAR_MOVEMENT_BLOCKER",
      role: "officer",
      now: NOW + 10,
      movementId: target.id,
    });
    expect(resolved.rejections).toHaveLength(0);
    expect(movement(resolved, target.id).blocker).toBe("None — cleared");
  });
});

/**
 * ⚠️ THE TRANSPORT LEGS — the two stages where the sentence on screen contradicts the record
 * beside it.
 *
 * `BOOK_TRANSPORT` writes `"Awaiting a transport provider response"`. `TRANSPORT_ACCEPTED` records
 * the provider's answer and `TRANSPORT_EN_ROUTE` records the vehicle setting off, and until this
 * section existed NEITHER touched the blocker — so a movement whose ambulance was on the road went
 * on telling the coordinator that the provider had not answered. The console renders this field as
 * **Response** and as **Current blocker**, so it is read as both.
 *
 * That is not staleness in the ordinary sense. `acceptedAt` is set: the record itself contains the
 * answer the sentence says is outstanding, on the same screen, at the same moment.
 */
describe("the transport legs restate what is holding a movement up", () => {
  function throughToEnRoute() {
    let state = seedWardFlowState();
    const department = allEmergencyDepartments()[0];
    state = wardFlowReducer(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: department.id,
      draft: {
        urgency: 2,
        cohort: "Adult",
        security: "Open",
        sex: "Male",
        specialling: false,
        legalStatus: "Voluntary",
        legalFormCode: null,
      },
    });
    const created = state.movements[state.movements.length - 1];
    if (!created) throw new Error("RAISE_REFERRAL created no movement");
    const movementId = created.id;
    const unit = state.units.find((candidate) => candidate.empty.value > 0 && candidate.allocatable.value > 0);
    if (!unit) throw new Error("the seed contains no unit with a free bed");

    const dispatch = (event: Parameters<typeof wardFlowReducer>[1]) => {
      const before = state.rejections.length;
      state = wardFlowReducer(state, event);
      expect(state.rejections.length, `${event.type} was refused: ${state.rejections.at(-1)?.reason}`).toBe(before);
    };

    dispatch({ type: "REFER_TO_UNITS", role: "coordinator", now: NOW + 10, movementId, unitIds: [unit.id] });
    dispatch({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", now: NOW + 20, movementId, unitId: unit.id });
    dispatch({ type: "PULL_PATIENT", role: "ward", now: NOW + 30, movementId, unitId: unit.id });
    dispatch({
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 40,
      movementId,
      provider: "Ambulance service",
      escortRequired: false,
    });
    dispatch({ type: "HANDOVER_READY", role: "ed", now: NOW + 50, movementId });
    const booked = movement(state, movementId).blocker;
    dispatch({ type: "TRANSPORT_ACCEPTED", role: "officer", now: NOW + 55, movementId });
    const accepted = movement(state, movementId).blocker;
    dispatch({ type: "TRANSPORT_EN_ROUTE", role: "officer", now: NOW + 60, movementId });
    const enRoute = movement(state, movementId).blocker;
    return { state, movementId, booked, accepted, enRoute };
  }

  it("no longer claims the provider has not answered once the ambulance is on the road", () => {
    // The smallest proof of the defect, and the one that was red before the fix: at this instant
    // `transport.enRouteAt` is set, so the record says the provider answered AND set off while the
    // sentence beside it said they had not answered at all.
    const { enRoute } = throughToEnRoute();
    expect(enRoute).not.toBe(STAGE_TRANSITION_BLOCKERS.transportBooked);
  });

  it("says something true at each of the three transport moments, and three different things", () => {
    const { booked, accepted, enRoute } = throughToEnRoute();
    expect(booked).toBe(STAGE_TRANSITION_BLOCKERS.transportBooked);
    expect(accepted).toBe(STAGE_TRANSITION_BLOCKERS.transportAccepted);
    expect(enRoute).toBe(STAGE_TRANSITION_BLOCKERS.transportEnRoute);
    // Three distinct sentences, asserted directly: two of them collapsing would put one reading on
    // two situations, which is the defect this whole file exists for one layer down.
    expect(new Set([booked, accepted, enRoute]).size).toBe(3);
  });

  it("also stops the record itself contradicting the sentence, which is the sharper failure", () => {
    // Not "the sentence is old" but "the movement carries both halves of a contradiction". At this
    // point `acceptedAt` is set, so a screen showing both is showing an answer and a claim that no
    // answer exists.
    const { state, movementId } = throughToEnRoute();
    const moved = movement(state, movementId);
    expect(moved.transport?.acceptedAt).toBeDefined();
    expect(moved.transport?.enRouteAt).toBeDefined();
    expect(moved.transport?.collectedAt).toBeUndefined();
    expect(moved.blocker).not.toContain("has not");
    expect(moved.blocker).toBe(STAGE_TRANSITION_BLOCKERS.transportEnRoute);
  });

  /**
   * ⚠️ THE CONSTRAINT THAT MAKES THE REWORDING SAFE, AND IT IS NOT OBVIOUS.
   *
   * `hasActiveBlocker` (ward-priority.ts) decides "nothing is blocking" by EXACT match against
   * `BLOCKERS_MEANING_NOTHING_IS_BLOCKING`, and `operationalScore` awards ten points when it says
   * something is. A new sentence phrased as an absence would therefore have silently dropped ten
   * points off every movement at these two stages — a changed RANKING, produced by an edit that
   * looked like copy. The whole point of the two new values is that they are genuine blockers.
   */
  it("moves no operational score: the verdict is identical before and after the rewording", () => {
    const { state, movementId } = throughToEnRoute();
    const moved = movement(state, movementId);
    const at = NOW + 60;

    const scoreWith = (blocker: string) => operationalScore({ ...moved, blocker }, at);
    const before = scoreWith(STAGE_TRANSITION_BLOCKERS.transportBooked);

    for (const sentence of [STAGE_TRANSITION_BLOCKERS.transportAccepted, STAGE_TRANSITION_BLOCKERS.transportEnRoute]) {
      const after = scoreWith(sentence);
      expect(after.score, `"${sentence}" changed the operational score`).toBe(before.score);
      expect(
        after.factors.map((factor) => factor.label),
        sentence,
      ).toEqual(before.factors.map((factor) => factor.label));
      // Stated positively as well as by equality: both old and new are ACTIVE blockers. An
      // equality assertion alone would also pass if the ten points vanished from both sides.
      expect(
        after.factors.map((factor) => factor.label),
        sentence,
      ).toContain("Active blocker");
    }
  });

  it("keeps both new sentences out of the closed 'nothing is blocking' set", () => {
    // The membership check the score's exact-match recogniser actually performs, asserted directly
    // as well as through the score above — a recogniser that had stopped being consulted would
    // pass the score comparison and fail this.
    for (const sentence of [STAGE_TRANSITION_BLOCKERS.transportAccepted, STAGE_TRANSITION_BLOCKERS.transportEnRoute]) {
      expect(BLOCKERS_MEANING_NOTHING_IS_BLOCKING as readonly string[], sentence).not.toContain(sentence);
      expect(sentence.startsWith("None"), sentence).toBe(false);
    }
  });
});
