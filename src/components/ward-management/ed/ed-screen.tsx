"use client";

import { useState, type FormEvent } from "react";

import {
  elapsedLabel,
  stageCopy,
  transportLeg,
  unitCapacity,
  wardServiceOrder,
} from "@/components/ward-management/ward-derivations";
import { formatElapsed, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import {
  changeReasonLabels,
  LEGAL_STATUS_CHANGE_REASONS,
  URGENCY_CHANGE_REASONS,
  type LegalStatusChangeReason,
  type UrgencyChangeReason,
} from "@/components/ward-management/ward-change-reasons";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import {
  COHORTS,
  ED_ACCESS_TARGET_MINUTES,
  SEXES,
  TRANSPORT_PROVIDERS,
  URGENCY_LEVELS,
  type Cohort,
  type LegalStatus,
  type Movement,
  type Security,
  type Sex,
  type TransportProvider,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  edReferralsFor,
  referralClocks,
  referralPersonFacts,
  referralPurposeLabel,
  REFERRAL_CLOCK_TERMS,
  type ReferralClocks,
} from "@/components/ward-management/ward-referrals";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";

import styles from "./ed.module.css";

type EdScreenProps = { edId: string };

/**
 * THE TWO CLOCKS ON AN INBOX ROW, AND WHY THIS SCREEN NOW HAS THEM.
 *
 * ⚠️ **THIS REVERSES THIS FILE'S OWN EARLIER RULING, AND THE RULING WAS RIGHT WHEN IT WAS MADE.**
 * Until `Referral.triagedAt` landed (2026-08-30) these rows said the fact was not recorded, because
 * `P9-D7` stops the referral clock when the patient reaches the department and the model held no
 * instant to stop it at — *a clock that should stop and cannot runs on forever and still looks
 * plausible*. The field exists now, so **the absence prose became false the moment it did** and had
 * to go rather than sit beside a real figure.
 *
 * ⚠️ **BOTH NUMBERS COME FROM ONE `referralClocks(referral, now)` CALL, on the provider's `now`.**
 * Two clocks on one card computed from two readings assert a moment the card is not showing, which
 * the out-of-area board already did once on this same model. Never a duration hand-rolled here:
 * `splitDuration`/`formatElapsed` (`ward-clock.ts`) own every hours-from-minutes conversion, after
 * two screens each computing their own kept `25h 30m` alive on eleven surfaces.
 *
 * ⚠️ **NO ROW MAY SAY "ARRIVED".** `triagedAt` is when the department TRIAGED somebody, and a
 * patient arrives, waits, and is triaged some time later — on a busy night that gap is not small.
 * Triage is the closest instant this system records, so it is a proxy, and **it is only honest
 * while every row labels it as one**. The vocabulary is `REFERRAL_CLOCK_TERMS`, a value
 * `tests/ward-referral-clocks.test.ts` can check, precisely because a comment asking for this is
 * what already failed. This screen composes those terms and never writes its own.
 */
type EdClockLine = {
  /** The heading this hub puts the clock under — one of `REFERRAL_CLOCK_TERMS`, never a new word. */
  term: string;
  /** The figure, or the statement that there is no figure. Never a zero and never a bare dash. */
  value: string;
};

/**
 * Puts a term at the start of a line. `REFERRAL_CLOCK_TERMS` are deliberately TERMS rather than
 * sentences, because how a screen arranges the two numbers is the screen's decision — so composing
 * one into a heading is this file's job. It changes the first character and nothing else: rewording
 * a term here would reintroduce exactly the drift the vocabulary was made a checked value to stop.
 */
function asLineHeading(term: string): string {
  return term.charAt(0).toUpperCase() + term.slice(1);
}

/**
 * The two clocks, in the words this hub shows them in. Pure and exported so all three shapes can be
 * asserted directly — including the one the application cannot currently reach on this screen.
 *
 * ⚠️ **THE DEPARTMENT CLOCK'S PRESENT BRANCH IS REACHED NOW** (2026-08-30). It was not when this
 * was written: `triagedAt` was authored only on referrals addressed to psychiatric wards, so this
 * inbox rendered the ABSENT branch for every row it could hold. `RF-009` changed that — addressed
 * to `rph-ed` for `psychiatric_review`, triaged 210 minutes before it was raised — and
 * `tests/ward-ed-psychiatry-hub.dom.test.tsx` now asserts both of its clocks on the rendered screen.
 *
 * ⚠️ **WHAT IS STILL UNREACHABLE IS THE STOPPED REFERRAL CLOCK.** Stopping needs
 * `triagedAt >= raisedAt` — somebody triaged AFTER being referred — and no seeded ED-addressed
 * referral has that, while `RECEIVE_REFERRAL`, the only event that creates a `Referral`, has no
 * `triagedAt` field for a screen to supply one. That branch is written and tested rather than
 * deferred, because the running wording is only meaningful next to the wording it is not; the gap is
 * a reported finding, not a silent assumption.
 *
 * ⚠️ **THE STOPPED CLOCK IS WORDED DIFFERENTLY FROM THE RUNNING ONE, and that is not styling.** A
 * span that ended at triage rendered like a wait somebody is still serving is the same class of lie
 * as printing `0m` for a person who is not there — so a running clock says "waiting" and a stopped
 * one says what stopped it.
 */
export function edReferralClockLines(clocks: ReferralClocks): { department: EdClockLine; referral: EdClockLine } {
  return {
    department: {
      term: asLineHeading(REFERRAL_CLOCK_TERMS.inDepartment),
      // `undefined` is NOT ZERO: this person is not in the department yet, and "0m in department"
      // would read as "just triaged", the opposite of the truth (`P9-D7`).
      value:
        clocks.inDepartment === undefined
          ? asLineHeading(REFERRAL_CLOCK_TERMS.notInDepartment)
          : `${splitDuration(clocks.inDepartment)} since triage`,
    },
    referral: clocks.sinceReferralRunning
      ? {
          term: asLineHeading(REFERRAL_CLOCK_TERMS.sinceReferral),
          // `formatElapsed` — the same "… waiting" register every other live wait in Ward Flow uses.
          value: formatElapsed(clocks.sinceReferral),
        }
      : {
          term: asLineHeading(REFERRAL_CLOCK_TERMS.sinceReferralStopped),
          value: `${splitDuration(clocks.sinceReferral)}, stopped at triage`,
        },
  };
}

/** The id the unavailable Decline control points `aria-describedby` at. One reason element per
 *  list rather than one per row: every row is unavailable for the identical reason, and repeating
 *  it per row would make a screen reader read it once for each patient. */
const DECLINE_UNAVAILABLE_REASON_ID = "ward-ed-inbox-decline-unavailable";

/**
 * ⚠️ **THE REASON IS ABOUT WHO MAY RECORD THE DECISION, NEVER ABOUT WHETHER IT MAY BE DECLINED.**
 *
 * Every referral is declinable — including the ward's medical notification, which nobody is
 * *expected* to act on and everybody is *able* to. The original `FD-3` guard said no action was
 * ever rendered on that flow, and the owner superseded it.
 *
 * What is missing is the permission to record it from here: `EVENT_ROLE.DECLINE_REFERRAL` is
 * `["ward", "coordinator"]` and this screen acts as `"ed"`, so the reducer would refuse a decline
 * raised here and the refusal would be invisible to whoever pressed the button.
 */
const DECLINE_UNAVAILABLE_REASON =
  "Declining is not yet recordable from this screen: an ED psychiatry team is not one of the roles permitted to " +
  "answer a referral. This is a permission that has not been widened yet, not a rule about which referrals may be " +
  "declined — every referral may be.";

/**
 * Fix round B (review finding I3): this used to be hand-listed as `["Adult", "Older adult"]`,
 * typed `Cohort[]` rather than derived from `COHORTS` — so when `Cohort` widened to include
 * `"Youth"` (Phase 7's youth cohort), the type change could not make this array fail to compile,
 * and the ED's cohort picker silently offered no way to raise a Youth referral even though
 * `Movement.cohort` (and the East Metropolitan Youth Unit, EMyU, at Bentley) both accept one. No
 * evidence was found that excluding Youth from the ED picker was a deliberate clinical decision —
 * nothing in `docs/ward-flow-phase-6-7-decisions.md` or this file says so — so the fix here is to
 * derive the picker from `COHORTS` directly (offering all three) rather than pin the omission
 * with a comment. If excluding Youth from the ED is ever a real decision, it belongs here as an
 * explicit, commented exclusion with a test pinning it — not as a stale hand-written array.
 */
const COHORT_OPTIONS: Cohort[] = [...COHORTS];
const SECURITY_OPTIONS: Security[] = ["Open", "Secure"];
// Phase 7 Task 5: derived from `SEXES`/`URGENCY_LEVELS` (`ward-model.ts`) rather than
// hand-listed, closing the same gap `COHORT_OPTIONS` above closed for `Cohort` — see that
// file's own doc comment on `SEXES` for the defect class this prevents.
const SEX_OPTIONS: Sex[] = [...SEXES];
const LEGAL_STATUS_OPTIONS: LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];
const URGENCY_OPTIONS = URGENCY_LEVELS;

