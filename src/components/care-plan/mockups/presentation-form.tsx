"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Disclosure } from "@/components/ui/disclosure";
import { ErrorSummary } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { EmptyState, InlineNotice, ignoreUnavailableActivation } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import { buildPatientSnapshot, canPerformAction } from "./domain";
import { PROTOTYPE_NOW } from "./fixtures";
import {
  AMENDABLE_FIELD_LABEL,
  CMHT_CONTACT_ATTEMPT_LABEL,
  DISPOSITION_LABEL,
  DISPOSITION_OPTIONS,
  PLAN_AVAILABILITY_OPTIONS,
  PLAN_HELPFULNESS_OPTIONS,
  PLAN_USE_OPTIONS,
  linkedPlanLabel,
  planUseSummary,
  siteName,
} from "./presentation-timeline";
import { useCarePlanPrototype } from "./prototype-provider";
import { getPrototypeMutationBlockReason, nextPresentationId } from "./prototype-state";
import {
  DefinitionRow,
  PROTOTYPE_OUTCOME_TONE,
  PROTOTYPE_ROLE_LABEL,
  PlanTextArea,
  SectionFrame,
  SyntheticMarker,
  formatPerthDate,
  formatPerthDateTime,
} from "./prototype-ui";
import { carePlanRoute } from "./routes";
import type {
  Disposition,
  NewEdPresentationInput,
  PlanAvailability,
  PlanHelpfulness,
  PlanUse,
  PrototypeScenario,
  SyntheticId,
} from "./types";

/**
 * Recording one concise ED Presentation.
 *
 * Six answers are required, and they are the whole visible form: the fictional
 * emergency department, the disposition, whether the plan was available, whether
 * it was used, whether it helped, and one line saying why the person came and
 * what happened. That single line deliberately does the work two structured
 * boxes would otherwise do, because one line of prose from the clinician who was
 * there beats two fields that get skipped at the end of a shift.
 *
 * Everything else sits behind one disclosure and never blocks the save. An
 * optional field left empty is recorded as empty and reads as `Not recorded`; it
 * is never dropped, and it is never filled in with something nobody said.
 *
 * The record deliberately does not carry a full ED note, a diagnosis list, a
 * medication chart, a risk assessment, or a clinical history. Those belong to
 * the hospital record, and a second copy of them here would be a second place to
 * be wrong.
 *
 * Nothing here changes a Management Plan. Plan-use feedback can raise a Review
 * Trigger, which asks a person to look; the reducer owns that, and the plan is
 * untouched either way.
 */

/** Stable field identifiers, so an error-summary link and the field it names
 *  cannot drift apart. */
export function presentationFieldId(field: string): string {
  return `care-plan-presentation-form-${field}`;
}

type FormValues = {
  siteId: string;
  /** `YYYY-MM-DD` and `HH:MM`, the values the two controls hold. */
  arrivalDate: string;
  arrivalTime: string;
  disposition: string;
  planAvailability: string;
  planUse: string;
  planHelpfulness: string;
  note: string;
  suggestReview: boolean;
  reviewReason: string;
  presentingIndication: string;
  assessmentOutcome: string;
  cmhtContactAttempt: "not_attempted" | "attempted";
  cmhtContactOutcome: string;
  deviationOccurred: boolean;
  deviationReason: string;
};

type FieldEntry = { fieldId: string; label: string; message: string };

const SITE_LABEL = "Emergency department";
const ARRIVAL_DATE_LABEL = "Arrival date";
const ARRIVAL_TIME_LABEL = "Arrival time";
const REVIEW_REASON_LABEL = "Why is review suggested?";
const DEVIATION_REASON_LABEL = "Why was the agreed approach not followed?";
const PRESENTING_INDICATION_LABEL = "Presenting indication";
const CMHT_ATTEMPT_LABEL = "Was the community mental health team contacted?";
const CMHT_OUTCOME_LABEL = "What happened when the team was contacted?";

/** Perth wall-clock parts. A `+08:00` timestamp already carries both. */
function initialValues(): FormValues {
  return {
    siteId: "",
    arrivalDate: PROTOTYPE_NOW.slice(0, 10),
    arrivalTime: PROTOTYPE_NOW.slice(11, 16),
    disposition: "",
    planAvailability: "",
    planUse: "",
    planHelpfulness: "",
    note: "",
    suggestReview: false,
    reviewReason: "",
    presentingIndication: "",
    assessmentOutcome: "",
    cmhtContactAttempt: "not_attempted",
    cmhtContactOutcome: "",
    deviationOccurred: false,
    deviationReason: "",
  };
}

