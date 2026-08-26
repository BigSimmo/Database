import type { Instant } from "@/components/ward-management/ward-clock";
import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { PARALLEL_REFERRAL_CAP } from "@/components/ward-management/ward-model";
import type {
  BedRelease,
  LeaveBed,
  Movement,
  MovementStage,
  Rejection,
  Unit,
} from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds, wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { scenarioUnits, type WardScenario } from "@/components/ward-management/ward-scenarios";

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
    scenario,
    bedReleases: structuredClone(bedReleases),
    leaveBeds: structuredClone(leaveBeds),
    refreshRequests: [],
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
    case "BLOCK_BED_RELEASE":
    case "RELEASE_BED":
      return event.releaseId;
    case "END_LEAVE_BED":
      return event.leaveBedId;
    case "ADVANCE_CLOCK":
    case "RESET_SCENARIO":
    case "SET_SCENARIO":
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
    case "RESET_SCENARIO":
      return seedWardFlowState();

    case "SET_SCENARIO":
      return seedWardFlowState(event.scenario);

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
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      return replaceMovement(withUnit, movement.id, updatedMovement);
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
      // Spec D3: a release is `blocked` xor `predicted`, never both — a blocker is legal only in
      // `blocked`, a confidence only in `predicted`. A flag that names a blocker is reporting a
      // bed that is coming free but currently held up; a flag with no blocker is a plain
      // prediction. `event.confidence` is discarded on the blocked path rather than stored
      // alongside a blocker, and `event.blocker` is discarded on the predicted path, so the
      // produced `BedRelease` can never carry both at once.
      const release: BedRelease =
        event.blocker !== undefined
          ? {
              id: `WR-9${String(state.bedReleases.length).padStart(2, "0")}`,
              unitId: flaggedUnit.id,
              state: "blocked",
              // FLAG_BED_RELEASE carries no estimated time from its caller (see the event's own
              // doc comment) — nothing about the departing patient's own timing is permitted onto
              // this record (binding spec §4), so this is the moment the WARD reported the
              // release, not a projection about the patient.
              expectedAt: event.now,
              confidence: null,
              blocker: event.blocker,
              confirmedAt: event.now,
              confirmedBy: `NUM ${flaggedUnit.name}`,
            }
          : {
              // "WR-9NN" mirrors `nextReferralId`'s own "9" prefix above — visibly distinct at a
              // glance from the hand-authored "WR-00N" fixture ids, same reasoning as
              // RAISE_REFERRAL's "WF-9NN".
              id: `WR-9${String(state.bedReleases.length).padStart(2, "0")}`,
              unitId: flaggedUnit.id,
              state: "predicted",
              expectedAt: event.now,
              confidence: event.confidence,
              blocker: null,
              confirmedAt: event.now,
              confirmedBy: `NUM ${flaggedUnit.name}`,
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
      // Legal transitions: predicted -> confirmed, blocked -> confirmed. Nothing else. Naming
      // both the current state and the attempted target keeps a refusal readable without having
      // to cross-reference the state machine comment above.
      if (release.state !== "predicted" && release.state !== "blocked") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to confirmed`);
      }
      const updated: BedRelease = { ...release, state: "confirmed", confidence: null, blocker: null };
      return replaceBedRelease(state, release.id, updated);
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
      // be refused at runtime, not merely disallowed at compile time.
      if (!event.blocker) {
        return reject(state, event, `BLOCK_BED_RELEASE requires a blocker chosen from BED_RELEASE_BLOCKERS`);
      }
      // Legal transitions: predicted -> blocked, confirmed -> blocked. Nothing else.
      if (release.state !== "predicted" && release.state !== "confirmed") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to blocked`);
      }
      const updated: BedRelease = { ...release, state: "blocked", confidence: null, blocker: event.blocker };
      return replaceBedRelease(state, release.id, updated);
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
      // Legal transitions: confirmed -> released, blocked -> released. released is terminal —
      // there is no target state further on to move to, so both current-`released` and any other
      // state fall into the same refusal below.
      if (release.state !== "confirmed" && release.state !== "blocked") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to released`);
      }
      const unit = findUnit(state, release.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${release.unitId}`);
      const updatedRelease: BedRelease = { ...release, state: "released", confidence: null, blocker: null };
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
        allocatable: { ...unit.allocatable, value: Math.min(unit.beds, unit.allocatable.value + 1), confirmedAt: event.now },
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
      const created: LeaveBed = {
        // "WL-9NN" mirrors FLAG_BED_RELEASE's own "WR-9NN" — visibly distinct from the
        // hand-authored "WL-00N" fixture ids.
        id: `WL-9${String(state.leaveBeds.length).padStart(2, "0")}`,
        unitId: unit.id,
        usable: event.usable,
        expectedReturn: event.expectedReturn,
        confirmedAt: event.now,
        confirmedBy: `NUM ${unit.name}`,
      };
      return { ...state, leaveBeds: [...state.leaveBeds, created] };
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
