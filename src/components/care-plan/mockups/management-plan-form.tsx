"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorSummary } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { EmptyState, InlineNotice, ignoreUnavailableActivation } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import { BANNED_ADMISSION_CONSTRUCTIONS, buildPatientSnapshot, canPerformAction } from "./domain";
import { PROTOTYPE_NOW } from "./fixtures";
import { useCarePlanPrototype } from "./prototype-provider";
import { getPrototypeMutationBlockReason } from "./prototype-state";
import {
  FIRST_MINUTE_SECTION_LABEL,
  FULL_PLAN_SECTION_KEYS,
  FULL_PLAN_SECTION_LABEL,
  PROTOTYPE_OUTCOME_TONE,
  PROTOTYPE_ROLE_LABEL,
  PlanTextArea,
  SectionFrame,
  SyntheticMarker,
  WHY_THIS_PLAN_EXISTS_LABEL,
  formatPerthDate,
} from "./prototype-ui";
import { carePlanRoute } from "./routes";
import {
  FIRST_MINUTE_CONTENT_KEYS,
  MANAGEMENT_PLAN_REQUIRED_CONTENT_KEYS,
  type ManagementDraftInput,
  type ManagementPlanContent,
  type ManagementPlanVersion,
  type ParticipationState,
  type PrototypeScenario,
  type SyntheticId,
} from "./types";

/**
 * Drafting a replacement Management Plan Version.
 *
 * The Current Plan is never displaced by anything written here. It stays in use,
 * it stays visible, and the version being written says so on its own face — a
 * Draft is not a plan, and the surface that writes one must not be able to read
 * as though it were.
 *
 * Validation is a wording and completeness guard, never clinical interpretation.
 * The only content rule is the banned prohibitive-admission constructions, and
 * that rule takes no view on whether the clinical position is right: it refuses a
 * form of words that can be read at 3am as a pre-authorised refusal by a
 * clinician who has never met the person and is not there to be argued with.
 *
 * The reducer remains the final guard. Everything below decides only what to
 * offer and what to say; nothing here is a permission check.
 */

/** Stable field identifiers, so an error-summary link and a focus target cannot
 *  drift apart from the field they name. */
export function managementPlanFieldId(field: string): string {
  return `care-plan-management-form-${field}`;
}

type ContentKey = keyof ManagementPlanContent;

type FormValues = {
  ownerId: string;
  /** `YYYY-MM-DD`, the value a date control holds. */
  reviewDate: string;
  revisionReason: string;
  participationState: ParticipationState;
  /** Every content field as the text in its own control: one point per line. */
  content: Record<ContentKey, string>;
};

type FieldEntry = { fieldId: string; label: string; message: string };

const PARTICIPATION_OPTIONS: readonly { value: ParticipationState; label: string }[] = [
  { value: "co_produced", label: "Written with this person" },
  { value: "discussed", label: "Discussed with this person" },
  { value: "declined", label: "This person chose not to take part" },
  { value: "patient_unavailable", label: "No involvement recorded" },
];

const REQUIRED_CONTENT_KEYS: readonly ContentKey[] = MANAGEMENT_PLAN_REQUIRED_CONTENT_KEYS;

const CONTENT_LABEL: Record<ContentKey, string> = {
  ...FIRST_MINUTE_SECTION_LABEL,
  whyThisPlanExists: WHY_THIS_PLAN_EXISTS_LABEL,
  ...FULL_PLAN_SECTION_LABEL,
};

/** Perth wall-clock date part. A `+08:00` timestamp already carries it. */
function toDateValue(iso: string | null): string {
  return iso === null ? "" : iso.slice(0, 10);
}

/**
 * A date control's value back to a Perth-local timestamp. The time of day is a
 * fixed midday, so the same date always produces the same string and nothing
 * here reads a clock.
 */
function toPerthTimestamp(dateValue: string): string {
  return dateValue === "" ? "" : `${dateValue}T12:00:00+08:00`;
}

