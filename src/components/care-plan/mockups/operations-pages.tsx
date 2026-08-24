"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/choice";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, InlineNotice, ignoreUnavailableActivation } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import {
  PRESENTATION_ACTIVITY_WINDOW_MONTHS,
  countPresentationActivity,
  getCurrentManagementPlanVersion,
  getReviewQueues,
} from "./domain";
import { PROTOTYPE_NOW } from "./fixtures";
import { useCarePlanPrototype } from "./prototype-provider";
import { getPrototypeMutationBlockReason } from "./prototype-state";
import {
  DefinitionRow,
  PROTOTYPE_OUTCOME_TONE,
  PROTOTYPE_ROLE_LABEL,
  ParticipationMarker,
  PlanTextArea,
  SectionFrame,
  StatusMark,
  SyntheticMarker,
  formatPerthDate,
} from "./prototype-ui";
import { CARE_PLAN_ROUTES, carePlanRoute } from "./routes";
import type {
  CarePlanPrototypeState,
  CmhtContact,
  IdentificationDecision,
  IdentificationReview,
  ManagementPlanVersion,
  Patient,
  PrototypeUser,
  ReviewTrigger,
  SyntheticId,
} from "./types";

/**
 * The three service-wide surfaces: the four focused worklists, the community
 * team and plan-owner directory, and the governance statement.
 *
 * None of them ranks a person. The queues are ordered oldest-actionable-first
 * and carry no severity, score, or priority; the one place attendance may order
 * a list is the Identification Review worklist, where finding people who attend
 * often is the stated purpose of the screen, and the statement that counts
 * decide nothing sits on that same screen.
 *
 * Nothing in this file reads a clock, a network, storage, or a random source.
 */

// --- Shared vocabulary ----------------------------------------------------------

/** Why a Current Plan should be reconsidered. Never an alert, and never an
 *  automatic change: a trigger asks a person to look. */
export const REVIEW_TRIGGER_SOURCE_LABEL: Record<ReviewTrigger["source"], string> = {
  plan_use_feedback: "Plan-use feedback",
  presentation_outcome: "ED Presentation outcome",
  plan_deviation: "Repeated plan deviation",
  formal_review: "Formal review overdue",
  contact_verification: "Team contact details unverified",
  participation: "Approved without this person's involvement",
  patient_plan_stale: "Patient copy describes an earlier version",
};

/** The three recorded conclusions of a multidisciplinary Identification Review.
 *  None of them creates, approves, or withdraws a plan. */
export const IDENTIFICATION_DECISION_LABEL: Record<IdentificationDecision, string> = {
  proceed_to_plan: "Proceed to a plan",
  not_needed_now: "Not needed at this stage",
  revisit_later: "Revisit later",
};

const IDENTIFICATION_DECISION_ORDER: readonly IdentificationDecision[] = [
  "proceed_to_plan",
  "not_needed_now",
  "revisit_later",
];

/**
 * What a verification state says, in words. It describes when somebody last
 * checked the displayed details — never that the team is reachable now.
 *
 * `verifiedAt` is non-nullable in the domain, so a team that has never been
 * checked still carries a date. The unverified wording therefore states the
 * date as the last time anyone looked rather than as a verification.
 */
export function contactVerificationSummary(contact: CmhtContact): string {
  const on = formatPerthDate(contact.verifiedAt);
  if (contact.verificationState === "verified") return `Checked on ${on}`;
  if (contact.verificationState === "review_due") return `Checked on ${on}, and due to be checked again`;
  return `Not confirmed since ${on}`;
}

/**
 * The sentence that has to accompany any ordering by attendance, wherever one
 * is offered. Objective counts are an observation about a service; they create
 * no eligibility, no label for a person, no severity claim, and no plan.
 */
const COUNTS_DECIDE_NOTHING =
  "Counts describe what happened. They do not determine eligibility for a Management Plan.";

function displayName(users: readonly PrototypeUser[], id: SyntheticId | null): string | null {
  if (id === null) return null;
  return users.find((user) => user.id === id)?.displayName ?? null;
}

function patientOfManagementPlan(state: CarePlanPrototypeState, planId: SyntheticId): Patient | null {
  return state.patients.find((patient) => patient.managementPlanId === planId) ?? null;
}

function patientById(state: CarePlanPrototypeState, patientId: SyntheticId): Patient | null {
  return state.patients.find((patient) => patient.id === patientId) ?? null;
}

/**
 * One worklist entry: a heading naming who or what it is about, the facts a
 * reader needs before deciding, and the routes that carry them to the record.
 * Never a score, a rank, or a colour standing in for urgency.
 */
function QueueEntry({
  heading,
  marks,
  children,
  actions,
}: {
  heading: string;
  marks?: React.ReactNode;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <li className={styles.queueEntry}>
      <h3 className={styles.queueEntryTitle}>{heading}</h3>
      {marks ? <div className={styles.metadataMarks}>{marks}</div> : null}
      <dl className={styles.definitionGrid}>{children}</dl>
      <div className={styles.queueActions}>{actions}</div>
    </li>
  );
}

/** An empty worklist is good news, and says so rather than looking broken. */
function QueueEmpty({ testId, title, body }: { testId: string; title: string; body: string }) {
  return <EmptyState testId={testId} title={title} body={body} />;
}

