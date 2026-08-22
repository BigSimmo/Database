"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sheet } from "@/components/ui/sheet";
import { EmptyState, InlineNotice, ignoreUnavailableActivation } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import { buildPatientSnapshot, deriveReviewState } from "./domain";
import { PROTOTYPE_NOW } from "./fixtures";
import { ManagementPlanDiff, ManagementPlanFirstVersion } from "./management-plan-diff";
import { useCarePlanPrototype } from "./prototype-provider";
import { getPrototypeMutationBlockReason } from "./prototype-state";
import {
  CurrentPlanSummary,
  DefinitionRow,
  MANAGEMENT_VERSION_STATE_LABEL,
  NOT_RECORDED,
  PROTOTYPE_OUTCOME_TONE,
  ParticipationMarker,
  PlanTextArea,
  SectionFrame,
  StatusMark,
  SyntheticMarker,
  formatPerthDate,
} from "./prototype-ui";
import { carePlanRoute } from "./routes";
import type { PrototypeScenario, PrototypeUser, SyntheticId } from "./types";

/**
 * Deciding on a submitted Management Plan Version: compare it, approve it, or
 * return it for changes with a reason.
 *
 * Nothing on this route displaces the Current Plan. It is rendered in full above
 * the comparison, because the reader deciding whether a replacement is right has
 * to be able to read the plan it would replace — and because a plan awaiting a
 * decision is not a plan in use, at any moment, on any surface.
 *
 * Unlike the reading surface, the decision controls are rendered for every role
 * with the reason stated when the signed-in clinician may not use them. Nobody
 * arrives here by accident: this address is linked from the plan's own authoring
 * controls and from the Reviews queue. A reader who follows that link and finds
 * an empty space learns nothing about who may approve, and has nowhere to go.
 */

function displayName(users: readonly PrototypeUser[], id: SyntheticId | null): string | null {
  if (id === null) return null;
  return users.find((user) => user.id === id)?.displayName ?? null;
}

