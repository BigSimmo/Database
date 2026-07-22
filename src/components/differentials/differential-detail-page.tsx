"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import {
  Activity,
  TriangleAlert,
  Bookmark,
  BookmarkCheck,
  BrainCircuit,
  CircleCheck,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleHelp,
  Clock3,
  FlaskConical,
  GitBranch,
  GitCompareArrows,
  Info,
  Plus,
  ShieldAlert,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import type { DifferentialRecordGovernance } from "@/components/clinical-dashboard/use-differential-catalog";
import { DiagnosisMapPanel } from "@/components/differentials/diagnosis-map-panel";
import { CopyAfterReviewButton } from "@/components/differentials/differential-presentation-actions";
import { cn, pageContainer, toneDanger, toneNeutral, toneWarning } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";
import {
  cleanDifferentialItem,
  differentialSourceStatusLabel,
  differentialStatusLabel,
  differentialValidationStatusLabel,
  formatDifferentialCopyText,
  formatExportedDate,
  groupCurrentPresentation,
  isDetailTabId,
  resolveSafetyFacts,
  sectionBadgeLabel,
  visibleSectionItems,
  type DifferentialDetailContext,
  type DifferentialDetailTabId,
  type DifferentialSafetyFact,
} from "@/lib/differential-detail";
import type { DifferentialRecord, DifferentialSection } from "@/lib/differentials";
import { useAccountData } from "@/components/account-data-provider";

const sectionIcons: Record<DifferentialSection["tone"], LucideIcon> = {
  fit: CircleCheck,
  warning: TriangleAlert,
  question: CircleHelp,
  action: Activity,
  test: FlaskConical,
  overlap: GitBranch,
};

const sectionTone: Record<DifferentialSection["tone"], string> = {
  fit: "border-[color:var(--success)]/20 bg-[color:var(--success-soft)] text-[color:var(--success)]",
  warning: "border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  question: "border-[color:var(--info)]/25 bg-[color:var(--info-soft)] text-[color:var(--info)]",
  action:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  test: "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]",
  overlap: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
};

const statusToneClass: Record<DifferentialRecord["status"], string> = {
  emergent: toneDanger,
  urgent: toneWarning,
  routine: toneNeutral,
};

