"use client";

import { Plus } from "lucide-react";

import { CmeNavHeader } from "@/components/cme/cme-nav-header";
import { cardSurface } from "@/components/card-recipes";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { InformationPageShell } from "@/components/information-page-shell";
import { cn, floatingControl } from "@/components/ui-primitives";
import { cpdYearBounds } from "@/lib/cme/cpd-year";
import {
  cmeCategoryLabels,
  type CmeCategory,
  type CmeRequirement,
  type CmeRequirementSet,
  type CmeRequirementSpec,
} from "@/lib/cme/types";

/** A future task hands a real handler here; Phase 1 builds no requirement editor yet. */
function noop() {}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatHours(value: number): string {
  return String(round2(value));
}

/**
 * "2026-09-19" -> "19 September 2026".
 *
 * Every date this type carries (`confirmedOn`, and the CPD year bounds below)
 * is a plain calendar date with no time component, so this is formatting, not
 * a timezone conversion — the `Date.UTC` construction plus a UTC-pinned
 * formatter exists only to stop a reader's local timezone shifting which
 * calendar day gets displayed.
 */
function formatCalendarDate(dateOnly: string): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return dateOnly;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    date,
  );
}

function describeCategories(categories: readonly CmeCategory[]): string {
  const labels = categories.map((category) => cmeCategoryLabels[category].toLowerCase());
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

const smallOrdinalWords: Record<number, string> = { 2: "two", 3: "three", 4: "four" };

function eachFloorLabel(categoryCount: number): string {
  const word = smallOrdinalWords[categoryCount] ?? String(categoryCount);
  return `…and at least this much in each of those ${word}`;
}

/**
 * The one headline "hours" figure a shape contributes toward the confirmed
 * total. Zero for the two shapes that carry no hours of their own — a count
 * of activities and a task are met or not, never partly spent.
 */
function primaryHours(spec: CmeRequirementSpec): number {
  if (spec.shape === "hours-in-category" || spec.shape === "hours-across-categories") return spec.minimumHours;
  return 0;
}

type TargetRow = { id: string; label: string; meta?: string; value: string };

/**
 * One requirement, as one or two display rows.
 *
 * Generic over the shape on purpose: this reads only `requirement.label` and
 * `requirement.spec`, never a hardcoded id or a wording tied to one specific
 * requirement. Whatever the owner has actually confirmed — for the national
 * baseline or a college's own extras — renders the same way, which is what
 * lets one function serve both sections below.
 */
function targetRows(requirement: CmeRequirement): TargetRow[] {
  const spec = requirement.spec;
  switch (spec.shape) {
    case "hours-in-category":
      return [
        { id: requirement.id, label: requirement.label, meta: "At least", value: formatHours(spec.minimumHours) },
      ];
    case "hours-across-categories": {
      const rows: TargetRow[] = [
        {
          id: requirement.id,
          label: requirement.label,
          meta: `Combined (${describeCategories(spec.categories)}), at least`,
          value: formatHours(spec.minimumHours),
        },
      ];
      // Zero means the demo or owner data expresses no per-category floor on
      // this requirement — nothing to show a second row for.
      if (spec.minimumEachHours > 0) {
        rows.push({
          id: `${requirement.id}-each`,
          label: eachFloorLabel(spec.categories.length),
          value: formatHours(spec.minimumEachHours),
        });
      }
      return rows;
    }
    case "activity-count":
      return [
        {
          id: requirement.id,
          label: requirement.label,
          meta: spec.buckets.length > 0 ? `One activity in each — ${spec.buckets.join(" · ")}` : "One activity in each",
          value: String(spec.buckets.length),
        },
      ];
    case "task":
      return [{ id: requirement.id, label: requirement.label, value: "Required" }];
  }
}

function TargetRowView({ row }: { row: TargetRow }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="min-w-0">
        <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{row.label}</span>
        {row.meta ? <span className="mt-0.5 block text-xs text-[color:var(--text-muted)]">{row.meta}</span> : null}
      </dt>
      <dd className="shrink-0 text-sm font-bold tabular-nums text-[color:var(--text-heading)]">{row.value}</dd>
    </div>
  );
}

/**
 * The programme screen — the safety property this whole mode exists to
 * protect lives here. Every target on this page comes from `set`, which the
 * owner confirmed on a stated date against a stated document; nothing here is
 * a default this code invented, and the provenance block below is not
 * optional decoration.
 */
