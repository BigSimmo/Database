"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { FormField } from "@/components/ui/form-field";
import { cn, fieldControlPlain, semanticChipTone, type SemanticChipTone } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import { PARTICIPATION_MARKER_STATES } from "./domain";
import { SYNTHETIC_DATA_MARKER } from "./fixtures";
import {
  FIRST_MINUTE_CONTENT_KEYS,
  type ManagementPlanContent,
  type ManagementPlanVersion,
  type ParticipationState,
  type PatientConfirmationState,
  type PrototypeOutcome,
  type PrototypeRole,
  type ReviewState,
  type SafetyPlanContent,
} from "./types";

/**
 * Care Plan-specific compositions of the shared repository primitives. Nothing
 * here recreates a button, field, tab, dialog or sheet: those come from
 * `@/components/ui/*`. What lives here is the small vocabulary the clinical
 * surfaces repeat — a status mark, a labelled fact, a titled region, the
 * synthetic marker, the review warning, the pinned safety boundary, and the
 * Current Plan summary card itself.
 *
 * Nothing in this file reads a clock, a network, storage, or a random source.
 */

/**
 * Stated on every view of a plan. A continuity document that does not say this
 * can be read as a substitute for assessing the person in front of you, which is
 * the single most consequential way a plan like this causes harm.
 */
export const PLAN_CONTINUITY_BOUNDARY =
  "This plan supports continuity. It never replaces fresh triage, physical assessment, mental-state assessment, immediate risk assessment, clinical judgement, or legal obligations.";

/** The five first-minute headings, in the one approved order. */
export const FIRST_MINUTE_SECTION_LABEL: Record<(typeof FIRST_MINUTE_CONTENT_KEYS)[number], string> = {
  howToApproach: "How to approach this person",
  whatHelps: "What helps",
  whatMakesItWorse: "What makes it worse",
  agreedEdApproach: "What we have agreed to do",
  whatWouldMakeThisDifferent: "What would make this presentation different",
};

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
 *
 * It lives here rather than on the reading surface because three surfaces now
 * need it: the reading tier, the drafting form, and the change table.
 */
export type FullPlanContentKey = Exclude<
  keyof ManagementPlanContent,
  (typeof FIRST_MINUTE_CONTENT_KEYS)[number] | "whyThisPlanExists"
>;

/** Headings, in the one approved order; the order of this literal is the order
 *  the tier renders, because the keys are read back from it. */
export const FULL_PLAN_SECTION_LABEL: Record<FullPlanContentKey, string> = {
  whatThePersonWants: "What this person wants",
  practicalNeeds: "Practical needs",
  physicalHealthAndMedication: "Physical health and medication",
  whoElseIsInvolved: "Who else is involved",
  reviewTriggers: "What should prompt a review",
};

export const FULL_PLAN_SECTION_KEYS = Object.keys(FULL_PLAN_SECTION_LABEL) as readonly FullPlanContentKey[];

/** The heading of the one required full-plan field, which the tier renders in
 *  its own right above the five optional ones. */
export const WHY_THIS_PLAN_EXISTS_LABEL = "Why this plan exists";

/**
 * The seven headings of the Personal Safety Plan, in the one approved order, in
 * the person's own voice. This is the patient's document, so every heading is
 * written as the person would say it — never as a clinical field name.
 *
 * Keyed by `SafetyPlanContent` rather than transcribed into a list. Because the
 * record is exhaustive over the content type, an eighth section cannot be added
 * by hand without a heading, a renamed key stops the file compiling, and every
 * surface generates its sections by iterating these keys rather than by copying
 * the list out again — which is how the fifth Management Plan section came to be
 * generated for exactly the same reason.
 */
export const SAFETY_PLAN_SECTION_LABEL: Record<keyof SafetyPlanContent, string> = {
  warningSigns: "My warning signs",
  saferSurroundings: "Making my surroundings safer",
  reasonsForLiving: "My reasons for living",
  selfStrategies: "Things I can do myself",
  connectionPeopleAndPlaces: "People and places that help me feel connected",
  personalSupports: "Family, friends, and supports I can contact",
  professionalAndEmergencySupport: "Professional and emergency support",
};

