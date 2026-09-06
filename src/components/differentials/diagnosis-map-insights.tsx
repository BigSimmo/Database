"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert, SquareStack, Stethoscope } from "lucide-react";

import { cn } from "@/components/ui-primitives";
import { curatedProvenanceLabel } from "@/lib/differential-curated";
import {
  differentialStatusLabel,
  type DifferentialDiscriminatorRow,
  type DifferentialRelatedMapDetail,
} from "@/lib/differential-detail";
import type { DifferentialLikelihood, DifferentialMapNode, DifferentialRecord } from "@/lib/differentials";

/**
 * The information layer under the diagnosis map.
 *
 * A graph shows that two diagnoses are related. It cannot show HOW to tell them
 * apart, which is the only question a clinician is actually holding while
 * looking at one. Everything here answers that question, and every row is
 * derived from the catalogue unless a curated discriminator exists for the
 * pair — nothing is invented for a record that has no content.
 */

const likelihoodChipTone: Record<DifferentialLikelihood, string> = {
  // Likelihood is not clinical state, so it takes the accent and neutral
  // ramps (TOKENS.md §7). `must-not-miss` is the one genuine safety state
  // here and is the only member allowed the danger ramp.
  "most-likely":
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  possible: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-heading)]",
  "less-likely": "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  "must-not-miss": "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
};

const likelihoodChipLabel: Record<DifferentialLikelihood, string> = {
  "most-likely": "Most likely",
  possible: "Possible",
  "less-likely": "Less likely",
  "must-not-miss": "Must-not-miss",
};

const statusChipTone: Record<DifferentialRecord["status"], string> = {
  emergent: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  urgent: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  routine: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
};

const cardClass =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]";
const eyebrowClass = "text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]";

function LikelihoodChip({ likelihood }: { likelihood: DifferentialLikelihood }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-2xs font-extrabold uppercase",
        likelihoodChipTone[likelihood],
      )}
    >
      {likelihoodChipLabel[likelihood]}
    </span>
  );
}

/** The diagnosis currently in focus on the map, in words. Falls back to the
 *  record itself, so the panel is never empty on first paint. */
