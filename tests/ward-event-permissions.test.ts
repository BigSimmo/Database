import { describe, expect, it } from "vitest";

import { EVENT_ROLE, WARD_FLOW_ROLE_LABELS } from "../src/components/ward-management/ward-flow-events";

/**
 * WHO MAY DO WHAT, written out by hand and compared for exact equality.
 *
 * WHY THIS EXISTS, and it is not a hypothetical. On 2026-08-30 three permissions were widened —
 * `RAISE_REFERRAL` from `["ed"]`, and `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` from `["coordinator"]` —
 * and the entire ward suite stayed green. Nothing pinned the table. Every test that touches roles
 * reads `EVENT_ROLE[type][0]` FROM THE SOURCE, so both sides of every such assertion came from the
 * same place and no change to a permission could ever fail one.
 *
 * That is a permissions table with no guard, which is worse than an unguarded ordinary constant:
 * widening one is invisible in a diff review that is looking at the feature, and the widening
 * carried a real defect with it — the reducer went on recording every referral decision as the
 * coordinator's after a ward could make one.
 *
 * SO THIS LIST IS HAND-WRITTEN AND MUST STAY HAND-WRITTEN. Deriving it from `EVENT_ROLE` would
 * reproduce exactly the hole it closes. Updating it is the deliberate act; if a permission change
 * is right, change both and say which ruling permitted it.
 */
