import type { Instant } from "@/components/ward-management/ward-clock";
import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  CANCEL_TRANSPORT_REASONS,
  OVERRIDE_REASONS,
} from "@/components/ward-management/ward-change-reasons";
import {
  candidateReason,
  eligibility,
  referralEligibility,
  type EligibilityGate,
} from "@/components/ward-management/ward-eligibility";
import { referralState, referralSuburbIsAnswered } from "@/components/ward-management/ward-referrals";
import {
  EVENT_ROLE,
  WARD_FLOW_ROLE_LABELS,
  type WardFlowEvent,
  type OverridableWardFlowEvent,
  type WardFlowRole,
} from "@/components/ward-management/ward-flow-events";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  BED_RELEASE_WAITING_ON,
  COHORTS,
  HOME_REGIONS,
  PARALLEL_REFERRAL_CAP,
  REFERRAL_DECLINE_REASONS,
  REFERRAL_SOURCES,
  SEXES,
  REFERRAL_DESTINATION_KINDS,
  REFERRAL_PURPOSES,
  type ReferralAddressing,
  TRANSPORT_PROVIDERS,
} from "@/components/ward-management/ward-model";
import type {
  MovementId,
  BedRelease,
  LeaveBed,
  Movement,
  MovementStage,
  Referral,
  WardReferralDestination,
  ReferralDestinationKind,
  Rejection,
  Unit,
} from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds, referrals, wardMovements } from "@/components/ward-management/ward-movements";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { scenarioUnits, type WardScenario } from "@/components/ward-management/ward-scenarios";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import { remainingSpeciallingCapacity, type Admission } from "@/components/ward-management/ward-admissions";
import type { Patient } from "@/components/ward-management/ward-patients";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Stages `REFER_TO_UNITS` accepts, exported so a UI surface can pre-check referability and gate
 * its own control before dispatching — never optimistically claim a referral happened and let
 * this be the thing that silently refuses it (Task 5 fix round 1: `ShortlistPanel` used to
 * dispatch and unconditionally render success, so a movement at, say, `pulled` — still open,
 * still offering eligible candidates — showed "Referred by a human coordinator" while nothing
 * had happened). A single shared constant, used here AND by `ward-derivations.ts`'s
 * `referralBlockedReason`, so the two checks can never drift apart.
 */
export const REFERRABLE_MOVEMENT_STAGES: readonly MovementStage[] = ["placement_requested", "destination_review"];

/**
 * WHAT THE REDUCER ITSELF WRITES INTO `Movement.blocker` WHEN A MOVEMENT'S SITUATION CHANGES.
 *
 * ⚠️ **`Movement.blocker` — the free-prose one. NOT `BedRelease.blocker`**, which is a
 * `BedReleaseBlocker` enum about a bed being freed and is written by `BLOCK_BED_RELEASE` /
 * `CLEAR_BED_RELEASE_BLOCK`. Two fields, one name; nothing here goes near the other.
 *
 * **Why the reducer writes anything at all.** Until 2026-09-01 this field was set once, at
 * creation, to `"Awaiting coordinator referral"`, and no transition ever touched it. That sentence
 * stopped being true the moment a coordinator referred, and it stayed on screen through
 * acceptance, transport and collection — the movement console renders it as **Response** and
 * **Current blocker**, so somebody chased a patient whose ambulance was already moving. A blocker
 * describing an earlier stage is wrong BY CONSTRUCTION, not merely out of date, so the reducer
 * restates it wherever it has just been told something the standing sentence CONTRADICTS.
 *
 * ⚠️ **THE PROPERTY IS "NEVER CONTRADICTED BY THE RECORD BESIDE IT", NOT "NEVER OLDER THAN THE
 * STAGE BESIDE IT"** — this comment claimed the second until 2026-09-01 and the code never held it.
 * `PULL_PATIENT` moves the stage to `pulled` and leaves `"Awaiting a bed at the accepting ward"`
 * standing, which falsifies the stage version outright; `HANDOVER_READY` does the same with
 * `"Awaiting a transport provider response"`. Both are CORRECT, and that is the point: a pull
 * allocates a bed without making one ready — the seed's own three `pulled` movements say "Awaiting
 * single-room clean", "Ward finalising bed clean" and "Escort provider organising secure
 * transport" — and a handover being ready does not make a provider answer. Neither event is told
 * anything that contradicts the sentence it inherits, so writing one there would overwrite a
 * ward's real observation with a vaguer machine one. The two transport legs below ARE told such a
 * thing (`acceptedAt`, then `enRouteAt`), which is why they restate and these two do not. State
 * the property that holds; do not restore the one that reads more strongly and is false.
 *
 * **What these sentences are allowed to be.** Restatements of what the model has been told, and
 * nothing more. `"Awaiting a bed at the accepting ward"` says the stage is `accepted_awaiting_bed`;
 * `"None — in transit"` says the patient has been collected. None of them invents a fact about a
 * ward, a person or a provider — the richer sentences the seed carries ("Awaiting single-room
 * clean", "Escort provider organising secure transport") are things only a human knows, and only
 * `RECORD_MOVEMENT_BLOCKER` may write those.
 *
 * ⚠️ **A HUMAN'S PROSE IS OVERWRITTEN BY THE NEXT TRANSITION, AND THAT IS THE DESIGN.** A ward
 * that recorded "Awaiting single-room clean" while the patient was pulled will see that replaced
 * when transport is booked. The situation genuinely changed; a note about the old one is exactly
 * the staleness this table exists to end. If it is still true, it is recorded again — the same way
 * a handover note is repeated at handover rather than assumed to still hold.
 *
 * ⚠️ **THE SEED IS NOT DERIVED FROM THIS TABLE AND MUST NOT BE.** The twenty-one hand-authored
 * values (`ward-movements.ts`) stay exactly as written; two of them sit at the same stage with
 * different words ("Transport escort confirming departure time" and "Awaiting transport escort",
 * both `handover_ready` with a transport job), which is direct evidence that a stage does NOT
 * determine this field. That is why deriving it was refused and why only these eight sentences are
 * ever written (across nine events — `didNotProceed` covers both closures that are not an arrival):
 * the points where the previous sentence is provably false, not merely possibly stale.
 *
 * `hasActiveBlocker` (ward-priority.ts) must recognise every "nothing is blocking" phrasing here
 * as inactive, or a settled movement scores ten points for an obstruction it does not have. The
 * three below all use the `"None — …"` shape it already matches.
 */
export const STAGE_TRANSITION_BLOCKERS = {
  /** `REFER_TO_UNITS`: referrals are live and nobody has answered yet. */
  referred: "Awaiting destination response",
  /** `ACCEPT_IN_PRINCIPLE`: a unit has accepted; the bed itself is what is outstanding. */
  accepted: "Awaiting a bed at the accepting ward",
  /** `BOOK_TRANSPORT`: a job exists and the provider has not accepted it. */
  transportBooked: "Awaiting a transport provider response",
  /** `TRANSPORT_ACCEPTED`: the provider ANSWERED — `transport.acceptedAt` is set — and has not set
   *  off. Restates `acceptedAt` and nothing else: which provider and whether an escort was asked
   *  for are on the job itself and `transportStatusLabel` already renders them. */
  transportAccepted: "Awaiting the transport provider's departure",
  /** `TRANSPORT_EN_ROUTE`: `transport.enRouteAt` is set and `collectedAt` is not. The vehicle is
   *  moving and the patient is still where they were; an ACTIVE blocker, deliberately, because
   *  nobody has been collected yet — `collected` below is the first value that says otherwise. */
  transportEnRoute: "Awaiting collection — transport is en route",
  /** `PATIENT_COLLECTED`. One of the two "absence with its reason" values the seed already
   *  carries, reused verbatim rather than reworded — the fixture and the reducer must not describe
   *  one situation with two sentences. */
  collected: "None — in transit",
  /** `PATIENT_ARRIVED`. The seed's other absence-with-reason value, again verbatim. */
  arrived: "None — handover complete",
  /** `RECORD_EXAMINATION` and `WITHDRAW_REFERRAL`, the two closures that are not an arrival.
   *  Nothing is blocking because there is no longer anything to block. */
  didNotProceed: "None — the movement did not proceed",
} as const;

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

/**
 * A FRESH SEED, ALREADY MOVED TO THE DEMONSTRATION'S CLOCK. The only door application code uses.
 *
 * ⚠️ **`shiftInstants` CARRIES NO ALREADY-SHIFTED MARKER, SO APPLYING IT TWICE DOUBLES EVERY
 * OFFSET.** Ward Board's framing is why that outranks its size: *a wrong clock looks wrong; a wrong
 * length of stay looks PLAUSIBLE.* A patient nine days in a bed reading as eighteen is not a
 * visibly broken screen — it is a believable number, on a screen whose purpose is to be believed,
 * with nothing anywhere to contradict it.
 *
 * ⚠️ **Stated honestly: no screen has ever shown that.** All three call sites passed a fresh
 * `seedWardFlowState()`, so nothing was ever double-shifted. This is a latent hazard being closed
 * because the cost of closing it is a function signature, not a live defect being repaired.
 *
 * The remedy is `TR-F3`-shaped — make the impossible state unrepresentable rather than check that
 * the reachable ones look right. **This function cannot be handed an already-shifted state because
 * it does not take a state at all**: it seeds and shifts in one step, so there is no argument a
 * caller could pass twice. `shiftInstants` stays exported for `ward-reanchor.test.ts`, which tests
 * the walker itself; `tests/ward-reanchor-single-application.test.ts` is the guard that application
 * code never reaches around this door to it.
 *
 * Offset zero returns a copy rather than the original, for the reason `shiftInstants` already
 * documents: the pinned and live paths then differ only in the offset, never in whether a copy was
 * taken, so no path exists that only a non-zero offset exercises.
 */
