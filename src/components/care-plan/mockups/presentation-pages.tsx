"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { EmptyState, InlineNotice, ignoreUnavailableActivation } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import {
  PRESENTATION_ACTIVITY_WINDOW_MONTHS,
  buildPatientSnapshot,
  canPerformAction,
  getEffectivePresentationValue,
  getPresentationAmendments,
  getRecordedPresentationValue,
} from "./domain";
import { PROTOTYPE_NOW } from "./fixtures";
import { PatientNavigation } from "./patient-navigation";
import {
  AMENDABLE_FIELD_LABEL,
  DISPOSITION_OPTIONS,
  PLAN_AVAILABILITY_OPTIONS,
  PLAN_HELPFULNESS_OPTIONS,
  PLAN_USE_OPTIONS,
  PresentationTimeline,
  cmhtContactSummary,
  correctionCountLabel,
  linkedPlanLabel,
  presentationAnswerDisplay,
  siteName,
} from "./presentation-timeline";
import { useCarePlanPrototype } from "./prototype-provider";
import { getPrototypeMutationBlockReason } from "./prototype-state";
import {
  DefinitionRow,
  NOT_RECORDED,
  PROTOTYPE_OUTCOME_TONE,
  PlanTextArea,
  SectionFrame,
  SyntheticMarker,
  formatPerthDate,
  formatPerthDateTime,
} from "./prototype-ui";
import { carePlanRoute } from "./routes";
import type {
  AmendableField,
  CarePlanPrototypeState,
  EdPresentation,
  Patient,
  PrototypeScenario,
  SyntheticId,
} from "./types";

/**
 * The two reading surfaces for ED Presentations: the longitudinal timeline for
 * one patient, and one episode with its corrections.
 *
 * Both are read-only accounts of what was recorded. The timeline states
 * objective counts over a named window and offers two filters; it offers no
 * ranking, no eligibility, no severity, and no sort by how often a person
 * attends. An episode is append-only: a correction is shown beside the value
 * first recorded, attributed and dated, and never in place of it.
 */

const AMENDABLE_FIELDS = Object.keys(AMENDABLE_FIELD_LABEL) as readonly AmendableField[];

const ALL_SITES = "";
const ALL_DISPOSITIONS = "";

function IdentityBand({ patient }: { patient: Patient }) {
  return (
    <div data-testid="care-plan-presentation-identity" className={styles.identityBand}>
      <SyntheticMarker />
      <h2 className={styles.patientName}>{patient.fullName}</h2>
      <dl className={styles.definitionGrid}>
        <DefinitionRow term="MRN">{patient.mrn}</DefinitionRow>
        <DefinitionRow term="Date of birth">{formatPerthDate(patient.dateOfBirth)}</DefinitionRow>
      </dl>
      <PatientNavigation patientId={patient.id} activeSection="presentations" />
    </div>
  );
}

function IdentityUncertain() {
  return (
    <p role="alert" data-testid="care-plan-identity-uncertain" className={styles.identityUncertain}>
      <strong>This record has not been confirmed as the right person.</strong> No episode is shown, because showing a
      nearby person&rsquo;s record would be worse than showing none. Return to search and choose the record again.
    </p>
  );
}

// --- The timeline -------------------------------------------------------------

