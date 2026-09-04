import type { LeavingDestination } from "@/components/ward-management/ward-admissions";
import type { PatientId } from "@/components/ward-management/ward-patients";
import type { Instant } from "@/components/ward-management/ward-clock";
import type {
  BedPreparationNote,
  BedReleaseBlocker,
  OverrideReason,
  CancelTransportReason,
  LegalStatusChangeReason,
  ReleasePullReason,
  UrgencyChangeReason,
} from "@/components/ward-management/ward-change-reasons";
import type {
  BedReleaseWaitingOn,
  Cohort,
  DeclineReason,
  HomeRegion,
  LegalStatus,
  MovementStage,
  ReferralDeclineReason,
  ReferralDestination,
  ReferralDestinationKind,
  ReferralSource,
  ReferralSuburb,
  Security,
  Sex,
  StepBackReason,
  TransportProvider,
} from "@/components/ward-management/ward-model";
import type { WardScenario } from "@/components/ward-management/ward-scenarios";

/**
 * Who may raise an event. `demo` is the jump-forward / reset control on the coordinator screen —
 * it belongs to nobody's clinical role, which is exactly why it needs its own gate rather than
 * being nodded through as "coordinator". `community` is Task 3 (Phase 7, "The front door"): one
 * role covering all five `ReferralSource`s (community, crisis_service, police, ambulance,
 * inter_hospital) — the source itself is recorded on the `Referral`, so five separate roles would
 * be five things to maintain before anything is known to actually need them apart.
 */
export type WardFlowRole = "coordinator" | "ed" | "ward" | "officer" | "demo" | "community";

/**
 * The ROLE a decision is recorded against — never a person, and never a name.
 *
 * Exists because `ACCEPT_REFERRAL` and `DECLINE_REFERRAL` were coordinator-only until FD-25
 * widened them to `["ward", "coordinator"]`, while the reducer wrote `decidedBy: "Flow
 * coordinator"` as a literal. A ward accepting would have been recorded as the coordinator having
 * decided — a false entry in the one field that says who answered, and precisely the fact the
 * override register (FD-27) exists to make accountable.
 *
 * Exhaustive over `WardFlowRole` on purpose: a new role cannot be added without deciding what a
 * decision by it is called, rather than silently inheriting somebody else's label.
 *
 * Distinct from `roleLabels` in `ward-derivations.ts`, which maps the three-value UI `WardRole`
 * ("flow" | "ed" | "ward"). The two vocabularies are not the same and must not be conflated —
 * `WardRole` has no `coordinator`, and this has no `flow`.
 */
export const WARD_FLOW_ROLE_LABELS: Record<WardFlowRole, string> = {
  coordinator: "Flow coordinator",
  ed: "ED mental health",
  ward: "Ward manager",
  officer: "Authorised officer",
  demo: "Demonstration control",
  community: "Community service",
};

/** The short form an ED fills in to raise a brand-new referral. */
export type ReferralDraft = {
  cohort: Cohort;
  security: Security;
  sex: Sex;
  specialling: boolean;
  legalStatus: LegalStatus;
  urgency: 1 | 2 | 3;
  /**
   * The legal form the clinician selected, as a code from `SELECTABLE_LEGAL_FORMS`, or `null`
   * for no form at all. Explicitly nullable rather than optional or an empty string so that
   * "this patient is on no form" is a first-class choice the clinician made, indistinguishable
   * from neither a field the caller forgot to fill in nor a blank that could be read as a
   * default. Nothing derives this from `legalStatus` any more (product owner, 2026-08-24).
   */
  legalFormCode: string | null;
};

/**
 * One variant per row of spec §6. Every event carries `role` (checked against `EVENT_ROLE`
 * before anything else happens) and `now` (the reducer never reads a clock itself).
 */