// --- Reviews --------------------------------------------------------------------

type QueueKey = "awaitingApproval" | "reviewSuggested" | "contactVerification" | "identificationReview";

const QUEUE_TABS: readonly { id: QueueKey; label: string }[] = [
  { id: "awaitingApproval", label: "Awaiting Approval" },
  { id: "reviewSuggested", label: "Review Suggested" },
  { id: "contactVerification", label: "Contact Verification" },
  { id: "identificationReview", label: "Identification Review" },
];

type IdentificationSort = "referral-age" | "presentation-count";

const BLOCKED_REASON_ID = "care-plan-review-queue-blocked";

export function ReviewsSurface() {
  const { state, dispatch } = useCarePlanPrototype();
  const [activeQueue, setActiveQueue] = useState<QueueKey>("awaitingApproval");
  const [identificationSort, setIdentificationSort] = useState<IdentificationSort>("referral-age");

  const [triggerBeingResolved, setTriggerBeingResolved] = useState<ReviewTrigger | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const [reviewBeingClosed, setReviewBeingClosed] = useState<IdentificationReview | null>(null);
  const [decision, setDecision] = useState<IdentificationDecision>("proceed_to_plan");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  /** Set only after a referral is closed with `Proceed to a plan`, so the offer
   *  to start a draft is something the reader chooses rather than something the
   *  closure did. Closing creates nothing, on any decision. */
  const [proceedFor, setProceedFor] = useState<Patient | null>(null);

  const queues = getReviewQueues(state);

  const identificationEntries = [...queues.identificationReview].sort((left, right) => {
    if (identificationSort === "referral-age") return 0;
    const leftCount = countPresentationActivity(state.edPresentations, left.patientId, PROTOTYPE_NOW).total;
    const rightCount = countPresentationActivity(state.edPresentations, right.patientId, PROTOTYPE_NOW).total;
    return rightCount - leftCount || Date.parse(left.referredAt) - Date.parse(right.referredAt);
  });

  /**
   * The reducer's own account of why this queue's action cannot be used, so the
   * screen and the guard can never say different things. One statement per
   * queue rather than one per row: the reason is a property of who is signed in
   * and what the world is doing, not of the individual record.
   */
  const blockedReason: Record<QueueKey, string | null> = {
    awaitingApproval: null,
    reviewSuggested:
      queues.reviewSuggested.length === 0
        ? null
        : getPrototypeMutationBlockReason(state, {
            type: "resolve-review-trigger",
            triggerId: queues.reviewSuggested[0].id,
            resolution: "",
          }),
    contactVerification:
      queues.contactVerification.length === 0
        ? null
        : getPrototypeMutationBlockReason(state, {
            type: "verify-cmht-contact",
            cmhtId: queues.contactVerification[0].id,
          }),
    identificationReview:
      queues.identificationReview.length === 0
        ? null
        : getPrototypeMutationBlockReason(state, {
            type: "close-identification-review",
            reviewId: queues.identificationReview[0].id,
            decision: "revisit_later",
            decisionReason: "",
          }),
  };

  const activeBlockedReason = blockedReason[activeQueue];

  function recordResolution() {
    if (triggerBeingResolved === null) return;
    if (resolution.trim() === "") {
      setResolutionError("Resolving a Review Trigger needs an account of what was decided. Nothing was changed.");
      return;
    }
    dispatch({ type: "resolve-review-trigger", triggerId: triggerBeingResolved.id, resolution });
    setTriggerBeingResolved(null);
    setResolutionError(null);
  }

  function closeIdentificationReview() {
    if (reviewBeingClosed === null) return;
    if (decisionReason.trim() === "") {
      setDecisionError(
        "Closing an Identification Review needs a short reason, so a later reader can see what was concluded. Nothing was changed.",
      );
      return;
    }
    dispatch({
      type: "close-identification-review",
      reviewId: reviewBeingClosed.id,
      decision,
      decisionReason,
    });
    setProceedFor(decision === "proceed_to_plan" ? patientById(state, reviewBeingClosed.patientId) : null);
    setReviewBeingClosed(null);
    setDecisionError(null);
  }

  return (
    <section aria-label="Review worklists" className={styles.workspace}>
      <div className={styles.identityBand}>
        <SyntheticMarker />
        <p className={styles.sectionDescription}>
          Four worklists of things somebody has to do. They are ordered oldest-actionable-first and carry no severity
          rating, score, or priority order: nothing here rates a person, and nothing here optimises for people
          attending less often.
        </p>
      </div>

      {state.lastOutcome === null ? null : (
        <div data-testid="care-plan-reviews-outcome">
          <InlineNotice tone={PROTOTYPE_OUTCOME_TONE[state.lastOutcome.kind]}>{state.lastOutcome.message}</InlineNotice>
        </div>
      )}

      {proceedFor === null ? null : (
        <SectionFrame
          id="care-plan-review-proceed"
          heading="The team decided to proceed to a plan"
          tone="boundary"
          testId="care-plan-review-proceed"
        >
          <p className={styles.sectionDescription}>
            {`Closing the review recorded that decision and nothing else. No Management Plan and no version were created for ${proceedFor.fullName}; writing one is a separate decision somebody has to make.`}
          </p>
          <p className={styles.planFooterLink}>
            <Link href={carePlanRoute.managementPlanEdit(proceedFor.id)} className={styles.inlineLink}>
              {`Start a Management Plan draft for ${proceedFor.fullName}`}
            </Link>
          </p>
        </SectionFrame>
      )}

      <Tabs
        label="Review worklists"
        value={activeQueue}
        onChange={(id) => setActiveQueue(id as QueueKey)}
        items={QUEUE_TABS.map(({ id, label }) => ({
          id,
          label,
          count:
            id === "awaitingApproval"
              ? queues.awaitingApproval.length
              : id === "reviewSuggested"
                ? queues.reviewSuggested.length
                : id === "contactVerification"
                  ? queues.contactVerification.length
                  : queues.identificationReview.length,
        }))}
      >
        <div data-testid="care-plan-review-queue" className={styles.queuePanel}>
          {activeBlockedReason === null ? null : (
            <p
              id={BLOCKED_REASON_ID}
              role="alert"
              data-testid="care-plan-review-queue-blocked"
              className={styles.contactWarning}
            >
              {activeBlockedReason}
            </p>
          )}

          {activeQueue === "awaitingApproval" ? (
            <AwaitingApprovalQueue state={state} versions={queues.awaitingApproval} />
          ) : activeQueue === "reviewSuggested" ? (
            <ReviewSuggestedQueue
              state={state}
              triggers={queues.reviewSuggested}
              blockedReason={blockedReason.reviewSuggested}
              onResolve={(trigger) => {
                setTriggerBeingResolved(trigger);
                setResolution("");
                setResolutionError(null);
              }}
            />
          ) : activeQueue === "contactVerification" ? (
            <ContactVerificationQueue
              contacts={queues.contactVerification}
              blockedReason={blockedReason.contactVerification}
              onVerify={(contact) => dispatch({ type: "verify-cmht-contact", cmhtId: contact.id })}
            />
          ) : (
            <IdentificationReviewQueue
              state={state}
              reviews={identificationEntries}
              sort={identificationSort}
              onSortChange={setIdentificationSort}
              blockedReason={blockedReason.identificationReview}
              onClose={(review) => {
                setReviewBeingClosed(review);
                setDecision("proceed_to_plan");
                setDecisionReason("");
                setDecisionError(null);
              }}
            />
          )}
        </div>
      </Tabs>

      {/*
        In-tree rather than portalled, for the same reason the ED Presentation
        correction sheet is: every Care Plan stylesheet selector is scoped below
        `.appRoot`, so a portalled sheet renders its multi-line fields with none
        of that styling.
      */}
      <Sheet
        open={triggerBeingResolved !== null}
        onClose={() => setTriggerBeingResolved(null)}
        title="Record what was decided"
        description="Resolving a trigger records a conclusion. It changes no plan and approves nothing."
        testId="care-plan-review-resolution-sheet"
        portal={false}
        footer={
          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={() => setTriggerBeingResolved(null)}>
              Leave it open
            </Button>
            <Button variant="primary" onClick={recordResolution}>
              Record the decision
            </Button>
          </div>
        }
      >
        {triggerBeingResolved === null ? null : (
          <div className={styles.amendmentForm}>
            {resolutionError === null ? null : (
              <p role="alert" data-testid="care-plan-review-resolution-error" className={styles.contactWarning}>
                {resolutionError}
              </p>
            )}
            <p className={styles.sectionDescription}>{triggerBeingResolved.reason}</p>
            <PlanTextArea
              id="care-plan-review-resolution"
              label="What the team decided"
              required
              hint="A later reader sees this and nothing else, so say what was concluded rather than only that it was discussed."
              value={resolution}
              onChange={setResolution}
            />
          </div>
        )}
      </Sheet>

      <Sheet
        open={reviewBeingClosed !== null}
        onClose={() => setReviewBeingClosed(null)}
        title="Record the Identification Review decision"
        description="Closing a referral records what the group concluded. It creates no plan and approves nothing, whichever decision is recorded."
        testId="care-plan-review-closure-sheet"
        portal={false}
        footer={
          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={() => setReviewBeingClosed(null)}>
              Leave it open
            </Button>
            <Button variant="primary" onClick={closeIdentificationReview}>
              Close this Identification Review
            </Button>
          </div>
        }
      >
        {reviewBeingClosed === null ? null : (
          <div className={styles.amendmentForm}>
            {decisionError === null ? null : (
              <p role="alert" data-testid="care-plan-review-closure-error" className={styles.contactWarning}>
                {decisionError}
              </p>
            )}
            <p className={styles.sectionDescription}>{reviewBeingClosed.reason}</p>
            <RadioGroup
              label="What the team decided"
              name="care-plan-identification-decision"
              value={decision}
              onChange={(value) => setDecision(value as IdentificationDecision)}
              options={IDENTIFICATION_DECISION_ORDER.map((value) => ({
                value,
                label: IDENTIFICATION_DECISION_LABEL[value],
              }))}
              hint="Proceeding to a plan records the conclusion only. Somebody still has to write the plan."
            />
            <PlanTextArea
              id="care-plan-review-decision-reason"
              label="Why the team decided this"
              required
              hint="This stays visible in the person's History, so a later reader can see that coordinated care was considered and what was concluded."
              value={decisionReason}
              onChange={setDecisionReason}
            />
          </div>
        )}
      </Sheet>
    </section>
  );
}

