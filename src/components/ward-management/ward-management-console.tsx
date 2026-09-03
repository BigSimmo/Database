"use client";

import {
  ArrowLeft,
  ArrowRight,
  BedSingle,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { ContextualBackLink } from "@/components/contextual-back-link";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { MissingValue } from "@/components/ui/missing-value";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import {
  candidateReason,
  destinationUnit,
  eligibleCandidatesAmong,
  movementHealthService,
  movementTimeline,
  stageCopy,
  stageSummaries,
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
} from "@/components/ward-management/ward-model";
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
 */
function legalFormReadinessLine(legalForm: LegalForm): string {
  // A code this model holds no label for — Form 3D — is named by its code alone, never by a
  // guessed expansion and never by the word "undefined".
  const named = legalFormNameLabelFirst(legalForm);
  return legalForm.dueAt !== undefined
    ? `${named} · due ${formatInstant(legalForm.dueAt)}`
    : `${named} · no deadline recorded`;
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

function MovementPipeline({
  activeStage,
  onStageChange,
  stages,
}: {
  activeStage: MovementStage;
  onStageChange: (stage: MovementStage) => void;
  stages: ReturnType<typeof stageSummaries>;
}) {
  return (
    <nav className={styles.movementPipeline} aria-label="Patient movement stages">
      {stages.map((stage, index) => {
        const Icon = stageIcons[stage.id];
        const active = stage.id === activeStage;
        return (
          <div className={styles.stageGroup} key={stage.id}>
            <button
              type="button"
              onClick={() => onStageChange(stage.id)}
              aria-current={active ? "step" : undefined}
              className={active ? styles.stageActive : styles.stage}
            >
              <Icon aria-hidden="true" />
              <span className={styles.stageNumber}>{index + 1}</span>
              <span>
                <strong>{stage.label}</strong>
                <b>{stage.count}</b>
              </span>
            </button>
            {index < stages.length - 1 ? <ArrowRight className={styles.stageArrow} aria-hidden="true" /> : null}
          </div>
        );
      })}
    </nav>
  );
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
 */
export function WardPatientWorkspace({ movementId }: { movementId: MovementId }) {
  const { dispatch, movements, now, units } = useWardFlow();
  // Read the live, single source of truth rather than the frozen fixture — a patient just
  // referred on the coordinator screen must resolve here too, and a missing id must render an
  // explicit "not found" rather than ever substituting a different movement.
  const patient: Movement | undefined = movements.find((candidate) => candidate.id === movementId);
  const [activeSection, setActiveSection] = useState<"overview" | "legal" | "transport" | "timeline">("overview");
  const [activeStage, setActiveStage] = useState<MovementStage>(patient?.stage ?? MOVEMENT_STAGES[0]);
  /* The DRAFT only. Never a mirror of `patient.blocker` — the rendered value below reads the record
     itself, so what is on screen after a dispatch is what the reducer actually stored, and a
     refused event cannot leave this page claiming a blocker was recorded. That failure has already
     happened once on this screen (see the Review & confirm button's own comment). */
  const [blockerDraft, setBlockerDraft] = useState("");

  if (!patient) {
    return (
      <div className={styles.patientWorkspace} data-testid="ward-patient-workspace">
        <ClinicalRail />
        <header className={styles.workspaceHeader}>
          <ContextualBackLink fallbackHref="/mockups/ward-flow" aria-label="Back to Ward Flow">
            <ArrowLeft aria-hidden="true" />
          </ContextualBackLink>
          <div>
            <span>Ward Flow</span>
            <h1>Movement not found</h1>
          </div>
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
        </header>
        <main id="main-content" className={styles.workspaceMain}>
          <p className={styles.governanceNote}>
            No synthetic movement matches &ldquo;{movementId}&rdquo;. It may have arrived and closed, or the id is
            incorrect.
          </p>
        </main>
      </div>
    );
  }

  // This workspace shows the movement's own record only — it never falls back to a
  // suggested/top-eligible unit, so `destination` here is always the real recorded destination
  // or nothing.
  const destination = destinationUnit(patient, units);
  const verdict = destination ? eligibility(patient, destination, now) : undefined;
  const candidates = eligibleCandidatesAmong(patient, units, now).filter(
    (candidate) => candidate.unit.id !== destination?.id,
  );
  const timeline = movementTimeline(patient);
  /* Read from the SAME closed set `hasActiveBlocker` (ward-priority.ts) uses to decide whether this
     movement scores ten points as obstructed, so the Clear control appears exactly when the score
     says something is blocking. A second hand-written list here is how a screen comes to offer a
     control the reducer refuses — the drift this codebase produces most reliably. */
  const blockerIsActive = !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === patient.blocker.trim());
  // Reads the provider's live units, same as `destination` above — a unit renamed underneath
  // this movement must resolve here too, not to a name frozen at import time. Falls back to the
  // raw id (never a substituted unit) when nothing in the live set matches.
  const unitName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? unitId;
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

  return (
    <div className={styles.patientWorkspace} data-testid="ward-patient-workspace">
      <ClinicalRail />
      <header className={styles.workspaceHeader}>
        <ContextualBackLink fallbackHref="/mockups/ward-flow" aria-label="Back to Ward Flow">
          <ArrowLeft aria-hidden="true" />
        </ContextualBackLink>
        <div>
          <span>Ward Flow</span>
          <h1>{patient.id} movement workspace</h1>
        </div>
        <span className={styles.prototypeBadge}>Synthetic prototype</span>
      </header>
      <main id="main-content" className={styles.workspaceMain}>
        <section className={styles.workspaceSummary}>
          <div>
            <span className={styles.aiLabel}>
              <Sparkles aria-hidden="true" /> Eligibility check
            </span>
            <h2>{destination ? destination.name : "No destination selected"}</h2>
            <p>
              {movementHealthService(patient) ?? "Unknown service"} · {patient.cohort} {patient.security}
            </p>
          </div>
          <div className={styles.workspaceScore}>
            <span>Eligibility</span>
            {/*
              `verdict` is undefined only while no destination is selected (line above),
              so eligibility has not been computed — it is not inapplicable, and nothing
              is missing from the record. The heading beside it already reads
              "No destination selected".
            */}
            <strong>{verdict ? candidateReason(verdict) : <MissingValue reason="not_yet_calculated" />}</strong>
            <small>Tier {patient.urgency} leads</small>
          </div>
          {/*
           * ⚠️ THIS BUTTON USED TO SAY "Destination confirmed" AND RECORD NOTHING.
           * It flipped a local `useState` and relabelled itself. Nothing was dispatched, so navigating
           * away proved the confirmation had never existed - the app told the user an action had
           * succeeded when no action had occurred. That is the one class of untruth the owner named as
           * mattering, and it was found by a triage looking for something else entirely.
           *
           * It is now the repository's placeholder contract (`docs/wiring-conventions.md`):
           * `aria-disabled` with an inert handler and a stated reason, NOT native `disabled`, because
           * native `disabled` removes the tab stop and the reason would never be reached. The two
           * attributes together fail lint, so this cannot also carry `disabled={!destination}` - and it
           * does not need to, since the control is unavailable whether or not a destination is chosen.
           *
           * ⚠️ DO NOT WIRE THIS TO AN EVENT TO "FINISH" IT. Which event a confirmation dispatches, in
           * which role, and what it does to the movement is a design decision the owner holds; it was
           * put to him on 2026-09-01 and he chose this placeholder while he decides.
           */}
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

        <MovementPipeline activeStage={activeStage} onStageChange={setActiveStage} stages={stageSummaries(movements)} />

        <nav className={styles.workspaceTabs} aria-label="Patient movement sections">
          {(["overview", "legal", "transport", "timeline"] as const).map((section) => (
            <button
              type="button"
              key={section}
              onClick={() => setActiveSection(section)}
              aria-pressed={activeSection === section}
            >
              {section === "overview"
                ? "Overview"
                : section === "legal"
                  ? "Legal & forms"
                  : section === "transport"
                    ? "Transport"
                    : "Audit timeline"}
            </button>
          ))}
        </nav>

        <div className={styles.workspaceGrid}>
          <section>
            <h2>Movement facts</h2>
            <dl className={styles.factList}>
              <div>
                <dt>Current stage</dt>
                <dd>{stageCopy[patient.stage].label}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{patient.owner}</dd>
              </div>
              <div>
                <dt>Referral</dt>
                <dd>{destination ? destination.name : `${patient.referredUnitIds.length} referred`}</dd>
              </div>
              <div>
                <dt>Response</dt>
                <dd>{patient.blocker}</dd>
              </div>
              <div>
                <dt>Health service</dt>
                <dd>{movementHealthService(patient) ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Setting</dt>
                <dd>
                  {patient.cohort} · {patient.security}
                </dd>
              </div>
            </dl>
          </section>

          <section id="match-explanation">
            <h2>Why this match</h2>
            {verdict ? (
              <ul className={styles.reasonList}>
                {verdict.gates.map((gate) => (
                  <li key={gate.gate}>
                    {gate.pass ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />} {gate.detail}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Select a destination to see eligibility checks.</p>
            )}
            <h3>Alternatives</h3>
            {candidates.map((candidate) => (
              <div className={styles.alternativeRow} key={candidate.unit.id}>
                <span>
                  <strong>{candidate.unit.name}</strong>
                  <small>{candidateReason(candidate.verdict)}</small>
                </span>
                <b>{candidate.verdict.eligible ? "Eligible" : "Not eligible"}</b>
              </div>
            ))}
          </section>

          <section>
            <h2>Readiness</h2>
            <ul className={styles.readinessList}>
              <li>
                <FileCheck2 aria-hidden="true" />
                <span>
                  <strong>Legal status</strong>
                  {patient.legalStatus}
                </span>
              </li>
              <li>
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>Form readiness</strong>
                  {patient.legalForm ? legalFormReadinessLine(patient.legalForm) : "No legal form recorded"}
                </span>
              </li>
              <li>
                <Truck aria-hidden="true" />
                <span>
                  <strong>Transport</strong>
                  {transportStatusLabel(patient.transport)}
                </span>
              </li>
              <li>
                <CircleAlert aria-hidden="true" />
                <span>
                  <strong>Current blocker</strong>
                  {patient.blocker}
                </span>
              </li>
            </ul>
          </section>
        </div>

        {activeSection === "legal" ? (
          <section className={styles.contextPanel}>
            <h2>Legal and forms</h2>
            <p>{patient.legalStatus}</p>
            <p>
              {/* Until 2026-08-24 the absent case here named the Mental Health Act and asserted
                  that no transport form was needed — wrong twice over. It claimed what the Act
                  demands of this patient, which this prototype cannot verify in either direction,
                  and it named a transport instrument inside the legal panel, which reads
                  `patient.legalForm`. It is also the DEFAULT rendering now that the clinician
                  picks the form and the picker starts at none, so it was the most-shown legal
                  claim on this route. Same wording as the readiness line 28 lines above: state
                  what the record holds. */}
              {patient.legalForm ? legalFormReadinessLine(patient.legalForm) : "No legal form recorded"}
            </p>
          </section>
        ) : null}
        {activeSection === "transport" ? (
          <section className={styles.contextPanel}>
            <h2>Transport chain</h2>
            <p>{transportStatusLabel(patient.transport)}</p>
            <p>
              Provider, ETA, risk documentation and legal-form readiness are visible here; dispatch and live vehicle
              tracking are not part of this prototype.
            </p>
          </section>
        ) : null}
        {activeSection === "timeline" ? (
          <section className={styles.contextPanel}>
            <h2>Synthetic audit timeline</h2>
            <ol className={styles.timeline}>
              {timeline.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <time>{formatInstantWithDay(event.at, now)}</time>
                  <span>{event.label}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/*
         * THE URGENT FLAG — and the control the owner asked for, which until 2026-09-01 did not
         * exist anywhere in the application.
         *
         * `Movement.flaggedUrgent` was added on 2026-08-30 with a ranking rule above it —
         * `queueOrder` (ward-priority.ts) puts it ABOVE all three urgency tiers — and a "Flagged
         * urgent" badge on the coordinator queue below it. Its only writer was the literal `false`
         * at creation, and exactly one hand-authored movement carried `true`. The feature was
         * complete and unreachable: the ordering worked, the badge worked, and nobody could ever
         * cause either to happen.
         *
         * ⚠️ BOTH DIRECTIONS ON ONE CONTROL, decided by the record and never by a local flag. A
         * flag that could be set and not cleared would be a new permanent state — a patient sitting
         * above every tier for the rest of the demonstration after their situation resolved.
         *
         * The state is STATED IN WORDS, not left to the button's label alone. A reader of this page
         * has no badge here — the badge is on the coordinator queue — and "this patient outranks
         * every tier" is not something to infer from the fact that a button says "Remove".
         *
         * ⚠️ NO REASON IS ASKED FOR, deliberately. The owner said "for many reasons", plural and
         * unenumerated, and `Movement.flaggedUrgent`'s own doc comment records that inventing a
         * vocabulary for them is part of the "later" he deferred. A free-text box here would be
         * the same overreach in a different shape.
         */}
        <section className={styles.contextPanel} data-testid="ward-patient-urgent-flag">
          <h2>Urgent flag</h2>
          <p>
            {patient.flaggedUrgent
              ? "Flagged urgent. This patient leads the queue ahead of every urgency tier, including tier 1."
              : "Not flagged. This patient is ordered by urgency tier and waiting time, like everybody else."}
          </p>
          {patient.closure && !patient.flaggedUrgent ? (
            <p>
              This movement is closed ({patient.closure.reason}), so it is not in the queue at all and flagging it would
              change nothing.
            </p>
          ) : (
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
                  type: patient.flaggedUrgent ? "CLEAR_MOVEMENT_URGENT_FLAG" : "FLAG_MOVEMENT_URGENT",
                  role: "coordinator",
                  now,
                  movementId: patient.id,
                })
              }
            >
              {patient.flaggedUrgent ? "Remove the urgent flag" : "Flag this patient as urgent"}
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
         * referral", and no stage transition ever touched it — so this page's **Response** and
         * **Current blocker** lines above told a coordinator that a patient whose ambulance was
         * already moving was still waiting to be referred, and somebody chased the wrong patient.
         *
         * The reducer now restates it wherever a transition contradicts it — including both
         * transport legs, so a patient whose ambulance is moving no longer reads as awaiting a
         * provider's answer. This control is the other half, and the more important one: a single
         * room not yet
         * clean, a family not yet reached, an escort provider still finding a vehicle — none of
         * those exist anywhere in the model, and only a person can put them here. That is why the
         * field is free prose and not a picker (owner ruling, 2026-09-01).
         *
         * A closed movement gets the reason stated rather than a control that would be refused —
         * the same discipline `referralBlockedReason` uses for the Refer control.
         */}
        <section className={styles.contextPanel} data-testid="ward-patient-blocker">
          <h2>What is holding this up</h2>
          <p>{patient.blocker}</p>
          {patient.closure ? (
            <p>
              This movement is closed ({patient.closure.reason}), so nothing can be holding it up and no new blocker can
              be recorded against it.
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
                  movementId: patient.id,
                  blocker: blockerDraft,
                });
                setBlockerDraft("");
              }}
            >
              <label className={styles.blockerLabel} htmlFor="ward-console-blocker">
                What is holding this up? Wards, roles and jobs only — never a patient&rsquo;s name, details or clinical
                narrative. To say nothing is holding it up, use Clear rather than typing it.
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
                      movementId: patient.id,
                    })
                  }
                >
                  Clear — nothing is holding this up
                </button>
              )}
            </form>
          )}
        </section>

        {/* Task 10 (spec item 8): always-rendered, never gated behind a tab — each section
            carries its own explicit absence line when the movement has none of that record,
            per the conservative-failure constraint. A hidden section that simply omits itself
            when empty is exactly what that constraint forbids. */}
        <section className={styles.contextPanel} data-testid="ward-patient-declines">
          <h2>Declines</h2>
          {patient.declines.length > 0 ? (
            <ol className={styles.timeline}>
              {patient.declines.map((decline, index) => (
                <li key={`${decline.unitId}-${decline.at}-${index}`}>
                  <time>{formatInstantWithDay(decline.at, now)}</time>
                  <span>
                    {unitName(decline.unitId)} · {declineReasonLabels[decline.reason]}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p>No declines recorded for this movement.</p>
          )}
        </section>

        <section className={styles.contextPanel} data-testid="ward-patient-changes">
          <h2>Status and urgency changes</h2>
          {changeEvents.length > 0 ? (
            <ol className={styles.timeline}>
              {changeEvents.map((change, index) => (
                <li key={`${change.kind}-${change.at}-${index}`}>
                  <time>{formatInstantWithDay(change.at, now)}</time>
                  <span>
                    {change.kind === "legal" ? "Legal status" : "Urgency"} changed {change.detail} by {change.by} ·{" "}
                    {change.reasonLabel}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p>No status or urgency changes recorded for this movement.</p>
          )}
        </section>

        <section className={styles.contextPanel} data-testid="ward-patient-escalation">
          <h2>Escalation</h2>
          {patient.escalation ? (
            <dl className={styles.factList}>
              <div>
                <dt>When</dt>
                <dd>{formatInstantWithDay(patient.escalation.at, now)}</dd>
              </div>
              <div>
                <dt>Units tried</dt>
                <dd>{patient.escalation.triedUnitIds.map((unitId) => unitName(unitId)).join(", ")}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>{patient.escalation.contact}</dd>
              </div>
            </dl>
          ) : (
            <p>No escalation recorded for this movement.</p>
          )}
        </section>

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
}
