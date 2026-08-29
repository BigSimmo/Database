import type { Instant } from "@/components/ward-management/ward-clock";
import { BED_PREPARATION_NOTES, BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import {
  BED_RELEASE_WAITING_ON,
  COHORTS,
  HOME_REGIONS,
  PARALLEL_REFERRAL_CAP,
  REFERRAL_DECLINE_REASONS,
  REFERRAL_SOURCES,
  SEXES,
} from "@/components/ward-management/ward-model";
import type {
  BedRelease,
  LeaveBed,
  Movement,
  MovementStage,
  Referral,
  Rejection,
  Unit,
} from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds, referrals, wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { scenarioUnits, type WardScenario } from "@/components/ward-management/ward-scenarios";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Patient } from "@/components/ward-management/ward-patients";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Stages `REFER_TO_UNITS` accepts, exported so a UI surface can pre-check referability and gate
 * its own control before dispatching — never optimistically claim a referral happened and let
 * this be the thing that silently refuses it (Task 5 fix round 1: `ShortlistPanel` used to
 * dispatch and unconditionally render success, so a movement at, say, `bed_held` — still open,
 * still offering eligible candidates — showed "Referred by a human coordinator" while nothing
 * had happened). A single shared constant, used here AND by `ward-derivations.ts`'s
 * `referralBlockedReason`, so the two checks can never drift apart.
 */
export const REFERRABLE_MOVEMENT_STAGES: readonly MovementStage[] = ["placement_requested", "destination_review"];

/**
 * The whole of Task 3 onward is proved against this shape. Units live in state, not just
 * movements — the correction the design spec calls out explicitly: a ward that accepts, holds
 * and receives a patient with capacity that never moves makes the primary screen less true the
 * more it is used.
 */
export type WardFlowState = {
  movements: Movement[];
  units: Unit[];
  /** Refused transitions, newest first. */
  rejections: Rejection[];
  /** Demo jump-forward control. `now` is NOW_ANCHOR + elapsed + this offset, derived outside the reducer. */
  clockOffsetMinutes: number;
  /** Deterministic id source for referrals raised through RAISE_REFERRAL. No Math.random(). */
  referralSequence: number;
  /**
   * Fix round 2 (P2). Deterministic id source for leave beds raised through `RECORD_LEAVE_BED`,
   * independent of `state.leaveBeds.length` for the same reason `referralSequence` is independent
   * of `state.movements.length` — but here it actually matters, because `END_LEAVE_BED` REMOVES
   * entries (referrals are never removed, so `movements.length` would have been safe too).
   * Deriving the id from the array's length after removal makes ids repeat: record two, end the
   * first, record a third, and the third gets the first's id back — React sees duplicate `key`s,
   * and `END_LEAVE_BED`'s own id-filter then removes every leave bed sharing that id, silently
   * deleting the wrong record. This field only ever increases, so an id is never reused. No
   * `Math.random()`, same discipline as `referralSequence`.
   */
  leaveBedSequence: number;
  /** Which synthetic night is seeded — `ward-scenarios.ts`'s operational-numbers-only variants. */
  scenario: WardScenario;
  /**
   * Task 11 (spec item 9): beds expected to free up, now live reducer state rather than a frozen
   * fixture constant — `FLAG_BED_RELEASE` appends here, so a ward's own flag actually moves
   * `unitCapacity()`'s `potential` figure. Seeded from `ward-movements.ts`'s `bedReleases`.
   */
  bedReleases: BedRelease[];
  /**
   * Task 3: beds occupied by someone on approved leave, live reducer state for the same reason
   * `bedReleases` is — `RECORD_LEAVE_BED`/`END_LEAVE_BED` append to and remove from it, so a
   * ward's own report actually moves what the capacity board shows. Seeded from
   * `ward-movements.ts`'s `leaveBeds`. Never merged into availability (spec D4).
   */
  leaveBeds: LeaveBed[];
  /**
   * Task 3, spec D12: the one thing a coordinator may do to a ward's bed data. Recording a
   * request changes no bed figure at all — it is a record that somebody asked, with the time and
   * the requesting role, nothing more. `REQUEST_CAPACITY_REFRESH` appends here.
   */
  refreshRequests: { unitId: string; at: Instant; byRole: string }[];
  /**
   * Phase 7 Task 3 (spec "The front door", controller ruling P1): Task 1 added the `Referral`
   * type and a hand-authored fixture for it, but nothing wired either into live state — this is
   * that wiring. `RECEIVE_REFERRAL` appends here; `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` transition
   * an entry in place via `replaceReferral`, exactly the discipline `bedReleases` already holds to
   * (nothing here ever REMOVES a referral, the same reason `nextReferralId` above is safe to
   * derive from an ever-growing array — see `frontDoorReferralSequence`'s own comment for why the
   * id source itself still does not lean on that). Seeded from `ward-movements.ts`'s `referrals`.
   */
  referrals: Referral[];
  /**
   * Monotonic id source for `RECEIVE_REFERRAL`, mirroring `leaveBedSequence`'s own discipline:
   * only ever increases, never derived from `state.referrals.length` — see `leaveBedSequence`'s
   * doc comment above for the Phase 5 collision that discipline exists to prevent.
   *
   * Named `frontDoorReferralSequence` rather than the field the brief for this task literally
   * names ("referralSequence") for a reason worth recording rather than silently working around:
   * `referralSequence` already exists on this type, and already means something — it is the id
   * source `RAISE_REFERRAL` (an ED clinician referring a patient already in the department) uses
   * to mint `Movement` ids ("WF-9NN"). That field predates this phase by several commits and is a
   * completely different concept from Task 1's front-door `Referral` (a request for a bed from
   * anywhere in the network, before it is ever a `Movement`) — the two are both colloquially
   * "referrals" but neither the record they identify nor the id namespace they mint from is the
   * same thing. Reusing `referralSequence` for both would not corrupt any single record (the two
   * id formats — "WF-9NN" vs "RF-9NN" — never collide even sharing one counter), but it would
   * silently couple two independent concepts' id supplies for no reason, which is exactly the
   * kind of muddling this model's naming discipline (`leaveBedSequence` isolated from
   * `referralSequence` itself, `bedReleases` isolated from `leaveBeds`) exists to prevent. A
   * distinct name costs nothing and keeps the two things as separate as they actually are.
   */
  frontDoorReferralSequence: number;
  /**
   * The people in the beds. Task 17.
   *
   * WHY THIS IS HERE AT ALL. Until 2026-08-30 this reducer contained the word "admission" zero
   * times. `PATIENT_ARRIVED` closed the movement, decremented the unit's empty count and bumped its
   * sex mix - and created no record of the person. So a patient who reached a ward became a CLOSED
   * MOVEMENT and nothing else, and `isOpen` (`!closure && stage !== "arrived"`) removes closed
   * movements from ten surfaces: the queue, the coordinator inbox, handover, placement, patient
   * search, the pressure strip, the live tracker and the ED screen among them.
   *
   * The consequence is the owner's own foundation failing at its last step. A person gets from an
   * emergency department to a ward - the thing this prototype exists to show - and the
   * demonstration immediately stops being able to see them. Arrival was modelled as an ENDING with
   * nothing on the other side of it.
   *
   * Seeded from `ward-admissions-seed.ts` so the beds start occupied by the same people the board
   * already renders, and so an arrival appends a record OF THE SAME SHAPE rather than a second
   * kind of occupant that every consumer would have to learn about.
   */
  /**
   * The people. Owner ruling PD-1, 2026-08-30.
   *
   * Separate from `admissions` because the lifecycles are different, not because the data is. An
   * admission is a stay in one bed - correctly born at arrival, ended when the person leaves. A
   * patient exists before any referral, outlives every admission, and is the thing the owner's flow
   * searches for: "search a patient, and if nobody comes up, ADD them."
   *
   * A record created by arrival would look right on every screen showing admitted people and be
   * missing at exactly that moment.
   */
  patients: Patient[];
  /** Monotonic id source for added patients - same discipline as the other sequences here: only
   *  ever increases, never derived from `state.patients.length`, which the seed makes non-zero. */
  patientSequence: number;
  admissions: Admission[];
  /** Monotonic id source for admissions created by arrival, holding the same discipline as
   *  `leaveBedSequence` and `frontDoorReferralSequence`: only ever increases, and never derived
   *  from `state.admissions.length`, which the seed already makes non-zero. */
  admissionSequence: number;
};