export type WardFlowEvent =
  | {
      type: "RAISE_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      edId: string;
      draft: ReferralDraft;
      /**
       * THE FRONT-DOOR REFERRAL THIS JOURNEY IS BEING RAISED FROM, when there is one.
       *
       * Owner ruling 8, 2026-09-01: a community team refers a patient TO an emergency department,
       * the patient attends it, and the department then raises the journey. Those are two records
       * and this is the link between them — see `Movement.referralId`.
       *
       * ⚠️ **OPTIONAL BECAUSE MOST JOURNEYS HAVE NO REFERRAL**, not because it may be skipped when
       * one exists. A person who walked in was referred by nobody, and omitting this says exactly
       * that. When it IS present the reducer RESOLVES it — an id naming no referral, or a referral
       * that was never addressed to `edId`, is refused with a visible `Rejection` rather than
       * stored. A stored id that joins to nothing is the `Admission.referralId` defect
       * (`docs/ward-flow/fields-with-no-producer-2026-09-01.md`), and refusing here is what keeps
       * this field out of that class.
       */
      referralId?: string;
    }
  | {
      type: "RECORD_EXAMINATION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      outcome: "inpatient_order" | "community_order" | "revoked";
    }
  | {
      /**
       * The emergency department records whether this patient's medical workup is done.
       * `cleared` is the clinician's stated answer; the ABSENCE of `Referral.medicalClearance`
       * means nobody has assessed it, and no event ever writes that absence back.
       */
      type: "RECORD_MEDICAL_CLEARANCE";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      cleared: boolean;
    }
  | {
      /**
       * The sending team records whether this patient needs transport at all — owner ruling
       * R-2026-09-04-C, the third state.
       *
       * `needed: false` is a stated answer ("this patient needs no transport"), NOT the same thing
       * as `Movement.transportNeed` being absent, which means nobody has said. No event ever
       * writes the absence back, exactly as no event un-records a medical clearance.
       */
      type: "RECORD_TRANSPORT_NEED";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      needed: boolean;
    }
  | {
      /**
       * The department holding the patient records that NOBODY referred them — owner ruling
       * R-2026-09-04-D, the clinical one of the three causes an absent `Movement.referralId` had.
       *
       * ⚠️ **THIS IS THE ASSERTION, NOT THE ABSENCE.** Before it, "nobody raised a referral for
       * this person" and "this record predates the link" and "the raiser was never asked" were one
       * indistinguishable empty field. Refused for a movement that already names a referral: the
       * two answers contradict each other, and a stored contradiction is worse than a refusal.
       */
      type: "RECORD_NO_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      type: "REFER_TO_UNITS";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitIds: string[];
      /**
       * Present when the coordinator is referring DESPITE a failing gate — an override.
       *
       * Optional because most referrals are not overrides, and absent means exactly that: no
       * override happened and none is recorded. When present the reducer keeps it on the movement
       * (`Movement.overrides`), which is the whole of owner decision OD-3: the reason used to be
       * collected in a textarea, held in the screen's own state and discarded on the next
       * selection, while the governance page said override reasons were recorded.
       *
       * From `OVERRIDE_REASONS`, never free text, and never an "other, please specify" (WB-DB-16).
       */
      overrideReason?: OverrideReason;
    }
  /**
   * ⚠️ `overrideReason` is on all three placement events, not just `REFER_TO_UNITS`, because of the
   * owner's ruling of 2026-09-02: *"the engine should refuse, screen checks are not enough"*, then
   * *"refuse unless a reason is recorded"*. Before that ruling these two events could not EXPRESS an
   * override at all, so the ruling was unimplementable for them until the field existed.
   *
   * **An ineligible placement is made ACCOUNTABLE, never impossible.** A coordinator at three in the
   * morning with a patient who must go somewhere is a real situation, and an override that is
   * refused becomes a phone call — the placement then happens outside the system, where nothing is
   * recorded at all. **A rule that cannot be overridden does not stop the placement; it stops the
   * RECORD of the placement.**
   */
  | {
      type: "ACCEPT_IN_PRINCIPLE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      overrideReason?: OverrideReason;
    }
  | {
      type: "PULL_PATIENT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      overrideReason?: OverrideReason;
    }
  | {
      type: "DECLINE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      /** From `DECLINE_REASONS`, and nothing beside it — see `Decline`'s own doc comment (PD-6). */
      reason: DeclineReason;
    }
  | {
      type: "HANDOVER_READY";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /**
       * ⚠️ **NOTHING WRITES THIS AND NOTHING READS IT.** Who collects the patient is chosen on the
       * booking control (`ed/ed-screen.tsx`) and stored by `BOOK_TRANSPORT`, the only event that
       * creates a `TransportJob`. `HANDOVER_READY` requires that job to exist already and does
       * nothing but move the movement to `handover_ready`; its reducer case never reads this field,
       * and the one dispatch site sets `type`, `role`, `now` and `movementId` only.
       *
       * Inert rather than misleading — nothing computes with it, so no screen can render a value
       * derived from it — but it is a field with no producer and no consumer either way. Recorded
       * in `docs/ward-flow/fields-with-no-producer-2026-09-01.md`.
       */
      provider?: TransportProvider;
    }
  | { type: "TRANSPORT_ACCEPTED"; role: WardFlowRole; now: Instant; movementId: string }
  | { type: "TRANSPORT_EN_ROUTE"; role: WardFlowRole; now: Instant; movementId: string }
  | { type: "PATIENT_COLLECTED"; role: WardFlowRole; now: Instant; movementId: string }
  | { type: "PATIENT_ARRIVED"; role: WardFlowRole; now: Instant; movementId: string }
  | {
      type: "CONFIRM_CAPACITY";
      role: WardFlowRole;
      now: Instant;
      /** The unit whose allocatable count is being restated. */
      unitId: string;
      /**
       * The unit the caller stated it was acting as. The ward screen is routed as
       * `/mockups/ward-flow/ward/[unitId]`, so a caller always has one to state; the reducer
       * refuses the event when this and `unitId` differ.
       *
       * This is a claim the caller makes about itself, recorded and compared. It is **not** an
       * authenticated identity and this model has none: nothing here verifies that the caller
       * really is that unit, and anything able to dispatch an event can state whichever acting
       * unit it likes. Required rather than optional so a caller cannot omit it and skip the
       * comparison silently.
       */
      actingUnitId: string;
      value: number;
    }
  | {
      type: "RECORD_ESCALATION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      triedUnitIds: string[];
      contact: string;
    }
  | { type: "ADVANCE_CLOCK"; role: WardFlowRole; now: Instant; minutes: number }
  | { type: "RESET_SCENARIO"; role: WardFlowRole; now: Instant }
  | { type: "SET_SCENARIO"; role: WardFlowRole; now: Instant; scenario: WardScenario }
  /**
   * ADD A PATIENT. The owner's flow: search for somebody, and if nobody comes up, add them.
   *
   * The person being added has never been referred, never moved and never arrived - which is the
   * whole reason this event exists rather than a patient falling out of one of those. A record
   * created by arrival is correct on every screen showing admitted people and absent at exactly the
   * moment the flow describes.
   *
   * Carries identity because identity lives on `Patient` and nowhere else, by owner ruling PD-1
   * (2026-08-30). It does not carry a referral, a movement or a unit: a patient exists before any of
   * them and outlives all of them.
   */
  | {
      type: "ADD_PATIENT";
      role: WardFlowRole;
      now: Instant;
      umrn: string;
      givenName: string;
      familyName: string;
      dateOfBirth: string;
    }
  | {
      type: "CHANGE_URGENCY";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      urgency: 1 | 2 | 3;
      reason: UrgencyChangeReason;
    }
  | {
      /**
       * THE URGENT FLAG GOES ON. The mechanism the owner asked for on 2026-08-30 and that nobody
       * could reach until 2026-09-01.
       *
       * His words: *"A long wait always is prioritised… however… in certain cases patients can be
       * marked as urgent for many reasons which outranks everything."* `Movement.flaggedUrgent` was
       * added, `queueOrder` (ward-priority.ts) puts it ABOVE all three urgency tiers, and the
       * coordinator queue renders a "Flagged urgent" badge for it. But the only writer was the
       * literal `false` at creation, exactly one seeded movement carried `true`, and there was no
       * flagging event among the thirty-nine. **The feature was fully built and entirely
       * unreachable** — the ordering rule existed, the badge existed, and nobody could ever cause
       * either to happen.
       *
       * ⚠️ **NO REASON IS CARRIED, AND ONE MUST NOT BE ADDED HERE.** `Movement.flaggedUrgent`'s own
       * doc comment settles this: the owner said "for many reasons", plural and unenumerated, and
       * inventing a vocabulary for them would be putting words in his mouth on the one surface
       * where a wrong answer reaches a person. A reason field is part of the "later" he deferred.
       *
       * ⚠️ **NOTHING RECORDS WHO FLAGGED IT OR WHEN, EITHER.** The field is a bare boolean and this
       * event does not widen it. That is a real limit — a flag with no provenance cannot be
       * reviewed — and it is recorded rather than fixed, because adding `flaggedAt`/`flaggedBy` is
       * a model widening with an owner ruling in front of it, in the same category as the reason.
       */
      type: "FLAG_MOVEMENT_URGENT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /**
       * THE URGENT FLAG COMES OFF, AND THIS HALF IS NOT OPTIONAL.
       *
       * A flag nobody can remove is a permanent-state defect of exactly the kind this change set is
       * repairing elsewhere: it would sit above every tier for the rest of the demonstration, on a
       * patient whose situation had resolved, and the one seeded movement carrying `true` could
       * never be cleared at all.
       *
       * Same roles as flagging. Whoever may put a patient above every tier may take them back
       * down — a raising permission wider than the lowering one is how a queue fills with flags
       * nobody present is allowed to clear.
       */
      type: "CLEAR_MOVEMENT_URGENT_FLAG";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      type: "CHANGE_LEGAL_STATUS";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      legalStatus: LegalStatus;
      reason: LegalStatusChangeReason;
    }
  | {
      type: "RELEASE_PULL";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      reason: ReleasePullReason;
      /**
       * The unit the caller stated it was acting as. Required for a `ward` caller, unused for a
       * `coordinator` caller. This records the caller's CLAIM about itself and does not prove it:
       * nothing here authenticates anything, and this model has no identity model. The comparison
       * constrains future callers rather than this one.
       */
      actingUnitId?: string;
    }
  | {
      /**
       * The sending team books the transport out — `TR-D1` (OWNER, 2026-08-30). Once a receiving
       * ward accepts, the team currently holding the patient arranges the move.
       *
       * ⚠️ **HIS REASON IS THE DESIGN: the sending team knows the facts the booking needs** —
       * whether an escort is required, whether the patient is settled enough to travel. **The bed
       * coordinator was rejected by name**, because it owns the bed search and does not know the
       * patient's state. `TR-D5` generalises it beyond bed placement, which is why a ward books too
       * and not only an emergency department.
       */
      type: "BOOK_TRANSPORT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /** From `TRANSPORT_PROVIDERS`, membership-checked by the reducer. Never free text. */
      provider: TransportProvider;
      /**
       * ⚠️ **ANSWERED BY A PERSON, NEVER DERIVED, AND REQUIRED SO THERE IS NO VALUE TO OMIT.**
       * This event is the only writer of `TransportJob.escortRequired`, and nothing anywhere
       * derives it. Deriving it — from `movement.legalStatus`, or from anything else — would be a
       * clinical judgement made by nobody and shown on screen as though a clinician had made it,
       * and wrong in both directions: a voluntary patient can need an escort, and a detained one
       * settled enough to travel may not. The reducer refuses the event outright when the answer is
       * absent rather than storing `false`. The booking control opens BLANK (owner, relayed); a
       * pre-filled answer is the same defect moved into the UI where it looks like a default.
       */
      escortRequired: boolean;
    }
  | {
      type: "CANCEL_TRANSPORT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      reason: CancelTransportReason;
      /**
       * The unit the caller stated it was acting as. Required for a `ward` caller, unused for a
       * `coordinator` caller. This records the caller's CLAIM about itself and does not prove it:
       * nothing here authenticates anything, and this model has no identity model. The comparison
       * constrains future callers rather than this one.
       */
      actingUnitId?: string;
    }
  | {
      type: "FLAG_BED_RELEASE";
      role: WardFlowRole;
      now: Instant;
      /** The unit a bed is being flagged as coming free at. */
      unitId: string;
      /**
       * The unit the caller stated it was acting as, same claim-not-proof discipline as
       * `CONFIRM_CAPACITY`'s own field (see its doc comment). `FLAG_BED_RELEASE` is `ward`-only
       * (there is no coordinator caller to exempt), so this is always required and always
       * compared against `unitId`.
       */
      actingUnitId: string;
      /**
       * What this discharge is still waiting on, chosen from `BED_RELEASE_WAITING_ON`. Renamed
       * from `confidence` by the Q1 axis change of 2026-08-28: a ward states a FACT about what is
       * outstanding rather than estimating a probability two wards cannot mean the same thing by.
       * `"Nothing outstanding"` is the value for a prediction with no obstacle — it is a real
       * choice, not the absence of one, so the picker never has to be left blank.
       */
      waitingOn: BedReleaseWaitingOn;
      /**
       * The ward's own estimate of when this bed will actually be free — a fact about the BED,
       * the same category `expectedReturn` on `RECORD_LEAVE_BED` already sits in (binding spec
       * §4 forbids timing that could identify the departing PATIENT, not an operational estimate
       * about the bed itself). Collected on the ward screen's flag form exactly like
       * `expectedReturn` is, and carried through to `BedRelease.expectedAt` unchanged — see the
       * reducer's own comment on this case for why `confirmedAt` stays a separate field.
       */
      expectedAt: Instant;
      /**
       * Chosen from `BED_RELEASE_BLOCKERS`, never free text — an operational fact about the
       * BED, never about the departing patient (binding spec §4). Optional: a ward may report a
       * bed coming free that is ALREADY stuck.
       *
       * Bed-model rework (2026-08-28): supplying this no longer changes which STATE the release
       * is created in. Every `FLAG_BED_RELEASE` creates a `"expected"` release, and a blocker
       * sets the blocked FLAG on it. Before the rework a flagged blocker produced a release in
       * the fourth state `"blocked"`, which `capacityBreakdown` then counted nowhere at all.
       */
      blocker?: BedReleaseBlocker;
    }
  | {
      type: "CONFIRM_BED_RELEASE";
      role: WardFlowRole;
      now: Instant;
      /** The release moving from `expected` into `confirmed`. Any blocked flag it carries is
       *  deliberately KEPT — a discharge that is decided and stuck is exactly that, and losing
       *  the flag here would recreate the count defect this rework closed from the other side. */
      releaseId: string;
      /**
       * The unit the caller stated it was acting as, same claim-not-proof discipline as
       * `FLAG_BED_RELEASE`'s own field (see its doc comment). `CONFIRM_BED_RELEASE` is
       * `ward`-only, so this is always required and always compared against the release's own
       * `unitId`.
       */
      actingUnitId: string;
    }
  | {
      type: "REVERT_BED_RELEASE";
      role: WardFlowRole;
      now: Instant;
      /**
       * The release moving from `confirmed` back to `expected` — the reversal the four-stage
       * model forbade (bed-model rework, 2026-08-28). Forbidding it never stopped a decision
       * being reversed on a ward; it only made the ward record the reversal dishonestly, by
       * leaving a confirmed row standing that everybody knew was no longer true. Any blocked flag
       * survives the reversal untouched: reversing the decision does not unstick the bed.
       */
      releaseId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field. */
      actingUnitId: string;
      /**
       * A `"expected"` release carries a waiting-on value and a `"confirmed"` one does not, so
       * the reversal has to restate it — there is no earlier value to restore, and inventing one
       * would be the reducer asserting something the ward never said. Moved with the Q1 axis
       * change of 2026-08-28, exactly as the bed-model rework said it would.
       */
      waitingOn: BedReleaseWaitingOn;
    }
  | {
      type: "BLOCK_BED_RELEASE";
      role: WardFlowRole;
      now: Instant;
      /**
       * The release gaining the blocked FLAG. Bed-model rework (2026-08-28): this no longer
       * changes `state` at all — a blocked release stays `expected` or `confirmed`, and a
       * blocked-but-confirmed bed keeps counting as confirmed. `discharged` is refused: there is
       * nothing left to hold up once the bed is free.
       */
      releaseId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field. */
      actingUnitId: string;
      /**
       * Chosen from `BED_RELEASE_BLOCKERS`, never free text — required here (unlike
       * `FLAG_BED_RELEASE`'s optional field) because a `BLOCK_BED_RELEASE` with no blocker is a
       * contradiction in terms. A typed caller cannot omit this; the reducer still refuses a
       * missing or empty value at runtime rather than trusting the type alone.
       */
      blocker: BedReleaseBlocker;
    }
  | {
      type: "CLEAR_BED_RELEASE_BLOCK";
      role: WardFlowRole;
      now: Instant;
      /**
       * The release whose blocked flag is being lifted — the bed is unstuck, and its stage is
       * whatever it already was. A flag that can only ever be set is not a flag; before the
       * rework the only way out of `"blocked"` was a state change, which is precisely the
       * conflation being undone here.
       */
      releaseId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field. */
      actingUnitId: string;
    }
  | {
      type: "SET_BED_PREPARATION";
      role: WardFlowRole;
      now: Instant;
      /** The release whose bed is being made ready, or has finished being made ready. */
      releaseId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field. */
      actingUnitId: string;
      /**
       * Whether this bed is currently being made ready. **Purely informational** (Q4): nothing
       * in this codebase may read it to decide whether the bed can be offered, counted or
       * allocated — see `BED_PREPARATION_NOTES` for the owner's own reasoning.
       */
      preparing: boolean;
      /**
       * What the bed is waiting on to be ready, chosen from `BED_PREPARATION_NOTES` — the owner
       * supplied that list on 2026-08-28, so a caller may now name a note. Optional: "being made
       * ready, reason not stated" stays legal. Omitted or `undefined` stores `null`, and the
       * reducer forces `null` whenever `preparing` is false.
       */
      note?: BedPreparationNote;
    }
  | {
      type: "RELEASE_BED";
      role: WardFlowRole;
      now: Instant;
      /**
       * The release moving into `discharged` — terminal. Accepted from `confirmed` and from
       * `expected` alike: `discharged` is a statement of fact about a bed that is now empty, not a
       * promotion of a prediction into availability, and the four-stage model already allowed the
       * same journey through `blocked`. Narrowing it to `confirmed`-only during the rework would
       * have refused a path wards could already take.
       */
      releaseId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field. */
      actingUnitId: string;
    }
  | {
      type: "RECORD_LEAVE_BED";
      role: WardFlowRole;
      now: Instant;
      /** The unit whose bed is being reported as occupied by someone on approved leave. */
      unitId: string;
      /** Same claim-not-proof discipline as `FLAG_BED_RELEASE`'s own field, compared against `unitId`. */
      actingUnitId: string;
      /** The ward's statement that this bed can be filled while its occupant is away. */
      usable: boolean;
      expectedReturn: Instant;
    }
  | {
      type: "END_LEAVE_BED";
      role: WardFlowRole;
      now: Instant;
      /** The leave bed record ending — the occupant has returned or the leave has ended. */
      leaveBedId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field, compared against
       *  the found leave bed's own `unitId`. */
      actingUnitId: string;
    }
  | {
      type: "REQUEST_CAPACITY_REFRESH";
      role: WardFlowRole;
      now: Instant;
      /** The unit a coordinator is asking to restate its numbers. */
      unitId: string;
    }
  | {
      type: "RECEIVE_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      /**
       * ⚠️ WHICH PERSON, AS A POINTER. Owner ruling 2026-09-02: a referral may remember its
       * patient. OPTIONAL, because a referral raised outside the patient flow legitimately has
       * nobody on file, and a required field would force one to be invented.
       *
       * An id and nothing else — see `Referral.patientId` for why a name carried alongside it
       * would satisfy the privacy guard's letter and destroy its purpose.
       */
      patientId?: PatientId;
      /** The permitted facts about the person referred, unchanged from `Referral`'s own field set
       *  (`ward-model.ts`) — see that type's own doc comment for why nothing else may ever be
       *  added here. */
      ageBand: Cohort;
      /**
       * Where this referral is addressed, and the criteria that destination can answer. Carries
       * the ward arm's `sex`, `secureBedNeeded` and `involuntaryBedNeeded`, which sat flat on this
       * event until 2026-08-30.
       *
       * One to `PARALLEL_REFERRAL_CAP` of them, chosen in ONE act (FD-21). The reducer refuses an
       * empty list, more than the cap, and two of the same kind — asking one kind twice is asking
       * twice, not addressing two destinations.
       *
       * **The event carries the destinations because otherwise the union would be decorative.** If
       * this event could only express bed criteria, every referral it created would be a ward
       * referral by construction, and the three arms that carry no bed criteria would be
       * unreachable — a type distinction nothing could ever produce. Making the caller name the
       * destination is what puts the choice at the front door, where the referrer makes it.
       */
      destinations: ReferralDestination[];
      /** The broad area this person is from — one of `HOME_REGIONS`, never an address. See
       *  `Referral.homeRegion`'s own doc comment. */
      homeRegion: HomeRegion;
      /** The suburb, resolved against the catchment table by the reducer — never free text, and
       *  never an address. ⚠️ A UNION, not a string, so **"not known" is an answer rather than a
       *  failure to answer**: a patient of no fixed abode must be referable, and for the hour this
       *  was a bare `string` they were not. See `ReferralSuburb`'s own doc comment. */
      suburb: ReferralSuburb;
      /**
       * When this person was triaged into the department, when they were already in one — the
       * start of `P9-D2`'s second clock. Absent for a community expect who has not arrived.
       *
       * ⚠️ **THIS EXISTS BECAUSE THE FIELD HAD NO PRODUCER.** `Referral.triagedAt` landed with
       * nothing that could write it: `RECEIVE_REFERRAL` is the only event that creates a referral
       * and it had no such field, so a triage instant could reach the model only on a hand-authored
       * fixture. **The department clock's present branch was live code with no reachable caller** —
       * and a screen rendering "not in department yet" for every patient looks like correct
       * handling of a legitimate case rather than a feature with no data. Measured and reported by
       * Ward Referrals; third instance of that shape in one night.
       */
      triagedAt?: Instant;
      /** Where the referral arrived from — one of `REFERRAL_SOURCES`. */
      source: ReferralSource;
      urgency: 1 | 2 | 3;
      /** A synthetic site code (see `wardSites`), never an address. */
      originSiteCode: string;
      transportNeeded: boolean;
    }
  | {
      type: "ACCEPT_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      /** The referral being decided. */
      referralId: string;
      /**
       * WHICH of the referral's destinations is answering (FD-21). A referral may be addressed to
       * several at once, so "accept this referral" is no longer a complete instruction — without
       * this the reducer would have to guess which destination replied, and the only guess
       * available (the ward, because it is the one with a unit) would have made the other three
       * unable to answer at all.
       */
      destinationKind: ReferralDestinationKind;
      /** The accepting unit. REQUIRED for `psychiatric_ward` and meaningless for the other three,
       *  which are answered by a person or a team and have no bed to name. Refused unless
       *  `referralEligibility` (ward-eligibility.ts) says that unit accepts this referral. */
      unitId?: string;
      /**
       * Lets a ward accept a referral that fails a JUDGEMENT gate — age, legal status, sex
       * designation, forensic, security, sex mix — by recording why. Without it the acceptance is
       * refused, so the reason is a condition of the acceptance rather than a note attached after.
       *
       * ⚠️ It buys past NOTHING physical. `allocatable_bed`, `capacity_freshness` and `specialling`
       * refuse whatever is recorded here, and so does any gate added later that is not on the
       * judgement list — see `referralAcceptanceRefusal` in the reducer, which fails closed.
       * The owner's ruling, in his words: no reason typed into a form creates a bed.
       *
       * Same `OVERRIDE_REASONS` vocabulary as the three placement events. A second vocabulary for
       * the front door would be worse than the block it replaces.
       */
      overrideReason?: OverrideReason;
    }
  | {
      type: "RECORD_LOCAL_BED_SOUGHT";
      role: WardFlowRole;
      now: Instant;
      /**
       * The QUEUED referral a coordinator is recording a closer-to-home search against. Phase 8
       * (spec D8-6): a step that MAY have happened, recorded if it did — never a stage the
       * pathway requires and never a gate on `ACCEPT_REFERRAL`.
       *
       * No outcome, reason or note field, deliberately: the record states only that the search
       * happened, at a time, by a role. `by` is taken from the event's own `role` in the reducer
       * rather than supplied here, so a caller cannot write a person's name into it.
       */
      referralId: string;
    }
  | {
      type: "DECLINE_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      /** The referral being decided. */
      referralId: string;
      /** WHICH destination is declining — see `ACCEPT_REFERRAL`'s own comment. A decline locks
       *  nobody out and leaves every other destination live (FD-24), so it must say which one. */
      destinationKind: ReferralDestinationKind;
      /** Chosen from `REFERRAL_DECLINE_REASONS`, never free text — refused by a membership check,
       *  not a truthiness test (Phase 5 shipped a truthiness test in this exact position). */
      reason: ReferralDeclineReason;
    }
  | {
      /**
       * A patient LEAVES the ward. Until this event existed the prototype could admit somebody and
       * never discharge them: 36 events, and the only person who had ever left a bed was one
       * written that way in the seed. The discharge half of this project's own argument — following
       * one person from the decision to admit through to their bed being free again — had never
       * been seen working.
       */
      type: "RECORD_LEAVING";
      role: WardFlowRole;
      now: Instant;
      /** The admission ending. Not a movement and not a bed: an `Admission` records the ward and
       *  never a bed, so there is no bed identity to name here. */
      admissionId: string;
      /**
       * Same claim-not-proof discipline every other unit-scoped event carries, compared against the
       * admission's own `unitId`. Without it one ward could discharge another ward's patient, which
       * is the kind of thing a prototype makes look easy and a real system must refuse.
       */
      actingUnitId: string;
      /**
       * Chosen from `LEAVING_DESTINATIONS`, never free text. It is not decoration: exactly one of
       * the five (`transferred-to-another-psychiatric-ward`) does NOT count as a statewide release,
       * because that bed is still occupied somewhere in the system. Recording the destination is
       * what makes the difference between a bed freed and a bed moved.
       */
      leavingDestination: LeavingDestination;
    }
  | {
      /**
       * A WARD SENDS ONE OF ITS OWN OCCUPANTS OUT TO AN EMERGENCY DEPARTMENT, AND KEEPS THE BED.
       *
       * `Admission.awayAtEmergencyDepartmentSince` existed from 2026-08-30 with no writer and, worse,
       * no clearer: the seed could mark somebody away and nothing in the model could ever mark them
       * back. The board renders "At an emergency department for N hours — the bed is still theirs"
       * from `now - awayAtEmergencyDepartmentSince`, so those seeded rows counted upward without
       * bound for the whole life of the demonstration, and every occupant WITHOUT the badge read as
       * physically in their bed — the exact conclusion the field's own comment says it exists to
       * prevent.
       *
       * ⚠️ **THIS EVENT MOVES NO CAPACITY FIGURE, AND MUST NOT.** The ward is holding the bed
       * because the person is coming back. The reducer touches `Admission` only; it does not go
       * near `Unit.empty`, `Unit.allocatable` or `sexMix`, and `bedIsOccupied` never reads this
       * field. Freeing a bed a ward is still keeping is the single failure this model exists to
       * prevent — see `Admission.awayAtEmergencyDepartmentSince` for the full ruling.
       *
       * It carries no reason and no destination. Which emergency department, and why, are facts
       * this record has never held and this event is not the place to start inventing them.
       */
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT";
      role: WardFlowRole;
      now: Instant;
      /** The admission going out. Not a movement and not a bed — the same reasoning
       *  `RECORD_LEAVING`'s own `admissionId` carries. */
      admissionId: string;
      /** Same claim-not-proof discipline every other unit-scoped event carries, compared against
       *  the admission's own `unitId`, so one ward cannot record a fact about another ward's
       *  patient. */
      actingUnitId: string;
    }
  | {
      /**
       * THE OTHER HALF, AND IT IS NOT OPTIONAL. A way to mark somebody away with no way to mark
       * them back is the same defect turned round: a badge nobody can remove, and an hour count
       * that only ever grows.
       *
       * Clears `Admission.awayAtEmergencyDepartmentSince` back to `null`, which is the field's
       * ordinary state and means "on the ward". Nothing else changes: the bed was never given up,
       * so there is nothing to give back.
       *
       * ⚠️ **The return is NOT recorded as a second instant anywhere.** This model holds when the
       * person left the ward and nothing about when they came back, so a "returned at" would be a
       * field with one writer and no reader — the class of defect this whole change is repairing.
       * If the length of an ED trip is ever wanted, it is a new field with its own ruling, not a
       * side effect of this one.
       */
      type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT";
      role: WardFlowRole;
      now: Instant;
      /** The admission coming back. */
      admissionId: string;
      /** Same claim-not-proof discipline as the event above. */
      actingUnitId: string;
    }
  | {
      /**
       * SOMEBODY SAYS WHAT IS ACTUALLY HOLDING THIS PATIENT UP.
       *
       * ⚠️ **`Movement.blocker`, NOT `BedRelease.blocker`.** Two different fields share that name:
       * this one is free prose about a movement; the other is a `BedReleaseBlocker` enum about a
       * bed being freed, written by `BLOCK_BED_RELEASE`/`CLEAR_BED_RELEASE_BLOCK`. Nothing here
       * touches those.
       *
       * `Movement.blocker` was written once — `"Awaiting coordinator referral"`, at creation — and
       * by nothing afterwards. It renders on the movement console as **Response** and as **Current
       * blocker**, so a patient whose transport was already en route still read as waiting for a
       * coordinator, and somebody chased the wrong patient.
       *
       * ⚠️ **FREE PROSE, DELIBERATELY, AND IT MUST NOT BE NARROWED TO A CHOSEN LIST.** Owner
       * ruling, 2026-09-01. The field carries things no vocabulary and no derivation can produce:
       * an absence WITH its reason (`"None — in transit"` against `"None — handover complete"` —
       * two different situations that both have no blocker), and activity by parties the model has
       * no field for (a family, a specialling roster, an escort provider). Constraining this to a
       * fixed set would lose exactly what deriving it would lose, by a different route. See
       * `Movement.blocker`'s own doc comment and `tests/ward-movement-blocker.test.ts`, which
       * asserts five such values stay expressible.
       *
       * ⚠️ **THE ONE THING FREE PROSE MUST STILL NOT CARRY IS A PERSON.** This model names wards,
       * roles and jobs and never a patient — no name, date of birth, record number, address or
       * clinical narrative — and a text box is the easiest place in the whole prototype to break
       * that. The reducer cannot enforce it (it cannot read English), so it is stated here, stated
       * on the control, and pinned against the fixture by `tests/ward-model.test.ts`'s own
       * forbidden-substring check. That is a real limit of this event and is recorded rather than
       * papered over.
       */
      type: "RECORD_MOVEMENT_BLOCKER";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /**
       * What is holding it up, in the caller's own words. Refused when blank: `Movement.blocker`
       * has no null, so an empty string would be indistinguishable from a field nobody had reached
       * — the exact ambiguity this event exists to end.
       */
      blocker: string;
    }
  | {
      /**
       * NOTHING IS HOLDING THIS PATIENT UP ANY MORE — and it needs its own event rather than a
       * magic word typed into the box above.
       *
       * ⚠️ **THIS EXISTS BECAUSE `RECORD_MOVEMENT_BLOCKER` OPENED A HOLE THE SAME DAY IT CLOSED
       * ONE.** `hasActiveBlocker` (ward-priority.ts) recognised "nothing is blocking" by
       * case-sensitive match against a small fixed vocabulary — safe while only the fixture and the
       * reducer wrote the field. Once a person could type any prose, a nurse clearing a blocker
       * with `"none — resolved"`, `"no blocker"` or `"Nothing outstanding"` left the movement
       * scoring ten points as actively obstructed, and so ranked above patients who really were.
       * Silently: a wrong SCORE, which a system acts on, rather than a wrong sentence, which a
       * person can disbelieve.
       *
       * The remedy is not a wider pattern — the next phrasing is missed too, and a
       * case-insensitive `/^none/i` would swallow `"None of the secure units can take him"`, a real
       * blocker the priority tests pin. So clearing is REPRESENTED rather than INTERPRETED: this
       * event writes one reducer-owned sentinel, and the recogniser only ever has to know a closed
       * set (`BLOCKERS_MEANING_NOTHING_IS_BLOCKING`) that cannot grow by invention.
       *
       * Same roles as `RECORD_MOVEMENT_BLOCKER`, and deliberately not narrower: whoever may say
       * what is holding a patient up may say it has stopped. A clearing permission narrower than
       * the recording one is how a queue fills with obstructions nobody present can remove.
       */
      type: "CLEAR_MOVEMENT_BLOCKER";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /**
       * THE REFERRER TAKES THE REFERRAL BACK. Until this existed a referral could be ended by
       * exactly one thing — another unit accepting it — so a patient who improved, went home or
       * went somewhere else left the request sitting live in every receiving ward's list with no
       * way for anyone to say it was over.
       *
       * It withdraws EVERY live referral for this movement at once, because that is what the
       * referrer is saying: this patient no longer needs a bed. Withdrawing from one ward while
       * leaving others live is a different act and does not exist yet.
       */
      type: "WITHDRAW_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /**
       * THE COORDINATOR'S OWN RECORD CORRECTION — Task 5 (ward-flow movement step-track plan,
       * 2026-09-04), owner rulings E and F. Moves `movement.stage` strictly BACKWARDS, appends one
       * `stageChanges` entry and one `unwinds` entry (`kind: "stage_corrected"`), and touches
       * NOTHING else — no bed is released, no transport is cancelled, no timestamp elsewhere on the
       * movement moves. F3's whole content in one sentence: stepping back past Accepted does not
       * un-accept, and stepping back past Bed pulled does not un-pull. See the reducer's own case
       * for the full list of fields this deliberately never writes.
       *
       * ⚠️ **NOT `WITHDRAW_ACCEPTANCE` below.** This event corrects a RECORD; that one tells a WARD
       * its earlier "yes" no longer holds. They read as the same English verb ("undo") and are
       * unrelated acts on unrelated actors' decisions.
       *
       * Coordinator-only (`EVENT_ROLE.STEP_BACK_STAGE` below) — F1's entire enforcement, since the
       * generic role check in `wardFlowReducer`'s switch preamble already rejects every other role
       * before this event's payload is even inspected, exactly as it does for every other
       * role-gated event in this file.
       */
      type: "STEP_BACK_STAGE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /** Must be strictly earlier than `movement.stage` in `MOVEMENT_STAGES` array order — covers
       *  both a same-stage attempt and a forward "skip a step", which is explicitly OUT OF SCOPE
       *  for this event (owner ruling 4 of 2026-09-04: authorised by ruling E's own words but
       *  unspecced by ruling F, and recorded as owed rather than built). */
      to: MovementStage;
      reason: StepBackReason;
    }
  | {
      /**
       * THE COORDINATOR UNDOES A WARD'S "YES" — Task 5, same plan and rulings as `STEP_BACK_STAGE`
       * above. Clears `movement.acceptedUnitId` and `acceptedAt`, reverts `stage` to
       * `"destination_review"`, and appends one `stageChanges` entry and one `unwinds` entry
       * (`kind: "acceptance_withdrawn"`, carrying the withdrawn unit's id — see `UnwindRecord`'s
       * own doc comment).
       *
       * ⚠️ **GATED TO `movement.stage === "accepted_awaiting_bed"` ONLY** (owner ruling 2 of
       * 2026-09-04, deliberately narrow: a withdrawal from `pulled` or later is a bigger act with
       * different consequences — a bed is physically held and, past `handover_ready`, a patient
       * may be moving — and the owner recorded this as an OPEN QUESTION for himself, not a settled
       * boundary: "the bed was lost" is exactly the reason that would arise at `pulled`, so the
       * narrow gate probably excludes a real case. Widening it later is his call, not this build's).
       *
       * ⚠️ **DOES NOT RE-ADD THE WITHDRAWN UNIT TO `referredUnitIds`** (owner ruling 3 of
       * 2026-09-04): withdrawing an acceptance is not the same act as re-referring, and reviving a
       * "live referral" the ward never re-received would be a false claim on that ward's own
       * screen. `REFER_TO_UNITS` is the existing path if the coordinator wants to re-approach.
       *
       * ⚠️ **REUSES `StepBackReason`/`STEP_BACK_REASONS`, not a reason list of its own** (owner
       * ruling 1 of 2026-09-04) — see that list's own doc comment in `ward-model.ts` for why, and
       * for the note that the WARD reads these reasons while `STEP_BACK_STAGE`'s reader does not.
       *
       * Coordinator-only, same enforcement shape as `STEP_BACK_STAGE` above.
       */
      type: "WITHDRAW_ACCEPTANCE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      reason: StepBackReason;
    };