function SelectedSummary({
  record,
  selectedNode,
  detail,
}: {
  record: DifferentialRecord;
  selectedNode: DifferentialMapNode | null;
  detail: DifferentialRelatedMapDetail | null;
}) {
  const title = selectedNode ? (detail?.title ?? selectedNode.label) : record.title;
  const status = selectedNode ? detail?.status : record.status;
  const hinge = selectedNode ? (detail?.clinicalHinge ?? selectedNode.note) : record.clinicalHinge;
  const safety = selectedNode ? detail?.safetySummary : record.safetySnapshot.summary;
  const href = selectedNode && detail ? `/differentials/diagnoses/${detail.slug}` : null;

  return (
    <div className={cn(cardClass, "p-3 sm:p-4")} data-testid="diagnosis-map-selected-summary">
      <div className="flex items-center justify-between gap-2">
        <p className={eyebrowClass}>{selectedNode ? "Selected diagnosis" : "This diagnosis"}</p>
        {status ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-2xs font-extrabold uppercase",
              statusChipTone[status],
            )}
          >
            {differentialStatusLabel(status)}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm font-extrabold text-[color:var(--text-heading)] sm:text-base">{title}</p>
      {hinge ? <p className="mt-1 text-sm leading-6 text-[color:var(--text)]">{hinge}</p> : null}
      {safety ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-[color:var(--text-muted)]">
          <ShieldAlert className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--danger)]" aria-hidden />
          <span>{safety}</span>
        </p>
      ) : null}
      {href ? (
        <Link
          href={href}
          className="mt-2.5 inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-[color:var(--clinical-accent)] hover:text-[color:var(--primary-strong)]"
        >
          Open {title}
          <ArrowRight className="size-icon-sm shrink-0" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function MustNotMissBand({ rows }: { rows: DifferentialDiscriminatorRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div
      className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] p-3 sm:p-4"
      data-testid="diagnosis-map-must-not-miss"
    >
      <p className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--danger)]">
        <ShieldAlert className="size-icon-sm shrink-0" aria-hidden />
        Exclude first
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {rows.map((row) => (
          <li key={row.slug}>
            {row.href ? (
              <Link
                href={row.href}
                className="inline-flex min-h-compact-meta items-center rounded-md border border-[color:var(--danger-border)] bg-[color:var(--surface)] px-2 text-2xs font-bold text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]"
              >
                {row.label}
              </Link>
            ) : (
              <span className="inline-flex min-h-compact-meta items-center rounded-md border border-[color:var(--danger-border)] bg-[color:var(--surface)] px-2 text-2xs font-bold text-[color:var(--danger)]">
                {row.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The comparison list.
 *
 * Deliberately a list of rows rather than a `<table>`: on a 320px phone a
 * three-column comparison table can only survive inside a sideways scroller,
 * and a clinician reading a differential should not have to swipe to see the
 * half of the comparison that argues the other way. Each row is a card on a
 * phone and a three-column grid from `sm`, with the per-cell labels visible on
 * the phone and `sr-only` where the column headings already carry them.
 */
function ComparisonRows({
  rows,
  focusTitle,
  selectedSlug,
  onSelect,
}: {
  rows: DifferentialDiscriminatorRow[];
  focusTitle: string;
  selectedSlug: string | null;
  onSelect?: (slug: string) => void;
}) {
  // One column definition, two consumers (the heading strip and every row), so
  // the columns cannot drift apart. `sm:grid` is applied at each call site
  // rather than baked in here: the heading strip is `hidden` below `sm` and the
  // rows are block-level cards, and merging two display utilities through
  // `cn()` would leave which one wins to stylesheet order.
  const gridColumnsClass = "sm:grid-cols-[minmax(9rem,1fr)_minmax(0,1.35fr)_minmax(0,1.35fr)] sm:gap-4";

  return (
    <div className={cn(cardClass, "overflow-hidden")} data-testid="diagnosis-map-comparison">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 sm:px-4">
        <p className={cn(eyebrowClass, "flex items-center gap-1.5")}>
          <SquareStack className="size-icon-sm shrink-0" aria-hidden />
          Tell them apart
        </p>
        <span className="nums text-2xs font-bold text-[color:var(--text-muted)]">{rows.length}</span>
      </div>

      <div
        className={cn("hidden border-b border-[color:var(--border)] px-3 py-2 sm:grid sm:px-4", gridColumnsClass)}
        aria-hidden
      >
        <p className={eyebrowClass}>Diagnosis</p>
        <p className={eyebrowClass}>Points to it</p>
        <p className={eyebrowClass}>Points back to {focusTitle}</p>
      </div>

      <ul>
        {rows.map((row) => {
          const selected = row.slug === selectedSlug;
          return (
            <li
              key={row.slug}
              data-testid="diagnosis-map-comparison-row"
              aria-current={selected ? "true" : undefined}
              className={cn(
                "border-b border-[color:var(--border)] px-3 py-3 last:border-b-0 sm:grid sm:px-4",
                gridColumnsClass,
                selected && "bg-[color:var(--clinical-accent-soft)]",
              )}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:block">
                {row.href ? (
                  <Link
                    href={row.href}
                    className="text-sm font-bold text-[color:var(--clinical-accent)] hover:text-[color:var(--primary-strong)]"
                  >
                    {row.label}
                  </Link>
                ) : (
                  <span className="text-sm font-bold text-[color:var(--text-heading)]">{row.label}</span>
                )}
                <span className="sm:mt-1 sm:block">
                  <LikelihoodChip likelihood={row.likelihood} />
                </span>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(row.slug)}
                    aria-pressed={selected}
                    className="inline-flex min-h-compact-meta items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-2 text-2xs font-bold text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] sm:mt-1"
                  >
                    {selected ? "On map" : "Show on map"}
                  </button>
                ) : null}
              </div>

              <p className="mt-1.5 text-sm leading-6 text-[color:var(--text)] sm:mt-0">
                <span className={cn(eyebrowClass, "mr-1.5 sm:sr-only")}>Points to it</span>
                {row.favoursRelated || <span className="text-[color:var(--text-muted)]">Not recorded</span>}
              </p>

              <p className="mt-1.5 text-sm leading-6 text-[color:var(--text)] sm:mt-0">
                <span className={cn(eyebrowClass, "mr-1.5 sm:sr-only")}>Points back to {focusTitle}</span>
                {row.favoursFocus || <span className="text-[color:var(--text-muted)]">Not recorded</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type DiagnosisMapInsightsProps = {
  record: DifferentialRecord;
  rows: DifferentialDiscriminatorRow[];
  /** null when the focus diagnosis itself is selected. */
  selectedSlug: string | null;
  selectedNode: DifferentialMapNode | null;
  relatedMapDetails: Record<string, DifferentialRelatedMapDetail>;
  onSelect?: (slug: string) => void;
  className?: string;
};

export function DiagnosisMapInsights({
  record,
  rows,
  selectedSlug,
  selectedNode,
  relatedMapDetails,
  onSelect,
  className,
}: DiagnosisMapInsightsProps) {
  const mustNotMiss = rows.filter((row) => row.likelihood === "must-not-miss");
  const anyCurated = rows.some((row) => row.curated);
  const detail = selectedSlug ? (relatedMapDetails[selectedSlug] ?? null) : null;

  return (
    <section aria-label="Diagnosis comparison" className={cn("grid gap-3", className)}>
      <SelectedSummary record={record} selectedNode={selectedNode} detail={detail} />
      <MustNotMissBand rows={mustNotMiss} />
      {rows.length > 0 ? (
        <ComparisonRows rows={rows} focusTitle={record.title} selectedSlug={selectedSlug} onSelect={onSelect} />
      ) : (
        <p className="flex items-start gap-1.5 px-1 text-xs leading-5 text-[color:var(--text-muted)]">
          <Stethoscope className="mt-0.5 size-icon-sm shrink-0" aria-hidden />
          This record lists no related differentials, so there is nothing to compare it against yet.
        </p>
      )}
      {anyCurated ? (
        <p className="px-1 text-2xs font-semibold text-[color:var(--text-muted)]">{curatedProvenanceLabel}</p>
      ) : null}
    </section>
  );
}
