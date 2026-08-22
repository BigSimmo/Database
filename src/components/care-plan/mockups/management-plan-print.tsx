"use client";

import Link from "next/link";

import { EmptyState, InlineNotice } from "@/components/ui-primitives";
import { BrowserPrintButton, PrintOutput, PrintSection } from "@/components/ui/print-output";

import styles from "./care-plan.module.css";
import { buildPatientSnapshot, deriveReviewState } from "./domain";
import { PROTOTYPE_NOW } from "./fixtures";
import { useCarePlanPrototype } from "./prototype-provider";
import {
  CurrentPlanSummary,
  DefinitionRow,
  NOT_RECORDED,
  PROTOTYPE_OUTCOME_TONE,
  PinnedSafetyBoundary,
  SyntheticMarker,
  formatPerthDate,
} from "./prototype-ui";
import { carePlanRoute } from "./routes";
import type { PrototypeScenario, PrototypeUser, SyntheticId } from "./types";

/**
 * The printed clinician summary: what a reader needs at a bedside or in a
 * handover envelope, and nothing that only makes sense on a screen.
 *
 * Deliberately never called a "copy" of the plan. The glossary reserves that
 * word away from a Management Plan Version, and a sheet of paper is neither a
 * version nor a second edition of one — it is a printed summary of the one
 * version in use, which goes stale the moment it is printed.
 *
 * It carries the identifiers, the pinned safety boundary, the five first-minute
 * sections in order, the version and approval metadata, the team contact block,
 * a warning that paper goes stale, a printed-at stamp, the synthetic marker, and
 * a confidential-document footer. It omits navigation, actions, audit history,
 * and any version that is not the plan in use — none of which help a reader
 * holding a sheet of paper, and a draft on paper is a plan somebody may follow.
 *
 * The synthetic marker is rendered *inside* the printed subtree deliberately.
 * The shared print rule makes everything outside `[data-print-output]`
 * invisible, so the shell header's marker never reaches the paper, and paper
 * carrying clinical headings with nothing saying the content is fictional is the
 * exact failure this guards against.
 */

/**
 * The printed-at stamp, formatted from `PROTOTYPE_NOW` alone. Deterministic by
 * construction: the prototype reads no clock, so two runs of the same route
 * produce the same sheet of paper. The date part of a `+08:00` timestamp is
 * already the Perth wall-clock date and time.
 */
