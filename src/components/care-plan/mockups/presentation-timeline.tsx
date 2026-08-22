"use client";

import Link from "next/link";

import styles from "./care-plan.module.css";
import { getEffectivePresentationValue, getPresentationAmendments } from "./domain";
import { DefinitionRow, MANAGEMENT_VERSION_STATE_LABEL, NOT_RECORDED, formatPerthDateTime } from "./prototype-ui";
import { carePlanRoute } from "./routes";
import type {
  AmendableField,
  Disposition,
  EdPresentation,
  EdSite,
  ManagementPlanVersion,
  PlanAvailability,
  PlanHelpfulness,
  PlanUse,
  PresentationAmendment,
  SyntheticId,
} from "./types";

/**
 * The longitudinal ED Presentation timeline, and the display vocabulary the
 * three episode surfaces share.
 *
 * The visual treatment is a line with a node against each episode. The line and
 * the nodes are decoration: everything they suggest — that these are episodes in
 * time, in order, one after another — is carried by an ordered list of headed
 * entries, each stating its own facts as labelled pairs. A reader who never sees
 * the line loses nothing, which is the only arrangement dense clinical data may
 * be shown in.
 *
 * Nothing here ranks, scores, or labels a person, and nothing offers to order
 * people by how often they attend. That ordering belongs to the Identification
 * Review workflow, which is the one screen with a stated and governed reason
 * for it.
 */

export const DISPOSITION_LABEL: Record<Disposition, string> = {
  discharged_home: "Discharged home",
  short_stay: "Short stay",
  mental_health_admission: "Mental health admission",
  medical_admission: "Medical admission",
  transfer: "Transfer",
  left_before_completion: "Left before assessment was complete",
  other: "Other",
};

export const PLAN_AVAILABILITY_LABEL: Record<PlanAvailability, string> = {
  available: "Available",
  unavailable: "Not available",
  not_applicable: "Not applicable",
};

export const PLAN_USE_LABEL: Record<PlanUse, string> = {
  used: "Used",
  partially_used: "Partly used",
  not_used: "Not used",
  not_applicable: "Not applicable",
};

export const PLAN_HELPFULNESS_LABEL: Record<PlanHelpfulness, string> = {
  helpful: "Helpful",
  mixed: "Helped in part",
  not_helpful: "Did not help",
  not_assessed: "Not assessed",
};

export const CMHT_CONTACT_ATTEMPT_LABEL: Record<EdPresentation["cmhtContactAttempt"], string> = {
  not_attempted: "Not attempted",
  attempted: "Attempted",
};

/**
 * The label each amendable field wears wherever it is shown. One record, so the
 * recording form, the timeline, the episode, and the correction sheet cannot
 * call the same field four different things.
 */
export const AMENDABLE_FIELD_LABEL: Record<AmendableField, string> = {
  assessmentOutcome: "Assessment outcome",
  disposition: "Disposition",
  note: "In one line: why they came and what happened",
  planAvailability: "Was the Current Plan available?",
  planUse: "Was the Current Plan used?",
  planHelpfulness: "Was the plan helpful?",
};

/** The two labels that are not one amendable field but are still repeated across
 *  surfaces, and so are still written down exactly once. */
export const PRESENTING_INDICATION_LABEL = "Presenting indication";
export const REVIEW_REASON_TERM = "Why the team should look again";

export const AMENDABLE_FIELDS = Object.keys(AMENDABLE_FIELD_LABEL) as readonly AmendableField[];

/** Options are read back off the label records, so a seventh disposition cannot
 *  appear in the domain without appearing in every control that offers one. */
function optionsFrom<Key extends string>(labels: Record<Key, string>): { value: Key; label: string }[] {
  return (Object.keys(labels) as Key[]).map((value) => ({ value, label: labels[value] }));
}

export const DISPOSITION_OPTIONS = optionsFrom(DISPOSITION_LABEL);
export const PLAN_AVAILABILITY_OPTIONS = optionsFrom(PLAN_AVAILABILITY_LABEL);
export const PLAN_USE_OPTIONS = optionsFrom(PLAN_USE_LABEL);
export const PLAN_HELPFULNESS_OPTIONS = optionsFrom(PLAN_HELPFULNESS_LABEL);

/**
 * A stored answer rendered for a reader. Amendments carry their values as plain
 * strings, so a corrected disposition arrives here as `short_stay` and must not
 * be printed at a clinician in that form.
 */
export function presentationAnswerDisplay(field: AmendableField, value: string): string {
  const labels: Partial<Record<AmendableField, Record<string, string>>> = {
    disposition: DISPOSITION_LABEL,
    planAvailability: PLAN_AVAILABILITY_LABEL,
    planUse: PLAN_USE_LABEL,
    planHelpfulness: PLAN_HELPFULNESS_LABEL,
  };
  const mapped = labels[field]?.[value];
  if (mapped !== undefined) return mapped;
  return value.trim() === "" ? NOT_RECORDED : value;
}

/** Never `No Current Plan`: a plan that was withdrawn or superseded by the time
 *  the episode is read still says which version the clinician actually had. */
export function linkedPlanLabel(versionId: SyntheticId | null, versions: readonly ManagementPlanVersion[]): string {
  if (versionId === null) return "No Current Plan was available";
  const version = versions.find(({ id }) => id === versionId) ?? null;
  if (version === null) return "No Current Plan was available";
  return version.state === "current"
    ? `Current version ${version.version}`
    : `${MANAGEMENT_VERSION_STATE_LABEL[version.state]} version ${version.version}`;
}

export function siteName(sites: readonly EdSite[], siteId: SyntheticId): string {
  return sites.find(({ id }) => id === siteId)?.name ?? NOT_RECORDED;
}

