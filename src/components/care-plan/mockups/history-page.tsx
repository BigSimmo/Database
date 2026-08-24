"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import { buildPatientSnapshot, getPresentationAmendments } from "./domain";
import { PROTOTYPE_NOW } from "./fixtures";
import { IDENTIFICATION_DECISION_LABEL, contactVerificationSummary } from "./operations-pages";
import { PatientNavigation } from "./patient-navigation";
import { AMENDABLE_FIELD_LABEL, presentationAnswerDisplay, siteName } from "./presentation-timeline";
import { useCarePlanPrototype } from "./prototype-provider";
import {
  DefinitionRow,
  MANAGEMENT_VERSION_STATE_LABEL,
  PATIENT_CONFIRMATION_LABEL,
  SectionFrame,
  StatusMark,
  SyntheticMarker,
  formatPerthDate,
  formatPerthDateTime,
} from "./prototype-ui";
import { carePlanRoute } from "./routes";
import type { AuditEventType, CarePlanPrototypeState, Patient, PrototypeScenario, SyntheticId } from "./types";

/**
 * One patient's combined chronology: what happened to their plans, their own
 * Personal Safety Plan, their ED Presentations and the corrections made to them,
 * the team-contact checks, the identification referrals, and every request this
 * application made to open an external application on somebody's device.
 *
 * Two rules govern every line on this page.
 *
 * **It describes only evidence this application actually has.** Opening an email
 * link is a request to open an email application, and that is all it will ever
 * be called: not sent, not delivered, not read, not answered, not acted on.
 * Opening a print view is a print view opening — this application never sees a
 * printer, a sheet of paper, or a reader.
 *
 * **Nothing is counted twice.** The record-derived events are read from the
 * records' own timestamps, which is the only account that survives a reload.
 * The session's audit events contribute only the kinds of action that leave no
 * record behind them — the print and contact requests — so approving a version
 * appears once rather than once from the version and once from its audit event.
 */

export type HistoryGroup =
  | "managementPlan"
  | "safetyPlan"
  | "patientPlan"
  | "presentations"
  | "intents"
  | "contactVerification"
  | "identificationReview";

export const HISTORY_GROUP_LABEL: Record<HistoryGroup, string> = {
  managementPlan: "Management Plan",
  safetyPlan: "Personal Safety Plan",
  patientPlan: "Patient Plan",
  presentations: "ED Presentations",
  intents: "Print and contact actions",
  contactVerification: "Team contact details",
  identificationReview: "Identification Review",
};

const HISTORY_GROUP_ORDER = Object.keys(HISTORY_GROUP_LABEL) as readonly HistoryGroup[];

const ALL_GROUPS = "";

type HistoryEntry = {
  id: string;
  group: HistoryGroup;
  occurredAt: string;
  heading: string;
  detail: string;
  /** Who this is attributed to, or `null` when the record names nobody. */
  actorId: SyntheticId | null;
};

/**
 * The five audit-event kinds that leave no other trace. Everything else in the
 * audit stream is already represented by the record it changed, and reading both
 * would print the same event twice.
 */
const INTENT_EVENT_HEADING: Partial<Record<AuditEventType, string>> = {
  email_intent_opened: "An email application was asked to open",
  call_intent_opened: "A telephone application was asked to open",
  management_plan_print_intent_opened: "The Management Plan print view was opened",
  safety_plan_print_intent_opened: "The Personal Safety Plan print view was opened",
  patient_plan_print_intent_opened: "The Patient Plan print view was opened",
};

