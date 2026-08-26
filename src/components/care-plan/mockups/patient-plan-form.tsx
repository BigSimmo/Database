"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/form-field";
import { EmptyState, InlineNotice, ignoreUnavailableActivation } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import {
  buildPatientSnapshot,
  canPerformAction,
  getCurrentPatientPlanVersion,
  getOpenPatientPlanDraft,
} from "./domain";
import { PROTOTYPE_NOW } from "./fixtures";
import { PATIENT_RESOURCE_CATEGORY_LABEL, getPatientResources } from "./patient-plan-fixtures";
import { patientPlanSectionLeadIn } from "./patient-plan-transform";
import { useCarePlanPrototype } from "./prototype-provider";
import { getPrototypeMutationBlockReason } from "./prototype-state";
import {
  PROTOTYPE_OUTCOME_TONE,
  PROTOTYPE_ROLE_LABEL,
  PlanTextArea,
  SectionFrame,
  StatusMark,
  SyntheticMarker,
  formatPerthDate,
} from "./prototype-ui";
import { carePlanRoute } from "./routes";
import type {
  PatientPlanSection,
  PatientPlanSectionKey,
  PatientPlanVersion,
  PatientResource,
  PrototypeScenario,
  SyntheticId,
} from "./types";

/**
 * Writing the patient copy.
 *
 * The form's whole job is the gaps. The offline conversion has already done what
 * it could do safely and refused everything else, so this screen opens showing
 * what is missing and why — the reason beside each blank, in the clinician's
 * words, saying what the machine would not risk getting wrong.
 *
 * Approval needs any clinical role and no senior sign-off. A person waiting days
 * for their own copy of their own plan is the failure that would matter here,
 * and the emergency department at 2am has no consultant to wait for. What
 * approval does need is that nothing is still blank: the control states that as
 * its reason while any gap remains, and the reducer refuses it anyway.
 *
 * Every section is editable, including the ones the conversion filled. A
 * clinician who reads a converted sentence and thinks it lands badly must be
 * able to rewrite it, and that judgement is theirs rather than the machine's.
 */

/** Stable field identifiers, so an error-summary link and the field it names
 *  cannot drift apart. */
export function patientPlanFieldId(key: string): string {
  return `care-plan-patient-plan-form-${key}`;
}

type FormValues = {
  /** Each section as the text in its own control: one point per line. */
  sections: Record<PatientPlanSectionKey, string>;
  /** The resource identifiers chosen for this copy. */
  resourceIds: readonly SyntheticId[];
};

type FieldEntry = { fieldId: string; label: string; message: string };