/** The order of the literal above is the order every surface renders. */
export const SAFETY_PLAN_SECTION_KEYS = Object.keys(SAFETY_PLAN_SECTION_LABEL) as readonly (keyof SafetyPlanContent)[];

/**
 * The one section that is a list of people rather than a list of lines, so a
 * surface can branch on it without knowing anything else about the shape.
 */
export const SAFETY_PLAN_SUPPORTS_KEY = "personalSupports" as const;

/**
 * How the person's part in this version is described. None of the four is a
 * failure, and none of them is ever rendered as non-compliance: a person who
 * declines has made a decision about their own document, and a person nobody has
 * asked yet is a record with nothing in it, not a person who did something
 * wrong.
 */
export const PATIENT_CONFIRMATION_LABEL: Record<PatientConfirmationState, string> = {
  confirmed: "Confirmed by this person",
  discussed_not_confirmed: "Discussed, not yet confirmed",
  // Deliberately not "chose not to make a safety plan": this label is displayed
  // on a page that *is* a current Personal Safety Plan — one holding the crisis
  // numbers and nothing else — so a label denying the plan exists contradicts
  // the document it sits on. What the person declined is writing their own part.
  declined: "This person chose not to write one in their own words",
  unavailable: "No confirmation recorded",
};

/** The sentence that goes with each, so the mark is never left to be read as a
 *  verdict on the person. */
export const PATIENT_CONFIRMATION_EXPLANATION: Record<PatientConfirmationState, string> = {
  confirmed: "This person has read this version and confirmed that the wording is theirs.",
  discussed_not_confirmed:
    "This person has talked this version through and has not yet confirmed the wording. Ask again at the next contact.",
  declined:
    "This person chose not to write their own part of this plan. That is their decision about their own document, and it is recorded as a decision rather than as a gap.",
  unavailable:
    "Nothing has been recorded about this person's part in this version, so nothing here says whether they have seen it.",
};

/**
 * The one-line Personal Safety Plan status shown beside the link to it, on the
 * Management Plan reading, review, and printed surfaces and on the patient
 * workspace.
 *
 * It names the participation state in words. It used to read
 * `Current version 2, confirmed <date>` taken from `confirmedAt`, which the
 * reducer sets only for a `confirmed` version — so a person who had discussed
 * the plan, or who had declined to write their own part, printed as
 * `confirmed Not recorded`. That sentence cannot tell a reader whether the
 * person did not confirm, or whether they confirmed and the date was lost.
 * Those are different clinical facts: the first is a decision the person made
 * and the record should state it plainly; the second is a hole in the record.
 * Saying `Not recorded` about a state that *was* recorded is the same family of
 * defect as printing `My reasons for living — Not recorded` on a sheet handed
 * to a person.
 *
 * The four labels are the wording already agreed for these states and already
 * shown on the Personal Safety Plan itself, so this asserts nothing new about
 * anybody. A recorded non-confirmation reads as the recorded decision it is,
 * and only `unavailable` — where genuinely nothing was recorded — says nothing
 * was.
 *
 * No date on this line. The date it used to carry was `confirmedAt`, the moment
 * the version went live, which is not a moment the person acted. What the
 * record now holds about the person's part is `participationRecordedAt`, and
 * whether that belongs on this line is a product decision that has not been
 * taken, and the whole-branch review may revisit it. Dropping a date that was
 * wrong loses nothing.
 */
export function safetyPlanStatusLine(
  version: { version: number; patientConfirmation: PatientConfirmationState } | null,
): string {
  if (version === null) return "No current version";
  return `Current version ${version.version} — ${PATIENT_CONFIRMATION_LABEL[version.patientConfirmation]}`;
}