function AwaitingApprovalQueue({
  state,
  versions,
}: {
  state: CarePlanPrototypeState;
  versions: readonly ManagementPlanVersion[];
}) {
  if (versions.length === 0) {
    return (
      <QueueEmpty
        testId="care-plan-queue-empty-awaiting-approval"
        title="No version is waiting for a decision."
        body="A version appears here when a clinician submits it. Until a named senior clinician approves one, the Current Plan is unaffected."
      />
    );
  }

  return (
    <ol className={styles.queueList}>
      {versions.map((version) => {
        const patient = patientOfManagementPlan(state, version.planId);
        const name = patient?.fullName ?? "An unrecorded synthetic patient";
        return (
          <QueueEntry
            key={version.id}
            heading={`${name} — Management Plan version ${version.version}`}
            marks={<ParticipationMarker participationState={version.participationState} />}
            actions={
              patient === null ? null : (
                <>
                  <Link href={carePlanRoute.managementPlanReview(patient.id)} className={styles.queueAction}>
                    {`Compare and decide on ${name}'s version ${version.version}`}
                  </Link>
                  <Link href={carePlanRoute.patient(patient.id)} className={styles.queueAction}>
                    {`Open ${name}`}
                  </Link>
                </>
              )
            }
          >
            <DefinitionRow term="Reason for this version">{version.revisionReason}</DefinitionRow>
            <DefinitionRow term="Submitted">
              {`Submitted by ${displayName(state.users, version.authorId) ?? "an unrecorded clinician"} on ${formatPerthDate(version.submittedAt)}`}
            </DefinitionRow>
            <DefinitionRow term="Plan owner">{displayName(state.users, version.ownerId) ?? undefined}</DefinitionRow>
            <DefinitionRow term="Next action">
              A named senior clinician compares it against the Current Plan and either approves it or returns it for
              changes.
            </DefinitionRow>
          </QueueEntry>
        );
      })}
    </ol>
  );
}