function toPerthTimestamp(date: string, time: string): string {
  return date === "" || time === "" ? "" : `${date}T${time}:00+08:00`;
}

/**
 * What must be answered before an episode can be recorded, in the order the
 * fields appear on screen, so the first entry is always the first thing a reader
 * would reach.
 *
 * Presenting indication, assessment outcome, the community-team fields and the
 * deviation flag are deliberately absent: the specification says they never
 * block the save, and a validator that quietly required one would make the
 * thirty-second form a two-minute one again.
 */
function validate(values: FormValues): FieldEntry[] {
  const entries: FieldEntry[] = [];
  const add = (field: string, label: string, message: string) =>
    entries.push({ fieldId: presentationFieldId(field), label, message });

  if (values.siteId === "") {
    add("siteId", SITE_LABEL, "Choose which fictional emergency department this episode happened in.");
  }
  if (Number.isNaN(Date.parse(toPerthTimestamp(values.arrivalDate, values.arrivalTime)))) {
    add("arrivedAt", ARRIVAL_DATE_LABEL, "Enter the date and time the person arrived.");
  }
  if (values.disposition === "") {
    add("disposition", AMENDABLE_FIELD_LABEL.disposition, "Choose what happened at the end of this episode.");
  }
  if (values.planAvailability === "") {
    add("planAvailability", AMENDABLE_FIELD_LABEL.planAvailability, "Say whether the Current Plan could be found.");
  }
  if (values.planUse === "") {
    add("planUse", AMENDABLE_FIELD_LABEL.planUse, "Say whether the Current Plan was used during this episode.");
  }
  if (values.planHelpfulness === "") {
    add("planHelpfulness", AMENDABLE_FIELD_LABEL.planHelpfulness, "Say whether the plan helped on the day.");
  }
  if (values.note.trim() === "") {
    add("note", AMENDABLE_FIELD_LABEL.note, "One line is enough. It is what a later reader has to go on.");
  }
  if (values.suggestReview && values.reviewReason.trim() === "") {
    add("reviewReason", REVIEW_REASON_LABEL, "Say what the team should look at, so they know what the review is for.");
  }
  if (values.deviationOccurred && values.deviationReason.trim() === "") {
    add("deviationReason", DEVIATION_REASON_LABEL, "Say what stopped the agreed approach being followed.");
  }
  return entries;
}