function buildHistory(state: CarePlanPrototypeState, patient: Patient): HistoryEntry[] {
  const entries: HistoryEntry[] = [];

  for (const version of state.managementPlanVersions) {
    if (version.planId !== patient.managementPlanId) continue;
    entries.push({
      id: `${version.id}-created`,
      group: "managementPlan",
      occurredAt: version.createdAt,
      heading: `Management Plan version ${version.version} drafted`,
      detail: version.revisionReason,
      actorId: version.authorId,
    });
    // A first draft in the fixtures carries a submission time it never used, so
    // the submission line is emitted only for a version that actually left the
    // author's hands. A version returned to Draft therefore loses this line
    // rather than gaining a claim the record cannot support.
    if (version.submittedAt !== null && version.state !== "draft") {
      entries.push({
        id: `${version.id}-submitted`,
        group: "managementPlan",
        occurredAt: version.submittedAt,
        heading: `Management Plan version ${version.version} submitted for approval`,
        detail:
          "A submitted version is read-only while a named senior clinician compares it. It is not a plan in use, and the Current Plan was unaffected.",
        actorId: version.authorId,
      });
    }
    if (version.approvedAt !== null) {
      entries.push({
        id: `${version.id}-approved`,
        group: "managementPlan",
        occurredAt: version.approvedAt,
        heading: `Management Plan version ${version.version} approved and made the Current Plan`,
        detail: `Any previously Current version became Superseded at the same moment and stays readable here. Next review was set for ${formatPerthDate(version.reviewDueAt)}.`,
        actorId: version.approverId,
      });
    }
    if (version.withdrawnAt !== null) {
      entries.push({
        id: `${version.id}-withdrawn`,
        group: "managementPlan",
        occurredAt: version.withdrawnAt,
        heading: `Management Plan version ${version.version} withdrawn`,
        detail: `${version.withdrawalReason ?? "No reason was recorded."} No earlier version was restored in its place.`,
        actorId: version.withdrawnBy,
      });
    }
    if (version.sharedWithPatientAt !== null) {
      entries.push({
        id: `${version.id}-shared`,
        group: "managementPlan",
        occurredAt: version.sharedWithPatientAt,
        heading: `Management Plan version ${version.version} shown to ${patient.preferredName}`,
        detail:
          "This records that the plan was gone through with this person. It is not a Patient Plan, and it is not their agreement to it.",
        actorId: null,
      });
    }
  }

  for (const version of state.personalSafetyPlanVersions) {
    if (version.planId !== patient.personalSafetyPlanId) continue;
    entries.push({
      id: `${version.id}-created`,
      group: "safetyPlan",
      occurredAt: version.createdAt,
      heading: `Personal Safety Plan version ${version.version} written`,
      detail: version.collaborationNote,
      actorId: version.authorId,
    });
    if (version.confirmedAt !== null) {
      entries.push({
        id: `${version.id}-confirmation`,
        group: "safetyPlan",
        occurredAt: version.confirmedAt,
        heading: `Personal Safety Plan version ${version.version} — ${PATIENT_CONFIRMATION_LABEL[version.patientConfirmation]}`,
        detail:
          "This is this person's own document. What is recorded here is their part in this version, not a clinical approval of it.",
        actorId: version.authorId,
      });
    }
  }

  const patientPlan = state.patientPlans.find((plan) => plan.patientId === patient.id) ?? null;
  for (const version of state.patientPlanVersions) {
    if (patientPlan === null || version.planId !== patientPlan.id) continue;
    const source =
      state.managementPlanVersions.find(({ id }) => id === version.derivedFromManagementVersionId) ?? null;
    entries.push({
      id: `${version.id}-created`,
      group: "patientPlan",
      occurredAt: version.createdAt,
      heading: `Patient Plan version ${version.version} written`,
      detail:
        source === null
          ? "The Management Plan Version it was written from is not in this session."
          : `Written from Management Plan version ${source.version}. Anything the conversion could not put into ${patient.preferredName}'s own words was left as a gap for a person to write.`,
      actorId: null,
    });
    if (version.approvedAt !== null) {
      entries.push({
        id: `${version.id}-approved`,
        group: "patientPlan",
        occurredAt: version.approvedAt,
        heading: `Patient Plan version ${version.version} approved`,
        detail: `This is the copy ${patient.preferredName} may be holding. It is never regenerated, hidden, or withdrawn on their behalf.`,
        actorId: version.approvedBy,
      });
    }
  }

  for (const presentation of state.edPresentations) {
    if (presentation.patientId !== patient.id) continue;
    entries.push({
      id: `${presentation.id}-recorded`,
      group: "presentations",
      occurredAt: presentation.recordedAt,
      heading: "ED Presentation recorded",
      detail: `${siteName(state.edSites, presentation.siteId)}, arrived ${formatPerthDateTime(presentation.arrivedAt)}. ${presentation.note}`,
      actorId: presentation.recordedBy,
    });
    for (const amendment of getPresentationAmendments(state.presentationAmendments, presentation.id)) {
      entries.push({
        id: amendment.id,
        group: "presentations",
        occurredAt: amendment.amendedAt,
        heading: `ED Presentation corrected — ${AMENDABLE_FIELD_LABEL[amendment.field]}`,
        detail: `Recorded as ${presentationAnswerDisplay(amendment.field, amendment.originalValue)}. Corrected to ${presentationAnswerDisplay(amendment.field, amendment.replacementValue)}. ${amendment.reason} The episode itself was never rewritten.`,
        actorId: amendment.authorId,
      });
    }
  }

  const cmht = state.cmhtContacts.find(({ id }) => id === patient.cmhtId) ?? null;
  if (cmht !== null) {
    entries.push({
      id: `${cmht.id}-verification`,
      group: "contactVerification",
      occurredAt: cmht.verifiedAt,
      heading: `${cmht.name} contact details — ${contactVerificationSummary(cmht)}`,
      detail:
        "Somebody looked at the displayed mailbox, duty number, and operating hours on that date. That is not a guarantee that the service is available.",
      actorId: null,
    });
  }

  for (const review of state.identificationReviews) {
    if (review.patientId !== patient.id) continue;
    entries.push({
      id: `${review.id}-referred`,
      group: "identificationReview",
      occurredAt: review.referredAt,
      heading: "Referred for Identification Review",
      detail: `${review.reason} Referring somebody creates no plan and decides no eligibility.`,
      actorId: review.referredBy,
    });
    if (review.decidedAt !== null && review.decision !== null) {
      entries.push({
        id: `${review.id}-closed`,
        group: "identificationReview",
        occurredAt: review.decidedAt,
        heading: `Identification Review closed — ${IDENTIFICATION_DECISION_LABEL[review.decision]}`,
        detail: `${review.decisionReason ?? "No reason was recorded."} Closing the review created no plan and approved nothing.`,
        actorId: review.decidedBy,
      });
    }
  }

  for (const event of state.auditEvents) {
    const heading = INTENT_EVENT_HEADING[event.type];
    if (heading === undefined) continue;
    if (event.patientId !== patient.id) continue;
    entries.push({
      id: event.id,
      group: "intents",
      occurredAt: event.occurredAt,
      heading,
      detail: event.evidence,
      actorId: event.actorId,
    });
  }

  return entries.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
}

