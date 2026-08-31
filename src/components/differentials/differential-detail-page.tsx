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
import { buildDifferentialSectionIndex } from "@/components/differentials/detail-section-index";
import { DiagnosisMapPanel } from "@/components/differentials/diagnosis-map-panel";
import { DiagnosisTermChip, DiagnosisTermInline } from "@/components/differentials/diagnosis-term-link";
import { CopyAfterReviewButton } from "@/components/differentials/differential-presentation-actions";
import { inPageActionRowClass as actionRowClass } from "@/components/in-page-nav/in-page-nav-classes";
import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import { PageHeader } from "@/components/ui/page-header";
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
  isRedundantSafetySummary,
  resolveSafetyFacts,
  safetyFactCompactLabel,
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
 * @param termLinks - Maps cleaned item labels to diagnosis slugs for linked items
 * @returns The rendered section item list
 */
function SectionItems({
  section,
  items,
  termLinks,
}: {
  section: DifferentialSection;
  items: string[];
  termLinks: Record<string, string>;
}) {
  if (section.tone === "action") {
    return (
      <ol className="grid gap-2">
        {items.map((item, index) => {
          const slug = termLinks[item] ?? null;
          return (
            <li key={item} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-2xs font-extrabold text-[color:var(--clinical-accent)]">
                {index + 1}
              </span>
              <span className="pt-0.5 text-sm leading-6 text-[color:var(--text)]">
                {slug ? <DiagnosisTermInline label={item} slug={slug} /> : item}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  if (section.tone === "overlap") {
    return (
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item}>
            <DiagnosisTermChip label={item} slug={termLinks[item] ?? null} tone="accent" />
          </li>
        ))}
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
      {items.map((item) => {
        const slug = termLinks[item] ?? null;
        return (
          <li key={item} className="flex items-start gap-2">
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                sectionItemIconClass[section.tone] ?? "text-[color:var(--text-muted)]",
              )}
              aria-hidden
            />
            <span className="text-sm leading-6 text-[color:var(--text)]">
              {slug ? <DiagnosisTermInline label={item} slug={slug} /> : item}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SectionRow({
  section,
  record,
  open,
  onOpenChange,
  termLinks,
}: {
  section: DifferentialSection;
  record: DifferentialRecord;
  open: boolean;
  onOpenChange: (id: string, open: boolean) => void;
  termLinks: Record<string, string>;
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
          className="h-4 w-4 justify-self-end text-[color:var(--decoration-soft)] transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div
        data-testid="differential-section-items"
        className="border-t border-[color:var(--border)] px-3 pb-4 pt-3 sm:pl-[3.25rem] sm:pr-4"
      >
        <SectionItems section={section} items={items} termLinks={termLinks} />
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

function safetyFactGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count >= 4) return "grid-cols-4";
  if (count === 3) return "grid-cols-3";
  return "grid-cols-2";
}

function SafetySnapshot({ record, termLinks }: { record: DifferentialRecord; termLinks: Record<string, string> }) {
  const theme = snapshotThemes[record.status];
  const facts = resolveSafetyFacts(record);
  const tags = record.safetySnapshot.tags;
  const summary = record.safetySnapshot.summary.trim();
  const showSummary = summary.length > 0 && !isRedundantSafetySummary(summary, tags);

  return (
    <section
      className={cn("rounded-lg border px-3 py-2.5 shadow-[var(--shadow-inset)] sm:px-3.5 sm:py-3", theme.container)}
      data-testid="differential-safety-snapshot"
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border", theme.iconTile)}>
          <theme.Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h2 className={cn("text-xs font-extrabold uppercase tracking-label", theme.heading)}>Safety snapshot</h2>
      </div>

      {showSummary ? (
        <p className="mt-1.5 text-xs font-semibold leading-5 text-[color:var(--text-heading)] sm:text-sm">{summary}</p>
      ) : null}

      {tags.length > 0 ? (
        <div
          className="mt-1.5 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5"
          data-testid="differential-safety-watchlist"
        >
          <span className="shrink-0 text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-heading)]">
            Watch for
          </span>
          {tags.map((tag) => {
            const cleaned = cleanDifferentialItem(tag);
            return (
              <DiagnosisTermChip
                key={tag}
                label={cleaned}
                slug={termLinks[cleaned] ?? null}
                tone="danger"
                className={cn(!termLinks[cleaned] && theme.chip, "min-h-6 shrink-0 px-2 text-2xs")}
              />
            );
          })}
        </div>
      ) : null}

      {facts.length > 0 ? (
        <div
          className={cn("mt-1.5 grid gap-1 border-t pt-2 sm:gap-2", safetyFactGridClass(facts.length), theme.divider)}
          role="list"
          aria-label="Safety metrics"
        >
          {facts.map((fact) => {
            const Icon = factIcons[fact.id];
            const compactLabel = safetyFactCompactLabel[fact.id] ?? fact.label;
            return (
              <div key={fact.id} className="min-w-0 text-center sm:text-left" role="listitem">
                <p
                  className={cn(
                    "min-w-0 text-2xs font-extrabold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere] min-[360px]:text-xs sm:text-base sm:leading-none sm:tracking-normal",
                    theme.accentText,
                  )}
                  data-testid="differential-safety-value"
                >
                  {fact.value}
                </p>
                <p
                  className="mt-1 flex min-w-0 items-center justify-center gap-1 text-2xs font-bold leading-tight text-[color:var(--text-muted)] sm:justify-start sm:text-xs"
                  aria-label={fact.label}
                >
                  <Icon className={cn("h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5", theme.accentText)} aria-hidden />
                  <span className="sm:hidden" aria-hidden>
                    {compactLabel}
                  </span>
                  <span className="hidden sm:inline">{fact.label}</span>
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function RelatedDiagnoses({ record, knownRelatedSlugs }: { record: DifferentialRecord; knownRelatedSlugs: string[] }) {
  const known = new Set(knownRelatedSlugs);
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
                  <ChevronRight className="h-4 w-4 text-[color:var(--decoration-soft)]" aria-hidden />
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
      <h2 className="text-xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
    : "/differentials/compare";
  const rowClassName =
    "flex min-h-12 items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-heading)]";

  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
                  <ChevronRight className="h-4 w-4 text-[color:var(--decoration-soft)]" aria-hidden />
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
        className="mt-3 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-4 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--e2)] hover:bg-[color:var(--primary-strong)]"
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
          <p className="font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">{card.title}</p>
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
        className="inline-flex min-h-tap items-center gap-2 whitespace-nowrap rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 text-sm font-semibold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)]"
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
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] p-2 shadow-[var(--e2)] lg:hidden">
      <button
        type="button"
        onClick={onCompare}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)] hover:bg-[color:var(--primary-strong)]"
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

function IconForDiagnosis(record: DifferentialRecord): LucideIcon {
  return record.slug === "delirium" ? BrainCircuit : Stethoscope;
}

/**
 * Body of the header's ellipsis sheet. This is where the page actions live now
 * that the header's right slot is a single actions control — including "New
 * differentials search", which used to be a bare `+` in the old header row.
 */
function DiagnosisActions({
  record,
  saved,
  onToggleSaved,
  onCompare,
  onNavigate,
}: {
  record: DifferentialRecord;
  saved: boolean;
  onToggleSaved: () => void;
  onCompare: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="grid gap-2">
      <button type="button" onClick={onCompare} className={actionRowClass}>
        <GitCompareArrows className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
        Compare ({record.related.length + 1})
      </button>
      <CopyAfterReviewButton
        label="Copy after review"
        text={formatDifferentialCopyText(record)}
        className={cn(
          actionRowClass,
          "justify-start !bg-[color:var(--surface-subtle)] !text-[color:var(--text-heading)]",
        )}
      />
      <button type="button" onClick={onToggleSaved} aria-pressed={saved} className={actionRowClass}>
        {saved ? (
          <BookmarkCheck className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
        ) : (
          <Bookmark className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
        )}
        {saved ? "Remove saved diagnosis" : "Save diagnosis"}
      </button>
      <Link href={appModeHomeHref("differentials", { focus: true })} onClick={onNavigate} className={actionRowClass}>
        <Plus className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
        New differentials search
      </Link>
    </div>
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
      // Phones navigate from the header disclosure and its sheet instead — one
      // affordance per breakpoint, and no strip to clip at 320px.
      className="hidden border-b border-[color:var(--border)] text-sm font-bold text-[color:var(--text-muted)] sm:flex"
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

  const sections = useMemo(
    () => buildDifferentialSectionIndex(record, detailContext, liveGovernance?.sourceStatus ?? null),
    [detailContext, liveGovernance?.sourceStatus, record],
  );
  const activeSection = sections.find((section) => section.id === activeTab) ?? sections[0];

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

  const openCompareTab = () => changeTab("compare");

  return (
    <main
      data-testid="differential-detail-page"
      className="min-h-dvh bg-[color:var(--background)] pb-24 text-[color:var(--text)] lg:pb-6"
    >
      <InPageNavHeader
        back={{ href: "/differentials/diagnoses", label: "Diagnoses" }}
        title={record.title}
        sections={sections}
        activeId={activeTab}
        onSelectSection={(id) => {
          if (isDetailTabId(id)) changeTab(id);
        }}
        actionsNoun="diagnosis"
        actionsDescription="Choose how to use this differential."
        testIdPrefix="differential"
        actions={(close) => (
          <DiagnosisActions
            record={record}
            saved={saved}
            onToggleSaved={() => {
              close();
              void toggleSaved();
            }}
            onCompare={() => {
              close();
              openCompareTab();
            }}
            onNavigate={close}
          />
        )}
      />
      <div className={cn(pageContainer, "grid gap-4 px-3 py-3 sm:px-6 sm:py-4 lg:gap-5 lg:px-8")}>
        <PageHeader
          breadcrumb={[
            { label: "Differentials", href: "/differentials" },
            { label: "Diagnosis", href: "/differentials/diagnoses" },
            { label: record.title },
          ]}
          title={record.title}
          description={record.subtitle}
          icon={IconForDiagnosis(record)}
          meta={
            <span
              className={cn(
                "inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-extrabold uppercase",
                statusToneClass[record.status],
              )}
            >
              {differentialStatusLabel(record.status)}
            </span>
          }
          actions={<TopActions record={record} saved={saved} onToggleSaved={toggleSaved} onCompare={openCompareTab} />}
        />

        {saveNotice ? (
          <p role="status" aria-live="polite" className="text-sm text-[color:var(--text-muted)]">
            {saveNotice}
          </p>
        ) : null}

        <Tabs active={activeTab} onChange={changeTab} />

        {/* Named by its own label rather than by the tab button: below `sm` the
            strip is `display:none`, and assistive tech ignores a hidden
            `aria-labelledby` target, which would leave the panel unnamed. */}
        <div
          role="tabpanel"
          id={`differential-panel-${activeTab}`}
          aria-label={activeSection?.label ?? "Diagnosis section"}
          className="grid gap-4"
        >
          {activeTab === "overview" ? (
            <>
              <SafetySnapshot record={record} termLinks={detailContext.termLinks ?? {}} />
              <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
                <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 sm:px-4">
                  <p className="text-xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
                    Clinical review
                  </p>
                  {expandableSectionIds.length > 0 ? (
                    <button
                      type="button"
                      data-testid="differential-expand-all"
                      onClick={toggleAllSections}
                      className="inline-flex min-h-tap items-center gap-1.5 text-xs font-semibold text-[color:var(--clinical-accent)] hover:text-[color:var(--primary-strong)]"
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
                    termLinks={detailContext.termLinks ?? {}}
                  />
                ))}
              </div>
            </>
          ) : null}

          {activeTab === "compare" ? <ComparePanel record={record} detailContext={detailContext} /> : null}

          {activeTab === "map" ? (
            <DiagnosisMapPanel key={record.slug} record={record} relatedMapDetails={detailContext.relatedMapDetails} />
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