function linesFrom(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function valuesFrom(version: PatientPlanVersion): FormValues {
  const sections = {} as Record<PatientPlanSectionKey, string>;
  for (const section of version.sections) sections[section.key] = section.body.join("\n");
  return { sections, resourceIds: version.resources.map((resource) => resource.id) };
}

/** Whether the clinician's text is still exactly what the conversion produced. */
function isUntouched(text: string, section: PatientPlanSection): boolean {
  const lines = linesFrom(text);
  return lines.length === section.body.length && lines.every((line, index) => line === section.body[index]);
}

/**
 * The edited sections, back in domain shape.
 *
 * A flagged section stops being flagged when the clinician has actually changed
 * it, and an emptied section is flagged again whatever it held before — the
 * machine's answer has not changed just because somebody deleted the text over
 * it.
 *
 * "Changed it" rather than "typed something into it" is the whole point once a
 * section can arrive part-converted. The old rule cleared the flag as soon as
 * the box was non-empty, which for a partly converted section was true the
 * moment it appeared: the three lines the conversion managed would have cleared
 * the flag on the fourth it refused, and the copy could have been approved with
 * the refused part still missing. So a section that arrives flagged stays
 * flagged until its text differs from what the conversion produced. For a
 * wholly blank section that reduces to exactly the old behaviour, because the
 * conversion produced nothing and any text differs from nothing.
 */
function sectionsFrom(values: FormValues, original: readonly PatientPlanSection[]): PatientPlanSection[] {
  return original.map((section) => {
    const text = values.sections[section.key] ?? "";
    const body = linesFrom(text);
    const stillFlagged = body.length === 0 || (section.gap && isUntouched(text, section));
    return { ...section, body, gap: stillFlagged, gapReason: stillFlagged ? section.gapReason : null };
  });
}

function resourcesFrom(values: FormValues, available: readonly PatientResource[]): PatientResource[] {
  return available.filter((resource) => values.resourceIds.includes(resource.id));
}

/** What must be true before this copy can be handed to somebody. Read off
 *  `sectionsFrom`, so the form cannot disagree with what it is about to save. */
function validate(values: FormValues, original: readonly PatientPlanSection[]): FieldEntry[] {
  return sectionsFrom(values, original)
    .filter((section) => section.gap)
    .map((section) => ({
      fieldId: patientPlanFieldId(section.key),
      label: section.heading,
      message:
        section.body.length > 0
          ? "Part of this section could not be converted. Add the missing part with this person, or rewrite the section in your own words — it cannot be approved while it is still only what the machine managed."
          : "Write this section with this person, one point per line. A heading with nothing under it, on a copy handed to somebody, reads as though nothing about them was worth writing.",
    }));
}

export function PatientPlanFormSurface({
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
  const plan = state.patientPlans.find((candidate) => candidate.patientId === snapshot?.patient.id) ?? null;
  const draft = plan === null ? null : getOpenPatientPlanDraft(state.patientPlanVersions, plan.id);
  const current = plan === null ? null : getCurrentPatientPlanVersion(state.patientPlanVersions, plan.id);

  // Seeded during render rather than in an effect: an effect would leave one
  // frame showing the previous version's text in a form already claiming to be
  // editing this one.
  const [seededFrom, setSeededFrom] = useState<string | null>(draft?.id ?? null);
  const [values, setValues] = useState<FormValues>(() =>
    draft === null ? { sections: {} as Record<PatientPlanSectionKey, string>, resourceIds: [] } : valuesFrom(draft),
  );
  const [errors, setErrors] = useState<FieldEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const pendingApprovalVersionId = useRef<SyntheticId | null>(null);
  const snapshotPatientId = snapshot?.patient.id ?? null;

  /*
   * Navigation follows the reducer's decision, not the click. A mutation gate
   * can change after the button was rendered but before these queued actions
   * are reduced; in that case both actions are refused and the clinician must
   * stay here with their entered text intact.
   */
  useEffect(() => {
    const pendingVersionId = pendingApprovalVersionId.current;
    if (pendingVersionId === null) return;

    const pendingVersion = state.patientPlanVersions.find(({ id }) => id === pendingVersionId) ?? null;
    if (pendingVersion?.state === "current") {
      pendingApprovalVersionId.current = null;
      if (snapshotPatientId !== null) navigate(carePlanRoute.patientPlan(snapshotPatientId));
      return;
    }

    if (state.lastOutcome?.kind === "blocked" || state.lastOutcome?.kind === "error") {
      pendingApprovalVersionId.current = null;
    }
  }, [navigate, snapshotPatientId, state.lastOutcome, state.patientPlanVersions]);

  if (draft !== null && seededFrom !== draft.id) {
    setSeededFrom(draft.id);
    setValues(valuesFrom(draft));
    setErrors([]);
  }

  /*
   * There is deliberately no focus effect here. `ErrorSummary` moves focus to
   * itself on a failed submit, which is the repository's behaviour for every
   * form in the product; this one does not get to be different.
   */

  if (snapshot === null) {
    return (
      <EmptyState
        testId="care-plan-patient-plan-form-no-patient"
        title="No patient is open."
        body="Open a synthetic patient from Home or Patients, then choose Patient Plan."
      />
    );
  }

  const { patient, currentManagementVersion } = snapshot;

  if (scenario === "identity-uncertain") {
    return (
      <section aria-label={`Write ${patient.fullName} Patient Plan`} className={styles.workspace}>
        <p role="alert" data-testid="care-plan-identity-uncertain" className={styles.identityUncertain}>
          <strong>This record has not been confirmed as the right person.</strong> Nothing can be written against it.
          Return to search and choose the record again.
        </p>
      </section>
    );
  }

  const actor = state.users.find((user) => user.id === state.activeUserId) ?? null;
  const mayAuthor = actor !== null && canPerformAction(actor.role, "approve_patient_plan");
  const available = getPatientResources(state.patientResources, patient.id);

  /*
   * How the source Management Plan Version was written. The clinician writing
   * this draft reads the same headings and lead-ins the person eventually will,
   * so the authorship wording has to be decided here too — and from the draft's
   * own `derivedFromManagementVersionId` rather than from whatever is Current
   * now, because a draft written from one version does not change its account
   * of itself when another version is approved underneath it.
   */
  const draftParticipationState =
    draft === null
      ? null
      : (state.managementPlanVersions.find((version) => version.id === draft.derivedFromManagementVersionId)
          ?.participationState ?? null);

  const outcome =
    state.lastOutcome === null ? null : (
      <InlineNotice tone={PROTOTYPE_OUTCOME_TONE[state.lastOutcome.kind]}>{state.lastOutcome.message}</InlineNotice>
    );

  if (draft === null) {
    const createBlockedReason = getPrototypeMutationBlockReason(state, {
      type: "create-patient-plan-draft",
      patientId: patient.id,
    });
    return (
      <section
        aria-label={`Write ${patient.fullName} Patient Plan`}
        data-testid="care-plan-patient-plan-form"
        className={styles.workspace}
      >
        <SyntheticMarker />
        {outcome}
        <SectionFrame id="care-plan-patient-plan-form-start" heading="Start a patient copy">
          {currentManagementVersion === null ? (
            <p data-testid="care-plan-patient-plan-form-no-source" className={styles.noCurrentPlan}>
              {`${patient.preferredName} has no Current Plan, so there is nothing to make a patient copy of.`}
            </p>
          ) : (
            <>
              <p className={styles.sectionDescription}>
                {`The copy is produced from Current Plan version ${currentManagementVersion.version} by a fixed conversion that runs on this device. It converts only what it can convert safely and leaves everything else blank, with the reason, for you to write with ${patient.preferredName}. No language model is involved.`}
              </p>
              {current === null ? null : (
                <p className={styles.sectionDescription}>
                  {`Version ${current.version} stays the approved copy until you approve a new one, so ${patient.preferredName} is never left without one.`}
                </p>
              )}
              <div className={styles.sectionActions}>
                {createBlockedReason !== null ? (
                  <Button
                    variant="primary"
                    aria-disabled="true"
                    aria-describedby="care-plan-patient-plan-form-blocked"
                    onClick={ignoreUnavailableActivation}
                  >
                    Create the patient copy
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => dispatch({ type: "create-patient-plan-draft", patientId: patient.id })}
                  >
                    Create the patient copy
                  </Button>
                )}
              </div>
              {createBlockedReason === null ? null : (
                <p
                  id="care-plan-patient-plan-form-blocked"
                  role="alert"
                  data-testid="care-plan-patient-plan-form-blocked"
                  className={styles.contactWarning}
                >
                  {createBlockedReason}
                </p>
              )}
            </>
          )}
          <p className={styles.planFooterLink}>
            <Link href={carePlanRoute.patientPlan(patient.id)} className={styles.inlineLink}>
              Back to the Patient Plan
            </Link>
          </p>
        </SectionFrame>
      </section>
    );
  }

  const editedSections = sectionsFrom(values, draft.sections);
  const remainingGaps = editedSections.filter((section) => section.gap);
  const approveBlockedReason = getPrototypeMutationBlockReason(state, {
    type: "approve-patient-plan-version",
    versionId: draft.id,
  });

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft === null) return;
    setErrors([]);
    setAttempt((count) => count + 1);
    dispatch({
      type: "save-patient-plan-draft",
      versionId: draft.id,
      input: { sections: sectionsFrom(values, draft.sections), resources: resourcesFrom(values, available) },
    });
  }

  function handleApprove() {
    if (draft === null) return;
    const found = validate(values, draft.sections);
    setAttempt((count) => count + 1);
    if (found.length > 0) {
      setErrors(found);
      return;
    }
    setErrors([]);
    pendingApprovalVersionId.current = draft.id;
    dispatch({
      type: "save-patient-plan-draft",
      versionId: draft.id,
      input: { sections: sectionsFrom(values, draft.sections), resources: resourcesFrom(values, available) },
    });
    dispatch({ type: "approve-patient-plan-version", versionId: draft.id });
  }

  return (
    <section
      aria-label={`Write ${patient.fullName} Patient Plan`}
      data-testid="care-plan-patient-plan-form"
      className={styles.workspace}
    >
      <SyntheticMarker />
      {outcome}

      <SectionFrame
        id="care-plan-patient-plan-form-about"
        heading={`Draft version ${draft.version}`}
        tone="boundary"
        testId="care-plan-patient-plan-form-about"
      >
        <div className={styles.metadataMarks}>
          <StatusMark tone="neutral" label={`Started ${formatPerthDate(draft.createdAt)}`} />
          <StatusMark
            tone={remainingGaps.length === 0 ? "success" : "warning"}
            label={
              remainingGaps.length === 0
                ? "Every section written"
                : `${remainingGaps.length} of ${draft.sections.length} sections still to write`
            }
          />
        </div>
        <p className={styles.boundaryStatement}>
          {`Everything below is a draft. ${patient.preferredName} has not been given it, and it is not their copy until you approve it.`}
        </p>
        <p className={styles.boundaryStatement}>
          What is missing is missing deliberately. The conversion runs offline on this device with no language model of
          any kind, and it takes each point on its own: the ones it could put into everyday words are below, and the
          ones it could not are left for you, with the reason. What it would have guessed wrong is exactly what a person
          would have read as being about them.
        </p>
      </SectionFrame>

      {mayAuthor ? null : (
        <p data-testid="care-plan-patient-plan-form-role" className={styles.contactWarning}>
          {actor === null
            ? "No synthetic user is selected, so nothing written here could be attributed to anyone."
            : `${actor.displayName} is signed in with the ${PROTOTYPE_ROLE_LABEL[actor.role].toLowerCase()} role, which does not carry writing or approving a patient copy. Any clinical role can.`}
        </p>
      )}

      <form onSubmit={handleSave} noValidate>
        <ErrorSummary
          heading={`This copy cannot be approved while ${errors.length === 1 ? "a section" : "sections"} still ${errors.length === 1 ? "needs" : "need"} writing`}
          errors={errors}
          attempt={attempt}
        />

        <SectionFrame id="care-plan-patient-plan-form-sections" heading="The eight sections">
          {draft.sections.map((section) => (
            <div key={section.key} className={styles.patientPlanFormSection}>
              {/*
                For a part-converted section this names both halves: the mark
                says it is partial, and the reason states how many points came
                through and why the rest did not. The converted points
                themselves are in the field below, editable, so a clinician sees
                what the conversion managed rather than a blank box.
              */}
              {section.gap ? (
                <p
                  data-testid={`care-plan-patient-plan-form-gap-${section.key}`}
                  className={styles.patientPlanGapReason}
                >
                  <StatusMark
                    tone="warning"
                    label={
                      section.body.length > 0
                        ? "Partly converted — the rest needs writing"
                        : "Left blank by the conversion"
                    }
                  />{" "}
                  {section.gapReason}
                </p>
              ) : null}
              <PlanTextArea
                id={patientPlanFieldId(section.key)}
                label={section.heading}
                hint={patientPlanSectionLeadIn(section.key, draftParticipationState)}
                value={values.sections[section.key] ?? ""}
                onChange={(value) =>
                  setValues((previous) => ({
                    ...previous,
                    sections: { ...previous.sections, [section.key]: value },
                  }))
                }
                error={errors.find((entry) => entry.fieldId === patientPlanFieldId(section.key))?.message}
                required
                rows={4}
              />
            </div>
          ))}
        </SectionFrame>

        <SectionFrame
          id="care-plan-patient-plan-form-resources"
          heading="Resources for this person"
          description={`Choose what goes on ${patient.preferredName}'s copy. The crisis lines are the only real telephone numbers in this prototype; everything else is invented.`}
        >
          <ul className={styles.patientPlanResourceChoices}>
            {available.map((resource) => {
              const chosen = values.resourceIds.includes(resource.id);
              const fieldId = patientPlanFieldId(resource.id);
              const detailId = `${fieldId}-detail`;
              return (
                <li key={resource.id} className={styles.patientPlanResourceChoice}>
                  {/* The detail is described rather than labelled: a screen
                      reader announcing the whole paragraph as the checkbox's
                      name would make a list of thirteen resources unusable, and
                      the detail is what the person reads on the sheet anyway. */}
                  <label className={styles.patientPlanResourceLabel} htmlFor={fieldId}>
                    <input
                      id={fieldId}
                      type="checkbox"
                      checked={chosen}
                      aria-describedby={detailId}
                      onChange={() =>
                        setValues((previous) => ({
                          ...previous,
                          resourceIds: chosen
                            ? previous.resourceIds.filter((id) => id !== resource.id)
                            : [...previous.resourceIds, resource.id],
                        }))
                      }
                    />
                    <span className={styles.patientPlanResourceName}>{resource.name}</span>
                  </label>
                  <p id={detailId} className={styles.patientPlanResourceDetail}>
                    {`${PATIENT_RESOURCE_CATEGORY_LABEL[resource.category]} — ${resource.detail}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </SectionFrame>

        <div className={styles.formActions}>
          <Button type="submit" variant="secondary">
            Save draft
          </Button>
          {remainingGaps.length > 0 ? (
            <Button
              variant="primary"
              aria-disabled="true"
              aria-describedby="care-plan-patient-plan-approve-unavailable"
              onClick={ignoreUnavailableActivation}
            >
              Approve patient copy
            </Button>
          ) : approveBlockedReason !== null ? (
            <Button
              variant="primary"
              aria-disabled="true"
              aria-describedby="care-plan-patient-plan-approve-unavailable"
              onClick={ignoreUnavailableActivation}
            >
              Approve patient copy
            </Button>
          ) : (
            <Button variant="primary" onClick={handleApprove}>
              Approve patient copy
            </Button>
          )}
          <Link href={carePlanRoute.patientPlan(patient.id)} className={styles.inlineLink}>
            Back to the Patient Plan
          </Link>
        </div>

        {remainingGaps.length > 0 || approveBlockedReason !== null ? (
          <p
            id="care-plan-patient-plan-approve-unavailable"
            data-testid="care-plan-patient-plan-approve-unavailable"
            className={styles.contactWarning}
          >
            {remainingGaps.length > 0
              ? `This copy cannot be approved while ${remainingGaps.length} ${remainingGaps.length === 1 ? "section" : "sections"} still ${remainingGaps.length === 1 ? "needs" : "need"} writing: ${remainingGaps.map((section) => section.heading).join("; ")}.`
              : approveBlockedReason}
          </p>
        ) : null}
      </form>
    </section>
  );
}
