"use client";

import {
  CalendarClock,
  CalendarDays,
  ListChecks,
  NotebookPen,
  Settings2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cardSurface } from "@/components/card-recipes";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import {
  CPD_PACE_MINIMUM_ELAPSED_DAYS,
  cpdYearBounds,
  cpdYearOf,
  daysElapsedInCpdYear,
  daysInCpdYear,
  daysRemainingInCpdYear,
  paceProjection,
  perthCalendarDate,
} from "@/lib/cme/cpd-year";
import { evaluateYear } from "@/lib/cme/evaluate";
import { cmeDashboardModuleLabels, useCmeModuleOrder, type CmeDashboardModuleId } from "@/lib/cme/module-order";
import {
  cmeRoutineCadenceLabels,
  formatRoutineDueDate,
  formatRoutineHours,
  routineLogPrefill,
  routinesDueOn,
  type CmeRoutine,
  type CmeRoutineLogPrefill,
} from "@/lib/cme/routines";
import type { CmeEntry, CmeRequirementSet, CmeRequirementSpec, CmeRequirementStatus } from "@/lib/cme/types";

/**
 * THE DASHBOARD — the screen the whole mode is judged by.
 *
 * Three things sit above the fold, unconditionally, in this order: the
 * total-hours figure with its progress bar and pace mark, the pace sentence
 * (silent whenever `paceProjection` cannot yet say anything useful), and one
 * computed next action. Everything below that line is a module the owner can
 * reorder or hide — see `useCmeModuleOrder` and `CmeCustomisePage`.
 *
 * The screen has three seasons, driven entirely by `now` against the CPD
 * year in `set`, never by anything this component decides on its own:
 *   - **Early year** (fewer than `CPD_PACE_MINIMUM_ELAPSED_DAYS` elapsed): no
 *     pace mark, no pace sentence — a rate from a handful of days is noise —
 *     and the next action points at the development plan.
 *   - **Tracking** (the rest of the year): the mark, the sentence, and a next
 *     action computed from whichever requirement is furthest from met.
 *   - **Closing the year** (the last fortnight): the next action becomes the
 *     year-end checklist, regardless of what is or is not yet met.
 *
 * Nothing here is a status colour. Shortfall reads through position (an unmet
 * requirement sorts first), weight (its label is bold) and wording (the
 * summary sentence says how far short) — never through red, amber or green.
 */

/** How close to 31 December the one action turns from tracking into the year-end checklist. */
const CLOSE_YEAR_WINDOW_DAYS = 14;

const FULL_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "2026-12-31" -> "31 December". No year: the dashboard only ever means the year it is already showing. */
function formatDayFullMonth(dateIso: string): string {
  const [, month, day] = dateIso.split("-");
  const monthIndex = Number.parseInt(month, 10) - 1;
  return `${Number.parseInt(day, 10)} ${FULL_MONTH_NAMES[monthIndex]}`;
}

/** "32.5", never "32.50" — and a whole number drops its decimal point, so a legitimate zero reads as a plain "0". */
function formatCmeHours(hours: number): string {
  return Number(hours.toFixed(2)).toString();
}

const MODULE_ICONS: Record<CmeDashboardModuleId, LucideIcon> = {
  requirements: ListChecks,
  "routines-due": CalendarClock,
  "audited-today": NotebookPen,
  "year-dates": CalendarDays,
  provenance: ShieldCheck,
};

export type CmeDashboardProps = {
  readonly set: CmeRequirementSet;
  readonly entries: readonly CmeEntry[];
  /**
   * The instant "now" is evaluated against — required, not defaulted, so a
   * server render and the client it hydrates into always agree on which
   * season the dashboard is in.
   */
  readonly now: Date;
  /** Every routine the owner has, active or archived. Defaults to none. */
  readonly routines?: readonly CmeRoutine[];
  /**
   * Called when the owner taps "Log" on a routine that is due, with
   * everything the entry form needs pre-filled. Defaults to a no-op: nothing
   * on this screen logs an entry by itself, the same guarantee
   * `CmeRoutinesPage` makes.
   */
  readonly onLogRoutine?: (prefill: CmeRoutineLogPrefill) => void;
  /**
   * Called when the owner taps "Customise". Defaults to a no-op so this
   * screen still renders sensibly wherever it is not yet wired to a route.
   */
  readonly onOpenCustomise?: () => void;
};

/**
 * How far short of met one unmet requirement is, on a scale that can be
 * compared ONLY against other requirements in the same tier — see
 * `furthestFromMet` below for why the tiers themselves are not comparable.
 */
type ShortfallTier = 0 | 1 | 2;

function shortfallTier(shape: CmeRequirementSpec["shape"]): ShortfallTier {
  if (shape === "hours-in-category" || shape === "hours-across-categories") return 0;
  if (shape === "activity-count") return 1;
  return 2; // "task"
}