/**
 * The confirmation row on the Personal Safety Plan itself — the reading surface
 * and the sheet the person takes home.
 *
 * Both rows used to read `Last confirmed <formatPerthDate(confirmedAt)>`.
 * `confirmedAt` is set inside `make-safety-plan-current`, at the moment a
 * clinician published the version, which is not a moment the person did
 * anything: a draft can sit unpublished for weeks, and whoever publishes it may
 * not be whoever sat down with them. So a row a reader takes as *the day this
 * person confirmed their plan* was showing the day it went live — on the
 * person's own document. User decision D1 (25 August 2026) chose to record the
 * real moment rather than reuse that one; this applies that decision to the
 * sheet rather than only to History.
 *
 * Two gates, and the second is the load-bearing one:
 *
 * - the moment being present, because a confirmed version whose moment the
 *   record never captured must say so rather than borrow another date;
 * - `patientConfirmation === "confirmed"`, because `participationRecordedAt` is
 *   written for **every** participation state. Gating on the timestamp alone
 *   would print a confirmation line on the sheet of somebody who declined —
 *   a worse defect than the one being fixed, and of exactly the class this
 *   build has spent three tasks removing.
 *
 * The three cases are distinguishable in the rendered words and not only in the
 * code: a dated row, an undated row that says the date is not recorded, and no
 * row at all when the person did not confirm. The last stays absent by the
 * argument already settled for this sheet — a row reading `Not recorded` on a
 * document addressed to the person tells them nothing they can use and reads as
 * a mark against them.
 */
export function safetyPlanConfirmationRow(
  version: { patientConfirmation: PatientConfirmationState; participationRecordedAt: string | null },
  terms: { withDate: string; withoutDate: string },
): { term: string; detail: string } | null {
  if (version.patientConfirmation !== "confirmed") return null;
  if (version.participationRecordedAt === null) {
    return { term: terms.withoutDate, detail: "The date is not recorded" };
  }
  return { term: terms.withDate, detail: formatPerthDate(version.participationRecordedAt) };
}

export const FIRST_MINUTE_SECTION_ID_PREFIX = "care-plan-first-minute";

export function firstMinuteSectionId(key: (typeof FIRST_MINUTE_CONTENT_KEYS)[number]): string {
  return `${FIRST_MINUTE_SECTION_ID_PREFIX}-${key}`;
}

/**
 * Australian date, from the Perth-local ISO strings the fixtures already carry.
 * The date part of a `+08:00` timestamp is already the Perth wall-clock date, so
 * this needs no clock, no locale table, and no timezone library. An unreadable
 * value returns `Not recorded` rather than a plausible-looking wrong date.
 */
export function formatPerthDate(iso: string | null): string {
  if (iso === null) return NOT_RECORDED;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match === null) return NOT_RECORDED;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export const NOT_RECORDED = "Not recorded";

/**
 * Australian date and time of day, from the same Perth-local ISO strings. An ED
 * Presentation is read by time of night as much as by date — "arrived at 9:40 pm"
 * is the difference between a routine afternoon attendance and a long wait after
 * the department filled up — so the timeline states both.
 *
 * The `+08:00` timestamp already carries the Perth wall clock, so this needs no
 * clock, locale table, or timezone library, and an unreadable value returns
 * `Not recorded` rather than a plausible-looking wrong time.
 */