const rowMeta: Record<DifferentialSection["tone"], { label: string; badgeClassName: string }> = {
  fit: {
    label: "Key features",
    badgeClassName: "bg-[color:var(--success-soft)] text-[color:var(--success)]",
  },
  warning: {
    label: "High-risk causes",
    badgeClassName: "bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  },
  question: {
    label: "Helpful clues",
    badgeClassName: "bg-[color:var(--info-soft)] text-[color:var(--info)]",
  },
  action: {
    label: "Priority steps",
    badgeClassName: "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  },
  test: {
    label: "Core tests",
    badgeClassName: "bg-[color:var(--info-soft)] text-[color:var(--info)]",
  },
  overlap: {
    label: "Consider",
    badgeClassName: "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  },
};

/** Maps a related node's likelihood to its own severity tag, mirroring the record-status tones. */
function likelihoodTag(likelihood: DifferentialRecord["related"][number]["likelihood"]) {
  if (likelihood === "must-not-miss") return { label: "Emergent", className: statusToneClass.emergent };
  if (likelihood === "possible") return { label: "Urgent", className: statusToneClass.urgent };
  return { label: "Review", className: statusToneClass.routine };
}

const sectionItemIcons: Partial<Record<DifferentialSection["tone"], LucideIcon>> = {
  fit: CircleCheck,
  warning: TriangleAlert,
  question: CircleHelp,
  test: FlaskConical,
};

const sectionItemIconClass: Partial<Record<DifferentialSection["tone"], string>> = {
  fit: "text-[color:var(--success)]",
  warning: "text-[color:var(--danger)]",
  question: "text-[color:var(--info)]",
  test: "text-[color:var(--info)]",
};

/**
 * Renders section items according to the section tone.
 *
 * @param section - The section whose tone determines the item layout and styling
 * @param items - The items to display
 * @param overlapLinks - Maps overlap item labels to diagnosis slugs for linked items
 * @returns The rendered section item list
 */
function SectionItems({
  section,
  items,
  overlapLinks,
}: {
  section: DifferentialSection;
  items: string[];
  overlapLinks: Record<string, string>;
}) {
  if (section.tone === "action") {
    return (
      <ol className="grid gap-2">
        {items.map((item, index) => (
          <li key={item} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-2xs font-extrabold text-[color:var(--clinical-accent)]">
              {index + 1}
            </span>
            <span className="pt-0.5 text-sm leading-6 text-[color:var(--text)]">{item}</span>
          </li>
        ))}
      </ol>
    );
  }

  if (section.tone === "overlap") {
    return (
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const slug = overlapLinks[item];
          return (
            <li key={item}>
              {slug ? (
                <Link
                  href={`/differentials/diagnoses/${slug}`}
                  className="inline-flex min-h-tap items-center gap-1 rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-bold text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)]"
                >
                  {item}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : (
                <span className="inline-flex min-h-tap items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 text-xs font-semibold text-[color:var(--text-muted)]">
                  {item}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  const Icon = sectionItemIcons[section.tone] ?? CircleCheck;
  return (
    <ul
      className={cn(
        "grid gap-2",
        section.tone === "warning" &&
          "rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] p-3",
      )}
    >
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Icon
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              sectionItemIconClass[section.tone] ?? "text-[color:var(--text-muted)]",
            )}
            aria-hidden
          />
          <span className="text-sm leading-6 text-[color:var(--text)]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionRow({
  section,
  record,
  open,
  onOpenChange,
  overlapLinks,
}: {
  section: DifferentialSection;
  record: DifferentialRecord;
  open: boolean;
  onOpenChange: (id: string, open: boolean) => void;
  overlapLinks: Record<string, string>;
}) {
  const Icon = sectionIcons[section.tone];
  const meta = rowMeta[section.tone];
  const items = useMemo(() => visibleSectionItems(section, record), [section, record]);
  const badge = sectionBadgeLabel(section, record);

  const iconTile = (
    <span
      className={cn("grid h-9 w-9 place-items-center rounded-lg border sm:h-10 sm:w-10", sectionTone[section.tone])}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );

  if (items.length === 0) {
    return (
      <article
        id={`differential-section-${section.id}`}
        data-testid="differential-section-row"
        className="grid min-h-[4.25rem] scroll-mt-24 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 last:border-b-0 sm:min-h-[4.75rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_9rem] sm:px-4 sm:py-3"
      >
        {iconTile}
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-[color:var(--text-heading)] sm:text-base">{section.title}</h2>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6">
            {section.summary}
          </p>
        </div>
        <span className="hidden justify-self-end text-xs font-semibold text-[color:var(--text-muted)] sm:block">
          {meta.label}
        </span>
      </article>
    );
  }

  return (
    <details
      id={`differential-section-${section.id}`}
      data-testid="differential-section-row"
      className="group scroll-mt-24 border-b border-[color:var(--border)] bg-[color:var(--surface)] last:border-b-0"
      open={open}
      onToggle={(event) => {
        // Native toggle also fires for prop-driven and browser-initiated flips
        // (expand-all, find-in-page auto-expand); sync from the DOM state
        // instead of inverting so echoes converge instead of looping.
        const next = event.currentTarget.open;
        if (next !== open) onOpenChange(section.id, next);
      }}
    >
      <summary className="grid min-h-[4.25rem] cursor-pointer list-none grid-cols-[2.25rem_minmax(0,1fr)_auto_1rem] items-center gap-3 px-3 py-2.5 hover:bg-[color:var(--surface-subtle)] sm:min-h-[4.75rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_9rem_5.5rem_2rem] sm:px-4 sm:py-3">
        {iconTile}
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-[color:var(--text-heading)] sm:text-base">{section.title}</h2>
          <p
            className={cn(
              "mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6",
              // The generated immediate-action summary is a garbled run-on
              // (concatenated sentences); its content reads properly in the
              // expanded numbered list instead, so keep it clamped.
              section.tone !== "action" && "group-open:line-clamp-none",
            )}
          >
            {section.summary}
          </p>
        </div>
        <span className="hidden justify-self-end text-xs font-semibold text-[color:var(--text-muted)] sm:block">
          {meta.label}
        </span>
        <span
          className={cn(
            "justify-self-end rounded-md px-2 py-1 text-xs font-bold shadow-[var(--shadow-inset)]",
            meta.badgeClassName,
          )}
        >
          {badge}
        </span>
        <ChevronDown
          className="h-4 w-4 justify-self-end text-[color:var(--text-soft)] transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div
        data-testid="differential-section-items"
        className="border-t border-[color:var(--border)] px-3 pb-4 pt-3 sm:pl-[3.25rem] sm:pr-4"
      >
        <SectionItems section={section} items={items} overlapLinks={overlapLinks} />
      </div>
    </details>
  );
}

type SnapshotTheme = {
  Icon: LucideIcon;
  container: string;
  iconTile: string;
  heading: string;
  divider: string;
  chip: string;
  accentText: string;
};

const snapshotThemes: Record<DifferentialRecord["status"], SnapshotTheme> = {
  emergent: {
    Icon: ShieldAlert,
    // Full-opacity soft tokens: an /NN modifier compiles to a color-mix toward
    // transparent, which renders near-invisible on the near-white soft values
    // in light mode (see PR #468).
    container: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]",
    iconTile: "border-[color:var(--danger)]/20 bg-[color:var(--surface)] text-[color:var(--danger)]",
    heading: "text-[color:var(--danger)]",
    divider: "border-[color:var(--danger)]/14",
    chip: "border-[color:var(--danger-border)]/60 bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
    accentText: "text-[color:var(--danger)]",
  },
  urgent: {
    Icon: TriangleAlert,
    container: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]",
    iconTile: "border-[color:var(--warning)]/25 bg-[color:var(--surface)] text-[color:var(--warning)]",
    heading: "text-[color:var(--warning)]",
    divider: "border-[color:var(--warning)]/20",
    chip: "border-[color:var(--warning-border)]/60 bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
    accentText: "text-[color:var(--warning)]",
  },
  routine: {
    Icon: Info,
    container: "border-[color:var(--border)] bg-[color:var(--surface-subtle)]",
    iconTile: "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
    heading: "text-[color:var(--text-heading)]",
    divider: "border-[color:var(--border)]",
    chip: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
    accentText: "text-[color:var(--text-muted)]",
  },
};

const factIcons: Record<DifferentialSafetyFact["id"], LucideIcon> = {
  "high-risk": ShieldAlert,
  onset: Clock3,
  course: Activity,
  treatable: Plus,
  causes: TriangleAlert,
  tests: FlaskConical,
  actions: Activity,
  related: GitBranch,
};

function SafetySnapshot({
  record,
  onReviewMustNotMiss,
}: {
  record: DifferentialRecord;
  onReviewMustNotMiss: (() => void) | null;
}) {
  const theme = snapshotThemes[record.status];
  const facts = resolveSafetyFacts(record);

  return (
    <section className={cn("rounded-lg border p-3 shadow-[var(--shadow-inset)] sm:p-5", theme.container)}>
      <div className="flex items-start gap-3">
        <span
          className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border sm:h-9 sm:w-9", theme.iconTile)}
        >
          <theme.Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={cn("text-sm font-extrabold uppercase tracking-[0.04em]", theme.heading)}>Safety snapshot</h2>
            <span
              className={cn(
                "inline-flex min-h-6 items-center rounded-md border px-2 text-2xs font-extrabold uppercase",
                statusToneClass[record.status],
              )}
            >
              {differentialStatusLabel(record.status)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">{record.safetySnapshot.summary}</p>
          {facts.length > 0 ? (
            <div className={cn("mt-3 grid grid-cols-2 gap-3 border-y py-3 sm:grid-cols-4 sm:gap-2", theme.divider)}>
              {facts.map((fact, index) => {
                const Icon = factIcons[fact.id];
                return (
                  <div
                    key={fact.id}
                    className={cn("min-w-0", index > 0 && "sm:border-l sm:pl-4", index > 0 && theme.divider)}
                  >
                    <p className="grid gap-1 text-2xs font-bold leading-tight text-[color:var(--text-heading)] sm:flex sm:items-center sm:gap-2 sm:text-xs">
                      <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", theme.accentText)} aria-hidden />
                      <span>{fact.label}</span>
                    </p>
                    <p className="mt-1 text-2xs font-semibold text-[color:var(--text-muted)] sm:text-xs">
                      {fact.value}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
          {record.safetySnapshot.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[color:var(--text-heading)]">Watch for</span>
              {record.safetySnapshot.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "inline-flex min-h-7 items-center rounded-md border px-2.5 text-2xs font-semibold",
                    theme.chip,
                  )}
                >
                  {cleanDifferentialItem(tag)}
                </span>
              ))}
            </div>
          ) : null}
          {onReviewMustNotMiss ? (
            <button
              type="button"
              data-testid="differential-safety-cta"
              onClick={onReviewMustNotMiss}
              className="mt-3 inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)]"
            >
              <TriangleAlert className={cn("h-4 w-4", theme.accentText)} aria-hidden />
              Review must-not-miss causes
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RelatedDiagnoses({ record, knownRelatedSlugs }: { record: DifferentialRecord; knownRelatedSlugs: string[] }) {
  const known = new Set(knownRelatedSlugs);
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
        Related diagnoses
      </h2>
      <ul className="mt-2 grid gap-1">
        {record.related.map((node) => {
          const tag = likelihoodTag(node.likelihood);
          const body = (
            <>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">{node.label}</span>
                {node.note ? (
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[color:var(--text-muted)]">
                    {node.note}
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={cn("rounded-md border px-1.5 py-0.5 text-2xs font-extrabold uppercase", tag.className)}
                >
                  {tag.label}
                </span>
                {known.has(node.id) ? (
                  <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
                ) : null}
              </span>
            </>
          );
          return (
            <li key={node.id}>
              {known.has(node.id) ? (
                <Link
                  href={`/differentials/diagnoses/${node.id}`}
                  data-testid="differential-related-row"
                  className="-mx-2 flex min-h-12 items-start justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[color:var(--surface-subtle)]"
                >
                  {body}
                </Link>
              ) : (
                <div
                  data-testid="differential-related-row"
                  className="-mx-2 flex min-h-12 items-start justify-between gap-3 rounded-lg px-2 py-2"
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CurrentPresentation({ record }: { record: DifferentialRecord }) {
  const view = groupCurrentPresentation(record.currentPresentation);
  const hingeCallout = (text: string) => (
    <p className="mt-2 flex items-start gap-2 rounded-md border border-[color:var(--info-border)] bg-[color:var(--info-soft)] p-2 text-xs leading-5 text-[color:var(--text)]">
      <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--info)]" aria-hidden />
      <span>
        <span className="font-bold">Clinical hinge:</span> {text}
      </span>
    </p>
  );

  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
        Current presentation
      </h2>
      {view.kind === "grouped" ? (
        <div className="mt-3 grid gap-3">
          {view.groups.map((group, index) => (
            <div
              key={`${group.title}-${index}`}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
            >
              <p className="text-sm font-bold text-[color:var(--text-heading)]">{group.title}</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{group.candidates}</p>
              {hingeCallout(group.hinge)}
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-3 grid gap-2 text-xs font-semibold text-[color:var(--text-muted)]">
          {view.items.map((item, index) =>
            item.isHinge ? (
              <li key={`${item.text}-${index}`}>{hingeCallout(item.text)}</li>
            ) : (
              <li key={`${item.text}-${index}`} className="flex gap-2">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                {item.text}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function ComparePanel({
  record,
  detailContext,
}: {
  record: DifferentialRecord;
  detailContext: DifferentialDetailContext;
}) {
  const known = new Set(detailContext.knownRelatedSlugs);
  const compareHref = detailContext.comparePresentation
    ? `/differentials/presentations/${detailContext.comparePresentation.slug}`
    : "/differentials/presentations";
  const rowClassName =
    "flex min-h-12 items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-heading)]";

  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
        Compare with related diagnoses
      </h2>
      <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">
        Open a related diagnosis below, or launch the side-by-side comparison workspace for this presentation.
      </p>
      <ul className="mt-3 grid gap-2">
        <li
          className={cn(
            rowClassName,
            "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]",
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <BrainCircuit className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
            <span className="truncate">{record.title}</span>
            <span className="shrink-0 text-2xs font-extrabold uppercase text-[color:var(--text-muted)]">
              This diagnosis
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-md border px-1.5 py-0.5 text-2xs font-extrabold uppercase",
              statusToneClass[record.status],
            )}
          >
            {differentialStatusLabel(record.status)}
          </span>
        </li>
        {record.related.map((node) => {
          const tag = likelihoodTag(node.likelihood);
          const body = (
            <>
              <span className="inline-flex min-w-0 items-center gap-2">
                <BrainCircuit className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden />
                <span className="truncate">{node.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={cn("rounded-md border px-1.5 py-0.5 text-2xs font-extrabold uppercase", tag.className)}
                >
                  {tag.label}
                </span>
                {known.has(node.id) ? (
                  <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
                ) : null}
              </span>
            </>
          );
          return (
            <li key={node.id}>
              {known.has(node.id) ? (
                <Link
                  href={`/differentials/diagnoses/${node.id}`}
                  className={cn(rowClassName, "hover:bg-[color:var(--surface-subtle)]")}
                >
                  {body}
                </Link>
              ) : (
                <div className={rowClassName}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <Link
        data-testid="differential-compare-open"
        href={compareHref}
        className="mt-3 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-4 text-sm font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-soft)] hover:bg-[color:var(--primary-strong)]"
      >
        <GitCompareArrows className="h-4 w-4" aria-hidden />
        Open comparison workspace
      </Link>
      {detailContext.comparePresentation ? (
        <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">
          Opens “{detailContext.comparePresentation.title}” with this diagnosis in the candidate list.
        </p>
      ) : null}
    </section>
  );
}

function FooterStatus({
  source,
  liveGovernance,
}: {
  source: DifferentialDetailContext["source"];
  liveGovernance: DifferentialRecordGovernance | null;
}) {
  const sourceStatus = liveGovernance?.sourceStatus ?? source.sourceStatus;
  const validationStatus = liveGovernance?.validationStatus ?? source.validationStatus;
  const sourceToneClass =
    sourceStatus === "current"
      ? "text-[color:var(--success)]"
      : sourceStatus === "outdated"
        ? "text-[color:var(--danger)]"
        : "text-[color:var(--warning)]";
  const validationToneClass =
    validationStatus === "approved" ? "text-[color:var(--success)]" : "text-[color:var(--warning)]";

  const cards: Array<{ title: string; line: string; lineClassName: string; detail: string }> = [
    {
      title: "Source status",
      line: differentialSourceStatusLabel(sourceStatus),
      lineClassName: sourceToneClass,
      detail: source.sourceTitle || source.reviewStatus,
    },
    {
      title: "Review status",
      line: differentialValidationStatusLabel(validationStatus),
      lineClassName: validationToneClass,
      detail: "Use clinical judgement and local protocols.",
    },
    {
      title: "Version",
      line: `${source.version} | Local content only`,
      lineClassName: "text-[color:var(--text-heading)]",
      detail: `Exported ${formatExportedDate(source.exportedAt)}. Data not provided for clinical use.`,
    },
  ];

  return (
    <section className="grid gap-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-xs shadow-[var(--shadow-inset)] sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="min-w-0 sm:border-l sm:border-[color:var(--border)] sm:pl-4 first:sm:border-l-0 first:sm:pl-0"
        >
          <p className="font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{card.title}</p>
          <p className={cn("mt-3 font-bold", card.lineClassName)}>{card.line}</p>
          <p className="mt-2 leading-5 text-[color:var(--text-muted)]">{card.detail}</p>
        </div>
      ))}
    </section>
  );
}

/**
 * Renders desktop actions for comparing, copying, and saving a diagnosis.
 *
 * @param record - The diagnosis record whose content is copied.
 * @param saved - Whether the diagnosis is currently saved.
 * @param onToggleSaved - Called when the saved state is toggled.
 * @param onCompare - Called when comparison is requested.
 */
function TopActions({
  record,
  saved,
  onToggleSaved,
  onCompare,
}: {
  record: DifferentialRecord;
  saved: boolean;
  onToggleSaved: () => void;
  onCompare: () => void;
}) {
  return (
    <div className="hidden shrink-0 items-center gap-3 lg:flex">
      <button
        type="button"
        onClick={onCompare}
        className="inline-flex min-h-tap items-center gap-2 whitespace-nowrap rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)]"
      >
        <GitCompareArrows className="h-4 w-4" aria-hidden />
        Compare
      </button>
      <CopyAfterReviewButton text={formatDifferentialCopyText(record)} />
      <button
        type="button"
        onClick={onToggleSaved}
        aria-pressed={saved}
        aria-label={saved ? "Remove saved diagnosis" : "Save diagnosis"}
        className={cn(
          "grid h-tap w-tap place-items-center rounded-lg border shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)]",
          saved
            ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
            : "border-[color:var(--border-lux)] bg-[color:var(--surface)] text-[color:var(--text-heading)]",
        )}
      >
        {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

function MobilePrimaryActions({
  record,
  saved,
  onToggleSaved,
  onCompare,
}: {
  record: DifferentialRecord;
  saved: boolean;
  onToggleSaved: () => void;
  onCompare: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] p-2 shadow-[var(--shadow-soft)] lg:hidden">
      <button
        type="button"
        onClick={onCompare}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-sm font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--primary-strong)]"
      >
        <GitCompareArrows className="h-4 w-4" aria-hidden />
        Compare ({record.related.length + 1})
      </button>
      <CopyAfterReviewButton
        label="Copy"
        text={formatDifferentialCopyText(record)}
        className="min-h-12 !bg-[color:var(--surface-raised)] !text-[color:var(--clinical-accent)] hover:!bg-[color:var(--surface-subtle)]"
      />
      <button
        type="button"
        onClick={onToggleSaved}
        aria-pressed={saved}
        aria-label={saved ? "Remove saved diagnosis" : "Save diagnosis"}
        className={cn(
          "grid h-12 w-12 place-items-center rounded-md border",
          saved
            ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
            : "border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-raised)] text-[color:var(--text-heading)]",
        )}
      >
        {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

function IconForDiagnosis({ record }: { record: DifferentialRecord }) {
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-[color:var(--clinical-accent)]">
      {record.slug === "delirium" ? (
        <BrainCircuit className="h-12 w-12 stroke-[1.7]" aria-hidden />
      ) : (
        <Stethoscope className="h-12 w-12 stroke-[1.7]" aria-hidden />
      )}
    </span>
  );
}

function HeaderChrome() {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 sm:px-6 lg:px-8">
      <div className={cn(pageContainer, "flex items-center justify-between gap-3")}>
        <div className="flex items-center gap-3">
          <Link
            href="/differentials"
            aria-label="Back to differentials"
            className="grid h-tap w-tap place-items-center rounded-lg text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)]"
          >
            <ChevronRight className="h-5 w-5 rotate-180" aria-hidden />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={appModeHomeHref("differentials", { focus: true })}
            aria-label="New differentials search"
            className="grid h-tap w-tap place-items-center rounded-lg text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)]"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

const detailTabs: Array<{ id: DifferentialDetailTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "compare", label: "Compare" },
  { id: "map", label: "Map" },
  { id: "related", label: "Related" },
  { id: "source", label: "Source" },
];

/**
 * Renders keyboard-navigable tabs for the diagnosis detail sections.
 *
 * @param active - The currently selected tab.
 * @param onChange - Called when the selected tab changes.
 */
function Tabs({
  active,
  onChange,
}: {
  active: DifferentialDetailTabId;
  onChange: (id: DifferentialDetailTabId) => void;
}) {
  const tabRefs = useRef(new Map<DifferentialDetailTabId, HTMLButtonElement>());

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const order = detailTabs.map((tab) => tab.id);
    const index = order.indexOf(active);
    const next =
      event.key === "ArrowRight"
        ? order[(index + 1) % order.length]
        : event.key === "ArrowLeft"
          ? order[(index - 1 + order.length) % order.length]
          : event.key === "Home"
            ? order[0]
            : event.key === "End"
              ? order[order.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    if (next === active) return;
    onChange(next);
    tabRefs.current.get(next)?.focus();
  }

  return (
    <nav
      role="tablist"
      onKeyDown={handleKeyDown}
      className="flex border-b border-[color:var(--border)] text-sm font-bold text-[color:var(--text-muted)]"
      aria-label="Diagnosis sections"
    >
      {detailTabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) tabRefs.current.set(tab.id, element);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`differential-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`differential-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "focus-ring-tab min-h-tap flex-1 whitespace-nowrap border-b-2 px-1 py-3 text-center text-xs sm:flex-none sm:px-4 sm:text-sm",
              isActive
                ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                : "border-transparent hover:text-[color:var(--text-heading)]",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function DifferentialDetailPage({
  record,
  detailContext,
  liveGovernance = null,
}: {
  record: DifferentialRecord;
  detailContext: DifferentialDetailContext;
  liveGovernance?: DifferentialRecordGovernance | null;
}) {
  const [activeTab, setActiveTab] = useState<DifferentialDetailTabId>("overview");
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(() => new Set<string>());
  const accountData = useAccountData();
  const saved = accountData.isSaved("differential", record.slug);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const expandableSectionIds = useMemo(
    () =>
      record.sections.filter((section) => visibleSectionItems(section, record).length > 0).map((section) => section.id),
    [record],
  );
  const allOpen = expandableSectionIds.length > 0 && expandableSectionIds.every((id) => openSections.has(id));

  useEffect(() => {
    // One-time URL -> state sync after mount; the route stays statically
    // generated because it never reads useSearchParams/searchParams.
    const param = new URLSearchParams(window.location.search).get("tab");
    if (param && isDetailTabId(param)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(param);
    }
  }, []);

  const changeTab = useCallback((id: DifferentialDetailTabId) => {
    setActiveTab(id);
    const url = new URL(window.location.href);
    if (id === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  }, []);

  const setSectionOpen = useCallback((id: string, open: boolean) => {
    setOpenSections((previous) => {
      if (previous.has(id) === open) return previous;
      const next = new Set(previous);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  function toggleAllSections() {
    setOpenSections(allOpen ? new Set() : new Set(expandableSectionIds));
  }

  async function toggleSaved() {
    try {
      const nowSaved = !saved;
      const updated = await accountData.setFavourite("differential", record.slug, nowSaved);
      if (!updated) {
        setSaveNotice(
          accountData.isAuthenticated ? "Save failed. Try again." : "Sign in or create an account to save diagnoses.",
        );
        return;
      }
      setSaveNotice(nowSaved ? "Diagnosis saved." : "Diagnosis removed from saved items.");
    } catch {
      setSaveNotice("Save failed.");
    }
  }

  const hasMustNotMiss = record.sections.some((section) => section.id === "must-not-miss");
  const reviewMustNotMiss = hasMustNotMiss
    ? () => {
        setSectionOpen("must-not-miss", true);
        const target = document.getElementById("differential-section-must-not-miss");
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    : null;
  const openCompareTab = () => changeTab("compare");

  return (
    <main
      data-testid="differential-detail-page"
      className="min-h-dvh bg-[color:var(--background)] pb-24 text-[color:var(--text)] lg:pb-6"
    >
      <HeaderChrome />
      <div className={cn(pageContainer, "grid gap-4 px-3 py-3 sm:px-6 sm:py-4 lg:gap-5 lg:px-8")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <nav aria-label="Differential breadcrumbs" className="mb-3 flex items-center gap-2 text-xs font-semibold">
              <Link href="/differentials" className="text-[color:var(--clinical-accent)]">
                Differentials
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
              <span className="text-[color:var(--text-muted)]">Diagnosis</span>
              <ChevronRight className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
              <span className="text-[color:var(--text-muted)]">{record.title}</span>
            </nav>
            <div className="flex items-start gap-3 sm:gap-4">
              <IconForDiagnosis record={record} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-extrabold leading-tight text-[color:var(--text-heading)] sm:text-4xl">
                    {record.title}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-extrabold uppercase",
                      statusToneClass[record.status],
                    )}
                  >
                    {differentialStatusLabel(record.status)}
                  </span>
                </div>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] sm:mt-2 sm:text-base">
                  {record.subtitle}
                </p>
              </div>
            </div>
          </div>
          <TopActions record={record} saved={saved} onToggleSaved={toggleSaved} onCompare={openCompareTab} />
        </div>

        {saveNotice ? (
          <p role="status" aria-live="polite" className="text-sm text-[color:var(--text-muted)]">
            {saveNotice}
          </p>
        ) : null}

        <Tabs active={activeTab} onChange={changeTab} />

        <div
          role="tabpanel"
          id={`differential-panel-${activeTab}`}
          aria-labelledby={`differential-tab-${activeTab}`}
          className="grid gap-4"
        >
          {activeTab === "overview" ? (
            <>
              <SafetySnapshot record={record} onReviewMustNotMiss={reviewMustNotMiss} />
              <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
                <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 sm:px-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                    Clinical review
                  </p>
                  {expandableSectionIds.length > 0 ? (
                    <button
                      type="button"
                      data-testid="differential-expand-all"
                      onClick={toggleAllSections}
                      className="inline-flex min-h-tap items-center gap-1.5 text-xs font-bold text-[color:var(--clinical-accent)] hover:text-[color:var(--primary-strong)]"
                    >
                      {allOpen ? (
                        <ChevronsDownUp className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronsUpDown className="h-4 w-4" aria-hidden />
                      )}
                      {allOpen ? "Collapse all" : "Expand all"}
                    </button>
                  ) : null}
                </div>
                {record.sections.map((section) => (
                  <SectionRow
                    key={section.id}
                    section={section}
                    record={record}
                    open={openSections.has(section.id)}
                    onOpenChange={setSectionOpen}
                    overlapLinks={detailContext.overlapLinks}
                  />
                ))}
              </div>
            </>
          ) : null}

          {activeTab === "compare" ? <ComparePanel record={record} detailContext={detailContext} /> : null}

          {activeTab === "map" ? (
            <DiagnosisMapPanel record={record} knownRelatedSlugs={detailContext.knownRelatedSlugs} />
          ) : null}

          {activeTab === "related" ? (
            <>
              <RelatedDiagnoses record={record} knownRelatedSlugs={detailContext.knownRelatedSlugs} />
              <CurrentPresentation record={record} />
            </>
          ) : null}

          {activeTab === "source" ? (
            <FooterStatus source={detailContext.source} liveGovernance={liveGovernance} />
          ) : null}
        </div>

        <MobilePrimaryActions record={record} saved={saved} onToggleSaved={toggleSaved} onCompare={openCompareTab} />
        <p className="rounded-lg border border-transparent px-1 text-xs leading-5 text-[color:var(--text-muted)]">
          Clinical decision support only. Review before use.
        </p>
      </div>
    </main>
  );
}