/**
 * Picks whichever unmet requirement is furthest from being met — never
 * simply the first unmet requirement in `set.requirements` order, which is
 * an authoring order, not a distance-from-met order, and can put the
 * requirement that is barely short ahead of one still almost untouched.
 *
 * The four requirement shapes are not on one comparable scale — "3 hours
 * short" and "2 activities still have nothing against them" are different
 * units, and a `task` has no magnitude at all, only done-or-not — so this
 * orders by tier first, then by size of gap within a tier:
 *
 *   1. Hours requirements (`hours-in-category`, `hours-across-categories`),
 *      by hours remaining (`progress.target - progress.value`), largest
 *      first. Hours accrue gradually across the whole year, so a large
 *      hours gap needs the most lead time to close and is the most
 *      consequential thing to surface.
 *   2. `activity-count` requirements, by buckets still empty
 *      (`progress.target - progress.value`), most empty first. These are
 *      usually closable in a single sitting once the owner notices them.
 *   3. Not-started `task` requirements last — `progress` is null, so there
 *      is no gap to compare; ties within this tier keep list order.
 *
 * The sort is stable, so two requirements tied on tier and gap keep their
 * `set.requirements` order — this is what makes the fix degrade to the old
 * "first unmet in list order" behaviour exactly when every unmet
 * requirement in the winning tier is equally far short, rather than
 * changing an answer that was already right.
 */
function furthestFromMet(
  set: CmeRequirementSet,
  unmet: readonly CmeRequirementStatus[],
): CmeRequirementStatus | undefined {
  const ranked = unmet.map((status, index) => {
    const shape = set.requirements.find((requirement) => requirement.id === status.requirementId)?.spec.shape;
    const tier = shape ? shortfallTier(shape) : 2;
    const gap = status.progress ? status.progress.target - status.progress.value : 0;
    return { status, index, tier, gap };
  });
  ranked.sort((a, b) => a.tier - b.tier || b.gap - a.gap || a.index - b.index);
  return ranked[0]?.status;
}

function computeNextAction(args: {
  set: CmeRequirementSet;
  unmet: readonly CmeRequirementStatus[];
  now: Date;
}): string {
  const { set, unmet, now } = args;
  const inRequestedYear = cpdYearOf(now) === set.year;

  if (inRequestedYear && daysRemainingInCpdYear(now, set.year) <= CLOSE_YEAR_WINDOW_DAYS) {
    return "Close the year: check every entry has its evidence attached, then generate your CPD summary before 31 December.";
  }

  if (inRequestedYear && daysElapsedInCpdYear(now, set.year) < CPD_PACE_MINIMUM_ELAPSED_DAYS) {
    return "It's early in the year for a pace projection — a good place to start is your development plan.";
  }

  if (unmet.length === 0) {
    return "Every requirement is met for this year. Keep logging activities as you go.";
  }
  const next = furthestFromMet(set, unmet)!;
  const label =
    set.requirements.find((requirement) => requirement.id === next.requirementId)?.label ?? "Next requirement";
  return `Next: ${label} — ${next.summary}`;
}

function paceSentence(
  pace: { projectedHours: number; shortfallHours: number },
  targetHours: number,
  endLabel: string,
): string {
  const projected = Math.round(pace.projectedHours);
  if (pace.shortfallHours <= 0) {
    return `At this rate, you're on track for about ${projected} hours by ${endLabel} — enough to meet your ${formatCmeHours(targetHours)}-hour target.`;
  }
  const shortfall = Math.round(pace.shortfallHours);
  return `At this rate, you're on track for about ${projected} hours by ${endLabel}, ${shortfall} short of your ${formatCmeHours(targetHours)}-hour target.`;
}