export function formatPerthDateTime(iso: string | null): string {
  if (iso === null) return NOT_RECORDED;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (match === null) return NOT_RECORDED;
  const [, year, month, day, hour, minute] = match;
  const hours = Number(hour);
  const meridiem = hours < 12 ? "am" : "pm";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${day}/${month}/${year}, ${twelveHour}:${minute} ${meridiem}`;
}

/**
 * How each outcome the reducer returns is weighted on screen. Shared, because a
 * refusal that reads as a warning on one route and as an error on the next tells
 * a reader the two are different events when they are the same object.
 */
export const PROTOTYPE_OUTCOME_TONE = {
  success: "success",
  info: "info",
  blocked: "warning",
  error: "danger",
} as const satisfies Record<PrototypeOutcome["kind"], SemanticChipTone>;

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  within_review: "Within review",
  due_soon: "Review due soon",
  overdue: "Review overdue",
};

const REVIEW_STATE_TONE: Record<ReviewState, SemanticChipTone> = {
  within_review: "success",
  due_soon: "warning",
  overdue: "danger",
};

/**
 * The displayed name of each synthetic responsibility. Sentence case, because it
 * appears mid-sentence in a switcher option beside a clinician's name.
 *
 * `prototype-state.ts` carries its own lower-case forms for audit and refusal
 * prose, where the label lands inside a longer sentence. Both are deliberate: a
 * refusal reads "signed in with the named senior clinician role", and an option
 * reads "Dr Taylor Fiction — Named senior clinician".
 */
export const PROTOTYPE_ROLE_LABEL: Record<PrototypeRole, string> = {
  ed_clinician: "Emergency department clinician",
  liaison_clinician: "Emergency department mental health liaison clinician",
  cmht_clinician: "Community mental health team clinician",
  senior_clinician: "Named senior clinician",
  plan_coordinator: "Care planning coordinator",
};

export const MANAGEMENT_VERSION_STATE_LABEL: Record<ManagementPlanVersion["state"], string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting Approval",
  current: "Current",
  superseded: "Superseded",
  withdrawn: "Withdrawn",
};

/**
 * A small labelled status mark. The label is always words: colour never carries
 * the state on its own, so the mark reads identically in forced colours, in
 * greyscale print, and to a reader who cannot distinguish the tones.
 */
export function StatusMark({
  tone = "neutral",
  label,
  className,
}: {
  tone?: SemanticChipTone;
  label: string;
  className?: string;
}) {
  return <span className={cn(styles.statusMark, semanticChipTone(tone), className)}>{label}</span>;
}

/** One labelled fact inside a `<dl>`. Never omitted when empty: an absent value
 *  is shown as `Not recorded` so a reader can tell "nothing here" from "not
 *  asked". */
export function DefinitionRow({ term, children }: { term: string; children?: ReactNode }) {
  return (
    <div className={styles.definitionRow}>
      <dt className={styles.definitionTerm}>{term}</dt>
      <dd className={styles.definitionDetail}>{children ?? NOT_RECORDED}</dd>
    </div>
  );
}

export type SectionFrameProps = {
  /** Used to build the heading id the region is labelled by. */
  id: string;
  heading: string;
  headingLevel?: 2 | 3;
  /** Small supporting line under the heading, before the content. */
  description?: ReactNode;
  /** Route-owned controls belonging to this region, rendered beside the heading. */
  actions?: ReactNode;
  tone?: "default" | "boundary" | "secondary";
  testId?: string;
  className?: string;
  children: ReactNode;
};

/** A titled landmark region. Every clinical block on the snapshot is one of
 *  these, so the page is navigable by region as well as by heading. */
export function SectionFrame({
  id,
  heading,
  headingLevel = 2,
  description,
  actions,
  tone = "default",
  testId,
  className,
  children,
}: SectionFrameProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section
      aria-labelledby={`${id}-heading`}
      data-testid={testId}
      className={cn(
        styles.sectionFrame,
        tone === "boundary" && styles.sectionFrameBoundary,
        tone === "secondary" && styles.sectionFrameSecondary,
        className,
      )}
    >
      <div className={styles.sectionHead}>
        <Heading id={`${id}-heading`} className={headingLevel === 2 ? styles.sectionHeading : styles.subsectionHeading}>
          {heading}
        </Heading>
        {actions ? <div className={styles.sectionActions}>{actions}</div> : null}
      </div>
      {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      {children}
    </section>
  );
}

/** The standing fictional-data statement. Repeated on the patient workspace
 *  because a workspace is what gets printed and carried away from the screen. */
export function SyntheticMarker({ className }: { className?: string }) {
  return <span className={cn(styles.marker, className)}>{SYNTHETIC_DATA_MARKER}</span>;
}

/**
 * Shown when a Current version records no review date at all, so
 * `deriveReviewState` was never called and there is nothing to derive from.
 *
 * It degrades in the same direction as `deriveReviewState`'s unparseable-date
 * branch: an absent date must not resolve to the most reassuring state on a
 * clinical currency indicator, so it says plainly that currency is unknown
 * rather than showing a green mark and a silent `Not recorded`.
 */
export const REVIEW_STATE_UNKNOWN_LABEL = "Review currency unknown";

/**
 * The review-currency warning. An overdue, nearly-due, or undated plan stays
 * fully readable: the warning sits above the content and never replaces,
 * collapses or downgrades it, because a plan that is late for review is still
 * the plan the team agreed.
 */
export function ReviewWarning({
  reviewState,
  reviewDueAt,
}: {
  reviewState: ReviewState | null;
  reviewDueAt: string | null;
}) {
  if (reviewState === "within_review") return null;
  const tone: SemanticChipTone = reviewState === "overdue" ? "danger" : "warning";
  return (
    <p
      role="status"
      data-testid="care-plan-review-warning"
      className={cn(styles.reviewWarning, semanticChipTone(tone))}
    >
      <strong>{reviewState === null ? REVIEW_STATE_UNKNOWN_LABEL : REVIEW_STATE_LABEL[reviewState]}.</strong>{" "}
      {reviewState === null
        ? "This version records no review date, so nothing here can tell you whether it is still current. Treat it as due for review."
        : reviewState === "overdue"
          ? `This plan was due for review on ${formatPerthDate(reviewDueAt)}. It remains the Current Plan and is still the agreed approach; arrange a review.`
          : `This plan is due for review on ${formatPerthDate(reviewDueAt)}.`}
    </p>
  );
}

/**
 * A multi-line field wearing the repository field shell.
 *
 * `@/components/ui` has no textarea, and every clinical field in this prototype
 * is prose or a list of points, so this composes `FormField` — the same shell
 * `TextField` and `Select` fold onto — rather than hand-rolling a fourth one.
 * The shared control class fixes a one-line height, which the module class
 * releases; everything else about the shell is inherited, including the rule
 * that the hint survives an error.
 */
export function PlanTextArea({
  label,
  id,
  value,
  onChange,
  hint,
  error,
  required,
  rows = 4,
}: {
  label: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <FormField label={label} id={id} hint={hint} error={error} required={required}>
      {(field) => (
        <textarea
          id={field.id}
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-required={field.required || undefined}
          aria-invalid={field.invalid || undefined}
          aria-describedby={field.describedBy}
          className={cn(fieldControlPlain, styles.planTextArea)}
        />
      )}
    </FormField>
  );
}

/**
 * A version may be approved without the person taking part — sometimes a plan
 * has to be written for someone who cannot or will not engage. It is never
 * invisible that this happened, on any view, print, or queue entry.
 *
 * `PARTICIPATION_MARKER_STATES` moved to `domain.ts` once the person's own copy
 * began deciding its headings and lead-ins from the same fact. One predicate,
 * one truth: this marker and that copy cannot drift apart.
 */
export function ParticipationMarker({ participationState }: { participationState: ParticipationState }) {
  if (!PARTICIPATION_MARKER_STATES.includes(participationState)) return null;
  return <StatusMark tone="warning" label="Written without this person's involvement" />;
}

/**
 * The pinned form of section 5, rendered directly beneath the patient identity
 * block and above every other plan element, at every viewport and in print.
 *
 * On a phone the five sections are a long card and a hurried reader stops before
 * the end — which is exactly the reader this section exists for. The pinned line
 * links to the full section; it never replaces it, and the full section is never
 * collapsed, truncated, or placed behind a disclosure.
 */
export function PinnedSafetyBoundary({ content }: { content: ManagementPlanContent }) {
  const count = content.whatWouldMakeThisDifferent.length;
  return (
    <aside
      data-testid="care-plan-pinned-safety-boundary"
      aria-label="Before you use this plan"
      className={styles.pinnedBoundary}
    >
      {/*
        Deliberately "do not rely on", not "does not apply". The plan still
        supports continuity when something is different today; what it stops
        being is a basis for a decision. Overstating the boundary would make the
        line easy to dismiss, and it prints.
      */}
      <p className={styles.pinnedBoundaryText}>
        <strong>Do not rely on this plan if today is different — assess afresh.</strong> Then read the full section.
      </p>
      <a href={`#${firstMinuteSectionId("whatWouldMakeThisDifferent")}`} className={styles.pinnedBoundaryLink}>
        What would make this presentation different ({count} listed)
      </a>
    </aside>
  );
}