function ReviewSuggestedQueue({
  state,
  triggers,
  blockedReason,
  onResolve,
}: {
  state: CarePlanPrototypeState;
  triggers: readonly ReviewTrigger[];
  blockedReason: string | null;
  onResolve: (trigger: ReviewTrigger) => void;
}) {
  if (triggers.length === 0) {
    return (
      <QueueEmpty
        testId="care-plan-queue-empty-review-suggested"
        title="Nothing has been raised for review."
        body="A Review Trigger appears here when plan-use feedback, an outcome, a deviation, a changed contact, or an overdue review suggests somebody should look at a plan."
      />
    );
  }

  return (
    <ol className={styles.queueList}>
      {triggers.map((trigger) => {
        const patient = patientById(state, trigger.patientId);
        const name = patient?.fullName ?? "An unrecorded synthetic patient";
        const current = getCurrentManagementPlanVersion(state.managementPlanVersions, trigger.managementPlanId);
        return (
          <QueueEntry
            key={trigger.id}
            heading={`${name} — ${REVIEW_TRIGGER_SOURCE_LABEL[trigger.source]}`}
            actions={
              <>
                <Button
                  variant="secondary"
                  aria-disabled={blockedReason === null ? undefined : true}
                  aria-describedby={blockedReason === null ? undefined : BLOCKED_REASON_ID}
                  onClick={blockedReason === null ? () => onResolve(trigger) : ignoreUnavailableActivation}
                >
                  {`Record what was decided for ${name}`}
                </Button>
                {patient === null ? null : (
                  <Link href={carePlanRoute.managementPlan(patient.id)} className={styles.queueAction}>
                    {`Open ${name}'s Management Plan`}
                  </Link>
                )}
              </>
            }
          >
            <DefinitionRow term="Why this was raised">{trigger.reason}</DefinitionRow>
            <DefinitionRow term="Raised">{`Raised on ${formatPerthDate(trigger.createdAt)}`}</DefinitionRow>
            <DefinitionRow term="Plan owner">
              {displayName(state.users, current?.ownerId ?? null) ?? undefined}
            </DefinitionRow>
            <DefinitionRow term="Next action">
              Look at the plan with the team and record what was decided. A trigger never changes a plan by itself.
            </DefinitionRow>
          </QueueEntry>
        );
      })}
    </ol>
  );
}