export function seedWardFlowStateAt(offsetMinutes: number, scenario: WardScenario = "standard"): WardFlowState {
  return shiftInstants(seedWardFlowState(scenario), offsetMinutes);
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
      return event.releaseId;
    case "RELEASE_BED":
      return event.releaseId;
    // Their own group, never folded into the unit- or release-scoped ones above: an admission id is
    // not a unit id and not a release id. These three are the only events in the model whose
    // subject is a person on a ward rather than a movement, a bed release or a referral — this
    // comment read "this event is the only one" until the two emergency-department events joined
    // `RECORD_LEAVING` here on 2026-09-01.
    case "RECORD_LEAVING":
    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT":
    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT":
      return event.admissionId;
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
    // Referral-scoped, not movement-scoped: a clearance is recorded against the referral the
    // inbox renders, and this event carries no `movementId` to return.
    case "RECORD_MEDICAL_CLEARANCE":
      return event.referralId;
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

/**
 * ⚠️ **THE ELIGIBILITY GATE. Owner ruling, 2026-09-02, given in three parts:** *"the engine should
 * refuse, screen checks are not enough"*, then *"refuse unless a reason is recorded"*, then
 * *"The coordinator can over ride all rules"*.
 *
 * Returns the refusal message, or `null` to allow.
 *
 * ⚠️ **AN INELIGIBLE PLACEMENT IS MADE ACCOUNTABLE, NEVER IMPOSSIBLE — and the row below that looks
 * like a loophole IS THE RULING:**
 *
 *   ineligible + no reason       -> REFUSED, naming the failing gate
 *   ineligible + valid reason    -> PLACED, and the reason recorded
 *   eligible                     -> unchanged
 *   reason outside OVERRIDE_REASONS -> refused by MEMBERSHIP, never truthiness
 *
 * **Do not "tighten" the second row.** An override that is refused becomes a phone call, and the
 * placement then happens outside the system where nothing is recorded. **A rule that cannot be
 * overridden does not stop the placement; it stops the RECORD of the placement.** Anyone making one
 * gate un-overridable — the forensic gate is the obvious candidate — is REVERSING AN EXPLICIT OWNER
 * RULING, not tightening a loose end.
 *
 * ⚠️ **AND THE BOUNDARY, which is why this helper is only used for eligibility:** *"all rules"*
 * covers the ELIGIBILITY GATES. It does NOT cover the capacity refusals above it — allocatable beds,
 * a bed still being prepared, one-to-one specialling capacity. **A judgement rule is not a physical
 * fact: "this ward is the wrong cohort" is a clinical judgement and is overridable; "there is no
 * bed" is a fact about the world. NO REASON TYPED INTO A FORM CREATES A BED.** Widening this to a
 * capacity check would record a placement into a bed that does not exist — a false record, which is
 * the exact harm this ruling exists to prevent.
 */
/**
 * ⚠️ **THE GATES THIS REDUCER ENFORCES — a subset, and the subset is a JUDGEMENT that needs the
 * owner's confirmation. Ward Builder Three, 2026-09-02, flagged rather than assumed.**
 *
 * `eligibility()` returns twelve gates and they are not the same kind of thing:
 *
 *  - **SUITABILITY — does this bed suit this patient?** `cohort`, `security`, `sex_designation`,
 *    `sex_mix`, `forensic`, `legal_status`, `authorisation`, `age`. **These are clinical judgements,
 *    and these are what the owner's ruling is about.**
 *  - **THE WORLD — is there a bed at all?** `allocatable_bed`, `capacity_freshness`, `specialling`.
 *    ⚠️ **Already refused separately, above, and NOT overridable: no reason typed into a form creates
 *    a bed.** Enforcing them here would make a physical fact overridable and record a placement into
 *    a bed that does not exist.
 *  - ⚠️ **HISTORY — `prior_decline`. Neither of the above, and the reason this list exists.**
 *    A ward that declined ninety minutes ago *"because it had no bed"* is the commonest thing in bed
 *    management, and beds free up. Enforcing it would demand a recorded override every time a
 *    coordinator re-approaches a ward that once said no — **and none of the five `OVERRIDE_REASONS`
 *    fits, because they all name a MISMATCH and there is no mismatch.** Measured: enforcing it broke
 *    23 tests across 7 files, almost all of them re-referrals after a seeded decline.
 *
 * **So this reducer enforces SUITABILITY only.** The owner ruled that the engine should refuse an
 * unsuitable bed; he was not asked whether re-approaching a ward that declined should require a
 * recorded reason. ⚠️ **That is a live question for him and it is recorded as one.**
 */
/**
 * ⚠️ THE ONE SENTENCE FRAGMENT A SCREEN MAY MATCH ON TO KNOW A REFUSAL IS ANSWERABLE.
 *
 * A refusal that a recorded reason can get past reads differently from one that nothing can, and a
 * screen has to tell them apart to know whether offering a reason control would be honest. Doing
 * that by re-typing the wording here and there would be two copies of one fact — the second would
 * survive the first being reworded, and the control would then either vanish or appear where it
 * cannot help.
 *
 * So the engine exports the fragment it speaks. `ward-screen.tsx` matches on THIS, never on a
 * literal of its own. Reword the refusals and the control follows automatically.
 *
 * ⚠️ It deliberately names a STATE, not an action. The engine says one sentence to every caller and
 * only some callers can act on it; an instruction sent a ward nurse hunting for a control that
 * exists on the coordinator's panel. The exact clinical wording is the owner's to confirm.
 */
export const OVERRIDE_REASON_REQUIRED = "needs a recorded override reason";

/**
 * ⚠️ THE LIST OF GATES A RECORDED REASON MAY GET PAST. Two importers, both deliberate:
 *
 * 1. `tests/ward-referral-reducer.test.ts` asserts it is DISJOINT from the world-fact gates. That
 *    guard exists because the hazard it covers is silent — see the comment at `eligibilityRefusal`'s
 *    early return.
 * 2. `ward-derivations.ts`'s `shortlistCandidates`, so the coordinator's list can tell a ward that
 *    can be taken with a reason from one that cannot be taken at all.
 *
 * ⚠️ THE SECOND IMPORTER IS WHY THIS COMMENT CHANGED. It said "nothing else should import this",
 * which was true when the only thing that could act on the list was the engine. A screen that must
 * NOT offer a physical refusal as overridable needs the same list — and a second copy of it on the
 * screen is exactly how the two would drift into disagreeing about what a reason can buy.
 */
export const SUITABILITY_GATES: readonly EligibilityGate[] = [
  "age",
  "authorisation",
  "cohort",
  "forensic",
  "legal_status",
  "security",
  "sex_designation",
  "sex_mix",
  // ⚠️ ADDED BY OWNER RULING, 2026-09-02, and it is the only gate ever moved out of the world-fact
  // group. A stale bed count is information, not a wall: "I have confirmed the current bed state
  // with the ward directly" is a named person taking responsibility for a fact, which is what an
  // override reason IS. Before this it was refused at the front door with no way through and never
  // consulted at all on the placement path, which left the owner's own approved reason — "the bed
  // information is known to be out of date" — a dead option with nothing to answer.
  //
  // ⚠️ IT DOES NOT MEAN "THE WARD LOOKS FULL BUT IS NOT". The owner ruled the narrow reading
  // explicitly: this buys past a STALE COUNT, never past `allocatable_bed`. No reason typed into a
  // form creates a bed. See docs/ward-flow/owner-rulings-2026-09-02-staleness-and-legal-status.md.
  "capacity_freshness",
];

function eligibilityRefusal(
  event: OverridableWardFlowEvent,
  movement: Movement,
  unit: Unit,
  now: Instant,
): string | null {
  if (event.overrideReason !== undefined) {
    // Membership-checked, never truthiness-checked — the same discipline as `REFER_TO_UNITS`'s own
    // override validation. An unrecognised string must not buy its way past a clinical gate.
    if (!OVERRIDE_REASONS.includes(event.overrideReason)) {
      return `${event.type} overrideReason must be chosen from OVERRIDE_REASONS`;
    }
    // ⚠️ THIS RETURN SKIPS THE VERDICT ENTIRELY, AND WHAT MAKES THAT SAFE IS NOT IN THIS FUNCTION.
    //
    // An earlier version of this comment said the early return was safe because every gate this
    // function can refuse on is a judgement. THAT WAS WRONG, and wrong in the direction that
    // reassures: `eligibility()` emits FOUR gates outside `SUITABILITY_GATES` today —
    // `specialling`, `prior_decline`, `capacity_freshness`, `allocatable_bed` — so a recorded
    // reason does skip physical gates here, and has always done so.
    //
    // It is safe because `PULL_PATIENT` is the ONLY event that consumes a bed, and it enforces the
    // physical facts itself, before it ever calls this function:
    //
    //     if (unit.allocatable.value <= 0)                          -> reject
    //     if (movement.specialling && remainingSpeciallingCapacity(unit, …) <= 0) -> reject
    //     eligibilityRefusal(…)                                      <- runs AFTER both
    //
    // Neither of those reads `overrideReason`. `REFER_TO_UNITS` and `ACCEPT_IN_PRINCIPLE` consume
    // no bed — an accept in principle is explicitly a promise made BEFORE one exists — so skipping
    // the physical gates there is correct rather than merely tolerated.
    //
    // ⚠️ SO THE THING TO PRESERVE IS THOSE TWO GUARDS AND THEIR ORDER, NOT THIS GATE LIST. The edit
    // that breaks it is a tidy-up: folding the bed and specialling checks into the eligibility
    // verdict, which already computes both. That refactor looks like a simplification, leaves
    // `SUITABILITY_GATES` untouched, and silently lets a typed reason create a bed.
    // `tests/ward-physical-facts-are-not-overridable.test.ts` is what goes red when it happens —
    // it asserts the refusals by their exact message, so it cannot pass on some other refusal.
    //
    // `referralAcceptanceRefusal` below needs none of this: it computes the verdict first and finds
    // unbypassable gates by ABSENCE from `SUITABILITY_GATES`, so it fails closed on its own.
    return null;
  }
  const verdict = eligibility(movement, unit, now);
  const failed = verdict.gates.find((gate) => !gate.pass && SUITABILITY_GATES.includes(gate.gate));
  if (!failed) return null;
  return (
    `${unit.name} is not eligible for movement ${movement.id} — failed gate ${failed?.gate}: ` +
    `${candidateReason(verdict)}. This placement ${OVERRIDE_REASON_REQUIRED}.`
  );
}

/**
 * The front door's half of the same ruling `eligibilityRefusal` implements for the placement path.
 *
 * ⚠️ IT EXISTS BECAUSE THE TWO PATHS HELD OPPOSITE POLICIES. Until now `ACCEPT_REFERRAL` rejected
 * on the FIRST failing gate of any kind, so a referral every ward failed on one judgement gate
 * could not be accepted by anybody, with any reason, ever — while the coordinator's placement path
 * checked no judgement gate at all. One end refused everything, the other end refused nothing.
 *
 * The rule both ends now hold: a judgement about the patient is overridable by a named human with
 * a recorded reason; a fact about the world is not. No reason typed into a form creates a bed.
 *
 * ⚠️ FAIL-CLOSED BY CONSTRUCTION, and this is the load-bearing line: a gate is overridable ONLY by
 * appearing in `SUITABILITY_GATES`. Everything else refuses outright — today that is
 * `allocatable_bed`, `capacity_freshness` and `specialling`, and tomorrow it is automatically any
 * gate someone adds to `referralEligibility` without thinking about this file. The default for an
 * unclassified gate is "no reason gets past this", never "anyone with a dropdown can".
 */
function referralAcceptanceRefusal(
  event: OverridableWardFlowEvent,
  referral: Referral,
  destination: WardReferralDestination,
  unit: Unit,
  now: Instant,
): { refusal: string; overrideApplied?: undefined } | { refusal: null; overrideApplied: boolean } {
  const verdict = referralEligibility(referral, destination, unit, now);
  // ⚠️ `overrideApplied: false` on a CLEAN verdict even when the event carries a reason, so a
  // reason selected against a ward that turned out to be eligible is not filed as an override.
  // A record saying a clinical rule was bent, on an acceptance where none was, is a false entry in
  // the only place anyone would later go looking for the real ones.
  if (verdict.eligible) return { refusal: null, overrideApplied: false };
  const failed = verdict.gates.filter((gate) => !gate.pass);

  // Checked BEFORE the reason is even read, so no ordering accident can let one through.
  const unbypassable = failed.find((gate) => !SUITABILITY_GATES.includes(gate.gate));
  if (unbypassable) {
    return {
      refusal:
        `${unit.name} cannot accept referral ${referral.id} — failed gate ${unbypassable.gate}: ` +
        `${unbypassable.detail}. This is not something a recorded reason can override.`,
    };
  }

  // Everything still failing is a judgement gate, so a recorded reason is the way through — and
  // the refusal has to SAY so, or the reader is left believing the door is shut.
  if (event.overrideReason === undefined) {
    const judgement = failed[0];
    return {
      refusal:
        `${unit.name} does not accept referral ${referral.id} — failed gate ${judgement?.gate}: ` +
        `${judgement?.detail}. This acceptance ${OVERRIDE_REASON_REQUIRED}.`,
    };
  }
  if (!OVERRIDE_REASONS.includes(event.overrideReason)) {
    return { refusal: `${event.type} overrideReason must be chosen from OVERRIDE_REASONS` };
  }
  return { refusal: null, overrideApplied: true };
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

function findAdmission(state: WardFlowState, admissionId: string): Admission | undefined {
  return state.admissions.find((candidate) => candidate.id === admissionId);
}

/** Replaces one admission in the array by id, leaving every other element untouched — the same
 *  discipline `replaceBedRelease` and `replaceUnit` already use. */
function replaceAdmission(state: WardFlowState, admissionId: string, next: Admission): WardFlowState {
  return {
    ...state,
    admissions: state.admissions.map((candidate) => (candidate.id === admissionId ? next : candidate)),
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

function nextReferralId(sequence: number): MovementId {
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
      return seedWardFlowStateAt(event.now - state.clockOffsetMinutes - NOW_ANCHOR);

    case "SET_SCENARIO":
      return seedWardFlowStateAt(event.now - state.clockOffsetMinutes - NOW_ANCHOR, event.scenario);

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
      /*
       * ⚠️ THE LINK BACK TO THE FRONT DOOR — this is the ONLY writer of `Movement.referralId`.
       *
       * Owner ruling 8, 2026-09-01: a community team's referral to an emergency department and the
       * journey that department subsequently raises are TWO LINKED RECORDS, not one. Nothing is
       * invented here — every fact the movement needs already arrives on `event.draft` — so this
       * writes an id and nothing else.
       *
       * ⚠️ **IT RESOLVES RATHER THAN STORES, and that is the entire difference between this field
       * and `Admission.referralId`.** That field holds ids manufactured by string substitution from
       * the admission's own id, overlapping the real referral ids in zero places, and nothing can
       * see it: a stored id that joins to nothing typechecks, renders and passes every test
       * (`docs/ward-flow/fields-with-no-producer-2026-09-01.md`). So an id naming no referral is
       * REFUSED here, in the same discipline as `RECEIVE_REFERRAL`'s `edId` and `originSiteCode`
       * checks — and for the same reason, since `"RF-QQQ"` survives every truthiness test and reads
       * as a plausible identifier.
       *
       * ⚠️ **AND THE REFERRAL MUST NAME THIS DEPARTMENT.** Under ruling 8 the patient attends the
       * department the referral was addressed to, and that department raises the journey. A journey
       * at Fremantle claiming a referral addressed to Broome is a false join wearing a real id —
       * indistinguishable, once written, from a true one. The purpose (`bed`,
       * `psychiatric_review`, `medical_assessment`) and the addressing's state are deliberately NOT
       * checked: a referral to an ED is a notification nobody declines (owner, 2026-09-01), so
       * gating on either would be inventing a rule nobody has given.
       */
      let raisedFrom: Referral | undefined;
      if (event.referralId !== undefined) {
        raisedFrom = findReferral(state, event.referralId);
        if (!raisedFrom) {
          return reject(
            state,
            event,
            `RAISE_REFERRAL referralId must name a referral this system already holds, and ${event.referralId} names none`,
          );
        }
        const addressedToThisDepartment = raisedFrom.destinations.some(
          (addressing) =>
            addressing.destination.kind === "emergency_department" && addressing.destination.edId === event.edId,
        );
        if (!addressedToThisDepartment) {
          return reject(
            state,
            event,
            `referral ${raisedFrom.id} was never addressed to ${department.name}, so a journey raised there did not come from it`,
          );
        }
      }
      const created: Movement = {
        id: nextReferralId(sequence),
        originEdId: event.edId,
        openedAt: event.now,
        // `undefined` when nobody referred this person — the ordinary case, and a real answer
        // rather than a missing one. Never a manufactured id: the guard above refuses anything
        // that does not resolve.
        referralId: raisedFrom?.id,
        // A newly raised movement is never flagged. The flag is an act somebody takes on a
        // patient already in the queue, not a property of arriving.
        flaggedUrgent: false,
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
        overrides: [],
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

    case "RECORD_MEDICAL_CLEARANCE": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      // ⚠️ RE-RECORDING IS ALLOWED AND OVERWRITING IS THE POINT. Unlike `RECORD_EXAMINATION`
      // above, which refuses a second examination as a data-integrity fault, a medical clearance
      // is a CURRENT STATE that legitimately changes: a patient cleared at 09:00 can deteriorate
      // by 11:00, and refusing the correction would leave the board asserting something the
      // department no longer believes. The `at` stamp is the answer's own time, so the record says
      // WHEN it was true rather than implying it always has been.
      const updated: Referral = {
        ...referral,
        medicalClearance: { cleared: event.cleared, at: event.now },
      };
      return replaceReferral(state, referral.id, updated);
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
      // a bed already pulled at the accepted unit — rather than leaving both dangling: every
      // downstream handler below now also rejects once `movement.closure` is set (the same
      // signal `isOpenMovement` in ward-derivations.ts already treats as authoritative), but
      // that only stops *further* progress; it does not by itself give back capacity already
      // reserved by an earlier PULL_PATIENT.
      const pulledStages: MovementStage[] = ["pulled", "handover_ready", "moving"];
      const dischargedState =
        movement.acceptedUnitId && pulledStages.includes(movement.stage)
          ? (() => {
              const pulledUnit = findUnit(state, movement.acceptedUnitId!);
              if (!pulledUnit) return state;
              const releasedUnit: Unit = {
                ...pulledUnit,
                allocatable: {
                  ...pulledUnit.allocatable,
                  value: pulledUnit.allocatable.value + 1,
                  confirmedAt: event.now,
                },
              };
              return replaceUnit(state, pulledUnit.id, releasedUnit);
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
        // Same reasoning as `WITHDRAW_REFERRAL`'s own closure: the movement is over, so nothing is
        // holding it up.
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      return replaceMovement(dischargedState, movement.id, updated);
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
      // Membership-checked, not truthiness-checked -- the same discipline as every other reason
      // in this reducer. A caller sending a reason outside the list is refused rather than having
      // an unrecognised string written into an accountability record.
      if (event.overrideReason !== undefined && !OVERRIDE_REASONS.includes(event.overrideReason)) {
        return reject(state, event, `REFER_TO_UNITS overrideReason must be chosen from OVERRIDE_REASONS`);
      }

      /*
       * ⚠️ THE ELIGIBILITY GATE, PER WARD — and this event is NOT the same shape as the other two.
       * It carries a LIST of wards, so "refuse if ineligible" had to be decided rather than copied.
       *
       * OWNER'S RULING, 2026-09-02, choosing between three options he was given:
       * **the suitable wards proceed; an unsuitable one is HELD BACK unless a reason is given for
       * it.** Per ward, never per referral.
       *
       * He rejected refusing the whole referral — that punishes a four-ward search for one bad
       * entry, which is how a system teaches people to stop using it. He rejected one reason
       * covering the whole list — that would wave through wards nobody looked at.
       *
       * ⚠️ A HELD-BACK WARD IS RECORDED, NEVER SILENTLY DROPPED. The coordinator asked for it and
       * must be told it did not happen; a referral that quietly goes to three of four wards is the
       * silent-failure shape this reducer already carries a warning about. So each held-back ward
       * appends its own rejection naming its own failing gate, and the referral proceeds with the
       * rest. If EVERY ward is held back, nothing is referred and the movement does not move.
       */
      const heldBack: string[] = [];
      const permitted: string[] = [];
      for (const unitId of event.unitIds) {
        const candidate = findUnit(state, unitId);
        const refusal = candidate ? eligibilityRefusal(event, movement, candidate, event.now) : null;
        if (refusal) heldBack.push(refusal);
        else permitted.push(unitId);
      }
      const withHeldBack = heldBack.reduce((carried, refusal) => reject(carried, event, refusal), state);
      if (permitted.length === 0) return withHeldBack;

      const updated: Movement = {
        ...movement,
        referredUnitIds: [...permitted],
        // Owner instruction 2026-09-02. The one moment a movement becomes referred, so the one
        // honest place to stamp it. Every seeded movement still carries none, and a row without it
        // goes on saying so rather than borrowing `openedAt`.
        referredAt: event.now,
        // OD-3: the reason is KEPT. It used to live in the shortlist panel's own `useState` and be
        // discarded on the next selection, while the governance page said override reasons were
        // recorded. Appended rather than replaced, because a movement can be overridden more than
        // once and the earlier one is not undone by the later.
        overrides:
          event.overrideReason === undefined
            ? movement.overrides
            : [
                ...movement.overrides,
                {
                  at: event.now,
                  by: WARD_FLOW_ROLE_LABELS[event.role],
                  reason: event.overrideReason,
                  // The wards actually referred to, not the wards asked for. With the gate in place
                  // these differ whenever one was held back, and an accountability record must name
                  // what happened rather than what was requested.
                  unitIds: [...permitted],
                },
              ],
        stage: "destination_review",
        // The creation value, "Awaiting coordinator referral", stops being true at exactly this
        // line — the coordinator has now referred. Until 2026-09-01 it survived this transition and
        // every one after it. See `STAGE_TRANSITION_BLOCKERS`.
        blocker: STAGE_TRANSITION_BLOCKERS.referred,
      };
      // `withHeldBack`, not `state` — any ward refused above must survive into the returned state,
      // or the coordinator is told nothing and the referral silently shrank.
      return replaceMovement(withHeldBack, movement.id, updated);
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

      /*
       * ⚠️ THE ELIGIBILITY GATE — and this is the event that most needed it. `ACCEPT_IN_PRINCIPLE`
       * is the ward saying yes to a bed, the closest thing on the movement path to a placement, and
       * before the owner's 2026-09-02 ruling it ran NO eligibility check of any kind — only a
       * `referredUnitIds` membership test. See `eligibilityRefusal` for the four-row contract and
       * for why the override is not a loophole.
       */
      const acceptRefusal = eligibilityRefusal(event, movement, acceptedUnit, event.now);
      if (acceptRefusal) return reject(state, event, acceptRefusal);

      const withdrawn = movement.referredUnitIds
        .filter((unitId) => unitId !== event.unitId)
        .map((unitId) => ({
          unitId,
          at: event.now,
          // 🔴 FD-23, and TWO defects in one string. It read `withdrawn — placed at
          // ${acceptedUnit.name}`, and the ward page renders this field verbatim — so the LOSING
          // ward read the WINNER's name out of the record of its own loss. The second defect
          // survives the first fix: "placed" asserts a transfer that has not happened, because
          // this event leaves the movement at `accepted_awaiting_bed`. A code, never a sentence:
          // see WITHDRAWAL_REASONS. The coordinator reads `acceptedUnitId` for the destination.
          reason: "another_unit_accepted" as const,
        }));

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
        // Nobody is waiting on a destination response any more — one arrived. What is outstanding
        // is the bed, and that is all this sentence claims: the seed's richer "Bed being made
        // ready" is a ward's own observation and only a human may write it.
        blocker: STAGE_TRANSITION_BLOCKERS.accepted,
      };
      return replaceMovement(state, movement.id, updated);
    }

    /**
     * THE REFERRER TAKES THE REFERRAL BACK — the second way a referral can end, and until today
     * there was only one.
     *
     * The only writer of `withdrawnReferrals` was `ACCEPT_IN_PRINCIPLE`, so the only way a
     * referral ever ended was another unit winning it. A patient who improved, went home or went
     * elsewhere left the request live in every receiving ward's list, and nobody could say it was
     * over. That is a flow gap rather than a missing screen: the state simply had no way to exist.
     *
     * ⚠️ **IT WITHDRAWS EVERY LIVE REFERRAL AT ONCE, and that is the meaning rather than a
     * shortcut.** The referrer is saying this patient no longer needs a bed, which is true of all
     * of them or none. Withdrawing from one ward while leaving others live is a different act —
     * changing your mind about a destination, not about the admission — and it does not exist yet.
     *
     * The reason code is `referrer_withdrew` and is NOT taken from the event. `WITHDRAWAL_REASONS`
     * says adding a member is a governance decision, and the reasons a referrer would give — the
     * patient improved, went home, went elsewhere, died — are clinical facts about a person. So the
     * flow exists and the vocabulary is left to the owner.
     */
    case "WITHDRAW_REFERRAL": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Already finished, by arrival or otherwise. Withdrawing a closed movement would append a
      // withdrawal to a record that has already ended, and every count derived from
      // withdrawnReferrals would then include a referral that was never live at that moment.
      if (movement.closure) {
        return reject(state, event, `movement ${movement.id} has already closed and cannot be withdrawn`);
      }
      // A bed has been given. This is no longer a referral anybody can take back: the ward is
      // holding a bed for this person, and undoing that is the ward's own decline, not a
      // withdrawal by the referrer.
      if (movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `movement ${movement.id} has already been accepted by ${movement.acceptedUnitId}; a withdrawal cannot undo an acceptance`,
        );
      }
      if (movement.referredUnitIds.length === 0) {
        return reject(state, event, `movement ${movement.id} holds no live referral to withdraw`);
      }

      const withdrawn = movement.referredUnitIds.map((unitId) => ({
        unitId,
        at: event.now,
        reason: "referrer_withdrew" as const,
      }));
      const updated: Movement = {
        ...movement,
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawn],
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: "The referrer withdrew the referral",
        },
        // Nothing is blocking a movement that is over. Left saying "Awaiting destination response"
        // it would keep a withdrawn patient looking like a live obstruction.
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "PULL_PATIENT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot pull a bed for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "accepted_awaiting_bed") {
        return reject(state, event, `cannot pull a bed while the movement is ${movement.stage}`);
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
        return reject(state, event, `no allocatable bed remains at ${unit.name} (bed_pulled_for_earlier_referral)`);
      }
      /*
       * ⚠️ **A PULL IS REFUSED AGAINST A BED THAT IS NOT READY.** Owner ruling, 2026-09-01:
       * *"A pull cannot occur unless the bed is actually available and open, not pending (i.e. being
       * cleaned)"*.
       *
       * **Before this line a patient could be pulled to a bed that was still being cleaned.** The
       * check above reads `allocatable`, which is the ward's own claim about what it can staff, and
       * `availableNow` reads no readiness field at all — `ward-bed-availability.ts` says so
       * deliberately, on the reasoning that a bed being prepared is still worth counting because the
       * pull takes hours anyway. **The owner has overruled that reasoning.**
       *
       * **The refusal lives HERE and not on a screen, and that is the whole point.** A test asserting
       * that a ward's page says "pending" passes against a build in which this refusal was never
       * written. The property that matters is that the state transition cannot happen.
       *
       * `availableNow` is deliberately NOT changed — he was asked whether cleaning should drop the
       * ward's number or only refuse the pull, and chose the refusal, because the ward has not changed
       * what it can staff and its figures should not lurch as cleaning starts and stops.
       */
      /*
       * ⚠️ **ONLY WHEN PREPARATION IS THE CAUSE.** Written first as `openBedsNow(...) <= 0` alone,
       * which also fired when the ward simply had no free bed — hijacking a different guard's case and
       * reporting "still being made ready (0 pending)", which is untrue and hides the real reason. It
       * broke `refuses an arrival once the unit's physically empty beds are exhausted`, which is how it
       * was caught. A refusal must state the reason that actually applies.
       */
      const pending = bedsPendingPreparation(unit.id, state.bedReleases);
      if (pending > 0 && openBedsNow(unit, state.bedReleases) <= 0) {
        return reject(
          state,
          event,
          `every free bed at ${unit.name} is still being made ready (${pending} pending); a patient cannot be pulled to a bed that is not open`,
        );
      }
      /*
       * ⚠️ **A PULL FOR SOMEBODY NEEDING ONE-TO-ONE OBSERVATION IS REFUSED WHEN THE WARD HAS
       * NOBODY LEFT TO WATCH THEM.** Owner ruling, 2026-09-01 (ruling 1 of fourteen): one-to-one
       * nursing is recorded as the ward's staffing of the bed, and `Unit.speciallingCapacity` is
       * what that recording counts.
       *
       * **Before this line the ward handed out a bed it could not staff, without limit.** The only
       * check that existed — `eligibility()`'s `specialling` gate — asks `speciallingCapacity > 0`,
       * a figure authored per unit that no reducer path has ever changed. So it could say whether a
       * ward had ANY capacity and never whether it had any LEFT: the second, third and fourth
       * one-to-one patient all passed the same gate as the first.
       *
       * **The refusal lives HERE and not only on that screen, and that is the whole point.** A test
       * asserting a ward's page shows a specialling gate passes against a build where this refusal
       * was never written — the same reasoning the pending-preparation refusal above records. The
       * property that matters is that the state transition cannot happen.
       *
       * ⚠️ **ONLY WHEN SPECIALLING IS THE CAUSE, and the guard above is the cautionary tale.** It
       * is gated on `movement.specialling` first, so an ordinary pull into a ward with no
       * one-to-one headroom left is untouched and still meets whichever guard actually applies. A
       * refusal must state the reason that really applies; naming "no bed" here, or naming
       * specialling for a movement that needs none, is a refusal that hides the real cause.
       *
       * The remaining figure is DERIVED from the beds — never a counter this handler decrements.
       * See `remainingSpeciallingCapacity`.
       */
      if (movement.specialling && remainingSpeciallingCapacity(unit, state.admissions) <= 0) {
        return reject(
          state,
          event,
          `${unit.name} has no one-to-one specialling capacity left (${unit.speciallingCapacity} staffable, all in use); this patient needs specialling and the ward cannot staff another`,
        );
      }

      /*
       * ⚠️ THE ELIGIBILITY GATE GOES LAST, AFTER EVERY EXISTING REFUSAL, and that ordering is a
       * decision rather than an accident. Ward Lead's ruling, 2026-09-02: the refusals above are
       * cheaper, more specific, and mostly about the world rather than the patient — wrong stage,
       * no allocatable bed, a bed still being prepared, no specialling staff. **A coordinator who
       * pulled at the wrong stage should be told THAT, not told about cohort.**
       *
       * ⚠️ AND IT IS WHY A RED HERE PROVES NOTHING ON ITS OWN. The specialling refusal directly
       * above fires for a patient who fails BOTH that check and an eligibility gate, and reading it
       * as "the engine now enforces eligibility" nearly closed this finding falsely. **Prove this
       * gate on a pair whose ONLY failing gate is cohort.**
       */
      const pullRefusal = eligibilityRefusal(event, movement, unit, event.now);
      if (pullRefusal) return reject(state, event, pullRefusal);

      const updatedUnit: Unit = {
        ...unit,
        allocatable: { ...unit.allocatable, value: unit.allocatable.value - 1, confirmedAt: event.now },
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
       * ⚠️ **`state` IS `"pulled"` AND `arrivedAt` IS `null`, AND UNTIL 2026-09-01 BOTH WERE WRONG.**
       * This record was written `state: "occupied"` with `arrivedAt: event.now` — so the instant a
       * ward gave a bed away, the system recorded that the person had ARRIVED IN IT. They had not.
       * They were usually still in an emergency department waiting for transport that had not been
       * booked yet: this event is three stages before `PATIENT_ARRIVED`.
       *
       * **Owner ruling, 2026-09-01:** *"a patient is not marked as arrived until the ward says they
       * have arrived. The pull just means the bed is allocated to them."* `PATIENT_ARRIVED` is the
       * ward saying so, and it is the only event that may write `arrivedAt`.
       *
       * **Nothing was red, and the damage was silent and one-directional.** `daysInBed` counts from
       * `arrivedAt`, so every stay begun by a pull was inflated by the whole transport delay — a
       * plausible number, never a broken one. `ADMISSION_STATES` has carried `"pulled"` and
       * `bedIsOccupied` has counted it since the day it was written; the bed is still gone from this
       * instant, so no availability figure changes. Only the claim about the PERSON does.
       *
       * `pulledAt` is `event.now`: this event IS the pull. It read `movement.transport?.collectedAt`,
       * which is a second defect of the same shape — a movement at `accepted_awaiting_bed` has no
       * transport job (`BOOK_TRANSPORT` comes two stages later), so that expression was `null` on
       * every path that could reach it, and the field it defends against overstating was simply never
       * written at all.
       */
      const admission: Admission = {
        id: `AD-ARR-${String(state.admissionSequence + 1).padStart(2, "0")}`,
        unitId: unit.id,
        // The ward's own commitment to staff this bed one-to-one, copied from the movement, where a
        // person ticked it at intake. Never derived from anything else about the patient, and the
        // only runtime writer of this field — see `Admission.specialling`.
        specialling: movement.specialling,
        referralId: null,
        sex: movement.sex,
        homeRegion: null,
        tentativeDiagnosis: null,
        state: "pulled",
        pulledAt: event.now,
        arrivedAt: null,
        // Null, and it is a statement rather than a default: nobody is away at an emergency
        // department in the sense this field means — a ward sending an occupant of ITS OWN bed out
        // for a medical problem. This person has not reached the ward at all yet, which is what
        // `state: "pulled"` and a null `arrivedAt` already say.
        awayAtEmergencyDepartmentSince: null,
        expectedDischargeAt: null,
        dischargeDateMoves: 0,
        dischargeDateSetAt: null,
        dischargeDateSetBy: null,
        dischargeConfirmedAt: null,
        dischargeConfirmedBy: null,
        blockReason: null,
        leavingDestination: null,
        leftAt: null,
        followUp: null,
      };

      const updatedMovement: Movement = {
        ...movement,
        stage: "pulled",
        pullExpiresAt: event.now + 60,
        // The join `RELEASE_PULL` needs to undo exactly this record, and `PATIENT_ARRIVED` needs to
        // mark exactly this one as having arrived. See `Movement.admissionId`.
        admissionId: admission.id,
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
        declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }],
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
      if (movement.stage !== "pulled") {
        return reject(state, event, `cannot ready a handover while the movement is ${movement.stage}`);
      }
      /*
       * 🔴 THIS FABRICATED A TRANSPORT JOB AND ANSWERED A CLINICAL QUESTION NOBODY HAD ASKED.
       *
       * It created `transport` on the spot with `escortRequired: movement.legalStatus !==
       * "Voluntary"` — a judgement made by no person, rendered on screen as though a clinician had
       * made it, and wrong in BOTH directions: a voluntary patient can need an escort, and a
       * detained one settled enough to travel may not. `TR-D1` names escort as one of the two facts
       * the sending team is booking BECAUSE it knows them. The provider was fabricated too, taking
       * `TRANSPORT_PROVIDERS[0]` whenever the event carried no choice.
       *
       * It survived `BOOK_TRANSPORT` landing by an hour, deliberately: removing it before a booking
       * control existed would have dead-ended "Mark handover ready" on a screen this session does
       * not own. The control landed at `caacf1eda` with the escort question blank and the provider
       * unchosen, so the bridge goes.
       *
       * ⚠️ **HANDOVER READY NOW REQUIRES A BOOKED TRANSPORT rather than inventing one.** The two
       * changes cannot be apart: a stage that can be reached with no transport, on a model where
       * nothing else creates one, is a patient marked ready to hand over with no way to move them.
       */
      if (!movement.transport) {
        return reject(state, event, `cannot ready a handover before transport is booked (BOOK_TRANSPORT)`);
      }
      const updated: Movement = { ...movement, stage: "handover_ready" };
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
        // ⚠️ THE PROVIDER HAS NOW ANSWERED, so `"Awaiting a transport provider response"` — which
        // `BOOK_TRANSPORT` wrote and nothing had replaced — is not merely stale here, it is
        // CONTRADICTED BY THE RECORD BESIDE IT: `acceptedAt` on the same movement, on the same
        // screen, holds the answer the sentence says is outstanding.
        blocker: STAGE_TRANSITION_BLOCKERS.transportAccepted,
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
        // The vehicle is moving. This is the instant the old sentence was worst: a coordinator
        // reading "Awaiting a transport provider response" chased a patient whose ambulance was
        // already on the road. Still an ACTIVE blocker — nobody has been collected — so the
        // operational score is unchanged by the rewording.
        blocker: STAGE_TRANSITION_BLOCKERS.transportEnRoute,
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
        // Nothing is blocking a patient who is in a vehicle — and the SEED already says so in these
        // exact words on its two `moving` movements. Reused verbatim rather than reworded.
        blocker: STAGE_TRANSITION_BLOCKERS.collected,
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
        // Reachable in practice: PULL_PATIENT's own floor check only bounds `allocatable.value`, and
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
        // The seed's own words for an arrived movement, verbatim. This and `collected` above are
        // the pair a derivation could never hold apart: two situations, both with no blocker, and
        // the sentence is the only thing that says which.
        blocker: STAGE_TRANSITION_BLOCKERS.arrived,
      };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      /*
       * ⚠️ **THIS IS THE EVENT THAT MAY WRITE `arrivedAt`, AND IT IS THE ONLY ONE.** Owner ruling,
       * 2026-09-01: *"a patient is not marked as arrived until the ward says they have arrived."*
       * `PULL_PATIENT` creates the record `pulled`, with a null `arrivedAt`; this is where the ward
       * says they got here, so this is where the person becomes `occupied` and the stay clock starts.
       *
       * **The admission is looked up by id, never searched for by unit and state.** Two people
       * pulled to one ward is ordinary, and a search would flip whichever one it found first.
       *
       * **Absent is a real case and is left exactly alone.** A movement whose `pulled` stage was
       * hand-authored in the seed rather than reached by dispatching `PULL_PATIENT` has no
       * `admissionId`, so no record exists to mark. Fabricating one here would invent an occupant
       * this reducer never created — and the seed already authors its own ward occupants.
       */
      const pulledAdmission =
        movement.admissionId === undefined ? undefined : findAdmission(withUnit, movement.admissionId);
      const withPerson =
        pulledAdmission === undefined || pulledAdmission.state !== "pulled"
          ? withUnit
          : replaceAdmission(withUnit, pulledAdmission.id, {
              ...pulledAdmission,
              state: "occupied",
              arrivedAt: event.now,
            });
      return replaceMovement(withPerson, movement.id, updatedMovement);
    }

    /**
     * A PATIENT LEAVES. The mirror of `PATIENT_ARRIVED` above, and deliberately written beside it.
     *
     * Until this existed the prototype could admit somebody and never discharge them. Patients
     * arrived and stayed forever, so the second half of this project's own claim — following one
     * person through to their bed being free again — had never been seen working.
     *
     * WHAT IT DOES TO THE UNIT, and why it is exactly the inverse of arrival rather than more:
     *
     *   `empty` RISES, because a bed that was physically occupied is now physically vacant. Arrival
     *   lowered it by one; leaving raises it by one. Clamped to `unit.beds` for the same reason
     *   `RELEASE_BED` clamps: `unitCapacity`'s reconciliation identity depends on `empty.value`
     *   never exceeding the ward's real bed count, and an unclamped write breaks it from the write
     *   side rather than the read side.
     *
     *   `sexMix` FALLS for this person's sex, because it counts current occupants and this person
     *   is no longer one. Floored at zero: authored data that already disagrees with itself must
     *   not be able to drive a count negative.
     *
     *   `allocatable` is NOT touched, and that is a decision rather than an omission. It is the
     *   ward's own claim about what it can actually allocate, and a bed whose occupant has just
     *   walked out is not yet a bed the ward has said it can fill. Raising it here would let a
     *   discharge silently allocate a bed nobody has prepared. The existing bed-release lifecycle
     *   (`FLAG_BED_RELEASE` → `CONFIRM_BED_RELEASE` → `RELEASE_BED`) is where a ward makes that
     *   claim, and `RELEASE_BED` remains the only event that raises both figures.
     *
     * The admission itself is not deleted. It ends: `state: "departed"`, with the instant and the
     * destination. Every "live admissions" reader already filters `state !== "departed"`, so the person
     * leaves the ward's lists by ending rather than by being erased — which is what lets the board,
     * the discharge dates and the community hub still see that they went, and where.
     */
    case "RECORD_LEAVING": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `RECORD_LEAVING was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Refused rather than treated as a no-op: a second discharge would overwrite `leftAt` with a
      // later instant and silently shorten the recorded stay of somebody who left hours earlier.
      if (admission.state === "departed") {
        return reject(state, event, `admission ${admission.id} has already left`);
      }
      // Only somebody who is actually in a bed can leave one. A `waitlisted` or `pulled` admission
      // has never occupied a bed, so ending it is not a discharge — giving back a pull is
      // `RELEASE_PULL`'s job, and routing it through here would credit the ward a bed it never lost.
      if (admission.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${admission.id} is ${admission.state}, and only somebody occupying a bed can leave one`,
        );
      }

      const unit = findUnit(state, admission.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${admission.unitId}`);

      const updatedUnit: Unit = {
        ...unit,
        empty: { ...unit.empty, value: Math.min(unit.beds, unit.empty.value + 1), confirmedAt: event.now },
        sexMix: { ...unit.sexMix, [admission.sex]: Math.max(0, (unit.sexMix[admission.sex] ?? 0) - 1) },
      };
      const departed: Admission = {
        ...admission,
        state: "departed",
        leftAt: event.now,
        leavingDestination: event.leavingDestination,
      };
      return replaceAdmission(replaceUnit(state, unit.id, updatedUnit), admission.id, departed);
    }

    /**
     * AWAY AT AN EMERGENCY DEPARTMENT, AND BACK AGAIN — the two halves of one fact, written
     * together because half of it is the defect.
     *
     * `Admission.awayAtEmergencyDepartmentSince` shipped on 2026-08-30 with a renderer, a seed and
     * NO EVENT AT EITHER END. Nothing could set it and nothing could clear it, so the seeded rows
     * counted upward for as long as the demonstration ran and every occupant without the badge read
     * as physically in their bed.
     *
     * ⚠️ **NEITHER CASE TOUCHES A UNIT.** No `replaceUnit`, no `empty`, no `allocatable`, no
     * `sexMix` — deliberately, and it is the single most important property of both. The ward is
     * holding this bed because the person is coming back; `bedIsOccupied` counts them throughout
     * and no availability figure moves in either direction. A coordinator must never be offered
     * this bed. Pinned in `tests/ward-away-at-emergency-department.test.ts`.
     */
    /**
     * SOMEBODY SAYS WHAT IS ACTUALLY HOLDING THIS PATIENT UP.
     *
     * ⚠️ **`Movement.blocker` — the free-prose one — and NOT `BedRelease.blocker`**, the
     * `BedReleaseBlocker` enum written by `BLOCK_BED_RELEASE`/`CLEAR_BED_RELEASE_BLOCK` further
     * down this file. Two different fields share that name and this case touches only the first.
     *
     * The field had ONE runtime writer, `RAISE_REFERRAL`, stamping `"Awaiting coordinator
     * referral"` at creation, and nothing after it. `STAGE_TRANSITION_BLOCKERS` now restates it
     * wherever a transition contradicts it; this is the other half, and it is the half that
     * matters most, because the
     * things a coordinator actually needs to read — a single room not yet clean, a family not yet
     * reached, an escort provider still finding a vehicle — are facts NOTHING in this model can
     * compute. Only a person can put them here.
     *
     * ⚠️ **THE VALUE IS NOT MEMBERSHIP-CHECKED, WHICH IS A DEPARTURE FROM EVERY OTHER REASON IN
     * THIS REDUCER, AND IT IS DELIBERATE.** `BLOCK_BED_RELEASE` checks its blocker against
     * `BED_RELEASE_BLOCKERS`; `REFER_TO_UNITS` checks its override reason against
     * `OVERRIDE_REASONS`. This one has no list to check against, on the owner's 2026-09-01 ruling:
     * a fixed list cannot hold an absence together with its reason (`"None — in transit"` versus
     * `"None — handover complete"`), and it cannot hold activity by parties the model has no field
     * for. Constraining it would lose exactly what deriving it would lose.
     *
     * The one check is that something was actually said. A blank is refused rather than stored:
     * `Movement.blocker` has no null, so an empty string would be indistinguishable from a field
     * nobody had reached, which is the ambiguity this event exists to end.
     *
     * ⚠️ **NO ROLE IS RECORDED ALONGSIDE IT.** Four roles may raise this and the record does not
     * say which did — deliberately, because inventing an attribution is worse than omitting one,
     * and this field has never claimed to be attributed. If who said it ever matters, that is a
     * new field with its own ruling, not a quiet addition here.
     */
    /**
     * THE URGENT FLAG, ON AND OFF — the mechanism the owner asked for on 2026-08-30 and that
     * nobody could reach until 2026-09-01.
     *
     * `Movement.flaggedUrgent` was added with a ranking rule above it (`queueOrder` in
     * ward-priority.ts puts it ABOVE all three urgency tiers) and a badge below it (the coordinator
     * queue's "Flagged urgent"). The only writer was the literal `false` in `RAISE_REFERRAL`, and
     * exactly one hand-authored movement carried `true`. **A fully built feature with no way in.**
     *
     * ⚠️ **BOTH HALVES, and the clearing half is the one that stops this becoming a new permanent
     * state.** A flag nobody can remove sits above every tier for the rest of the demonstration on
     * a patient whose situation has resolved, and the seeded `true` could never be cleared at all.
     *
     * ⚠️ **NOTHING IS RECORDED BESIDE THE BOOLEAN** — no reason, no author, no instant. The reason
     * is the owner's explicit deferral ("for many reasons", plural and unenumerated); the author
     * and instant would be a model widening with a ruling in front of it. `event.now` is therefore
     * unused by both cases, which is deliberate rather than an oversight: every event in this model
     * carries it, and this pair has nothing to stamp it on.
     */
    case "FLAG_MOVEMENT_URGENT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // A closed movement is off `queueOrder` entirely (`isOpen` removes it), so flagging one would
      // change nothing and report that it had. Refused rather than accepted as a silent no-op, the
      // same discipline every other movement-scoped handler here holds to.
      if (movement.closure) {
        return reject(state, event, `cannot flag a closed movement as urgent (${movement.closure.reason})`);
      }
      if (movement.flaggedUrgent) {
        return reject(state, event, `movement ${movement.id} is already flagged urgent`);
      }
      return replaceMovement(state, movement.id, { ...movement, flaggedUrgent: true });
    }

    case "CLEAR_MOVEMENT_URGENT_FLAG": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // ⚠️ NO `closure` CHECK, unlike flagging above, and the asymmetry is the point. Removing a
      // flag can never promote anybody, so refusing it has no protective value — while a flag that
      // could not be cleared on some future path is the exact permanent state this pair exists to
      // prevent. The guard below is the only one needed: it proves there is something to clear.
      if (!movement.flaggedUrgent) {
        return reject(state, event, `movement ${movement.id} is not flagged urgent`);
      }
      return replaceMovement(state, movement.id, { ...movement, flaggedUrgent: false });
    }

    case "RECORD_MOVEMENT_BLOCKER": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Refused for a closed movement, the same as every other movement-scoped handler here. A
      // closed movement is off every open board and its blocker is the closing one — a later edit
      // would describe an obstruction to something that is no longer happening.
      if (movement.closure) {
        return reject(state, event, `cannot record a blocker for a closed movement (${movement.closure.reason})`);
      }
      const blocker = event.blocker.trim();
      if (blocker.length === 0) {
        return reject(state, event, `RECORD_MOVEMENT_BLOCKER blocker must say something — a blank is not a statement`);
      }
      /*
       * ⚠️ A NEAR-MISS OF A "NOTHING IS BLOCKING" SENTINEL IS REFUSED, AND SENT TO THE RIGHT EVENT.
       *
       * `hasActiveBlocker` (ward-priority.ts) compares against `BLOCKERS_MEANING_NOTHING_IS_BLOCKING`
       * by exact equality, so `"none — in transit"` in lower case would be stored as an ACTIVE
       * blocker worth ten points in `operationalScore` — a wrong score on a movement nobody is
       * holding up, which is the computed kind of wrong rather than the displayed kind.
       *
       * ⚠️ **THIS IS EXACT EQUALITY IGNORING CASE AGAINST A CLOSED SET, AND MUST NEVER BECOME A
       * PATTERN.** That boundary is the whole reason it is safe: `"None of the secure units can
       * take him"` is not case-insensitively equal to any member, so it is stored as the real
       * blocker it is — the case `tests/ward-priority.test.ts` pins. A `/^none/i` here would
       * swallow it, which is precisely the fix that was refused.
       *
       * It does NOT catch every way of typing "nothing is blocking" and is not meant to.
       * `"Nothing outstanding"` and `"N/A"` are still stored as obstructions, because this set does
       * not interpret English and must not start. `CLEAR_MOVEMENT_BLOCKER` is what a person uses,
       * and this refusal names it rather than leaving them to guess.
       */
      const nearMiss = BLOCKERS_MEANING_NOTHING_IS_BLOCKING.find(
        (inactive) => inactive.toLowerCase() === blocker.toLowerCase() && inactive !== blocker,
      );
      if (nearMiss !== undefined) {
        return reject(
          state,
          event,
          `"${blocker}" differs from "${nearMiss}" only in case, and would be stored as an active blocker — use CLEAR_MOVEMENT_BLOCKER to say nothing is holding this up`,
        );
      }
      // Trimmed, never as typed: trailing whitespace would make two identical statements compare
      // unequal, and `hasActiveBlocker` (ward-priority.ts) trims before matching its "nothing is
      // blocking" shapes — a stored `"None — in transit "` would score ten points there.
      return replaceMovement(state, movement.id, { ...movement, blocker });
    }

    /**
     * NOTHING IS HOLDING THIS PATIENT UP ANY MORE.
     *
     * ⚠️ **CLEARING IS REPRESENTED, NOT INTERPRETED, AND THAT IS THE WHOLE POINT OF THE EVENT.**
     * `RECORD_MOVEMENT_BLOCKER` shipped earlier the same day accepting any non-blank prose, while
     * `hasActiveBlocker` recognised "nothing is blocking" by case-sensitive match against a small
     * vocabulary. A person clearing a blocker by typing `"none — resolved"` or `"no blocker"` left
     * the movement scoring ten points as obstructed in `operationalScore`, and so ranked above
     * patients who really were blocked — silently, with nothing red.
     *
     * Widening the recogniser was refused: the next phrasing is missed too, and a case-insensitive
     * `/^none/i` would swallow `"None of the secure units can take him"`, a real blocker the
     * priority tests pin. Instead this writes ONE sentinel from
     * `BLOCKERS_MEANING_NOTHING_IS_BLOCKING`, so the recogniser only ever knows a closed set.
     *
     * `"None — cleared"` rather than `"No blocker"`: an absence WITH its reason. "No blocker" means
     * nobody ever recorded one; this means somebody looked and said it is gone. That is the same
     * distinction `"None — in transit"` and `"None — handover complete"` exist to preserve, and it
     * is the property the owner's ruling against deriving this field turns on.
     */
    case "CLEAR_MOVEMENT_BLOCKER": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot clear the blocker on a closed movement (${movement.closure.reason})`);
      }
      // Refused rather than accepted as a no-op, the same discipline as the flag pair above: a
      // control that reports success for an act that changed nothing is the untruth this prototype
      // names as mattering most. `"None — cleared"` and the other sentinels are all already
      // "nothing is blocking", so there is nothing to clear.
      if (BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === movement.blocker.trim())) {
        return reject(state, event, `movement ${movement.id} already records that nothing is holding it up`);
      }
      return replaceMovement(state, movement.id, { ...movement, blocker: "None — cleared" });
    }

    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `RECORD_AWAY_AT_EMERGENCY_DEPARTMENT was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Only somebody actually IN a bed can leave the ward and still have it kept for them. A
      // `waitlisted` or `pulled` admission has never reached the ward — they are usually sitting in
      // an emergency department already, which is the mirror image of what this field means and
      // exactly the confusion `Admission.awayAtEmergencyDepartmentSince`'s own doc comment warns
      // about. A `departed` admission has no bed to hold at all.
      if (admission.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${admission.id} is ${admission.state}, and only somebody occupying a bed can be away from it`,
        );
      }
      // Refused rather than treated as a no-op, the same reasoning `RECORD_LEAVING` uses for a
      // second discharge: overwriting the instant with a later one would silently SHORTEN the
      // recorded trip of somebody who has been in an emergency department for six hours, and the
      // board renders that number in words.
      if (admission.awayAtEmergencyDepartmentSince !== null) {
        return reject(state, event, `admission ${admission.id} is already recorded as away at an emergency department`);
      }
      return replaceAdmission(state, admission.id, { ...admission, awayAtEmergencyDepartmentSince: event.now });
    }

    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Refused rather than silently written as `null`. `null` already means "on the ward", so a
      // return recorded for somebody who was never away would be indistinguishable from a no-op —
      // and a control that reports success for an act that did not happen is the one untruth this
      // prototype's own history names as mattering most.
      if (admission.awayAtEmergencyDepartmentSince === null) {
        return reject(state, event, `admission ${admission.id} is not recorded as away at an emergency department`);
      }
      // `state` is deliberately NOT checked here, unlike the event above. Somebody may only GO
      // while occupying a bed, but the guard directly above already proves this admission is away,
      // and refusing their return on a state check would strand the badge permanently if any future
      // path ever moved an away admission's state. A flag nobody can clear is the defect being
      // repaired, so the clearing half is guarded on the flag itself and nothing else.
      return replaceAdmission(state, admission.id, { ...admission, awayAtEmergencyDepartmentSince: null });
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
      // `FLAG_BED_RELEASE` is `ward`-only, so unlike RELEASE_PULL/CANCEL_TRANSPORT there is no
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
      // Bed-model rework (2026-08-28): a flag ALWAYS creates a `"expected"` release, and a
      // blocker sets the blocked FLAG on it rather than choosing a different state. Spec D3's
      // old "blocked xor expected" rule is gone with the fourth state it described — a bed
      // that is coming free but currently held up is a prediction AND a block, and pretending
      // those were alternatives is what let `capacityBreakdown` count such a release nowhere.
      // `waitingOn` is therefore kept on both paths, because the release is expected on both.
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
        state: "expected",
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
      // RELEASE_PULL/CANCEL_TRANSPORT there is no coordinator caller to exempt.
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `CONFIRM_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transition: expected -> confirmed. Nothing else. Naming both the current state and
      // the attempted target keeps a refusal readable without having to cross-reference the state
      // machine comment above. (Before the 2026-08-28 rework this also accepted `blocked ->
      // confirmed`; there is no such state now, and a blocked release is confirmed from whichever
      // stage it is actually in, keeping its flag.)
      if (release.state !== "expected") {
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
      // Legal transition: confirmed -> expected. `discharged` is terminal and `expected` is
      // already there, so both fall into the same refusal.
      if (release.state !== "confirmed") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to expected`);
      }
      // Membership check, not truthiness — the same discipline BLOCK_BED_RELEASE's own blocker
      // check holds to, and for the same reason: a runtime rule, not merely a compile-time one.
      if (!BED_RELEASE_WAITING_ON.includes(event.waitingOn)) {
        return reject(state, event, `REVERT_BED_RELEASE waitingOn must be chosen from BED_RELEASE_WAITING_ON`);
      }
      // The blocked flag survives: reversing the discharge decision does not unstick the bed.
      const reverted: BedRelease = {
        ...release,
        state: "expected",
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
      // release keeps whichever stage it was in — `expected` stays expected, and a confirmed
      // discharge that gets stuck stays CONFIRMED and keeps counting as confirmed. Only
      // `discharged` is refused: the bed is already free, so there is nothing left to hold up.
      const blockedUnit = findUnit(state, release.unitId);
      if (!blockedUnit) return reject(state, event, `no unit found for id ${release.unitId}`);
      if (release.state === "discharged") {
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
      // Legal transitions: confirmed -> released and expected -> released. `discharged` is
      // terminal, so only a release already in it is refused. Expected is accepted deliberately:
      // "the person has left" is a statement of fact about an empty bed, not a prediction being
      // promoted into availability, and the four-stage model already permitted the same journey
      // via `expected -> blocked -> released`. Narrowing it during the rework would have refused
      // a path wards could already take.
      if (release.state === "discharged") {
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
        state: "discharged",
        waitingOn: null,
        blocker: null,
        blockedBy: null,
        confirmedAt: event.now,
      };
      // RELEASE_BED is the one event in this six-case group that changes an actual bed count,
      // not just a record about one — this is where the expected/confirmed expectation
      // `FLAG_BED_RELEASE`/`CONFIRM_BED_RELEASE` only anticipated becomes the physical fact.
      // `capacityBreakdown`'s `availableNow` is deliberately blind to `bedReleases` itself (Task
      // 2: nothing expected or confirmed-but-unreleased may ever be added into it), so the only
      // way a release ever moves that number is through the unit's own fields, here. Both
      // `allocatable.value` and `empty.value` rise by one: the bed is now truly free, not merely
      // reserved (`allocatable` alone) or physically vacant while still pulled for someone else
      // (`empty` alone) — mirroring `PATIENT_ARRIVED`'s and `PULL_PATIENT`'s own single-field writes,
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
      //
      // Since the destination union landed, `sex` exists only on the ward arm, so the check is
      // guarded by the arm rather than dropped: the runtime hole this closes is an untyped caller,
      // and an untyped caller can just as easily send a malformed ward destination.
      // FD-21: one act, several destinations, up to the cap. Each of these refusals names a
      // different way the list can be wrong, because "invalid destinations" tells a caller nothing.
      if (event.destinations.length === 0) {
        return reject(state, event, `RECEIVE_REFERRAL needs at least one destination`);
      }
      if (event.destinations.length > PARALLEL_REFERRAL_CAP) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL may address at most ${PARALLEL_REFERRAL_CAP} destinations, not ${event.destinations.length}`,
        );
      }
      const kinds = event.destinations.map((destination) => destination.kind);
      if (new Set(kinds).size !== kinds.length) {
        // Asking one kind twice is asking twice, not addressing two destinations. Refused rather
        // than de-duplicated: silently collapsing it would make the cap count something other than
        // what the referrer chose.
        return reject(state, event, `RECEIVE_REFERRAL cannot address the same destination kind twice`);
      }
      if (kinds.some((kind) => !REFERRAL_DESTINATION_KINDS.includes(kind))) {
        return reject(state, event, `RECEIVE_REFERRAL destination kind must be chosen from REFERRAL_DESTINATION_KINDS`);
      }
      /*
       * ⚠️ THE ED ARM GETS THE SAME TREATMENT AS `originSiteCode`, FOR THE SAME REASON.
       *
       * That field's own comment three checks below says it: "resolved against the real network
       * rather than merely checked for non-emptiness, so '12 Wellington St, Perth' cannot pass as a
       * code." When the ED arm gained `edId` and `purpose` it got neither — so a referral could
       * queue at an empty or invented department and read like an answer.
       *
       * ⚠️ **This is the check that would have caught the shortcut two sessions agreed must not be
       * made.** When the arm grew required fields, three call sites stopped compiling and the
       * tempting repair was a cast or an `edId: ""` stub — a form offering a destination the
       * application cannot construct, while looking finished. That stub was mutation-tested and
       * broke only new SCREEN-level guards and no pre-existing test. A screen guard is the wrong
       * last line: it is one component away from being bypassed, and every path goes through here.
       *
       * ⚠️ **And non-emptiness is not the check.** `edId: "not-a-department"` is as wrong as `""`
       * and far more convincing — it survives every truthiness test, reads as a plausible
       * identifier, and queues a real person at a hospital that does not exist. So it resolves.
       */
      const edDestination = event.destinations.find((destination) => destination.kind === "emergency_department");
      if (edDestination?.kind === "emergency_department") {
        if (!allEmergencyDepartments().some((department) => department.id === edDestination.edId)) {
          return reject(state, event, `RECEIVE_REFERRAL edId must resolve to a real emergency department`);
        }
        if (!REFERRAL_PURPOSES.includes(edDestination.purpose)) {
          return reject(state, event, `RECEIVE_REFERRAL purpose must be chosen from REFERRAL_PURPOSES`);
        }
      }
      const wardDestination = event.destinations.find((destination) => destination.kind === "psychiatric_ward");
      if (wardDestination?.kind === "psychiatric_ward" && !SEXES.includes(wardDestination.sex)) {
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
      // The suburb is resolved against the real catchment table, never merely checked for
      // non-emptiness — the same reason `edId` and `originSiteCode` below resolve rather than
      // measure. "12 Wellington St, Perth" is non-empty, and letting it through would put a street
      // address in the one field whose defence is that it is coarser than one (`PD-3`).
      if (!referralSuburbIsAnswered(event.suburb)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL suburb must name a suburb the catchment source knows, or state that it is not known`,
        );
      }
      if (event.urgency !== 1 && event.urgency !== 2 && event.urgency !== 3) {
        return reject(state, event, `RECEIVE_REFERRAL urgency must be 1, 2 or 3`);
      }
      // A synthetic site code, never an address — resolved against the real network rather than
      // merely checked for non-emptiness, so "12 Wellington St, Perth" cannot pass as a code.
      if (!siteByCode(event.originSiteCode)) {
        return reject(state, event, `RECEIVE_REFERRAL originSiteCode must resolve to a real site`);
      }
      // A triage instant in the FUTURE would put a patient in the department before they got
      // there, and `referralClocks` clamps at zero rather than printing a negative — so the wrong
      // value would render as a plausible "0m" instead of an obvious error. Refused at the door.
      if (event.triagedAt !== undefined && event.triagedAt > event.now) {
        return reject(state, event, `RECEIVE_REFERRAL triagedAt cannot be later than the referral itself`);
      }
      /*
       * ⚠️ THREE STATES, NOT TWO — and the guard below must only ever separate the second from
       * the third. `event.patientId`'s own doc comment (above, on the event type) says a referral
       * raised outside the patient flow LEGITIMATELY has nobody on file, so ABSENT is a real
       * answer that must keep sailing through untouched — exactly as `created.patientId` below is
       * still "COPIED THROUGH, NEVER DEFAULTED". What was never checked is the other failure
       * shape: a `patientId` that IS present but names nobody `state.patients` holds — a fabricated
       * link that would render as a referral belonging to a patient who is not there, the mistyped-
       * web-address case the front door has no defence against otherwise.
       *
       * This is not a new standard — it matches the sibling that already does this exact job.
       * `RAISE_REFERRAL.referralId` (this file, `case "RAISE_REFERRAL"`, the `findReferral`
       * lookup) refuses an id naming no referral with a visible `Rejection` rather than storing
       * it, on the same "optional because most journeys have none, resolved when present" shape
       * this field's own doc comment cites by name. Read that guard before touching this one.
       *
       * So: absent → `event.patientId === undefined` short-circuits the `&&` and this line does
       * nothing (state 1, fine). Present and real → `.some` finds it and this line does nothing
       * (state 2, fine). Present and naming nobody → `.some` finds nothing and this REFUSES (state
       * 3). Collapsing state 1 into state 3 — dropping the presence check — would refuse every
       * referral raised with no person on file, which is the front door this field exists to keep
       * open.
       */
      if (event.patientId !== undefined && !state.patients.some((patient) => patient.id === event.patientId)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL patientId must name a patient this system already holds, and ${event.patientId} names none`,
        );
      }
      const sequence = state.frontDoorReferralSequence + 1;
      const created: Referral = {
        id: nextFrontDoorReferralId(sequence),
        // ⚠️ COPIED THROUGH, NEVER DEFAULTED. `undefined` here means the referral was raised
        // without a person on file — which is a real case, not a gap to be filled. Inventing an id
        // to avoid an empty field is how a referral comes to point at the wrong human being.
        patientId: event.patientId,
        ageBand: event.ageBand,
        // Every destination starts queued: the referrer chose them, nobody has answered yet.
        destinations: event.destinations.map((destination) => ({ destination, state: "queued" as const })),
        homeRegion: event.homeRegion,
        suburb: event.suburb,
        source: event.source,
        raisedAt: event.now,
        // Absent for a community expect, which is a real state and not a missing value.
        triagedAt: event.triagedAt,
        urgency: event.urgency,
        originSiteCode: event.originSiteCode,
        transportNeeded: event.transportNeeded,
      };
      return { ...state, referrals: [...state.referrals, created], frontDoorReferralSequence: sequence };
    }

    case "ACCEPT_REFERRAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      /*
       * ⚠️ THE ROLE MUST MATCH THE DESTINATION IT IS ANSWERING — the narrowing half of `FD-3`.
       *
       * `FD-3` was superseded by the owner ("every referral is declinable, and NO CODE PATH MAY
       * RENDER A REFERRAL WITH NO DECLINE AFFORDANCE"), so `ed` joined this event's permitted roles
       * — the ED hub acts as `ed`, and without it an emergency department could not answer a
       * referral addressed to it. Before that, the available workaround was to dispatch as `ward`
       * or `coordinator`, which compiles, works, and writes a FALSE `decidedBy`: the record would
       * say a ward refused a patient an emergency department refused. That is the exact defect
       * `decidedBy` exists to prevent, and nothing would have failed.
       *
       * ⚠️ **But the widening alone is too wide.** With `ed` merely added, an emergency department
       * could accept or refuse a PSYCHIATRIC WARD destination — deciding on a bed in a ward it has
       * nothing to do with — and the resulting record reads as a legitimate refusal. The same hole
       * already existed for `ward`, which could answer an emergency department's destination.
       *
       * So a role answers its own kind and nothing else. The coordinator is exempt because it is
       * the only role that sees the whole picture (`CO-D2`), which is the same reason it may cancel
       * a transport it did not book. `community_team` has no acting role yet; when one arrives it
       * joins this map rather than widening the lists.
       *
       * ⚠️ **THE MAP USED TO BE `Partial`, WHICH MADE THE COORDINATOR'S EXEMPTION INDISTINGUISHABLE
       * FROM A ROLE NOBODY HAD DECIDED ABOUT.** `answerableBy[event.role]` came back `undefined` for
       * any role absent from the map — true of the coordinator's deliberate `CO-D2` exemption, but
       * EQUALLY true of any role added to `WardFlowRole` in future and simply never added here.
       * Nothing would fail; the new role would pass this guard for every destination kind,
       * unnoticed. `answerableBy` is now a TOTAL record over `WardFlowRole` — no `Partial` — with
       * each entry spelled `ReferralDestinationKind | "any"`. A role missing an entry is now a
       * compiler error naming this map, not a silent bypass.
       *
       * `coordinator: "any"` IS `CO-D2` — written down now, rather than implied by absence.
       * `officer`, `demo` and `community` are also `"any"` here, not because any of the three may
       * decide a referral, but because none of them can reach this line at all: `EVENT_ROLE`
       * (checked first, before this switch, at the top of this reducer) permits only `ward`,
       * `coordinator` and `ed` to raise `ACCEPT_REFERRAL`/`DECLINE_REFERRAL`. Their entries exist
       * only so the record type-checks as total — they reproduce the OLD `Partial` map's behaviour
       * at this exact line (absent from the map → unconditional pass) rather than asserting that any
       * of the three owns a destination. Widening `EVENT_ROLE` to let one of them reach this code is
       * a separate, deliberate decision — the same kind of decision that added `ed`, above — and
       * does not follow from this entry existing.
       */
      const answerableBy: Record<WardFlowRole, ReferralDestinationKind | "any"> = {
        ward: "psychiatric_ward",
        ed: "emergency_department",
        coordinator: "any",
        officer: "any",
        demo: "any",
        community: "any",
      };
      const ownKind = answerableBy[event.role];
      if (ownKind !== "any" && ownKind !== event.destinationKind) {
        return reject(
          state,
          event,
          `${event.type} was raised by role ${event.role}, which may only answer ${ownKind.replace(/_/g, " ")} destinations, not ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      const addressing = referral.destinations.find(
        (candidate) => candidate.destination.kind === event.destinationKind,
      );
      if (!addressing) {
        return reject(
          state,
          event,
          `referral ${referral.id} was not addressed to ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      // FD-22: the first acceptance ends the placement. A second destination accepting afterwards
      // would mean two places believing they had taken the same person -- the exact outcome the
      // automatic cancellation exists to prevent, so it is refused rather than recorded.
      if (referralState(referral) === "accepted") {
        return reject(state, event, `referral ${referral.id} has already been accepted elsewhere`);
      }
      // Per-destination, not per-referral: another destination having declined leaves this one
      // free to answer (FD-24). Only THIS destination being already decided is a refusal.
      if (addressing.state !== "queued") {
        return reject(
          state,
          event,
          `${event.destinationKind.replace(/_/g, " ")} has already answered referral ${referral.id} (${addressing.state})`,
        );
      }

      let accepted: ReferralAddressing;
      if (addressing.destination.kind === "psychiatric_ward") {
        // Only a ward acceptance names a unit, and only a ward acceptance runs the bed gates.
        if (!event.unitId) {
          return reject(state, event, `ACCEPT_REFERRAL into a psychiatric ward must name a unit`);
        }
        const unit = findUnit(state, event.unitId);
        if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
        // The failing gate is named in the rejection, not just "ineligible" -- `referralEligibility`
        // (ward-eligibility.ts) already produces a human-readable detail per gate; reusing it here
        // is what keeps this refusal and the match view's own "why not here?" reading identically.
        const acceptRefusal = referralAcceptanceRefusal(event, referral, addressing.destination, unit, event.now);
        if (acceptRefusal.refusal) return reject(state, event, acceptRefusal.refusal);
        accepted = {
          ...addressing,
          state: "accepted",
          acceptedUnitId: unit.id,
          decidedAt: event.now,
          decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
          // Written unconditionally, not only in the override branch: `...addressing` above could
          // otherwise carry a reason forward from an earlier state onto a clean acceptance, which
          // would read afterwards as a rule bent that nobody bent.
          acceptOverrideReason: acceptRefusal.overrideApplied ? event.overrideReason : undefined,
        };
      } else {
        // An ED, a medical ward and a community team are answered by a person or a team. There is
        // no bed to gate on and no unit to name, so a `unitId` sent with one of these would be a
        // caller's mistake rather than a detail to ignore.
        if (event.unitId) {
          return reject(
            state,
            event,
            `${event.destinationKind.replace(/_/g, " ")} is answered by a team, not a bed — it cannot name a unit`,
          );
        }
        accepted = {
          ...addressing,
          state: "accepted",
          decidedAt: event.now,
          decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
        };
      }

      // FD-22, and the reason it is here rather than on a screen: the first acceptance cancels
      // every destination still waiting, automatically, with no coordination step. A DECLINED
      // destination is left exactly as it was -- its refusal, its time and its reason stay on the
      // record, which is the surviving half of the decision FD-24 retired.
      /*
       * ⚠️ **BEFORE YOU CHANGE WHAT THIS CANCELS, READ THIS. THREE CHANGES COMBINE TO HIDE A
       * PATIENT, AND NONE OF THE THREE POINTS AT THE OTHER TWO.** Established 2026-09-01 by Ward
       * Builder Two and Ward Verifier and re-verified against both trees by Ward Lead; recorded
       * HERE because this is the only one of the three sites a person editing the cancellation
       * will certainly open.
       *
       *   A. **The symmetry change** — an acceptance of a LEAVING destination cancels nothing,
       *      the mirror of the community carve-out immediately below. Not made; parked on the
       *      owner as question 7.
       *   B. **Wiring `coordinatorWorksReferral` to a real screen.** `coordinatorWorklistReferrals`
       *      (ward-referral-visibility.ts) is defined and used by NOTHING — measured, with a
       *      known-positive control, at `124376628`. It will be wired later for reasons that have
       *      nothing to do with this block.
       *   C. **Branch 2 answering from a lone accepted arm**, ignoring anything still queued
       *      beside it. Fixed on `claude/ward-builder-two` (`1b86cee6e`); NOT yet on this line.
       *
       * **Any two are harmless. All three hide a patient**: a person physically in an emergency
       * department, still awaiting a psychiatric decision, drops off the coordinator's work list
       * because a community team accepted their discharge follow-up — and no record says anybody
       * refused them, because nobody did.
       *
       * ⚠️ **THE TRAP IS THAT A IS THE SAFE-LOOKING ONE.** A stops something being cancelled. It
       * reads as strictly protective and, on its own today, it is. It turns harmful only in
       * combination with a wiring step somebody does months later for unrelated reasons. **So the
       * rule is not an order of work — it is: A and B must not both be on this line while C is.**
       * Folding `claude/ward-builder-two` satisfies it permanently and is the simplest route.
       *
       * ⚠️ **AND A IS NOT A ONE-LINE CHANGE. IT TURNS A PRIVACY TEST RED IN A FILE THIS HANDLER
       * DOES NOT OWN, AND THE RED WILL NOT LOOK LIKE YOUR CHANGE.** Established 2026-09-01 by Ward
       * Builder Two and Ward Verifier, each refuting the other's first answer, and re-verified here.
       *
       * `multiDestinationReferral()` in `tests/ward-referral-visibility.test.ts` gets its
       * `"cancelled"` marker from a coordinator accepting the community arm, which cancels the
       * queued emergency-department arm. **After A, a leaving acceptance cancels nothing, the marker
       * vanishes, and the positive control that proves the FD-23 privacy sweep is non-vacuous goes
       * red.** It will present as the privacy sweep breaking. Nothing in that file points here.
       *
       * ⚠️ **DO NOT RESHAPE THAT FIXTURE, AND DO NOT REMOVE `"cancelled"` FROM THE MARKER LIST.**
       * The file already names the second move as forbidden — it is making a red test green by
       * weakening a privacy sweep — and it is exactly the move the red invites. The first move has
       * been worked through and provably does not exist. `ELSEWHERE_MARKERS` requires BOTH
       * `"cancelled"` and `"Flow coordinator"`, so the coordinator must decide something AND an
       * arriving acceptance must cancel a queued sibling; with the ward declined (which that fixture
       * must keep, because the ward saying no while somebody else says yes IS the privacy case it
       * exists for), every arrangement fails:
       *
       *   coordinator accepts community  → post-A, cancels nothing
       *   coordinator accepts ED         → only remaining sibling is community, which is protected
       *   ward accepts                   → cancels the ED arm, but `decidedBy` is
       *                                    `WARD_FLOW_ROLE_LABELS[event.role]`, so it writes
       *                                    "Ward manager" and "Flow coordinator" disappears instead
       *   a fourth destination           → refused by `PARALLEL_REFERRAL_CAP` (3)
       *   a second emergency department  → breaks the field-set allowlists (an ED arm carries
       *                                    `edId` and `purpose`, a community arm carries `teamName`)
       *
       * **The fault is one level above the fixture and A merely reveals it: one marker set is doing
       * two jobs.** `"cancelled"` belongs to its own small fixture; this one belongs to the privacy
       * sweep. **The repair is to split them, and it lives in that test file, not here.** Reshaping
       * that fixture is what built the trap — it has already been reshaped twice today, both times
       * by the two halves of the same owner ruling.
       *
       * ⚠️ **AND NOTHING TESTS THIS BLOCK'S CENTRAL BEHAVIOUR.** Every existing test drives a WARD
       * acceptance; none drives a community one, so whether a community acceptance cancels the
       * queued arriving arms is pinned by nothing at all (Ward Verifier, 2026-09-01). The test is
       * deliberately unwritten rather than forgotten: **written today it must assert the
       * cancellation, and after A it must assert the opposite.** Write it with A, not before it.
       */
      const destinations = referral.destinations.map((candidate) => {
        if (candidate === addressing) return accepted;
        if (candidate.state !== "queued") return candidate;
        /*
         * ⚠️ **A COMMUNITY TEAM IS NEVER CANCELLED BY SOMEBODY ELSE'S ACCEPTANCE.** Owner ruling,
         * 2026-09-01, and his definition is the reason rather than the rule: *"Community referral
         * means a patient is about to be discharged"*.
         *
         * **A community referral does not COMPETE with a bed — it means the patient is on their way
         * OUT.** So cancelling it because a ward said yes was the app cancelling DISCHARGE PLANNING at
         * the exact moment admission was confirmed. FD-22 is about destinations racing for the same
         * placement; a follow-up team is not in that race.
         *
         * ⚠️ **THIS DEFECT DISPLAYED NOWHERE, WHICH IS THE FRAGILE KIND OF CORRECT.**
         * `admissionBelongsToTeam` reads a destination's kind and team name and never its state —
         * deliberately, because a cancelled referral still named that team. So nothing showed it, and
         * anyone later "tightening" the hub to respect state would have made it live and people would
         * have vanished from team pages. Fixing it here removes the trap at source.
         */
        if (candidate.destination.kind === "community_team") return candidate;
        return { ...candidate, state: "cancelled" as const, decidedAt: event.now };
      });
      // Spec D14: acceptance decides only that the network takes this referral -- it creates NO
      // `Movement`. Wiring an accepted referral into one needs an `originEdId`, a legal status
      // and a stage machine, every one of which is entangled with Phase 8's geography work; that
      // seam is deliberate, not an oversight, and `tests/ward-referral-reducer.test.ts` asserts
      // it explicitly so a future change has to argue with a test rather than slip past.
      return replaceReferral(state, referral.id, { ...referral, destinations });
    }

    case "DECLINE_REFERRAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      /*
       * ⚠️ THE ROLE MUST MATCH THE DESTINATION IT IS ANSWERING — the narrowing half of `FD-3`.
       *
       * `FD-3` was superseded by the owner ("every referral is declinable, and NO CODE PATH MAY
       * RENDER A REFERRAL WITH NO DECLINE AFFORDANCE"), so `ed` joined this event's permitted roles
       * — the ED hub acts as `ed`, and without it an emergency department could not answer a
       * referral addressed to it. Before that, the available workaround was to dispatch as `ward`
       * or `coordinator`, which compiles, works, and writes a FALSE `decidedBy`: the record would
       * say a ward refused a patient an emergency department refused. That is the exact defect
       * `decidedBy` exists to prevent, and nothing would have failed.
       *
       * ⚠️ **But the widening alone is too wide.** With `ed` merely added, an emergency department
       * could accept or refuse a PSYCHIATRIC WARD destination — deciding on a bed in a ward it has
       * nothing to do with — and the resulting record reads as a legitimate refusal. The same hole
       * already existed for `ward`, which could answer an emergency department's destination.
       *
       * So a role answers its own kind and nothing else. The coordinator is exempt because it is
       * the only role that sees the whole picture (`CO-D2`), which is the same reason it may cancel
       * a transport it did not book. `community_team` has no acting role yet; when one arrives it
       * joins this map rather than widening the lists.
       *
       * ⚠️ **THE MAP USED TO BE `Partial`, WHICH MADE THE COORDINATOR'S EXEMPTION INDISTINGUISHABLE
       * FROM A ROLE NOBODY HAD DECIDED ABOUT.** `answerableBy[event.role]` came back `undefined` for
       * any role absent from the map — true of the coordinator's deliberate `CO-D2` exemption, but
       * EQUALLY true of any role added to `WardFlowRole` in future and simply never added here.
       * Nothing would fail; the new role would pass this guard for every destination kind,
       * unnoticed. `answerableBy` is now a TOTAL record over `WardFlowRole` — no `Partial` — with
       * each entry spelled `ReferralDestinationKind | "any"`. A role missing an entry is now a
       * compiler error naming this map, not a silent bypass.
       *
       * `coordinator: "any"` IS `CO-D2` — written down now, rather than implied by absence.
       * `officer`, `demo` and `community` are also `"any"` here, not because any of the three may
       * decide a referral, but because none of them can reach this line at all: `EVENT_ROLE`
       * (checked first, before this switch, at the top of this reducer) permits only `ward`,
       * `coordinator` and `ed` to raise `ACCEPT_REFERRAL`/`DECLINE_REFERRAL`. Their entries exist
       * only so the record type-checks as total — they reproduce the OLD `Partial` map's behaviour
       * at this exact line (absent from the map → unconditional pass) rather than asserting that any
       * of the three owns a destination. Widening `EVENT_ROLE` to let one of them reach this code is
       * a separate, deliberate decision — the same kind of decision that added `ed`, above — and
       * does not follow from this entry existing.
       */
      const answerableBy: Record<WardFlowRole, ReferralDestinationKind | "any"> = {
        ward: "psychiatric_ward",
        ed: "emergency_department",
        coordinator: "any",
        officer: "any",
        demo: "any",
        community: "any",
      };
      const ownKind = answerableBy[event.role];
      if (ownKind !== "any" && ownKind !== event.destinationKind) {
        return reject(
          state,
          event,
          `${event.type} was raised by role ${event.role}, which may only answer ${ownKind.replace(/_/g, " ")} destinations, not ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      const addressing = referral.destinations.find(
        (candidate) => candidate.destination.kind === event.destinationKind,
      );
      if (!addressing) {
        return reject(
          state,
          event,
          `referral ${referral.id} was not addressed to ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      if (referralState(referral) === "accepted") {
        return reject(state, event, `referral ${referral.id} has already been accepted elsewhere`);
      }
      if (addressing.state !== "queued") {
        return reject(
          state,
          event,
          `${event.destinationKind.replace(/_/g, " ")} has already answered referral ${referral.id} (${addressing.state})`,
        );
      }
      // Membership check, not truthiness -- same discipline as FLAG_BED_RELEASE's own comment on
      // this exact shape of check above. Phase 5 shipped a truthiness test in this position
      // (`!event.blocker`, which refuses a missing/empty value but accepts any other non-empty
      // string) and review caught it; "chosen from a fixed list, never typed" is a runtime rule.
      if (!REFERRAL_DECLINE_REASONS.includes(event.reason)) {
        return reject(state, event, `DECLINE_REFERRAL reason must be chosen from REFERRAL_DECLINE_REASONS`);
      }
      // FD-24: this destination declines and NOTHING ELSE CHANGES. The other destinations stay
      // queued, this ward is not locked out of anything later, and the refusal stays on the record
      // with its time and its reason.
      const destinations = referral.destinations.map((candidate) =>
        candidate === addressing
          ? {
              ...candidate,
              state: "declined" as const,
              declineReason: event.reason,
              decidedAt: event.now,
              decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
            }
          : candidate,
      );
      return replaceReferral(state, referral.id, { ...referral, destinations });
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
      if (referralState(referral) !== "queued") {
        return reject(state, event, `referral ${referral.id} was already decided (${referralState(referral)})`);
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
      // and `pullExpiresAt` are all untouched.
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

    case "RELEASE_PULL": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot release a pull for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "pulled") {
        return reject(state, event, `cannot release a pull while the movement is ${movement.stage}`);
      }
      // Same claim-not-proof discipline as CONFIRM_CAPACITY: this compares what the caller SAID
      // it was acting as against the unit actually holding the bed, and refuses when they differ.
      // Unused for a coordinator caller, who may act on behalf of any unit.
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_PULL was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is pulled at ${movement.acceptedUnitId}`,
        );
      }
      if (!movement.acceptedUnitId) {
        return reject(state, event, `movement ${movement.id} has no accepted unit holding a bed`);
      }
      const unit = findUnit(state, movement.acceptedUnitId);
      if (!unit) return reject(state, event, `no unit found for id ${movement.acceptedUnitId}`);

      // The EXACT inverse of PULL_PATIENT's own writes (ruling P4-1) — every field PULL_PATIENT sets,
      // undone, and nothing else touched. PULL_PATIENT writes four fields: `unit.allocatable.value`
      // (-1), `unit.allocatable.confirmedAt` (event.now), `movement.stage` ("pulled") and
      // `movement.pullExpiresAt` (event.now + 60). It does NOT touch `Unit.held` — that field is
      // seed-only data; the live held count on every screen is `unitCapacity()`'s own derivation
      // from `empty` and `allocatable`, so giving back the bed by raising `allocatable.value` is
      // the whole correction, on both fields PULL_PATIENT actually wrote to the unit.
      const releasedUnit: Unit = {
        ...unit,
        allocatable: { ...unit.allocatable, value: unit.allocatable.value + 1, confirmedAt: event.now },
      };
      // Never closes the movement, never clears `legalForm`, never touches `referredUnitIds` —
      // the patient survives and keeps their acceptance; only the pull itself unwinds.
      const updatedMovement: Movement = {
        ...movement,
        stage: "accepted_awaiting_bed",
        pullExpiresAt: undefined,
        // The record the pull created is being deleted below, so the join to it goes with it. A
        // surviving id pointing at a deleted admission is the dangling reference this whole fix is
        // about.
        admissionId: undefined,
        unwinds: [...movement.unwinds, { at: event.now, kind: "pull_released", by: event.role, reason: event.reason }],
      };
      const withUnit = replaceUnit(state, unit.id, releasedUnit);
      /*
       * ⚠️ **AND THE PERSON THE PULL PUT IN THE BED GOES WITH IT.** Until 2026-09-01 this handler
       * gave the bed back to the unit and left the admission standing, so a cancelled pull left a
       * PHANTOM OCCUPANT: the ward board drew somebody in a bed nobody had pulled, `bedIsOccupied`
       * counted them, and the movement they belonged to was back at `accepted_awaiting_bed` waiting
       * for a bed the board said was full.
       *
       * ⚠️ **DELETED, NOT ENDED — and that is the one place this differs from `RECORD_LEAVING`.** A
       * departure is a thing that HAPPENED to a person who was really there, so it ends the record
       * (`state: "departed"`) and keeps it. A released pull is the assertion being RETRACTED: nobody
       * was ever in this bed, so leaving a `departed` record behind would put a discharge in the
       * ward's history for an admission that never occurred, and every discharge count would rise.
       *
       * The comment above still holds — this is the exact inverse of `PULL_PATIENT`'s own writes,
       * and `PULL_PATIENT` now writes an admission, so undoing it is part of the inverse rather than
       * an addition to it. `admissionSequence` is deliberately NOT rewound: it is a monotonic id
       * source, and reusing an id a released pull already spent would give two different people the
       * same admission id in one session.
       */
      const withoutPhantom: WardFlowState =
        movement.admissionId === undefined
          ? withUnit
          : {
              ...withUnit,
              admissions: withUnit.admissions.filter((candidate) => candidate.id !== movement.admissionId),
            };
      return replaceMovement(withoutPhantom, movement.id, updatedMovement);
    }

    case "BOOK_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot book transport for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "pulled") {
        return reject(state, event, `cannot book transport while the movement is ${movement.stage}`);
      }
      // A second booking would replace a job a provider may already have accepted, and the
      // acceptance timestamps would vanish with it. Cancel first (`CANCEL_TRANSPORT`), then rebook.
      if (movement.transport) {
        return reject(state, event, `transport for movement ${movement.id} is already booked`);
      }
      if (!TRANSPORT_PROVIDERS.includes(event.provider)) {
        return reject(state, event, `BOOK_TRANSPORT provider must be chosen from TRANSPORT_PROVIDERS`);
      }
      // ⚠️ A MISSING ESCORT ANSWER IS REFUSED RATHER THAN DEFAULTED, and that is the whole event.
      // The control opens blank; storing `false` for a question nobody answered would put "no
      // escort required" on screen as though a clinician had said so, which is exactly the defect
      // `HANDOVER_READY`'s derivation commits and the reason `TR-D1` puts booking on the team that
      // knows. `typeof` because the payload reaches this from JavaScript, where the field can be
      // absent whatever the type says.
      if (typeof event.escortRequired !== "boolean") {
        return reject(state, event, `BOOK_TRANSPORT escortRequired must be answered, and it has no default`);
      }
      const booked: Movement = {
        ...movement,
        transport: {
          id: `${movement.id}-transport`,
          provider: event.provider,
          escortRequired: event.escortRequired,
        },
        // A job now exists and the provider has not answered it. Deliberately says only that: which
        // provider, and whether an escort was asked for, are already on the job itself and
        // `transportStatusLabel` renders them — restating them here would be two sentences for one
        // fact, the drift this codebase produces most reliably.
        blocker: STAGE_TRANSITION_BLOCKERS.transportBooked,
      };
      return replaceMovement(state, movement.id, booked);
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
      /*
       * ⚠️ THIS CHECK USED TO BE TR-D6 INVERTED, AND IT READ AS OBVIOUSLY CORRECT.
       *
       * It was: `if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId)
       * reject` — permitting a ward caller ONLY when it was the accepted unit. That is, only the
       * RECEIVING ward: the one party the owner's ruling excludes by name. Every other ward was
       * refused. It carried a careful comment about claim-not-proof discipline while doing exactly
       * the wrong thing, because "a ward may act on its own patient" is such a natural sentence
       * that it survives review.
       *
       * TR-D6 (owner, 2026-08-30): a transport may be cancelled by the team that BOOKED it and by
       * the coordinator. The receiving ward may not — it did not book the job, and a booking
       * cancelled by the destination is indistinguishable on the sending board from one that
       * failed, so the sending team cannot tell "they changed their mind" from "it never went
       * through". They re-book, or they wait for a vehicle nobody is sending.
       *
       * `ward` is now absent from `EVENT_ROLE.CANCEL_TRANSPORT`, so the role gate above refuses it
       * before this point is reached and no unit comparison is needed at all. `actingUnitId`
       * remains on the event for the other callers that carry it.
       */
      if (!CANCEL_TRANSPORT_REASONS.includes(event.reason)) {
        /*
         * Runtime membership, not merely the type. `reason` is declared required on the event, but
         * a type-only guarantee passes `vitest run` with no `tsc` involved — and a caller omitting
         * it was accepted, writing `reason: undefined` into the unwind record. TR-D6 says this must
         * not be weakened to optional; an unenforced requirement already is.
         */
        return reject(state, event, `CANCEL_TRANSPORT reason must be chosen from CANCEL_TRANSPORT_REASONS`);
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
