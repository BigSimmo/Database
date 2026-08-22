"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState, InlineNotice } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import { ContactActions } from "./contact-actions";
import { buildPatientSnapshot, deriveReviewState } from "./domain";
import { PROTOTYPE_NOW } from "./fixtures";
import { PatientNavigation } from "./patient-navigation";
import { useCarePlanPrototype } from "./prototype-provider";
import {
  CurrentPlanSummary,
  DefinitionRow,
  FIRST_MINUTE_SECTION_LABEL,
  MANAGEMENT_VERSION_STATE_LABEL,
  NOT_RECORDED,
  PROTOTYPE_OUTCOME_TONE,
  ParticipationMarker,
  PinnedSafetyBoundary,
  ReviewWarning,
  SectionFrame,
  StatusMark,
  SyntheticMarker,
  formatPerthDate,
} from "./prototype-ui";
import { CARE_PLAN_ROUTES, carePlanRoute } from "./routes";
import {
  FIRST_MINUTE_CONTENT_KEYS,
  type CmhtContact,
  type ManagementPlanContent,
  type ManagementPlanVersion,
  type PrototypeScenario,
  type PrototypeUser,
  type SyntheticId,
} from "./types";

/**
 * The full Management Plan reading surface.
 *
 * Reading comes first, and nothing here reserves space, navigation depth, or
 * attention for the authoring controls that arrive in a later task: there is no
 * edit entry point, no approval control, and no disabled placeholder standing in
 * for one. A reader without authoring permission sees a clean reading surface.
 *
 * The pinned safety boundary and the Current Plan summary card are the shared
 * components the Clinical Snapshot also renders, so a safety-critical element
 * cannot drift into two different renderings of itself.
 */

/**
 * The full-plan tier: every content field that is neither one of the five
 * first-minute sections nor `whyThisPlanExists`, which the tier renders first in
 * its own right.
 *
 * Derived from the content type rather than transcribed. A transcribed list
 * checks membership but not exhaustiveness, so a twelfth content field added
 * later would render on no surface at all and nothing would go red — the exact
 * failure the specification legislated against for the summary card. Because
 * `FullPlanContentKey` is an `Exclude` over `keyof ManagementPlanContent`, the
 * label record below stops compiling the moment a field is added without a
 * heading, and `FULL_PLAN_SECTION_KEYS` is read back off that record rather than
 * being written out a second time.
 */
type FullPlanContentKey = Exclude<
  keyof ManagementPlanContent,
  (typeof FIRST_MINUTE_CONTENT_KEYS)[number] | "whyThisPlanExists"
>;

/** Headings, in the one approved order; the order of this literal is the order
 *  the tier renders, because the keys are read back from it. */
const FULL_PLAN_SECTION_LABEL: Record<FullPlanContentKey, string> = {
  whatThePersonWants: "What this person wants",
  practicalNeeds: "Practical needs",
  physicalHealthAndMedication: "Physical health and medication",
  whoElseIsInvolved: "Who else is involved",
  reviewTriggers: "What should prompt a review",
};

export const FULL_PLAN_SECTION_KEYS = Object.keys(FULL_PLAN_SECTION_LABEL) as readonly FullPlanContentKey[];

function displayName(users: readonly PrototypeUser[], id: SyntheticId | null): string | undefined {
  if (id === null) return undefined;
  return users.find((user) => user.id === id)?.displayName;
}