/**
 * The `<option>` value standing for "no form". A `<select>` option value is always a string, so
 * "no form" needs a sentinel; it is converted back to `null` on the way into the draft, where
 * "no form" is a real choice rather than a blank.
 */
const NO_LEGAL_FORM_VALUE = "";

type ReferralDraftState = {
  cohort: Cohort;
  security: Security;
  sex: Sex;
  specialling: boolean;
  legalStatus: LegalStatus;
  urgency: 1 | 2 | 3;
  legalFormCode: string | null;
};

const DEFAULT_DRAFT: ReferralDraftState = {
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  specialling: false,
  legalStatus: "Voluntary",
  urgency: 3,
  // Defaults to no form. The clinician picks one; the software never picks one for them.
  legalFormCode: null,
};

/**
 * `RECORD_EXAMINATION`'s own preconditions (`ward-flow-reducer.ts`'s `case "RECORD_EXAMINATION"`),
 * named here in the same order so the control can never advertise an action the reducer would
 * refuse — the same discipline `ward-screen.tsx`'s `referralAnswerBlocked`/`holdBlockedReason` and
 * `officer-screen.tsx`'s four `*BlockedReason` functions already hold to.
 */
function examinationBlockedReason(movement: Movement): string | undefined {
  // There is deliberately no form check here. The reducer's "form must be 1A" rejection was
  // deleted on 2026-08-24 — an examination may be recorded for any patient, on any form or on
  // none — so a form check here would advertise a refusal the reducer would not make, which is
  // the exact drift this function exists to prevent.
  if (movement.examination) {
    return `${movement.id} was already examined.`;
  }
  return undefined;
}

/** Mirrors `case "HANDOVER_READY"` exactly: the only precondition is stage `bed_held`. */
function handoverBlockedReason(movement: Movement): string | undefined {
  if (movement.stage !== "bed_held") {
    return `${movement.id} is ${stageCopy[movement.stage].label.toLowerCase()}, not bed held — a handover can only be marked ready once a bed is held.`;
  }
  return undefined;
}

/**
 * Mirrors `case "BOOK_TRANSPORT"` in the reducer, in the reducer's own order, so this control can
 * never advertise a booking the reducer would refuse — the same discipline `handoverBlockedReason`
 * above and `ward-screen.tsx`'s `*BlockedReason` functions already hold to. The closure check the
 * reducer makes first has no counterpart here because `patients` has already excluded every closed
 * movement before a card is rendered.
 *
 * ⚠️ **THE ESCORT ANSWER IS DELIBERATELY NOT CHECKED HERE.** This function answers "may this
 * movement be booked at all", which is a fact about the MOVEMENT. Whether the person has answered
 * the escort question is a fact about a half-filled form, and is checked by
 * `transportAnswersBlockedReason` at the confirm control instead. One message standing for both
 * would tell somebody a patient cannot be transported when in truth they have not finished asking.
 */
function bookTransportBlockedReason(movement: Movement): string | undefined {
  if (movement.stage !== "bed_held") {
    return `${movement.id} is ${stageCopy[movement.stage].label.toLowerCase()}, not bed held — transport can only be booked once a bed is held.`;
  }
  // The reducer refuses a second booking because it would replace a job a provider may already
  // have accepted and take the acceptance timestamps with it. Reachable on this screen the moment
  // a booking succeeds: `BOOK_TRANSPORT` leaves the movement at `bed_held`, so the card that just
  // booked re-renders with the control unavailable rather than offering a replacement.
  if (movement.transport) {
    return `${movement.id} already has transport booked. Booking again would replace a job the provider may already have accepted, and take its timestamps with it — an existing job has to be cancelled before a new one can be booked.`;
  }
  return undefined;
}

/**
 * ⚠️ **THE ESCORT QUESTION OPENS BLANK, AND NOTHING ANYWHERE SUPPLIES AN ANSWER FOR IT** (owner,
 * relayed 2026-08-30). Not from `legalStatus`, not from the last booking, not as a "usually".
 *
 * **His reason is that a pre-filled clinical judgement is answered by clicking past it**, and the
 * record then asserts that a clinician decided when nobody did — worse than the honest derivation
 * it replaces, because it launders an automatic value through a human's name. `HANDOVER_READY`
 * still computes `movement.legalStatus !== "Voluntary"` today; that is the defect this control
 * exists to end, and re-creating it as a default here would move it rather than end it.
 *
 * **If this control ever feels unhelpful for being blank, the help is the question being legible,
 * never the answer being supplied.**
 *
 * The reducer refuses a missing answer independently (`case "BOOK_TRANSPORT"`), so this is not the
 * only thing holding the rule — and it must never contradict it either: every state this function
 * calls blocked is a state the reducer would reject.
 */
const ESCORT_ANSWERS = [
  { value: true, label: "Escort required" },
  { value: false, label: "No escort required" },
] as const;

type TransportDraftState = {
  /** `undefined` until somebody picks. Never `TRANSPORT_PROVIDERS[0]`: a provider nobody chose,
   *  rendered as "Ambulance service is collecting", is the same unmade-claim defect as a pre-filled
   *  escort answer, and the reducer's membership check refuses the blank rather than this alone. */
  provider: TransportProvider | undefined;
  /** `undefined` until answered — see `ESCORT_ANSWERS`. Never `false`: `false` is an ANSWER. */
  escortRequired: boolean | undefined;
};

/** Re-applied every time the panel is opened as well as when it closes, so a previous booking's
 *  answers can never be inherited by the next patient. A remembered last value is the same ruling
 *  as a derived one. */