export function HistorySurface({ patientId, scenario }: { patientId: string | null; scenario: PrototypeScenario }) {
  const { state } = useCarePlanPrototype();
  const [group, setGroup] = useState<HistoryGroup | typeof ALL_GROUPS>(ALL_GROUPS);

  const snapshot = patientId === null ? null : buildPatientSnapshot(state, patientId as SyntheticId, PROTOTYPE_NOW);

  const entries = useMemo(
    () => (snapshot === null ? [] : buildHistory(state, snapshot.patient)),
    [state, snapshot],
  );

  if (snapshot === null) {
    return (
      <EmptyState
        testId="care-plan-history-no-patient"
        title="No patient is open."
        body="Open a synthetic patient from Home or Patients, then choose History."
      />
    );
  }

  const { patient } = snapshot;

  if (scenario === "identity-uncertain") {
    return (
      <section aria-label={`${patient.fullName} History`} className={styles.workspace}>
        <p role="alert" data-testid="care-plan-identity-uncertain" className={styles.identityUncertain}>
          <strong>This record has not been confirmed as the right person.</strong> No history is shown, because showing
          a nearby person&rsquo;s record would be worse than showing none. Return to search and choose the record
          again.
        </p>
      </section>
    );
  }

  const visible = group === ALL_GROUPS ? entries : entries.filter((entry) => entry.group === group);

  return (
    <section aria-label={`${patient.fullName} History`} className={styles.workspace}>
      <div data-testid="care-plan-history-identity" className={styles.identityBand}>
        <SyntheticMarker />
        <h2 className={styles.patientName}>{patient.fullName}</h2>
        <dl className={styles.definitionGrid}>
          <DefinitionRow term="MRN">{patient.mrn}</DefinitionRow>
          <DefinitionRow term="Date of birth">{formatPerthDate(patient.dateOfBirth)}</DefinitionRow>
        </dl>
        <PatientNavigation patientId={patient.id} activeSection="history" />
      </div>

      <SectionFrame
        id="care-plan-history"
        heading="What has happened"
        testId="care-plan-history"
        description="Newest first. Every line describes only what this application actually did — never that a message reached anyone, that a call was answered, or that a page printed."
      >
        <div className={styles.historyFilters}>
          <Select
            id="care-plan-history-filter"
            label="Show"
            value={group}
            onChange={(event) => setGroup(event.target.value as HistoryGroup | typeof ALL_GROUPS)}
            options={[
              { value: ALL_GROUPS, label: "Everything on the record" },
              ...HISTORY_GROUP_ORDER.map((key) => ({ value: key, label: HISTORY_GROUP_LABEL[key] })),
            ]}
          />
          <p data-testid="care-plan-history-filter-note" className={styles.contactBoundary}>
            Nothing has been removed from the record by choosing a kind here. This prototype holds everything in
            memory, so reloading the page starts over and anything recorded since then is gone.
          </p>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            testId="care-plan-history-empty"
            title={
              group === ALL_GROUPS
                ? `Nothing has been recorded for ${patient.preferredName} in this synthetic session.`
                : `No ${HISTORY_GROUP_LABEL[group]} action has been recorded for ${patient.preferredName}.`
            }
            body={
              group === ALL_GROUPS
                ? "Recording an ED Presentation, writing a plan, or opening a contact or print action puts a line here."
                : "The rest of the chronology is still on the record. Choose Everything on the record to see it."
            }
          />
        ) : (
          <ol data-testid="care-plan-history-list" className={styles.historyList}>
            {visible.map((entry) => (
              <li key={entry.id} data-occurred-at={entry.occurredAt} className={styles.historyEntry}>
                <h3 className={styles.historyHeading}>
                  <StatusMark tone="neutral" label={HISTORY_GROUP_LABEL[entry.group]} />
                  <span>{entry.heading}</span>
                </h3>
                <p className={styles.historyDetail}>{entry.detail}</p>
                <p className={styles.historyAttribution}>
                  {`${state.users.find(({ id }) => id === entry.actorId)?.displayName ?? "No clinician is recorded"} — ${formatPerthDateTime(entry.occurredAt)}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </SectionFrame>

      <SectionFrame id="care-plan-history-versions" heading="Versions that stay readable" tone="secondary">
        <p className={styles.sectionDescription}>
          {`Superseded and withdrawn versions are never deleted. ${patient.preferredName}'s Management Plan and Personal Safety Plan each keep every version they have ever had.`}
        </p>
        <ul className={styles.contentList}>
          {state.managementPlanVersions
            .filter((version) => version.planId === patient.managementPlanId)
            .map((version) => (
              <li key={version.id}>
                {`Management Plan version ${version.version} — ${MANAGEMENT_VERSION_STATE_LABEL[version.state]}`}
              </li>
            ))}
        </ul>
        <p className={styles.planFooterLink}>
          <Link href={carePlanRoute.managementPlan(patient.id)} className={styles.inlineLink}>
            Back to the Management Plan
          </Link>
        </p>
      </SectionFrame>
    </section>
  );
}