/**
 * Deep-copies the frozen fixture so tests (and later, screens) never alias or mutate it.
 * Defaults to the standard night so `RESET_SCENARIO` (which calls this with no argument) always
 * returns to the standard night rather than staying on whichever scenario was active — an
 * explicit product-owner decision, not an oversight.
 */
export function seedWardFlowState(scenario: WardScenario = "standard"): WardFlowState {
  return {
    movements: structuredClone(wardMovements),
    units: scenarioUnits(scenario),
    rejections: [],
    clockOffsetMinutes: 0,
    referralSequence: 0,
    leaveBedSequence: 0,
    scenario,
    bedReleases: structuredClone(bedReleases),
    leaveBeds: structuredClone(leaveBeds),
    refreshRequests: [],
    referrals: structuredClone(referrals),
    frontDoorReferralSequence: 0,
    patients: structuredClone(wardPatients),
    patientSequence: 0,
    admissions: structuredClone(wardAdmissions),
    admissionSequence: 0,
  };
}

/** The id a rejection is filed against, for events that are not about one specific movement. */
function subjectId(event: WardFlowEvent): string {
  switch (event.type) {
    case "RAISE_REFERRAL":
      return event.edId;
    case "CONFIRM_CAPACITY":
    case "FLAG_BED_RELEASE":
    case "RECORD_LEAVE_BED":
    case "REQUEST_CAPACITY_REFRESH":
      return event.unitId;
    case "CONFIRM_BED_RELEASE":
    case "REVERT_BED_RELEASE":
    case "BLOCK_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
    case "SET_BED_PREPARATION":
    case "RELEASE_BED":
      return event.releaseId;
    case "END_LEAVE_BED":
      return event.leaveBedId;
    case "ACCEPT_REFERRAL":
    case "DECLINE_REFERRAL":
    case "RECORD_LOCAL_BED_SOUGHT":
      return event.referralId;
    case "ADVANCE_CLOCK":
    case "RESET_SCENARIO":
    case "SET_SCENARIO":
    // No referral yet exists to name a rejection against — the event that is rejected here is
    // the intake itself, exactly the same reasoning ADVANCE_CLOCK/RESET_SCENARIO/SET_SCENARIO
    // above already use.
    case "RECEIVE_REFERRAL":
    // A patient is not filed against a movement, and that is the point of the record rather than an
    // omission: they exist before any movement does.
    case "ADD_PATIENT":
      return "none";
    default:
      return event.movementId;
  }
}

/**
 * Stable, non-random id: derived from the movement/subject, the event type and how many
 * rejections this state already carries — never a module-level counter, which would make two
 * calls with identical (state, event) produce different results and break the reducer's purity.
 */
function makeRejection(state: WardFlowState, event: WardFlowEvent, reason: string): Rejection {
  const subject = subjectId(event);
  return {
    id: `rejection-${subject}-${event.type}-${state.rejections.length}`,
    at: event.now,
    movementId: subject,
    attempted: event.type,
    reason,
  };
}

function reject(state: WardFlowState, event: WardFlowEvent, reason: string): WardFlowState {
  return { ...state, rejections: [...state.rejections, makeRejection(state, event, reason)] };
}

function findMovement(state: WardFlowState, movementId: string): Movement | undefined {
  return state.movements.find((candidate) => candidate.id === movementId);
}

function findUnit(state: WardFlowState, unitId: string): Unit | undefined {
  return state.units.find((candidate) => candidate.id === unitId);
}

function findBedRelease(state: WardFlowState, releaseId: string): BedRelease | undefined {
  return state.bedReleases.find((candidate) => candidate.id === releaseId);
}

/** Replaces one bed release in the array by id, leaving every other element untouched. */
function replaceBedRelease(state: WardFlowState, releaseId: string, next: BedRelease): WardFlowState {
  return {
    ...state,
    bedReleases: state.bedReleases.map((candidate) => (candidate.id === releaseId ? next : candidate)),
  };
}

function findLeaveBed(state: WardFlowState, leaveBedId: string): LeaveBed | undefined {
  return state.leaveBeds.find((candidate) => candidate.id === leaveBedId);
}

function findReferral(state: WardFlowState, referralId: string): Referral | undefined {
  return state.referrals.find((candidate) => candidate.id === referralId);
}

/** Replaces one referral in the array by id, leaving every other element untouched — the same
 *  shape as `replaceBedRelease`/`replaceMovement` below. */
function replaceReferral(state: WardFlowState, referralId: string, next: Referral): WardFlowState {
  return {
    ...state,
    referrals: state.referrals.map((candidate) => (candidate.id === referralId ? next : candidate)),
  };
}

/** Replaces one movement in the array by id, leaving every other element untouched. */
function replaceMovement(state: WardFlowState, movementId: string, next: Movement): WardFlowState {
  return {
    ...state,
    movements: state.movements.map((candidate) => (candidate.id === movementId ? next : candidate)),
  };
}

function replaceUnit(state: WardFlowState, unitId: string, next: Unit): WardFlowState {
  return { ...state, units: state.units.map((candidate) => (candidate.id === unitId ? next : candidate)) };
}

function nextReferralId(sequence: number): string {
  // "WF-9NN" — the 9 prefix keeps runtime-raised referrals visibly distinct from the
  // hand-authored and generated WF-0xx/WF-1xx..WF-4xx fixture ids.
  return `WF-9${String(sequence).padStart(2, "0")}`;
}

/**
 * Fix round 2 (P2). Mirrors `nextReferralId` above, but from `leaveBedSequence` rather than
 * `state.leaveBeds.length` — see that field's own doc comment on `WardFlowState` for why the
 * length-based id `RECORD_LEAVE_BED` used to derive collides once `END_LEAVE_BED` has removed an
 * earlier entry.
 */
function nextLeaveBedId(sequence: number): string {
  // "WL-9NN" mirrors FLAG_BED_RELEASE's own "WR-9NN" — visibly distinct from the hand-authored
  // "WL-00N" fixture ids.
  return `WL-9${String(sequence).padStart(2, "0")}`;
}

/**
 * Mirrors `nextReferralId`/`nextLeaveBedId` above — derived from `frontDoorReferralSequence`,
 * never from `state.referrals.length` (see that field's own doc comment on `WardFlowState`).
 * "RF-9NN" mirrors the fixture's own "RF-00N" ids (`ward-movements.ts`) and the "9" prefix every
 * other runtime-created id in this reducer uses, visibly distinct from the hand-authored fixture.
 */
function nextFrontDoorReferralId(sequence: number): string {
  return `RF-9${String(sequence).padStart(2, "0")}`;
}