function PlanList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return <p className={styles.sectionEmpty}>{NOT_RECORDED}</p>;
  return (
    <ul className={styles.contentList}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function PlanSubsection({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={styles.fullPlanSection}>
      <h3 id={id} className={styles.subsectionHeading}>
        {heading}
      </h3>
      {children}
    </section>
  );
}

/** The full-plan tier beneath the summary card. */
function FullPlanTier({ content }: { content: ManagementPlanContent }) {
  return (
    <SectionFrame
      id="care-plan-full-plan"
      heading="The full plan"
      testId="care-plan-full-plan"
      description="Everything agreed beyond the first minute. Read it when there is time; the summary above is what to read when there is not."
    >
      <PlanSubsection id="care-plan-full-plan-whyThisPlanExists" heading="Why this plan exists">
        {content.whyThisPlanExists.trim() === "" ? (
          <p className={styles.sectionEmpty}>{NOT_RECORDED}</p>
        ) : (
          <p className={styles.fullPlanProse}>{content.whyThisPlanExists}</p>
        )}
      </PlanSubsection>
      {FULL_PLAN_SECTION_KEYS.map((key) => (
        <PlanSubsection key={key} id={`care-plan-full-plan-${key}`} heading={FULL_PLAN_SECTION_LABEL[key]}>
          <PlanList items={content[key]} />
        </PlanSubsection>
      ))}
    </SectionFrame>
  );
}

/**
 * A version that is no longer in use, kept fully readable. Withdrawing a plan
 * takes it out of use; it does not delete what was agreed, and a later reader
 * asking what the team used to do has nowhere else to look.
 */
function SupersededContent({ version }: { version: ManagementPlanVersion }) {
  return (
    <SectionFrame
      id="care-plan-superseded-content"
      heading={`${MANAGEMENT_VERSION_STATE_LABEL[version.state]} version ${version.version}`}
      tone="secondary"
      testId="care-plan-superseded-content"
      description="This version is not in use. It stays readable so a reader can see what was agreed before, and no part of it has been restored."
    >
      {FIRST_MINUTE_CONTENT_KEYS.map((key) => (
        <PlanSubsection key={key} id={`care-plan-superseded-${key}`} heading={FIRST_MINUTE_SECTION_LABEL[key]}>
          <PlanList items={version.content[key]} />
        </PlanSubsection>
      ))}
    </SectionFrame>
  );
}

export function ManagementPlanSurface({
  patientId,
  scenario,
}: {
  patientId: string | null;
  scenario: PrototypeScenario;
}) {
  const { state, dispatch } = useCarePlanPrototype();
  const snapshot = patientId === null ? null : buildPatientSnapshot(state, patientId as SyntheticId, PROTOTYPE_NOW);

  if (snapshot === null) {
    return (
      <EmptyState
        testId="care-plan-no-plan-patient"
        title="No patient is open."
        body="Open a synthetic patient from Home or Patients, then choose Management Plan."
      />
    );
  }

  const { patient, cmht, currentManagementVersion, openManagementDraft, withdrawnManagementVersion } = snapshot;

  // Identity uncertainty is the one state where showing the record is the harm.
  // A nearby patient's plan is never displayed as a fallback, on this route any
  // more than on the Clinical Snapshot.
  if (scenario === "identity-uncertain") {
    return (
      <section aria-label={`${patient.fullName} Management Plan`} className={styles.workspace}>
        <p role="alert" data-testid="care-plan-identity-uncertain" className={styles.identityUncertain}>
          <strong>This record has not been confirmed as the right person.</strong> No plan content is shown, because
          showing a nearby person&rsquo;s plan would be worse than showing none. Return to search and choose the record
          again.
        </p>
      </section>
    );
  }

  // Derived at render, never stored. A stored indicator can tell a clinician a
  // plan is current when the date it claims to describe says otherwise.
  const reviewState =
    currentManagementVersion === null || currentManagementVersion.reviewDueAt === null
      ? null
      : deriveReviewState(currentManagementVersion.reviewDueAt, PROTOTYPE_NOW);

  const safetyPlanStatus =
    snapshot.currentSafetyPlanVersion === null
      ? "No current version"
      : `Current version ${snapshot.currentSafetyPlanVersion.version}, confirmed ${formatPerthDate(snapshot.currentSafetyPlanVersion.confirmedAt)}`;

  const openTriggers = state.reviewTriggers.filter(
    (trigger) => trigger.patientId === patient.id && trigger.status === "open",
  );

  const patientPlan = state.patientPlans.find((plan) => plan.patientId === patient.id) ?? null;
  const currentPatientPlanVersion =
    patientPlan === null
      ? null
      : (state.patientPlanVersions.find(
          (version) => version.planId === patientPlan.id && version.state === "current",
        ) ?? null);

  function recordContactIntent(contact: CmhtContact, channel: "email" | "call") {
    dispatch({ type: "record-contact-intent", patientId: patient.id, cmhtId: contact.id, channel });
  }

  return (
    <section aria-label={`${patient.fullName} Management Plan`} className={styles.workspace}>
      <div data-testid="care-plan-plan-identity" className={styles.identityBand}>
        <SyntheticMarker />
        <h2 className={styles.patientName}>{patient.fullName}</h2>
        <dl className={styles.definitionGrid}>
          <DefinitionRow term="MRN">{patient.mrn}</DefinitionRow>
          <DefinitionRow term="Date of birth">{formatPerthDate(patient.dateOfBirth)}</DefinitionRow>
          <DefinitionRow term="Preferred name">{patient.preferredName}</DefinitionRow>
          <DefinitionRow term="Pronouns">{patient.pronouns}</DefinitionRow>
        </dl>
        <PatientNavigation patientId={patient.id} activeSection="managementPlan" />
      </div>

      {currentManagementVersion === null ? null : <PinnedSafetyBoundary content={currentManagementVersion.content} />}

      {state.lastOutcome === null ? null : (
        <div data-testid="care-plan-outcome" data-print-hide="true">
          <InlineNotice tone={PROTOTYPE_OUTCOME_TONE[state.lastOutcome.kind]}>{state.lastOutcome.message}</InlineNotice>
        </div>
      )}

      {currentManagementVersion === null ? null : (
        <ReviewWarning reviewState={reviewState} reviewDueAt={currentManagementVersion.reviewDueAt} />
      )}

      {currentManagementVersion !== null ? (
        <>
          <CurrentPlanSummary
            version={currentManagementVersion}
            ownerName={displayName(state.users, currentManagementVersion.ownerId) ?? NOT_RECORDED}
            approverName={displayName(state.users, currentManagementVersion.approverId) ?? null}
            reviewState={reviewState}
            cmhtName={cmht?.name ?? null}
            cmhtOperatingHours={cmht?.operatingHours ?? null}
            safetyPlanHref={carePlanRoute.safetyPlan(patient.id)}
            safetyPlanStatus={safetyPlanStatus}
          />

          <FullPlanTier content={currentManagementVersion.content} />

          {/*
            Deliberately carries no version mark, review-state mark, or
            participation marker. All three are on the summary card above, and
            the same fact stated twice on one page is not emphasis — it is a
            second copy that a later edit can leave saying something different.
          */}
          <SectionFrame
            id="care-plan-plan-governance"
            heading="Review and sharing"
            testId="care-plan-plan-governance"
            tone="secondary"
          >
            <dl className={styles.definitionGrid}>
              <DefinitionRow term="Open Review Triggers">
                {openTriggers.length === 0
                  ? "No open Review Triggers."
                  : `${openTriggers.length} open Review Trigger${openTriggers.length === 1 ? "" : "s"}. ${openTriggers
                      .map((trigger) => trigger.reason)
                      .join(" ")}`}
              </DefinitionRow>
              <DefinitionRow term="Shown to this person">
                {currentManagementVersion.sharedWithPatientAt === null
                  ? "Not yet shown to this person."
                  : `Shown on ${formatPerthDate(currentManagementVersion.sharedWithPatientAt)}.`}
              </DefinitionRow>
              <DefinitionRow term="Patient Plan">
                {currentPatientPlanVersion === null
                  ? "No current Patient Plan has been written from this version."
                  : `Current Patient Plan version ${currentPatientPlanVersion.version}.`}
              </DefinitionRow>
            </dl>
          </SectionFrame>
        </>
      ) : withdrawnManagementVersion !== null ? (
        <>
          <SectionFrame id="care-plan-withdrawn" heading="Withdrawn plan" tone="boundary">
            <p data-testid="care-plan-withdrawn-notice" className={styles.withdrawnNotice}>
              {`Plan withdrawn on ${formatPerthDate(withdrawnManagementVersion.withdrawnAt)} by ${
                displayName(state.users, withdrawnManagementVersion.withdrawnBy) ?? "an unrecorded clinician"
              } — ${withdrawnManagementVersion.withdrawalReason ?? "No reason was recorded."}`}
            </p>
            <p className={styles.sectionDescription}>
              {`${patient.preferredName} previously had an agreed plan. No older version has been restored in its place, and there is no Current Plan to follow.`}
            </p>
          </SectionFrame>
          <SupersededContent version={withdrawnManagementVersion} />
        </>
      ) : (
        <SectionFrame id="care-plan-no-current" heading="Management Plan" tone="boundary">
          <p className={styles.noCurrentPlan}>No Current Plan</p>
          <p className={styles.sectionDescription}>
            {`Nothing has been agreed for ${patient.preferredName} in this prototype. Assess and treat as you would for anyone else.`}
          </p>
        </SectionFrame>
      )}

      {openManagementDraft === null ? null : (
        <SectionFrame
          id="care-plan-awaiting-version"
          heading="Version in progress"
          tone="secondary"
          testId="care-plan-awaiting-version"
        >
          <div className={styles.metadataMarks}>
            <StatusMark
              tone="neutral"
              label={`${MANAGEMENT_VERSION_STATE_LABEL[openManagementDraft.state]} version ${openManagementDraft.version}`}
            />
            <ParticipationMarker participationState={openManagementDraft.participationState} />
          </div>
          <p className={styles.sectionDescription}>
            {`This is not a plan in use. ${
              currentManagementVersion === null
                ? `There is no Current Plan for ${patient.fullName}, and a version being written is not one.`
                : `Current version ${currentManagementVersion.version} remains in use until this version is approved.`
            }`}
          </p>
          <p className={styles.sectionDescription}>{openManagementDraft.revisionReason}</p>
        </SectionFrame>
      )}

      {cmht === null ? null : (
        <ContactActions
          contact={cmht}
          scenario={scenario}
          reviewsHref={CARE_PLAN_ROUTES.reviews}
          onIntent={(channel) => recordContactIntent(cmht, channel)}
        />
      )}

      <p className={styles.planFooterLink} data-print-hide="true">
        <Link href={carePlanRoute.managementPlanPrint(patient.id)} className={styles.inlineLink}>
          Print this plan
        </Link>
        {" — a printed clinician summary to carry to the bedside or send with a handover."}
      </p>
    </section>
  );
}