function perthStamp(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (match === null) return NOT_RECORDED;
  const hour24 = Number(match[4]);
  const minutes = match[5];
  const meridiem = hour24 < 12 ? "am" : "pm";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${match[3]}/${match[2]}/${match[1]} at ${hour12}:${minutes} ${meridiem} AWST`;
}

const PRINTED_AT = `Printed on ${perthStamp(PROTOTYPE_NOW)}.`;

function displayName(users: readonly PrototypeUser[], id: SyntheticId | null): string | undefined {
  if (id === null) return undefined;
  return users.find((user) => user.id === id)?.displayName;
}

export function ManagementPlanPrintSurface({
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

  const { patient, cmht, currentManagementVersion, withdrawnManagementVersion } = snapshot;

  // Printing the wrong person's plan is a real harm, and paper cannot be
  // recalled once it leaves the room.
  if (scenario === "identity-uncertain") {
    return (
      <p role="alert" data-testid="care-plan-identity-uncertain" className={styles.identityUncertain}>
        <strong>This record has not been confirmed as the right person.</strong> Nothing is offered for printing,
        because paper carrying a nearby person&rsquo;s plan cannot be taken back. Return to search and choose the record
        again.
      </p>
    );
  }

  if (currentManagementVersion === null) {
    return (
      <section aria-label={`${patient.fullName} Management Plan`} className={styles.workspace}>
        <p data-testid="care-plan-print-unavailable" className={styles.withdrawnNotice}>
          {withdrawnManagementVersion === null
            ? `There is no Current Plan for ${patient.fullName}, so there is nothing to print.`
            : `Plan withdrawn on ${formatPerthDate(withdrawnManagementVersion.withdrawnAt)} by ${
                displayName(state.users, withdrawnManagementVersion.withdrawnBy) ?? "an unrecorded clinician"
              } — ${withdrawnManagementVersion.withdrawalReason ?? "No reason was recorded."}`}
        </p>
        <p className={styles.sectionDescription}>
          A withdrawn or absent plan is never printed as though it were in use. Earlier versions stay readable on the
          Management Plan page.
        </p>
        <p className={styles.planFooterLink}>
          <Link href={carePlanRoute.managementPlan(patient.id)} className={styles.inlineLink}>
            Back to the Management Plan
          </Link>
        </p>
      </section>
    );
  }

  const reviewState =
    currentManagementVersion.reviewDueAt === null
      ? null
      : deriveReviewState(currentManagementVersion.reviewDueAt, PROTOTYPE_NOW);

  const safetyPlanStatus =
    snapshot.currentSafetyPlanVersion === null
      ? "No current version"
      : `Current version ${snapshot.currentSafetyPlanVersion.version}, confirmed ${formatPerthDate(snapshot.currentSafetyPlanVersion.confirmedAt)}`;

  return (
    <section aria-label={`${patient.fullName} Management Plan, printed clinician summary`} className={styles.workspace}>
      <div className={styles.printControls} data-print-hide="true">
        <BrowserPrintButton
          label="Print this plan"
          // Recorded before the browser is asked to print: a print dialogue can
          // block until the reader dismisses it, and may never return.
          onBeforePrint={() => dispatch({ type: "record-management-plan-print-intent", patientId: patient.id })}
        />
        <Link href={carePlanRoute.managementPlan(patient.id)} className={styles.inlineLink}>
          Back to the Management Plan
        </Link>
      </div>

      {state.lastOutcome === null ? null : (
        <div data-testid="care-plan-print-outcome" data-print-hide="true">
          <InlineNotice tone={PROTOTYPE_OUTCOME_TONE[state.lastOutcome.kind]}>{state.lastOutcome.message}</InlineNotice>
        </div>
      )}

      <PrintOutput
        testId="care-plan-print-output"
        className={styles.printPaper}
        monochrome
        confidential
        printedAt={PRINTED_AT}
        provenance="Synthetic Care Plan prototype. Nothing on this page describes a real person, team, or hospital, and nothing here was saved."
      >
        <PrintSection className={styles.printIdentity}>
          <SyntheticMarker />
          <h2 className={styles.patientName}>{patient.fullName}</h2>
          <dl className={styles.definitionGrid}>
            <DefinitionRow term="MRN">{patient.mrn}</DefinitionRow>
            <DefinitionRow term="Date of birth">{formatPerthDate(patient.dateOfBirth)}</DefinitionRow>
            <DefinitionRow term="Preferred name">{patient.preferredName}</DefinitionRow>
            <DefinitionRow term="Pronouns">{patient.pronouns}</DefinitionRow>
            <DefinitionRow term="Home health service">{patient.homeHealthService}</DefinitionRow>
          </dl>
        </PrintSection>

        <PinnedSafetyBoundary content={currentManagementVersion.content} />

        <p data-testid="care-plan-print-record-warning" className={styles.printRecordWarning}>
          <strong>This is a printed copy and may already be out of date.</strong> Before you rely on it, check the
          electronic record for a newer version, for anything withdrawn, and for what has happened since.
        </p>

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

        {cmht === null ? null : (
          <PrintSection testId="care-plan-print-cmht" className={styles.printCmht}>
            <h2 className={styles.sectionHeading}>Community mental health team</h2>
            <dl className={styles.definitionGrid}>
              <DefinitionRow term="Team">{`${cmht.name} — ${cmht.catchment}`}</DefinitionRow>
              <DefinitionRow term="Shared mailbox">{cmht.sharedMailbox}</DefinitionRow>
              <DefinitionRow term="Duty telephone">{cmht.dutyTelephoneDisplay}</DefinitionRow>
              <DefinitionRow term="Operating hours">{cmht.operatingHours}</DefinitionRow>
              <DefinitionRow term="Care coordinator">{cmht.careCoordinator ?? undefined}</DefinitionRow>
              <DefinitionRow term="Outside those hours">
                {`${cmht.afterHoursLabel} ${cmht.afterHoursTelephoneDisplay}.`}
              </DefinitionRow>
              <DefinitionRow term="Details last checked">
                {`${formatPerthDate(cmht.verifiedAt)}. Checked details are not a guarantee that the service is available.`}
              </DefinitionRow>
            </dl>
          </PrintSection>
        )}
      </PrintOutput>
    </section>
  );
}