export function ManagementPlanReviewSurface({
  patientId,
  scenario,
  navigate,
}: {
  patientId: string | null;
  scenario: PrototypeScenario;
  navigate: (href: string) => void;
}) {
  const { state, dispatch } = useCarePlanPrototype();
  const snapshot = patientId === null ? null : buildPatientSnapshot(state, patientId as SyntheticId, PROTOTYPE_NOW);

  const [approveOpen, setApproveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);

  if (snapshot === null) {
    return (
      <EmptyState
        testId="care-plan-review-no-patient"
        title="No patient is open."
        body="Open a synthetic patient from Home or Patients, then choose Management Plan."
      />
    );
  }

  const { patient, cmht, currentManagementVersion, openManagementDraft } = snapshot;

  if (scenario === "identity-uncertain") {
    return (
      <section aria-label={`${patient.fullName} Management Plan review`} className={styles.workspace}>
        <p role="alert" data-testid="care-plan-identity-uncertain" className={styles.identityUncertain}>
          <strong>This record has not been confirmed as the right person.</strong> No version is shown and no decision
          can be recorded. Return to search and choose the record again.
        </p>
      </section>
    );
  }

  const awaiting =
    openManagementDraft !== null && openManagementDraft.state === "awaiting_approval" ? openManagementDraft : null;

  const reviewState =
    currentManagementVersion === null || currentManagementVersion.reviewDueAt === null
      ? null
      : deriveReviewState(currentManagementVersion.reviewDueAt, PROTOTYPE_NOW);

  const safetyPlanStatus =
    snapshot.currentSafetyPlanVersion === null
      ? "No current version"
      : `Current version ${snapshot.currentSafetyPlanVersion.version}, confirmed ${formatPerthDate(snapshot.currentSafetyPlanVersion.confirmedAt)}`;

  // The reducer's own account of why a decision cannot be recorded, so the
  // surface and the guard can never say different things.
  const decisionBlockedReason =
    awaiting === null
      ? null
      : getPrototypeMutationBlockReason(state, { type: "approve-management-version", versionId: awaiting.id });

  function handleApprove() {
    if (awaiting === null) return;
    setApproveOpen(false);
    dispatch({ type: "approve-management-version", versionId: awaiting.id });
  }

  function handleReturn() {
    if (awaiting === null) return;
    if (returnReason.trim() === "") {
      setReturnError("A returned version needs a reason, so the author knows what to change.");
      return;
    }
    setReturnOpen(false);
    setReturnError(null);
    dispatch({ type: "return-management-version", versionId: awaiting.id, reason: returnReason });
    navigate(carePlanRoute.managementPlanEdit(patient.id));
  }

  const involvementNotRecorded =
    awaiting !== null &&
    (awaiting.participationState === "declined" || awaiting.participationState === "patient_unavailable");

  return (
    <section aria-label={`${patient.fullName} Management Plan review`} className={styles.workspace}>
      <div data-testid="care-plan-review-identity" className={styles.identityBand}>
        <SyntheticMarker />
        <h2 className={styles.patientName}>{patient.fullName}</h2>
        <p className={styles.sectionDescription}>{`${patient.mrn} — born ${formatPerthDate(patient.dateOfBirth)}`}</p>
        <Link href={carePlanRoute.managementPlan(patient.id)} className={styles.inlineLink}>
          Back to the Management Plan
        </Link>
      </div>

      {state.lastOutcome === null ? null : (
        <div data-testid="care-plan-review-outcome">
          <InlineNotice tone={PROTOTYPE_OUTCOME_TONE[state.lastOutcome.kind]}>{state.lastOutcome.message}</InlineNotice>
        </div>
      )}

      {currentManagementVersion === null ? (
        <SectionFrame id="care-plan-review-no-current" heading="Management Plan" tone="boundary">
          <p className={styles.noCurrentPlan}>No Current Plan</p>
          <p className={styles.sectionDescription}>
            {`${patient.preferredName} has no plan in use. A version awaiting a decision is not one, and approving it is what would make it the Current Plan.`}
          </p>
        </SectionFrame>
      ) : (
        <CurrentPlanSummary
          version={currentManagementVersion}
          ownerName={displayName(state.users, currentManagementVersion.ownerId) ?? NOT_RECORDED}
          approverName={displayName(state.users, currentManagementVersion.approverId)}
          reviewState={reviewState}
          cmhtName={cmht?.name ?? null}
          cmhtOperatingHours={cmht?.operatingHours ?? null}
          safetyPlanHref={carePlanRoute.safetyPlan(patient.id)}
          safetyPlanStatus={safetyPlanStatus}
        />
      )}

      {awaiting === null ? (
        <SectionFrame id="care-plan-review-none-awaiting" heading="Nothing to decide" tone="secondary">
          <p data-testid="care-plan-review-none-awaiting" className={styles.sectionDescription}>
            {`No version is awaiting approval for ${patient.preferredName}. When a clinician submits a replacement, it appears here for a named senior clinician to compare and decide on.`}
          </p>
        </SectionFrame>
      ) : (
        <>
          <SectionFrame
            id="care-plan-review-proposed"
            heading="The version submitted for approval"
            testId="care-plan-review-proposed"
            tone="secondary"
            description="This is not a plan in use. It becomes one only if it is approved."
          >
            <div className={styles.metadataMarks}>
              <StatusMark
                tone="neutral"
                label={`${MANAGEMENT_VERSION_STATE_LABEL[awaiting.state]} version ${awaiting.version}`}
              />
              <ParticipationMarker participationState={awaiting.participationState} />
            </div>
            <dl className={styles.definitionGrid}>
              <DefinitionRow term="Written by">
                {displayName(state.users, awaiting.authorId) ?? undefined}
              </DefinitionRow>
              <DefinitionRow term="Plan owner">{displayName(state.users, awaiting.ownerId) ?? undefined}</DefinitionRow>
              <DefinitionRow term="To be approved by">
                {displayName(state.users, awaiting.approverId) ??
                  "Any named senior clinician. Whoever approves it is recorded on the version."}
              </DefinitionRow>
              <DefinitionRow term="Submitted on">{formatPerthDate(awaiting.submittedAt)}</DefinitionRow>
              <DefinitionRow term="Next review date proposed">{formatPerthDate(awaiting.reviewDueAt)}</DefinitionRow>
              <DefinitionRow term="Reason for this version">{awaiting.revisionReason}</DefinitionRow>
            </dl>
          </SectionFrame>

          {/*
            A first version has nothing to be compared against. Feeding it to the
            change table against itself labelled every section `Unchanged` beside
            a `version 0` that does not exist, which is the opposite of what a
            senior clinician deciding on a person's first plan needs to read.
          */}
          {currentManagementVersion === null ? (
            <ManagementPlanFirstVersion
              proposed={awaiting.content}
              proposedVersionNumber={awaiting.version}
              preferredName={patient.preferredName}
            />
          ) : (
            <ManagementPlanDiff
              current={currentManagementVersion.content}
              proposed={awaiting.content}
              currentVersionNumber={currentManagementVersion.version}
              proposedVersionNumber={awaiting.version}
            />
          )}

          <SectionFrame
            id="care-plan-review-decision"
            heading="The decision"
            testId="care-plan-review-decision"
            description="Approval names the senior clinician who gave it, and takes effect immediately. Returning it for changes sends it back to the author as a Draft, with your reason attached."
          >
            {decisionBlockedReason === null ? null : (
              <p
                id="care-plan-review-blocked"
                role="alert"
                data-testid="care-plan-review-blocked"
                className={styles.contactWarning}
              >
                {decisionBlockedReason}
              </p>
            )}
            <div className={styles.actionRow}>
              <Button
                variant="primary"
                aria-disabled={decisionBlockedReason === null ? undefined : true}
                aria-describedby={decisionBlockedReason === null ? undefined : "care-plan-review-blocked"}
                onClick={decisionBlockedReason === null ? () => setApproveOpen(true) : ignoreUnavailableActivation}
              >
                {`Approve version ${awaiting.version}`}
              </Button>
              <Button
                variant="secondary"
                aria-disabled={decisionBlockedReason === null ? undefined : true}
                aria-describedby={decisionBlockedReason === null ? undefined : "care-plan-review-blocked"}
                onClick={
                  decisionBlockedReason === null
                    ? () => {
                        setReturnError(null);
                        setReturnOpen(true);
                      }
                    : ignoreUnavailableActivation
                }
              >
                Return for changes
              </Button>
            </div>
          </SectionFrame>

          <ConfirmDialog
            open={approveOpen}
            tone="primary"
            title={`Approve Management Plan version ${awaiting.version}`}
            confirmLabel="Approve and make Current"
            cancelLabel="Not yet"
            onCancel={() => setApproveOpen(false)}
            onConfirm={handleApprove}
            description={
              <span>
                {`Version ${awaiting.version} becomes the Current Plan straight away, and your name is recorded as the clinician who approved it. `}
                {currentManagementVersion === null
                  ? `${patient.preferredName} has no Current Plan at the moment, so this becomes the first one in use. `
                  : `Current version ${currentManagementVersion.version} becomes Superseded and stays readable in history; it is not deleted. `}
                {/*
                  A person's absence must never block their plan being written,
                  so approving here is allowed at any participation state. What
                  it must never be is silent: the consequence is stated before
                  the decision, not discovered after it.
                */}
                {involvementNotRecorded
                  ? `${
                      awaiting.participationState === "declined"
                        ? `${patient.preferredName} chose not to take part in writing this version.`
                        : `No involvement has been recorded for ${patient.preferredName}.`
                    } Approving it is allowed — a plan sometimes has to be written for someone who cannot or will not take part — but the version will carry a permanent marker saying it was written without this person's involvement, and approving it will raise an open Review Trigger, so going through the plan with ${patient.preferredName} lands on somebody's list rather than only on this page.`
                  : ""}
              </span>
            }
          />

          <Sheet
            open={returnOpen}
            onClose={() => setReturnOpen(false)}
            title={`Return version ${awaiting.version} for changes`}
            description="The version goes back to the author as a Draft. The Current Plan is unaffected either way."
            closeLabel="Cancel"
            footer={
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setReturnOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleReturn}>
                  Return for changes
                </Button>
              </div>
            }
          >
            <PlanTextArea
              id="care-plan-review-return-reason"
              label="What needs to change"
              required
              hint="This is all the author has to work from, so say what to change rather than only that something is wrong."
              value={returnReason}
              error={returnError ?? undefined}
              onChange={(text) => setReturnReason(text)}
            />
          </Sheet>
        </>
      )}
    </section>
  );
}