export function PresentationTimelineSurface({
  patientId,
  scenario,
}: {
  patientId: string | null;
  scenario: PrototypeScenario;
}) {
  const { state } = useCarePlanPrototype();
  const [siteFilter, setSiteFilter] = useState(ALL_SITES);
  const [dispositionFilter, setDispositionFilter] = useState(ALL_DISPOSITIONS);

  const snapshot = patientId === null ? null : buildPatientSnapshot(state, patientId as SyntheticId, PROTOTYPE_NOW);

  const visible = useMemo(() => {
    const presentations = snapshot?.presentations ?? [];
    return presentations.filter(
      (presentation) =>
        (siteFilter === ALL_SITES || presentation.siteId === siteFilter) &&
        (dispositionFilter === ALL_DISPOSITIONS || presentation.disposition === dispositionFilter),
    );
  }, [snapshot?.presentations, siteFilter, dispositionFilter]);

  if (snapshot === null) {
    return (
      <EmptyState
        testId="care-plan-presentation-no-patient"
        title="No patient is open."
        body="Open a synthetic patient from Home or Patients, then choose ED Presentations."
      />
    );
  }

  const { patient, presentationActivity } = snapshot;

  if (scenario === "identity-uncertain") {
    return (
      <section aria-label={`${patient.fullName} ED Presentations`} className={styles.workspace}>
        <IdentityUncertain />
      </section>
    );
  }

  return (
    <section aria-label={`${patient.fullName} ED Presentations`} className={styles.workspace}>
      <IdentityBand patient={patient} />

      <SectionFrame
        id="care-plan-presentation-activity"
        heading="Presentation activity"
        testId="care-plan-presentation-activity"
        actions={
          <Link href={carePlanRoute.newPresentation(patient.id)} className={styles.timelineRecordLink}>
            Record ED presentation
          </Link>
        }
      >
        <p className={styles.sectionDescription}>
          {`${presentationActivity.total} ED Presentations recorded in the ${PRESENTATION_ACTIVITY_WINDOW_MONTHS} months to ${formatPerthDate(presentationActivity.windowEnd)}.`}
        </p>
        <ul className={styles.contentList}>
          {presentationActivity.bySite.length === 0 ? (
            <li>{`No ED Presentation was recorded in that window. ${snapshot.presentations.length} older episodes are listed below.`}</li>
          ) : (
            presentationActivity.bySite.map(({ siteId, count }) => (
              <li key={siteId}>{`${siteName(state.edSites, siteId)}: ${count}`}</li>
            ))
          )}
        </ul>
        {/*
          The whole point of the sentence. Counts are an observation about a
          service, not a fact about a person: nothing here creates eligibility, a
          label, a severity claim, a risk state, or a care pathway, and nothing
          on this screen ranks people by how often they attend.
        */}
        <p className={styles.sectionDescription}>
          Counts describe what happened. They decide nothing: no threshold, no eligibility, and no plan follows from a
          number on this screen.
        </p>
      </SectionFrame>

      <SectionFrame
        id="care-plan-presentation-list"
        heading="ED Presentation timeline"
        description="Newest first. Every episode as it was recorded, with any correction shown beside it."
      >
        <div className={styles.formGrid}>
          <Select
            id="care-plan-presentation-filter-site"
            label="Emergency department"
            value={siteFilter}
            onChange={(event) => setSiteFilter(event.target.value)}
            options={[
              { value: ALL_SITES, label: "All emergency departments" },
              ...state.edSites.map((site) => ({ value: site.id, label: site.name })),
            ]}
          />
          <Select
            id="care-plan-presentation-filter-disposition"
            label="Disposition"
            value={dispositionFilter}
            onChange={(event) => setDispositionFilter(event.target.value)}
            options={[{ value: ALL_DISPOSITIONS, label: "All dispositions" }, ...DISPOSITION_OPTIONS]}
          />
        </div>

        {visible.length === 0 ? (
          <p data-testid="care-plan-presentation-none-matching" className={styles.sectionEmpty}>
            No recorded ED Presentation matches those filters. Nothing has been hidden from the record; widen a filter
            to see the rest.
          </p>
        ) : (
          <PresentationTimeline
            patientId={patient.id}
            presentations={visible}
            amendments={state.presentationAmendments}
            sites={state.edSites}
            versions={state.managementPlanVersions}
          />
        )}
      </SectionFrame>
    </section>
  );
}

// --- One episode and its corrections ------------------------------------------

/** The identifier the address names, taken from the path rather than from a
 *  fixture list, so an episode recorded in this session resolves too. */
export function presentationIdFromPathname(pathname: string): string | null {
  const segments = (pathname.split("?")[0] ?? pathname).split("/").filter(Boolean);
  const index = segments.lastIndexOf("presentations");
  if (index === -1) return null;
  const candidate = segments[index + 1];
  return candidate === undefined || candidate === "new" ? null : candidate;
}

