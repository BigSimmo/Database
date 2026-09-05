"use client";

import {
  ArrowLeft,
  BedSingle,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Search,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import Link from "next/link";

import { ContextualBackLink } from "@/components/contextual-back-link";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  clockState,
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { MissingValue } from "@/components/ui/missing-value";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import {
  candidateReason,
  destinationNoLongerLawful,
  eligibleCandidatesAmong,
  isOpen,
  movementHealthService,
  restrictionNotice,
  stageCopy,
  transportNeedState,
  transportStatusLabel,
} from "@/components/ward-management/ward-derivations";
import { changeReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { legalFormNameLabelFirst } from "@/components/ward-management/ward-legal-forms";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  MOVEMENT_STAGES,
  type DeclineReason,
  type LegalForm,
  type Movement,
  type MovementStage,
  type MovementId,
  type Unit,
} from "@/components/ward-management/ward-model";
import { WardChip, type WardChipLevel } from "@/components/ward-management/ward-chip";
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";

import styles from "./ward-management.module.css";

/**
 * Task 10 (spec item 8). `changeReasonLabels` covers the four reason lists in
 * `ward-change-reasons.ts` but not `DeclineReason` — declines are a fifth, older fixed list
 * (`DECLINE_REASONS` in `ward-model.ts`) that predates that file. Same discipline: chosen, never
 * typed, operational and content-free, never a raw snake_case code on screen.
 */
const declineReasonLabels: Record<DeclineReason, string> = {
  no_bed: "No bed available",
  sex_mix: "Sex mix",
  specialling_unavailable: "Specialling unavailable",
  acuity_mix: "Acuity mix",
  capability_mismatch: "Capability mismatch",
  bed_pulled_for_earlier_referral: "Bed pulled for earlier referral",
  out_of_catchment: "Out of catchment",
};

/**
 * The "label (code) · …" line for a legal form, shared by the readiness card and the legal
 * panel below. Neither a Form 1A nor a Form 3B carries a `dueAt` in this model (see `LegalForm`'s
 * own doc comment in ward-model.ts) — this states that absence explicitly rather than ever
 * formatting an undefined instant, which is how "due NaN:NaN" would ship.
 *
 * The wording is deliberately "no deadline recorded", not "no statutory deadline". It reports
 * what THIS RECORD holds, which is all we can verify. "No statutory deadline" asserts what the
 * Mental Health Act requires, and that is a legal claim this prototype is not entitled to make in
 * either direction — asserting an absence is the same overreach as asserting the seven-day figure
 * that was deleted on 2026-08-23.
 *
 * `formatInstantWithDay`, never `formatInstant`: a bare clock face discards the day, so a deadline
 * that has rolled past midnight prints unchanged and now reads as hours in the future rather than
 * hours overdue — observed on WF-004 (movement-workspace-review-2026-09-04.md, finding 3). A
 * breached deadline also says so in words, from `clockState`, because the wrong-day clock face is
 * exactly the kind of silent wrongness this line must not repeat with a silent breach.
 */
function legalFormReadinessLine(legalForm: LegalForm, now: Instant): string {
  // A code this model holds no label for — Form 3D — is named by its code alone, never by a
  // guessed expansion and never by the word "undefined".
  const named = legalFormNameLabelFirst(legalForm);
  if (legalForm.dueAt === undefined) return `${named} · no deadline recorded`;
  const when = formatInstantWithDay(legalForm.dueAt, now);
  if (clockState(legalForm.dueAt, now) === "breached") {
    return `${named} · due ${when} — ${formatRemaining(minutesUntil(legalForm.dueAt, now))}`;
  }
  return `${named} · due ${when}`;
}

const stageIcons = {
  placement_requested: FileCheck2,
  destination_review: Search,
  accepted_awaiting_bed: BedSingle,
  pulled: CalendarDays,
  handover_ready: ShieldCheck,
  moving: Truck,
  arrived: CheckCircle2,
} satisfies Record<MovementStage, LucideIcon>;

/**
 * WHEN THIS MOVEMENT REACHED A GIVEN STAGE, or `undefined` when nothing recorded it.
 *
 * ⚠️ `stageChanges` FIRST, ALWAYS. It is the only field that records a stage transition as such;
 * the per-stage fields below are the model's older, partial coverage of the same events and exist
 * for the stages `stageChanges` may not carry on a hand-authored fixture.
 *
 * ⚠️ FOUR OF THE SEVEN STAGES HAVE NO TIMESTAMP FIELD AT ALL — `pulled`, `handover_ready`, and
 * `destination_review`/`arrived` in some shapes. That is why this returns `undefined` rather than
 * substituting `openedAt` or `now`: a completed step whose time nobody recorded says so in words
 * on screen. A guessed instant would be indistinguishable from a recorded one.
 */
/**
 * Exported ONLY so `tests/ward-stage-reached-at.test.ts` can drive the real function.
 *
 * ⚠️ IT WAS PRIVATE, AND THE TEST MIRRORED IT — WHICH GUARDED NOTHING. A re-implementation
 * agrees with itself forever: reverting either decision below left every behavioural assertion
 * green, because they were exercising the copy. Measured, not assumed — the mutation caught only
 * the source-text pin. Exporting deletes the mirror and the whole class of drift with it.
 */
/**
 * WHAT TO SAY WHEN A MOVEMENT'S RECORDED ORIGIN DEPARTMENT CANNOT BE RESOLVED.
 *
 * ⚠️ IT NAMES THE ID, AND IT NEVER SAYS "NOT RECORDED". `Movement.originEdId` is a REQUIRED
 * `string`, so an origin id is always recorded; `allEmergencyDepartments().find(...)` returns
 * `undefined` only when that recorded id matches no department. Saying "no origin department is
 * recorded" therefore reports the wrong absence entirely — a lookup miss dressed as a missing
 * record — and sends whoever reads it to look for the wrong thing.
 *
 * The wording is not new. Five other surfaces already render exactly this sentence for exactly this
 * case (`escalation-board`, `handover-page`, `officer-screen`, `patient-search`, `live-tracker`).
 * This file was the sixth and said something else, in TWO places.
 *
 * ⚠️ AND THE SECOND PLACE IS THE POINT. One site was reported to me; the other was fifteen lines
 * from a row I had repaired earlier the same night in the same panel. **When you repair a row, read
 * the panel. When you repair a panel, read the page.** A function, rather than a sixth and seventh
 * copy of the string, is what makes the next site inherit this instead of re-earning it.
 */
/**
 * Which figures carry amber, and which urgent fact the ceiling withheld.
 *
 * 🔴 **EXTRACTED SO THE PROPERTY CAN BE TESTED OVER EVERY COMBINATION, not over whichever one the
 * fixture happens to produce.** While this lived inline it was reachable only through a patient who
 * met all three conditions at once, so the case it exists for — the sickest movement on the board —
 * was the single hardest case to construct and therefore the one nobody checked.
 *
 * ⚠️ **`WardFigureStrip` THROWS above two flagged tiles**, and that ceiling is deliberate: amber
 * means "look here" and directs the eye nowhere when everything carries it. So a third urgent fact
 * cannot be given amber. Before 2026-09-06 it was simply dropped and nothing said so, which made
 * the screen assert "these two are the urgent things" on the one patient for whom three were.
 *
 * ⚠️ **A REORDER IS NOT A FIX.** Whichever key sorts third still vanishes; only the identity of the
 * vanished fact changes. What this returns instead is the withheld fact BY NAME, for the caller to
 * state in words — the ceiling keeps deciding the colour and stops deciding what the reader is told.
 *
 * Order is the owner's ruling, 2026-09-06: a breached deadline, then the declines, and the expired
 * hold yields. A refusal is a fact a coordinator must act on; an expired hold is usually already
 * known to whoever let it expire.
 */
export const URGENT_FIGURE_FLAG_CEILING = 2;

export function urgentFigureFlags(conditions: { deadlineBreached: boolean; declined: boolean; pullExpired: boolean }): {
  flagged: Set<string>;
  withheldFlags: string[];
} {
  const labels: Record<string, string> = {
    deadline: "the passed deadline on the legal form",
    declines: "the wards that have declined",
    pull: "the hold on the bed, which has run out",
  };
  const urgent = [
    conditions.deadlineBreached ? "deadline" : undefined,
    conditions.declined ? "declines" : undefined,
    conditions.pullExpired ? "pull" : undefined,
  ].filter((key): key is string => key !== undefined);

  return {
    flagged: new Set(urgent.slice(0, URGENT_FIGURE_FLAG_CEILING)),
    withheldFlags: urgent.slice(URGENT_FIGURE_FLAG_CEILING).map((key) => labels[key] ?? key),
  };
}

export function unresolvedOriginDepartment(movement: Movement): string {
  return `No synthetic department matches "${movement.originEdId}"`;
}

export function stageReachedAt(movement: Movement, stage: MovementStage): Instant | undefined {
  /*
   * 🔴 `findLast`, NOT `find` — THE CURRENT VISIT, NOT THE FIRST ONE EVER.
   *
   * A movement can return to an earlier stage and reach it again: accept, withdraw the acceptance,
   * re-refer, re-accept. `find` returns the FIRST `accepted_awaiting_bed` transition, so the
   * current-step sentence dated the movement from the decision that was WITHDRAWN, while
   * `acceptedAt` beside it held the newer one. Two fields on one screen disagreeing, with the
   * older one presented as the current state.
   */
  const recorded = movement.stageChanges.findLast((change) => change.to === stage);
  if (recorded) return recorded.at;
  if (stage === "placement_requested") return movement.openedAt;
  if (stage === "destination_review") return movement.referredAt;
  if (stage === "accepted_awaiting_bed") return movement.acceptedAt;
  /*
   * 🔴 `collectedAt`, NOT `enRouteAt`. The reducer enters `moving` on `PATIENT_COLLECTED`
   * (ward-flow-reducer.ts case at 1584, `stage: "moving"` at 1595) — never on
   * `TRANSPORT_EN_ROUTE`, which leaves the movement at `handover_ready`. So `enRouteAt` is the
   * time the CREW set off, not the time the PATIENT began moving, and it is always the earlier of
   * the two.
   *
   * Measured on the seeded fixture: three movements carry both and all three differ —
   * WF-006 en route -15 / collected -7, WF-007 -25 / -10, WF-014 -10 / -4. The workspace was
   * claiming WF-006 had been moving for eight minutes longer than it had.
   *
   * No fallback to `enRouteAt`: a movement with transport en route but not collected has not
   * reached `moving` at all, so there is no time to report. `undefined` makes the screen say the
   * step's time was not recorded, which is true — and the doc comment above is explicit that a
   * guessed instant would be indistinguishable from a recorded one.
   */
  if (stage === "moving") return movement.transport?.collectedAt;
  if (stage === "arrived") {
    if (movement.transport?.arrivedAt !== undefined) return movement.transport.arrivedAt;
    return movement.closure?.outcome === "arrived" ? movement.closure.at : undefined;
  }
  return undefined;
}

type StepState = "done" | "current" | "stopped" | "ahead";

/**
 * THE PROGRESS TRACK FOR ONE PATIENT — and the deletion that matters more than the addition.
 *
 * ⚠️ THIS USED TO RENDER `stageSummaries(movements)`: seven counts — 14/9/6/7/2/6/6 on the day it
 * was reviewed — every one of them a fact about OTHER PATIENTS, on one patient's own page, under a
 * heading that reads as this patient's progress. The call is gone, not reworded, and nothing on
 * this page reads the whole `movements` collection any more.
 *
 * ⚠️ AND IT USED TO BE SEVEN BUTTONS. Clicking a stage moved a local `useState` and nothing else —
 * a future step on somebody else's movement was clickable and did nothing. Steps are plain list
 * items now: this is a record of where a patient has got to, not a control.
 *
 * ⚠️ A CLOSED MOVEMENT HAS NO CURRENT STEP. Observed 2026-09-04: the closure banner said the
 * movement was over while step 3 rendered in accent blue as though it were live. The step a closed
 * movement stopped at is marked `stopped`, which is worded and styled as a full stop, never as
 * "you are here".
 */
function MovementTrack({ movement, now, open }: { movement: Movement; now: Instant; open: boolean }) {
  const reachedIndex = MOVEMENT_STAGES.indexOf(movement.stage);
  return (
    <ol className={styles.track} data-testid="ward-console-track">
      {MOVEMENT_STAGES.map((stage, index) => {
        const Icon = stageIcons[stage];
        const state: StepState =
          index < reachedIndex ? "done" : index > reachedIndex ? "ahead" : open ? "current" : "stopped";
        const at = state === "ahead" ? undefined : stageReachedAt(movement, stage);
        return (
          <li className={styles.trackStep} key={stage} data-state={state}>
            <span className={styles.trackMark} aria-hidden="true">
              <Icon aria-hidden="true" />
            </span>
            <span className={styles.trackBody}>
              <strong className={styles.trackLabel}>
                {index + 1}. {stageCopy[stage].label}
              </strong>
              <span className={styles.trackWhen}>{trackStepSentence(movement, state, at, now)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * ONE PLAIN SENTENCE PER STEP, and every absence is one of them.
 *
 * Leads with what is still true and only then names what is missing — "reached, but no time was
 * recorded" describes the patient; "no time recorded" alone describes the database.
 */
function trackStepSentence(movement: Movement, state: StepState, at: Instant | undefined, now: Instant): string {
  if (state === "ahead") return "Not reached.";
  if (state === "stopped") {
    const stopped = movement.closure
      ? `This is where it stopped: ${movement.closure.reason}.`
      : "This is where it stopped. Nothing on the record says why.";
    return at === undefined
      ? `${stopped} No time was recorded for reaching this step.`
      : `${stopped} Reached ${formatInstantWithDay(at, now)}.`;
  }
  if (state === "current") {
    return at === undefined
      ? "This is where the movement is now. No time was recorded for reaching this step."
      : `This is where the movement is now, since ${formatInstantWithDay(at, now)}.`;
  }
  return at === undefined ? "Passed. No time was recorded for this step." : `Passed ${formatInstantWithDay(at, now)}.`;
}

type Attention = { key: string; who: string; chip: string; level: WardChipLevel; say: string };

/**
 * WHAT IS WRONG WITH THIS ONE MOVEMENT, as sentences — the panel that did not exist before
 * 2026-09-04 and the largest single gain on this page.
 *
 * ⚠️ EVERY ITEM IS A LOCATOR PLUS ONE PLAIN SENTENCE SAYING WHAT IS WRONG AND WHAT IT MEANS. Not a
 * count, not a badge, not a coloured bar. Six of the eleven review findings were things this page
 * held in a field and never said out loud — an expired bed pull, an escort requirement, a stalled
 * referral, an unlawful destination, an unanswered transport question, a breached deadline.
 *
 * ⚠️ NOTHING HERE IS RAISED ON A CLOSED MOVEMENT. An expired bed pull on a movement that closed
 * two hours ago is not something anybody can act on, and listing it as attention would send a
 * coordinator to chase a patient who is not there. The closed case gets one item saying so.
 */
function attentionItems({
  movement,
  units,
  now,
  destination,
  open,
  blockerIsActive,
}: {
  movement: Movement;
  units: Unit[];
  now: Instant;
  destination: Unit | undefined;
  open: boolean;
  blockerIsActive: boolean;
}): Attention[] {
  if (!open) {
    /*
     * ⚠️ THE REASON IS DELIBERATELY NOT REPEATED HERE. The closure panel directly above states it
     * as the page's dominant line, and the step track states it again at the step it stopped on.
     * A third copy in the rail was on screen for ten minutes on 2026-09-04 and read as three
     * different systems each noticing the same thing — this says what the rail is FOR on a closed
     * movement instead: nothing to chase, and which checks were therefore not run.
     */
    return [
      {
        key: "closed",
        who: "Nothing to chase",
        chip: movement.closure?.outcome === "arrived" ? "Arrived" : "Closed",
        level: movement.closure?.outcome === "arrived" ? "accepted" : "cancelled",
        say: "No deadline, bed hold, escort, referral or transport check is raised on this movement, because none of them can be acted on now. What happened, and why it stopped, is stated above.",
      },
    ];
  }

  const items: Attention[] = [];

  const deadline = movement.legalForm?.dueAt;
  if (movement.legalForm && deadline !== undefined) {
    const state = clockState(deadline, now);
    if (state === "breached") {
      items.push({
        key: "deadline",
        who: legalFormNameLabelFirst(movement.legalForm),
        chip: "Overdue",
        level: "urgent",
        say: `The deadline recorded on this form passed at ${formatInstantWithDay(deadline, now)} — ${formatRemaining(minutesUntil(deadline, now))}. Nothing on this record says it has been dealt with.`,
      });
    } else if (state === "critical" || state === "due") {
      items.push({
        key: "deadline",
        who: legalFormNameLabelFirst(movement.legalForm),
        chip: "Due soon",
        level: "stalled",
        say: `This form's recorded deadline is ${formatInstantWithDay(deadline, now)} — ${formatRemaining(minutesUntil(deadline, now))}.`,
      });
    }
  }

  if (movement.pullExpiresAt !== undefined && movement.pullExpiresAt <= now) {
    items.push({
      key: "pull",
      who: destination ? `Bed held at ${destination.name}` : "Bed held for this patient",
      chip: "Hold expired",
      level: "urgent",
      say: `The hold on that bed ran out at ${formatInstantWithDay(movement.pullExpiresAt, now)} — ${formatRemaining(minutesUntil(movement.pullExpiresAt, now))}. Unless the ward has held it anyway, nothing is being kept for this patient.`,
    });
  }

  const unlawful = destinationNoLongerLawful(movement, units);
  if (unlawful) {
    items.push({
      key: "unlawful",
      who: unlawful.name,
      chip: "Not authorised",
      level: "urgent",
      say: `This patient's legal status now requires an authorised destination, and the ward that accepted them is not one. The placement needs revisiting before they travel.`,
    });
  }

  const restriction = destination ? restrictionNotice(movement, destination) : undefined;
  if (restriction) {
    items.push({
      key: "restriction",
      who: destination ? destination.name : movement.id,
      chip: restriction.level === "voluntary_on_locked" ? "Legal risk" : "More restrictive",
      level: restriction.level === "voluntary_on_locked" ? "urgent" : "stalled",
      say: `${restriction.text}.`,
    });
  }

  if (movement.transport?.escortRequired === true) {
    items.push({
      key: "escort",
      who: `Transport — ${movement.transport.provider}`,
      chip: "Escort required",
      level: "stalled",
      say: "This patient must not travel unescorted. The record says an escort is required; it does not say one has been arranged, and there is no field on this movement that could say so.",
    });
  }

  if (movement.declines.length > 0 && movement.acceptedUnitId === undefined) {
    items.push({
      key: "stalled",
      who: `${movement.declines.length} ward${movement.declines.length === 1 ? "" : "s"} declined`,
      chip: "Stalled",
      level: "stalled",
      say: `${movement.declines.length} ward${movement.declines.length === 1 ? " has" : "s have"} declined this movement and none has accepted. Nothing moves until one does, or until somebody escalates.`,
    });
  }

  if (movement.escalation) {
    items.push({
      key: "escalation",
      who: movement.escalation.contact,
      chip: "Escalated",
      level: "stalled",
      say: `This movement was escalated to ${movement.escalation.contact} at ${formatInstantWithDay(movement.escalation.at, now)}. The record does not hold an answer, so somebody has to ask.`,
    });
  }

  // Only once a destination has accepted: before that, "nobody has said whether transport is
  // needed" is the ordinary state of a movement nobody has placed yet, and raising it as attention
  // on every fresh referral is how an attention panel stops being read.
  if (
    transportNeedState(movement) === "not_recorded" &&
    movement.transport === undefined &&
    MOVEMENT_STAGES.indexOf(movement.stage) >= MOVEMENT_STAGES.indexOf("accepted_awaiting_bed")
  ) {
    items.push({
      key: "transport-need",
      who: "Transport",
      chip: "Unanswered",
      level: "routine",
      say: "Nobody has recorded whether this patient needs transport. That is not the same as deciding they do not — a bed is held and no journey is planned.",
    });
  }

  if (blockerIsActive) {
    items.push({
      key: "blocker",
      who: "Recorded by hand",
      chip: "Blocked",
      level: "stalled",
      say: `Somebody wrote: “${movement.blocker}”. That is free prose about what is holding this up, not a ward's answer.`,
    });
  }

  return items;
}

/**
 * ⚠️ **THIS IS A MOVEMENT WORKSPACE, AND ITS PROP NOW SAYS SO.** It was `patientId: string`, and
 * the body looks the value up in `movements` — so the name invited a real patient id and nothing
 * stopped one being passed. It worked only because every call site happened to pass a movement.
 * The prop is now `movementId: MovementId`, so the mistake the old name invited fails to compile
 * rather than rendering a dead-end "no movement matches" page.
 *
 * The ROUTE was `/patients/[patientId]` and just as misleading to a human reader
 * as the prop had been to the compiler. It has since moved to
 * `/mockups/ward-flow/movements/[movementId]`, nested under the existing `movements` mode page —
 * the site map, the reachability assertion and this file's own doc comment all moved with it.
 *
 * ⚠️ **THE PAGE HAS A TENSE NOW, AND THAT WAS THE DEFECT UNDER MOST OF THE OTHERS** (Ward Lead
 * ruling 2, 2026-09-04). A closed movement is a DIFFERENT ARRANGEMENT of this page, not the same
 * page with a banner on top: what happened comes first and dominant, the live tools demote and go
 * quiet, "Current stage" becomes "Stopped at", and the step track shows where it stopped rather
 * than a highlighted step nobody is standing on.
 *
 * ⚠️ **THE READER IS A COORDINATOR WHO ARRIVED FROM A LIST.** Every route in is a list — patient
 * search, the tracker's review link, four mode screens, the network view — so this page never has
 * to introduce the patient. It opens on the answer: what is wrong, then what it means, then the
 * three things a person can actually do.
 */
/**
 * ⚠️ **THE ROUTE USED TO QUOTE BACK AN ID THE USER NEVER TYPED.** `MovementId` is the template
 * literal type `` `WF-${string}` ``, so the bare string `"WF-"` satisfies it — and the route was
 * using exactly that as a sentinel for "this is not a movement id at all", handing it to a page
 * whose not-found sentence then quoted it. `/movements/PT-004` rendered *No synthetic movement
 * matches “WF-”*. Well-typed, so `tsc` could not see it; asserted by no test; and a page telling a
 * clinician something they did not type is the kind of thing that ends up in a screenshot.
 *
 * The sentinel is gone. The route now renders this component directly for a wrong-shaped id, so
 * there is no cast on that path and nothing to quote back wrongly, and the two cases say different
 * things because they ARE different: one is "that is not the sort of thing this screen shows", the
 * other is "it is, and there is no such one".
 *
 * 🔴 AND THE FIRST VERSION OF THIS FIX INTRODUCED A WORSE FALSE STATEMENT THAN THE ONE IT REPLACED.
 * It ended "a person is not a movement, and their record is not reachable from here." A person's
 * record IS reachable: `/mockups/ward-flow/people/[patientId]` renders it, and the patient search
 * links straight to it. So the page sent a coordinator AWAY from the screen holding what they
 * wanted, fluently and with authority. **The old bug quoted nonsense and the reader looked
 * elsewhere; this one was believable.** Caught by an adversarial review, not by me, and not by any
 * test. The lesson is the one worth keeping: every one of these six fixes replaced a sentence with
 * another sentence, and a replacement is a new claim that needs checking exactly as hard as the
 * one it removes.
 */
export function WardMovementNotFound({
  requestedId,
  reason,
}: {
  requestedId: string;
  reason: "no-such-movement" | "not-a-movement-id" | "not-a-person-id";
}) {
  return (
    <div className={styles.patientWorkspace} data-testid="ward-patient-workspace">
      <ClinicalRail />
      <header className={styles.workspaceHeader}>
        <ContextualBackLink fallbackHref="/mockups/ward-flow" aria-label="Back to Ward Flow">
          <ArrowLeft aria-hidden="true" />
        </ContextualBackLink>
        <div>
          <span>Ward Flow</span>
          <span className={styles.headerCrumb}>
            {reason === "not-a-person-id" ? "Person not found" : "Movement not found"}
          </span>
        </div>
        <span className={styles.prototypeBadge}>Synthetic prototype</span>
      </header>
      <main id="main-content" className={styles.workspaceMain}>
        <div className={styles.masthead}>
          <span className={styles.eyebrow}>
            {reason === "not-a-person-id" ? "Person record" : "Movement workspace"}
          </span>
          <h1 className={styles.mastheadTitle}>
            {reason === "not-a-person-id" ? "Person not found" : "Movement not found"}
          </h1>
        </div>
        <p className={styles.governanceNote}>
          {reason === "not-a-person-id" ? (
            <>
              &ldquo;{requestedId}&rdquo; is not a person&rsquo;s record number.{" "}
              {requestedId.startsWith("WF-") ? (
                <>
                  It is a movement id.{" "}
                  <Link href={`/mockups/ward-flow/movements/${requestedId}`}>Open that movement instead</Link>.
                </>
              ) : (
                <>Record numbers begin with PT-. This screen shows one person&rsquo;s own record.</>
              )}
            </>
          ) : reason === "not-a-movement-id" && requestedId.startsWith("PT-") ? (
            <>
              &ldquo;{requestedId}&rdquo; is a person&rsquo;s record number, not a movement id. This screen shows one
              movement at a time.{" "}
              <Link href={`/mockups/ward-flow/people/${requestedId}`}>Open that person&rsquo;s record instead</Link>.
            </>
          ) : reason === "not-a-movement-id" ? (
            <>
              &ldquo;{requestedId}&rdquo; is not a movement id. Movement ids begin with WF-. This screen shows one
              movement at a time.
            </>
          ) : (
            <>
              No synthetic movement matches &ldquo;{requestedId}&rdquo;. It may have arrived and closed, or the id is
              incorrect.
            </>
          )}
        </p>
      </main>
    </div>
  );
}

export function WardPatientWorkspace({ movementId }: { movementId: MovementId }) {
  const { dispatch, movements, now, units } = useWardFlow();
  // Read the live, single source of truth rather than the frozen fixture — a patient just
  // referred on the coordinator screen must resolve here too, and a missing id must render an
  // explicit "not found" rather than ever substituting a different movement.
  const patient: Movement | undefined = movements.find((candidate) => candidate.id === movementId);
  /* The DRAFT only. Never a mirror of `patient.blocker` — the rendered value below reads the record
     itself, so what is on screen after a dispatch is what the reducer actually stored, and a
     refused event cannot leave this page claiming a blocker was recorded. That failure has already
     happened once on this screen (see the Review & confirm button's own comment). */
  const [blockerDraft, setBlockerDraft] = useState("");
  /*
   * ⚠️ THE ELIGIBILITY CALCULATION IS OPT-IN ON A CLOSED MOVEMENT (Ward Lead ruling 1,
   * 2026-09-04, which WITHDREW an earlier instruction to render it with a caveat beside it).
   *
   * This page will eventually be printed or screenshotted into a review of a patient who came to
   * harm. "Eligible now" beside somebody who never got a bed reads as an accusation that a bed was
   * there and nobody took it — and a qualifying sentence is exactly what a screenshot crops, a
   * print truncates and a reader skips. Putting the recomputation behind a control is what makes
   * the caveat survive, because the caveat is then the thing they clicked.
   *
   * The capability is kept in full. Only the default changed. Local state, no dispatch: asking to
   * see a calculation records nothing about the patient.
   */
  const [showClosedEligibility, setShowClosedEligibility] = useState(false);

  if (!patient) {
    return <WardMovementNotFound requestedId={movementId} reason="no-such-movement" />;
  }

  /*
   * This workspace shows the movement's own record only — it never falls back to a
   * suggested/top-eligible unit, so `destination` here is always the real recorded destination
   * or nothing.
   *
   * 🔴 THAT SENTENCE WAS TRUE OF THIS FILE AND FALSE OF THE PAGE, WHICH IS THE WHOLE DEFECT.
   * `destinationUnit` is `movement.acceptedUnitId ?? movement.referredUnitIds[0]`
   * (`ward-derivations.ts:261`) — the fallback is INSIDE the helper, four lines below a comment
   * denying it. So WF-013, with no acceptance and two open referrals, printed "Bound for" one of
   * them chosen arbitrarily while the same page said "Referrals still open · 2" and "No ward has
   * accepted this patient"; and WF-002 printed "Bound for FSH Older Adult" while the eligibility
   * panel marked that ward Not eligible, 0 allocatable.
   *
   * ⚠️ A comment describing what a helper does is a claim about a file you are not reading.
   * This one was written in good faith by someone who had read this file carefully.
   *
   * The helper keeps its fallback — the board and the network want a provisional destination to
   * lay out. This page does not: it is where a coordinator decides whether a bed exists, and
   * "bound for" must mean a ward has said yes. Every no-destination branch the masthead needs was
   * already written below and simply unreachable.
   */
  const destination = patient.acceptedUnitId ? units.find((unit) => unit.id === patient.acceptedUnitId) : undefined;
  const verdict = destination ? eligibility(patient, destination, now) : undefined;
  const candidates = eligibleCandidatesAmong(patient, units, now).filter(
    (candidate) => candidate.unit.id !== destination?.id,
  );
  /*
   * ⚠️ THE DENOMINATOR IS THE COHORT, NOT THE NETWORK (Ward Lead D2, 2026-09-04). The panel read
   * "3 of 23" — 23 being every ward on the map — while `eligibleCandidatesAmong` filters to
   * `unit.cohort === movement.cohort` BEFORE it ranks anything. The network is 16 adult, 6 older
   * adult and 1 youth, so for an adult patient seven wards were never in the running and the
   * denominator overstated the search by seven. Derived here from the live units, never a literal:
   * a ward added to the map tomorrow must move this number the next time the page renders.
   */
  const cohortUnitCount = units.filter((unit) => unit.cohort === patient.cohort).length;
  /*
   * ⚠️ AND ON THE ONE PATIENT NOBODY CAN PLACE, THIS PANEL CONTAINS NO WARD THAT COULD TAKE HIM.
   * Observed on WF-009: three rows under a heading that reads as alternatives, of which two had
   * already declined and the third fails a secure requirement. A coordinator scanning a list
   * headed "Other wards, ranked" reads it as somewhere left to try. The page has to say when it
   * is not, rather than leaving the reader to work it out row by row.
   */
  const usableCandidates = candidates.filter(
    (candidate) =>
      candidate.verdict.eligible && !patient.declines.some((decline) => decline.unitId === candidate.unit.id),
  );
  // Whether this movement is still travelling the pathway at all (`ward-derivations.ts:205`). A
  // closed movement's own eligibility verdict, tier label and transport line must not read as an
  // invitation — see the closure panel and the overrides below, all keyed off this one flag so
  // they can never disagree with each other about whether the movement is open.
  const open = isOpen(patient);
  // Rendered beside BOTH the chosen destination and every alternative — a voluntary patient
  // already routed to a locked ward (finding 2) is the sharper case, and the page said nothing
  // about it before this fix. `restrictionNotice` never touches `verdict.eligible`; it is
  // information, not a gate.
  const destinationRestriction = destination ? restrictionNotice(patient, destination) : undefined;
  /* Read from the SAME closed set `hasActiveBlocker` (ward-priority.ts) uses to decide whether this
     movement scores ten points as obstructed, so the Clear control appears exactly when the score
     says something is blocking. A second hand-written list here is how a screen comes to offer a
     control the reducer refuses — the drift this codebase produces most reliably. */
  const blockerIsActive = !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === patient.blocker.trim());
  // Reads the provider's live units, same as `destination` above — a unit renamed underneath
  // this movement must resolve here too, not to a name frozen at import time. Falls back to the
  // raw id (never a substituted unit) when nothing in the live set matches.
  const unitName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? unitId;
  const originEd = allEmergencyDepartments().find((department) => department.id === patient.originEdId);
  const service = movementHealthService(patient);
  /*
   * 🔴 THE ORIGIN'S SERVICE WAS BEING PRINTED IMMEDIATELY AFTER THE DESTINATION'S NAME.
   * `movementHealthService` resolves the service of the ED a movement STARTED in — its own doc
   * comment says so — and the masthead rendered "Bound for {destination.name}, {service}".
   * WF-008 printed "FRE Adult Open, North Metro"; Fremantle is South Metro, and North Metro is
   * where the patient came from. WF-015 printed the mirror.
   *
   * ⚠️ THE DANGEROUS PROPERTY IS THAT IT IS RIGHT MOST OF THE TIME. It only diverges when origin
   * and destination sit in different services, which is exactly the transfer a coordinator most
   * needs to read correctly — and it is invisible on every movement that stays inside one service.
   *
   * `service` is still correct where it is labelled as the origin's (the "Health service" fact
   * row, whose own fallback sentence names the origin department), so it stays. This is the
   * destination's, and nothing else may use it.
   */
  const destinationService = destination ? siteByCode(destination.siteCode)?.service : undefined;
  const attention = attentionItems({ movement: patient, units, now, destination, open, blockerIsActive });
  const reachedIndex = MOVEMENT_STAGES.indexOf(patient.stage);
  /*
   * ⚠️ AN EMPTY `referredUnitIds` DOES NOT MEAN NOBODY ASKED, AND SAYING SO PUT A FALSE SENTENCE
   * ON THE SCREEN. Observed live on WF-009, 2026-09-04: the tile read "Wards referred to · None ·
   * No ward has been asked to take this patient" directly beside "Wards that declined · 5", and on
   * WF-004 beside "Accepted by BTY Adult Secure". `referredUnitIds` holds the referrals still
   * OPEN — an answered one leaves it — so an empty list beside a decline or an acceptance is an
   * ordinary state of the record, not an absence of asking. The sentence now reconciles the two
   * rather than contradicting the tile next to it.
   *
   * ⚠️ AND THE SUB-LINE WAS NOT ENOUGH, WHICH IS THE PART THIS SECOND FIX ADDS (Ward Lead D1,
   * 2026-09-04). The tile still said "Wards referred to · None" and the number is what gets
   * scanned; a correcting sentence underneath it is read second or not at all. Across the three
   * fixtures the identical "None" meant three different things — nobody asked, one asked and
   * accepted, five asked and all declined — so it never meant what it said. The LABEL is what
   * changed: `referredUnitIds` counts referrals that are still open, and the tile now says so.
   */
  const answeredCount = patient.declines.length + (patient.acceptedUnitId === undefined ? 0 : 1);
  const acceptedName = patient.acceptedUnitId === undefined ? undefined : unitName(patient.acceptedUnitId);
  const referredSub =
    patient.referredUnitIds.length > 0
      ? `Waiting on ${patient.referredUnitIds.map((unitId) => unitName(unitId)).join(", ")}.`
      : answeredCount > 0
        ? `No referral is open. ${patient.declines.length === 0 ? "No ward declined" : `${patient.declines.length} ward${patient.declines.length === 1 ? "" : "s"} declined`}${acceptedName ? `, and ${acceptedName} accepted.` : " and none accepted."}`
        : patient.withdrawnReferrals.length > 0
          ? `No referral is open. ${patient.withdrawnReferrals.length} ${patient.withdrawnReferrals.length === 1 ? "was" : "were"} withdrawn, and no ward has answered.`
          : "No ward has been asked to take this patient.";
  const ranMinutes = Math.max((open ? now : (patient.closure?.at ?? now)) - patient.openedAt, 0);

  /*
   * ⚠️ AT MOST TWO TILES MAY BE FLAGGED, AND `WardFigureStrip` THROWS IF THREE ARE. Amber means
   * "look here" and directs the eye nowhere when everything carries it. So the flags are chosen by
   * priority and then TRUNCATED, rather than each tile deciding for itself — which is how a
   * movement with a breached deadline, an expired hold and five declines would have crashed the
   * page instead of rendering.
   *
   * Nothing is flagged on a closed movement: amber says "act on this", and there is nothing here to
   * act on.
   */
  const deadline = patient.legalForm?.dueAt;
  const deadlineBreached = open && deadline !== undefined && clockState(deadline, now) === "breached";
  const pullExpired = open && patient.pullExpiresAt !== undefined && patient.pullExpiresAt <= now;

  /*
   * 🔴 **THE THIRD SIGNAL IS NAMED IN WORDS RATHER THAN DROPPED IN SILENCE — 2026-09-06.**
   * Until today this list was truncated and nothing said so, which meant the screen asserted "these
   * two are the urgent things" on the one patient for whom three were. The sickest movement on the
   * board — declined, past its legal deadline, and holding a bed that has run out — lost its
   * declines amber and nothing on the page indicated a signal had been withheld.
   *
   * ⚠️ **REORDERING IS NOT THE FIX, AND IT LOOKS LIKE ONE.** Whichever key sorts third disappears,
   * so a reorder only changes which fact vanishes. The ceiling is real and stays — amber means
   * "look here" and directs the eye nowhere when everything carries it — so the ceiling keeps
   * deciding the COLOUR and stops deciding what the reader is told. `withheldFlagLabel` below is
   * what makes the difference visible.
   *
   * Order is the owner's ruling of 2026-09-06: a breached deadline first, then the declines, and
   * the expired hold yields. A refusal is a fact a coordinator must act on; an expired hold is
   * usually already known to whoever let it expire.
   */
  const { flagged, withheldFlags } = urgentFigureFlags({
    deadlineBreached,
    declined: open && patient.declines.length > 0,
    pullExpired,
  });

  // Task 10 (spec item 8): status and urgency changes are the same kind of fact to a reader, so
  // they render as one chronological record rather than two disconnected lists.
  const changeEvents = [
    ...patient.statusChanges.map((change) => ({
      kind: "legal" as const,
      at: change.at,
      by: change.by,
      reasonLabel: changeReasonLabels[change.reason],
      detail: `${change.from} → ${change.to}`,
    })),
    ...patient.urgencyChanges.map((change) => ({
      kind: "urgency" as const,
      at: change.at,
      by: change.by,
      reasonLabel: changeReasonLabels[change.reason],
      detail: `Tier ${change.from} → Tier ${change.to}`,
    })),
  ].sort((a, b) => a.at - b.at);

  /*
   * ⚠️ THE AUDIT TIMELINE IS BUILT HERE, NOT BY `movementTimeline` (review finding 8).
   *
   * That helper emits opened, legal-status changes, declines, four transport stamps and closure,
   * and SILENTLY OMITS escalations, examinations, urgency changes, stage transitions, withdrawn
   * referrals, the acceptance and the bed pull. On WF-009 — five declines, an escalation to the
   * state bed coordination desk and an examination — it showed the five declines and nothing else,
   * under a heading calling itself the audit.
   *
   * It also renders `reason.replace(/_/g, " ")` as "Declined by referral: no bed", which names no
   * unit and reads as though the referral declined, while `declineReasonLabels` sat unused twelve
   * lines away in this very file.
   *
   * `movementTimeline` is left alone because three other screens read it; this page composes its
   * own from the record instead of narrowing what a shared helper reports.
   *
   * ⚠️ AND THE BLURB PROMISED TEN KINDS OF EVENT AND DELIVERED ONE (Ward Lead D3, 2026-09-04).
   * WF-004's timeline held a single row, "Movement opened", on a movement that had reached step 4,
   * had a ward accept it, and had a bed hold run out at 05:40 — a dated fact the figure strip on
   * the SAME PAGE prints in its own tile. The blurb is what made that harmful: a list claiming to
   * hold every dated fact, holding one, turns "nothing was timed" into "nothing happened".
   *
   * Two repairs, in the order the ruling asked for them. First, EMIT: the three dated facts this
   * record holds and this list was throwing away — the bed hold running out, a legal deadline
   * passing, and the moment somebody answered whether transport was needed. Second, tell the
   * truth about the rest: what happened WITHOUT a recorded time is listed under the timeline, in
   * its own words, rather than being silently absent from a list that says it is complete.
   */
  const timeline: Array<{ at: Instant; label: string }> = [
    { at: patient.openedAt, label: "Movement opened" },
    /* Only once it has passed. A future expiry is a countdown, not a dated fact that happened, and
       the figure strip already carries it as one — putting it in a chronological record of events
       would date an event that has not occurred. */
    ...(patient.pullExpiresAt !== undefined && patient.pullExpiresAt <= now
      ? [
          {
            at: patient.pullExpiresAt,
            label: `The hold on the bed${destination ? ` at ${destination.name}` : ""} ran out`,
          },
        ]
      : []),
    // Same rule, and the same reason: a deadline still ahead has not happened yet.
    ...(patient.legalForm?.dueAt !== undefined && patient.legalForm.dueAt <= now
      ? [
          {
            at: patient.legalForm.dueAt,
            label: `The deadline on the ${legalFormNameLabelFirst(patient.legalForm)} passed`,
          },
        ]
      : []),
    ...(patient.transportNeed
      ? [
          {
            at: patient.transportNeed.at,
            label: patient.transportNeed.needed ? "Recorded as needing transport" : "Recorded as needing no transport",
          },
        ]
      : []),
    ...patient.stageChanges.map((change) => ({
      at: change.at,
      label: `Stage ${change.from ? `${stageCopy[change.from].label} → ` : ""}${stageCopy[change.to].label}, by ${change.by}${change.reason ? ` · ${change.reason}` : ""}`,
    })),
    ...patient.statusChanges.map((change) => ({
      at: change.at,
      label: `Legal status ${change.from} → ${change.to}, by ${change.by} · ${changeReasonLabels[change.reason]}`,
    })),
    ...patient.urgencyChanges.map((change) => ({
      at: change.at,
      label: `Urgency Tier ${change.from} → Tier ${change.to}, by ${change.by} · ${changeReasonLabels[change.reason]}`,
    })),
    ...patient.declines.map((decline) => ({
      at: decline.at,
      label: `${unitName(decline.unitId)} declined · ${declineReasonLabels[decline.reason]}`,
    })),
    ...patient.withdrawnReferrals.map((withdrawal) => ({
      at: withdrawal.at,
      label: `Referral to ${unitName(withdrawal.unitId)} withdrawn · ${withdrawal.reason.replaceAll("_", " ")}`,
    })),
    ...(patient.examination
      ? [{ at: patient.examination.at, label: `Examined · ${patient.examination.outcome.replaceAll("_", " ")}` }]
      : []),
    ...(patient.escalation ? [{ at: patient.escalation.at, label: `Escalated to ${patient.escalation.contact}` }] : []),
    ...(patient.acceptedAt !== undefined && patient.acceptedUnitId !== undefined
      ? [{ at: patient.acceptedAt, label: `Accepted by ${unitName(patient.acceptedUnitId)}` }]
      : []),
    ...(patient.transport?.acceptedAt !== undefined
      ? [{ at: patient.transport.acceptedAt, label: `Transport accepted by ${patient.transport.provider}` }]
      : []),
    ...(patient.transport?.enRouteAt !== undefined
      ? [{ at: patient.transport.enRouteAt, label: "Transport en route" }]
      : []),
    ...(patient.transport?.collectedAt !== undefined
      ? [{ at: patient.transport.collectedAt, label: "Patient collected" }]
      : []),
    ...(patient.transport?.arrivedAt !== undefined
      ? [{ at: patient.transport.arrivedAt, label: "Arrived at destination" }]
      : []),
    ...(patient.transport?.cancelledAt !== undefined
      ? [{ at: patient.transport.cancelledAt, label: "Transport cancelled" }]
      : []),
    ...(patient.closure
      ? [
          {
            at: patient.closure.at,
            /* The outcome, not the reason. This list's contribution is WHEN — the reason is the
               dominant line of the closure panel at the top of the page and the step track quotes
               it at the step it stopped on, and a third copy down here was one of the four the
               2026-09-04 judgement counted on WF-008. */
            label: patient.closure.outcome === "arrived" ? "Closed — the patient arrived" : "Closed — did not proceed",
          },
        ]
      : []),
  ].sort((a, b) => a.at - b.at);

  /*
   * WHAT HAPPENED THAT NOTHING TIMED — one sentence each, under the timeline, out of the order.
   *
   * ⚠️ THIS IS THE HALF THAT STOPS AN EMPTY TIMELINE READING AS AN EMPTY MOVEMENT. Every entry
   * here is a fact the record asserts happened while holding no instant for it, so it cannot be
   * placed in a chronological list without inventing a time — which is the one thing this page
   * must never do. Naming them is what tells a reader that the short list above is a gap in the
   * record-keeping, not a quiet patient.
   */
  const untimed: string[] = [];
  if (patient.stageChanges.length === 0 && reachedIndex > 0) {
    untimed.push(
      `This movement has reached step ${reachedIndex + 1} of ${MOVEMENT_STAGES.length}, ${stageCopy[patient.stage].label.toLowerCase()}. Nothing recorded when it moved between the steps, so no stage transition appears above.`,
    );
  }
  if (patient.acceptedUnitId !== undefined && patient.acceptedAt === undefined) {
    untimed.push(`${unitName(patient.acceptedUnitId)} accepted this patient. No time was recorded for the acceptance.`);
  }
  if (patient.pullExpiresAt !== undefined) {
    untimed.push(
      "A bed was pulled and held for this patient. The record holds the moment that hold runs out, but nothing recorded the moment it was pulled.",
    );
  }
  if (patient.transport !== undefined && patient.transport.escortRequired) {
    untimed.push(
      "An escort is required for this journey. Nothing records when that was decided, or whether one has been found — the model has no field for either.",
    );
  }

  const stageChipLevel: WardChipLevel = !open
    ? patient.closure?.outcome === "arrived"
      ? "accepted"
      : "cancelled"
    : "routine";
  const stageChipText = !open
    ? patient.closure
      ? patient.closure.outcome === "arrived"
        ? "Closed — arrived"
        : "Closed — did not proceed"
      : "Arrived"
    : stageCopy[patient.stage].label;

  /* The eligibility block: the destination, its gates, and the ranked alternatives. Rendered
     unconditionally while the movement is open; behind a control once it is closed (see
     `showClosedEligibility` above). */
  const eligibilityBlock = (
    <div data-testid="ward-console-eligibility-summary" className={styles.panelStack}>
      {!open ? (
        <p className={styles.liveCalculationNote}>
          <strong>This is a calculation against the wards as they are right now</strong> — not a record of what was true
          when this movement closed. Nothing recorded that, and there is no snapshot to show. Read it as &ldquo;what
          these wards could take today&rdquo;, never as an offer that was open to this patient.
        </p>
      ) : null}
      <WardPanel
        title={destination ? destination.name : "No destination chosen"}
        count={destination ? (verdict?.eligible ? "Eligible" : "Not eligible") : undefined}
        blurb={
          destination
            ? `Every check below is about this patient against ${destination.name} specifically — the occupancy and allocatable figures are that ward's, not a network total.`
            : "Nobody has chosen a destination for this patient, so there is nothing to check them against yet."
        }
      >
        <div className={styles.panelBody}>
          {destination ? (
            <>
              <p className={styles.panelLede}>
                {verdict ? candidateReason(verdict) : <MissingValue reason="not_yet_calculated" />}
              </p>
              {destinationRestriction ? (
                <p
                  className={styles.legalRisk}
                  data-testid="ward-console-destination-restriction"
                  data-restriction={destinationRestriction.level}
                >
                  {destinationRestriction.text}
                </p>
              ) : null}
              {verdict ? (
                <ul className={styles.gateList}>
                  {verdict.gates.map((gate) => (
                    <li key={gate.gate} className={styles.gateItem} data-pass={gate.pass ? "true" : "false"}>
                      {gate.pass ? (
                        <CheckCircle2 className={styles.gatePass} aria-hidden="true" />
                      ) : (
                        <CircleAlert className={styles.gateFail} aria-hidden="true" />
                      )}
                      <span>{gate.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className={styles.panelLede}>
              {patient.referredUnitIds.length > 0
                ? `${patient.referredUnitIds.length} ward${patient.referredUnitIds.length === 1 ? " is" : "s are"} still waiting to answer, and none has accepted, so no destination is recorded.`
                : patient.declines.length > 0
                  ? /* "No referral is still open" is the Referrals-still-open tile's own sentence
                       and is deliberately not repeated here; this lede answers only its own
                       question, which is why there is nothing to check a destination against. */
                    `Every ward that was asked has answered, and all ${patient.declines.length} declined.`
                  : "No ward has been asked to take this patient yet."}
            </p>
          )}
        </div>
      </WardPanel>

      {/*
       * ⚠️ REVIEW FINDING 9: THIS LIST IS THREE OF MANY, AND IT USED TO SAY NOTHING ABOUT THAT.
       * `eligibleCandidatesAmong` takes a `limit` of 3. On WF-009 it offered "RPH Adult Secure —
       * Already declined this movement" and "FSH Adult Secure — Already declined this movement"
       * under a heading calling them alternatives, on a page whose own escalation panel says every
       * secure unit was tried. The blurb now states the truncation and the total, and a ward that
       * has already refused carries a chip saying so rather than only a grey sentence.
       */}
      <WardPanel
        title="Other wards, ranked"
        count={`${candidates.length} of ${cohortUnitCount}`}
        blurb={`Ranked among the ${cohortUnitCount} ${patient.cohort.toLowerCase()} wards in the network — the rest take a different cohort and were never candidates for this patient. At most three are listed. Being listed here is not an offer and not a decision — a ward that has already declined this movement still appears, marked.`}
      >
        {candidates.length > 0 && usableCandidates.length === 0 ? (
          <p className={styles.shortlistNote} data-testid="ward-console-no-usable-alternative">
            No ward on this list could take this patient. Every one of them has either already declined this movement or
            fails a check of its own, so this is a ranking of what was considered, not a set of places left to try.
          </p>
        ) : null}
        <ul className={styles.rows} data-testid="ward-console-alternatives">
          {candidates.length === 0 ? (
            <li className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowNote}>
                  No other ward in the network ranked at all for this patient&rsquo;s requirements. That is a statement
                  about the ranking, not a statement that no bed exists anywhere.
                </span>
              </span>
            </li>
          ) : null}
          {candidates.map((candidate) => {
            // Finding 2: the same warning shown on the chosen destination above, computed the
            // same way and never touching `candidate.verdict.eligible` — a coordinator may
            // still choose this ward; the notice is information about a legal risk, not a gate.
            const notice = restrictionNotice(patient, candidate.unit);
            const declined = patient.declines.some((decline) => decline.unitId === candidate.unit.id);
            /*
             * ⚠️ OBSERVED LIVE 2026-09-04: a declined row read "RPH Adult Secure / Already declined
             * this movement / ALREADY DECLINED / Not eligible" and an eligible one read
             * "FSH Adult Secure / Eligible now / Eligible" — the same fact two or three times in a
             * row twelve words long. `candidateReason` returns "Eligible now" for a pass, which the
             * verdict beside it already says, and the decline reason, which the chip already says.
             * The note is kept only where it adds the thing neither of the others can: WHY a ward
             * that has not declined is nonetheless not eligible.
             */
            const reason = candidateReason(candidate.verdict);
            const reasonAddsSomething =
              !candidate.verdict.eligible && !(declined && reason.toLowerCase().startsWith("already declined"));
            return (
              <li className={styles.row} key={candidate.unit.id}>
                <span className={styles.rowMain}>
                  <strong className={styles.rowName}>{candidate.unit.name}</strong>
                  {reasonAddsSomething ? <span className={styles.rowNote}>{reason}</span> : null}
                  {notice ? (
                    <span className={styles.rowRisk} data-restriction={notice.level}>
                      {notice.text}
                    </span>
                  ) : null}
                </span>
                <span className={styles.rowChips}>
                  {/* ⚠️ `routine`, NOT `cancelled`. The cancelled level strikes its own text through, and
                      "ALREADY DECLINED" with a line through it — seen live on WF-009, 2026-09-04 —
                      reads as the negation of itself, besides announcing as deleted content to a
                      screen reader. The ward is not cancelled; it answered. */}
                  {declined ? <WardChip level="routine">Already declined</WardChip> : null}
                  <b className={styles.rowVerdict}>{candidate.verdict.eligible ? "Eligible" : "Not eligible"}</b>
                </span>
              </li>
            );
          })}
        </ul>
      </WardPanel>
    </div>
  );

  return (
    <div className={styles.patientWorkspace} data-testid="ward-patient-workspace">
      <ClinicalRail />
      <header className={styles.workspaceHeader}>
        <ContextualBackLink fallbackHref="/mockups/ward-flow" aria-label="Back to Ward Flow">
          <ArrowLeft aria-hidden="true" />
        </ContextualBackLink>
        <div>
          <span>Ward Flow</span>
          <span className={styles.headerCrumb}>Movement {patient.id}</span>
        </div>
        <span className={styles.prototypeBadge}>Synthetic prototype</span>
      </header>
      <main id="main-content" className={styles.workspaceMain}>
        {/*
         * THE MASTHEAD — the patient and where they physically are, not a bare id under the word
         * "workspace".
         *
         * ⚠️ AND THE HONEST LIMIT OF IT: `Movement` HOLDS NO LINK TO A PERSON. There is a
         * `Patient` type with a name, a UMRN and a date of birth (`ward-patients.ts`), and nothing
         * on a movement points at one — so the strongest identity this page can show is the
         * movement's id plus the department the patient is sitting in. Reported to Ward Lead
         * 2026-09-04 rather than papered over with an invented name.
         */}
        <div className={styles.masthead}>
          <span className={styles.eyebrow}>Movement workspace</span>
          <h1 className={styles.mastheadTitle}>
            {patient.id} — {originEd ? `in ${originEd.name}` : unresolvedOriginDepartment(patient)}
          </h1>
          <p className={styles.where}>
            {destination
              ? `${open ? "Bound for" : "Was bound for"} ${destination.name}${destinationService ? `, ${destinationService}` : ""}.`
              : patient.referredUnitIds.length > 0
                ? `No destination yet — ${patient.referredUnitIds.length} referral${patient.referredUnitIds.length === 1 ? " is" : "s are"} still open.`
                : patient.declines.length > 0
                  ? `No destination yet. ${patient.declines.length} ward${patient.declines.length === 1 ? " has" : "s have"} declined and none has accepted.`
                  : patient.referralAbsence?.reason === "none_raised"
                    ? "No destination yet. It is recorded that no ward has been asked."
                    : /*
                       * ⚠️ AN EMPTY `referredUnitIds` IS NOT A RECORD THAT NOBODY WAS ASKED.
                       * This branch used to say "and no ward has been asked", inferring an
                       * absence of FACT from an absence of DATA — the same collapse the closed
                       * blocker line and the legal-status line were both repaired for, in this
                       * same file, on the same day. MEASURED by an adversarial review: 18 of 50
                       * movements reach here and only 2 carry a positive `referralAbsence`
                       * record, so 16 pages were asserting it. And it is reachable falsely
                       * through the live reducer, not merely in the fixture: WITHDRAW_REFERRAL
                       * empties `referredUnitIds`, writes `withdrawnReferrals`, and touches
                       * neither `declines` nor `acceptedUnitId`.
                       *
                       * The model already carries the third state: `referralAbsence.reason`
                       * distinguishes `none_raised` — somebody recorded that nobody was asked —
                       * from nothing having been recorded either way, and only the first
                       * supports the sentence above.
                       */
                      "No destination yet. Nothing is recorded about whether a ward has been asked."}{" "}
            {patient.cohort} · {patient.security} · {patient.legalStatus}
          </p>
          <div className={styles.chipRow}>
            <WardChip level={stageChipLevel}>{stageChipText}</WardChip>
            {/* Finding 6: "Tier 3 leads" was a three-word compression of a sentence about the SORT
                KEY, sitting where it read as a claim about this patient's position — and it
                contradicted both the urgent-flag panel and the closure banner on the same screen.
                The tier is stated; nothing here claims a position in a queue. */}
            <WardChip level="routine">Tier {patient.urgency}</WardChip>
            {/* ⚠️ AN URGENT CHIP IN THE PRESENT TENSE ON A CLOSED MOVEMENT IS A FALSE CALL FOR
                ATTENTION, and it is the loudest thing on the page. This rendered "Flagged urgent"
                in red regardless of closure — the same defect as the "Bound for" and "Current
                stage" present tenses already repaired on this page, and it survived them because
                the chip is true about the record while being false about the present.

                🔴 AND IT IS REACHABLE, WHICH IS THE ONLY REASON IT IS FIXED RATHER THAN ARGUED.
                `FLAG_MOVEMENT_URGENT` refuses a CLOSED movement (reducer ~1810), and reading that
                guard alone says the combination cannot exist. It says nothing about the other
                order: flag while open, then close. Nothing refuses that, every closing case builds
                its result with `{ ...movement, closure }`, and the flag survives. Driven and
                proved by a committed reachability probe, after the same guard-read-as-invariant
                mistake had already produced one retracted finding tonight. */}
            {patient.flaggedUrgent ? (
              <WardChip level={open ? "urgent" : "routine"}>{open ? "Flagged urgent" : "Was flagged urgent"}</WardChip>
            ) : null}
            {/* `routine`, not `stalled`. Specialling is a fact about this patient's care, not a
                warning about their placement — an amber chip here says "look, something is wrong"
                about a nursing arrangement that is working exactly as intended. */}
            {patient.specialling ? <WardChip level="routine">Specialling</WardChip> : null}
          </div>
        </div>

        {/*
         * ⚠️ ON A CLOSED MOVEMENT THIS IS THE FIRST AND LOUDEST THING ON THE PAGE, and it is a
         * panel rather than a thin note (Ward Lead ruling 2). Before 2026-09-04 a closed movement
         * (WF-008) showed "Current stage: Accepted, awaiting bed", "Eligibility: Eligible now" and
         * "Transport: Not yet requested" with no closure marker near the top at all — the closure
         * existed two-thirds down, explaining why a button was missing. The first fix added a
         * banner and left the step track rendering a blue "current" step eight lines below it.
         */}
        {!open ? (
          <div data-testid="workspace-closure-banner" className={styles.closureHost}>
            <WardPanel
              title={
                patient.closure?.outcome === "arrived"
                  ? "This movement is closed — the patient arrived"
                  : "This movement is closed — it did not proceed"
              }
              count={patient.closure ? formatInstantWithDay(patient.closure.at, now) : undefined}
            >
              <div className={styles.panelBody}>
                <p className={styles.closureReason}>
                  {patient.closure
                    ? patient.closure.reason
                    : "The patient has arrived. No closure record was written, so nothing on this movement says why it ended or who ended it."}
                </p>
                <p className={styles.closureMeta}>
                  {patient.closure
                    ? `It ran ${splitDuration(ranMinutes)} from opening to closing, and stopped at step ${reachedIndex + 1} of ${MOVEMENT_STAGES.length}, ${stageCopy[patient.stage].label.toLowerCase()}.`
                    : `It ran ${splitDuration(ranMinutes)} from opening, and the last stage recorded is ${stageCopy[patient.stage].label.toLowerCase()}.`}
                </p>
              </div>
            </WardPanel>
          </div>
        ) : null}

        <div data-testid="ward-console-figures">
          <WardFigureStrip>
            <WardFigure
              label={open ? "Time since this movement opened" : "How long this movement ran"}
              value={splitDuration(ranMinutes)}
              sub={`Opened ${formatInstantWithDay(patient.openedAt, now)}`}
            />
            <WardFigure
              label={open ? "Step reached" : "Step it stopped at"}
              value={`${reachedIndex + 1} of ${MOVEMENT_STAGES.length}`}
              sub={stageCopy[patient.stage].label}
            />
            {/* ⚠️ "Wards referred to" WAS FALSE ON TWO OF THE THREE FIXTURES — see the
                `referredSub` comment above. The label now names what the field actually counts, so
                "None" means what it says on all three. */}
            <WardFigure
              label="Referrals still open"
              value={patient.referredUnitIds.length === 0 ? "None" : String(patient.referredUnitIds.length)}
              sub={referredSub}
            />
            <WardFigure
              label="Wards that declined"
              value={patient.declines.length === 0 ? "None" : String(patient.declines.length)}
              flagged={flagged.has("declines")}
              sub={
                patient.declines.length === 0
                  ? "No ward has refused this patient"
                  : patient.declines.map((decline) => unitName(decline.unitId)).join(", ")
              }
            />
            {deadline !== undefined && patient.legalForm ? (
              <WardFigure
                label={`Deadline on the ${legalFormNameLabelFirst(patient.legalForm)}`}
                value={formatRemaining(minutesUntil(deadline, now))}
                flagged={flagged.has("deadline")}
                sub={`Due ${formatInstantWithDay(deadline, now)} — the deadline this record holds, not a claim about what the Act requires`}
              />
            ) : null}
            {patient.pullExpiresAt !== undefined ? (
              <WardFigure
                label="Hold on the bed"
                value={formatRemaining(minutesUntil(patient.pullExpiresAt, now))}
                flagged={flagged.has("pull")}
                sub={`${patient.pullExpiresAt <= now ? "Ran out" : "Runs out"} ${formatInstantWithDay(patient.pullExpiresAt, now)}`}
              />
            ) : null}
          </WardFigureStrip>
          {withheldFlags.length > 0 ? (
            <p className={styles.withheldFlagNote} data-testid="ward-console-withheld-flags">
              {withheldFlags.length === 1
                ? `Also urgent, and not highlighted above: ${withheldFlags[0]}. At most two figures carry amber, so that this screen still points somewhere.`
                : `Also urgent, and not highlighted above: ${withheldFlags.join("; ")}. At most two figures carry amber, so that this screen still points somewhere.`}
            </p>
          ) : null}
        </div>

        <div className={styles.layout}>
          {/*
           * ⚠️ THE RAIL LEADS WITH WHAT IS WRONG, NOT WITH LINKS. The design language's own rule:
           * a dashboard's job is to say what is wrong, and links are what you use afterwards. For
           * one patient that is a breached deadline, an expired hold, an escort requirement, a
           * stalled referral — each a locator and one plain sentence.
           */}
          <div className={styles.rail}>
            <WardPanel
              title={open ? "Needs attention" : "Why this stopped"}
              count={open ? String(attention.length) : undefined}
            >
              <ul className={styles.attentionList} data-testid="ward-console-attention">
                {attention.map((item) => (
                  <li className={styles.attentionItem} key={item.key} data-level={item.level}>
                    <span className={styles.attentionHead}>
                      <span className={styles.attentionWho}>{item.who}</span>
                      <WardChip level={item.level}>{item.chip}</WardChip>
                    </span>
                    <span className={styles.attentionSay}>{item.say}</span>
                  </li>
                ))}
                {attention.length === 0 ? (
                  <li className={styles.attentionItem} data-level="accepted">
                    <span className={styles.attentionHead}>
                      <span className={styles.attentionWho}>Nothing outstanding</span>
                      <WardChip level="accepted">Clear</WardChip>
                    </span>
                    <span className={styles.attentionSay}>
                      Every check this page can make came back clear: no recorded deadline is close or past, no bed hold
                      has run out, no ward has declined without an acceptance, no escort is outstanding, and nobody has
                      recorded a blocker. That is the checks passing, not a guarantee that nothing is wrong.
                    </span>
                  </li>
                ) : null}
              </ul>
            </WardPanel>

            <WardPanel
              title={open ? "Where this has got to" : "Where this stopped"}
              count={`${reachedIndex + 1} of ${MOVEMENT_STAGES.length}`}
              blurb={
                open
                  ? "This patient's own progress through the seven stages. Steps behind are done, the marked step is where they are now, and steps ahead have not been reached."
                  : "Where this movement stopped. No step is current, because nothing is in progress."
              }
            >
              <MovementTrack movement={patient} now={now} open={open} />
            </WardPanel>
          </div>

          <div className={styles.column}>
            {/*
             * ⚠️ THE ORDER OF THESE TWO IS THE PAGE'S ARGUMENT, NOT A PREFERENCE. Ward Lead ruling
             * 3, 2026-09-04: the coordinator's three questions, in order, are what is happening
             * with this patient's bed, what is stopping it, and what can I do about it. The rail
             * to the left answers the second; this column answers the first and then the third.
             * They were the other way round for ten minutes and the page opened on its own
             * controls, which is an inventory of buttons rather than an answer.
             *
             * On a closed movement both move: the eligibility block goes behind a control at the
             * foot of the page, and the controls follow the record rather than leading it.
             */}
            {open ? eligibilityBlock : null}

            {open ? whatYouCanDo(patient) : null}

            {/*
             * ⚠️ THIS PANEL IS A VERDICT LAYER NOW, NOT A SECOND COPY OF FOUR OTHER PANELS (Ward
             * Lead judgement, 2026-09-04 — the ruling that mattered more than the six defects).
             *
             * It used to print the legal status the masthead and the legal panel both already
             * carried, the form line the legal panel carries, the transport sentence the transport
             * panel carries word for word, and the blocker prose the attention rail, the control
             * and Movement facts all carried. On WF-004 that made the blocker sentence the FOURTH
             * thing a coordinator met that said the same thing, and each encounter cost them a
             * decision about whether it was new.
             *
             * The rule the page now follows: EVERY FACT HAS ONE HOME, and a panel that would
             * repeat one either omits it or points at it. Readiness owns none of these four facts.
             * What it owns — and what nothing else on the page says — is whether each one is in a
             * state that lets this patient travel. So each row is a derived verdict plus where the
             * fact itself lives.
             *
             * ⚠️ AND IT HAS A TENSE (Ward Lead D5). On a closed movement the old header still read
             * "before this patient can travel", about a patient who will never travel — the one
             * panel the earlier tense pass missed.
             *
             * ⚠️ WHAT MUST NOT BE UNDONE: the absences stay distinct. "Nobody ever recorded one"
             * and "somebody cleared the one that was there" are different facts about a patient,
             * and `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` exists to keep the five of them apart.
             * Removing repetition is not licence to collapse them into "none".
             */}
            <WardPanel
              title={open ? "Readiness" : "Readiness when this stopped"}
              blurb={
                open
                  ? "The four things that have to be true before this patient can travel. This says only where each one stands — the fact itself is set out in full further down, and anything needing action is in Needs attention."
                  : "The four things that would have had to be true before this patient could travel. This movement closed, so none of them is outstanding now; this is where each one stood."
              }
            >
              <ul className={styles.readinessList} data-testid="ward-console-readiness">
                <li className={styles.readinessItem}>
                  <FileCheck2 aria-hidden="true" className={styles.readinessIcon} />
                  <span className={styles.readinessBody}>
                    <strong>Legal status</strong>
                    <span>
                      {/* ⚠️ "unchanged" WAS A CLAIM THE DATA DOES NOT SUPPORT. `statusChanges`
                          being empty means no change was RECORDED, which is not the same as no
                          change having happened — the three-state discipline `transportNeed`
                          already keeps for its own question, violated here for legal status.
                          WF-009 carries an examination whose outcome is an inpatient order,
                          320 minutes after the movement opened, and a legal status of
                          "Involuntary inpatient", with `statusChanges: []`. The page said the
                          status had not changed while its own timeline three panels down said
                          otherwise. */}
                      {patient.statusChanges.length === 0
                        ? "Recorded. No change to it has been recorded since this movement opened."
                        : `Recorded, and changed ${patient.statusChanges.length} time${patient.statusChanges.length === 1 ? "" : "s"} since this movement opened.`}
                    </span>
                    <span className={styles.readinessWhere}>What the status is, under Legal and forms below.</span>
                  </span>
                </li>
                <li className={styles.readinessItem}>
                  <ShieldCheck aria-hidden="true" className={styles.readinessIcon} />
                  <span className={styles.readinessBody}>
                    <strong>Form readiness</strong>
                    <span>{formReadinessState(patient.legalForm, now)}</span>
                    {/* No pointer when there is no form: sending a reader to a panel to read a
                        thing that does not exist is worse than saying nothing. */}
                    {patient.legalForm ? (
                      <span className={styles.readinessWhere}>
                        The form and its deadline, under Legal and forms below.
                      </span>
                    ) : null}
                  </span>
                </li>
                <li className={styles.readinessItem}>
                  <Truck aria-hidden="true" className={styles.readinessIcon} />
                  <span className={styles.readinessBody}>
                    <strong>Transport</strong>
                    {/*
                      Findings 1 and 5, and the fact itself has moved down to the Transport panel.
                      A closed movement must not assert "Not yet requested" — that reads as an
                      outstanding booking on a movement nobody is transporting anywhere. And
                      `transportStatusLabel(undefined)` collapses THREE situations into one claim:
                      not needed, not booked, and nobody has said. `transportNeedState` keeps them
                      apart and both this verdict and the panel below are built from it.
                    */}
                    <span>{transportReadinessState(patient, open)}</span>
                    <span className={styles.readinessWhere}>
                      The job, provider, escort and form, under Transport below.
                    </span>
                  </span>
                </li>
                <li className={styles.readinessItem}>
                  <CircleAlert aria-hidden="true" className={styles.readinessIcon} data-tone="warning" />
                  <span className={styles.readinessBody}>
                    <strong>What is holding it up</strong>
                    <span>{blockerReadinessState(patient, open, blockerIsActive)}</span>
                    <span className={styles.readinessWhere}>
                      {open
                        ? blockerIsActive
                          ? "Needs attention, at the top of this page, quotes it in full."
                          : "What you can do here, below, is where one is recorded."
                        : "What you can do here, below, shows the note itself."}
                    </span>
                  </span>
                </li>
              </ul>
            </WardPanel>

            <div data-testid="ward-console-legal-panel">
              <WardPanel
                title="Legal and forms"
                blurb="What this record holds about this patient's status and the form beside it. It is not a statement of what the Mental Health Act requires."
              >
                <dl className={styles.factGrid}>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Legal status</dt>
                    <dd className={styles.factValue}>{patient.legalStatus}</dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Form</dt>
                    <dd className={styles.factValue}>
                      {patient.legalForm ? legalFormReadinessLine(patient.legalForm, now) : "No legal form recorded"}
                    </dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Status changes</dt>
                    <dd className={styles.factValue}>
                      {patient.statusChanges.length === 0
                        ? "None recorded since the movement opened. That is not the same as none having happened."
                        : `${patient.statusChanges.length} recorded — listed in full below.`}
                    </dd>
                  </div>
                </dl>
                {/*
                 * Finding 11: `destinationNoLongerLawful()` — the mid-flight "this patient's status
                 * now requires an authorised destination and their accepted ward is not one"
                 * exception — was not on the legal tab at all. It leads the attention rail now, and
                 * is restated here where a reader looking at the legal record will find it.
                 */}
                {destinationNoLongerLawful(patient, units) ? (
                  <p className={styles.legalRisk}>
                    {destinationNoLongerLawful(patient, units)?.name} is not authorised to receive this patient under
                    their current status. The acceptance predates the status change.
                  </p>
                ) : null}
              </WardPanel>
            </div>

            {/*
             * ⚠️ FINDING 4: THIS PANEL USED TO MAKE FOUR CLAIMS ABOUT ITSELF AND NONE WAS TRUE.
             * It said "Provider, ETA, risk documentation and legal-form readiness are visible
             * here". Provider was dropped by `transportStatusLabel` once a job was en route; ETA
             * exists nowhere in the model; risk documentation does not exist, and the nearest
             * thing — `escortRequired` — was rendered on no tab at all; legal-form readiness was
             * on a different tab. Observed on WF-006, a secure involuntary patient in transit with
             * `escortRequired: true`: a coordinator read that risk documentation was visible,
             * saw nothing, and would conclude no escort was needed. It is.
             *
             * Every line below now names a field this model actually holds.
             */}
            <div data-testid="ward-console-transport-panel">
              <WardPanel
                title="Transport"
                blurb="Only what the transport record holds, and the one place on this page that holds it. There is no estimated arrival time anywhere in this model, and no risk documentation."
              >
                <dl className={styles.factGrid}>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Is transport needed?</dt>
                    <dd className={styles.factValue}>{transportNeedSentence(patient, now)}</dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Job</dt>
                    <dd className={styles.factValue}>{transportReadinessLine(patient, open)}</dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Provider</dt>
                    <dd className={styles.factValue}>
                      {patient.transport
                        ? patient.transport.provider
                        : "No provider is recorded, because no job exists."}
                    </dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Escort</dt>
                    <dd className={styles.factValue}>
                      {patient.transport === undefined
                        ? "No job exists, so nothing has been recorded about an escort."
                        : patient.transport.escortRequired
                          ? "An escort is required for this journey. The record does not say whether one has been found — there is no field for that."
                          : "No escort is required for this journey."}
                    </dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Form the provider asked for</dt>
                    <dd className={styles.factValue}>
                      {patient.transport?.formRequired ?? "None is recorded against the transport job."}
                    </dd>
                  </div>
                </dl>
              </WardPanel>
            </div>

            <WardPanel
              title="Movement facts"
              blurb="The record's own fields, plainly labelled. Nothing here is derived."
            >
              <dl className={styles.factGrid}>
                <div className={styles.factRow}>
                  {/* ⚠️ "Current stage" IS THE WRONG NOUN ON A CLOSED MOVEMENT. It stopped there;
                      it is not currently anything. Not a wording preference — the old label was
                      the third of three statements on this page that told a coordinator a closed
                      movement was live. */}
                  <dt className={styles.factLabel}>{open ? "Current stage" : "Stopped at"}</dt>
                  <dd className={styles.factValue}>{stageCopy[patient.stage].label}</dd>
                </div>
                <div className={styles.factRow}>
                  <dt className={styles.factLabel}>Owner</dt>
                  <dd className={styles.factValue}>{patient.owner}</dd>
                </div>
                <div className={styles.factRow}>
                  {/* ⚠️ THIS ROW SAID "Where the patient is" AND RENDERED THE ORIGIN DEPARTMENT
                      UNCONDITIONALLY. On WF-300 — closure "Handover complete at RPH Older Adult",
                      step 7 of 7, arrived — the page therefore said the patient was still in the
                      emergency department she had left. A page telling a coordinator a patient is
                      somewhere she is not is the worst thing on this screen, and it survived the
                      redesign, the suite and a cold read; it was found by reading ten rendered
                      pages line by line.

                      The label is the fix, not a branch. "Where the patient is" is a DERIVATION —
                      it depends on the stage, the closure and whether anybody recorded an arrival
                      — and this panel's own blurb three lines above promises "the record's own
                      fields... nothing here is derived". The row was contradicting its own panel
                      header as well as the closure. `originEd` is a plain recorded field and now
                      says so. Anything genuinely about the patient's present location belongs in
                      the narrative above, which already has a tense. */}
                  <dt className={styles.factLabel}>Origin department</dt>
                  <dd className={styles.factValue}>{originEd ? originEd.name : unresolvedOriginDepartment(patient)}</dd>
                </div>
                <div className={styles.factRow}>
                  <dt className={styles.factLabel}>Accepted by</dt>
                  <dd className={styles.factValue}>
                    {patient.acceptedUnitId
                      ? `${unitName(patient.acceptedUnitId)}${patient.acceptedAt === undefined ? " — no time recorded" : `, ${formatInstantWithDay(patient.acceptedAt, now)}`}`
                      : "No ward has accepted this patient."}
                  </dd>
                </div>
                <div className={styles.factRow}>
                  {/* ⚠️ FINDING 10: THIS ROW USED TO BE LABELLED "Response" AND SIT DIRECTLY UNDER
                      "Referral: <ward name>", rendering `patient.blocker` — free prose about what
                      is holding the movement up. On WF-004 that read "Referral: BTY Adult Secure /
                      Response: Escort provider organising secure transport", and a coordinator
                      would conclude Bentley said it. A ward's answer is `declines` and
                      `acceptedUnitId`, both of which are named on this page under their own words.

                      ⚠️ AND IT WAS THE FOURTH PLACE ON THIS PAGE PRINTING THE SAME SENTENCE (Ward
                      Lead judgement, 2026-09-04). The row stays, because a reader working down the
                      record's own fields must not find one silently missing — but it points at the
                      one place the value lives rather than repeating it. */}
                  <dt className={styles.factLabel}>Recorded by hand as holding this up</dt>
                  <dd className={styles.factValue}>
                    Kept in one place: What you can do here, below, beside the controls that change it.
                  </dd>
                </div>
                <div className={styles.factRow}>
                  <dt className={styles.factLabel}>Health service of the origin department</dt>
                  <dd className={styles.factValue}>
                    {service ?? "No health service could be resolved from this movement's origin department."}
                  </dd>
                </div>
                <div className={styles.factRow}>
                  <dt className={styles.factLabel}>Setting</dt>
                  <dd className={styles.factValue}>
                    {patient.cohort} · {patient.security} · {patient.sex}
                    {patient.specialling ? " · specialling required" : ""}
                  </dd>
                </div>
              </dl>
            </WardPanel>

            {/* Task 10 (spec item 8): always rendered, never gated behind a tab — each section
                carries its own explicit absence line when the movement has none of that record,
                per the conservative-failure constraint. A hidden section that simply omits itself
                when empty is exactly what that constraint forbids. */}
            <div data-testid="ward-patient-declines">
              <WardPanel
                title="Declines"
                count={patient.declines.length === 0 ? undefined : String(patient.declines.length)}
                blurb="Wards that were asked and said no, with the reason each gave."
              >
                {patient.declines.length > 0 ? (
                  <ol className={styles.timeline}>
                    {patient.declines.map((decline, index) => (
                      <li className={styles.timelineItem} key={`${decline.unitId}-${decline.at}-${index}`}>
                        <time className={styles.timelineWhen}>{formatInstantWithDay(decline.at, now)}</time>
                        <span className={styles.timelineWhat}>
                          {unitName(decline.unitId)} · {declineReasonLabels[decline.reason]}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.panelBody}>No declines recorded for this movement.</p>
                )}
              </WardPanel>
            </div>

            <div data-testid="ward-patient-changes">
              <WardPanel
                title="Status and urgency changes"
                count={changeEvents.length === 0 ? undefined : String(changeEvents.length)}
                blurb="Every recorded change to this patient's legal status or urgency tier, with who made it and the reason they chose."
              >
                {changeEvents.length > 0 ? (
                  <ol className={styles.timeline}>
                    {changeEvents.map((change, index) => (
                      <li className={styles.timelineItem} key={`${change.kind}-${change.at}-${index}`}>
                        <time className={styles.timelineWhen}>{formatInstantWithDay(change.at, now)}</time>
                        <span className={styles.timelineWhat}>
                          {change.kind === "legal" ? "Legal status" : "Urgency"} changed {change.detail} by {change.by}{" "}
                          · {change.reasonLabel}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.panelBody}>No status or urgency changes recorded for this movement.</p>
                )}
              </WardPanel>
            </div>

            <div data-testid="ward-patient-escalation">
              <WardPanel title="Escalation" blurb="Whether anybody took this movement above the wards, and to whom.">
                {patient.escalation ? (
                  <dl className={styles.factGrid}>
                    <div className={styles.factRow}>
                      <dt className={styles.factLabel}>When</dt>
                      <dd className={styles.factValue}>{formatInstantWithDay(patient.escalation.at, now)}</dd>
                    </div>
                    <div className={styles.factRow}>
                      <dt className={styles.factLabel}>Units tried</dt>
                      <dd className={styles.factValue}>
                        {patient.escalation.triedUnitIds.map((unitId) => unitName(unitId)).join(", ")}
                      </dd>
                    </div>
                    <div className={styles.factRow}>
                      <dt className={styles.factLabel}>Contact</dt>
                      <dd className={styles.factValue}>{patient.escalation.contact}</dd>
                    </div>
                    <div className={styles.factRow}>
                      <dt className={styles.factLabel}>What came back</dt>
                      <dd className={styles.factValue}>
                        Nothing. This model has no field for an escalation&rsquo;s answer, so an absence here is a gap
                        in the record, not a silence from the contact.
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className={styles.panelBody}>No escalation recorded for this movement.</p>
                )}
              </WardPanel>
            </div>

            <WardPanel
              title="Audit timeline"
              count={String(timeline.length)}
              blurb="Every fact this movement's record holds a TIME for, in order. It is not everything that happened — a record can assert a thing happened and hold no instant for it, and anything in that state is named underneath rather than dated or dropped."
            >
              <ol className={styles.timeline} data-testid="ward-console-timeline">
                {timeline.map((event, index) => (
                  <li className={styles.timelineItem} key={`${event.at}-${index}`}>
                    <time className={styles.timelineWhen}>{formatInstantWithDay(event.at, now)}</time>
                    <span className={styles.timelineWhat}>{event.label}</span>
                  </li>
                ))}
              </ol>
              {untimed.length > 0 ? (
                <div className={styles.untimed} data-testid="ward-console-untimed">
                  <p className={styles.untimedTitle}>Happened, but nothing recorded when</p>
                  <ul className={styles.untimedList}>
                    {untimed.map((sentence) => (
                      <li className={styles.untimedItem} key={sentence}>
                        {sentence}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </WardPanel>

            {/* The closed arrangement: the live tools come LAST and quiet, after the record, rather
                than leading the page. They do not vanish — a coordinator reading a closed movement
                still needs to see that they exist and why they are unavailable. */}
            {!open ? (
              <>
                {whatYouCanDo(patient)}
                <WardPanel
                  title="Check what these wards could take today"
                  blurb="An eligibility calculation against the wards as they are right now. It is not a record of what was true when this movement closed, and it is not shown by default for that reason."
                >
                  <div className={styles.panelBody}>
                    {showClosedEligibility ? (
                      eligibilityBlock
                    ) : (
                      <>
                        <p className={styles.panelLede}>
                          Nothing recorded which wards could have taken this patient at the moment this movement closed.
                          There is no snapshot — only a fresh calculation against today&rsquo;s occupancy, staffing and
                          bed state.
                        </p>
                        <button
                          type="button"
                          className={styles.revealButton}
                          data-testid="ward-console-reveal-eligibility"
                          onClick={() => setShowClosedEligibility(true)}
                        >
                          Check what these wards could take today
                        </button>
                      </>
                    )}
                  </div>
                </WardPanel>
              </>
            ) : null}
          </div>
        </div>

        <p className={styles.governanceNote}>
          Synthetic prototype only. Eligibility is checked automatically; an authorised human confirms every
          destination. This is not clinical severity.
        </p>
        <span id="ward-console-confirm-unavailable" className="sr-only">
          Confirming a destination is not built yet. Nothing is recorded when this control is activated.
        </span>
      </main>
    </div>
  );

  /**
   * THE THREE THINGS THIS PAGE ACTUALLY LETS SOMEBODY DO, in one place, plus the one placeholder.
   *
   * Measured 2026-09-04: record a blocker, clear a blocker, flag the patient as urgent. That is
   * all. Scattering them among twelve panels was part of why the page read as an inventory rather
   * than a workspace.
   *
   * ⚠️ CALLED AS A FUNCTION, NEVER RENDERED AS `<WhatYouCanDo />`. A component declared inside
   * another component is a NEW component type on every render, so React unmounts and remounts its
   * whole subtree each time — which here would blow away the focus and caret of the blocker text
   * field on every keystroke. Calling it returns the same element tree into the parent's own
   * reconciliation and has no such effect. It stays a closure because it reads `patient`, `now`,
   * `dispatch` and the blocker draft, and because rendering it from exactly two places (open, near
   * the top; closed, last and quiet) is what stops the two arrangements diverging.
   */
  function whatYouCanDo(movement: Movement) {
    return (
      <WardPanel
        title="What you can do here"
        blurb={
          open
            ? "Three controls, all of which record against this movement immediately. Confirming a destination is not built yet."
            : "These controls are the same ones an open movement has. On a closed movement the reducer refuses them, and the reasons are stated rather than the buttons being hidden."
        }
      >
        <div className={styles.actionStack}>
          {/*
           * THE URGENT FLAG — and the control the owner asked for, which until 2026-09-01 did not
           * exist anywhere in the application.
           *
           * `Movement.flaggedUrgent` was added on 2026-08-30 with a ranking rule above it —
           * `queueOrder` (ward-priority.ts) puts it ABOVE all three urgency tiers — and a "Flagged
           * urgent" badge on the coordinator queue below it. Its only writer was the literal
           * `false` at creation, and exactly one hand-authored movement carried `true`. The feature
           * was complete and unreachable.
           *
           * ⚠️ BOTH DIRECTIONS ON ONE CONTROL, decided by the record and never by a local flag. A
           * flag that could be set and not cleared would be a new permanent state.
           *
           * The state is STATED IN WORDS, not left to the button's label alone. A reader of this
           * page has no badge here — the badge is on the coordinator queue — and "this patient
           * outranks every tier" is not something to infer from a button saying "Remove".
           *
           * ⚠️ NO REASON IS ASKED FOR, deliberately. The owner said "for many reasons", plural and
           * unenumerated, and inventing a vocabulary for them is part of the "later" he deferred.
           */}
          <section className={styles.action} data-testid="ward-patient-urgent-flag">
            <h3 className={styles.actionTitle}>Urgent flag</h3>
            {/*
             * ⚠️ WARD LEAD D6, 2026-09-04: "Not flagged. This patient is ordered by urgency tier
             * and waiting time, like everybody else" SAT DIRECTLY ABOVE "it is not in the queue at
             * all", on WF-008, in the same panel. Two adjacent sentences, flatly contradicting
             * each other, both true of different movements and only one true of this one.
             *
             * The queue claim was written for an open movement and printed unconditionally. It is
             * now one sentence, chosen by whether this movement is in a queue at all — never two
             * that have to be reconciled by the reader.
             */}
            <p className={styles.actionSay}>
              {movement.flaggedUrgent
                ? open
                  ? "Flagged urgent. This patient leads the queue ahead of every urgency tier, including tier 1."
                  : "Flagged urgent. This movement is no longer in the queue, so the flag orders nothing now — removing it changes only the record."
                : open
                  ? "Not flagged. This patient is ordered by urgency tier and waiting time, like everybody else."
                  : /* The closure REASON is deliberately not repeated here. The closure panel at
                       the top of the page is the loudest thing on it and states the reason in
                       full; a parenthetical copy in each of the two controls made four copies on
                       one screen (WF-008), which is the judgement this pass exists to fix. */
                    "Not flagged — and this movement is no longer running, so it is not in the queue at all. Flagging it would change nothing."}
            </p>
            {!open && !movement.flaggedUrgent ? null : (
              <button
                type="button"
                className={styles.blockerButton}
                data-testid="ward-console-urgent-flag-toggle"
                onClick={() =>
                  dispatch({
                    /* Dispatched as the coordinator for the reason the blocker control below records
                       in full: this workspace is the statewide view. The event also permits `ed`, so
                       the referring department can flag from its own screen — that control is not
                       this one and must not be implied by it. */
                    type: movement.flaggedUrgent ? "CLEAR_MOVEMENT_URGENT_FLAG" : "FLAG_MOVEMENT_URGENT",
                    role: "coordinator",
                    now,
                    movementId: movement.id,
                  })
                }
              >
                {movement.flaggedUrgent ? "Remove the urgent flag" : "Flag this patient as urgent"}
              </button>
            )}
          </section>

          {/*
           * WHAT IS HOLDING THIS UP — and the control that lets somebody say so.
           *
           * ⚠️ `Movement.blocker`, the FREE-PROSE field. Not `BedRelease.blocker`, the
           * `BedReleaseBlocker` enum that shares the name and belongs to a bed being freed.
           *
           * Until 2026-09-01 this value was written once, at creation, as "Awaiting coordinator
           * referral", and no stage transition ever touched it — so this page's own lines told a
           * coordinator that a patient whose ambulance was already moving was still waiting to be
           * referred, and somebody chased the wrong movement.
           *
           * The reducer now restates it wherever a transition contradicts it. This control is the
           * other half, and the more important one: a single room not yet clean, a family not yet
           * reached, an escort provider still finding a vehicle — none of those exist anywhere in
           * the model, and only a person can put them here. That is why the field is free prose
           * and not a picker (owner ruling, 2026-09-01).
           *
           * A closed movement gets the reason stated rather than a control that would be refused —
           * the same discipline `referralBlockedReason` uses for the Refer control.
           */}
          <section className={styles.action} data-testid="ward-patient-blocker">
            <h3 className={styles.actionTitle}>What is holding this up</h3>
            {/*
             * ⚠️ THIS IS THE ONE PLACE ON THE PAGE THAT PRINTS `movement.blocker` OUTSIDE THE
             * ATTENTION RAIL (Ward Lead judgement, 2026-09-04). It is kept here rather than in
             * Readiness or Movement facts because this is where the value is replaced and cleared,
             * and a clinician must never clear a note they cannot see.
             */}
            <p className={styles.actionSay}>{movement.blocker}</p>
            {!open ? (
              /*
               * ⚠️ WARD LEAD D4: THIS USED TO SAY "nothing can be holding it up" WHILE THE READINESS
               * PANEL SEVEN INCHES ABOVE IT SAID "what is holding it up: Patient declined transfer",
               * on WF-008, on one screen. Both statements were about the same field. Readiness no
               * longer asserts a live blocker on a closed movement, and this sentence no longer
               * denies the note printed immediately above it — it says what the note now is.
               */
              <p className={styles.actionSay}>
                This movement is no longer running — the panel at the top of the page says why. The note above is what
                was recorded before it stopped; nothing new can be recorded against it now.
              </p>
            ) : (
              <form
                className={styles.blockerForm}
                onSubmit={(submitted) => {
                  submitted.preventDefault();
                  dispatch({
                    type: "RECORD_MOVEMENT_BLOCKER",
                    /* The coordinator. This workspace is the statewide view — it ranks alternatives
                       across every unit and shows an eligibility verdict for each, which `CO-D2` says
                       only the coordinator sees. The event permits four other roles so that a ward,
                       an emergency department, a community team or a transport officer can record
                       their own observation from their own screen; none of those controls exists yet,
                       and this one must not pretend to be them. Nothing about the role is written
                       onto the record. */
                    role: "coordinator",
                    now,
                    movementId: movement.id,
                    blocker: blockerDraft,
                  });
                  setBlockerDraft("");
                }}
              >
                <label className={styles.blockerLabel} htmlFor="ward-console-blocker">
                  What is holding this up? Wards, roles and jobs only — never a patient&rsquo;s name, details or
                  clinical narrative. To say nothing is holding it up, use Clear rather than typing it.
                </label>
                <input
                  id="ward-console-blocker"
                  type="text"
                  className={styles.blockerInput}
                  data-testid="ward-console-blocker-input"
                  value={blockerDraft}
                  onChange={(changed) => setBlockerDraft(changed.target.value)}
                  placeholder="Awaiting single-room clean"
                />
                {/* Native `disabled`, deliberately: this is TRANSIENT inertness — a form action
                    awaiting validity — which `docs/wiring-conventions.md` keeps native `disabled`
                    for. It is not an unavailable feature with a stated reason, so `aria-disabled`
                    would be wrong here, and the two together fail lint. */}
                <button type="submit" className={styles.blockerButton} disabled={blockerDraft.trim().length === 0}>
                  Record it
                </button>
                {/*
                 * ⚠️ CLEARING HAS ITS OWN CONTROL RATHER THAN A MAGIC WORD, and this is a repair of a
                 * defect this screen shipped earlier the same day. `hasActiveBlocker`
                 * (ward-priority.ts) recognises "nothing is blocking" by exact match against a closed
                 * set, so a person clearing a blocker by TYPING "none — resolved" or "no blocker" left
                 * the movement scoring ten points as actively obstructed in `operationalScore` —
                 * ranked above patients who really were blocked, silently.
                 *
                 * `type="button"` with its own dispatch, deliberately outside the form's submit path:
                 * clearing is not "record what I typed", and routing it through the text field would
                 * put the guessing back.
                 *
                 * Offered only when there IS something to clear. The reducer refuses the rest, and a
                 * control that will be refused teaches a clinician to distrust the controls.
                 */}
                {blockerIsActive && (
                  <button
                    type="button"
                    className={styles.blockerButton}
                    data-testid="ward-console-blocker-clear"
                    onClick={() =>
                      dispatch({
                        type: "CLEAR_MOVEMENT_BLOCKER",
                        role: "coordinator",
                        now,
                        movementId: movement.id,
                      })
                    }
                  >
                    Clear — nothing is holding this up
                  </button>
                )}
              </form>
            )}
          </section>

          {/*
           * ⚠️ THIS BUTTON USED TO SAY "Destination confirmed" AND RECORD NOTHING.
           * It flipped a local `useState` and relabelled itself. Nothing was dispatched, so navigating
           * away proved the confirmation had never existed - the app told the user an action had
           * succeeded when no action had occurred.
           *
           * It is now the repository's placeholder contract (`docs/wiring-conventions.md`):
           * `aria-disabled` with an inert handler and a stated reason, NOT native `disabled`, because
           * native `disabled` removes the tab stop and the reason would never be reached.
           *
           * ⚠️ DO NOT WIRE THIS TO AN EVENT TO "FINISH" IT. Which event a confirmation dispatches, in
           * which role, and what it does to the movement is a design decision the owner holds; it was
           * put to him on 2026-09-01 and he chose this placeholder while he decides. The redesign
           * keeps it visible and states its unavailability rather than hiding it (Ward Lead, 2026-09-04).
           */}
          <section className={styles.action}>
            <h3 className={styles.actionTitle}>Confirm a destination</h3>
            <p className={styles.actionSay}>
              Not built yet. Which record a confirmation writes, and in whose name, is a decision the owner still holds
              — so this control is deliberately inert and says so rather than being hidden.
            </p>
            <button
              type="button"
              aria-disabled="true"
              aria-describedby="ward-console-confirm-unavailable"
              title="Confirming a destination is not built yet — coming soon."
              className={styles.confirmButton}
              onClick={ignoreUnavailableActivation}
            >
              Review &amp; confirm
            </button>
          </section>
        </div>
      </WardPanel>
    );
  }
}

/**
 * WHETHER ANYBODY HAS SAID THIS PATIENT NEEDS TRANSPORT — three states, never two (finding 5).
 *
 * `MovementTransportNeed`'s own doc comment forbids collapsing "not needed" into "not recorded",
 * and `transportNeedState` exists to keep them apart. This page never called it; the readiness
 * line simply asserted "Not yet requested" on all fifty movements, which is an unearned claim
 * today and an outright falsehood the moment anything records `needed: false`.
 */
function transportNeedSentence(movement: Movement, now: Instant): string {
  const state = transportNeedState(movement);
  if (state === "needed") {
    return `Yes — recorded as needed${movement.transportNeed ? ` at ${formatInstantWithDay(movement.transportNeed.at, now)}` : ""}.`;
  }
  if (state === "not_needed")
    return "No — somebody recorded that this patient needs no transport. That is an answer, not a gap.";
  return "Nobody has recorded an answer either way. This is not the same as deciding transport is not needed.";
}

/**
 * WHERE THE FORM STANDS — the readiness verdict, never the form line itself.
 *
 * `legalFormReadinessLine` prints "Transfer form (4C) · due 15:42", and the Legal and forms panel
 * is where that lives. Printing it in Readiness too was one of the five duplications the 2026-09-04
 * cold read counted. This says only the thing Readiness is for: is the form in a state that lets
 * this patient travel. When it is not, it points at the rail rather than restating the clock —
 * `attentionItems` raises a due or breached deadline as its own item with the minutes on it.
 */
function formReadinessState(legalForm: LegalForm | undefined, now: Instant): string {
  if (!legalForm) return "No legal form is recorded on this movement.";
  if (legalForm.dueAt === undefined) return "Recorded, with no deadline on it.";
  const state = clockState(legalForm.dueAt, now);
  if (state === "breached") return "Recorded, and its deadline has passed. Needs attention says by how much.";
  if (state === "critical" || state === "due") {
    return "Recorded, and its deadline is close. Needs attention says how close.";
  }
  return "Recorded, and its deadline is still ahead.";
}

/**
 * WHETHER THIS PATIENT COULD TRAVEL — the readiness verdict, never the transport record.
 *
 * The five distinct states `transportNeedState` keeps apart are kept apart here too: this removes
 * a duplicate sentence, not a distinction. What it does NOT restate is the job's own state,
 * provider, escort or requested form — all four are rows in the Transport panel below, which is
 * where they live.
 */
function transportReadinessState(movement: Movement, open: boolean): string {
  if (!open && movement.transport === undefined) return "Nothing was arranged before this movement closed.";
  if (movement.transport) return "A transport job exists.";
  if (transportNeedState(movement) === "not_needed") return "None is needed, and somebody recorded that.";
  if (transportNeedState(movement) === "needed") return "Needed, and no job has been raised for it yet.";
  return "Nothing recorded either way — neither a job nor an answer about whether one is wanted.";
}

/**
 * WHETHER SOMETHING IS HOLDING THIS UP — never the prose itself.
 *
 * ⚠️ THE FIVE "NOTHING IS BLOCKING" VALUES ARE FIVE DIFFERENT FACTS AND STAY THAT WAY.
 * `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` exists because "nobody ever recorded one" and "somebody
 * cleared the one that was there" are different things to know about a patient. Removing a
 * repetition from this panel is not licence to collapse them into a single "none".
 */
function blockerReadinessState(movement: Movement, open: boolean, blockerIsActive: boolean): string {
  /*
   * ⚠️ THE CLOSED BRANCH USED TO COLLAPSE ALL FIVE FACTS INTO TWO, THREE LINES BELOW A COMMENT
   * SAYING THEY "ARE FIVE DIFFERENT FACTS AND STAY THAT WAY". It returned "Nothing was recorded as
   * holding this up" for every closed movement without an active blocker — so WF-007 rendered that
   * sentence on the same page as "None — handover complete", which IS a record, three inches away.
   * The page contradicted itself and asserted an absence of information it was simultaneously
   * displaying. Found by reading fifty rendered pages after the suite was green.
   *
   * ⚠️ TWO OF THE FIVE HAD NEVER BEEN ON A SCREEN, AND THE REASON MATTERS MORE THAN THE FACT.
   * `PATIENT_ARRIVED` writes `blocker: "None — handover complete"` and `closure` in the SAME
   * object, and the two non-arrival closures do the same for "None — the movement did not
   * proceed", so **no reducer flow can produce either value on an open movement.** They belong in
   * the closed branch and were only in the open one, which is why a closed movement fell through
   * to the collapsed sentence above.
   *
   * 🔴 BUT THEY ARE NOT UNREACHABLE UNDER `open`, AND THE FIRST VERSION OF THIS COMMENT SAID THEY
   * WERE. The free-text blocker box dispatches `RECORD_MOVEMENT_BLOCKER` with the draft exactly as
   * typed, and that event's near-miss guard only refuses a CASE variant
   * (`inactive.toLowerCase() === blocker.toLowerCase() && inactive !== blocker`) — an EXACT match
   * escapes it and is stored verbatim. So the open arms stay. Deleting them as dead would have
   * made a reachable state print "Nobody has recorded anything as holding this up" over a value
   * somebody had just typed, which is the same false-absence defect this whole function is being
   * repaired for.
   *
   * The exact-string escape is a separate open question — it lets a coordinator stamp "handover
   * complete" on a patient who has not arrived — and is recorded in the tracker rather than
   * decided here.
   */
  if (!open) {
    if (blockerIsActive) {
      return "A note was recorded before this movement closed. Nothing is holding it up now, because nothing is moving.";
    }
    if (movement.blocker === "None — cleared") {
      return "Somebody recorded a blocker and cleared it before this movement closed.";
    }
    if (movement.blocker === "None — in transit") {
      return "Nothing was holding this up: the patient was in transit when it closed.";
    }
    if (movement.blocker === "None — handover complete") {
      return "Nothing was holding this up: handover was complete.";
    }
    if (movement.blocker === "None — the movement did not proceed") {
      return "Nothing was holding this up: the movement did not proceed.";
    }
    return "Nothing was recorded as holding this up.";
  }
  if (blockerIsActive) return "Somebody has recorded, by hand, something that is holding this up.";
  if (movement.blocker === "None — cleared") {
    return "Somebody recorded a blocker and then cleared it. Nothing is holding this up now.";
  }
  if (movement.blocker === "None — in transit") return "Nothing is holding this up: the patient is in transit.";
  if (movement.blocker === "None — handover complete") return "Nothing is holding this up: handover is complete.";
  if (movement.blocker === "None — the movement did not proceed") {
    return "Nothing is holding this up: the movement did not proceed.";
  }
  return "Nobody has recorded anything as holding this up.";
}

/**
 * THE JOB ROW IN THE TRANSPORT PANEL, and nothing else — it has exactly one call site.
 *
 * ⚠️ IT USED TO RE-ANSWER THE QUESTION IN THE ROW DIRECTLY ABOVE IT. "Is transport needed?" says
 * whether anybody has recorded an answer; this row then said "…and nobody has recorded whether one
 * is needed" again, one line below, in the same panel. The need is `transportNeedSentence`'s
 * subject and the job is this one's, and they no longer overlap. The readiness verdict beside them
 * is a third derivation — `transportReadinessState` — so no two of the three restate each other.
 */
function transportReadinessLine(movement: Movement, open: boolean): string {
  if (!open && movement.closure && movement.transport === undefined) {
    return "No transport was arranged before this movement closed";
  }
  if (movement.transport) return transportStatusLabel(movement.transport);
  // The three no-job cases stay three sentences: the row above gives the need, and what a reader
  // needs from this row is whether that answer has been acted on.
  if (transportNeedState(movement) === "not_needed") return "No job has been raised, and none is wanted.";
  if (transportNeedState(movement) === "needed") return "No job has been raised for it yet.";
  return "No job has been raised.";
}