describe("who may raise which event", () => {
  const PERMISSIONS: Record<string, string[]> = {
    ACCEPT_IN_PRINCIPLE: ["ward"],
    // `ed` added 2026-08-30 under FD-3 AS SUPERSEDED BY THE OWNER: "every referral is
    // declinable, and NO CODE PATH MAY RENDER A REFERRAL WITH NO DECLINE AFFORDANCE". The ED
    // hub acts as `ed`, so without it an emergency department could not answer a referral
    // addressed to it — and the available workaround was to dispatch as `ward`, which writes
    // a FALSE `decidedBy` saying a ward refused what an ED refused.
    //
    // What the reducer writes for the newly-permitted role, as this guard demands:
    // `WARD_FLOW_ROLE_LABELS.ed`, a ROLE and never a person, so the record is truthful.
    // ⚠️ And the widening is SCOPED in the reducer rather than by this list: a role answers
    // its own destination kind and nothing else, so `ed` cannot decide on a ward bed and
    // `ward` can no longer decide on an emergency department's referral — which it could.
    // Pinned in `tests/ward-referral-decision-scope.test.ts`.
    ACCEPT_REFERRAL: ["ward", "coordinator", "ed"],
    ADD_PATIENT: ["ed", "community", "coordinator"],
    ADVANCE_CLOCK: ["demo"],
    BLOCK_BED_RELEASE: ["ward"],
    // CHANGED 2026-08-30 under TR-D6 (owner), and this row is a NARROWING plus a widening, not
    // a tidy-up. Was ["coordinator", "ward"]. The ruling: the team that BOOKED it and the
    // coordinator may cancel; the RECEIVING ward may not, because a booking cancelled by the
    // destination is indistinguishable on the sending board from one that failed. Every
    // movement originates at an emergency department (`Movement.originEdId` is required), so
    // the booking team is `ed`.
    //
    // What the reducer writes for the newly-permitted role, as this guard demands: `ed` lands
    // in the `transport_cancelled` unwind record as `by`, which is a ROLE and never a person —
    // so no false attribution is introduced. Asserted directly in
    // `tests/ward-transport-cancel-permission.test.ts`.
    // `TR-D1` (OWNER, 2026-08-30): the sending ward or ED arranges transport, because the sending
    // team knows the facts the booking needs — whether an escort is required, whether the patient
    // is settled enough to travel. ⚠️ The bed COORDINATOR was rejected by name: it owns the bed
    // search and does not know the patient's state. `TR-D5` generalises it past bed placement,
    // which is why `ward` is here too.
    //
    // ⚠️ The asymmetry with CANCEL_TRANSPORT below is deliberate and is the interesting part: the
    // coordinator may CANCEL but may not BOOK. Booking needs knowledge of the patient; noticing a
    // booking that has become wrong needs knowledge of the whole network, which `CO-D2` says only
    // the coordinator has.
    //
    // What the reducer writes for these roles: `provider` from `TRANSPORT_PROVIDERS` and the
    // `escortRequired` answer the caller gave — no role name, no person, and nothing derived.
    //
    // `community` ADDED 2026-09-01 (OWNER): the booking belongs to whoever is SENDING the patient,
    // and a community team is one of those senders.
    //
    // What the reducer writes for the newly-permitted role, as this guard demands: NOTHING that
    // names the caller. `BOOK_TRANSPORT` stores `provider` and the `escortRequired` answer and no
    // role, team or person — so a community booking is byte-identical to the ED's, and no false
    // attribution can enter with the widening. Asserted directly in `tests/ward-book-transport.test.ts`.
    //
    // ⚠️ And the widening is NOT scoped, because the model cannot scope it yet:
    // `Movement.originEdId` is required and `RAISE_REFERRAL` refuses an id that is not a real
    // emergency department, so there is no community-origin movement for it to be scoped to. A
    // community caller may book for ANY pulled movement. Recorded, not silently accepted.
    BOOK_TRANSPORT: ["ed", "ward", "community"],
    CANCEL_TRANSPORT: ["coordinator", "ed"],
    CHANGE_LEGAL_STATUS: ["coordinator", "ed"],
    CHANGE_URGENCY: ["coordinator", "ed"],
    CLEAR_BED_RELEASE_BLOCK: ["ward"],
    CONFIRM_BED_RELEASE: ["ward"],
    CONFIRM_CAPACITY: ["ward"],
    DECLINE: ["ward"],
    // `ed` added 2026-08-30 under FD-3 AS SUPERSEDED BY THE OWNER: "every referral is
    // declinable, and NO CODE PATH MAY RENDER A REFERRAL WITH NO DECLINE AFFORDANCE". The ED
    // hub acts as `ed`, so without it an emergency department could not answer a referral
    // addressed to it — and the available workaround was to dispatch as `ward`, which writes
    // a FALSE `decidedBy` saying a ward refused what an ED refused.
    //
    // What the reducer writes for the newly-permitted role, as this guard demands:
    // `WARD_FLOW_ROLE_LABELS.ed`, a ROLE and never a person, so the record is truthful.
    // ⚠️ And the widening is SCOPED in the reducer rather than by this list: a role answers
    // its own destination kind and nothing else, so `ed` cannot decide on a ward bed and
    // `ward` can no longer decide on an emergency department's referral — which it could.
    // Pinned in `tests/ward-referral-decision-scope.test.ts`.
    DECLINE_REFERRAL: ["ward", "coordinator", "ed"],
    END_LEAVE_BED: ["ward"],
    FLAG_BED_RELEASE: ["ward"],
    HANDOVER_READY: ["ed"],
    /* Widened from ["ward"] on 2026-09-01 by owner ruling: a pull is a person's act, from the ward
     * menu OR the coordinator. Named here deliberately rather than widened by accident, per this
     * file's own instruction. */
    PULL_PATIENT: ["ward", "coordinator"],
    PATIENT_ARRIVED: ["officer"],
    PATIENT_COLLECTED: ["officer"],
    RAISE_REFERRAL: ["ed", "community", "ward"],
    RECEIVE_REFERRAL: ["community"],
    RECORD_ESCALATION: ["coordinator"],
    RECORD_EXAMINATION: ["ed"],
    RECORD_MEDICAL_CLEARANCE: ["ed"],
    RECORD_LEAVE_BED: ["ward"],
    RECORD_LOCAL_BED_SOUGHT: ["coordinator"],
    REFER_TO_UNITS: ["coordinator"],
    /* A ward records that one of its own patients has left. Ward-only because it is a statement
     * about that ward's own beds - see `RECORD_LEAVING` in the reducer, which refuses any acting
     * unit other than the one holding the admission. */
    RECORD_LEAVING: ["ward"],
    /* ADDED 2026-09-01. Two new events, one fact: a ward records that one of its own occupants has
     * gone out to an emergency department, and that they are back. Ward-only for the reason
     * `RECORD_LEAVING` directly above is — it is a statement about that ward's own bed, and the
     * reducer refuses any acting unit other than the one holding the admission. The coordinator
     * cannot see somebody walk out of a building; an emergency department, which is where the
     * patient physically IS, holds no ward bed to act as.
     *
     * What the reducer writes for these roles, as this guard demands: an instant on the admission,
     * and `null` back again. No role name, no team, no person — so no false attribution can enter
     * with either, and no capacity figure moves in either direction. Asserted directly in
     * `tests/ward-away-at-emergency-department.test.ts`. */
    /* ADDED 2026-09-01. `Movement.blocker` — the free-prose one, NOT the `BedReleaseBlocker` enum
     * that shares the name — had one writer, at creation, and no transition ever touched it again.
     * This is the human half of the repair; `STAGE_TRANSITION_BLOCKERS` in the reducer is the other.
     *
     * The list mirrors `WITHDRAW_REFERRAL` below: whoever may raise a movement may say what is
     * holding it up, plus the coordinator. They are not interchangeable — a ward knows its bed
     * is not clean, an emergency department knows a family has not been reached, and only the
     * coordinator can say no bed exists anywhere in the network.
     *
     * ⚠️ WIDENED 2026-09-01 to add `officer`, and this row is where the change is deliberate rather
     * than incidental. The exclusion read "the transport legs already restate this field through
     * the events an officer raises", which was FALSE when written: an officer raises exactly four
     * events, and `TRANSPORT_ACCEPTED` and `TRANSPORT_EN_ROUTE` restated nothing, so the two legs
     * that made the standing sentence false were the two that left it stale. Both restate now — and
     * the premise still does not carry the exclusion, because every other permitted role also
     * raises restating events (`REFER_TO_UNITS`, `ACCEPT_IN_PRINCIPLE`, `BOOK_TRANSPORT`), so the
     * argument applied evenly would empty this list. What earns a seat here is being the only
     * observer of something: between `TRANSPORT_EN_ROUTE` and `PATIENT_COLLECTED` a diverted
     * ambulance or a stood-down crew has no event at all, and the officer is the only party who
     * sees it.
     *
     * What the reducer writes for these roles, as this guard demands: THE CALLER'S OWN PROSE AND
     * NOTHING ELSE — no role name, no team, no person — so none of the five can introduce a false
     * attribution, and the record never claims who said it. That is what makes the widening safe as
     * well as right. Asserted directly in `tests/ward-movement-blocker.test.ts`. */
    /* ADDED 2026-09-01, and this pair is the mechanism the owner asked for on 2026-08-30 that
     * nobody could reach: `Movement.flaggedUrgent` had a ranking rule above it and a badge below
     * it, and its only writer was the literal `false` at creation.
     *
     * ⚠️ The list MIRRORS `CHANGE_URGENCY` above deliberately. `queueOrder` puts this flag ABOVE
     * all three tiers, so it must not be easier to raise than the tier it outranks — a wider list
     * would let somebody who may not move a patient from tier 3 to tier 1 put them above every
     * tier 1 instead. `ward` is excluded by name: a receiving ward that could flag would be able
     * to promote the patient it is about to accept above every other ward's.
     *
     * What the reducer writes for these roles, as this guard demands: `flaggedUrgent: true` or
     * `false` and NOTHING else — no role, no reason, no timestamp — so neither role can introduce
     * a false attribution, because the record makes none. That absence is a known limit, recorded
     * on the events themselves. Asserted directly in `tests/ward-urgent-flag.test.ts`. */
    FLAG_MOVEMENT_URGENT: ["coordinator", "ed"],
    CLEAR_MOVEMENT_URGENT_FLAG: ["coordinator", "ed"],
    RECORD_MOVEMENT_BLOCKER: ["ed", "community", "ward", "coordinator", "officer"],
    /* ADDED 2026-09-01, repairing a hole `RECORD_MOVEMENT_BLOCKER` opened the same day: the field
     * accepted any prose while `hasActiveBlocker` recognised "nothing is blocking" case-sensitively,
     * so a person clearing a blocker with "none — resolved" left the movement scoring ten points as
     * obstructed. Clearing now has its own representation instead of a magic word.
     *
     * IDENTICAL to `RECORD_MOVEMENT_BLOCKER` above and deliberately never narrower: whoever may say
     * what is holding a patient up may say it has stopped. A clearing permission narrower than the
     * recording one is how a queue fills with obstructions nobody present can remove.
     *
     * `officer` added here with its partner on 2026-09-01: an officer who may record "ambulance
     * diverted" and may not then say it is resolved leaves a sentence only somebody who cannot see
     * the vehicle can retract, which is the narrower-clearing hole this row exists to refuse.
     *
     * What the reducer writes for these roles, as this guard demands: one fixed sentinel from
     * `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` and NOTHING else — no role, team or person — so none of
     * the five can introduce a false attribution. Asserted in `tests/ward-movement-blocker.test.ts`. */
    CLEAR_MOVEMENT_BLOCKER: ["ed", "community", "ward", "coordinator", "officer"],
    RECORD_AWAY_AT_EMERGENCY_DEPARTMENT: ["ward"],
    RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT: ["ward"],
    RELEASE_BED: ["ward"],
    RELEASE_PULL: ["coordinator", "ward"],
    REQUEST_CAPACITY_REFRESH: ["coordinator"],
    RESET_SCENARIO: ["demo"],
    REVERT_BED_RELEASE: ["ward"],
    SET_BED_PREPARATION: ["ward"],
    SET_SCENARIO: ["demo"],
    TRANSPORT_ACCEPTED: ["officer"],
    TRANSPORT_EN_ROUTE: ["officer"],
    /* Every role that can RAISE a referral can take it back, plus the coordinator. Deliberately
     * wider than `RAISE_REFERRAL`: withdrawal is refused by the reducer unless the referral is
     * still live and unaccepted, so the narrowing is done by state rather than by role. */
    WITHDRAW_REFERRAL: ["ed", "community", "ward", "coordinator"],
  };

  it("covers every event that exists, so a new event cannot arrive unpermissioned", () => {
    expect(Object.keys(EVENT_ROLE).sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  it("grants exactly these roles and no others", () => {
    for (const [event, roles] of Object.entries(PERMISSIONS)) {
      expect(
        [...EVENT_ROLE[event as keyof typeof EVENT_ROLE]],
        `${event}'s permitted roles changed. A permission is never widened by accident: name the ` +
          "ruling that permitted it, check what the reducer writes for the newly-permitted role, " +
          "and update this list deliberately.",
      ).toEqual(roles);
    }
  });

  it("gives every role a decision label, so a decision can never be recorded against a blank", () => {
    const roles = new Set(Object.values(PERMISSIONS).flat());
    expect(roles.size).toBeGreaterThan(1);
    for (const role of roles) {
      expect(WARD_FLOW_ROLE_LABELS[role as keyof typeof WARD_FLOW_ROLE_LABELS], `${role} has no label`).toBeTruthy();
    }
  });

  it("keeps the table discriminating — not every event permits every role", () => {
    // A table that granted everything to everyone would satisfy the assertions above just as well.
    const allRoles = new Set(Object.values(PERMISSIONS).flat());
    const singleRoleEvents = Object.values(PERMISSIONS).filter((roles) => roles.length === 1);
    expect(singleRoleEvents.length).toBeGreaterThan(0);
    expect(allRoles.size).toBeGreaterThan(2);
  });
});
