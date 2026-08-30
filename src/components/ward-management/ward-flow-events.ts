import type { Instant } from "@/components/ward-management/ward-clock";
import type {
  BedPreparationNote,
  BedReleaseBlocker,
  OverrideReason,
  CancelTransportReason,
  LegalStatusChangeReason,
  ReleaseHoldReason,
  UrgencyChangeReason,
} from "@/components/ward-management/ward-change-reasons";
import type {
  BedReleaseWaitingOn,
  Cohort,
  DeclineReason,
  HomeRegion,
  LegalStatus,
  ReferralDeclineReason,
  ReferralDestination,
  ReferralDestinationKind,
  ReferralSource,
  ReferralSuburb,
  Security,
  Sex,
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
  | { type: "RAISE_REFERRAL"; role: WardFlowRole; now: Instant; edId: string; draft: ReferralDraft }
  | {
      type: "RECORD_EXAMINATION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      outcome: "inpatient_order" | "community_order" | "revoked";
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
  | { type: "ACCEPT_IN_PRINCIPLE"; role: WardFlowRole; now: Instant; movementId: string; unitId: string }
  | { type: "HOLD_BED"; role: WardFlowRole; now: Instant; movementId: string; unitId: string }
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
      /** Who will collect the patient, from `TRANSPORT_PROVIDERS`. Optional only because no screen
       *  offers the choice yet; the reducer falls back to the first entry and says so. */
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
      type: "CHANGE_LEGAL_STATUS";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      legalStatus: LegalStatus;
      reason: LegalStatusChangeReason;
    }
  | {
      type: "RELEASE_HOLD";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      reason: ReleaseHoldReason;
      /**
       * The unit the caller stated it was acting as. Required for a `ward` caller, unused for a
       * `coordinator` caller. This records the caller's CLAIM about itself and does not prove it:
       * nothing here authenticates anything, and this model has no identity model. The comparison
       * constrains future callers rather than this one.
       */
      actingUnitId?: string;
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
    };

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
  REFER_TO_UNITS: ["coordinator"],
  ACCEPT_IN_PRINCIPLE: ["ward"],
  HOLD_BED: ["ward"],
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
  RELEASE_HOLD: ["coordinator", "ward"],
  // TR-D6 (owner, 2026-08-30): the team that BOOKED it, and the coordinator. The sending team
  // owns the job (TR-D5) and every movement originates at an emergency department
  // (`Movement.originEdId` is required), so the booking team is `ed`. ⚠️ `ward` is the
  // RECEIVING side and is excluded BY NAME: it did not book the job, and a booking cancelled
  // by the destination is indistinguishable on the sending board from one that failed — so
  // the sending team cannot tell "they changed their mind" from "it never went through".
  // This list read ["coordinator", "ward"] until 2026-08-30, which was TR-D6 inverted.
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
};