function AmendableRow({
  state,
  presentation,
  field,
}: {
  state: CarePlanPrototypeState;
  presentation: EdPresentation;
  field: AmendableField;
}) {
  const corrections = getPresentationAmendments(state.presentationAmendments, presentation.id, field);
  const recordedValue = getRecordedPresentationValue(state.presentationAmendments, presentation, field);

  if (corrections.length === 0) {
    return (
      <DefinitionRow term={AMENDABLE_FIELD_LABEL[field]}>
        {presentationAnswerDisplay(field, recordedValue) === NOT_RECORDED
          ? undefined
          : presentationAnswerDisplay(field, recordedValue)}
      </DefinitionRow>
    );
  }

  return (
    <DefinitionRow term={AMENDABLE_FIELD_LABEL[field]}>
      {/*
        The value first recorded stays on screen. A correction is appended beside
        it, never over it: an episode nobody can read as it was written is not an
        append-only record, whatever the data underneath is doing.
      */}
      <span className={styles.amendedOriginal}>{`Recorded as ${presentationAnswerDisplay(field, recordedValue)}`}</span>
      {corrections.map((correction) => (
        <span key={correction.id} className={styles.amendedReplacement}>
          {`Corrected to ${presentationAnswerDisplay(field, correction.replacementValue)} on ${formatPerthDate(correction.amendedAt)}`}
        </span>
      ))}
    </DefinitionRow>
  );
}