export function CmeDashboard({
  set,
  entries,
  now,
  routines = [],
  onLogRoutine = () => {},
  onOpenCustomise = () => {},
}: CmeDashboardProps) {
  const { moduleIds } = useCmeModuleOrder();
  const { totalHours, statuses, unmet } = evaluateYear({ set, entries });
  const inRequestedYear = cpdYearOf(now) === set.year;
  const pace = inRequestedYear
    ? paceProjection({ hoursSoFar: totalHours, targetHours: set.totalHours, instant: now, year: set.year })
    : null;
  const bounds = cpdYearBounds(set.year);
  const endLabel = formatDayFullMonth(bounds.end);
  const elapsedFraction = inRequestedYear ? daysElapsedInCpdYear(now, set.year) / daysInCpdYear(set.year) : 0;

  const progressValue = set.totalHours > 0 ? Math.min(100, (totalHours / set.totalHours) * 100) : 0;
  const mark = pace
    ? {
        value: Math.min(100, elapsedFraction * 100),
        label: `On an even pace you would have logged about ${Math.round(set.totalHours * elapsedFraction)} hours by today.`,
      }
    : undefined;

  const nextAction = computeNextAction({ set, unmet, now });

  const today = perthCalendarDate(now);
  const loggedToday = entries.filter((entry) => entry.date === today);
  const loggedTodayHours = loggedToday.reduce(
    (sum, entry) => sum + entry.allocations.reduce((inner, allocation) => inner + allocation.hours, 0),
    0,
  );
  const dueRoutines = routinesDueOn(routines, now);
  // Stable sort: unmet first. Position is one of the three channels this mode uses for
  // shortfall instead of colour — see the file-level note above.
  const sortedStatuses = [...statuses].sort((a, b) => Number(a.met) - Number(b.met));

  function requirementLabel(requirementId: string): string {
    return set.requirements.find((requirement) => requirement.id === requirementId)?.label ?? requirementId;
  }

  function handleLogRoutine(routine: CmeRoutine) {
    onLogRoutine(routineLogPrefill(routine, now));
  }

  const moduleContent: Record<CmeDashboardModuleId, ReactNode> = {
    requirements: (
      <ul className="space-y-2">
        {sortedStatuses.map((status) => (
          <li key={status.requirementId} className={cn(cardSurface, "p-3")}>
            <p className={cn("text-sm text-[color:var(--text)]", !status.met && "font-semibold")}>
              {requirementLabel(status.requirementId)}
            </p>
            <p className={cn(textMuted, "text-sm")}>{status.summary}</p>
          </li>
        ))}
      </ul>
    ),
    "routines-due":
      dueRoutines.length > 0 ? (
        <ul className="space-y-2">
          {dueRoutines.map((routine) => (
            <li key={routine.id} className={cn(cardSurface, "flex items-center justify-between gap-3 p-3")}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text)]">{routine.title}</p>
                <p className={cn(textMuted, "text-xs")}>
                  {cmeRoutineCadenceLabels[routine.cadence]} · usually {formatRoutineHours(routine.usualHours)} h
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => handleLogRoutine(routine)}>
                {`Log ${formatRoutineHours(routine.usualHours)} h`}
              </Button>
            </li>
          ))}
        </ul>
      ) : null,
    "audited-today":
      loggedToday.length > 0 ? (
        <p className="text-sm text-[color:var(--text)]">
          {loggedToday.length} {loggedToday.length === 1 ? "activity" : "activities"} logged today,{" "}
          {formatCmeHours(loggedTodayHours)} hours.
        </p>
      ) : (
        <p className={cn(textMuted, "text-sm")}>Nothing logged yet today.</p>
      ),
    "year-dates": (
      <p className={cn(textMuted, "text-sm")}>
        {formatRoutineDueDate(bounds.start)} to {formatRoutineDueDate(bounds.end)}
        {inRequestedYear ? ` · ${daysRemainingInCpdYear(now, set.year)} days left` : ""}
      </p>
    ),
    provenance: (
      <p className={cn(textMuted, "text-sm")}>
        Confirmed by you on {formatRoutineDueDate(set.confirmedOn)}, against {set.confirmedSource}.
      </p>
    ),
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold text-[color:var(--text)]">CME</h1>
        <Button variant="toolbar" size="sm" icon={Settings2} onClick={onOpenCustomise}>
          Customise
        </Button>
      </div>

      <section className={cn(cardSurface, "mt-4 p-4")}>
        <p data-testid="cme-total-hours" className="flex flex-wrap items-baseline gap-1">
          <span className="nums text-3xl font-semibold text-[color:var(--text)]">{formatCmeHours(totalHours)}</span>
          <span className={cn(textMuted, "text-sm")}>of {formatCmeHours(set.totalHours)} hours logged</span>
        </p>
        <div className="mt-3">
          <Progress value={progressValue} label="Hours toward this year's target" mark={mark} />
        </div>
        {pace ? (
          <p data-testid="cme-pace-sentence" className={cn(textMuted, "mt-3 text-sm")}>
            {paceSentence(pace, set.totalHours, endLabel)}
          </p>
        ) : null}
        <p data-testid="cme-next-action" className="mt-3 text-sm font-medium text-[color:var(--text)]">
          {nextAction}
        </p>
      </section>

      <div className="mt-6 space-y-6">
        {moduleIds.map((moduleId) => {
          const content = moduleContent[moduleId];
          if (content === null) return null;
          const Icon = MODULE_ICONS[moduleId];
          return (
            <section key={moduleId} aria-labelledby={`cme-module-${moduleId}-heading`} data-testid={`cme-${moduleId}`}>
              <h2 id={`cme-module-${moduleId}-heading`} className={cn(eyebrowText, "flex items-center gap-1.5")}>
                <Icon aria-hidden="true" className="size-icon-sm" />
                {cmeDashboardModuleLabels[moduleId]}
              </h2>
              <div className="mt-2">{content}</div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
