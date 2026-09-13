"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import {
  elapsedLabel,
  stageCopy,
  transportLeg,
  unitCapacity,
  wardServiceOrder,
} from "@/components/ward-management/ward-derivations";
import {
  formatElapsed,
  formatInstantWithDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
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
  REFERRAL_DECLINE_REASONS,
  SEXES,
  TRANSPORT_PROVIDERS,
  URGENCY_LEVELS,
  type Cohort,
  type LegalStatus,
  type Movement,
  type ReferralAddressing,
  type ReferralDeclineReason,
  type Rejection,
  type Security,
  type Sex,
  type TransportProvider,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  DECLINE_REASON_LABELS,
  edAnsweredReferralsFor,
  edReferralsFor,
  referralAddressingStateLabel,
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

/**
 * ⚠️ **THE REASONS THIS SCREEN MUST NOT OFFER, AND WHY EACH ONE IS EXCLUDED.**
 *
 * This inbox asks an ED psychiatry team to SEE A PATIENT (`purpose: "psychiatric_review"`). It never
 * asks anybody for a bed, so the four reasons below are answers to a question this screen did not
 * put — each one names a property of a BED that could not be supplied:
 *
 *   `no_suitable_bed`             — no bed was sought here.
 *   `secure_bed_unavailable`      — a bed's security level; no bed was sought here.
 *   `age_band_not_provided_here`  — which age band a UNIT admits; this team admits nobody.
 *   `sex_designation_unavailable` — a BED's sex designation; this team designates no bed.
 *
 * Offering one would let a clinician file "No suitable bed" against a request for a review, which
 * reads on the record as a bed refusal that never happened.
 */
const BED_SHAPED_DECLINE_REASONS: readonly ReferralDeclineReason[] = [
  "no_suitable_bed",
  "secure_bed_unavailable",
  "age_band_not_provided_here",
  "sex_designation_unavailable",
];

/**
 * The reasons an ED psychiatry team may give, DERIVED by removing the bed-shaped four from
 * `REFERRAL_DECLINE_REASONS` — never hand-listed as the two that survive.
 *
 * ⚠️ **THE DIRECTION OF THE FILTER IS THE POINT.** A hand-written `["belongs_to_another_service",
 * "referred_elsewhere"]` keeps its shape when the model's list grows, so a seventh reason added to
 * `REFERRAL_DECLINE_REASONS` would silently never reach this screen and nothing would fail. Written
 * as an EXCLUSION, a new reason is offered here by default and has to be argued out deliberately —
 * the same discipline `COHORT_OPTIONS` below records for the Youth cohort it once silently dropped.
 *
 * ⚠️ **THIS LIST IS KNOWN TO BE INCOMPLETE.** The owner has been asked what a psychiatry team
 * actually says when it will not review somebody, and neither survivor may be it. That is precisely
 * why nothing here is pre-selected — see `NO_DECLINE_REASON_VALUE`.
 */
const ED_DECLINE_REASONS: readonly ReferralDeclineReason[] = REFERRAL_DECLINE_REASONS.filter(
  (reason) => !BED_SHAPED_DECLINE_REASONS.includes(reason),
);

/**
 * The `<option>` value standing for "no reason chosen yet", for the same reason
 * `NO_LEGAL_FORM_VALUE` and `NO_TRANSPORT_PROVIDER_VALUE` exist: a `<select>` option value is
 * always a string.
 *
 * ⚠️ **AND IT IS THE SELECTED OPTION ON EVERY OPEN, WHICH IS NOT MERELY A UI PREFERENCE.**
 * A pre-selected reason is a reason a clinician who meant something else records by pressing
 * confirm — an invented clinical fact, which this project holds to be worse than a blank.
 *
 * ⚠️ **THIS COMMENT USED TO EXCUSE `referral-match.tsx` FOR DOING THE OPPOSITE, AND IT WAS WRONG
 * TWICE OVER.** It said that screen may safely seed `REFERRAL_DECLINE_REASONS[0]` because all
 * SIX of its reasons answer the bed question. There are now SEVEN, and more to the point that
 * screen no longer seeds anything: the owner ruled on 2026-09-02 that a ward must state why it is
 * refusing a patient, and its pre-selected `"no_suitable_bed"` was removed. **Both screens now
 * start unchosen, so the distinction this paragraph drew has gone.**
 *
 * ⚠️ Left as a correction rather than deleted, because a comment that names ANOTHER file as an
 * example decays when that file changes and nothing local ever fails — which is exactly what
 * happened here, twice, unnoticed.
 */
const NO_DECLINE_REASON_VALUE = "";

/**
 * Why the decline confirm is unavailable, or `undefined` once a reason has been chosen. Pure and
 * module-level so the wording lives in one place rather than being spelled twice inside JSX.
 *
 * It is NOT exported, so no test can assert its two states directly and none does — the states are
 * reached through the rendered control instead. Said explicitly because the sibling comment on
 * `transportAnswersBlockedReason` below claims its states "can be asserted without rendering",
 * which has never been true of an unexported function; this one does not repeat the claim.
 */
function declineReasonBlockedReason(reason: ReferralDeclineReason | undefined): string | undefined {
  if (reason !== undefined) return undefined;
  return "Choose a reason before recording this decline. None is chosen for you: a reason nobody picked would be filed as this team's own answer.";
}

/**
 * The state of an answered addressing, in plain words — the "recently answered" section's own
 * line, for the row this screen's own decline dispatches AND for a sibling destination's
 * acceptance cancelling this one out from under it.
 *
 * ⚠️ **STALE ATTRIBUTION FIXED, FIX ROUND 1 (a sibling review flagged it).** This paragraph used
 * to say the `cancelled` sentence was `referral-match.tsx`'s own spelling, reused verbatim. That
 * was true only until owner ruling 8 (2026-09-01) landed: the wording now lives in exactly one
 * place, `referralAddressingStateLabel` (`ward-referrals.ts`), and `referral-match.tsx` itself
 * calls that same function rather than holding its own copy — so naming it as this file's source
 * would now be pointing at a second copy that no longer exists. This function is a thin delegate;
 * the full `declined`/`cancelled` "must not be worded alike" rationale lives on
 * `referralAddressingStateLabel`'s own doc comment, the one place it needs to be argued.
 */
function answeredAddressingLabel(addressing: ReferralAddressing): string {
  return referralAddressingStateLabel(addressing);
}

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
 * The `<option>` values standing for "not yet answered" on the five raise-referral selects — the
 * same reason `NO_DECLINE_REASON_VALUE` and `NO_LEGAL_FORM_VALUE` exist: a `<select>` option
 * value is always a string, so the `undefined` these fields hold in `ReferralDraftState` needs a
 * DOM-facing sentinel distinct from it. One constant per field, not one shared constant, because
 * a shared empty string reads correctly in the DOM regardless — this split exists purely so a
 * search for one field's sentinel never returns another's.
 */
const NO_COHORT_VALUE = "";
const NO_SECURITY_VALUE = "";
const NO_SEX_VALUE = "";
const NO_LEGAL_STATUS_VALUE = "";
/**
 * The provenance reason for a legal-status change starts UNCHOSEN, the same way every clinical
 * field on the raise-referral form does. `recorded_by_treating_team` used to be pre-selected, so a
 * clinician correcting a mistyped legal status who never touched the control filed the correction
 * as a fresh report FROM the treating team — a team that never made one. The two options describe
 * where the entry came from, not why anyone's status changed, which is why this is an audit-trail
 * defect rather than a clinical one; it is no less wrong for that.
 */
const NO_CHANGE_REASON_VALUE = "";

/** One spelling, used by the control, its title and its screen-reader note. */
/**
 * ⚠️ The worst of the six, and the reason the owner widened the fix. `URGENCY_CHANGE_REASONS[0]`
 * is `reassessed` — so a clinician correcting a mistyped urgency, who never touched this control,
 * recorded a CLINICAL REASSESSMENT THAT NEVER HAPPENED. That invents a clinical event rather than
 * mis-attributing a clerical one, which is why it is a stronger harm than the treating-team default
 * beside it.
 */
const URGENCY_REASON_UNCHOSEN =
  "Choose why the urgency is changing before recording it. None is chosen for you: an unpicked reason would be filed as a clinical reassessment nobody made.";

const LEGAL_STATUS_REASON_UNCHOSEN =
  "Choose where this entry came from before recording the change. None is chosen for you: a reason nobody picked would be filed as the treating team's own report.";
const NO_URGENCY_VALUE = "";

/**
 * The `<option>` value standing for "no form". A `<select>` option value is always a string, so
 * "no form" needs a sentinel; it is converted back to `null` on the way into the draft, where
 * "no form" is a real choice rather than a blank.
 */
const NO_LEGAL_FORM_VALUE = "";

/**
 * The local form's own draft shape, distinct from `ReferralDraft` (`ward-flow-events.ts`) — the
 * dispatched event's payload — precisely so this type can hold "not yet answered" for five
 * fields that event can never hold. `submitReferral` below is what converts one into the other,
 * and it can do so only once none of the five is `undefined` any more.
 */
type ReferralDraftState = {
  cohort: Cohort | undefined;
  security: Security | undefined;
  sex: Sex | undefined;
  specialling: boolean | undefined;
  legalStatus: LegalStatus | undefined;
  urgency: 1 | 2 | 3 | undefined;
  legalFormCode: string | null;
};

/**
 * ⚠️ **EVERY FIELD HERE STARTS UNANSWERED. THE CLINICIAN PICKS EACH ONE; THE SOFTWARE NEVER
 * PICKS ONE FOR THEM.**
 *
 * That sentence used to sit on one field of this object's seven, `legalFormCode`'s own comment
 * below — correct where it was written, and never generalised to the six fields beside it. Every
 * `<select>` bound to `cohort`, `security`, `sex`, `legalStatus` and `urgency` defaulted to
 * option zero, so a form nobody had touched yet still submitted "Adult", "Open", "Female",
 * "Voluntary" and "Tier 3" for a patient nobody had actually assessed. `sex` is simply wrong for
 * anyone who is not female. `legalStatus` is a fact about a person's liberty, not a UI
 * convenience with a sensible default. `urgency` gets the same ruling on judgement rather than
 * habit: a tier nobody chose is a clinical claim exactly like the other four, so it starts
 * unanswered too. ⚠️ `specialling` USED TO BE the one field this did not touch — owner ruling 1
 * falsified the reasoning below. `draft.specialling` reaches `ward-flow-reducer.ts:607`, which
 * writes it onto the MOVEMENT; the reducer then refuses a pull at `:966` only
 * `if (movement.specialling && remaining… <= 0)`. So a `false` nobody chose does not merely record
 * "not required" — it SKIPS THE ONE-TO-ONE CAPACITY REFUSAL ENTIRELY, and a patient who needs
 * specialling can be pulled into a ward that cannot staff it with nothing objecting. An unticked
 * box stopped being an answer the moment it became an input to a gate. Superseded reasoning: — a checkbox whose
 * unticked state is a genuine answer ("not required" unless stated otherwise), not a fact about
 * the patient the software would otherwise be guessing at.
 *
 * `undefined` is this file's own sentinel for "not yet answered" — the same choice `declineDraft`
 * (`useState<ReferralDeclineReason | undefined>(undefined)` below) already makes — rather than
 * `referral-intake.tsx`'s string sentinel (`UNANSWERED_VALUE`). Two spellings of "unanswered" in
 * one codebase is how a future check ends up looking for the wrong one; this file keeps the one
 * already living here. `referralDraftBlockedReason` below is what the submit control and
 * `submitReferral`'s own guard both read to find out whether that is still true.
 */
const DEFAULT_DRAFT: ReferralDraftState = {
  cohort: undefined,
  security: undefined,
  sex: undefined,
  specialling: undefined,
  legalStatus: undefined,
  urgency: undefined,
  // Defaults to no form. The clinician picks one; the software never picks one for them. This
  // one was always correct — `null` here has always meant "no form", a real answer the clinician
  // may deliberately choose, not "unknown". See `NO_LEGAL_FORM_VALUE`'s own comment.
  legalFormCode: null,
};

/**
 * Why "Raise referral" is unavailable, or `undefined` once every field a clinician must decide
 * has been decided — the same role `declineReasonBlockedReason` above plays for the decline
 * confirm, checked in the same fixed order the forms renders its fields. A form that fired with
 * any of these five still `undefined` would go on to file a fabricated cohort, security level,
 * sex, legal status or urgency tier for a patient nobody looked at — the defect this function,
 * the five placeholder options, and `submitReferral`'s own guard all exist to close together.
 */
function referralDraftBlockedReason(draft: ReferralDraftState): string | undefined {
  if (draft.cohort === undefined) {
    return "Choose a cohort before raising this referral. None is chosen for you: a cohort nobody picked would be filed as this patient's own record.";
  }
  if (draft.security === undefined) {
    return "Choose a security level before raising this referral. None is chosen for you: a security level nobody picked would be filed as this patient's own record.";
  }
  if (draft.sex === undefined) {
    return "Choose a sex before raising this referral. None is chosen for you: a sex nobody picked would be filed as this patient's own record.";
  }
  if (draft.legalStatus === undefined) {
    return "Choose a legal status before raising this referral. None is chosen for you: a legal status nobody picked would be filed as this patient's own record.";
  }
  if (draft.urgency === undefined) {
    return "Choose an urgency tier before raising this referral. None is chosen for you: an urgency tier nobody picked would be filed as this patient's own record.";
  }
  if (draft.specialling === undefined) {
    return 'State whether one-to-one nursing is required before raising this referral. None is chosen for you: an unanswered box would be filed as "not required", and the reducer only checks a ward\'s one-to-one capacity when the patient is recorded as needing it.';
  }
  return undefined;
}

/**
 * `RECORD_EXAMINATION`'s own preconditions (`ward-flow-reducer.ts`'s `case "RECORD_EXAMINATION"`),
 * named here in the same order so the control can never advertise an action the reducer would
 * refuse — the same discipline `ward-screen.tsx`'s `referralAnswerBlocked`/`pullBlockedReason` and
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

/**
 * Mirrors `case "HANDOVER_READY"` exactly, in the reducer's own order.
 *
 * ⚠️ **THE SECOND PRECONDITION ARRIVED 2026-08-31 and this comment said "the ONLY precondition is
 * stage `pulled`" until it did.** `HANDOVER_READY` used to fabricate a transport job on the spot,
 * inventing the provider and deriving the escort answer from legal status; it now REQUIRES a booked
 * one. Without the second check here the button would offer a handover the reducer refuses — a
 * control advertising an action it cannot perform, which is the wiring convention this repository
 * enforces, and the reason a mirror function has to be updated in the same change as the rule it
 * mirrors rather than the next time somebody reads it.
 */
function handoverBlockedReason(movement: Movement): string | undefined {
  if (!movement.transport && movement.stage === "pulled") {
    return `${movement.id} has no transport booked — book it first, then mark the handover ready.`;
  }
  if (movement.stage !== "pulled") {
    return `${movement.id} is ${stageCopy[movement.stage].label.toLowerCase()}, not bed pulled — a handover can only be marked ready once a bed is pulled.`;
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
  if (movement.stage !== "pulled") {
    return `${movement.id} is ${stageCopy[movement.stage].label.toLowerCase()}, not bed pulled — transport can only be booked once a bed is pulled.`;
  }
  // The reducer refuses a second booking because it would replace a job a provider may already
  // have accepted and take the acceptance timestamps with it. Reachable on this screen the moment
  // a booking succeeds: `BOOK_TRANSPORT` leaves the movement at `pulled`, so the card that just
  // booked re-renders with the control unavailable rather than offering a replacement.
  if (movement.transport) {
    return `${movement.id} already has transport booked. Booking again would replace a job the provider may already have accepted, and take its timestamps with it — an existing job has to be cancelled before a new one can be booked.`;
  }
  return undefined;
}

/**
 * WHY A REFERRAL CANNOT BE WITHDRAWN — the reducer's three refusals, restated so the control is
 * absent rather than bouncing.
 *
 * ⚠️ **These three conditions are `WITHDRAW_REFERRAL`'s own guards and must not drift from them.**
 * A control that offers an action the reducer will refuse teaches a clinician that this screen's
 * buttons are decorative, which is the one lesson a prototype must never teach. Each branch below
 * is the same rule as the reducer's, worded for the person holding the mouse rather than for a log.
 *
 * The middle one is the load-bearing one and it is a clinical distinction, not a technical one: a
 * ward that pulled a bed has already acted. Undoing that is the WARD's decline, not the referrer's
 * withdrawal, and collapsing the two would let a referrer silently release a bed somebody else is
 * keeping free.
 */
function withdrawReferralBlockedReason(movement: Movement): string | undefined {
  if (movement.closure) {
    return `${movement.id} has already closed (${movement.closure.reason}). A withdrawal cannot be added to a movement that has ended.`;
  }
  if (movement.acceptedUnitId) {
    return `${movement.id} has already been accepted and a ward has pulled a bed. Releasing that bed is the ward's own decline, not a withdrawal by this department.`;
  }
  if (movement.referredUnitIds.length === 0) {
    return `${movement.id} holds no live referral to withdraw.`;
  }
  return undefined;
}

/**
 * ⚠️ **THE ESCORT QUESTION OPENS BLANK, AND NOTHING ANYWHERE SUPPLIES AN ANSWER FOR IT** (owner,
 * relayed 2026-08-30). Not from `legalStatus`, not from the last booking, not as a "usually".
 *
 * **His reason is that a pre-filled clinical judgement is answered by clicking past it**, and the
 * record then asserts that a clinician decided when nobody did — worse than the honest derivation
 * it replaces, because it launders an automatic value through a human's name.
 *
 * ⚠️ **THE DEFECT THIS NAMED IS NOW FIXED, AND THIS CLAUSE SAID OTHERWISE UNTIL 2026-09-01.** It
 * read "`HANDOVER_READY` still computes `movement.legalStatus !== "Voluntary"` today". It does not:
 * that fabrication was deleted when `BOOK_TRANSPORT` landed on 2026-08-31, and the reducer's
 * `HANDOVER_READY` case now only refuses a movement with no booked transport and sets the stage.
 * The reason for keeping this control blank is unchanged — re-creating the derivation as a default
 * here would restore the defect rather than move it — but a comment claiming a live defect that has
 * been fixed sends a reader hunting for code that is not there.
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
 * movement is not already at `pulled`/`handover_ready`/`moving`, i.e. once nothing more urgent
 * is already in motion.
 *
 * Reads only `movement.stage`, `movement.transport` and `movement.legalForm`/`.examination` —
 * never `ED_ACCESS_TARGET_MINUTES`, and never writes a `dueAt` anywhere (see that constant's own
 * doc comment and Task 6A).
 */
function outstandingItem(movement: Movement): OutstandingItem {
  if (movement.stage === "pulled") {
    return { kind: "handover", label: "Handover", detail: "Bed pulled — ready to mark the handover to transport." };
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

/**
 * Whether a form was made before this patient reached the department — the condition under which
 * the legal clock is dated from the form rather than from arrival.
 *
 * ⚠️ **`<=`, NOT `<`, AND THE BOUNDARY IS AN OWNER RULING RATHER THAN AN ACCIDENT.** 2026-09-05: a
 * form recorded at the very same minute as arrival IS community formed. He was asked precisely
 * because the elapsed figure is identical either way — both references are the same instant — **so
 * the only thing this comparison changes at the boundary is which authority the screen names**, and
 * *"since opened"* over a patient who has a form implies no form was made, which would be untrue.
 * `<` was what somebody typed; nobody had chosen it. `WF-013` in the fixture is the case that
 * discriminates the two, and `tests/ward-ed-legal-clock.dom.test.tsx` pins it.
 *
 * ⚠️ **THIS IS DELIBERATELY NOT `formedAt !== undefined` ALONE, WHICH IS THE LITERAL READING OF THE
 * RULING AND WOULD BREAK AN INVARIANT.** A `formedAt` strictly AFTER `openedAt` would make
 * `legalClockReference` LATER than `openedAt` — the thing that function's own comment claims cannot
 * happen and that the test above now asserts. Nothing in the model forbids such a record, so the
 * comparison, not the data, is what holds the invariant.
 *
 * ⚠️ **A form dated after arrival is therefore treated as not-community-formed, and that is a
 * PLACEHOLDER, not a decision.** It is an incoherent record, and this module has ruled on that
 * shape once already: `emptyBedMinutes` refuses to clamp a negative gap to zero, because
 * *"this record cannot be true"* must not quietly become *"a plausible figure nobody would query"*.
 * Labelling such a movement *"since opened"* is the same conversion in a different costume. Raised
 * with Ward Lead 2026-09-05 as a separate question; no fixture reaches it today.
 */
function isCommunityFormed(movement: Movement): boolean {
  return movement.formedAt !== undefined && movement.formedAt <= movement.openedAt;
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
/**
 * ⚠️ HOW MANY "RECENTLY ANSWERED" HOLDS — OWNER RULING 19, 2026-09-03. Ten.
 *
 * The section was uncapped, and an uncapped list titled "recently" decays with use: on a busy
 * department it grows without limit until the word in its own heading is simply false. Ten is the
 * owner's number, not a guess, which is why it is written here once and cited rather than tuned.
 *
 * ⚠️ THE CAP APPLIES TO THE ROWS, NEVER TO THE COUNT. The heading below reports how many
 * have been answered, not how many are shown. Those two agree on every fixture smaller than ten,
 * so capping the count as well would look correct everywhere except in front of a real clinician.
 */
const ANSWERED_VISIBLE_CAP = 10;

export function EdScreen({ edId }: EdScreenProps) {
  const { movements, units, bedReleases, referrals, rejections, now, dispatch } = useWardFlow();
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
  const [urgencyDraft, setUrgencyDraft] = useState<{
    urgency: 1 | 2 | 3;
    reason: UrgencyChangeReason | undefined;
  }>({
    urgency: 1,
    reason: undefined,
  });
  const [legalStatusChangeOpenFor, setLegalStatusChangeOpenFor] = useState<string | undefined>(undefined);
  const [legalStatusDraft, setLegalStatusDraft] = useState<{
    legalStatus: LegalStatus;
    reason: LegalStatusChangeReason | undefined;
  }>({ legalStatus: "Voluntary", reason: undefined });
  // `TR-D1`: the sending team books the transport out, and this department is the sending team for
  // its own patients. One open-for id and one draft, the same shape the three toggles above use —
  // only one panel is open at a time, so one draft cannot be read against the wrong patient. The
  // draft starts BLANK and is reset to blank on every toggle; see `ESCORT_ANSWERS`.
  const [transportOpenFor, setTransportOpenFor] = useState<string | undefined>(undefined);
  const [transportDraft, setTransportDraft] = useState<TransportDraftState>(BLANK_TRANSPORT_DRAFT);
  const [withdrawOpenFor, setWithdrawOpenFor] = useState<string | undefined>(undefined);
  /*
   * THE INBOX DECLINE, wired 2026-09-01. `EVENT_ROLE.DECLINE_REFERRAL` gained `"ed"`, so this
   * screen may answer a referral addressed to it as itself and the reducer records
   * `decidedBy: "ED mental health"` — the correct team, not a ward standing in for one.
   *
   * ⚠️ **ONE `openFor` id AND ONE DRAFT, never a keyed map** — the same shape the four controls in
   * the patients section below already use. Only one panel is open at a time, so one draft can
   * never be read against the wrong referral; a map would additionally keep a reason a clinician
   * chose for a row they have since closed and moved on from.
   *
   * ⚠️ **THE DRAFT IS `undefined`, NOT `REFERRAL_DECLINE_REASONS[0]`** — see
   * `NO_DECLINE_REASON_VALUE` above for why a pre-selected reason is a fabricated clinical fact
   * here even though `referral-match.tsx` may safely seed one.
   */
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  const [declineDraft, setDeclineDraft] = useState<ReferralDeclineReason | undefined>(undefined);
  /*
   * ⚠️ **NO PATH FROM THIS SCREEN CAN CURRENTLY PRODUCE A REFUSAL. THIS BRANCH IS WRITTEN AGAINST A
   * FUTURE DISPATCHER, NOT A LIVE ONE — do not read it as covering something that happens today.**
   *
   * Checked branch by branch against the reducer's `DECLINE_REFERRAL` case on 2026-09-01, and every
   * one of its six refusals is closed from here:
   *
   *   `no referral found`              — nothing ever removes a referral from state.
   *   role/kind mismatch               — both are fixed literals in `submitDecline` below.
   *   `not addressed to …`             — the row exists BECAUSE this ED addressing exists.
   *   `already accepted elsewhere`     — an acceptance on any sibling arm CANCELS this one
   *                                      (`ACCEPT_REFERRAL`'s FD-22 loop), and `edReferralsFor`
   *                                      keeps only `queued`, so the row is gone before it could be
   *                                      pressed. Verified by running it, not by reading it.
   *   `has already answered (state)`   — the row renders only while `queued`, and `RECEIVE_REFERRAL`
   *                                      refuses two destinations of the same kind, so one referral
   *                                      can never have a second ED arm to answer out of order.
   *   reason not a member              — `declineDraft` is drawn from `ED_DECLINE_REASONS`, a subset
   *                                      of the list the reducer checks against, and `undefined`
   *                                      returns early.
   *
   * It is kept rather than deleted because the spec requires a refusal to be surfaced and scoped,
   * and a dispatcher that can be refused is a change away — the ED gaining its own producer, or a
   * second screen sharing this provider. `tests/ward-ed-psychiatry-hub.dom.test.tsx` drives a real
   * reducer refusal through the provider to pin the mechanism and, above all, the SCOPING, which is
   * otherwise the half nothing would notice going wrong.
   *
   * ⚠️ **WHY IT IS SCOPED TO THE ROW.** `dispatch` never reports whether the reducer accepted, so
   * the only way to know is to compare `rejections` before and after — the same
   * `checkToken`/`priorRejectionCountRef` pair `referral-match.tsx` and `referral-intake.tsx` use.
   * **What does NOT port from `referral-match.tsx` is holding one `lastRejection` for the whole
   * component.** That is safe there only because that screen renders exactly ONE referral. This is
   * a LIST, so an unscoped refusal would be displayed against whichever row happened to render it.
   * The referral id is therefore carried alongside, taken from `Rejection.movementId` — which holds
   * the REFERRAL id for `DECLINE_REFERRAL` (`subjectId` in `ward-flow-reducer.ts`) rather than a
   * movement id — so the pairing comes from the rejection itself and cannot be misattributed.
   */
  const [declineRejection, setDeclineRejection] = useState<{ referralId: string; rejection: Rejection } | undefined>(
    undefined,
  );
  const priorRejectionCountRef = useRef(rejections.length);
  const [declineCheckToken, setDeclineCheckToken] = useState(0);

  useEffect(() => {
    // Nothing has been dispatched from this screen yet, so a rejection already in state belongs to
    // somebody else and must not be surfaced here.
    if (declineCheckToken === 0) return;
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      setDeclineRejection(
        newest.attempted === "DECLINE_REFERRAL" ? { referralId: newest.movementId, rejection: newest } : undefined,
      );
    } else {
      setDeclineRejection(undefined);
    }
    priorRejectionCountRef.current = rejections.length;
  }, [rejections, declineCheckToken]);

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
   * RECENTLY ANSWERED — owner ruling 7, 2026-09-01. A clinician who declines a referral watches the
   * row vanish from the inbox above the moment they answer it, because that list is a worklist
   * (`edReferralsFor`'s own `queued` scoping). Without this, there is no undo, no record on this
   * screen, and nothing to check a mistake against. `edAnsweredReferralsFor` is the second selector
   * that scoping requires — see its own doc comment for why it cannot be a parameter on
   * `edReferralsFor` instead.
   */
  const answeredAll = edAnsweredReferralsFor(referrals, thisEdId, "psychiatric_review");
  /**
   * `edAnsweredReferralsFor` returns them sorted by `decidedAt` DESCENDING, so slicing from the
   * front takes the ten most RECENT rather than an arbitrary ten. That ordering is load-bearing for
   * this cap, and `tests/ward-ed-answered-cap.dom.test.tsx` names the three oldest rows and asserts
   * their absence — so a selector that stopped sorting would fail there rather than quietly
   * showing ten of the wrong rows, which renders identically to ten of the right ones.
   *
   * ⚠️ AN UNDATED DECISION IS DROPPED FIRST, AND THAT IS THE INTENDED ORDER. The selector
   * sorts a missing `decidedAt` to `-Infinity`, so a row with no decision time sinks below every
   * dated one. Right, because nothing can be claimed as recent without a time — but it does mean
   * such a row leaves this list once ten dated decisions exist. The referral is untouched; only
   * this view of it is limited.
   */
  const answered = answeredAll.slice(0, ANSWERED_VISIBLE_CAP);

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
   * excludes them. **No stage is treated as finished with**: a pulled bed and a booked handover are
   * both still jobs this team owes.
   */
  const outbox = patients.filter((movement) => movement.acceptedUnitId !== undefined);

  function submitReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Guards the same five fields `referralDraftBlockedReason` names, and does so with direct
    // `=== undefined` checks — not a call to that function — so TypeScript narrows each local
    // binding to its real, answered type below. This is the raise-referral form's own version of
    // `submitDecline`'s `if (declineDraft === undefined) return;` a few lines up: the button
    // being `aria-disabled` stops a click, but this form (unlike the decline panel) IS a real
    // `<form>`, so pressing Enter inside a field submits it regardless of what the button
    // advertises. Without this guard that keystroke would file the same fabricated cohort,
    // security level, sex, legal status or urgency tier the whole fix exists to stop.
    const { cohort, security, sex, legalStatus, urgency } = draft;
    if (
      cohort === undefined ||
      security === undefined ||
      sex === undefined ||
      legalStatus === undefined ||
      urgency === undefined ||
      draft.specialling === undefined
    ) {
      return;
    }
    dispatch({
      type: "RAISE_REFERRAL",
      role: "ed",
      now,
      edId: thisEdId,
      draft: {
        cohort,
        security,
        sex,
        specialling: draft.specialling,
        legalStatus,
        urgency,
        legalFormCode: draft.legalFormCode,
      },
    });
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
    setUrgencyDraft({ urgency: currentUrgency, reason: undefined });
  }

  function submitUrgencyChange(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    // A real <form>: Enter inside a field submits it whatever the button advertises.
    if (urgencyDraft.reason === undefined) return;
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
    setLegalStatusDraft({ legalStatus: currentLegalStatus, reason: undefined });
  }

  function submitLegalStatusChange(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    // This IS a real <form>, so Enter inside a field submits it whatever the button advertises —
    // the same bypass the raise-referral form guards. An `aria-disabled` control alone would not
    // catch it, and the reducer requires a reason, so an unguarded Enter would dispatch `undefined`.
    if (legalStatusDraft.reason === undefined) return;
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

  function toggleWithdrawReferral(movementId: string) {
    setWithdrawOpenFor((current) => (current === movementId ? undefined : movementId));
  }

  function confirmWithdrawReferral(movementId: string) {
    dispatch({ type: "WITHDRAW_REFERRAL", role: "ed", now, movementId });
    setWithdrawOpenFor(undefined);
  }

  function toggleBookTransport(movementId: string) {
    setTransportOpenFor((current) => (current === movementId ? undefined : movementId));
    // ⚠️ **BLANKED ON EVERY OPEN, NOT ONLY ON EVERY CLOSE.** Carrying the previous patient's
    // answers into the next panel would be a remembered value standing in for an unmade decision —
    // the same ruling as a derived one, and harder to see because it was true once.
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
  }

  function toggleDecline(referralId: string) {
    setDeclineOpenFor((current) => (current === referralId ? undefined : referralId));
    // Blanked on every OPEN as well as every close, the same ruling `toggleBookTransport` records:
    // the previous row's reason carried into this panel would be a remembered value standing in
    // for an unmade decision, and this list is one row per patient.
    setDeclineDraft(undefined);
    setDeclineRejection(undefined);
  }

  function submitDecline(referralId: string) {
    // Never dispatched without a reason. The reducer refuses one by membership check — that is the
    // rule's real home — but a refusal raised from here would be invisible to whoever pressed the
    // button, so the control declines to advertise a decline it knows would be rejected.
    if (declineDraft === undefined) return;
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "DECLINE_REFERRAL",
      role: "ed",
      now,
      referralId,
      // Named, never defaulted: this screen is the emergency department's own inbox, so the
      // destination answering here is the emergency department. The reducer must not have to guess
      // which destination replied — and naming it is what keeps its `answerableBy` guard meaningful.
      destinationKind: "emergency_department",
      reason: declineDraft,
    });
    setDeclineCheckToken((token) => token + 1);
    // ⚠️ **THE PANEL IS DELIBERATELY NOT CLOSED AND THE DRAFT NOT CLEARED HERE.** `dispatch` does
    // not say whether the reducer accepted, so closing on dispatch would discard a clinician's
    // chosen reason on a REFUSAL. On acceptance the row leaves the inbox — `edReferralsFor` keeps
    // only `queued` addressings — and the panel goes with it; on a refusal the panel stays open,
    // beside the stated reason it was refused for.
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
                const declineOpen = declineOpenFor === referral.id;
                const declineBlocked = declineReasonBlockedReason(declineDraft);
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
                     * MEDICAL CLEARANCE — owner instruction 2026-09-02, "when a patient is on the
                     * inbox to review, it should also say if they are medically cleared".
                     *
                     * ⚠️ THREE STATES, AND THE THIRD IS THE ONE THAT MATTERS. Absent means NOBODY
                     * HAS ASSESSED IT — it is not "not cleared". The screen says which of the
                     * three it is, in words, because a boolean rendered as a tick would collapse
                     * "we looked and they are not clear" into "nobody looked", and psychiatry
                     * would read the second as the first.
                     *
                     * The control lands WITH the field on purpose: a model field with no writer
                     * renders as a legitimate-looking empty state and passes every gate. Either
                     * answer can be recorded, and re-recorded — a patient cleared at 09:00 can
                     * deteriorate by 11:00, and the reducer overwrites rather than refusing, so
                     * the board never asserts something the department no longer believes.
                     */}
                    <div className={styles.outstandingItem} data-testid={`ward-ed-inbox-clearance-${referral.id}`}>
                      <span className={styles.outstandingLabel}>Medically cleared</span>
                      <span>
                        {referral.medicalClearance === undefined
                          ? "Not assessed"
                          : referral.medicalClearance.cleared
                            ? `Yes — recorded ${formatInstantWithDay(referral.medicalClearance.at, now)}`
                            : `No — recorded ${formatInstantWithDay(referral.medicalClearance.at, now)}`}
                      </span>
                    </div>
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={styles.declineButton}
                        data-testid={`ward-ed-inbox-clearance-yes-${referral.id}`}
                        onClick={() =>
                          dispatch({
                            type: "RECORD_MEDICAL_CLEARANCE",
                            role: "ed",
                            now,
                            referralId: referral.id,
                            cleared: true,
                          })
                        }
                      >
                        Record medically cleared
                      </button>
                      <button
                        type="button"
                        className={styles.declineButton}
                        data-testid={`ward-ed-inbox-clearance-no-${referral.id}`}
                        onClick={() =>
                          dispatch({
                            type: "RECORD_MEDICAL_CLEARANCE",
                            role: "ed",
                            now,
                            referralId: referral.id,
                            cleared: false,
                          })
                        }
                      >
                        Record not medically cleared
                      </button>
                    </div>
                    {/*
                     * ⚠️ **THE DECLINE IS WIRED, AND WHAT MAKES IT SAFE IS THE ROLE IT DISPATCHES
                     * AS.** This screen acts as `"ed"`, which `EVENT_ROLE.DECLINE_REFERRAL` now
                     * permits, so the reducer records `decidedBy: "ED mental health"` — the team
                     * that actually decided. Dispatching as `"ward"` or `"coordinator"` would also
                     * compile and also work, and would write a decision this team never made
                     * against another team's name; that is the false entry `decidedBy` exists to
                     * prevent, and nothing would fail.
                     *
                     * ⚠️ **AND `"ed"` IS NARROW, not merely permitted.** The reducer's `answerableBy`
                     * map lets `ed` answer `emergency_department` destinations and NOTHING else, so
                     * an emergency department can never decline a bed in a ward it has nothing to do
                     * with. That guard is what makes this a fix rather than a hole, and
                     * `tests/ward-ed-psychiatry-hub.dom.test.tsx` asserts both halves.
                     *
                     * The button is the toggle; the reason and the confirm sit in the panel, the
                     * same shape the four controls in the patients section below use.
                     */}
                    <button
                      type="button"
                      className={styles.declineButton}
                      data-testid={`ward-ed-inbox-decline-${referral.id}`}
                      aria-expanded={declineOpen}
                      onClick={() => toggleDecline(referral.id)}
                    >
                      Decline
                    </button>
                    {/*
                     * ⚠️ **DELIBERATELY NOT A `<form>`, for the identical reason the transport panel
                     * below is not** (see its own comment): a form submits on Enter from inside a
                     * field whatever its submit control advertises, and an `aria-disabled` confirm
                     * stays fully operable — so a reasonless decline could go through by keyboard
                     * while the screen said it could not, and the reducer's refusal would be silent.
                     */}
                    {declineOpen ? (
                      <div className={styles.declineForm} data-testid={`ward-ed-inbox-decline-panel-${referral.id}`}>
                        <label className={styles.referralField} htmlFor={`ward-ed-inbox-decline-reason-${referral.id}`}>
                          Why is {referral.id} being declined?
                          <select
                            id={`ward-ed-inbox-decline-reason-${referral.id}`}
                            data-testid={`ward-ed-inbox-decline-reason-${referral.id}`}
                            value={declineDraft ?? NO_DECLINE_REASON_VALUE}
                            onChange={(event) =>
                              setDeclineDraft(
                                event.target.value === NO_DECLINE_REASON_VALUE
                                  ? undefined
                                  : (event.target.value as ReferralDeclineReason),
                              )
                            }
                          >
                            {/* Nothing chosen, first and selected — never a reason standing in for
                                a decision nobody made. */}
                            <option value={NO_DECLINE_REASON_VALUE}>Choose a reason</option>
                            {/* Never the raw enum value: `DECLINE_REASON_LABELS` with `?? reason`
                                as the fallback, exactly as `referral-match.tsx` renders the same
                                list. */}
                            {ED_DECLINE_REASONS.map((reason) => (
                              <option key={reason} value={reason}>
                                {DECLINE_REASON_LABELS[reason] ?? reason}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          data-testid={`ward-ed-inbox-decline-confirm-${referral.id}`}
                          className={styles.declineSubmit}
                          aria-disabled={declineBlocked ? "true" : undefined}
                          aria-describedby={declineBlocked ? `ward-ed-inbox-decline-blocked-${referral.id}` : undefined}
                          title={declineBlocked ?? undefined}
                          onClick={declineBlocked ? ignoreUnavailableActivation : () => submitDecline(referral.id)}
                        >
                          Record decline
                        </button>
                        {declineBlocked ? (
                          <span id={`ward-ed-inbox-decline-blocked-${referral.id}`} className="sr-only">
                            {declineBlocked}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {/* Scoped to THIS row — see the `declineRejection` state's own note. A refusal
                        the reducer raised about another referral must never be read as this one's. */}
                    {declineRejection?.referralId === referral.id ? (
                      <p
                        className={styles.rejection}
                        role="alert"
                        data-testid={`ward-ed-inbox-decline-rejection-${referral.id}`}
                      >
                        Decline not recorded: {declineRejection.rejection.reason}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/*
         * RECENTLY ANSWERED — owner ruling 7, 2026-09-01. Directly beneath the inbox because it is
         * the same clinician's own question a moment later: "what did I just decide, and why?" The
         * row a clinician just declined has already left the inbox above — that list is a worklist
         * — so without this section there is no undo, no record on this screen, and nothing to
         * check a mistake against.
         *
         * ⚠️ **`data-testid` VALUES ARE `ward-ed-answered-*`, NEVER `ward-ed-inbox-*`.** Two tests
         * in this suite assert an answered row DISAPPEARS from `ward-ed-inbox-row-<id>` — that is
         * "the only success signal on screen" for a decline, per their own comments — and
         * `getAllByTestId(/^ward-ed-inbox-row-/)` would silently grow to include this section's
         * rows too. Reusing the inbox's prefix here would turn both green tests red BECAUSE this
         * feature works; the distinct prefix is what keeps them passing while proving something new.
         *
         * Same structure and classes as the inbox section above, on purpose — a coordinator moving
         * between the two should not have to learn a second layout.
         */}
        <section aria-label="Recently answered" className={styles.listSection} data-testid="ward-ed-answered">
          <h2 className={styles.sectionHeading}>
            Recently answered &middot;{" "}
            {answeredAll.length > ANSWERED_VISIBLE_CAP
              ? `${answered.length} of ${answeredAll.length}`
              : answeredAll.length}{" "}
            referral{answeredAll.length === 1 ? "" : "s"}
          </h2>
          <p className={styles.unitMeta}>
            Referrals addressed to psychiatry at {department.name} that have already been answered — accepted, declined,
            or cancelled because another destination accepted first — most recently decided first. A row here has
            already left the inbox above; nothing on this list is still waiting on this team. The ten most recently
            decided are shown; the heading counts every one.
          </p>
          {answeredAll.length === 0 ? (
            <p className={styles.placeholder} data-testid="ward-ed-answered-empty">
              Nothing addressed to psychiatry at {department.name} has been answered yet.
            </p>
          ) : (
            <ul className={styles.cardList}>
              {answered.map(({ referral, addressing, destination }) => (
                <li
                  key={`${referral.id}-${destination.edId}-${destination.purpose}`}
                  className={styles.card}
                  data-testid={`ward-ed-answered-row-${referral.id}`}
                  data-purpose={destination.purpose}
                  data-ed-id={destination.edId}
                  data-state={addressing.state}
                >
                  <header className={styles.cardHeader}>
                    <strong>{referral.id}</strong>
                    <span className={styles.cardMeta} data-testid={`ward-ed-answered-purpose-${referral.id}`}>
                      {referralPurposeLabel(destination.purpose)}
                    </span>
                  </header>
                  <p className={styles.referralState} data-testid={`ward-ed-answered-state-${referral.id}`}>
                    {answeredAddressingLabel(addressing)}
                  </p>
                  {/*
                   * Fix 3 of the final fix wave, 2026-09-02: this section is titled "Recently
                   * answered", sorted by `decidedAt`, and blurbed "most recently decided first" —
                   * yet showed no decision time anywhere, so a clinician could not tell whether the
                   * top row was four minutes old or last Tuesday's. `formatInstantWithDay` is the
                   * same helper the referral board's decided section already renders its "Decided"
                   * column with (`referral-board.tsx`) — reused rather than reinvented.
                   *
                   * Renders nothing when `decidedAt` is absent rather than a placeholder: a missing
                   * decision time is a gap in the record, and a fallback string here would read as
                   * a real time nobody actually recorded.
                   */}
                  {addressing.decidedAt !== undefined ? (
                    <p className={styles.cardMeta} data-testid={`ward-ed-answered-decided-${referral.id}`}>
                      Decided {formatInstantWithDay(addressing.decidedAt, now)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
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
         * handover ready" are gated on stage `pulled`, and that section is where a card's stage
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
                      {/*
                       * THE URGENCY TIER, BESIDE THE STAGE, ON EVERY ROW — owner ruling, 2026-08-31.
                       *
                       * ⚠️ **UNCONDITIONAL, TIER 3 INCLUDED.** Showing it only on tiers 1 and 2 would
                       * make its ABSENCE the signal for tier 3, and this project has repeatedly proved
                       * that nobody reads an absence. Same position on every card, whatever the tier.
                       *
                       * `urgencyTierLabel`, never a second spelling: the boards, the pickers and this
                       * row must all say "Tier 3 · least urgent" in the same words.
                       *
                       * Neutral tone for all three tiers by design — see `.tierLabel` in ed.module.css.
                       */}
                      <span className={styles.tierLabel} data-testid={`ward-ed-outbox-tier-${movement.id}`}>
                        {urgencyTierLabel(movement.urgency)}
                      </span>
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
            (() => {
              const referralBlocked = referralDraftBlockedReason(draft);
              return (
                <form className={styles.referralForm} onSubmit={submitReferral} data-testid="ward-ed-referral-form">
                  <div className={styles.referralGrid}>
                    <label className={styles.referralField}>
                      Cohort
                      <select
                        data-testid="ward-ed-referral-cohort"
                        value={draft.cohort ?? NO_COHORT_VALUE}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            cohort: event.target.value === NO_COHORT_VALUE ? undefined : (event.target.value as Cohort),
                          }))
                        }
                      >
                        {/* Nothing chosen, first and selected — never a cohort standing in for a
                            decision nobody made. Same idiom as `NO_DECLINE_REASON_VALUE` below. */}
                        <option value={NO_COHORT_VALUE}>Choose a cohort</option>
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
                        data-testid="ward-ed-referral-security"
                        value={draft.security ?? NO_SECURITY_VALUE}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            security:
                              event.target.value === NO_SECURITY_VALUE ? undefined : (event.target.value as Security),
                          }))
                        }
                      >
                        <option value={NO_SECURITY_VALUE}>Choose a security level</option>
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
                        data-testid="ward-ed-referral-sex"
                        value={draft.sex ?? NO_SEX_VALUE}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            sex: event.target.value === NO_SEX_VALUE ? undefined : (event.target.value as Sex),
                          }))
                        }
                      >
                        <option value={NO_SEX_VALUE}>Choose a sex</option>
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
                        data-testid="ward-ed-referral-legal-status"
                        value={draft.legalStatus ?? NO_LEGAL_STATUS_VALUE}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            legalStatus:
                              event.target.value === NO_LEGAL_STATUS_VALUE
                                ? undefined
                                : (event.target.value as LegalStatus),
                          }))
                        }
                      >
                        <option value={NO_LEGAL_STATUS_VALUE}>Choose a legal status</option>
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
                        value={draft.urgency ?? NO_URGENCY_VALUE}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            urgency:
                              event.target.value === NO_URGENCY_VALUE
                                ? undefined
                                : (Number(event.target.value) as 1 | 2 | 3),
                          }))
                        }
                      >
                        {/* Nothing chosen, first and selected — same idiom as the other four
                            selects above. The option TEXT still carries the tier's direction, the
                            option VALUE still stays the bare tier — so `Movement["urgency"]`, the
                            change handler above and every test reading option values are
                            unchanged. This picker once rendered "1", "2", "3" with nothing saying
                            which end is urgent — and a clinician reading the bigger number as
                            "most urgent" files the LEAST urgent referral for the sickest patient.
                            Urgency outranks everything in the queue, so that error sorts the
                            patient to the bottom and no later screen contradicts it. Labelled
                            from `urgencyTierLabel`, the same export the boards read the field
                            back with. */}
                        <option value={NO_URGENCY_VALUE}>Choose an urgency tier</option>
                        {URGENCY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {urgencyTierLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {/* A checkbox cannot distinguish "not required" from "not yet answered" — its unticked
                        state is both. Two radios can, so "Not required" is now STATED. */}
                    <fieldset className={styles.referralCheckbox}>
                      <legend>One-to-one nursing</legend>
                      <label>
                        <input
                          type="radio"
                          name="ward-ed-referral-specialling"
                          data-testid="ward-ed-referral-specialling-required"
                          checked={draft.specialling === true}
                          onChange={() => setDraft((current) => ({ ...current, specialling: true }))}
                        />
                        Required
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="ward-ed-referral-specialling"
                          data-testid="ward-ed-referral-specialling-not-required"
                          checked={draft.specialling === false}
                          onChange={() => setDraft((current) => ({ ...current, specialling: false }))}
                        />
                        Not required
                      </label>
                    </fieldset>
                  </div>
                  <div className={styles.actionRow}>
                    {/*
                     * Unavailable the repo way — `aria-disabled` plus an inert `onClick` plus a
                     * `title` plus an `sr-only` reason, the same shape the decline confirm above
                     * uses, not the native `disabled` the examination form below uses: this
                     * control is unavailable for a STATED reason (five fields still unanswered),
                     * not for the transient reasons native `disabled` is reserved for. The click
                     * path is covered by `ignoreUnavailableActivation`'s `preventDefault`; the
                     * Enter-from-a-field path is covered by `submitReferral`'s own guard, because
                     * (unlike the decline panel) this control sits inside a real `<form>`.
                     */}
                    <button
                      type="submit"
                      data-testid="ward-ed-referral-submit"
                      className={styles.acceptButton}
                      aria-disabled={referralBlocked ? "true" : undefined}
                      aria-describedby={referralBlocked ? "ward-ed-referral-blocked" : undefined}
                      title={referralBlocked ?? undefined}
                      onClick={referralBlocked ? ignoreUnavailableActivation : undefined}
                    >
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
                    {referralBlocked ? (
                      <span id="ward-ed-referral-blocked" className="sr-only">
                        {referralBlocked}
                      </span>
                    ) : null}
                  </div>
                </form>
              );
            })()
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
                const withdrawBlocked = withdrawReferralBlockedReason(movement);
                const withdrawOpen = withdrawOpenFor === movement.id;
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

                    {/*
                     * WHERE THIS PATIENT IS, AND HOW URGENT THEY ARE, ON ONE LINE — owner ruling,
                     * 2026-08-31: the tier goes beside the stage so a glance takes in position and
                     * priority together.
                     *
                     * ⚠️ **THIS LINE IS THIS CARD'S STAGE, AND THAT IS WORTH SAYING PLAINLY.** Unlike
                     * the outbox row above, a patients card has no dedicated stage element: this
                     * paragraph is the card's one statement of position in the flow, and
                     * `stageCopy[movement.stage].label` is literally what it falls back to once no
                     * unit has accepted and nothing has been referred. So this is where "beside the
                     * stage" lands here — not the header, which carries identity and demographics.
                     *
                     * ⚠️ **UNCONDITIONAL, TIER 3 INCLUDED.** Rendered outside the ternary above on
                     * purpose: the tier does not depend on the acceptance state and must not vary
                     * with it. If it showed only on tiers 1 and 2 its ABSENCE would become the
                     * signal for tier 3, and nobody reads an absence.
                     *
                     * `urgencyTierLabel` is the one spelling; a bare digit here would say nothing
                     * about which end of the scale is urgent.
                     *
                     * ⚠️ The test id is `ward-ed-tier-`, NOT the `ward-ed-patient-tier-` it obviously
                     * wants to be: `ui-ward-roles.spec.ts` and `ward-ed-psychiatry-hub.dom.test.tsx`
                     * both select patient rows by the PREFIX `ward-ed-patient-`, so that name would
                     * silently double their row counts. Do not "tidy" it back.
                     */}

                    {/*
                     * OWNER RULING, 2026-09-02: "when a patient is referred on the ED referral
                     * board, it should say where they have been referred to, the referral status,
                     * wait time".
                     *
                     * WHERE — the units' own NAMES, resolved from the live `units` the way every
                     * other row on this screen resolves them, never a bare id and never the count
                     * this row used to show above. A count tells a clinician a referral exists; it
                     * does not tell them whether the ward they are about to ring is already on it.
                     *
                     * STATUS — derived from what the movement actually holds, not from a referral
                     * record: nothing joins a `Movement` to a `Referral`, and inventing that join
                     * here is how a plausible wrong answer gets rendered.
                     *
                     * ⚠️ WAIT TIME — TWO CLOCKS, AND THE SECOND ONE IS USUALLY ABSENT ON PURPOSE.
                     *
                     * When this comment was written a `Movement` carried `openedAt`, `acceptedAt`,
                     * `formedAt` and `pullExpiresAt` and NO `referredAt`, so "how long since we
                     * referred them" had no source and this row said so. The owner then added the
                     * field (2026-09-02), and `REFER_TO_UNITS` now stamps it.
                     *
                     * ⚠️ THAT DID NOT MAKE THE SECOND CLOCK APPEAR ON THE SEED. `referredAt` is
                     * written only by the event, so every movement that was seeded already
                     * referred has none — nobody recorded the moment, because in the demo it never
                     * happened. Those rows still say "referral time not recorded", which is the
                     * true answer. Substituting `openedAt` under a "referred" label would answer a
                     * different question while reading as plausible — the exact substitution the
                     * outbox's own comment forbids twenty lines up.
                     */}
                    {movement.referredUnitIds.length > 0 ? (
                      <div className={styles.outstandingItem} data-testid={`ward-ed-referred-${movement.id}`}>
                        <span className={styles.outstandingLabel}>Referred to</span>
                        <span>
                          {movement.referredUnitIds
                            .map((unitId) => units.find((unit) => unit.id === unitId)?.name ?? "Unit not recorded")
                            .join(" · ")}
                          {" — "}
                          {acceptedUnit
                            ? `accepted at ${acceptedUnit.name}`
                            : movement.referredUnitIds.length === 1
                              ? "awaiting an answer"
                              : `awaiting an answer from ${movement.referredUnitIds.length}`}
                          {" · "}
                          {splitDuration(minutesInDepartment)} in {department.name}
                          {" · "}
                          {movement.referredAt === undefined ? (
                            <span className={styles.cardMeta}>referral time not recorded</span>
                          ) : (
                            <>{splitDuration(Math.max(now - movement.referredAt, 0))} since referral</>
                          )}
                        </span>
                      </div>
                    ) : null}
                    <p className={styles.referralState}>
                      {acceptedUnit
                        ? `Accepted at ${acceptedUnit.name}`
                        : movement.referredUnitIds.length > 0
                          ? `Referred to ${movement.referredUnitIds.length} unit${movement.referredUnitIds.length === 1 ? "" : "s"}`
                          : stageCopy[movement.stage].label}{" "}
                      <span className={styles.tierLabel} data-testid={`ward-ed-tier-${movement.id}`}>
                        {urgencyTierLabel(movement.urgency)}
                      </span>
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
                       * because the two share one precondition: stage `pulled`.**
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
                      <button
                        type="button"
                        data-testid={`ward-ed-withdraw-referral-toggle-${movement.id}`}
                        aria-disabled={withdrawBlocked ? "true" : undefined}
                        aria-describedby={
                          withdrawBlocked ? `ward-ed-withdraw-referral-unavailable-${movement.id}` : undefined
                        }
                        title={withdrawBlocked ?? undefined}
                        aria-expanded={withdrawOpen}
                        className={styles.declineButton}
                        onClick={
                          withdrawBlocked ? ignoreUnavailableActivation : () => toggleWithdrawReferral(movement.id)
                        }
                      >
                        Withdraw referral
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
                    {withdrawBlocked ? (
                      <span id={`ward-ed-withdraw-referral-unavailable-${movement.id}`} className="sr-only">
                        {withdrawBlocked}
                      </span>
                    ) : null}

                    {/*
                     * ⚠️ **TWO STEPS, AND NOT FOR SYMMETRY WITH THE PANELS AROUND IT.** Withdrawing
                     * closes the movement, and NOTHING IN THE MODEL REVERSES IT — there is no
                     * un-withdraw event, so a mis-click is permanent and the record would then say a
                     * referrer took this patient back when nobody did. The other controls on this
                     * card open a panel because they need answers; this one opens a panel because it
                     * needs a second before something irreversible happens.
                     *
                     * Not a `<form>`, for the reason the transport panel states in full above: a
                     * form submits on Enter regardless of what its button advertises.
                     */}
                    {withdrawOpen && !withdrawBlocked ? (
                      <div className={styles.declineForm} data-testid={`ward-ed-withdraw-referral-${movement.id}`}>
                        <p className={styles.cardMeta}>
                          {movement.referredUnitIds.length === 1
                            ? `Withdraw the referral for ${movement.id}? This says the patient no longer needs a bed, so it withdraws that referral and closes the movement.`
                            : `Withdraw every live referral for ${movement.id}? This says the patient no longer needs a bed, so it withdraws all ${movement.referredUnitIds.length} of them at once and closes the movement.`}{" "}
                          It cannot be undone, and it does not say where the patient went.
                        </p>
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            data-testid={`ward-ed-withdraw-referral-confirm-${movement.id}`}
                            className={styles.declineButton}
                            onClick={() => confirmWithdrawReferral(movement.id)}
                          >
                            Withdraw referral
                          </button>
                          <button
                            type="button"
                            data-testid={`ward-ed-withdraw-referral-cancel-${movement.id}`}
                            className={styles.acceptButton}
                            onClick={() => setWithdrawOpenFor(undefined)}
                          >
                            Keep the referral
                          </button>
                        </div>
                      </div>
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
                            value={urgencyDraft.reason ?? NO_CHANGE_REASON_VALUE}
                            onChange={(event) =>
                              setUrgencyDraft((current) => ({
                                ...current,
                                reason:
                                  event.target.value === NO_CHANGE_REASON_VALUE
                                    ? undefined
                                    : (event.target.value as UrgencyChangeReason),
                              }))
                            }
                          >
                            <option value={NO_CHANGE_REASON_VALUE}>Choose a reason</option>
                            {URGENCY_CHANGE_REASONS.map((reason) => (
                              <option key={reason} value={reason}>
                                {changeReasonLabels[reason]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="submit"
                          className={styles.declineSubmit}
                          aria-disabled={urgencyDraft.reason === undefined ? "true" : undefined}
                          aria-describedby={
                            urgencyDraft.reason === undefined ? `ward-change-urgency-blocked-${movement.id}` : undefined
                          }
                          title={urgencyDraft.reason === undefined ? URGENCY_REASON_UNCHOSEN : undefined}
                          onClick={urgencyDraft.reason === undefined ? ignoreUnavailableActivation : undefined}
                        >
                          Record urgency change
                        </button>
                        {urgencyDraft.reason === undefined ? (
                          <span id={`ward-change-urgency-blocked-${movement.id}`} className="sr-only">
                            {URGENCY_REASON_UNCHOSEN}
                          </span>
                        ) : null}
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
                            value={legalStatusDraft.reason ?? NO_CHANGE_REASON_VALUE}
                            onChange={(event) =>
                              setLegalStatusDraft((current) => ({
                                ...current,
                                reason:
                                  event.target.value === NO_CHANGE_REASON_VALUE
                                    ? undefined
                                    : (event.target.value as LegalStatusChangeReason),
                              }))
                            }
                          >
                            <option value={NO_CHANGE_REASON_VALUE}>Choose a reason</option>
                            {LEGAL_STATUS_CHANGE_REASONS.map((reason) => (
                              <option key={reason} value={reason}>
                                {changeReasonLabels[reason]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="submit"
                          className={styles.declineSubmit}
                          aria-disabled={legalStatusDraft.reason === undefined ? "true" : undefined}
                          aria-describedby={
                            legalStatusDraft.reason === undefined
                              ? `ward-change-legal-status-blocked-${movement.id}`
                              : undefined
                          }
                          title={legalStatusDraft.reason === undefined ? LEGAL_STATUS_REASON_UNCHOSEN : undefined}
                          onClick={legalStatusDraft.reason === undefined ? ignoreUnavailableActivation : undefined}
                        >
                          Record legal status change
                        </button>
                        {legalStatusDraft.reason === undefined ? (
                          <span id={`ward-change-legal-status-blocked-${movement.id}`} className="sr-only">
                            {LEGAL_STATUS_REASON_UNCHOSEN}
                          </span>
                        ) : null}
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
                      /*
                       * 🔴 **THE CLEANING COUNT SITS BESIDE THE FIGURE, AND THE FIGURE DOES NOT MOVE.**
                       * Owner ruling 2026-09-05, ported here from the capacity screen on 2026-09-06.
                       *
                       * "Ready" counts beds the application itself refuses to admit a patient into —
                       * `ward-flow-reducer.ts` rejects `PULL_PATIENT` with *"every free bed at X is
                       * still being made ready"*. A reader of this table forms a belief about how many
                       * beds a ward has free, and that belief is exactly what the ruling protects.
                       *
                       * ⚠️ **THIS TABLE IS READ-ONLY AND THAT IS NOT A REASON TO OMIT IT.** Nothing
                       * here can be actioned, but the number is still read and still acted on
                       * elsewhere; a figure that overstates availability does its damage wherever it is
                       * believed, not only where it is clicked.
                       *
                       * ⚠️ **`bedsPendingPreparation` IS THE REDUCER'S OWN HELPER — the same function
                       * whose result gates the refusal.** It is called rather than re-derived so this
                       * screen and that refusal cannot disagree about which beds are still being made
                       * ready. A second computation of the same idea is how two screens come apart.
                       */
                      const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
                      return (
                        <tr key={unit.id}>
                          <th scope="row">{unit.name}</th>
                          <td>{unit.cohort}</td>
                          <td>{designationSummary(unit)}</td>
                          <td data-testid={`ward-ed-capacity-ready-${unit.id}`}>
                            {capacity.available}
                            {pendingPreparation > 0 ? (
                              <small
                                className={styles.beingMadeReady}
                                data-testid={`ward-ed-capacity-pending-${unit.id}`}
                              >
                                {pendingPreparation} still being made ready
                              </small>
                            ) : null}
                          </td>
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