export function PresentationDetailSurface({
  patientId,
  presentationId,
  scenario,
}: {
  patientId: string | null;
  presentationId: string | null;
  scenario: PrototypeScenario;
}) {
  const { state, dispatch } = useCarePlanPrototype();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Record<AmendableField, string> | null>(null);
  const [reason, setReason] = useState("");
  const [amendmentError, setAmendmentError] = useState<string | null>(null);

  const snapshot = patientId === null ? null : buildPatientSnapshot(state, patientId as SyntheticId, PROTOTYPE_NOW);
  const presentation =
    presentationId === null ? null : (state.edPresentations.find(({ id }) => id === presentationId) ?? null);

  if (snapshot === null) {
    return (
      <EmptyState
        testId="care-plan-presentation-no-patient"
        title="No patient is open."
        body="Open a synthetic patient from Home or Patients, then choose ED Presentations."
      />
    );
  }

  const { patient } = snapshot;

  if (scenario === "identity-uncertain") {
    return (
      <section aria-label={`${patient.fullName} ED Presentation`} className={styles.workspace}>
        <IdentityUncertain />
      </section>
    );
  }

  if (presentation === null) {
    return (
      <section aria-label={`${patient.fullName} ED Presentation`} className={styles.workspace}>
        <IdentityBand patient={patient} />
        <SectionFrame id="care-plan-presentation-unknown" heading="No such ED Presentation" tone="boundary">
          <p data-testid="care-plan-presentation-unknown" className={styles.sectionDescription}>
            No ED Presentation with that identifier exists in this synthetic session. This prototype keeps everything in
            memory, so reloading the page starts over and any episode recorded since then is gone.
          </p>
          <p className={styles.planFooterLink}>
            <Link href={carePlanRoute.presentations(patient.id)} className={styles.inlineLink}>
              Back to the ED Presentation timeline
            </Link>
          </p>
        </SectionFrame>
      </section>
    );
  }

  /*
   * An episode belongs to exactly one patient. A real episode identifier under
   * the wrong patient is the shape of a record-mix-up, and the answer to a
   * record-mix-up is never to show the nearest match: it is to say plainly that
   * this is not that person's episode and show nothing at all.
   */
  if (presentation.patientId !== patient.id) {
    return (
      <section aria-label={`${patient.fullName} ED Presentation`} className={styles.workspace}>
        <IdentityBand patient={patient} />
        <p role="alert" data-testid="care-plan-presentation-identity-uncertain" className={styles.identityUncertain}>
          <strong>This ED Presentation does not belong to the patient named in this address.</strong> Nothing about the
          episode is shown, because showing another person&rsquo;s episode would be worse than showing none. Return to
          the timeline and choose the episode again.
        </p>
        <p className={styles.planFooterLink}>
          <Link href={carePlanRoute.presentations(patient.id)} className={styles.inlineLink}>
            Back to the ED Presentation timeline
          </Link>
        </p>
      </section>
    );
  }

  const corrections = getPresentationAmendments(state.presentationAmendments, presentation.id);
  const trigger = state.reviewTriggers.find((candidate) => candidate.sourceId === presentation.id) ?? null;
  const recorder = state.users.find(({ id }) => id === presentation.recordedBy) ?? null;
  const actor = state.users.find((user) => user.id === state.activeUserId) ?? null;
  const mayAmend = actor !== null && canPerformAction(actor.role, "record_presentation");
  const amendBlockedReason = getPrototypeMutationBlockReason(state, {
    type: "amend-presentation",
    presentationId: presentation.id,
    field: "note",
    replacementValue: presentation.note,
    reason: "",
  });

  const effectiveValues = Object.fromEntries(
    AMENDABLE_FIELDS.map((field) => [
      field,
      getEffectivePresentationValue(state.presentationAmendments, presentation, field),
    ]),
  ) as Record<AmendableField, string>;

  function openAmendmentSheet() {
    setDraft(effectiveValues);
    setReason("");
    setAmendmentError(null);
    setSheetOpen(true);
  }

  function amendmentFieldId(field: AmendableField | "reason"): string {
    return `care-plan-amendment-${field}`;
  }

  /**
   * Every control in the sheet states the value it is correcting, and states the
   * value the field currently reads whenever a correction has already moved it.
   * Correcting an answer you cannot see is how a correction becomes a second
   * mistake.
   */
  function recordedHintFor(field: AmendableField): string {
    if (presentation === null) return "";
    const recordedValue = presentationAnswerDisplay(
      field,
      getRecordedPresentationValue(state.presentationAmendments, presentation, field),
    );
    const currentValue = presentationAnswerDisplay(field, effectiveValues[field]);
    return recordedValue === currentValue
      ? `Recorded as ${recordedValue}.`
      : `Recorded as ${recordedValue}. Already corrected to ${currentValue}.`;
  }

  function recordCorrection() {
    if (draft === null || presentation === null) return;
    if (reason.trim() === "") {
      setAmendmentError(
        "A correction needs a reason, so a later reader can see why the record changed. Nothing was changed.",
      );
      return;
    }
    const changed = AMENDABLE_FIELDS.filter((field) => draft[field] !== effectiveValues[field]);
    if (changed.length === 0) {
      setAmendmentError("Change at least one answer before recording a correction. Nothing was changed.");
      return;
    }
    // One amendment per changed answer, all under the one reason. The three
    // plan-use answers are asked as a group and corrected as a group, but the
    // evidence stored is still exactly one field per record.
    for (const field of changed) {
      dispatch({
        type: "amend-presentation",
        presentationId: presentation.id,
        field,
        replacementValue: draft[field],
        reason: reason.trim(),
      });
    }
    setSheetOpen(false);
    setAmendmentError(null);
  }

  return (
    <section aria-label={`${patient.fullName} ED Presentation`} className={styles.workspace}>
      <IdentityBand patient={patient} />

      {state.lastOutcome === null ? null : (
        <div data-testid="care-plan-presentation-outcome">
          <InlineNotice tone={PROTOTYPE_OUTCOME_TONE[state.lastOutcome.kind]}>{state.lastOutcome.message}</InlineNotice>
        </div>
      )}

      <SectionFrame
        id="care-plan-presentation-episode"
        heading="Recorded episode"
        testId="care-plan-presentation-episode"
        description="This record is append-only. Nothing below is ever rewritten; a correction is added beside it."
        actions={
          mayAmend ? (
            <Button
              variant="secondary"
              aria-disabled={amendBlockedReason === null ? undefined : true}
              aria-describedby={amendBlockedReason === null ? undefined : "care-plan-presentation-amend-blocked"}
              onClick={amendBlockedReason === null ? openAmendmentSheet : ignoreUnavailableActivation}
            >
              Amend recorded outcome
            </Button>
          ) : undefined
        }
      >
        {amendBlockedReason === null ? null : (
          <p
            id="care-plan-presentation-amend-blocked"
            role="alert"
            data-testid="care-plan-presentation-amend-blocked"
            className={styles.contactWarning}
          >
            {amendBlockedReason}
          </p>
        )}
        <dl className={styles.definitionGrid}>
          <DefinitionRow term="Arrived">{formatPerthDateTime(presentation.arrivedAt)}</DefinitionRow>
          <DefinitionRow term="Emergency department">{siteName(state.edSites, presentation.siteId)}</DefinitionRow>
          <DefinitionRow term="Presenting indication">
            {presentation.presentingIndication.trim() === "" ? undefined : presentation.presentingIndication}
          </DefinitionRow>
          <AmendableRow state={state} presentation={presentation} field="assessmentOutcome" />
          <AmendableRow state={state} presentation={presentation} field="note" />
          <AmendableRow state={state} presentation={presentation} field="disposition" />
          <DefinitionRow term="Plan available at the time">
            {linkedPlanLabel(presentation.managementPlanVersionId, state.managementPlanVersions)}
          </DefinitionRow>
          <AmendableRow state={state} presentation={presentation} field="planAvailability" />
          <AmendableRow state={state} presentation={presentation} field="planUse" />
          <AmendableRow state={state} presentation={presentation} field="planHelpfulness" />
          <DefinitionRow term="Community mental health team">{cmhtContactSummary(presentation)}</DefinitionRow>
          <DefinitionRow term="Agreed approach">
            {presentation.deviationOccurred
              ? `Could not be followed — ${presentation.deviationReason ?? NOT_RECORDED}`
              : "No deviation recorded"}
          </DefinitionRow>
          <DefinitionRow term="Why the team should look again">
            {presentation.reviewSuggested && presentation.reviewReason !== null
              ? presentation.reviewReason
              : "Not suggested for this episode"}
          </DefinitionRow>
        </dl>
        <p data-testid="care-plan-presentation-attribution" className={styles.sectionDescription}>
          {`Recorded by ${recorder?.displayName ?? "an unrecorded clinician"} on ${formatPerthDateTime(presentation.recordedAt)}. ${correctionCountLabel(corrections.length)}.`}
        </p>
      </SectionFrame>

      {trigger === null ? null : (
        <SectionFrame
          id="care-plan-presentation-trigger"
          heading="Review Suggested"
          tone="secondary"
          testId="care-plan-presentation-trigger"
        >
          <p className={styles.sectionDescription}>{trigger.reason}</p>
          <p className={styles.sectionDescription}>
            {trigger.status === "open"
              ? "This is open in the Reviews queue. It asks the team to look at the plan; it has changed nothing."
              : `Closed. ${trigger.resolution ?? "No resolution was recorded."}`}
          </p>
        </SectionFrame>
      )}

      <SectionFrame
        id="care-plan-presentation-amendments"
        heading="Corrections"
        testId="care-plan-presentation-amendments"
        description="Every correction ever made to this episode, with who made it, when, what it replaced, and why."
      >
        {corrections.length === 0 ? (
          <p className={styles.sectionEmpty}>No corrections recorded for this ED Presentation.</p>
        ) : (
          <ol className={styles.amendmentList}>
            {corrections.map((correction) => (
              <li key={correction.id} className={styles.amendmentEntry}>
                <p className={styles.amendmentHeading}>{AMENDABLE_FIELD_LABEL[correction.field]}</p>
                <p className={styles.amendmentChange}>
                  {`Recorded as ${presentationAnswerDisplay(correction.field, correction.originalValue)}. Corrected to ${presentationAnswerDisplay(correction.field, correction.replacementValue)}.`}
                </p>
                <p className={styles.amendmentReason}>{correction.reason}</p>
                <p className={styles.amendmentAttribution}>
                  {`${state.users.find(({ id }) => id === correction.authorId)?.displayName ?? "An unrecorded clinician"} — ${formatPerthDateTime(correction.amendedAt)}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </SectionFrame>

      {/*
        Rendered in-tree rather than portalled. Every Care Plan stylesheet
        selector is scoped below `.appRoot` — that is what stops this prototype's
        CSS reaching a surface outside it — so a portalled sheet would render its
        fields with none of that styling, and the multi-line controls in
        particular would collapse to the shared one-line field height. This is
        the case `portal={false}` exists for.
      */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Correct this ED Presentation"
        description="The episode is never rewritten. Each answer you change is appended beside it, attributed and dated, under the one reason you give."
        testId="care-plan-amendment-sheet"
        portal={false}
        footer={
          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={() => setSheetOpen(false)}>
              Keep the record as it is
            </Button>
            <Button variant="primary" onClick={recordCorrection}>
              Record correction
            </Button>
          </div>
        }
      >
        {draft === null ? null : (
          <div className={styles.amendmentForm}>
            {amendmentError === null ? null : (
              <p role="alert" data-testid="care-plan-amendment-error" className={styles.contactWarning}>
                {amendmentError}
              </p>
            )}

            <Select
              id={amendmentFieldId("disposition")}
              label={AMENDABLE_FIELD_LABEL.disposition}
              hint={recordedHintFor("disposition")}
              value={draft.disposition}
              onChange={(event) => setDraft({ ...draft, disposition: event.target.value })}
              options={DISPOSITION_OPTIONS}
            />

            {/* Asked as one group, because a clinician correcting one of these is
                usually correcting the picture all three describe. */}
            <fieldset className={styles.amendmentGroup}>
              <legend className={styles.amendmentGroupLegend}>Plan-use feedback</legend>
              <Select
                id={amendmentFieldId("planAvailability")}
                label={AMENDABLE_FIELD_LABEL.planAvailability}
                hint={recordedHintFor("planAvailability")}
                value={draft.planAvailability}
                onChange={(event) => setDraft({ ...draft, planAvailability: event.target.value })}
                options={PLAN_AVAILABILITY_OPTIONS}
              />
              <Select
                id={amendmentFieldId("planUse")}
                label={AMENDABLE_FIELD_LABEL.planUse}
                hint={recordedHintFor("planUse")}
                value={draft.planUse}
                onChange={(event) => setDraft({ ...draft, planUse: event.target.value })}
                options={PLAN_USE_OPTIONS}
              />
              <Select
                id={amendmentFieldId("planHelpfulness")}
                label={AMENDABLE_FIELD_LABEL.planHelpfulness}
                hint={recordedHintFor("planHelpfulness")}
                value={draft.planHelpfulness}
                onChange={(event) => setDraft({ ...draft, planHelpfulness: event.target.value })}
                options={PLAN_HELPFULNESS_OPTIONS}
              />
            </fieldset>

            <PlanTextArea
              id={amendmentFieldId("assessmentOutcome")}
              label={AMENDABLE_FIELD_LABEL.assessmentOutcome}
              rows={2}
              hint={recordedHintFor("assessmentOutcome")}
              value={draft.assessmentOutcome}
              onChange={(text) => setDraft({ ...draft, assessmentOutcome: text })}
            />
            <PlanTextArea
              id={amendmentFieldId("note")}
              label={AMENDABLE_FIELD_LABEL.note}
              rows={2}
              hint={recordedHintFor("note")}
              value={draft.note}
              onChange={(text) => setDraft({ ...draft, note: text })}
            />
            <PlanTextArea
              id={amendmentFieldId("reason")}
              label="Why is this being corrected?"
              required
              rows={3}
              hint="One reason covers every answer you changed here. It is attached to each correction."
              value={reason}
              onChange={setReason}
            />
          </div>
        )}
      </Sheet>
    </section>
  );
}