export function CmeProgrammePage({
  set,
  onReconfirm,
  onAddCollegeRequirement,
}: {
  set: CmeRequirementSet;
  /** Wired by a future task. Phase 1 has no re-confirmation flow to hand this to yet. */
  onReconfirm?: () => void;
  /** Wired by a future task. Phase 1 has no college-requirement editor yet. */
  onAddCollegeRequirement?: () => void;
}) {
  const nationalRequirements = set.requirements.filter((requirement) => requirement.source === "national");
  const collegeRequirements = set.requirements.filter((requirement) => requirement.source === "college");
  const nationalRows = nationalRequirements.flatMap(targetRows);
  const collegeRows = collegeRequirements.flatMap(targetRows);

  // The remainder of the confirmed total not already spoken for by a named
  // category minimum. This is arithmetic on the owner's own two confirmed
  // numbers — the total, and each requirement's own minimum — never a figure
  // typed in on its own, so it carries the same provenance as the numbers it
  // is built from. College extras "sit on top of the baseline" (the note
  // below says so), so only national requirements are netted against it.
  const namedNationalHours = nationalRequirements.reduce((sum, requirement) => sum + primaryHours(requirement.spec), 0);
  const selfAllocatedHours = round2(set.totalHours - namedNationalHours);

  const yearBounds = cpdYearBounds(set.year);

  return (
    <>
      <CmeNavHeader title="Programme" />
      <InformationPageShell testId="cme-programme-page">
        <h1 className="sr-only">Programme</h1>

        <section
          id="cme-national-baseline"
          data-testid="cme-national-baseline"
          className={cn(inPageAnchor, cardSurface, "flex flex-col gap-3 p-4")}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">The national baseline</h2>
            <span className="shrink-0 text-2xs font-bold uppercase tracking-wide text-[color:var(--text-muted)]">
              As you confirmed it
            </span>
          </div>
          <dl className="divide-y divide-[color:var(--border)]">
            <TargetRowView row={{ id: "total", label: "Total each year", value: formatHours(set.totalHours) }} />
            {nationalRows.map((row) => (
              <TargetRowView key={row.id} row={row} />
            ))}
            {selfAllocatedHours > 0.004 ? (
              <TargetRowView
                row={{
                  id: "self-allocated",
                  label: "Yours to allocate",
                  meta: "Any category",
                  value: formatHours(selfAllocatedHours),
                }}
              />
            ) : null}
          </dl>
        </section>

        <section
          id="cme-college-extras"
          data-testid="cme-college-extras"
          className={cn(inPageAnchor, cardSurface, "flex flex-col gap-3 p-4")}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Your college&rsquo;s extras</h2>
            <button type="button" onClick={onAddCollegeRequirement ?? noop} className={floatingControl}>
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              Add
            </button>
          </div>
          {collegeRows.length > 0 ? (
            <dl className="divide-y divide-[color:var(--border)]">
              {collegeRows.map((row) => (
                <TargetRowView key={row.id} row={row} />
              ))}
            </dl>
          ) : (
            <p className="text-sm text-[color:var(--text-muted)]">
              Nothing added yet — the national requirement above applies on its own.
            </p>
          )}
          <p className="text-xs leading-relaxed text-[color:var(--text-muted)]">
            Extras sit on top of the baseline; they never replace it.
          </p>
        </section>

        <section
          id="cme-provenance"
          data-testid="cme-provenance"
          className={cn(
            inPageAnchor,
            "flex flex-col gap-2 rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-4",
          )}
        >
          <p className="text-sm font-extrabold text-[color:var(--text-heading)]">These are your numbers, not ours</p>
          <p className="text-sm leading-relaxed text-[color:var(--text)]">
            Confirmed by you on {formatCalendarDate(set.confirmedOn)}, against {set.confirmedSource}.
          </p>
          <p data-testid="cme-no-lookup" className="text-xs leading-relaxed text-[color:var(--text-muted)]">
            The app never looks up a requirement on its own, and it never changes one without you.
          </p>
          <button type="button" onClick={onReconfirm ?? noop} className={cn(floatingControl, "w-full")}>
            Re-confirm against this year&rsquo;s guide
          </button>
        </section>

        <section id="cme-year-shape" data-testid="cme-year-shape" className={cn(inPageAnchor, "flex flex-col gap-1.5")}>
          <p className="text-xs leading-relaxed text-[color:var(--text-muted)]">
            Your {set.year} CPD year, as this app tracks it, runs from {formatCalendarDate(yearBounds.start)} to{" "}
            {formatCalendarDate(yearBounds.end)}.
          </p>
          <p className="text-xs leading-relaxed text-[color:var(--text-muted)]">
            Changing your status next year does not rewrite this one — each year keeps the requirements that applied
            to it.
          </p>
        </section>
      </InformationPageShell>
    </>
  );
}