function ContactVerificationQueue({
  contacts,
  blockedReason,
  onVerify,
}: {
  contacts: readonly CmhtContact[];
  blockedReason: string | null;
  onVerify: (contact: CmhtContact) => void;
}) {
  if (contacts.length === 0) {
    return (
      <QueueEmpty
        testId="care-plan-queue-empty-contact-verification"
        title="Every team's details have been checked."
        body="A team appears here when its displayed mailbox, duty number, and operating hours are due to be checked again."
      />
    );
  }

  return (
    <>
      <ol className={styles.queueList}>
        {contacts.map((contact) => (
          <QueueEntry
            key={contact.id}
            heading={contact.name}
            marks={
              <StatusMark
                tone={contact.verificationState === "unverified" ? "danger" : "warning"}
                label={contactVerificationSummary(contact)}
              />
            }
            actions={
              <>
                <Button
                  variant="secondary"
                  aria-disabled={blockedReason === null ? undefined : true}
                  aria-describedby={blockedReason === null ? undefined : BLOCKED_REASON_ID}
                  onClick={blockedReason === null ? () => onVerify(contact) : ignoreUnavailableActivation}
                >
                  {`Record that ${contact.name} details were checked`}
                </Button>
                <Link href={CARE_PLAN_ROUTES.team} className={styles.queueAction}>
                  {`Open ${contact.name} in Team`}
                </Link>
              </>
            }
          >
            <DefinitionRow term="Catchment">{contact.catchment}</DefinitionRow>
            <DefinitionRow term="Shared mailbox">{contact.sharedMailbox}</DefinitionRow>
            <DefinitionRow term="Duty telephone">{contact.dutyTelephoneDisplay}</DefinitionRow>
            <DefinitionRow term="Operating hours">{`${contact.operatingHours} (${contact.timezone})`}</DefinitionRow>
            <DefinitionRow term="Last checked">{contactVerificationSummary(contact)}</DefinitionRow>
            <DefinitionRow term="Next action">
              Ring the team, confirm the displayed mailbox, number, and hours, then record that they were checked.
            </DefinitionRow>
          </QueueEntry>
        ))}
      </ol>
      <p className={styles.contactBoundary}>
        Checking the details is not a guarantee that the service is available. It records only that somebody looked at
        what is displayed here, on a stated date.
      </p>
    </>
  );
}

function IdentificationReviewQueue({
  state,
  reviews,
  sort,
  onSortChange,
  blockedReason,
  onClose,
}: {
  state: CarePlanPrototypeState;
  reviews: readonly IdentificationReview[];
  sort: IdentificationSort;
  onSortChange: (sort: IdentificationSort) => void;
  blockedReason: string | null;
  onClose: (review: IdentificationReview) => void;
}) {
  return (
    <>
      {/*
        The one screen in the product where a list may be ordered by how often
        people attend, because finding people who attend often is what this
        worklist is for. The sentence below it is not decoration: a ranking of
        everyone by attendance is the banned label without the word, and this is
        what keeps it an observation rather than a verdict.
      */}
      <div className={styles.queueSort}>
        <Select
          id="care-plan-identification-sort"
          label="Sort this worklist"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as IdentificationSort)}
          options={[
            { value: "referral-age", label: "Oldest referral first" },
            {
              value: "presentation-count",
              label: `Most ED Presentations in the last ${PRESENTATION_ACTIVITY_WINDOW_MONTHS} months first`,
            },
          ]}
        />
        <p className={styles.contactBoundary}>
          {`${COUNTS_DECIDE_NOTHING} No approved threshold exists in this prototype: local clinical and privacy governance has to decide who is offered a plan, and on what basis, before it is used operationally.`}
        </p>
      </div>

      {reviews.length === 0 ? (
        <QueueEmpty
          testId="care-plan-queue-empty-identification-review"
          title="No referral is waiting to be discussed."
          body="An authorised clinician refers somebody here with a stated reason. Nothing is referred automatically, because no eligibility rule exists."
        />
      ) : (
        <ol className={styles.queueList}>
          {reviews.map((review) => {
            const patient = patientById(state, review.patientId);
            const name = patient?.fullName ?? "An unrecorded synthetic patient";
            const activity =
              patient === null ? null : countPresentationActivity(state.edPresentations, patient.id, PROTOTYPE_NOW);
            return (
              <QueueEntry
                key={review.id}
                heading={name}
                actions={
                  <>
                    <Button
                      variant="secondary"
                      aria-disabled={blockedReason === null ? undefined : true}
                      aria-describedby={blockedReason === null ? undefined : BLOCKED_REASON_ID}
                      onClick={blockedReason === null ? () => onClose(review) : ignoreUnavailableActivation}
                    >
                      {`Record the Identification Review decision for ${name}`}
                    </Button>
                    {patient === null ? null : (
                      <Link href={carePlanRoute.patient(patient.id)} className={styles.queueAction}>
                        {`Open ${name}`}
                      </Link>
                    )}
                  </>
                }
              >
                <DefinitionRow term="Reason for the referral">{review.reason}</DefinitionRow>
                <DefinitionRow term="Referred">
                  {`Referred by ${displayName(state.users, review.referredBy) ?? "an unrecorded clinician"} on ${formatPerthDate(review.referredAt)}`}
                </DefinitionRow>
                <DefinitionRow term="Presentation activity">
                  {activity === null
                    ? undefined
                    : `${activity.total} recorded in the ${activity.windowMonths} months to ${formatPerthDate(activity.windowEnd)}`}
                </DefinitionRow>
                <DefinitionRow term="Next action">
                  Discuss with the multidisciplinary group, then record one decision and a short reason. Closing a
                  referral creates no plan.
                </DefinitionRow>
              </QueueEntry>
            );
          })}
        </ol>
      )}
    </>
  );
}

// --- Manual referral ------------------------------------------------------------

const REFERRAL_BLOCKED_ID = "care-plan-referral-blocked";

/**
 * The manual route into Identification Review, offered on the patient workspace
 * — which is what Home, Patients, and a patient's Overview all render.
 *
 * A referral asks a group of people to consider coordinated care. It enrols
 * nobody, creates no plan, decides no eligibility, and changes nothing about the
 * person's Presentation Activity. The reason is the whole referral, because no
 * numeric rule exists to stand in for one.
 */