function ContentList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return <p className={styles.sectionEmpty}>{NOT_RECORDED}</p>;
  return (
    <ul className={styles.contentList}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export type CurrentPlanSummaryProps = {
  version: ManagementPlanVersion;
  ownerName: string;
  approverName: string | null;
  reviewState: ReviewState | null;
  cmhtName: string | null;
  cmhtOperatingHours: string | null;
  safetyPlanHref: string;
  safetyPlanStatus: string;
};

/**
 * The whole Current Plan summary card: the five first-minute sections, in the
 * one approved order, and everything else presented as metadata rather than as a
 * sixth section. The five are generated from `FIRST_MINUTE_CONTENT_KEYS`, so the
 * card cannot drift from the domain vocabulary or quietly grow a sixth field.
 *
 * Section 5 is visually distinct and is never collapsed, truncated, clipped, or
 * placed behind a disclosure.
 */
export function CurrentPlanSummary({
  version,
  ownerName,
  approverName,
  reviewState,
  cmhtName,
  cmhtOperatingHours,
  safetyPlanHref,
  safetyPlanStatus,
}: CurrentPlanSummaryProps) {
  return (
    <SectionFrame id="care-plan-current-plan" heading="Current Plan" className={styles.currentPlanCard}>
      <div data-testid="care-plan-current-plan-metadata" className={styles.metadataBlock}>
        <div className={styles.metadataMarks}>
          <StatusMark tone="success" label={`Current version ${version.version}`} />
          {reviewState === null ? (
            <StatusMark tone="warning" label={REVIEW_STATE_UNKNOWN_LABEL} />
          ) : (
            <StatusMark tone={REVIEW_STATE_TONE[reviewState]} label={REVIEW_STATE_LABEL[reviewState]} />
          )}
          <ParticipationMarker participationState={version.participationState} />
        </div>
        <dl className={styles.definitionGrid}>
          <DefinitionRow term="Plan owner">{ownerName}</DefinitionRow>
          <DefinitionRow term="Approved by">{approverName ?? undefined}</DefinitionRow>
          <DefinitionRow term="Approved on">{formatPerthDate(version.approvedAt)}</DefinitionRow>
          <DefinitionRow term="Next review due">{formatPerthDate(version.reviewDueAt)}</DefinitionRow>
          <DefinitionRow term="Community mental health team">
            {cmhtName === null ? undefined : `${cmhtName}${cmhtOperatingHours ? ` — ${cmhtOperatingHours}` : ""}`}
          </DefinitionRow>
          <DefinitionRow term="Personal Safety Plan">
            <Link href={safetyPlanHref} className={styles.inlineLink}>
              Personal Safety Plan
            </Link>
            {` — ${safetyPlanStatus}`}
          </DefinitionRow>
        </dl>
        <p className={styles.boundaryStatement}>{PLAN_CONTINUITY_BOUNDARY}</p>
      </div>

      <div data-testid="care-plan-first-minute-sections" className={styles.firstMinuteSections}>
        {FIRST_MINUTE_CONTENT_KEYS.map((key, index) => (
          <section
            key={key}
            aria-labelledby={firstMinuteSectionId(key)}
            className={cn(
              styles.firstMinuteSection,
              key === "whatWouldMakeThisDifferent" && styles.firstMinuteSectionBoundary,
            )}
          >
            <h3 id={firstMinuteSectionId(key)} className={styles.subsectionHeading}>
              {`${index + 1}. ${FIRST_MINUTE_SECTION_LABEL[key]}`}
            </h3>
            <ContentList items={version.content[key]} />
          </section>
        ))}
      </div>
    </SectionFrame>
  );
}
