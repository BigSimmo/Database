"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn, semanticChipTone, type SemanticChipTone } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import { SYNTHETIC_DATA_MARKER } from "./fixtures";
import {
  FIRST_MINUTE_CONTENT_KEYS,
  type ManagementPlanContent,
  type ManagementPlanVersion,
  type ParticipationState,
  type ReviewState,
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
 * The review-currency warning. An overdue or nearly-due plan stays fully
 * readable: the warning sits above the content and never replaces, collapses or
 * downgrades it, because a plan that is late for review is still the plan the
 * team agreed.
 */
export function ReviewWarning({ reviewState, reviewDueAt }: { reviewState: ReviewState; reviewDueAt: string | null }) {
  if (reviewState === "within_review") return null;
  const overdue = reviewState === "overdue";
  return (
    <p
      role="status"
      data-testid="care-plan-review-warning"
      className={cn(styles.reviewWarning, semanticChipTone(overdue ? "danger" : "warning"))}
    >
      <strong>{REVIEW_STATE_LABEL[reviewState]}.</strong>{" "}
      {overdue
        ? `This plan was due for review on ${formatPerthDate(reviewDueAt)}. It remains the Current Plan and is still the agreed approach; arrange a review.`
        : `This plan is due for review on ${formatPerthDate(reviewDueAt)}.`}
    </p>
  );
}

const PARTICIPATION_MARKER_STATES: readonly ParticipationState[] = ["declined", "patient_unavailable"];

/**
 * A version may be approved without the person taking part — sometimes a plan
 * has to be written for someone who cannot or will not engage. It is never
 * invisible that this happened, on any view, print, or queue entry.
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
      <p className={styles.pinnedBoundaryText}>
        <strong>This plan does not apply if today is different.</strong> Assess afresh, then read the full section.
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
          {reviewState === null ? null : (
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