/**
 * ⚠️ THE EVENTS A RECORDED REASON CAN GET PAST — AND THE POINT IS THAT IT IS DERIVED, NOT LISTED.
 *
 * `Extract` reads the union itself, so this cannot drift from `WardFlowEvent`. The reducer's two
 * refusal helpers take THIS rather than `WardFlowEvent & { overrideReason?: OverrideReason }`.
 *
 * That intersection was the defect: it RE-ADDED the field regardless of what the union member
 * declared, so deleting `overrideReason?: OverrideReason` from an event produced no type error
 * anywhere. The declaration was load-bearing for CALLERS constructing the event and NOT for the
 * reducer reading it — a deletion would have left screens unable to pass a reason while the
 * reducer went on reading one that could never arrive. A field with no producer, arriving by
 * deletion, invisible to tsc.
 *
 * ⚠️ AND A STRUCTURAL CHECK WOULD NOT HAVE CAUGHT IT EITHER. `Member extends { overrideReason?:
 * OverrideReason }` stays TRUE when the field is deleted, because a type missing an OPTIONAL
 * property is still structurally assignable to one that declares it optional. That check would
 * compile for ever and report nothing — a check that cannot fail, in the type system.
 */
export type OverridableWardFlowEvent = Extract<
  WardFlowEvent,
  { type: "REFER_TO_UNITS" | "ACCEPT_IN_PRINCIPLE" | "PULL_PATIENT" | "ACCEPT_REFERRAL" }