function textOf(content: ManagementPlanContent, key: ContentKey): string {
  const value = content[key];
  return typeof value === "string" ? value : value.join("\n");
}

function linesFrom(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function valuesFrom(version: ManagementPlanVersion): FormValues {
  const content = {} as Record<ContentKey, string>;
  for (const key of Object.keys(version.content) as ContentKey[]) content[key] = textOf(version.content, key);
  return {
    ownerId: version.ownerId,
    reviewDate: toDateValue(version.reviewDueAt),
    revisionReason: version.revisionReason,
    participationState: version.participationState,
    content,
  };
}

function contentFrom(values: FormValues): ManagementPlanContent {
  const lists = {} as Record<Exclude<ContentKey, "whyThisPlanExists">, string[]>;
  for (const key of Object.keys(values.content) as ContentKey[]) {
    if (key === "whyThisPlanExists") continue;
    lists[key] = linesFrom(values.content[key]);
  }
  return { ...lists, whyThisPlanExists: values.content.whyThisPlanExists.trim() } as ManagementPlanContent;
}

function draftInputFrom(values: FormValues, version: ManagementPlanVersion): ManagementDraftInput {
  return {
    ownerId: values.ownerId as SyntheticId,
    reviewDueAt: toPerthTimestamp(values.reviewDate),
    revisionReason: values.revisionReason.trim(),
    participationState: values.participationState,
    consentedSupportPeople: version.consentedSupportPeople,
    content: contentFrom(values),
  };
}

/**
 * The one content rule. It reports the construction it found so the author can
 * see exactly which form of words was refused, rather than being told the field
 * is wrong with nothing saying how.
 */
function bannedConstructionIn(text: string): string | null {
  const haystack = text.toLowerCase();
  return BANNED_ADMISSION_CONSTRUCTIONS.find((phrase) => haystack.includes(phrase)) ?? null;
}

function bannedWordingMessage(phrase: string): string {
  return `This section contains the phrase “${phrase}”. Write the agreed default as an approach that names who agreed it and when: this plan records what has usually helped, and it does not set a ceiling on the care offered on the day.`;
}

/**
 * What must be true before a version can be asked for. Exactly the six required
 * content keys plus owner, next review date, reason, and participation state —
 * the five optional full-plan sections are never required, and a version that
 * leaves them empty is complete.
 *
 * The order is the order of the fields on screen, so the first entry is always
 * the first invalid field a reader would reach.
 */
function validate(values: FormValues): FieldEntry[] {
  const entries: FieldEntry[] = [];
  const add = (field: string, message: string) =>
    entries.push({
      fieldId: managementPlanFieldId(field),
      label: CONTENT_LABEL[field as ContentKey] ?? field,
      message,
    });

  /*
   * Owner and participation state are deliberately absent from this function.
   * Both are `<select>` values seeded from the version being edited, and both are
   * typed unions with no empty member, so a "not chosen" branch for either could
   * never fire — dead code inside the one function this task's error tests
   * exercise, which is worse than a shorter validator. If either control ever
   * gains a placeholder, the branch comes back with a test that reaches it; until
   * then the reducer stays the guard, and it refuses an owner who is not a
   * synthetic user.
   */
  if (values.reviewDate.trim() === "" || Number.isNaN(Date.parse(toPerthTimestamp(values.reviewDate)))) {
    entries.push({
      fieldId: managementPlanFieldId("reviewDueAt"),
      label: "Next review date",
      message: "Enter the date this plan is next due for review.",
    });
  }
  if (values.revisionReason.trim() === "") {
    entries.push({
      fieldId: managementPlanFieldId("revisionReason"),
      label: "Reason for this version",
      message: "Say what changed and why, so a later reader can tell why this version replaced the last.",
    });
  }

  for (const key of REQUIRED_CONTENT_KEYS) {
    if (linesFrom(values.content[key]).length === 0) {
      add(
        key,
        key === "whyThisPlanExists"
          ? "Say why this plan exists."
          : "Add at least one point, one per line, before this version can be approved.",
      );
    }
  }

  const phrase = bannedConstructionIn(values.content.agreedEdApproach);
  if (phrase !== null) add("agreedEdApproach", bannedWordingMessage(phrase));

  return entries;
}

/** Only ever used before a Draft exists, when no field is rendered. */
const EMPTY_FORM_VALUES: FormValues = {
  ownerId: "",
  reviewDate: "",
  revisionReason: "",
  participationState: "patient_unavailable",
  content: {
    howToApproach: "",
    whatHelps: "",
    whatMakesItWorse: "",
    agreedEdApproach: "",
    whatWouldMakeThisDifferent: "",
    whyThisPlanExists: "",
    whatThePersonWants: "",
    practicalNeeds: "",
    physicalHealthAndMedication: "",
    whoElseIsInvolved: "",
    reviewTriggers: "",
  },
};

export function ManagementPlanFormSurface({
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
  const draft = snapshot?.openManagementDraft ?? null;

  // Seeded once per version, during render rather than in an effect: an effect
  // would leave one frame showing the previous version's text in a form that
  // already claims to be editing this one.
  const [seededFrom, setSeededFrom] = useState<string | null>(draft?.id ?? null);
  const [values, setValues] = useState<FormValues>(() => (draft === null ? EMPTY_FORM_VALUES : valuesFrom(draft)));
  const [errors, setErrors] = useState<FieldEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (draft !== null && seededFrom !== draft.id) {
    setSeededFrom(draft.id);
    setValues(valuesFrom(draft));
    setErrors([]);
  }

  /*
   * There is deliberately no focus effect here. `ErrorSummary` moves focus to
   * itself on a failed submit, and that is the repository's behaviour for every
   * form in the product — this one does not get to be different, because the
   * inconsistency is the thing a user has to learn.
   *
   * It is also the better landing place for this form in particular. A failed
   * submit here can raise seven errors at once; a reader who lands on the linked
   * summary hears how many there are and picks one, while a reader dropped onto
   * the first invalid field has to walk the rest of the form to find the others.
   * The summary's own links are how focus reaches a field.
   */

  if (snapshot === null) {
    return (
      <EmptyState
        testId="care-plan-form-no-patient"
        title="No patient is open."
        body="Open a synthetic patient from Home or Patients, then choose Management Plan."
      />
    );
  }

  const { patient, currentManagementVersion } = snapshot;

  if (scenario === "identity-uncertain") {
    return (
      <section aria-label={`Draft ${patient.fullName} Management Plan Version`} className={styles.workspace}>
        <p role="alert" data-testid="care-plan-identity-uncertain" className={styles.identityUncertain}>
          <strong>This record has not been confirmed as the right person.</strong> Nothing can be written against it.
          Return to search and choose the record again.
        </p>
      </section>
    );
  }

  const actor = state.users.find((user) => user.id === state.activeUserId) ?? null;
  const mayAuthor = actor !== null && canPerformAction(actor.role, "author_management_draft");

  const identity = (
    <div data-testid="care-plan-form-identity" className={styles.identityBand}>
      <SyntheticMarker />
      <h2 className={styles.patientName}>{patient.fullName}</h2>
      <p className={styles.sectionDescription}>{`${patient.mrn} — born ${formatPerthDate(patient.dateOfBirth)}`}</p>
      <Link href={carePlanRoute.managementPlan(patient.id)} className={styles.inlineLink}>
        Back to the Management Plan
      </Link>
    </div>
  );

  const currentPlanNotice =
    currentManagementVersion === null ? (
      <p data-testid="care-plan-form-current-plan-notice" className={styles.sectionDescription}>
        {`${patient.preferredName} has no Current Plan. A version being written is not one, and nothing written here is in use until a senior clinician approves it.`}
      </p>
    ) : (
      <p data-testid="care-plan-form-current-plan-notice" className={styles.sectionDescription}>
        {`Current version ${currentManagementVersion.version} stays in use until a senior clinician approves a replacement. Nothing on this page changes it.`}
      </p>
    );

  const outcome =
    state.lastOutcome === null ? null : (
      <div data-testid="care-plan-form-outcome">
        <InlineNotice tone={PROTOTYPE_OUTCOME_TONE[state.lastOutcome.kind]}>{state.lastOutcome.message}</InlineNotice>
      </div>
    );

  // Absent, not shown unavailable: this is a role that never carries the action,
  // so a row of refused controls would say nothing a sentence cannot.
  if (!mayAuthor) {
    return (
      <section aria-label={`Draft ${patient.fullName} Management Plan Version`} className={styles.workspace}>
        {identity}
        <SectionFrame id="care-plan-form-unavailable" heading="Drafting a version" tone="boundary">
          <p data-testid="care-plan-form-unavailable" className={styles.sectionDescription}>
            {actor === null
              ? "No synthetic user is selected, so no version can be attributed to anyone and nothing can be written here."
              : `${actor.displayName} is signed in with the ${PROTOTYPE_ROLE_LABEL[actor.role].toLowerCase()} role, which does not carry this action. Ask the liaison or community team who owns this plan to draft the replacement.`}
          </p>
          {currentPlanNotice}
        </SectionFrame>
      </section>
    );
  }

  if (draft !== null && draft.state === "awaiting_approval") {
    return (
      <section aria-label={`Draft ${patient.fullName} Management Plan Version`} className={styles.workspace}>
        {identity}
        <SectionFrame id="care-plan-form-read-only" heading="Awaiting a senior decision" tone="secondary">
          <p data-testid="care-plan-form-read-only" className={styles.sectionDescription}>
            {`Version ${draft.version} is awaiting approval and cannot be edited. A senior clinician decides whether it becomes the Current Plan, or returns it for changes with a reason.`}
          </p>
          {currentPlanNotice}
          <p className={styles.planFooterLink}>
            <Link href={carePlanRoute.managementPlanReview(patient.id)} className={styles.inlineLink}>
              Open the version awaiting approval
            </Link>
          </p>
        </SectionFrame>
      </section>
    );
  }

  if (draft === null) {
    const blockedReason = getPrototypeMutationBlockReason(state, {
      type: "create-management-draft",
      patientId: patient.id,
    });
    return (
      <section aria-label={`Draft ${patient.fullName} Management Plan Version`} className={styles.workspace}>
        {identity}
        {outcome}
        <SectionFrame
          id="care-plan-form-start"
          heading="Start a replacement version"
          description={
            currentManagementVersion === null
              ? "A new version starts empty, and stays a Draft until a senior clinician approves it."
              : "A new version starts from the content of the Current Plan, so nothing already agreed has to be typed again."
          }
        >
          {currentPlanNotice}
          {blockedReason === null ? null : (
            <p
              id="care-plan-form-blocked"
              role="alert"
              data-testid="care-plan-form-blocked"
              className={styles.contactWarning}
            >
              {blockedReason}
            </p>
          )}
          <div className={styles.actionRow}>
            <Button
              variant="primary"
              aria-disabled={blockedReason === null ? undefined : true}
              aria-describedby={blockedReason === null ? undefined : "care-plan-form-blocked"}
              onClick={
                blockedReason === null
                  ? () => dispatch({ type: "create-management-draft", patientId: patient.id })
                  : ignoreUnavailableActivation
              }
            >
              Start a replacement version
            </Button>
          </div>
        </SectionFrame>
      </section>
    );
  }

  const input = draftInputFrom(values, draft);
  const saveBlockedReason = getPrototypeMutationBlockReason(state, {
    type: "save-management-draft",
    versionId: draft.id,
    input,
  });
  const bannedPhrase = bannedConstructionIn(values.content.agreedEdApproach);
  const errorByFieldId = new Map(errors.map((entry) => [entry.fieldId, entry.message]));
  const involvementNotRecorded =
    values.participationState === "declined" || values.participationState === "patient_unavailable";

  function setContent(key: ContentKey, text: string) {
    setValues((previous) => ({ ...previous, content: { ...previous.content, [key]: text } }));
  }

  /** Saving keeps only the rules the reducer itself enforces, plus the wording
   *  guard: a Draft is work in progress and must be storable while incomplete,
   *  but a refused form of words must never reach the record at all. */
  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveBlockedReason !== null || draft === null) return;
    const blocking = validate(values).filter(
      (entry) =>
        entry.fieldId === managementPlanFieldId("reviewDueAt") ||
        entry.fieldId === managementPlanFieldId("agreedEdApproach"),
    );
    setAttempt((previous) => previous + 1);
    setErrors(blocking);
    if (blocking.length > 0) return;
    dispatch({ type: "save-management-draft", versionId: draft.id, input });
  }

  /** Submitting is a request for a decision, so it is complete or it is refused. */
  function handleSubmitRequest() {
    if (saveBlockedReason !== null) return;
    const found = validate(values);
    setAttempt((previous) => previous + 1);
    setErrors(found);
    if (found.length === 0) setConfirmOpen(true);
  }

  function handleConfirmSubmit() {
    if (draft === null) return;
    setConfirmOpen(false);
    dispatch({ type: "save-management-draft", versionId: draft.id, input });
    dispatch({ type: "submit-management-draft", versionId: draft.id });
    navigate(carePlanRoute.managementPlanReview(patient.id));
  }

  return (
    <section aria-label={`Draft ${patient.fullName} Management Plan Version`} className={styles.workspace}>
      {identity}
      {outcome}

      {draft.returnedReason === null ? null : (
        <p role="status" data-testid="care-plan-form-returned" className={styles.contactWarning}>
          <strong>This version was returned for changes.</strong> {draft.returnedReason}
        </p>
      )}

      <form className={styles.form} onSubmit={handleSave} noValidate>
        {/*
          One focus owner, and it is the summary — the repository default, used
          here exactly as every other form uses it. `attempt` is what makes a
          second failure with the same errors move focus again.
        */}
        <ErrorSummary
          heading="This version could not be submitted"
          errors={errors}
          attempt={attempt}
          className={styles.formErrorSummary}
        />

        {bannedPhrase === null || errorByFieldId.get(managementPlanFieldId("agreedEdApproach")) === undefined ? null : (
          <p role="alert" data-testid="care-plan-banned-wording-error" className={styles.contactWarning}>
            {bannedWordingMessage(bannedPhrase)}
          </p>
        )}

        <SectionFrame
          id="care-plan-form-version"
          heading={`Draft version ${draft.version}`}
          description="A Draft is not a plan in use. It becomes one only when a named senior clinician approves it."
        >
          {currentPlanNotice}
          <div className={styles.formGrid}>
            <Select
              id={managementPlanFieldId("ownerId")}
              label="Plan owner"
              required
              value={values.ownerId}
              error={errorByFieldId.get(managementPlanFieldId("ownerId"))}
              onChange={(event) => setValues((previous) => ({ ...previous, ownerId: event.target.value }))}
              options={state.users.map((user) => ({
                value: user.id,
                label: `${user.displayName} — ${PROTOTYPE_ROLE_LABEL[user.role]}`,
              }))}
            />
            <TextField
              id={managementPlanFieldId("reviewDueAt")}
              label="Next review date"
              type="date"
              required
              hint="Defaulted to twelve months. Change it whenever this plan needs looking at sooner."
              value={values.reviewDate}
              error={errorByFieldId.get(managementPlanFieldId("reviewDueAt"))}
              onChange={(event) => setValues((previous) => ({ ...previous, reviewDate: event.target.value }))}
            />
            <Select
              id={managementPlanFieldId("participationState")}
              label="This person's part in this version"
              required
              hint="A version may be approved at any answer here. Two of them put a permanent marker on the plan and raise a Review Trigger."
              value={values.participationState}
              error={errorByFieldId.get(managementPlanFieldId("participationState"))}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  participationState: event.target.value as ParticipationState,
                }))
              }
              options={PARTICIPATION_OPTIONS.map(({ value, label }) => ({ value, label }))}
            />
          </div>
          <PlanTextArea
            id={managementPlanFieldId("revisionReason")}
            label="Reason for this version"
            required
            rows={3}
            hint="What changed, and why. A later reader comparing two versions has nothing else to tell them."
            value={values.revisionReason}
            error={errorByFieldId.get(managementPlanFieldId("revisionReason"))}
            onChange={(text) => setValues((previous) => ({ ...previous, revisionReason: text }))}
          />
        </SectionFrame>

        <SectionFrame
          id="care-plan-form-first-minute"
          heading="The first minute"
          description="The five sections a clinician reads before anything else. All five are required before this version can be approved. One point per line."
        >
          {FIRST_MINUTE_CONTENT_KEYS.map((key, index) => (
            <PlanTextArea
              key={key}
              id={managementPlanFieldId(key)}
              label={`${index + 1}. ${CONTENT_LABEL[key]}`}
              required
              value={values.content[key]}
              error={errorByFieldId.get(managementPlanFieldId(key))}
              onChange={(text) => setContent(key, text)}
            />
          ))}
        </SectionFrame>

        <SectionFrame
          id="care-plan-form-full-plan"
          heading="The full plan"
          description="Everything agreed beyond the first minute. Only the first is required; the five below it may be left empty and will read as Not recorded."
        >
          <PlanTextArea
            id={managementPlanFieldId("whyThisPlanExists")}
            label={CONTENT_LABEL.whyThisPlanExists}
            required
            rows={5}
            value={values.content.whyThisPlanExists}
            error={errorByFieldId.get(managementPlanFieldId("whyThisPlanExists"))}
            onChange={(text) => setContent("whyThisPlanExists", text)}
          />
          {FULL_PLAN_SECTION_KEYS.map((key) => (
            <PlanTextArea
              key={key}
              id={managementPlanFieldId(key)}
              label={CONTENT_LABEL[key]}
              hint="Optional. Leaving it empty is a complete answer, and it reads as Not recorded."
              value={values.content[key]}
              error={errorByFieldId.get(managementPlanFieldId(key))}
              onChange={(text) => setContent(key, text)}
            />
          ))}
        </SectionFrame>

        {saveBlockedReason === null ? null : (
          <p
            id="care-plan-form-blocked"
            role="alert"
            data-testid="care-plan-form-blocked"
            className={styles.contactWarning}
          >
            {saveBlockedReason}
          </p>
        )}

        <div className={styles.actionRow}>
          <Button
            type="submit"
            variant="secondary"
            aria-disabled={saveBlockedReason === null ? undefined : true}
            aria-describedby={saveBlockedReason === null ? undefined : "care-plan-form-blocked"}
            onClick={saveBlockedReason === null ? undefined : ignoreUnavailableActivation}
          >
            Save Draft
          </Button>
          <Button
            type="button"
            variant="primary"
            aria-disabled={saveBlockedReason === null ? undefined : true}
            aria-describedby={saveBlockedReason === null ? undefined : "care-plan-form-blocked"}
            onClick={saveBlockedReason === null ? handleSubmitRequest : ignoreUnavailableActivation}
          >
            Submit for senior approval
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        tone="primary"
        title={`Submit version ${draft.version} for senior approval`}
        confirmLabel="Submit for approval"
        cancelLabel="Keep editing"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSubmit}
        description={
          <span>
            {`This asks for a decision on version ${draft.version}. A senior clinician decides whether it becomes the Current Plan, or returns it to you for changes with a reason. It stops being editable in the meantime. `}
            {currentManagementVersion === null
              ? `${patient.preferredName} still has no Current Plan while it waits.`
              : `Current version ${currentManagementVersion.version} stays in use while it waits.`}
            {involvementNotRecorded
              ? ` No involvement is recorded for ${patient.preferredName}, so an approved version would carry a permanent marker saying so.`
              : ""}
          </span>
        }
      />
    </section>
  );
}