const BLANK_TRANSPORT_DRAFT: TransportDraftState = { provider: undefined, escortRequired: undefined };

/** The `<option>` value standing for "nobody chosen yet", for the same reason
 *  `NO_LEGAL_FORM_VALUE` above exists: a `<select>` option value is always a string. */
const NO_TRANSPORT_PROVIDER_VALUE = "";

/**
 * Why the confirm control is unavailable, or `undefined` when the booking is answerable. Pure and
 * module-level so all four states can be asserted without rendering, and so the wording lives in
 * one place rather than being spelled twice inside JSX.
 */
function transportAnswersBlockedReason(draft: TransportDraftState): string | undefined {
  const missing: string[] = [];
  if (draft.provider === undefined) missing.push("choose who is collecting the patient");
  if (draft.escortRequired === undefined) missing.push("answer the escort question");
  if (missing.length === 0) return undefined;
  return `Before booking, ${missing.join(" and ")}. Neither is filled in for you: the record has to say that this team decided.`;
}

type OutstandingItem = { kind: "handover" | "transport" | "examination" | "form"; label: string; detail: string };

/**
 * The single outstanding item spec §7 asks for — a form, an examination, a transport request,
 * or handover — never more than one at once. Ordered by the movement's actual live stage first,
 * not by which fact is clinically "biggest" in the abstract: WF-005 (re-measured against this
 * branch's fixture, see the task report) carries an un-examined Form 1A AND an already-accepted
 * transport job. Showing "Examination" for it would bury the operational truth — a vehicle is
 * right now waiting to depart — behind a fact that has been sitting unresolved for hours without
 * blocking anything. Stage governs first; the examination gap only surfaces here once the
 * movement is not already at `bed_held`/`handover_ready`/`moving`, i.e. once nothing more urgent
 * is already in motion.
 *
 * Reads only `movement.stage`, `movement.transport` and `movement.legalForm`/`.examination` —
 * never `ED_ACCESS_TARGET_MINUTES`, and never writes a `dueAt` anywhere (see that constant's own
 * doc comment and Task 6A).
 */
function outstandingItem(movement: Movement): OutstandingItem {
  if (movement.stage === "bed_held") {
    return { kind: "handover", label: "Handover", detail: "Bed held — ready to mark the handover to transport." };
  }
  if (movement.stage === "handover_ready" || movement.stage === "moving") {
    const leg = transportLeg(movement.transport);
    const detail = leg === undefined ? "Not yet requested" : leg;
    return { kind: "transport", label: "Transport", detail };
  }
  // NEITHER branch below infers anything from the form code. Until 2026-08-24 this read
  // `legalForm?.code === "1A" && examination === undefined` and printed "Referred for
  // examination" — a claim about what a Form 1A means, which this software is no longer entitled
  // to make and which the picker can now contradict outright: a Voluntary patient the clinician
  // puts on a 1A would have been labelled "Referred for examination". Both lines now state only
  // what the record holds, and the examination line keys off the examination record itself
  // rather than off any form.
  if (movement.examination === undefined) {
    return {
      kind: "examination",
      label: "Examination",
      detail: "No examination outcome recorded for this movement.",
    };
  }
  const outcomeWords = movement.examination.outcome.replace(/_/g, " ");
  if (movement.legalForm) {
    // `legalFormName` resolves the official title from the code, and shows a code the register
    // does not list as the bare code.
    return {
      kind: "form",
      label: "Form",
      detail: `${legalFormName(movement.legalForm)} · examination recorded (${outcomeWords}).`,
    };
  }
  return {
    kind: "form",
    label: "Form",
    detail: `No legal form recorded for this movement · examination recorded (${outcomeWords}).`,
  };
}

/** Whether `formedAt` genuinely predates `openedAt` — the only condition under which the legal
 * clock and the department clock diverge (spec §3). */
function isCommunityFormed(movement: Movement): boolean {
  return movement.formedAt !== undefined && movement.formedAt < movement.openedAt;
}

/** The legal clock's own reference instant: `formedAt` where that is earlier than `openedAt`,
 * otherwise `openedAt` itself — so the two clocks coincide rather than diverge when there is
 * nothing to diverge from. Never earlier than by construction, so the legal clock can never
 * read as running from a LATER instant than the department clock. */
function legalClockReference(movement: Movement): Instant {
  return isCommunityFormed(movement) ? (movement.formedAt as Instant) : movement.openedAt;
}

/**
 * `ED_ACCESS_TARGET_MINUTES` is a departmental performance measure, counted UP from
 * `movement.openedAt` — never a legal deadline. This function's only inputs are `now` and
 * `movement.openedAt`; it never reads `movement.legalForm`, never constructs a `{code, label,
 * kind}` object, and never writes a `dueAt` anywhere (see the constant's own doc comment and
 * Task 6A — the seven-surface incident this whole task exists to not repeat). Wording is
 * deliberately free of "due", "deadline", "breach", "overdue" and "legal" — every one of those
 * words on this figure would let it be misread as the thing Task 6A deleted.
 */
function accessTargetLine(minutesInDepartment: number): string {
  const over = minutesInDepartment - ED_ACCESS_TARGET_MINUTES;
  const targetLabel = splitDuration(ED_ACCESS_TARGET_MINUTES);
  if (over > 0) return `${splitDuration(over)} over the ${targetLabel} departmental access target`;
  return `${splitDuration(Math.abs(over))} under the ${targetLabel} departmental access target`;
}

/**
 * Task 11: one emergency department's own view — its own patients, both clocks, the
 * departmental access target, and the single outstanding item for each. Never the coordinator's
 * statewide queue, shortlist or flow diagram filtered down (spec §7 says so explicitly).
 *
 * Resolved via `edById` (Task 9's addition to `ward-sites.ts`); an id that resolves to nothing
 * renders an explicit empty state naming the id (Global Constraint, addendum R40 — the same rule
 * `ward-screen.tsx` and `officer-screen.tsx`'s unit/department lookups already follow), never a
 * substituted department.
 */