export function planUseSummary(presentation: EdPresentation): string {
  return [
    PLAN_AVAILABILITY_LABEL[presentation.planAvailability],
    PLAN_USE_LABEL[presentation.planUse],
    PLAN_HELPFULNESS_LABEL[presentation.planHelpfulness],
  ].join(" · ");
}

export function cmhtContactSummary(presentation: EdPresentation): string {
  const attempt = CMHT_CONTACT_ATTEMPT_LABEL[presentation.cmhtContactAttempt];
  const outcome = presentation.cmhtContactOutcome.trim();
  return outcome === "" ? attempt : `${attempt} — ${outcome}`;
}

/** Stated on every episode, present or absent, so a reader can tell an episode
 *  nobody has corrected from one whose corrections were not shown. */
export function correctionCountLabel(count: number): string {
  if (count === 0) return "No corrections recorded";
  return count === 1 ? "1 correction recorded" : `${count} corrections recorded`;
}

/**
 * A count on its own says a correction exists but not which answer moved, which
 * leaves a reader unable to tell a corrected timeline entry from an uncorrected
 * one without opening it. This names the fields, once each, in field order.
 */
export function correctionSummaryLabel(corrections: readonly PresentationAmendment[]): string {
  if (corrections.length === 0) return correctionCountLabel(0);
  const fields = AMENDABLE_FIELDS.filter((field) => corrections.some((correction) => correction.field === field)).map(
    (field) => AMENDABLE_FIELD_LABEL[field],
  );
  return `${correctionCountLabel(corrections.length)} — ${fields.join("; ")}`;
}

/**
 * The episode as it reads now: the stored record with every corrected field
 * replaced by its latest correction.
 *
 * The episode page shows the value first recorded beside each correction,
 * because that is where the full history belongs. A timeline entry has no room
 * for that and would otherwise show only pre-correction values with a bare "1
 * correction recorded" beside them — the one arrangement that is actively
 * misleading, because it reads as current and is not. So the timeline shows what
 * the record says today and names which answers moved.
 *
 * The cast is safe because the reducer validates an enum replacement against the
 * recorded answers for that field before it appends the correction; a value that
 * is not one of them never reaches the state.
 */
export function effectivePresentation(
  presentation: EdPresentation,
  amendments: readonly PresentationAmendment[],
): EdPresentation {
  const corrections = getPresentationAmendments(amendments, presentation.id);
  if (corrections.length === 0) return presentation;
  const corrected = Object.fromEntries(
    AMENDABLE_FIELDS.map((field) => [field, getEffectivePresentationValue(amendments, presentation, field)]),
  );
  return { ...presentation, ...corrected } as EdPresentation;
}

export type PresentationTimelineProps = {
  patientId: string;
  /** Already filtered and ordered by the caller; rendered exactly as given. */
  presentations: readonly EdPresentation[];
  amendments: readonly PresentationAmendment[];
  sites: readonly EdSite[];
  versions: readonly ManagementPlanVersion[];
};

export function PresentationTimeline({
  patientId,
  presentations,
  amendments,
  sites,
  versions,
}: PresentationTimelineProps) {
  return (
    <ol data-testid="care-plan-presentation-timeline" className={styles.timeline}>
      {presentations.map((recorded) => {
        const corrections = getPresentationAmendments(amendments, recorded.id);
        // What the record says today. The episode page carries the full history
        // beside each value; a timeline entry states the current answer and names
        // which ones moved.
        const presentation = effectivePresentation(recorded, amendments);
        return (
          <li key={presentation.id} className={styles.timelineEntry}>
            {/* Decoration only. Every fact it implies is in the entry beside it. */}
            <span aria-hidden="true" className={styles.timelineNode} />
            <div className={styles.timelineBody}>
              <p data-testid="care-plan-presentation-arrival" className={styles.timelineArrival}>
                {formatPerthDateTime(presentation.arrivedAt)}
              </p>
              <p className={styles.timelineSite}>{siteName(sites, presentation.siteId)}</p>
              <dl className={styles.definitionGrid}>
                <DefinitionRow term={AMENDABLE_FIELD_LABEL.note}>
                  {presentation.note.trim() === "" ? undefined : presentation.note}
                </DefinitionRow>
                <DefinitionRow term={PRESENTING_INDICATION_LABEL}>
                  {presentation.presentingIndication.trim() === "" ? undefined : presentation.presentingIndication}
                </DefinitionRow>
                <DefinitionRow term={AMENDABLE_FIELD_LABEL.assessmentOutcome}>
                  {presentation.assessmentOutcome.trim() === "" ? undefined : presentation.assessmentOutcome}
                </DefinitionRow>
                <DefinitionRow term={AMENDABLE_FIELD_LABEL.disposition}>
                  {DISPOSITION_LABEL[presentation.disposition]}
                </DefinitionRow>
                <DefinitionRow term="Plan available at the time">
                  {linkedPlanLabel(presentation.managementPlanVersionId, versions)}
                </DefinitionRow>
                <DefinitionRow term="Plan-use feedback">{planUseSummary(presentation)}</DefinitionRow>
                <DefinitionRow term="Community mental health team">{cmhtContactSummary(presentation)}</DefinitionRow>
                <DefinitionRow term={REVIEW_REASON_TERM}>
                  {presentation.reviewSuggested && presentation.reviewReason !== null
                    ? presentation.reviewReason
                    : "Not suggested for this episode"}
                </DefinitionRow>
                <DefinitionRow term="Corrections">{correctionSummaryLabel(corrections)}</DefinitionRow>
              </dl>
              <Link href={carePlanRoute.presentation(patientId, presentation.id)} className={styles.timelineLink}>
                Open this ED Presentation
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
