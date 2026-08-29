"use client";

import {
  ArrowLeft,
  ArrowRight,
  BedSingle,
  CalendarDays,
  Check,
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
import { MissingValue } from "@/components/ui/missing-value";
import { formatInstant } from "@/components/ward-management/ward-clock";
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
  MOVEMENT_STAGES,
  type DeclineReason,
  type LegalForm,
  type Movement,
  type MovementStage,
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
  bed_held_for_earlier_referral: "Bed held for earlier referral",
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
  bed_held: CalendarDays,
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

export function WardPatientWorkspace({ patientId }: { patientId: string }) {
  const { movements, now, units } = useWardFlow();
  // Read the live, single source of truth rather than the frozen fixture — a patient just
  // referred on the coordinator screen must resolve here too, and a missing id must render an
  // explicit "not found" rather than ever substituting a different movement.
  const patient: Movement | undefined = movements.find((candidate) => candidate.id === patientId);
  const [confirmed, setConfirmed] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "legal" | "transport" | "timeline">("overview");
  const [activeStage, setActiveStage] = useState<MovementStage>(patient?.stage ?? MOVEMENT_STAGES[0]);

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
            No synthetic movement matches &ldquo;{patientId}&rdquo;. It may have arrived and closed, or the id is
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
          <button
            type="button"
            onClick={() => setConfirmed(true)}
            className={confirmed ? styles.confirmedButton : styles.confirmButton}
            disabled={!destination}
          >
            {confirmed ? <Check aria-hidden="true" /> : null}
            {confirmed ? "Destination confirmed" : "Review & confirm"}
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
                  <time>{formatInstant(event.at)}</time>
                  <span>{event.label}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

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
                  <time>{formatInstant(decline.at)}</time>
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
                  <time>{formatInstant(change.at)}</time>
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
                <dd>{formatInstant(patient.escalation.at)}</dd>
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
        <span className="sr-only" aria-live="polite">
          {confirmed ? `Destination confirmed for ${patient.id}` : ""}
        </span>
      </main>
    </div>
  );
}