export function EdScreen({ edId }: EdScreenProps) {
  const { movements, units, bedReleases, referrals, now, dispatch } = useWardFlow();
  const department = edById(edId);

  // Declared unconditionally, before the early return below — React hooks must run in the same
  // order on every render, the same discipline `ward-screen.tsx` holds to for its own hooks.
  const [referralOpen, setReferralOpen] = useState(false);
  const [draft, setDraft] = useState<ReferralDraftState>(DEFAULT_DRAFT);
  const [examinationOpenFor, setExaminationOpenFor] = useState<string | undefined>(undefined);
  const [examinationOutcome, setExaminationOutcome] = useState<
    "inpatient_order" | "community_order" | "revoked" | undefined
  >(undefined);
  // Task 2: urgency and legal status can change mid-flight. Both a coordinator and the referring
  // ED clinician may make either change (`EVENT_ROLE.CHANGE_URGENCY`/`CHANGE_LEGAL_STATUS`), so
  // this screen dispatches as role "ed" — the shortlist panel's own control dispatches as
  // "coordinator". Each control keeps its own open-for/draft state, the same shape the
  // examination toggle above already uses.
  const [urgencyChangeOpenFor, setUrgencyChangeOpenFor] = useState<string | undefined>(undefined);
  const [urgencyDraft, setUrgencyDraft] = useState<{ urgency: 1 | 2 | 3; reason: UrgencyChangeReason }>({
    urgency: 1,
    reason: URGENCY_CHANGE_REASONS[0],
  });
  const [legalStatusChangeOpenFor, setLegalStatusChangeOpenFor] = useState<string | undefined>(undefined);
  const [legalStatusDraft, setLegalStatusDraft] = useState<{
    legalStatus: LegalStatus;
    reason: LegalStatusChangeReason;
  }>({ legalStatus: "Voluntary", reason: LEGAL_STATUS_CHANGE_REASONS[0] });
  // `TR-D1`: the sending team books the transport out, and this department is the sending team for
  // its own patients. One open-for id and one draft, the same shape the three toggles above use —
  // only one panel is open at a time, so one draft cannot be read against the wrong patient. The
  // draft starts BLANK and is reset to blank on every toggle; see `ESCORT_ANSWERS`.
  const [transportOpenFor, setTransportOpenFor] = useState<string | undefined>(undefined);
  const [transportDraft, setTransportDraft] = useState<TransportDraftState>(BLANK_TRANSPORT_DRAFT);

  if (!department) {
    return (
      <div className={styles.screen} data-testid="ward-ed-screen">
        <ClinicalRail />
        <main id="main-content" className={styles.main}>
          <h1 className={styles.notFoundHeading}>Emergency department not found</h1>
          <p className={styles.notFoundBody} data-testid="ward-ed-unresolved">
            No synthetic emergency department matches &ldquo;{edId}&rdquo;. It may have been renamed or removed, or the
            id in the address is incorrect — this never falls back to a different department.
          </p>
        </main>
      </div>
    );
  }

  const site = siteByCode(department.siteCode);
  // TypeScript's narrowing of `department` above does not reach into `submitReferral`'s closure
  // further down (the same reason `ward-screen.tsx`'s `wardUnitId` exists) — this plain string is
  // what it closes over instead.
  const thisEdId = department.id;

  // Its own patients only, and only while still open — an arrived or otherwise closed movement
  // has left the department (see `isOpen`'s own doc comment); this screen is about who is here
  // now, not a historical log.
  const patients = movements.filter(
    (movement) => movement.originEdId === thisEdId && !movement.closure && movement.stage !== "arrived",
  );

  /**
   * THE INBOX. Two fields, never one — `edId` AND `purpose`.
   *
   * ⚠️ A ward→ED medical notification carries the SAME `edId` as psychiatry's own review request:
   * both are about a patient in this department, raised by parties at this hospital. `purpose` is
   * the only thing keeping them apart, and `originSiteCode` — the inference that looks right and is
   * wrong on exactly this case — is not read here or in `edReferralsFor`.
   */
  const inbox = edReferralsFor(referrals, thisEdId, "psychiatric_review");

  /**
   * THE OUTBOX: patients this team referred onward who are STILL HERE.
   *
   * Filtered from `patients` above rather than from `movements` again, so it inherits that array's
   * own definition of who is present (this department's, still open, not yet arrived) instead of
   * restating it — two filters spelling one rule is how two lists come to disagree about who is in
   * the building.
   *
   * `acceptedUnitId` is the marker for "referred on and taken", and it is set from
   * `accepted_awaiting_bed` onward. A patient whose placement is still being requested or reviewed
   * has not been referred onward yet, and one who has `arrived` has left — `patients` already
   * excludes them. **No stage is treated as finished with**: a held bed and a booked handover are
   * both still jobs this team owes.
   */
  const outbox = patients.filter((movement) => movement.acceptedUnitId !== undefined);

  function submitReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: "RAISE_REFERRAL", role: "ed", now, edId: thisEdId, draft });
    setDraft(DEFAULT_DRAFT);
    setReferralOpen(false);
  }

  function toggleExamination(movementId: string) {
    setExaminationOpenFor((current) => (current === movementId ? undefined : movementId));
    setExaminationOutcome(undefined);
  }

  function submitExamination(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!examinationOutcome) return;
    dispatch({ type: "RECORD_EXAMINATION", role: "ed", now, movementId, outcome: examinationOutcome });
    setExaminationOpenFor(undefined);
    setExaminationOutcome(undefined);
  }

  function toggleUrgencyChange(movementId: string, currentUrgency: 1 | 2 | 3) {
    setUrgencyChangeOpenFor((current) => (current === movementId ? undefined : movementId));
    setUrgencyDraft({ urgency: currentUrgency, reason: URGENCY_CHANGE_REASONS[0] });
  }

  function submitUrgencyChange(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    dispatch({
      type: "CHANGE_URGENCY",
      role: "ed",
      now,
      movementId,
      urgency: urgencyDraft.urgency,
      reason: urgencyDraft.reason,
    });
    setUrgencyChangeOpenFor(undefined);
  }

  function toggleLegalStatusChange(movementId: string, currentLegalStatus: LegalStatus) {
    setLegalStatusChangeOpenFor((current) => (current === movementId ? undefined : movementId));
    setLegalStatusDraft({ legalStatus: currentLegalStatus, reason: LEGAL_STATUS_CHANGE_REASONS[0] });
  }

  function submitLegalStatusChange(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    dispatch({
      type: "CHANGE_LEGAL_STATUS",
      role: "ed",
      now,
      movementId,
      legalStatus: legalStatusDraft.legalStatus,
      reason: legalStatusDraft.reason,
    });
    setLegalStatusChangeOpenFor(undefined);
  }

  function toggleBookTransport(movementId: string) {
    setTransportOpenFor((current) => (current === movementId ? undefined : movementId));
    // ⚠️ **BLANKED ON EVERY OPEN, NOT ONLY ON EVERY CLOSE.** Carrying the previous patient's
    // answers into the next panel would be a remembered value standing in for an unmade decision —
    // the same ruling as a derived one, and harder to see because it was true once.
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
  }

  function submitBookTransport(movementId: string) {
    const { provider, escortRequired } = transportDraft;
    // Never dispatched half-answered. The reducer would refuse it — that refusal is the rule's
    // real home — but a refusal raised from here would be invisible to whoever pressed the button,
    // so the control declines to advertise a booking it knows would be rejected.
    if (provider === undefined || escortRequired === undefined) return;
    dispatch({ type: "BOOK_TRANSPORT", role: "ed", now, movementId, provider, escortRequired });
    setTransportOpenFor(undefined);
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
  }

  return (
    <div className={styles.screen} data-testid="ward-ed-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-ed-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This is {department.name}&apos;s own view. The 24-hour figure below is this department&apos;s own access
            target — a performance measure it is judged on, not a Mental Health Act deadline. No bed is ever allocated
            automatically; a human here confirms every step.
          </p>
        </div>

        <header className={styles.unitCard} data-testid={`ward-ed-card-${department.id}`}>
          <h1 className={styles.unitName}>{department.name}</h1>
          <p className={styles.unitMeta}>{site ? `${site.name} (${site.code})` : department.siteCode}</p>
        </header>

        {/*
         * THE INBOX — referrals addressed to THIS department's psychiatry team, still unanswered.
         *
         * The count and the list read the SAME array (`inbox`), which is why they cannot disagree:
         * there is one array, counted and mapped, never a length recomputed beside a filtered list.
         * Same discipline as `queueStageSummaries` on the network board.
         */}
        <section aria-label="Psychiatry inbox" className={styles.listSection} data-testid="ward-ed-inbox">
          <h2 className={styles.sectionHeading}>
            Psychiatry inbox &middot; {inbox.length} referral{inbox.length === 1 ? "" : "s"}
          </h2>
          <p className={styles.unitMeta}>
            Referrals addressed to psychiatry at {department.name}, oldest referral first. Every row carries two clocks:
            how long the person has been in the department, and how long since the referral to mental health. The gap
            between them says whether a delay sits upstream of this team or with it. The department clock runs from
            triage, which is the earliest moment the record holds — somebody may have been in the department for a while
            before being triaged — and a person who is not in the department yet has no department clock at all.
          </p>
          {inbox.length === 0 ? (
            <p className={styles.placeholder} data-testid="ward-ed-inbox-empty">
              No referral is addressed to psychiatry at {department.name}. A referral reaches this list only when it
              names this department AND asks for psychiatric review — a request to the same department for a bed, or
              about a medical problem, is a different thing and is not shown here.
            </p>
          ) : (
            <ul className={styles.cardList}>
              {inbox.map(({ referral, destination }) => {
                // ONE call, on the provider's `now` — see this file's own note above on why the two
                // figures below may never come from two readings.
                const clocks = referralClocks(referral, now);
                const lines = edReferralClockLines(clocks);
                return (
                  <li
                    key={`${referral.id}-${destination.edId}-${destination.purpose}`}
                    className={styles.card}
                    data-testid={`ward-ed-inbox-row-${referral.id}`}
                    data-purpose={destination.purpose}
                    data-ed-id={destination.edId}
                    data-minutes-since-referral={clocks.sinceReferral}
                    data-since-referral-running={clocks.sinceReferralRunning ? "true" : "false"}
                    data-minutes-in-department={clocks.inDepartment}
                  >
                    <header className={styles.cardHeader}>
                      <strong>{referral.id}</strong>
                      {/*
                       * ⚠️ THE PURPOSE, IN WORDS, ON EVERY ROW — the `FD-18` correction's own
                       * requirement and not a caption. Since every referral is declinable, what a row
                       * is FOR is the only thing telling these flows apart; a declinable row with no
                       * stated purpose is indistinguishable from a bed request.
                       */}
                      <span className={styles.cardMeta} data-testid={`ward-ed-inbox-purpose-${referral.id}`}>
                        {referralPurposeLabel(destination.purpose)}
                      </span>
                    </header>
                    <p className={styles.cardMeta}>{referralPersonFacts(referral).join(" · ")}</p>
                    {/* Both clocks in one list, at equal visual weight — the same `clockGrid` the
                      patients section below uses, because neither number is subordinate to the
                      other and the gap between them is the thing worth reading. */}
                    <dl className={styles.clockGrid} data-testid={`ward-ed-inbox-clocks-${referral.id}`}>
                      <div className={styles.clockRow} data-testid={`ward-ed-inbox-department-clock-${referral.id}`}>
                        <dt>{lines.department.term}</dt>
                        <dd>{lines.department.value}</dd>
                      </div>
                      <div className={styles.clockRow} data-testid={`ward-ed-inbox-referral-clock-${referral.id}`}>
                        <dt>{lines.referral.term}</dt>
                        <dd>{lines.referral.value}</dd>
                      </div>
                    </dl>
                    {/*
                     * The decline control is UNAVAILABLE, with the reason stated — never absent, and
                     * never a native `disabled` (which removes the tab stop the reason is announced
                     * from), and never both attributes, which is the shape `require-button-wiring`
                     * fails.
                     *
                     * ⚠️ **IT IS NOT ABSENT BECAUSE OF ANY RULE ABOUT WHAT MAY BE DECLINED.** Every
                     * referral is declinable — the superseded `FD-3` guard said otherwise and was
                     * reversed. It is unavailable because `EVENT_ROLE.DECLINE_REFERRAL` is
                     * `["ward", "coordinator"]` and this screen acts as `"ed"`, so a wired control
                     * here would be silently refused by the reducer. Dispatching as `"ward"` to make
                     * it work would record `decidedBy: "Ward manager"` against a decision ED
                     * psychiatry made, which is the false entry that field exists to prevent.
                     */}
                    <button
                      type="button"
                      className={styles.declineButton}
                      data-testid={`ward-ed-inbox-decline-${referral.id}`}
                      aria-disabled="true"
                      aria-describedby={DECLINE_UNAVAILABLE_REASON_ID}
                      title="Decline — coming soon"
                      onClick={ignoreUnavailableActivation}
                    >
                      Decline
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {inbox.length === 0 ? null : (
            <p className={styles.placeholder} id={DECLINE_UNAVAILABLE_REASON_ID}>
              {DECLINE_UNAVAILABLE_REASON}
            </p>
          )}
        </section>

        {/*
         * THE OUTBOX — seen, referred on, and STILL TO BE MOVED.
         *
         * ⚠️ **THIS IS A WORKLIST, NOT A RECORD OF WHAT WAS DONE**, and reading it the other way is
         * the mistake the spec's own section exists to prevent (`TR-D3`). For an ED patient going to
         * a ward, the ED psychiatry team IS the sending team (`TR-D1`), so a patient stays here
         * until they physically leave — an accepted bed is the middle of this job, never the end of
         * it.
         *
         * Derived from `patients` — the very array the section below renders — so the outbox can
         * never contain somebody that screen says is not here.
         *
         * ⚠️ **THIS PARAGRAPH USED TO SAY THERE WAS NO BOOKING EVENT TO WIRE A CONTROL TO, AND
         * THAT WAS TRUE UNTIL `BOOK_TRANSPORT` LANDED.** It is false now, so it goes rather than
         * sitting next to a control that exists.
         *
         * **The booking control is on the patients section below, not here.** Both it and "Mark
         * handover ready" are gated on stage `bed_held`, and that section is where a card's stage
         * and its actions already live. This list is keyed on `acceptedUnitId`, which is set from
         * `accepted_awaiting_bed` onward and stays set through `moving` — so a booking control on
         * these rows would be unavailable on most of them, and the same patient would carry two
         * controls for one job.
         */}
        <section aria-label="Psychiatry outbox" className={styles.listSection} data-testid="ward-ed-outbox">
          <h2 className={styles.sectionHeading}>
            Still to be moved &middot; {outbox.length} patient{outbox.length === 1 ? "" : "s"}
          </h2>
          <p className={styles.unitMeta}>
            Patients this team has referred onward who are still in {department.name}. This department is the sending
            team, so each of these is still owed a move — the job stays here until the patient physically leaves, not
            until a bed is accepted. These rows are movements, not referrals, so the two referral clocks above do not
            apply to them: how long a move has been owed is counted from the acceptance itself, and an acceptance the
            fixture was hand-authored with carries no time to count from.
          </p>
          {outbox.length === 0 ? (
            <p className={styles.placeholder} data-testid="ward-ed-outbox-empty">
              No patient here is waiting to be moved onward.
            </p>
          ) : (
            <ul className={styles.cardList}>
              {outbox.map((movement) => {
                // Resolved from the live `units`, never `unitById` — whole-branch review Critical 1,
                // the same correction the patients section below already carries.
                const acceptedUnit = units.find((unit) => unit.id === movement.acceptedUnitId);
                return (
                  <li
                    key={movement.id}
                    className={styles.card}
                    data-testid={`ward-ed-outbox-row-${movement.id}`}
                    data-stage={movement.stage}
                  >
                    <header className={styles.cardHeader}>
                      <strong>{movement.id}</strong>
                      <span className={styles.cardMeta}>{stageCopy[movement.stage].label}</span>
                    </header>
                    <p className={styles.cardMeta}>
                      {movement.cohort} &middot; {movement.security} &middot; {movement.sex} &middot;{" "}
                      {movement.legalStatus}
                    </p>
                    <div className={styles.outstandingItem}>
                      <span className={styles.outstandingLabel}>Going to</span>
                      {/* The unit's own name, or an honest statement that this state cannot name
                          one — never a substituted unit and never a bare id. */}
                      <span>{acceptedUnit ? acceptedUnit.name : "Accepted unit not resolved"}</span>
                    </div>
                    {/*
                     * ⚠️ **NOT A REFERRAL CLOCK, AND `referralClocks` MUST NEVER BE REACHED FOR
                     * HERE.** This row is a `Movement`; `triagedAt` lives on a `Referral` and
                     * nothing joins the two. What a move being owed is counted from is
                     * `acceptedAt`, which `ACCEPT_IN_PRINCIPLE` writes and which is deliberately
                     * absent from every hand-authored movement in the seed — so a seeded row
                     * still states the absence, and only the absence, in the same register the
                     * rest of the board uses for a fact it does not hold. Substituting
                     * `openedAt` here would answer a different question (how long they have been
                     * in the department) under this label, and read as plausible while doing it.
                     */}
                    <div className={styles.outstandingItem}>
                      <span className={styles.outstandingLabel}>Waiting to move</span>
                      <span>
                        {movement.acceptedAt === undefined
                          ? "Acceptance time not recorded"
                          : `${splitDuration(Math.max(now - movement.acceptedAt, 0))} since accepted`}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Raise a referral" className={styles.listSection}>
          <h2 className={styles.sectionHeading}>Raise a referral</h2>
          {!referralOpen ? (
            <button
              type="button"
              data-testid="ward-ed-raise-referral-toggle"
              className={styles.acceptButton}
              onClick={() => setReferralOpen(true)}
            >
              Raise referral
            </button>
          ) : (
            <form className={styles.referralForm} onSubmit={submitReferral} data-testid="ward-ed-referral-form">
              <div className={styles.referralGrid}>
                <label className={styles.referralField}>
                  Cohort
                  <select
                    data-testid="ward-ed-referral-cohort"
                    value={draft.cohort}
                    onChange={(event) => setDraft((current) => ({ ...current, cohort: event.target.value as Cohort }))}
                  >
                    {COHORT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.referralField}>
                  Security
                  <select
                    value={draft.security}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, security: event.target.value as Security }))
                    }
                  >
                    {SECURITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.referralField}>
                  Sex
                  <select
                    value={draft.sex}
                    onChange={(event) => setDraft((current) => ({ ...current, sex: event.target.value as Sex }))}
                  >
                    {SEX_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.referralField}>
                  Legal status
                  <select
                    value={draft.legalStatus}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, legalStatus: event.target.value as LegalStatus }))
                    }
                  >
                    {LEGAL_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.referralField}>
                  Legal form
                  <select
                    data-testid="ward-ed-referral-legal-form"
                    value={draft.legalFormCode ?? NO_LEGAL_FORM_VALUE}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        legalFormCode: event.target.value === NO_LEGAL_FORM_VALUE ? null : event.target.value,
                      }))
                    }
                  >
                    <option value={NO_LEGAL_FORM_VALUE}>No form</option>
                    {SELECTABLE_LEGAL_FORMS.map((form) => (
                      <option key={form.code} value={form.code}>
                        {legalFormName(form)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.referralField}>
                  Urgency
                  <select
                    data-testid="ward-ed-referral-urgency"
                    value={draft.urgency}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, urgency: Number(event.target.value) as 1 | 2 | 3 }))
                    }
                  >
                    {/* The option TEXT carries the tier's direction, the option VALUE stays the bare
                        tier — so `Movement["urgency"]`, the change handler above and every test
                        reading option values are unchanged. This picker rendered "1", "2", "3" with
                        nothing saying which end is urgent — and a clinician reading the bigger number
                        as "most urgent" files the LEAST urgent referral for the sickest patient.
                        Urgency outranks everything in the queue, so that error sorts the patient to
                        the bottom and no later screen contradicts it. Labelled from
                        `urgencyTierLabel`, the same export the boards read the field back with. */}
                    {URGENCY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {urgencyTierLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.referralCheckbox}>
                  <input
                    type="checkbox"
                    checked={draft.specialling}
                    onChange={(event) => setDraft((current) => ({ ...current, specialling: event.target.checked }))}
                  />
                  Specialling required
                </label>
              </div>
              <div className={styles.actionRow}>
                <button type="submit" data-testid="ward-ed-referral-submit" className={styles.acceptButton}>
                  Raise referral
                </button>
                <button
                  type="button"
                  className={styles.declineButton}
                  onClick={() => {
                    setReferralOpen(false);
                    setDraft(DEFAULT_DRAFT);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        <section aria-label="This department's patients" className={styles.listSection}>
          <h2 className={styles.sectionHeading}>
            {department.name} &middot; {patients.length} patient{patients.length === 1 ? "" : "s"}
          </h2>
          {patients.length === 0 ? (
            <p className={styles.placeholder}>No patient is currently open at {department.name}.</p>
          ) : (
            <ul className={styles.cardList}>
              {patients.map((movement) => {
                const minutesInDepartment = Math.max(now - movement.openedAt, 0);
                const communityFormed = isCommunityFormed(movement);
                const minutesLegalClock = Math.max(now - legalClockReference(movement), 0);
                const item = outstandingItem(movement);
                const examBlocked = examinationBlockedReason(movement);
                const handoverBlocked = handoverBlockedReason(movement);
                const transportBlocked = bookTransportBlockedReason(movement);
                const transportOpen = transportOpenFor === movement.id;
                const transportAnswersBlocked = transportAnswersBlockedReason(transportDraft);
                const examOpen = examinationOpenFor === movement.id;
                const urgencyChangeOpen = urgencyChangeOpenFor === movement.id;
                const legalStatusChangeOpen = legalStatusChangeOpenFor === movement.id;
                // Whole-branch review Critical 1: resolved from the live `units`, not `unitById`.
                const acceptedUnit = movement.acceptedUnitId
                  ? units.find((unit) => unit.id === movement.acceptedUnitId)
                  : undefined;

                return (
                  <li
                    key={movement.id}
                    data-testid={`ward-ed-patient-${movement.id}`}
                    data-origin-ed={movement.originEdId}
                    data-community-formed={communityFormed ? "true" : undefined}
                    data-minutes-in-department={minutesInDepartment}
                    data-minutes-legal-clock={minutesLegalClock}
                    className={styles.card}
                  >
                    <header className={styles.cardHeader}>
                      <strong>{movement.id}</strong>
                      <span className={styles.cardMeta}>
                        {movement.cohort} &middot; {movement.security} &middot; {movement.sex} &middot;{" "}
                        {movement.legalStatus}
                      </span>
                    </header>

                    {movement.arrivalMode === "police" ? (
                      <span className={styles.policeFlag} data-testid={`ward-ed-police-${movement.id}`}>
                        Police in attendance
                      </span>
                    ) : null}

                    <dl className={styles.clockGrid}>
                      <div className={styles.clockRow}>
                        <dt>Time in department</dt>
                        <dd>{elapsedLabel(movement, now)}</dd>
                      </div>
                      <div className={styles.clockRow} data-testid={`ward-ed-legal-clock-${movement.id}`}>
                        <dt>Legal clock</dt>
                        <dd>
                          {splitDuration(minutesLegalClock)} since {communityFormed ? "formed" : "opened"}
                        </dd>
                      </div>
                      <div
                        className={styles.clockRow}
                        data-testid={`ward-ed-access-target-${movement.id}`}
                        data-state={minutesInDepartment > ED_ACCESS_TARGET_MINUTES ? "over" : "under"}
                      >
                        <dt>Departmental access target</dt>
                        <dd>{accessTargetLine(minutesInDepartment)}</dd>
                      </div>
                    </dl>

                    <p className={styles.referralState}>
                      {acceptedUnit
                        ? `Accepted at ${acceptedUnit.name}`
                        : movement.referredUnitIds.length > 0
                          ? `Referred to ${movement.referredUnitIds.length} unit${movement.referredUnitIds.length === 1 ? "" : "s"}`
                          : stageCopy[movement.stage].label}
                    </p>

                    <p
                      className={styles.outstandingItem}
                      data-testid={`ward-ed-outstanding-${movement.id}`}
                      data-kind={item.kind}
                    >
                      <span className={styles.outstandingLabel}>{item.label}</span>
                      {" — "}
                      {item.detail}
                    </p>

                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        data-testid={`ward-ed-examine-toggle-${movement.id}`}
                        aria-disabled={examBlocked ? "true" : undefined}
                        aria-describedby={examBlocked ? `ward-ed-examine-unavailable-${movement.id}` : undefined}
                        title={examBlocked ?? undefined}
                        aria-expanded={examOpen}
                        className={styles.declineButton}
                        onClick={examBlocked ? ignoreUnavailableActivation : () => toggleExamination(movement.id)}
                      >
                        Record examination
                      </button>
                      <button
                        type="button"
                        data-testid={`ward-ed-handover-${movement.id}`}
                        aria-disabled={handoverBlocked ? "true" : undefined}
                        aria-describedby={handoverBlocked ? `ward-ed-handover-unavailable-${movement.id}` : undefined}
                        title={handoverBlocked ?? undefined}
                        className={styles.acceptButton}
                        onClick={
                          handoverBlocked
                            ? ignoreUnavailableActivation
                            : () => dispatch({ type: "HANDOVER_READY", role: "ed", now, movementId: movement.id })
                        }
                      >
                        Mark handover ready
                      </button>
                      {/*
                       * ⚠️ **THE BOOKING CONTROL — `TR-D1`, and it sits beside the handover control
                       * because the two share one precondition: stage `bed_held`.**
                       *
                       * It dispatches as `"ed"`, which `EVENT_ROLE.BOOK_TRANSPORT` (`["ed", "ward"]`)
                       * permits. **The coordinator is refused by name and that asymmetry is not a
                       * bug**: booking needs knowledge of the patient in front of you, which the bed
                       * coordinator does not have, while `CANCEL_TRANSPORT` — which the coordinator
                       * MAY raise — needs a view of the whole network to notice a job that has
                       * become wrong. Nothing here should be "fixed" to make the two match.
                       *
                       * Unavailable the repo way — `aria-disabled` plus an inert handler plus a
                       * reason reachable by keyboard — never the native attribute, which would take
                       * the tab stop away from the very reason it is unavailable, and never both.
                       */}
                      <button
                        type="button"
                        data-testid={`ward-ed-book-transport-toggle-${movement.id}`}
                        aria-disabled={transportBlocked ? "true" : undefined}
                        aria-describedby={
                          transportBlocked ? `ward-ed-book-transport-unavailable-${movement.id}` : undefined
                        }
                        title={transportBlocked ?? undefined}
                        aria-expanded={transportOpen}
                        className={styles.acceptButton}
                        onClick={
                          transportBlocked ? ignoreUnavailableActivation : () => toggleBookTransport(movement.id)
                        }
                      >
                        Book transport
                      </button>
                      <button
                        type="button"
                        data-testid={`ward-change-urgency-toggle-${movement.id}`}
                        aria-expanded={urgencyChangeOpen}
                        className={styles.declineButton}
                        onClick={() => toggleUrgencyChange(movement.id, movement.urgency)}
                      >
                        Change urgency
                      </button>
                      <button
                        type="button"
                        data-testid={`ward-change-legal-status-toggle-${movement.id}`}
                        aria-expanded={legalStatusChangeOpen}
                        className={styles.declineButton}
                        onClick={() => toggleLegalStatusChange(movement.id, movement.legalStatus)}
                      >
                        Change legal status
                      </button>
                    </div>
                    {examBlocked ? (
                      <span id={`ward-ed-examine-unavailable-${movement.id}`} className="sr-only">
                        {examBlocked}
                      </span>
                    ) : null}
                    {handoverBlocked ? (
                      <span id={`ward-ed-handover-unavailable-${movement.id}`} className="sr-only">
                        {handoverBlocked}
                      </span>
                    ) : null}
                    {transportBlocked ? (
                      <span id={`ward-ed-book-transport-unavailable-${movement.id}`} className="sr-only">
                        {transportBlocked}
                      </span>
                    ) : null}

                    {/*
                     * ⚠️ **DELIBERATELY NOT A `<form>`, unlike the four panels around it.** A form
                     * submits on Enter from inside a field whatever its submit button advertises, so
                     * an `aria-disabled` submit — which, unlike the native attribute, stays fully
                     * operable — would let a half-answered booking through by keyboard while the
                     * screen said it could not. The reducer would refuse it and the refusal would be
                     * silent. With no form there is no implicit submission to bypass anything.
                     */}
                    {transportOpen && !transportBlocked ? (
                      <div className={styles.declineForm} data-testid={`ward-ed-book-transport-${movement.id}`}>
                        <label className={styles.referralField} htmlFor={`ward-ed-transport-provider-${movement.id}`}>
                          Who is collecting {movement.id}
                          <select
                            id={`ward-ed-transport-provider-${movement.id}`}
                            data-testid={`ward-ed-transport-provider-${movement.id}`}
                            value={transportDraft.provider ?? NO_TRANSPORT_PROVIDER_VALUE}
                            onChange={(event) =>
                              setTransportDraft((current) => ({
                                ...current,
                                provider:
                                  event.target.value === NO_TRANSPORT_PROVIDER_VALUE
                                    ? undefined
                                    : (event.target.value as TransportProvider),
                              }))
                            }
                          >
                            {/* Nobody chosen, first and selected — never a provider standing in for
                                a choice not made. */}
                            <option value={NO_TRANSPORT_PROVIDER_VALUE}>Not chosen</option>
                            {/* Derived from `TRANSPORT_PROVIDERS`, never hand-listed: a hand-written
                                options array is how the ED cohort picker silently omitted Youth
                                (see `COHORT_OPTIONS` above). */}
                            {TRANSPORT_PROVIDERS.map((provider) => (
                              <option key={provider} value={provider}>
                                {provider}
                              </option>
                            ))}
                          </select>
                        </label>
                        <fieldset
                          className={styles.declineFieldset}
                          data-testid={`ward-ed-transport-escort-${movement.id}`}
                        >
                          <legend className={styles.declineLegend}>Does {movement.id} need an escort?</legend>
                          <p className={styles.cardMeta}>
                            Neither answer is selected, and nothing selects one from this patient&apos;s legal status or
                            from the last booking. This is recorded as this team&apos;s answer.
                          </p>
                          {ESCORT_ANSWERS.map((answer) => (
                            <label key={answer.label} className={styles.declineOption}>
                              <input
                                type="radio"
                                name={`transport-escort-${movement.id}`}
                                data-testid={`ward-ed-transport-escort-${answer.value ? "yes" : "no"}-${movement.id}`}
                                value={answer.value ? "yes" : "no"}
                                // `=== answer.value`, never a truthiness test: an unanswered draft is
                                // `undefined`, which must check NEITHER box rather than the "no" one.
                                checked={transportDraft.escortRequired === answer.value}
                                onChange={() =>
                                  setTransportDraft((current) => ({ ...current, escortRequired: answer.value }))
                                }
                              />
                              {answer.label}
                            </label>
                          ))}
                        </fieldset>
                        <button
                          type="button"
                          data-testid={`ward-ed-book-transport-confirm-${movement.id}`}
                          className={styles.declineSubmit}
                          aria-disabled={transportAnswersBlocked ? "true" : undefined}
                          aria-describedby={
                            transportAnswersBlocked ? `ward-ed-book-transport-blocked-${movement.id}` : undefined
                          }
                          title={transportAnswersBlocked ?? undefined}
                          onClick={
                            transportAnswersBlocked
                              ? ignoreUnavailableActivation
                              : () => submitBookTransport(movement.id)
                          }
                        >
                          Book transport
                        </button>
                        {transportAnswersBlocked ? (
                          <span id={`ward-ed-book-transport-blocked-${movement.id}`} className="sr-only">
                            {transportAnswersBlocked}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {examOpen && !examBlocked ? (
                      <form
                        className={styles.declineForm}
                        onSubmit={(event) => submitExamination(event, movement.id)}
                        data-testid={`ward-ed-examine-form-${movement.id}`}
                      >
                        <fieldset className={styles.declineFieldset}>
                          <legend className={styles.declineLegend}>Examination outcome for {movement.id}</legend>
                          {(
                            [
                              { value: "inpatient_order", label: "Inpatient treatment order" },
                              { value: "community_order", label: "Community treatment order" },
                              { value: "revoked", label: "Revoked — does not proceed" },
                            ] as const
                          ).map((option) => (
                            <label key={option.value} className={styles.declineOption}>
                              <input
                                type="radio"
                                name={`examination-outcome-${movement.id}`}
                                value={option.value}
                                checked={examinationOutcome === option.value}
                                onChange={() => setExaminationOutcome(option.value)}
                              />
                              {option.label}
                            </label>
                          ))}
                        </fieldset>
                        <button type="submit" disabled={!examinationOutcome} className={styles.declineSubmit}>
                          Confirm examination outcome
                        </button>
                      </form>
                    ) : null}

                    {urgencyChangeOpen ? (
                      <form
                        className={styles.declineForm}
                        onSubmit={(event) => submitUrgencyChange(event, movement.id)}
                        data-testid={`ward-change-urgency-${movement.id}`}
                      >
                        <label className={styles.referralField} htmlFor={`ward-change-urgency-tier-${movement.id}`}>
                          Urgency tier for {movement.id}
                          <select
                            id={`ward-change-urgency-tier-${movement.id}`}
                            value={urgencyDraft.urgency}
                            onChange={(event) =>
                              setUrgencyDraft((current) => ({
                                ...current,
                                urgency: Number(event.target.value) as 1 | 2 | 3,
                              }))
                            }
                          >
                            {/* Labelled, not a bare digit, for the same reason as the raise-referral
                                picker above: the value stays the bare tier, the text carries the
                                direction. */}
                            {URGENCY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {urgencyTierLabel(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.referralField} htmlFor={`ward-change-urgency-reason-${movement.id}`}>
                          Reason
                          <select
                            id={`ward-change-urgency-reason-${movement.id}`}
                            required
                            value={urgencyDraft.reason}
                            onChange={(event) =>
                              setUrgencyDraft((current) => ({
                                ...current,
                                reason: event.target.value as UrgencyChangeReason,
                              }))
                            }
                          >
                            {URGENCY_CHANGE_REASONS.map((reason) => (
                              <option key={reason} value={reason}>
                                {changeReasonLabels[reason]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="submit" className={styles.declineSubmit}>
                          Record urgency change
                        </button>
                      </form>
                    ) : null}

                    {legalStatusChangeOpen ? (
                      <form
                        className={styles.declineForm}
                        onSubmit={(event) => submitLegalStatusChange(event, movement.id)}
                        data-testid={`ward-change-legal-status-${movement.id}`}
                      >
                        <label
                          className={styles.referralField}
                          htmlFor={`ward-change-legal-status-value-${movement.id}`}
                        >
                          Legal status for {movement.id}
                          <select
                            id={`ward-change-legal-status-value-${movement.id}`}
                            value={legalStatusDraft.legalStatus}
                            onChange={(event) =>
                              setLegalStatusDraft((current) => ({
                                ...current,
                                legalStatus: event.target.value as LegalStatus,
                              }))
                            }
                          >
                            {LEGAL_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label
                          className={styles.referralField}
                          htmlFor={`ward-change-legal-status-reason-${movement.id}`}
                        >
                          Reason
                          <select
                            id={`ward-change-legal-status-reason-${movement.id}`}
                            required
                            value={legalStatusDraft.reason}
                            onChange={(event) =>
                              setLegalStatusDraft((current) => ({
                                ...current,
                                reason: event.target.value as LegalStatusChangeReason,
                              }))
                            }
                          >
                            {LEGAL_STATUS_CHANGE_REASONS.map((reason) => (
                              <option key={reason} value={reason}>
                                {changeReasonLabels[reason]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="submit" className={styles.declineSubmit}>
                          Record legal status change
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Statewide capacity" className={styles.listSection}>
          <h2 className={styles.sectionHeading}>Statewide capacity (read-only)</h2>
          <p className={styles.placeholder}>
            Every ward&apos;s own confirmed capacity, for context only &mdash; hiding it would recreate the problem this
            system exists to remove. This is not a queue or a shortlist: nothing here can be actioned from this screen.
          </p>
          <div className={styles.capacityTableWrap} data-testid="ward-ed-statewide-capacity">
            <table className={styles.capacityTable}>
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col">Cohort</th>
                  <th scope="col">Security</th>
                  <th scope="col">Ready</th>
                  <th scope="col">Beds</th>
                </tr>
              </thead>
              <tbody>
                {wardServiceOrder.flatMap((service) =>
                  units
                    .filter((unit) => siteByCode(unit.siteCode)?.service === service)
                    .map((unit) => {
                      const capacity = unitCapacity(unit, bedReleases);
                      return (
                        <tr key={unit.id}>
                          <th scope="row">{unit.name}</th>
                          <td>{unit.cohort}</td>
                          <td>{unit.security}</td>
                          <td>{capacity.available}</td>
                          <td>{unit.beds}</td>
                        </tr>
                      );
                    }),
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