export function IdentificationReferralAction({ patient }: { patient: Patient }) {
  const { state, dispatch } = useCarePlanPrototype();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openReview =
    state.identificationReviews.find((review) => review.patientId === patient.id && review.status === "open") ?? null;

  const permissionReason = getPrototypeMutationBlockReason(state, {
    type: "create-identification-review",
    patientId: patient.id,
    reason: "",
  });

  const blockedReason =
    permissionReason ??
    (openReview === null
      ? null
      : `An Identification Review for ${patient.preferredName} is already open, so a second referral was not added. It is waiting to be discussed in Reviews.`);

  function referForReview() {
    if (reason.trim() === "") {
      setError(
        "A referral for Identification Review needs a stated reason. No numeric rule exists, so the reason is the whole referral. Nothing was changed.",
      );
      return;
    }
    dispatch({ type: "create-identification-review", patientId: patient.id, reason });
    setOpen(false);
    setReason("");
    setError(null);
  }

  return (
    <SectionFrame
      id="care-plan-identification-referral"
      heading="Identification Review"
      tone="secondary"
      testId="care-plan-identification-referral"
      description="A referral asks the multidisciplinary group to consider whether coordinated care planning would help this person. It creates no plan and decides no eligibility."
    >
      {blockedReason === null ? null : (
        <p
          id={REFERRAL_BLOCKED_ID}
          role="alert"
          data-testid="care-plan-referral-blocked"
          className={styles.contactWarning}
        >
          {blockedReason}
        </p>
      )}

      <div className={styles.actionRow} data-print-hide="true">
        <Button
          variant="secondary"
          aria-disabled={blockedReason === null ? undefined : true}
          aria-describedby={blockedReason === null ? undefined : REFERRAL_BLOCKED_ID}
          onClick={
            blockedReason === null
              ? () => {
                  setReason("");
                  setError(null);
                  setOpen(true);
                }
              : ignoreUnavailableActivation
          }
        >
          {`Refer ${patient.fullName} for Identification Review`}
        </Button>
        <Link href={CARE_PLAN_ROUTES.reviews} className={styles.queueAction}>
          Open the Identification Review worklist
        </Link>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Refer for Identification Review"
        description="The group decides whether coordinated planning would help. Referring somebody creates no plan, applies no eligibility, and changes nothing about their recorded Presentation Activity."
        testId="care-plan-referral-sheet"
        portal={false}
        footer={
          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={referForReview}>
              Add to Identification Review
            </Button>
          </div>
        }
      >
        <div className={styles.amendmentForm}>
          {error === null ? null : (
            <p role="alert" data-testid="care-plan-referral-error" className={styles.contactWarning}>
              {error}
            </p>
          )}
          <PlanTextArea
            id="care-plan-referral-reason"
            label="Reason for multidisciplinary review"
            required
            hint="No numeric rule exists, so this reason is the whole referral. Say what a reader who has never met this person would need to know."
            value={reason}
            onChange={setReason}
          />
        </div>
      </Sheet>
    </SectionFrame>
  );
}

// --- Team ------------------------------------------------------------------------