>;

/**
 * One table, read by the reducer's role check, rather than a `switch` repeated at every call
 * site. Adding an event here without an entry is a compile error, which is the point.
 *
 * Widened from one role per event to a non-empty list of permitted roles (this task, spec D2).
 * `CHANGE_URGENCY` and `CHANGE_LEGAL_STATUS` are the first events with more than one — both a
 * coordinator and the referring ED clinician may record either change — and Task 3's events need
 * the same shape, so the table is widened here rather than special-cased per event.
 */
export const EVENT_ROLE: Record<WardFlowEvent["type"], readonly WardFlowRole[]> = {
  /**
   * Owner ruling FD-25, 2026-08-30: a referral is raised by whoever is with the patient, and that
   * is not only an ED. A ward refers to a medical ward or to a community team; a community service
   * refers in. Widened from `["ed"]` accordingly.
   *
   * `edId` on this event is now an ORIGIN of any kind, not an emergency department — the name is
   * left alone in this pass because renaming it touches every raise path, and a half-renamed field
   * is worse than an accurate comment. Recorded here so the next reader does not take the name as
   * a constraint.
   */
  RAISE_REFERRAL: ["ed", "community", "ward"],
  RECORD_EXAMINATION: ["ed"],
  RECORD_MEDICAL_CLEARANCE: ["ed"],
  /*
   * MIRRORS `BOOK_TRANSPORT` BELOW, INCLUDING ITS EXCLUSION — the sending team, and not the
   * coordinator. `TR-D1` rejects the coordinator from booking BY NAME because "it owns the bed
   * search and does not know whether this patient needs an escort or is settled enough to travel".
   * Whether transport is needed at all is the same knowledge one step earlier, so the same three
   * senders may answer it and the same role may not. A coordinator who could record "no transport
   * needed" would be answering a question about a patient it has never seen.
   */
  RECORD_TRANSPORT_NEED: ["ed", "ward", "community"],
  /*
   * `ed` ALONE, on `RECORD_MEDICAL_CLEARANCE`'s reasoning exactly: the department physically
   * holding the patient is the only party that can say nobody referred them. A coordinator sees
   * the referral list and would be inferring the absence from its own empty search — which is the
   * inference ruling R-2026-09-04-D exists to replace with a recorded answer.
   */
  RECORD_NO_REFERRAL: ["ed"],
  REFER_TO_UNITS: ["coordinator"],
  ACCEPT_IN_PRINCIPLE: ["ward"],
  /* Owner ruling 2026-09-01: a pull is always a person's act — *"only a person can do this who is
   * interacting from the ward menu or the coordinator"*. Widened from ward-only deliberately, and the
   * reducer refuses it against a bed that is not ready whichever role raises it. */
  PULL_PATIENT: ["ward", "coordinator"],
  DECLINE: ["ward"],
  HANDOVER_READY: ["ed"],
  TRANSPORT_ACCEPTED: ["officer"],
  TRANSPORT_EN_ROUTE: ["officer"],
  PATIENT_COLLECTED: ["officer"],
  PATIENT_ARRIVED: ["officer"],
  CONFIRM_CAPACITY: ["ward"],
  RECORD_ESCALATION: ["coordinator"],
  ADVANCE_CLOCK: ["demo"],
  RESET_SCENARIO: ["demo"],
  SET_SCENARIO: ["demo"],
  CHANGE_URGENCY: ["coordinator", "ed"],
  CHANGE_LEGAL_STATUS: ["coordinator", "ed"],
  RELEASE_PULL: ["coordinator", "ward"],
  // TR-D6 (owner, 2026-08-30): the team that BOOKED it, and the coordinator. The sending team
  // owns the job (TR-D5) and every movement originates at an emergency department
  // (`Movement.originEdId` is required), so the booking team is `ed`. ⚠️ `ward` is the
  // RECEIVING side and is excluded BY NAME: it did not book the job, and a booking cancelled
  // by the destination is indistinguishable on the sending board from one that failed — so
  // the sending team cannot tell "they changed their mind" from "it never went through".
  // This list read ["coordinator", "ward"] until 2026-08-30, which was TR-D6 inverted.
  // `TR-D1`: the sending ward or ED, and the coordinator REJECTED BY NAME — it owns the bed search
  // and does not know whether this patient needs an escort or is settled enough to travel. Note the
  // asymmetry with `CANCEL_TRANSPORT` below, which the coordinator MAY do (`TR-D6`): it is the only
  // role that sees the whole picture and so the only one positioned to notice a booking that has
  // become wrong. Booking needs knowledge of the patient; cancelling needs knowledge of the network.
  //
  // `community` ADDED 2026-09-01 (OWNER): transport booking belongs to whoever is SENDING the
  // patient, and a community team is one of those senders.
  //
  // ⚠️ **THE MODEL CANNOT YET REPRESENT THE SENDER THAT RULING NAMES, AND THIS ROW DOES NOT
  // PRETEND OTHERWISE.** `Movement.originEdId` is REQUIRED (`ward-model.ts` — "where the patient
  // physically is"), and `RAISE_REFERRAL`, the ONLY event that creates a movement, refuses an
  // `edId` that is not in `allEmergencyDepartments()`. So every movement is sent FROM an emergency
  // department whoever raised it: **there is no community-origin movement, at `pulled` or at any
  // other stage.** The two lines directly above still hold as a statement of fact and are left
  // standing for that reason.
  //
  // What the widening actually grants is a `community` caller booking transport for a patient
  // sitting in an ED. That is a LIVE permission and not a dead one — `case "BOOK_TRANSPORT"` gates
  // on `movement.stage` alone and never compares the caller against `originEdId` — but it is
  // UNSCOPED for exactly the same reason: a community team may book for any pulled movement in the
  // state, not only for one it sent. Scoping it needs a community origin on `Movement` first, which
  // is the owner's decision and not an implementer's. Pinned in `tests/ward-book-transport.test.ts`.
  BOOK_TRANSPORT: ["ed", "ward", "community"],
  CANCEL_TRANSPORT: ["coordinator", "ed"],
  FLAG_BED_RELEASE: ["ward"],
  CONFIRM_BED_RELEASE: ["ward"],
  // Bed-model rework (2026-08-28). All three are `ward`-only for the same reason the four above
  // are: only the ward moves a bed between stages, flags it stuck or unstuck, or says it is being
  // made ready. A coordinator sees every one of them and changes none of them.
  REVERT_BED_RELEASE: ["ward"],
  BLOCK_BED_RELEASE: ["ward"],
  CLEAR_BED_RELEASE_BLOCK: ["ward"],
  SET_BED_PREPARATION: ["ward"],
  RELEASE_BED: ["ward"],
  RECORD_LEAVE_BED: ["ward"],
  END_LEAVE_BED: ["ward"],
  // The ward the patient is leaving records it. Not the coordinator: a statewide view does not
  // know that somebody walked out of a building, and a coordinator recording a discharge it
  // cannot observe is the shape this project refuses everywhere else.
  RECORD_LEAVING: ["ward"],
  // The ward that holds the bed, and nobody else. A ward is the only party that observes one of
  // its own occupants leaving the building for an emergency department and coming back, and it is
  // the party still holding the bed while they are gone. The coordinator is excluded on exactly
  // the reasoning `RECORD_LEAVING` above already uses: a statewide view does not know that
  // somebody walked out of a ward, and it would be recording something it cannot see. `ed` is
  // excluded too, and that one is worth stating because it looks like the obvious candidate — the
  // patient is physically IN an emergency department while this is true. But the fact being
  // recorded is about the WARD'S OWN BED ("the bed is still theirs"), the reducer refuses any
  // acting unit other than the one holding the admission, and an emergency department holds no
  // ward bed to act as. Neither event writes a role name onto any record, so no false attribution
  // can enter with either.
  RECORD_AWAY_AT_EMERGENCY_DEPARTMENT: ["ward"],
  RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT: ["ward"],
  /*
   * Mirrors `WITHDRAW_REFERRAL` below exactly, and for the same reason: whoever may raise a
   * movement may say what is holding it up, plus the coordinator. The four are not
   * interchangeable observers — a ward knows its bed is not clean, an emergency department knows a
   * family has not been reached, a community team knows what it is waiting on, and the
   * coordinator is the only one who can say no bed exists anywhere in the network. Narrowing this
   * to one of them would make the other three's observation unrecordable, and the field's whole
   * purpose is to hold a fact the model cannot compute.
   *
   * ⚠️ **`officer` ADDED 2026-09-01, AND THE REASON IT HAD BEEN EXCLUDED WAS FALSE WHEN WRITTEN.**
   * This comment said the transport legs "already restate this field on their own", so an
   * officer's view was written by the events they raise. An officer raises exactly four events —
   * `TRANSPORT_ACCEPTED`, `TRANSPORT_EN_ROUTE`, `PATIENT_COLLECTED`, `PATIENT_ARRIVED` — and until
   * the same day only the last two restated anything. The two legs that made the standing sentence
   * false were the two that left it alone, and the only party who observes them could not correct
   * it. Both legs restate now, so the premise is finally true — and it still does not carry the
   * exclusion, for two reasons:
   *
   *   - **Applied consistently it excludes everybody.** Every permitted role also raises events
   *     that restate this field: the coordinator `REFER_TO_UNITS`, the ward `ACCEPT_IN_PRINCIPLE`,
   *     the emergency department `BOOK_TRANSPORT` and `RECORD_EXAMINATION`. "Your events already
   *     write it" is true of all five, so it discriminates between none of them.
   *   - **It answers the stage-level case and not the one this field exists for.** Between
   *     `TRANSPORT_EN_ROUTE` and `PATIENT_COLLECTED` the vehicle is the only thing moving and the
   *     officer is the only party watching it. An ambulance diverted to a higher-priority job, or a
   *     crew stood down, has NO event in this model — the movement sits reading "Awaiting
   *     collection — transport is en route" while the vehicle turned around. That is the same
   *     staleness one layer down, and the test above ("narrowing this would make an observation
   *     unrecordable") admits the officer on exactly the reasoning it admits the other four.
   *
   * The second half of the old reason — "an officer does not own the placement" — is not the test
   * this table uses either. The ward does not own the placement (the coordinator does) and is here
   * anyway, because it can see its own bed. Unique observation earns the seat, not ownership.
   *
   * What the reducer writes for these roles, as this guard demands: THE CALLER'S OWN PROSE AND
   * NOTHING ELSE. No role name, no team, no person is recorded alongside it, so no false
   * attribution can enter with any of the five — the record does not claim who said it, and the
   * screen does not either. That is what makes the widening safe as well as right.
   */
  RECORD_MOVEMENT_BLOCKER: ["ed", "community", "ward", "coordinator", "officer"],
  // Identical to `RECORD_MOVEMENT_BLOCKER` above and never narrower: whoever may say what is
  // holding a patient up may say it has stopped. Writes one reducer-owned sentinel and no role,
  // team or person — so, like its partner, it can introduce no false attribution. `officer` added
  // with its partner on 2026-09-01 for that reason: an officer who may record "ambulance diverted"
  // and may not then say it is resolved leaves a sentence only somebody who cannot see the vehicle
  // can retract.
  CLEAR_MOVEMENT_BLOCKER: ["ed", "community", "ward", "coordinator", "officer"],
  /*
   * ⚠️ MIRRORS `CHANGE_URGENCY` EXACTLY, AND THAT IS THE ARGUMENT RATHER THAN A CONVENIENCE.
   * `queueOrder` puts this flag ABOVE all three urgency tiers, so it MUST NOT be easier to raise
   * than the tier it outranks: a control available to more roles than `CHANGE_URGENCY` would let
   * somebody who may not move a patient from tier 3 to tier 1 put them above every tier 1 instead.
   * The coordinator sees the whole network and the referring emergency department is with the
   * patient; those are the two who may already move a tier, and they are the two here.
   *
   * `ward` is excluded BY NAME, and it is the one that looks like it belongs: a receiving ward
   * has an obvious view on how urgent an admission is. But a ward that may flag can promote the
   * patient it is about to accept above every other ward's, and the flag carries no reason and no
   * author for anybody to review that against. Widening this is an owner decision.
   *
   * What the reducer writes for these roles, as this guard demands: `flaggedUrgent: true` or
   * `false` and NOTHING else — no role, no reason, no timestamp. So neither role can introduce a
   * false attribution, because the record makes no attribution at all. That absence is itself a
   * known limit, recorded on the events' own doc comments.
   */
  FLAG_MOVEMENT_URGENT: ["coordinator", "ed"],
  CLEAR_MOVEMENT_URGENT_FLAG: ["coordinator", "ed"],
  /*
   * Whoever referred may un-refer, so this mirrors RAISE_REFERRAL's own role list rather than
   * narrowing it — a referral raised by a community team that only an ED could withdraw would be a
   * request nobody present can take back. The coordinator is included on the same reasoning as
   * FD-25: it overrides, and an override nobody can exercise is not an override.
   */
  WITHDRAW_REFERRAL: ["ed", "community", "ward", "coordinator"],
  // The one thing a coordinator may do to a ward's bed data. It changes no number: it marks that
  // somebody asked. Spec D12.
  REQUEST_CAPACITY_REFRESH: ["coordinator"],
  // Task 3 (Phase 7, "The front door"): the community role raises a referral; only the
  // coordinator decides whether the service takes it. Two different decisions, kept apart from
  // `DECLINE` (a ward declining a specific movement, downstream) — see this file's own top-level
  // comment on `WardFlowRole`.
  RECEIVE_REFERRAL: ["community"],
  // Anyone at the front door may add a patient who is not yet known - that IS the front door.
  ADD_PATIENT: ["ed", "community", "coordinator"],
  /**
   * Owner ruling FD-25: a WARD answers a referral addressed to it. The coordinator keeps the role
   * too — it overrides, and an override nobody can exercise is not an override.
   */
  // `ed` added 2026-08-30 under FD-3 as SUPERSEDED by the owner: "every referral is declinable,
  // and NO CODE PATH MAY RENDER A REFERRAL WITH NO DECLINE AFFORDANCE". The ED hub acts as
  // `ed`, so without it an emergency department could not answer a referral addressed to it,
  // and the available workaround was to dispatch as `ward` — which writes a false `decidedBy`.
  // ⚠️ The widening is scoped in the reducer: a role answers its OWN destination kind and
  // nothing else, so this list alone does not let an ED decide on a ward bed.
  ACCEPT_REFERRAL: ["ward", "coordinator", "ed"],
  DECLINE_REFERRAL: ["ward", "coordinator", "ed"],
  // `coordinator` only, and this one is a PLAN JUDGEMENT rather than a spec ruling — the spec
  // says only "role-gated like every other referral event", and the control sits on the
  // coordinator's own match view. The owner may want `community` here as well (a community team
  // is plausibly who actually rang round for a local bed); adding it is a product decision, not
  // an implementer's, so it is flagged rather than taken.
  RECORD_LOCAL_BED_SOUGHT: ["coordinator"],
  /**
   * F1 (Task 5, 2026-09-04): only the coordinator may raise either event. This table entry is the
   * ENTIRE enforcement — the generic role check in `wardFlowReducer`'s switch preamble rejects any
   * other role before either event's payload is inspected at all, exactly as it does for every
   * other role-gated event above.
   */
  STEP_BACK_STAGE: ["coordinator"],
  WITHDRAW_ACCEPTANCE: ["coordinator"],
};
