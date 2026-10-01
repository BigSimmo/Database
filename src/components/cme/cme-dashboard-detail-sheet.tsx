"use client";

import Link from "next/link";

import { cardSurface } from "@/components/card-recipes";
import { formatCmeHours } from "@/components/cme/cme-dashboard-next-step";
import { Sheet } from "@/components/ui/sheet";
import { cn, textMuted } from "@/components/ui-primitives";
import type { CmeRoutineGapScenario } from "@/lib/cme/pace";
import { describeConfirmedSource } from "@/lib/cme/presets";
import { formatRoutineDueDate } from "@/lib/cme/routines";
import {
  cmeCategories,
  cmeCategoryLabels,
  type CmeEntry,
  type CmeRequirement,
  type CmeRequirementSet,
  type CmeRequirementStatus,
} from "@/lib/cme/types";

/** What Today's detail sheet is showing: the year's hours, the gap to the total, or one requirement by id. */
export type CmeTodayDetail = "hours" | "gap" | string | null;

function contribution(entry: CmeEntry, requirement?: CmeRequirement): number {
  if (!requirement) return entry.allocations.reduce((sum, item) => sum + item.hours, 0);
  const { spec } = requirement;
  if (spec.shape === "hours-in-category")
    return entry.allocations
      .filter((item) => item.category === spec.category)
      .reduce((sum, item) => sum + item.hours, 0);
  if (spec.shape === "hours-across-categories")
    return entry.allocations
      .filter((item) => spec.categories.includes(item.category))
      .reduce((sum, item) => sum + item.hours, 0);
  if (spec.shape === "credited-hours")
    return Math.min(
      entry.formalPeerReviewHours ?? 0,
      entry.allocations.filter((item) => item.category === "reviewing").reduce((sum, item) => sum + item.hours, 0),
    );
  return 0;
}

function filteredLogHref(year: number, requirement?: CmeRequirement): string {
  const category = requirement?.spec.shape === "hours-in-category" ? requirement.spec.category : null;
  return `/cme/log?year=${year}${category ? `&category=${category}` : ""}`;
}

/**
 * Today's one detail sheet. Every figure on Today opens here rather than
 * leaving the page: the hero's hours (what makes them up, by category), an
 * hours requirement from "What's left" (which activities count toward it, and
 * Log filtered to them), and the catch-up card's routine scenarios. Each says
 * where its target came from, because this app does not certify it.
 */
export function CmeTodayDetailSheet({
  detail,
  onClose,
  set,
  statuses,
  yearEntries,
  totalHours,
  totalGap,
  gapScenarios,
}: {
  detail: CmeTodayDetail;
  onClose: () => void;
  set: CmeRequirementSet;
  statuses: readonly CmeRequirementStatus[];
  /** This year's unarchived activities. */
  yearEntries: readonly CmeEntry[];
  totalHours: number;
  totalGap: number;
  gapScenarios: readonly CmeRoutineGapScenario[];
}) {
  const detailRequirement =
    detail && detail !== "hours" && detail !== "gap"
      ? set.requirements.find((requirement) => requirement.id === detail)
      : undefined;
  const detailStatus = detailRequirement
    ? statuses.find((status) => status.requirementId === detailRequirement.id)
    : undefined;
  const detailedEntries = yearEntries.filter((entry) => contribution(entry, detailRequirement) > 0);
  const detailHours = detailRequirement ? (detailStatus?.progress?.value ?? 0) : totalHours;

  return (
    <Sheet
      open={detail !== null}
      onClose={onClose}
      title={detail === "gap" ? "Close the gap" : (detailRequirement?.label ?? "CPD hours")}
      description={detail === "gap" ? "Illustrative routine scenarios" : "What makes up this figure"}
      testId="cme-today-detail-sheet"
    >
      {detail === "gap" ? (
        <div className="space-y-4 text-sm text-[color:var(--text)]">
          <p>
            {formatCmeHours(totalGap)} h remain to your {formatCmeHours(set.totalHours)} h target. This is based on your
            saved entries and the target you confirmed on {formatRoutineDueDate(set.confirmedOn)}.
          </p>
          {gapScenarios.length ? (
            <ul className="space-y-2" data-testid="cme-gap-scenarios">
              {gapScenarios.map((scenario) => (
                <li key={scenario.routineId} className={cn(cardSurface, "p-3")}>
                  <strong>{scenario.title}</strong>: {scenario.occurrences} ×{" "}
                  {formatCmeHours(scenario.hoursPerOccurrence)} h{` = ${formatCmeHours(scenario.projectedHours)} h`}
                  {scenario.closesGap ? null : " by 31 Dec, short of the gap on its own"}
                </li>
              ))}
            </ul>
          ) : (
            <p>No active routine with usual hours is saved. You can still log individual activities.</p>
          )}
          <p className={textMuted}>
            These are examples using your routine templates. Only activities you actually do and save count as CPD; a
            routine never logs itself. Category and other requirements may still need attention.
          </p>
          <Link
            href={`/cme/routines?year=${set.year}`}
            className="inline-flex min-h-tap items-center underline underline-offset-2"
          >
            Review routines
          </Link>
        </div>
      ) : (
        <div className="space-y-4 text-sm text-[color:var(--text)]">
          <p data-testid="cme-today-detail-total">
            <strong>{formatCmeHours(detailHours)} h</strong> from {detailedEntries.length}{" "}
            {detailedEntries.length === 1 ? "saved activity" : "saved activities"} in {set.year}.
          </p>
          {detailRequirement ? (
            <p>
              This {detailRequirement.source === "national" ? "national" : "college"} target was recorded by you on{" "}
              {formatRoutineDueDate(set.confirmedOn)} from {describeConfirmedSource(set.confirmedSource)}. It is not
              independently certified by this app.
            </p>
          ) : (
            <>
              <p>
                Target recorded by you on {formatRoutineDueDate(set.confirmedOn)} from{" "}
                {describeConfirmedSource(set.confirmedSource)}. This app does not independently certify it.
              </p>
              <ul className="space-y-1" aria-label="Hours by category">
                {cmeCategories.map((category) => {
                  const hours = yearEntries.reduce(
                    (sum, entry) =>
                      sum +
                      entry.allocations
                        .filter((item) => item.category === category)
                        .reduce((part, item) => part + item.hours, 0),
                    0,
                  );
                  return (
                    <li key={category} className="flex justify-between gap-3">
                      <span>{cmeCategoryLabels[category]}</span>
                      <span>{formatCmeHours(hours)} h</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <Link
            href={filteredLogHref(set.year, detailRequirement)}
            className="inline-flex min-h-tap items-center underline underline-offset-2"
          >
            {detailRequirement?.spec.shape === "hours-in-category"
              ? `View ${cmeCategoryLabels[detailRequirement.spec.category].toLowerCase()} in Log`
              : "View this year's Log"}
          </Link>
        </div>
      )}
    </Sheet>
  );
}