export function TeamSurface() {
  const { state } = useCarePlanPrototype();

  const owners = state.users
    .map((user) => ({
      user,
      current: state.managementPlanVersions.filter(
        (version) => version.state === "current" && version.ownerId === user.id,
      ).length,
      open: state.managementPlanVersions.filter(
        (version) =>
          (version.state === "draft" || version.state === "awaiting_approval") && version.ownerId === user.id,
      ).length,
    }))
    .filter(({ current, open }) => current > 0 || open > 0);

  return (
    <section aria-label="Community teams and plan owners" className={styles.workspace}>
      <div className={styles.identityBand}>
        <SyntheticMarker />
        <p className={styles.sectionDescription}>
          Every team, mailbox, telephone number, catchment, and person on this page is invented. The only genuine
          contact details anywhere in this prototype are the public crisis lines, which are named as such where they
          appear.
        </p>
      </div>

      <SectionFrame
        id="care-plan-team-cmhts"
        heading="Community mental health teams"
        description="The durable service contact for each catchment. The named care coordinator may be away; the team is what stays reachable."
        testId="care-plan-team-cmhts"
      >
        <ul className={styles.teamList}>
          {state.cmhtContacts.map((contact) => {
            const covered = state.patients.filter((patient) => patient.cmhtId === contact.id);
            const withCurrentPlan = covered.filter(
              (patient) =>
                getCurrentManagementPlanVersion(state.managementPlanVersions, patient.managementPlanId) !== null,
            );
            return (
              <li key={contact.id} className={styles.queueEntry}>
                <h3 className={styles.queueEntryTitle}>{contact.name}</h3>
                <div className={styles.metadataMarks}>
                  <StatusMark
                    tone={
                      contact.verificationState === "verified"
                        ? "success"
                        : contact.verificationState === "review_due"
                          ? "warning"
                          : "danger"
                    }
                    label={contactVerificationSummary(contact)}
                  />
                </div>
                <dl className={styles.definitionGrid}>
                  <DefinitionRow term="Catchment">{contact.catchment}</DefinitionRow>
                  <DefinitionRow term="Shared mailbox">{contact.sharedMailbox}</DefinitionRow>
                  <DefinitionRow term="Duty telephone">{contact.dutyTelephoneDisplay}</DefinitionRow>
                  <DefinitionRow term="Operating hours">
                    {`${contact.operatingHours} (${contact.timezone})`}
                  </DefinitionRow>
                  <DefinitionRow term="Care coordinator">{contact.careCoordinator ?? undefined}</DefinitionRow>
                  <DefinitionRow term="Outside those hours">
                    {`${contact.afterHoursLabel} ${contact.afterHoursTelephoneDisplay}.`}
                  </DefinitionRow>
                  <DefinitionRow term="Current Plans in this catchment">
                    {`${withCurrentPlan.length} of ${covered.length} synthetic ${covered.length === 1 ? "person" : "people"} in this catchment have a Current Plan.`}
                  </DefinitionRow>
                </dl>
                <div className={styles.queueActions}>
                  {covered.map((patient) => (
                    <Link key={patient.id} href={carePlanRoute.patient(patient.id)} className={styles.queueAction}>
                      {`Open ${patient.fullName}`}
                    </Link>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        {/*
          Deliberately no launch control here. A contact action is recorded
          against the person it was made for, and this page has no person open —
          so a control here would either record an unattributable action or an
          action attributed to nobody. Both would make the audit trail claim
          something it does not know.
        */}
        <p className={styles.contactBoundary}>
          The email and telephone controls live on a person&rsquo;s record rather than here, because a contact action
          is recorded against the person it was made for. Opening one of them records only that an external
          application was asked to open — never that anything was sent, delivered, read, answered, or completed.
        </p>
      </SectionFrame>

      <SectionFrame
        id="care-plan-team-owners"
        heading="Plan owners"
        description="The clinician accountable for coordinating review and keeping a Management Plan current. Owning a plan does not itself carry approval."
        testId="care-plan-team-owners"
      >
        {owners.length === 0 ? (
          <p className={styles.sectionEmpty}>No synthetic clinician owns a Management Plan in this session.</p>
        ) : (
          <ul className={styles.teamList}>
            {owners.map(({ user, current, open }) => (
              <li key={user.id} className={styles.queueEntry}>
                <h3 className={styles.queueEntryTitle}>{user.displayName}</h3>
                <dl className={styles.definitionGrid}>
                  <DefinitionRow term="Responsibility">{PROTOTYPE_ROLE_LABEL[user.role]}</DefinitionRow>
                  <DefinitionRow term="Post">{user.title}</DefinitionRow>
                  <DefinitionRow term="Current Plans owned">{`${current}`}</DefinitionRow>
                  <DefinitionRow term="Versions being written or awaiting a decision">{`${open}`}</DefinitionRow>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </SectionFrame>
    </section>
  );
}

// --- Governance -------------------------------------------------------------------

const ROLE_RESPONSIBILITY: readonly { role: string; does: string }[] = [
  {
    role: "Emergency department clinician",
    does: "Find and read the Current Plan, record an ED Presentation, capture plan-use feedback, and reach the team.",
  },
  {
    role: "Emergency department mental health liaison clinician",
    does: "Create and revise drafts, co-produce the Personal Safety Plan, check team contact details, and respond to Review Triggers.",
  },
  {
    role: "Community mental health team clinician",
    does: "The same as the liaison clinician, from the community side of the same plan.",
  },
  {
    role: "Named senior clinician",
    does: "Compare, return, approve, withdraw, and record formal review of a Management Plan Version. Only this responsibility makes a version Current.",
  },
  {
    role: "Care planning coordinator",
    does: "Manage the review and identification worklists. Deliberately non-clinical: it authors no plan and makes no clinical judgement.",
  },
];

const LIFECYCLE_RULE: readonly string[] = [
  "Each person has one longitudinal Management Plan made of controlled versions, not a new plan for every presentation.",
  "A version is a Draft, Awaiting Approval, Current, Superseded, or Withdrawn. Only a named senior clinician's approval makes one Current.",
  "A Draft never displaces the Current Plan, and a replacement awaiting a decision never suppresses the version in use.",
  "Approving a version makes exactly one version Current and the previous Current version Superseded, in one step.",
  "A Current version is within review, due soon, or overdue. An overdue plan stays Current and fully readable, with a standing caution, until it is reviewed, replaced, or withdrawn.",
  "Withdrawal needs an explicit reason and leaves the person with no Current Plan. No older version is restored in its place, and the withdrawal stays on the record so a withdrawn plan never reads like a person who never had one.",
  "The Personal Safety Plan is the person's own document. It is versioned separately and needs no senior approval.",
  "An ED Presentation is append-only. A correction is a visible, attributed amendment recorded beside what it replaced, never over it.",
];

const AUDIT_LIMIT: readonly string[] = [
  "An Audit Event describes only evidence this application actually has. It is not an activity feed and not a communication log.",
  "Opening an email link records that an external email application was asked to open. It is never evidence that a message was composed, sent, delivered, read, answered, or acted on.",
  "Opening a telephone link records that an external telephone application was asked to open. It is never evidence of a connection, a conversation, or an outcome.",
  "Opening a print view records that the print view was opened. This application never sees a printer, a sheet of paper, or a reader.",
  "Checking a team's contact details records that somebody looked at what is displayed, on a stated date. It is not a guarantee that the service is available.",
  "Closing an Identification Review records a conclusion. It creates no plan and approves nothing, on any decision.",
];

const PRIVACY_RULE: readonly string[] = [
  "Every record here is invented. No real person, clinician, service, site, caseload, or utilisation figure appears anywhere in it.",
  "Nothing is saved. There is no storage, no database, no cookie holding record state, no network call, and no provider of any kind — including for the Patient Plan, whose conversion is deterministic and runs offline.",
  "A URL may carry a named specimen state and nothing else. No name, contact detail, or clinical text is ever put in an address.",
  "An email link carries the team's shared mailbox and a generic subject. It carries no name, MRN, date of birth, presentation reason, or plan content.",
  "A print view carries the minimum identifiers the reader needs, a synthetic-prototype watermark, and a printed-at time. It omits navigation, actions, and audit history.",
  "Search reads identity fields only. Plan content, presentation content, safety-plan content, and cultural or support-person detail are never searchable.",
];

const NOT_READY_FOR: readonly string[] = [
  "Real patient, clinician, service, or utilisation data of any kind.",
  "Automatic identification, enrolment, diagnosis, risk scoring, clinical-severity scoring, treatment recommendation, allocation, or plan generation.",
  "Production authentication, authorisation, relationship-based access, break-glass access, retention enforcement, or immutable audit infrastructure.",
  "Integration with any hospital, community, pharmacy, ambulance, email, or identity system.",
  "Any claim of clinical, privacy, security, legal, or operational readiness.",
];

export function GovernanceSurface() {
  const { state } = useCarePlanPrototype();
  const policy = state.identificationPolicy;

  return (
    <section aria-label="Prototype governance" className={styles.workspace}>
      <div className={styles.identityBand}>
        <SyntheticMarker />
        <p className={styles.sectionDescription}>
          This is a synthetic interaction and domain model. It is not validated clinical decision support, and passing
          its tests or rendering a complete prototype satisfies none of the requirements below.
        </p>
      </div>

      {/*
        The panel this whole page exists for. There is no approved number, and
        the interface must not encode, imply, default, or visually suggest one —
        so this states four facts and offers no control that could become one.
      */}
      <SectionFrame
        id="care-plan-governance-policy"
        heading="Identification Policy"
        tone="boundary"
        testId="care-plan-governance-policy"
        description="Who is offered a Management Plan, and on what basis, is a local governance decision that has not been made."
      >
        <dl className={styles.definitionGrid}>
          <DefinitionRow term="Status">Pending local governance</DefinitionRow>
          <DefinitionRow term="Threshold count">No approved threshold count</DefinitionRow>
          <DefinitionRow term="Threshold lookback">No approved threshold lookback</DefinitionRow>
          <DefinitionRow term="Manual referral">Manual referral enabled</DefinitionRow>
        </dl>
        <p className={styles.sectionDescription}>{policy.explanation}</p>
        <p className={styles.contactBoundary}>
          {`${COUNTS_DECIDE_NOTHING} Nothing in this prototype proposes, defaults to, or compares against a number, because proposing one would be the governance decision it exists to leave open.`}
        </p>
      </SectionFrame>

      <SectionFrame
        id="care-plan-governance-roles"
        heading="Who does what"
        testId="care-plan-governance-roles"
        description="Illustrated responsibilities. Choosing a clinician in the rail explains why an action is offered; it is not a sign-in, and it protects nothing."
      >
        <dl className={styles.definitionGrid}>
          {ROLE_RESPONSIBILITY.map(({ role, does }) => (
            <DefinitionRow key={role} term={role}>
              {does}
            </DefinitionRow>
          ))}
        </dl>
        <p className={styles.contactBoundary}>
          This is interaction modelling only. It is not authentication, authorisation, role-based access control,
          relationship-based access, or break-glass evidence, and no data anywhere in this prototype is protected by
          it.
        </p>
      </SectionFrame>

      <SectionFrame id="care-plan-governance-lifecycle" heading="Lifecycle rules" testId="care-plan-governance-lifecycle">
        <ul className={styles.contentList}>
          {LIFECYCLE_RULE.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </SectionFrame>

      <SectionFrame
        id="care-plan-governance-audit"
        heading="What the audit record can and cannot say"
        testId="care-plan-governance-audit"
      >
        <ul className={styles.contentList}>
          {AUDIT_LIMIT.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </SectionFrame>

      <SectionFrame
        id="care-plan-governance-privacy"
        heading="Privacy, printing, and contact"
        testId="care-plan-governance-privacy"
      >
        <ul className={styles.contentList}>
          {PRIVACY_RULE.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </SectionFrame>

      <SectionFrame
        id="care-plan-governance-boundary"
        heading="What this prototype is not"
        tone="boundary"
        testId="care-plan-governance-boundary"
      >
        <ul className={styles.contentList}>
          {NOT_READY_FOR.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={styles.sectionDescription}>
          Operational use would require, at minimum, WA Health clinical governance approval, an approved identification
          policy, patient and consumer co-design, a privacy impact assessment, cultural-safety review, legal review,
          clinical-content validation, data-retention rules, authoritative record ownership, identity matching, access
          control, immutable audit, secure messaging, integration contracts, concurrency control, downtime procedures,
          cybersecurity review, accessibility acceptance, training, monitoring, incident response, and controlled
          deployment.
        </p>
      </SectionFrame>
    </section>
  );
}