export function wardFlowReducer(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  // 1. Role check first, before the event's payload is inspected at all.
  const permittedRoles = EVENT_ROLE[event.type];
  if (!permittedRoles.includes(event.role)) {
    return reject(
      state,
      event,
      `${event.type} requires role ${permittedRoles.join(" or ")}, but was raised by role ${event.role}`,
    );
  }

  switch (event.type) {
    // A reset re-anchors onto the demo's CURRENT now rather than handing back a fixture authored
    // at NOW_ANCHOR. Without this, a reset forty minutes into a demonstration returns predictions
    // that are already lapsed against a clock that has moved on - the exact defect Task 1 exists to
    // remove, reappearing on the one control a presenter reaches for when something looks wrong.
    //
    // `event.now` is the provider's now and already includes `clockOffsetMinutes`, which a reset
    // clears. Subtracting it lands the seed on the now the board will show AFTER the reset rather
    // than the one it showed before, so the visible clock does not jump.
    case "ADD_PATIENT": {
      /**
       * The whole case, and it is short on purpose: adding a patient links to nothing.
       *
       * No movement, no referral, no unit, no admission. That is what makes the owner's flow
       * possible - somebody searched, nobody came up, and this is the person who did not exist yet.
       * A version of this that required any of those would be the too-late record wearing a
       * different name.
       */
      const patient: Patient = {
        id: `PT-A${String(state.patientSequence + 1).padStart(2, "0")}`,
        umrn: event.umrn,
        givenName: event.givenName,
        familyName: event.familyName,
        dateOfBirth: event.dateOfBirth,
      };
      return { ...state, patients: [...state.patients, patient], patientSequence: state.patientSequence + 1 };
    }

    case "RESET_SCENARIO":
      return shiftInstants(seedWardFlowState(), event.now - state.clockOffsetMinutes - NOW_ANCHOR);

    case "SET_SCENARIO":
      return shiftInstants(seedWardFlowState(event.scenario), event.now - state.clockOffsetMinutes - NOW_ANCHOR);

    case "ADVANCE_CLOCK":
      return { ...state, clockOffsetMinutes: state.clockOffsetMinutes + event.minutes };

    case "RAISE_REFERRAL": {
      const department = allEmergencyDepartments().find((ed) => ed.id === event.edId);
      if (!department) {
        return reject(state, event, `no emergency department found for id ${event.edId}`);
      }
      const sequence = state.referralSequence + 1;
      // The clinician chooses the form on the intake form; nothing here derives one from
      // `legalStatus` any more (product owner, 2026-08-24: "avoid any hard rules now please …
      // I can choose what option in the patient selection"). `null` means the clinician chose
      // no form, which is a real answer and not a missing one.
      //
      // A code the picker cannot offer is REFUSED rather than quietly dropped: silently
      // attaching no form would discard a choice the clinician did make, and inventing a form
      // for an unknown code is the fabrication this model exists to prevent.
      const chosenCode = event.draft.legalFormCode;
      const chosenForm =
        chosenCode === null ? undefined : SELECTABLE_LEGAL_FORMS.find((form) => form.code === chosenCode);
      if (chosenCode !== null && chosenForm === undefined) {
        return reject(state, event, `no selectable legal form found for code ${chosenCode}`);
      }
      const created: Movement = {
        id: nextReferralId(sequence),
        originEdId: event.edId,
        openedAt: event.now,
        urgency: event.draft.urgency,
        cohort: event.draft.cohort,
        security: event.draft.security,
        sex: event.draft.sex,
        specialling: event.draft.specialling,
        legalStatus: event.draft.legalStatus,
        // Spread-copied, never aliased: `SELECTABLE_LEGAL_FORMS`'s entries are the picker's
        // own source and must not become mutable state hanging off a movement.
        legalForm: chosenForm === undefined ? undefined : { ...chosenForm },
        statusChanges: [],
        urgencyChanges: [],
        stage: "placement_requested",
        owner: department.name,
        referredUnitIds: [],
        declines: [],
        blocker: "Awaiting coordinator referral",
        withdrawnReferrals: [],
        unwinds: [],
        // `formedAt` is deliberately left unset. It used to be stamped in this same branch, on
        // the strength of the status-derived Form 1A that has now been deleted; with that
        // derivation gone there is no rule left to hang it on, and inventing a replacement one
        // would be exactly the kind of hidden rule this change removes. When a patient was
        // formed in the community is a fact only a clinician holds, so until there is a field
        // for it, a runtime-raised referral has no `formedAt` and its legal clock coincides
        // with its department clock. The fixture keeps its own authored values.
      };
      return {
        ...state,
        movements: [...state.movements, created],
        referralSequence: sequence,
      };
    }

    case "RECORD_EXAMINATION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Defence in depth, added 2026-08-24. Every other movement-scoped handler already refuses a
      // closed movement; this one did not, so an examination could be recorded against a patient
      // who had already ARRIVED and its `did_not_proceed` closure would overwrite the arrival —
      // reproduced by walking WF-001 to `arrived` and dispatching a `revoked` examination, which
      // was accepted with zero rejections. Pre-existing (it was previously reachable only for a
      // Form 1A) and widened by this change to every code and to no form at all. Not reachable
      // from the ED screen today, which lists only open movements, so this closes the reducer
      // path rather than a live defect.
      if (movement.closure) {
        return reject(state, event, `cannot record an examination for a closed movement (${movement.closure.reason})`);
      }
      // No form gate. An examination may be recorded for ANY patient, whatever form they carry
      // and whether or not they carry one (product owner, 2026-08-24) — the software no longer
      // decides which form a patient is on, so it has no business deciding who may be examined.
      // The guard below is different in kind and stays: recording two examinations against one
      // movement is a data-integrity fault, not a form rule.
      if (movement.examination) {
        return reject(state, event, `movement ${movement.id} was already examined`);
      }

      if (event.outcome === "inpatient_order") {
        // The examination is recorded and NOTHING else changes. The 1A-to-3B replacement that
        // used to happen here is deleted: a form now changes only when a clinician changes it.
        const updated: Movement = {
          ...movement,
          examination: { at: event.now, outcome: event.outcome },
        };
        return replaceMovement(state, movement.id, updated);
      }

      // community_order or revoked: the patient does not proceed to an inpatient bed, so the
      // record closes. The form is deliberately LEFT AS IT IS — clearing it here was one of the
      // three hidden rules deleted on 2026-08-24. Everything else this closure does is
      // unaffected and load-bearing: it has to unwind whatever
      // downstream placement state the movement was carrying — an in-flight transport job and
      // a bed already held at the accepted unit — rather than leaving both dangling: every
      // downstream handler below now also rejects once `movement.closure` is set (the same
      // signal `isOpenMovement` in ward-derivations.ts already treats as authoritative), but
      // that only stops *further* progress; it does not by itself give back capacity already
      // reserved by an earlier HOLD_BED.
      const heldStages: MovementStage[] = ["bed_held", "handover_ready", "moving"];
      const releasedState =
        movement.acceptedUnitId && heldStages.includes(movement.stage)
          ? (() => {
              const heldUnit = findUnit(state, movement.acceptedUnitId!);
              if (!heldUnit) return state;
              const releasedUnit: Unit = {
                ...heldUnit,
                allocatable: { ...heldUnit.allocatable, value: heldUnit.allocatable.value + 1, confirmedAt: event.now },
              };
              return replaceUnit(state, heldUnit.id, releasedUnit);
            })()
          : state;
      const updated: Movement = {
        ...movement,
        examination: { at: event.now, outcome: event.outcome },
        transport:
          movement.transport && movement.transport.cancelledAt === undefined
            ? { ...movement.transport, cancelledAt: event.now }
            : movement.transport,
        closure: { at: event.now, outcome: "did_not_proceed", reason: `examination outcome ${event.outcome}` },
      };
      return replaceMovement(releasedState, movement.id, updated);
    }

    case "REFER_TO_UNITS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot refer a closed movement (${movement.closure.reason})`);
      }
      if (event.unitIds.length > PARALLEL_REFERRAL_CAP) {
        return reject(
          state,
          event,
          `cannot refer to ${event.unitIds.length} units at once — the parallel cap is ${PARALLEL_REFERRAL_CAP}`,
        );
      }
      if (!REFERRABLE_MOVEMENT_STAGES.includes(movement.stage)) {
        return reject(state, event, `cannot refer a movement while it is ${movement.stage}`);
      }
      const unknown = event.unitIds.find((unitId) => !findUnit(state, unitId));
      if (unknown) {
        return reject(state, event, `no unit found for id ${unknown}`);
      }
      const updated: Movement = {
        ...movement,
        referredUnitIds: [...event.unitIds],
        stage: "destination_review",
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "ACCEPT_IN_PRINCIPLE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot accept a closed movement (${movement.closure.reason})`);
      }
      if (movement.acceptedUnitId) {
        const already = findUnit(state, movement.acceptedUnitId);
        const attemptedUnit = findUnit(state, event.unitId);
        return reject(
          state,
          event,
          `movement ${movement.id} is already accepted at ${already?.name ?? movement.acceptedUnitId}; the referral to ${attemptedUnit?.name ?? event.unitId} was withdrawn`,
        );
      }
      if (movement.stage !== "destination_review") {
        return reject(state, event, `cannot accept a movement while it is ${movement.stage}`);
      }
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      const acceptedUnit = findUnit(state, event.unitId);
      if (!acceptedUnit) return reject(state, event, `no unit found for id ${event.unitId}`);

      const withdrawn = movement.referredUnitIds
        .filter((unitId) => unitId !== event.unitId)
        .map((unitId) => ({ unitId, at: event.now, reason: `withdrawn — placed at ${acceptedUnit.name}` }));

      const updated: Movement = {
        ...movement,
        acceptedUnitId: event.unitId,
        // Fix round 1 (Task 9): the instant this acceptance happened, recorded directly rather
        // than left to survive only as an incidental `withdrawnReferrals` side effect of a
        // multi-unit referral. See `Movement.acceptedAt`'s own doc comment.
        acceptedAt: event.now,
        stage: "accepted_awaiting_bed",
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawn],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "HOLD_BED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot hold a bed for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "accepted_awaiting_bed") {
        return reject(state, event, `cannot hold a bed while the movement is ${movement.stage}`);
      }
      if (movement.acceptedUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `movement ${movement.id} was accepted at ${movement.acceptedUnitId ?? "no unit"}, not ${event.unitId}`,
        );
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      if (unit.allocatable.value <= 0) {
        return reject(state, event, `no allocatable bed remains at ${unit.name} (bed_held_for_earlier_referral)`);
      }

      const updatedUnit: Unit = {
        ...unit,
        allocatable: { ...unit.allocatable, value: unit.allocatable.value - 1, confirmedAt: event.now },
      };
      const updatedMovement: Movement = {
        ...movement,
        stage: "bed_held",
        bedHeldUntil: event.now + 60,
      };
      /**
       * TASK 17. The patient becomes a person in a bed, and this is the line whose absence made
       * them vanish.
       *
       * Before this, arrival closed the movement and moved two numbers on the unit. `isOpen` then
       * removed the closed movement from ten surfaces, so the demonstration lost sight of somebody
       * at the exact moment it had succeeded in placing them. The bed count changed and the person
       * did not exist anywhere.
       *
       * Built in the SAME SHAPE the seed builds, so every consumer that already renders an occupant
       * renders this one too, with no second kind of occupant to learn about.
       *
       * Two fields are `null` and each says something true rather than missing:
       *
       *   `referralId`  - this admission came from a `Movement`, not a `Referral`. Movements carry
       *                   no referral, and minting an id pointing at nothing would be worse than
       *                   saying so.
       *   `homeRegion`  - the fact does not exist on a movement anywhere in the model, and the
       *                   owner has an open ruling on whether SUBURB or region is the thing
       *                   recorded. Deriving it from the origin emergency department would be
       *                   inventing it: where somebody was admitted from is not where they live.
       *                   Every consumer says "home region not recorded" rather than guessing, and
       *                   the out-of-area figures skip them rather than counting them wrongly.
       *
       * `pulledAt` is the transport's own collection instant rather than a fresh stamp - the ward
       * pulled this person when transport collected them, and re-stamping it here would quietly
       * shorten every wait that figure feeds.
       */
      const admission: Admission = {
        id: `AD-ARR-${String(state.admissionSequence + 1).padStart(2, "0")}`,
        unitId: unit.id,
        referralId: null,
        sex: movement.sex,
        homeRegion: null,
        tentativeDiagnosis: null,
        state: "occupied",
        pulledAt: movement.transport?.collectedAt ?? null,
        arrivedAt: event.now,
        expectedDischargeAt: null,
        dischargeDateMoves: 0,
        dischargeDateSetAt: null,
        dischargeDateSetBy: null,
        dischargeConfirmedAt: null,
        dischargeConfirmedBy: null,
        blockReason: null,
        leavingDestination: null,
        leftAt: null,
      };

      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      const withPerson: WardFlowState = {
        ...withUnit,
        admissions: [...withUnit.admissions, admission],
        admissionSequence: withUnit.admissionSequence + 1,
      };
      return replaceMovement(withPerson, movement.id, updatedMovement);
    }

    case "DECLINE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot decline for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "destination_review") {
        return reject(state, event, `cannot decline while the movement is ${movement.stage}`);
      }
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      const updated: Movement = {
        ...movement,
        referredUnitIds: movement.referredUnitIds.filter((unitId) => unitId !== event.unitId),
        declines: [
          ...movement.declines,
          { unitId: event.unitId, at: event.now, reason: event.reason, note: event.note },
        ],
        stage: "destination_review",
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "HANDOVER_READY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot ready a handover for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "bed_held") {
        return reject(state, event, `cannot ready a handover while the movement is ${movement.stage}`);
      }
      const updated: Movement = {
        ...movement,
        stage: "handover_ready",
        transport: {
          id: `${movement.id}-transport`,
          provider: "State patient transport service",
          escortRequired: movement.legalStatus !== "Voluntary",
        },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "TRANSPORT_ACCEPTED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot accept transport for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "handover_ready" || !movement.transport) {
        return reject(state, event, `cannot accept transport while the movement is ${movement.stage}`);
      }
      if (movement.transport.acceptedAt) {
        return reject(state, event, `transport for movement ${movement.id} was already accepted`);
      }
      const updated: Movement = {
        ...movement,
        transport: { ...movement.transport, acceptedAt: event.now },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "TRANSPORT_EN_ROUTE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot move transport for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "handover_ready" || !movement.transport?.acceptedAt) {
        return reject(state, event, `cannot mark transport en route before it has been accepted`);
      }
      if (movement.transport.enRouteAt) {
        return reject(state, event, `transport for movement ${movement.id} is already en route`);
      }
      const updated: Movement = {
        ...movement,
        transport: { ...movement.transport, enRouteAt: event.now },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "PATIENT_COLLECTED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot collect a patient for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "handover_ready" || !movement.transport?.enRouteAt) {
        return reject(state, event, `cannot collect a patient before transport is en route`);
      }
      const updated: Movement = {
        ...movement,
        stage: "moving",
        transport: { ...movement.transport, collectedAt: event.now },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "PATIENT_ARRIVED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot arrive a patient for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "moving" || !movement.transport?.collectedAt) {
        return reject(state, event, `cannot arrive a patient while the movement is ${movement.stage}`);
      }
      if (!movement.acceptedUnitId) {
        return reject(state, event, `movement ${movement.id} has no accepted destination unit`);
      }
      const unit = findUnit(state, movement.acceptedUnitId);
      if (!unit) return reject(state, event, `no unit found for id ${movement.acceptedUnitId}`);
      if (unit.empty.value <= 0) {
        // Reachable in practice: HOLD_BED's own floor check only bounds `allocatable.value`, and
        // CONFIRM_CAPACITY can raise `allocatable.value` back above `empty.value` after earlier
        // arrivals have already consumed the physically empty beds. Without this guard a later
        // arrival would drive `empty.value` negative.
        return reject(state, event, `no physically empty bed remains at ${unit.name} (no_bed)`);
      }

      const updatedUnit: Unit = {
        ...unit,
        empty: { ...unit.empty, value: unit.empty.value - 1, confirmedAt: event.now },
        sexMix: { ...unit.sexMix, [movement.sex]: (unit.sexMix[movement.sex] ?? 0) + 1 },
      };
      const updatedMovement: Movement = {
        ...movement,
        stage: "arrived",
        transport: { ...movement.transport, arrivedAt: event.now },
        closure: { at: event.now, outcome: "arrived", reason: "Patient arrived at the accepting unit" },
      };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      return replaceMovement(withUnit, movement.id, updatedMovement);
    }

    case "CONFIRM_CAPACITY": {
      // The role check above only proves *a* ward raised this. It does not say *which* ward, so
      // before this a ward user on unit A could restate unit B's allocatable count.
      //
      // What this check does: it compares the unit the caller said it was acting as against the
      // unit being written to, and refuses the event when they differ. What it does not do: prove
      // the claim. `actingUnitId` is whatever the call site put on the event — the ward screen
      // reads it from its own `/mockups/ward-flow/ward/[unitId]` route, but nothing here verifies
      // that, and this prototype carries no authenticated actor identity to verify it against.
      // This is a recorded assertion by the caller, not an authorisation decision, and must not
      // be described or extended as one.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      const updatedUnit: Unit = {
        ...unit,
        allocatable: { ...unit.allocatable, value: event.value, source: "ward", confirmedAt: event.now },
      };
      return replaceUnit(state, unit.id, updatedUnit);
    }

    case "FLAG_BED_RELEASE": {
      // Same claim-not-proof discipline as CONFIRM_CAPACITY (see that case's own comment in
      // full): this compares what the caller SAID it was acting as against the unit the release
      // is being written to, and refuses when they differ. It does not authenticate anything —
      // `FLAG_BED_RELEASE` is `ward`-only, so unlike RELEASE_HOLD/CANCEL_TRANSPORT there is no
      // coordinator caller to exempt, and the comparison always runs.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `FLAG_BED_RELEASE was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const flaggedUnit = findUnit(state, event.unitId);
      if (!flaggedUnit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // Review Finding 1: a typed caller cannot construct this event with a `blocker` outside
      // `BED_RELEASE_BLOCKERS` — it is a required union member, not a plain `string`. This check
      // exists for the untyped caller anyway: "Blockers are chosen, never typed" (binding spec)
      // is a runtime rule, not merely a compile-time one, so a defined `blocker` is checked by
      // real membership, not by truthiness alone.
      if (event.blocker !== undefined && !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
        return reject(state, event, `FLAG_BED_RELEASE blocker must be chosen from BED_RELEASE_BLOCKERS`);
      }
      // Bed-model rework (2026-08-28): a flag ALWAYS creates a `"predicted"` release, and a
      // blocker sets the blocked FLAG on it rather than choosing a different state. Spec D3's
      // old "blocked xor predicted" rule is gone with the fourth state it described — a bed
      // that is coming free but currently held up is a prediction AND a block, and pretending
      // those were alternatives is what let `capacityBreakdown` count such a release nowhere.
      // `waitingOn` is therefore kept on both paths, because the release is predicted on both.
      // Fix round 2 (P1): `expectedAt` now carries the ward's own estimate of when the bed will
      // actually be free (`event.expectedAt`, collected on the flag form exactly like
      // `expectedReturn` on the leave-bed form) rather than `event.now`. Before this fix every
      // release a ward flagged at runtime was stamped with the instant it was REPORTED, which
      // `releaseBand()` (spec D5) then always classified `now` — the four planning bands
      // (now / by-midday / by-1600 / tonight) only ever worked for the hand-authored fixture,
      // never for anything a ward actually flagged.
      //
      // `confirmedAt` is deliberately kept as `event.now` — it is a genuinely different fact,
      // when the ward made this report — while `expectedAt` is when the ward expects the bed to
      // be free. The two can differ (a ward flagging now that a bed will be free by 1600), and
      // conflating them was exactly the bug. Neither field carries anything about the departing
      // PATIENT's own timing (binding spec §4): `expectedAt` is an operational estimate about the
      // BED, the same category `expectedReturn` on `RECORD_LEAVE_BED` already sits in and is
      // already permitted to carry — see that event's own doc comment and `LeaveBed`'s type.
      const flaggingRole = `NUM ${flaggedUnit.name}`;
      const release: BedRelease = {
        // "WR-9NN" mirrors `nextReferralId`'s own "9" prefix above — visibly distinct at a
        // glance from the hand-authored "WR-00N" fixture ids, same reasoning as
        // RAISE_REFERRAL's "WF-9NN". Safe to derive from `state.bedReleases.length` here
        // (unlike `RECORD_LEAVE_BED`'s own id below, see that case's comment): nothing in
        // this reducer ever removes an entry from `bedReleases` — every other bed-release
        // case transitions a release in place via `replaceBedRelease`, so the array only ever
        // grows and its length is a safe, collision-free id source.
        id: `WR-9${String(state.bedReleases.length).padStart(2, "0")}`,
        unitId: flaggedUnit.id,
        state: "predicted",
        expectedAt: event.expectedAt,
        waitingOn: event.waitingOn,
        blocker: event.blocker ?? null,
        blockedBy: event.blocker !== undefined ? flaggingRole : null,
        // A bed nobody has yet left is not being made ready. Preparation only ever begins after
        // `RELEASE_BED`, and only through `SET_BED_PREPARATION` — see that case.
        preparing: false,
        preparationNote: null,
        confirmedAt: event.now,
        confirmedBy: flaggingRole,
      };
      return { ...state, bedReleases: [...state.bedReleases, release] };
    }

    case "CONFIRM_BED_RELEASE": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      // Same claim-not-proof discipline as FLAG_BED_RELEASE (see that case's own comment in
      // full): this compares what the caller SAID it was acting as against the unit the release
      // belongs to, and refuses when they differ. `CONFIRM_BED_RELEASE` is `ward`-only, so unlike
      // RELEASE_HOLD/CANCEL_TRANSPORT there is no coordinator caller to exempt.
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `CONFIRM_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transition: predicted -> confirmed. Nothing else. Naming both the current state and
      // the attempted target keeps a refusal readable without having to cross-reference the state
      // machine comment above. (Before the 2026-08-28 rework this also accepted `blocked ->
      // confirmed`; there is no such state now, and a blocked release is confirmed from whichever
      // stage it is actually in, keeping its flag.)
      if (release.state !== "predicted") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to confirmed`);
      }
      // Fix round 2 (P2, spec D7): `confirmedAt` restates to `event.now` on every accepted
      // transition, not just at creation — before this fix a transition spread `...release` and
      // kept the ORIGINAL `confirmedAt`, so `WardFreshness` on this row kept reporting when the
      // release was first flagged rather than when its current state was last reported, which
      // defeats D7's whole point ("every screen states when its data was last true"). `confirmedBy`
      // is deliberately NOT restated: the guard above already refuses this event whenever
      // `event.actingUnitId !== release.unitId`, so the acting ward on every accepted transition
      // is, by construction, always the same ward that produced the existing `confirmedBy` — there
      // is no other unit's role this could ever become, so restating it would write back the exact
      // same string it already holds.
      //
      // `blocker`/`blockedBy` are deliberately CARRIED THROUGH untouched (bed-model rework,
      // 2026-08-28): "a discharge that is decided and stuck is exactly that — still confirmed,
      // and flagged". Clearing the flag here would re-create the counting defect this rework
      // exists to close, just from the other end, by making a confirmation quietly assert the
      // bed is unstuck. `CLEAR_BED_RELEASE_BLOCK` is the one and only way a flag comes off.
      const updated: BedRelease = {
        ...release,
        state: "confirmed",
        waitingOn: null,
        confirmedAt: event.now,
      };
      return replaceBedRelease(state, release.id, updated);
    }

    case "REVERT_BED_RELEASE": {
      // The reversal the four-stage model forbade (bed-model rework, 2026-08-28). It is recorded
      // exactly like every other change — `confirmedAt` restated to `event.now`, `confirmedBy`
      // left alone for the reason CONFIRM_BED_RELEASE's own case sets out — because a reversal
      // that cannot be recorded honestly gets recorded dishonestly instead.
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `REVERT_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transition: confirmed -> predicted. `released` is terminal and `predicted` is
      // already there, so both fall into the same refusal.
      if (release.state !== "confirmed") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to predicted`);
      }
      // Membership check, not truthiness — the same discipline BLOCK_BED_RELEASE's own blocker
      // check holds to, and for the same reason: a runtime rule, not merely a compile-time one.
      if (!BED_RELEASE_WAITING_ON.includes(event.waitingOn)) {
        return reject(state, event, `REVERT_BED_RELEASE waitingOn must be chosen from BED_RELEASE_WAITING_ON`);
      }
      // The blocked flag survives: reversing the discharge decision does not unstick the bed.
      const reverted: BedRelease = {
        ...release,
        state: "predicted",
        waitingOn: event.waitingOn,
        confirmedAt: event.now,
      };
      return replaceBedRelease(state, release.id, reverted);
    }

    case "BLOCK_BED_RELEASE": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `BLOCK_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // A typed caller cannot construct this event without `blocker` — it is a required field,
      // not the optional one `FLAG_BED_RELEASE` carries. This check exists for the untyped
      // caller anyway: "blocked with no blocker" is a contradiction in terms (spec D3) and must
      // be refused at runtime, not merely disallowed at compile time. Review Finding 1: this used
      // to be a truthiness test (`!event.blocker`), which refuses a missing or empty value but
      // accepts any other non-empty string — a real membership test against
      // `BED_RELEASE_BLOCKERS` is what "Blockers are chosen, never typed" (binding spec) actually
      // requires.
      if (!event.blocker || !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
        return reject(state, event, `BLOCK_BED_RELEASE requires a blocker chosen from BED_RELEASE_BLOCKERS`);
      }
      // Bed-model rework (2026-08-28): this sets a FLAG and moves no stage at all. A blocked
      // release keeps whichever stage it was in — `predicted` stays predicted, and a confirmed
      // discharge that gets stuck stays CONFIRMED and keeps counting as confirmed. Only
      // `released` is refused: the bed is already free, so there is nothing left to hold up.
      const blockedUnit = findUnit(state, release.unitId);
      if (!blockedUnit) return reject(state, event, `no unit found for id ${release.unitId}`);
      if (release.state === "released") {
        return reject(state, event, `cannot block release ${release.id} because it is already released`);
      }
      // Fix round 2 (P2, spec D7): same freshness restatement as CONFIRM_BED_RELEASE's own case
      // (see its comment in full) — `confirmedAt` moves to `event.now` on this write too, and
      // `confirmedBy` stays untouched for the same reason. `blockedBy` is a separate role field
      // rather than a reuse of `confirmedBy` because "who says this bed is stuck" and "who last
      // reported its stage" are different questions once a block outlives a stage change.
      const updated: BedRelease = {
        ...release,
        blocker: event.blocker,
        blockedBy: `NUM ${blockedUnit.name}`,
        confirmedAt: event.now,
      };
      return replaceBedRelease(state, release.id, updated);
    }

    case "CLEAR_BED_RELEASE_BLOCK": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `CLEAR_BED_RELEASE_BLOCK was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Refused rather than silently accepted as a no-op: "this bed is no longer stuck" is a
      // claim about a bed that WAS stuck, and a screen offering it on an unflagged release is a
      // defect the reducer should surface on the rejections list, not absorb.
      if (release.blocker === null) {
        return reject(state, event, `release ${release.id} carries no blocked flag to clear`);
      }
      const unblocked: BedRelease = {
        ...release,
        blocker: null,
        blockedBy: null,
        confirmedAt: event.now,
      };
      return replaceBedRelease(state, release.id, unblocked);
    }

    case "SET_BED_PREPARATION": {
      // Q4 (2026-08-28): a bed may carry a short indication that it is being MADE READY. This
      // writes that indication and NOTHING else — it touches no unit field, no capacity figure
      // and no availability. `capacityBreakdown` derives `availableNow` from the unit own
      // `allocatable`/`empty` and never reads a release, so a bed being prepared is still
      // offered, still counted and still allocatable, exactly as the owner requires. Do not add
      // a unit write here to "hold" a bed while it is cleaned; that is the delay his answer
      // says does not exist.
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `SET_BED_PREPARATION was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Membership check, same discipline as the blocker checks above: "notes are chosen, never
      // typed" is a RUNTIME rule, not merely a compile-time one, so an untyped caller supplying
      // anything outside `BED_PREPARATION_NOTES` is refused rather than stored.
      //
      // The owner supplied that list on 2026-08-28, so this now accepts the two real notes where
      // it previously refused everything. The `string | undefined` binding and the `readonly
      // string[]` widening are kept deliberately: they were what made this guard compile while
      // `BedPreparationNote` was `never`, they cost nothing now, and they are what keeps the
      // check honest if a future edit ever empties the array again.
      const requestedNote: string | undefined = event.note;
      if (requestedNote !== undefined && !(BED_PREPARATION_NOTES as readonly string[]).includes(requestedNote)) {
        return reject(state, event, `SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`);
      }
      const prepared: BedRelease = {
        ...release,
        preparing: event.preparing,
        // Clearing the flag clears the note with it — "being made ready, waiting on nothing" is
        // a state, "not being made ready, waiting on a clean" is a contradiction.
        preparationNote: event.preparing ? (event.note ?? null) : null,
        confirmedAt: event.now,
      };
      return replaceBedRelease(state, release.id, prepared);
    }

    case "RELEASE_BED": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `RELEASE_BED was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transitions: confirmed -> released and predicted -> released. `released` is
      // terminal, so only a release already in it is refused. Predicted is accepted deliberately:
      // "the person has left" is a statement of fact about an empty bed, not a prediction being
      // promoted into availability, and the four-stage model already permitted the same journey
      // via `predicted -> blocked -> released`. Narrowing it during the rework would have refused
      // a path wards could already take.
      if (release.state === "released") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to released`);
      }
      const unit = findUnit(state, release.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${release.unitId}`);
      // Fix round 2 (P2, spec D7): same freshness restatement as CONFIRM_BED_RELEASE's own case
      // (see its comment in full) — `confirmedAt` moves to `event.now` on this transition too,
      // and `confirmedBy` stays untouched for the same reason.
      // The blocked flag comes off here, and here only besides `CLEAR_BED_RELEASE_BLOCK`: once
      // the bed is actually free there is nothing left being held up, so a surviving flag would
      // be a claim about a discharge that has already happened.
      const updatedRelease: BedRelease = {
        ...release,
        state: "released",
        waitingOn: null,
        blocker: null,
        blockedBy: null,
        confirmedAt: event.now,
      };
      // RELEASE_BED is the one event in this six-case group that changes an actual bed count,
      // not just a record about one — this is where the predicted/confirmed expectation
      // `FLAG_BED_RELEASE`/`CONFIRM_BED_RELEASE` only anticipated becomes the physical fact.
      // `capacityBreakdown`'s `availableNow` is deliberately blind to `bedReleases` itself (Task
      // 2: nothing predicted or confirmed-but-unreleased may ever be added into it), so the only
      // way a release ever moves that number is through the unit's own fields, here. Both
      // `allocatable.value` and `empty.value` rise by one: the bed is now truly free, not merely
      // reserved (`allocatable` alone) or physically vacant while still held for someone else
      // (`empty` alone) — mirroring `PATIENT_ARRIVED`'s and `HOLD_BED`'s own single-field writes,
      // just on both fields at once, because this bed had never been decremented by either of
      // those handlers to begin with.
      //
      // Fix round 1 (Critical): both writes are clamped to `unit.beds`, the unit's own physical
      // ceiling. Without this clamp, repeated legal FLAG_BED_RELEASE -> CONFIRM_BED_RELEASE ->
      // RELEASE_BED cycles on one unit can walk `empty.value` past `unit.beds` — nothing in this
      // handler or in `FLAG_BED_RELEASE` caps how many releases a unit accumulates against its
      // own occupied-bed count. `unitCapacity`'s reconciliation identity
      // (`available + held + blocked + occupied === unit.beds`, `tests/ward-capacity-reconciliation.test.ts`)
      // depends on `empty.value` never exceeding `unit.beds` — once it does, `notEmpty` collapses
      // to zero and the four figures stop summing to the unit's real bed count, which is exactly
      // the sentence `ward-screen.tsx` tells a coordinator is always true. `unitCapacity` itself
      // clamps every figure it derives so that already-over/under-counted authored data is never
      // taken at face value; an unclamped write here broke that discipline from the write side
      // instead of the read side. Do not remove this clamp to "simplify" the arithmetic.
      const updatedUnit: Unit = {
        ...unit,
        allocatable: {
          ...unit.allocatable,
          value: Math.min(unit.beds, unit.allocatable.value + 1),
          confirmedAt: event.now,
        },
        empty: { ...unit.empty, value: Math.min(unit.beds, unit.empty.value + 1), confirmedAt: event.now },
      };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      return replaceBedRelease(withUnit, release.id, updatedRelease);
    }

    case "RECORD_LEAVE_BED": {
      // Same claim-not-proof discipline as FLAG_BED_RELEASE's own field: this compares what the
      // caller SAID it was acting as against the unit the leave bed is being recorded against.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `RECORD_LEAVE_BED was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      const sequence = state.leaveBedSequence + 1;
      const created: LeaveBed = {
        id: nextLeaveBedId(sequence),
        unitId: unit.id,
        usable: event.usable,
        expectedReturn: event.expectedReturn,
        confirmedAt: event.now,
        confirmedBy: `NUM ${unit.name}`,
      };
      return { ...state, leaveBeds: [...state.leaveBeds, created], leaveBedSequence: sequence };
    }

    case "END_LEAVE_BED": {
      const leaveBed = findLeaveBed(state, event.leaveBedId);
      if (!leaveBed) return reject(state, event, `no leave bed found for id ${event.leaveBedId}`);
      if (event.actingUnitId !== leaveBed.unitId) {
        return reject(
          state,
          event,
          `END_LEAVE_BED was raised acting as unit ${event.actingUnitId} but leave bed ${leaveBed.id} belongs to unit ${leaveBed.unitId}`,
        );
      }
      return { ...state, leaveBeds: state.leaveBeds.filter((candidate) => candidate.id !== leaveBed.id) };
    }

    case "REQUEST_CAPACITY_REFRESH": {
      // Spec D12: the one thing a coordinator may do to a ward's bed data. This changes no
      // number at all — no field on any unit, release or leave bed is read or written below — it
      // only records that somebody asked, with the time and the requesting role. Nothing leaves
      // the sandbox and no message is sent.
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      return {
        ...state,
        refreshRequests: [...state.refreshRequests, { unitId: unit.id, at: event.now, byRole: event.role }],
      };
    }

    case "RECEIVE_REFERRAL": {
      // Fix round B (review finding I2): the role check above used to be the ONLY guard, and
      // this reducer's own comment said so — `source`, `homeRegion`, `ageBand`, `urgency` and
      // `originSiteCode` all passed through unvalidated. That contradicts the spec's Failure
      // behaviour directly: "a referral missing a required field, or carrying an unknown source
      // … → refused with a visible `Rejection`. Never silently queued, never defaulted." Every
      // check below is a membership check (or, for `originSiteCode`, a resolution against the
      // real site list), not a truthiness test — same discipline as `DECLINE_REFERRAL`'s own
      // `reason` guard below, added in the same commit as the gap this closes. Each failure names
      // what was wrong so a rejected intake is never mistaken for a silent success.
      if (!COHORTS.includes(event.ageBand)) {
        return reject(state, event, `RECEIVE_REFERRAL ageBand must be chosen from COHORTS`);
      }
      // Review finding M1: `sex` was the ONE enum-shaped field on this event with no membership
      // check, though `SEXES` exists for exactly this. It is not a theoretical gap — a non-form
      // caller (a demo control, a Playwright fixture, the guided tour) sending `sex: "F"` used to
      // queue silently, after which `unit.sexMix["F"] ?? 0` is 0 everywhere and
      // `sexDesignationAccepts("Female only", "F")` is false, so the referral matches almost
      // nothing with plausible-looking per-unit reasons instead of being visibly refused.
      if (!SEXES.includes(event.sex)) {
        return reject(state, event, `RECEIVE_REFERRAL sex must be chosen from SEXES`);
      }
      if (!REFERRAL_SOURCES.includes(event.source)) {
        return reject(state, event, `RECEIVE_REFERRAL source must be chosen from REFERRAL_SOURCES`);
      }
      // Fix round B (this task's own addition): `homeRegion` is a REGION from a fixed list —
      // never an address, never free text. Membership-checking it here is what makes that
      // distinction real rather than a naming convention; see `HOME_REGIONS`'s own doc comment.
      if (!HOME_REGIONS.includes(event.homeRegion)) {
        return reject(state, event, `RECEIVE_REFERRAL homeRegion must be chosen from HOME_REGIONS`);
      }
      if (event.urgency !== 1 && event.urgency !== 2 && event.urgency !== 3) {
        return reject(state, event, `RECEIVE_REFERRAL urgency must be 1, 2 or 3`);
      }
      // A synthetic site code, never an address — resolved against the real network rather than
      // merely checked for non-emptiness, so "12 Wellington St, Perth" cannot pass as a code.
      if (!siteByCode(event.originSiteCode)) {
        return reject(state, event, `RECEIVE_REFERRAL originSiteCode must resolve to a real site`);
      }
      const sequence = state.frontDoorReferralSequence + 1;
      const created: Referral = {
        id: nextFrontDoorReferralId(sequence),
        ageBand: event.ageBand,
        sex: event.sex,
        secureBedNeeded: event.secureBedNeeded,
        involuntaryBedNeeded: event.involuntaryBedNeeded,
        homeRegion: event.homeRegion,
        source: event.source,
        raisedAt: event.now,
        urgency: event.urgency,
        originSiteCode: event.originSiteCode,
        transportNeeded: event.transportNeeded,
        state: "queued",
      };
      return { ...state, referrals: [...state.referrals, created], frontDoorReferralSequence: sequence };
    }

    case "ACCEPT_REFERRAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      // A decision on an already-decided referral is refused — same discipline as every other
      // one-shot transition in this reducer (CONFIRM_BED_RELEASE's `predicted -> confirmed`
      // guard, HOLD_BED's stage check). "queued" is the only state ACCEPT_REFERRAL may act on;
      // "accepted" and "declined" are both already-decided and refused identically.
      if (referral.state !== "queued") {
        return reject(state, event, `referral ${referral.id} was already decided (${referral.state})`);
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // The failing gate is named in the rejection, not just "ineligible" — `referralEligibility`
      // (ward-eligibility.ts) already produces a human-readable detail per gate; reusing it here
      // is what keeps this refusal and the match view's own "why not here?" reading identically.
      const verdict = referralEligibility(referral, unit, event.now);
      if (!verdict.eligible) {
        const failedGate = verdict.gates.find((gate) => !gate.pass);
        return reject(
          state,
          event,
          `${unit.name} does not accept referral ${referral.id} — failed gate ${failedGate?.gate}: ${failedGate?.detail}`,
        );
      }
      const updated: Referral = {
        ...referral,
        state: "accepted",
        acceptedUnitId: unit.id,
        decidedAt: event.now,
        decidedBy: "Flow coordinator",
      };
      // Spec D14: acceptance decides only that the network takes this referral — it creates NO
      // `Movement`. Wiring an accepted referral into one needs an `originEdId`, a legal status
      // and a stage machine, every one of which is entangled with Phase 8's geography work; that
      // seam is deliberate, not an oversight, and `tests/ward-referral-reducer.test.ts` asserts
      // it explicitly so a future change has to argue with a test rather than slip past.
      return replaceReferral(state, referral.id, updated);
    }

    case "DECLINE_REFERRAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      if (referral.state !== "queued") {
        return reject(state, event, `referral ${referral.id} was already decided (${referral.state})`);
      }
      // Membership check, not truthiness — same discipline as FLAG_BED_RELEASE's own comment on
      // this exact shape of check above. Phase 5 shipped a truthiness test in this position
      // (`!event.blocker`, which refuses a missing/empty value but accepts any other non-empty
      // string) and review caught it; "chosen from a fixed list, never typed" is a runtime rule.
      if (!REFERRAL_DECLINE_REASONS.includes(event.reason)) {
        return reject(state, event, `DECLINE_REFERRAL reason must be chosen from REFERRAL_DECLINE_REASONS`);
      }
      const updated: Referral = {
        ...referral,
        state: "declined",
        declineReason: event.reason,
        decidedAt: event.now,
        decidedBy: "Flow coordinator",
      };
      return replaceReferral(state, referral.id, updated);
    }

    case "RECORD_LOCAL_BED_SOUGHT": {
      // Phase 8 (spec D8-6). Optional by design: nothing requires this to have happened, nothing
      // reads its absence as a failing, and `ACCEPT_REFERRAL` neither checks it nor cares. It is
      // a record that a coordinator looked closer to home, and when.
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      // A search for a local bed is a thing done while the referral is still undecided. Recording
      // one against an already-decided referral would be recording it after the fact, so the
      // refused state is named exactly as `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` name theirs.
      if (referral.state !== "queued") {
        return reject(state, event, `referral ${referral.id} was already decided (${referral.state})`);
      }
      // One-shot, the same discipline `ACCEPT_REFERRAL`'s already-decided guard uses: a second
      // record would silently overwrite the first, losing the time and role of the search that
      // actually happened.
      if (referral.localBedSought !== undefined) {
        return reject(state, event, `referral ${referral.id} already records a local bed search`);
      }
      // `by` is the raising ROLE, taken from the event rather than from any caller-supplied
      // string, so a person's name cannot be written here even by a caller that wanted to.
      const sought: Referral = { ...referral, localBedSought: { at: event.now, by: event.role } };
      return replaceReferral(state, referral.id, sought);
    }

    case "RECORD_ESCALATION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot escalate a closed movement (${movement.closure.reason})`);
      }
      const updated: Movement = {
        ...movement,
        escalation: { at: event.now, triedUnitIds: [...event.triedUnitIds], contact: event.contact },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "CHANGE_URGENCY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot change urgency for a closed movement (${movement.closure.reason})`);
      }
      // Nothing auto-allocates. This records who changed the tier, when and why; it never
      // re-sorts, re-suggests, un-accepts or re-refers the patient — that rule does not bend
      // because the trigger was a status change (Global Constraint 3, spec D2).
      const updated: Movement = {
        ...movement,
        urgency: event.urgency,
        urgencyChanges: [
          ...movement.urgencyChanges,
          { at: event.now, from: movement.urgency, to: event.urgency, by: event.role, reason: event.reason },
        ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "CHANGE_LEGAL_STATUS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot change legal status for a closed movement (${movement.closure.reason})`);
      }
      // A legal status change can make an already-accepted destination unlawful — see
      // `destinationNoLongerLawful` in ward-derivations.ts, which surfaces that as an exception
      // for a human. This handler NEVER reacts to that itself: it records the change and nothing
      // else. `stage`, `acceptedUnitId`, `referredUnitIds`, `declines`, `transport`, `legalForm`
      // and `bedHeldUntil` are all untouched.
      const updated: Movement = {
        ...movement,
        legalStatus: event.legalStatus,
        statusChanges: [
          ...movement.statusChanges,
          { at: event.now, from: movement.legalStatus, to: event.legalStatus, by: event.role, reason: event.reason },
        ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "RELEASE_HOLD": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot release a hold for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "bed_held") {
        return reject(state, event, `cannot release a hold while the movement is ${movement.stage}`);
      }
      // Same claim-not-proof discipline as CONFIRM_CAPACITY: this compares what the caller SAID
      // it was acting as against the unit actually holding the bed, and refuses when they differ.
      // Unused for a coordinator caller, who may act on behalf of any unit.
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_HOLD was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is held at ${movement.acceptedUnitId}`,
        );
      }
      if (!movement.acceptedUnitId) {
        return reject(state, event, `movement ${movement.id} has no accepted unit holding a bed`);
      }
      const unit = findUnit(state, movement.acceptedUnitId);
      if (!unit) return reject(state, event, `no unit found for id ${movement.acceptedUnitId}`);

      // The EXACT inverse of HOLD_BED's own writes (ruling P4-1) — every field HOLD_BED sets,
      // undone, and nothing else touched. HOLD_BED writes four fields: `unit.allocatable.value`
      // (-1), `unit.allocatable.confirmedAt` (event.now), `movement.stage` ("bed_held") and
      // `movement.bedHeldUntil` (event.now + 60). It does NOT touch `Unit.held` — that field is
      // seed-only data; the live held count on every screen is `unitCapacity()`'s own derivation
      // from `empty` and `allocatable`, so giving back the bed by raising `allocatable.value` is
      // the whole correction, on both fields HOLD_BED actually wrote to the unit.
      const releasedUnit: Unit = {
        ...unit,
        allocatable: { ...unit.allocatable, value: unit.allocatable.value + 1, confirmedAt: event.now },
      };
      // Never closes the movement, never clears `legalForm`, never touches `referredUnitIds` —
      // the patient survives and keeps their acceptance; only the hold itself unwinds.
      const updatedMovement: Movement = {
        ...movement,
        stage: "accepted_awaiting_bed",
        bedHeldUntil: undefined,
        unwinds: [...movement.unwinds, { at: event.now, kind: "hold_released", by: event.role, reason: event.reason }],
      };
      const withUnit = replaceUnit(state, unit.id, releasedUnit);
      return replaceMovement(withUnit, movement.id, updatedMovement);
    }

    case "CANCEL_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot cancel transport for a closed movement (${movement.closure.reason})`);
      }
      if (!movement.transport) {
        return reject(state, event, `movement ${movement.id} has no transport job to cancel`);
      }
      if (movement.transport.cancelledAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already cancelled`);
      }
      if (movement.transport.arrivedAt !== undefined) {
        return reject(state, event, `cannot cancel transport for movement ${movement.id} — the patient has arrived`);
      }
      if (movement.transport.collectedAt !== undefined) {
        return reject(state, event, `cannot cancel transport for movement ${movement.id} — the patient has departed`);
      }
      // Same claim-not-proof discipline as CONFIRM_CAPACITY: this compares what the caller SAID
      // it was acting as against the unit the movement is accepted at, and refuses when they
      // differ. Unused for a coordinator caller, who may act on behalf of any unit.
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `CANCEL_TRANSPORT was raised acting as unit ${event.actingUnitId} but movement ${movement.id} is accepted at ${movement.acceptedUnitId ?? "no unit"}`,
        );
      }
      // Never closes the movement — the patient stays open, only the transport job unwinds. The
      // cancelled job remains named in the audit trail while a clean replacement follows the
      // ordinary acceptance path. The bed itself is untouched by this handler.
      const cancelledTransport = movement.transport;
      const updatedMovement: Movement = {
        ...movement,
        stage: "handover_ready",
        transport: {
          id: `${cancelledTransport.id}-replacement-${movement.unwinds.filter((entry) => entry.kind === "transport_cancelled").length + 1}`,
          provider: cancelledTransport.provider,
          escortRequired: cancelledTransport.escortRequired,
          ...(cancelledTransport.formRequired ? { formRequired: cancelledTransport.formRequired } : {}),
        },
        unwinds: [
          ...movement.unwinds,
          {
            at: event.now,
            kind: "transport_cancelled",
            by: event.role,
            reason: event.reason,
            transportId: cancelledTransport.id,
          },
        ],
      };
      return replaceMovement(state, movement.id, updatedMovement);
    }
  }
}