export function PresentationFormSurface({
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

  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FieldEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [recordedId, setRecordedId] = useState<SyntheticId | null>(null);

  if (snapshot === null) {
    return (
      <EmptyState
        testId="care-plan-presentation-no-patient"
        title="No patient is open."
        body="Open a synthetic patient from Home or Patients, then choose ED Presentations."
      />
    );
  }

  const { patient, currentManagementVersion } = snapshot;

  if (scenario === "identity-uncertain") {
    return (
      <section aria-label={`Record an ED Presentation for ${patient.fullName}`} className={styles.workspace}>
        <p role="alert" data-testid="care-plan-identity-uncertain" className={styles.identityUncertain}>
          <strong>This record has not been confirmed as the right person.</strong> Nothing can be recorded against it.
          Return to search and choose the record again.
        </p>
      </section>
    );
  }

  /*
   * A Draft is never the plan that was available. It is not in use, no clinician
   * could have followed it, and linking one would put a version nobody agreed on
   * the evidence trail. The Current version is linked, or nothing is.
   */
  const linkedVersionId = currentManagementVersion?.id ?? null;
  const linkedPlan = linkedPlanLabel(linkedVersionId, state.managementPlanVersions);

  const identity = (
    <div data-testid="care-plan-presentation-identity" className={styles.identityBand}>
      <SyntheticMarker />
      <h2 className={styles.patientName}>{patient.fullName}</h2>
      <p className={styles.sectionDescription}>{`${patient.mrn} — born ${formatPerthDate(patient.dateOfBirth)}`}</p>
      <Link href={carePlanRoute.presentations(patient.id)} className={styles.inlineLink}>
        Back to the ED Presentation timeline
      </Link>
    </div>
  );

  const actor = state.users.find((user) => user.id === state.activeUserId) ?? null;
  const mayRecord = actor !== null && canPerformAction(actor.role, "record_presentation");

  if (!mayRecord) {
    return (
      <section aria-label={`Record an ED Presentation for ${patient.fullName}`} className={styles.workspace}>
        {identity}
        <SectionFrame id="care-plan-presentation-unavailable" heading="Recording an ED Presentation" tone="boundary">
          <p data-testid="care-plan-presentation-unavailable" className={styles.sectionDescription}>
            {actor === null
              ? "No synthetic user is selected, so nothing recorded here could be attributed to anyone."
              : `${actor.displayName} is signed in with the ${PROTOTYPE_ROLE_LABEL[actor.role].toLowerCase()} role, which does not carry this action. A clinician who saw the person records the episode.`}
          </p>
        </SectionFrame>
      </section>
    );
  }

  const recorded = recordedId === null ? null : (state.edPresentations.find(({ id }) => id === recordedId) ?? null);

  if (recorded !== null) {
    const trigger = state.reviewTriggers.find((candidate) => candidate.sourceId === recorded.id) ?? null;
    return (
      <section aria-label={`Record an ED Presentation for ${patient.fullName}`} className={styles.workspace}>
        {identity}
        <SectionFrame
          id="care-plan-presentation-recorded"
          heading="ED Presentation recorded"
          testId="care-plan-presentation-recorded"
        >
          {/*
            The address changes to the episode as soon as this renders, so in the
            running application this panel is what the reader sees while the
            router commits. It says the one thing that must not be lost on the
            way: this happened here, in memory, and nowhere else.
          */}
          <InlineNotice tone="success">
            ED Presentation recorded in this synthetic session. Nothing was sent anywhere, no other system was told, and
            reloading the page starts over.
          </InlineNotice>
          <dl className={styles.definitionGrid}>
            <DefinitionRow term="Arrived">{formatPerthDateTime(recorded.arrivedAt)}</DefinitionRow>
            <DefinitionRow term={SITE_LABEL}>{siteName(state.edSites, recorded.siteId)}</DefinitionRow>
            <DefinitionRow term={AMENDABLE_FIELD_LABEL.disposition}>
              {DISPOSITION_LABEL[recorded.disposition]}
            </DefinitionRow>
            <DefinitionRow term="Plan available at the time">
              {linkedPlanLabel(recorded.managementPlanVersionId, state.managementPlanVersions)}
            </DefinitionRow>
            <DefinitionRow term="Plan-use feedback">{planUseSummary(recorded)}</DefinitionRow>
            <DefinitionRow term={AMENDABLE_FIELD_LABEL.note}>
              {recorded.note.trim() === "" ? undefined : recorded.note}
            </DefinitionRow>
            <DefinitionRow term={PRESENTING_INDICATION_LABEL}>
              {recorded.presentingIndication.trim() === "" ? undefined : recorded.presentingIndication}
            </DefinitionRow>
            <DefinitionRow term={AMENDABLE_FIELD_LABEL.assessmentOutcome}>
              {recorded.assessmentOutcome.trim() === "" ? undefined : recorded.assessmentOutcome}
            </DefinitionRow>
          </dl>
          <p className={styles.sectionDescription}>
            The Management Plan itself is unchanged. Recording an episode never edits a plan, and nothing here asks
            anyone to.
          </p>
          {trigger === null ? null : (
            <SectionFrame
              id="care-plan-presentation-trigger"
              heading="Review Suggested"
              headingLevel={3}
              tone="secondary"
              testId="care-plan-presentation-trigger"
            >
              <p className={styles.sectionDescription}>{trigger.reason}</p>
              <p className={styles.sectionDescription}>
                An open item was added to the Reviews queue for the team to look at.
              </p>
            </SectionFrame>
          )}
          <p className={styles.planFooterLink}>
            <Link href={carePlanRoute.presentation(patient.id, recorded.id)} className={styles.inlineLink}>
              Open this ED Presentation
            </Link>
          </p>
        </SectionFrame>
      </section>
    );
  }

  const input: NewEdPresentationInput = {
    patientId: patient.id,
    arrivedAt: toPerthTimestamp(values.arrivalDate, values.arrivalTime),
    siteId: values.siteId as SyntheticId,
    presentingIndication: values.presentingIndication.trim(),
    assessmentOutcome: values.assessmentOutcome.trim(),
    note: values.note.trim(),
    disposition: values.disposition as Disposition,
    cmhtContactAttempt: values.cmhtContactAttempt,
    cmhtContactOutcome: values.cmhtContactOutcome.trim(),
    managementPlanVersionId: linkedVersionId,
    planAvailability: values.planAvailability as PlanAvailability,
    planUse: values.planUse as PlanUse,
    planHelpfulness: values.planHelpfulness as PlanHelpfulness,
    deviationOccurred: values.deviationOccurred,
    deviationReason: values.deviationOccurred ? values.deviationReason.trim() : null,
    /*
     * A written reason is itself a suggestion to review: a clinician who says
     * what the team should look at has suggested a review whether or not they
     * also ticked the box, and dropping the sentence they wrote would be the
     * worse of the two readings. The box on its own still needs a reason, which
     * is what the validator refuses.
     */
    reviewSuggested: values.suggestReview || values.reviewReason.trim() !== "",
    reviewReason: values.reviewReason.trim() === "" ? null : values.reviewReason.trim(),
  };

  const blockedReason = getPrototypeMutationBlockReason(state, {
    type: "record-presentation",
    presentationId: nextPresentationId(state),
    input,
  });
  const errorByFieldId = new Map(errors.map((entry) => [entry.fieldId, entry.message]));

  function set<Key extends keyof FormValues>(key: Key, value: FormValues[Key]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blockedReason !== null) return;
    const found = validate(values);
    setAttempt((previous) => previous + 1);
    setErrors(found);
    if (found.length > 0) return;

    // The caller supplies the identifier and the reducer validates it before
    // appending, so the address navigated to is always the record written.
    const presentationId = nextPresentationId(state);
    dispatch({ type: "record-presentation", presentationId, input });
    setRecordedId(presentationId);
    navigate(carePlanRoute.presentation(patient.id, presentationId));
  }

  return (
    <section aria-label={`Record an ED Presentation for ${patient.fullName}`} className={styles.workspace}>
      {identity}

      {state.lastOutcome === null ? null : (
        <div data-testid="care-plan-presentation-outcome">
          <InlineNotice tone={PROTOTYPE_OUTCOME_TONE[state.lastOutcome.kind]}>{state.lastOutcome.message}</InlineNotice>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {/* One focus owner, and it is the summary, exactly as every other form in
            the repository does it. Its links are how focus reaches a field. */}
        <ErrorSummary
          heading="This ED Presentation could not be recorded"
          errors={errors}
          attempt={attempt}
          className={styles.formErrorSummary}
        />

        <SectionFrame
          id="care-plan-presentation-required"
          heading="What happened"
          description="Six answers, and one line of prose. Everything else is optional and never holds up the save."
        >
          <p data-testid="care-plan-presentation-linked-plan" className={styles.sectionDescription}>
            {`Plan available at the time: ${linkedPlan}. A version still being written is never recorded as the plan that was available.`}
          </p>

          <div className={styles.formGrid}>
            <Select
              id={presentationFieldId("siteId")}
              label={SITE_LABEL}
              required
              placeholder="Choose an emergency department"
              hint="Every emergency department in this prototype is fictional."
              value={values.siteId}
              error={errorByFieldId.get(presentationFieldId("siteId"))}
              onChange={(event) => set("siteId", event.target.value)}
              options={state.edSites.map((site) => ({ value: site.id, label: site.name }))}
            />
            <TextField
              id={presentationFieldId("arrivedAt")}
              label={ARRIVAL_DATE_LABEL}
              type="date"
              required
              hint="Defaulted to now. Change it if the person arrived earlier."
              value={values.arrivalDate}
              error={errorByFieldId.get(presentationFieldId("arrivedAt"))}
              onChange={(event) => set("arrivalDate", event.target.value)}
            />
            <TextField
              id={presentationFieldId("arrivalTime")}
              label={ARRIVAL_TIME_LABEL}
              type="time"
              required
              value={values.arrivalTime}
              onChange={(event) => set("arrivalTime", event.target.value)}
            />
            <Select
              id={presentationFieldId("disposition")}
              label={AMENDABLE_FIELD_LABEL.disposition}
              required
              placeholder="Choose what happened"
              value={values.disposition}
              error={errorByFieldId.get(presentationFieldId("disposition"))}
              onChange={(event) => set("disposition", event.target.value)}
              options={DISPOSITION_OPTIONS}
            />
          </div>

          <TextField
            id={presentationFieldId("note")}
            label={AMENDABLE_FIELD_LABEL.note}
            required
            hint="One line, in your own words. It is what the timeline and the community team actually read."
            value={values.note}
            error={errorByFieldId.get(presentationFieldId("note"))}
            onChange={(event) => set("note", event.target.value)}
          />
        </SectionFrame>

        <SectionFrame
          id="care-plan-presentation-plan-use"
          heading="Plan-use feedback"
          description="Three answers about the plan itself. They can ask the team to look at the plan again; they never change it."
        >
          <div className={styles.formGrid}>
            <Select
              id={presentationFieldId("planAvailability")}
              label={AMENDABLE_FIELD_LABEL.planAvailability}
              required
              placeholder="Choose an answer"
              value={values.planAvailability}
              error={errorByFieldId.get(presentationFieldId("planAvailability"))}
              onChange={(event) => set("planAvailability", event.target.value)}
              options={PLAN_AVAILABILITY_OPTIONS}
            />
            <Select
              id={presentationFieldId("planUse")}
              label={AMENDABLE_FIELD_LABEL.planUse}
              required
              placeholder="Choose an answer"
              value={values.planUse}
              error={errorByFieldId.get(presentationFieldId("planUse"))}
              onChange={(event) => set("planUse", event.target.value)}
              options={PLAN_USE_OPTIONS}
            />
            <Select
              id={presentationFieldId("planHelpfulness")}
              label={AMENDABLE_FIELD_LABEL.planHelpfulness}
              required
              placeholder="Choose an answer"
              value={values.planHelpfulness}
              error={errorByFieldId.get(presentationFieldId("planHelpfulness"))}
              onChange={(event) => set("planHelpfulness", event.target.value)}
              options={PLAN_HELPFULNESS_OPTIONS}
            />
          </div>

          <Checkbox
            id={presentationFieldId("suggestReview")}
            label="Suggest a plan review"
            description="Adds an open item to the Reviews queue. It asks a person to look; it changes no plan."
            checked={values.suggestReview}
            onChange={(event) => set("suggestReview", event.target.checked)}
          />
          <PlanTextArea
            id={presentationFieldId("reviewReason")}
            label={REVIEW_REASON_LABEL}
            rows={3}
            hint="Leave this empty unless the team should look at the plan again."
            value={values.reviewReason}
            error={errorByFieldId.get(presentationFieldId("reviewReason"))}
            onChange={(text) => set("reviewReason", text)}
          />
        </SectionFrame>

        <Disclosure
          title="Add more detail"
          description="Optional. Anything left empty reads as Not recorded, and none of it holds up the save."
          className={styles.presentationDisclosure}
        >
          <div className={styles.disclosureBody}>
            <PlanTextArea
              id={presentationFieldId("presentingIndication")}
              label={PRESENTING_INDICATION_LABEL}
              rows={2}
              value={values.presentingIndication}
              onChange={(text) => set("presentingIndication", text)}
            />
            <PlanTextArea
              id={presentationFieldId("assessmentOutcome")}
              label={AMENDABLE_FIELD_LABEL.assessmentOutcome}
              rows={2}
              value={values.assessmentOutcome}
              onChange={(text) => set("assessmentOutcome", text)}
            />
            <Select
              id={presentationFieldId("cmhtContactAttempt")}
              label={CMHT_ATTEMPT_LABEL}
              value={values.cmhtContactAttempt}
              onChange={(event) => set("cmhtContactAttempt", event.target.value as FormValues["cmhtContactAttempt"])}
              options={(Object.keys(CMHT_CONTACT_ATTEMPT_LABEL) as (keyof typeof CMHT_CONTACT_ATTEMPT_LABEL)[]).map(
                (value) => ({ value, label: CMHT_CONTACT_ATTEMPT_LABEL[value] }),
              )}
            />
            <PlanTextArea
              id={presentationFieldId("cmhtContactOutcome")}
              label={CMHT_OUTCOME_LABEL}
              rows={2}
              hint="What actually happened — who answered, what was arranged. Not a clinical account."
              value={values.cmhtContactOutcome}
              onChange={(text) => set("cmhtContactOutcome", text)}
            />
            <Checkbox
              id={presentationFieldId("deviationOccurred")}
              label="The agreed approach could not be followed"
              description="Recording this asks the team to look at whether the plan can be followed here."
              checked={values.deviationOccurred}
              onChange={(event) => set("deviationOccurred", event.target.checked)}
            />
            <PlanTextArea
              id={presentationFieldId("deviationReason")}
              label={DEVIATION_REASON_LABEL}
              rows={2}
              value={values.deviationReason}
              error={errorByFieldId.get(presentationFieldId("deviationReason"))}
              onChange={(text) => set("deviationReason", text)}
            />
          </div>
        </Disclosure>

        {blockedReason === null ? null : (
          <p
            id="care-plan-presentation-blocked"
            role="alert"
            data-testid="care-plan-presentation-blocked"
            className={styles.contactWarning}
          >
            {blockedReason}
          </p>
        )}

        <div className={styles.actionRow}>
          <Button
            type="submit"
            variant="primary"
            aria-disabled={blockedReason === null ? undefined : true}
            aria-describedby={blockedReason === null ? undefined : "care-plan-presentation-blocked"}
            onClick={blockedReason === null ? undefined : ignoreUnavailableActivation}
          >
            Record ED presentation
          </Button>
        </div>
      </form>
    </section>
  );
}
