"use client";

import { Check } from "lucide-react";

import { cn, textMuted } from "@/components/ui-primitives";
import { daysInCpdYear } from "@/lib/cme/cpd-year";
import { cmeCategories, cmeCategoryLabels, type CmeCategory, type CmeEntry } from "@/lib/cme/types";

/**
 * The dashboard's pictures: how this year's hours split across the three
 * categories, a small bar per requirement, and hours-so-far against an even
 * pace to 31 December.
 *
 * Colour here names a CATEGORY, never a status — the mode's rule is that
 * shortfall reads through position, weight and words, not red or green. Every
 * picture carries its meaning in text beside it, so it still reads in forced
 * colours, in greyscale, and to a screen reader.
 */

/** Category colours, from the shared tone tokens (light and dark variants live in globals.css). */
const CATEGORY_FILL: Record<CmeCategory, string> = {
  educational: "bg-[color:var(--tone-indigo)]",
  reviewing: "bg-[color:var(--tone-purple)]",
  measuring: "bg-[color:var(--tone-rose)]",
};

const CATEGORY_SHORT: Record<CmeCategory, string> = {
  educational: "Educational",
  reviewing: "Reviewing",
  measuring: "Outcomes",
};

function formatHours(hours: number): string {
  return Number(hours.toFixed(2)).toString();
}

function activeEntries(entries: readonly CmeEntry[]): readonly CmeEntry[] {
  return entries.filter((entry) => !entry.archivedAt);
}

export function hoursByCategory(entries: readonly CmeEntry[]): Record<CmeCategory, number> {
  const totals: Record<CmeCategory, number> = { educational: 0, reviewing: 0, measuring: 0 };
  for (const entry of activeEntries(entries)) {
    for (const allocation of entry.allocations) totals[allocation.category] += allocation.hours;
  }
  return totals;
}

/**
 * One bar, three coloured parts, against the year's total target. The legend
 * underneath says each category's hours in words — the colours only help the
 * eye find them.
 */
export function CmeCategoryBar({ entries, targetHours }: { entries: readonly CmeEntry[]; targetHours: number }) {
  const totals = hoursByCategory(entries);
  const logged = cmeCategories.reduce((sum, category) => sum + totals[category], 0);
  const scale = Math.max(targetHours, logged, 1);

  return (
    <div data-testid="cme-category-bar">
      <p className="mb-1.5 text-sm font-medium text-[color:var(--text)]">By category</p>
      <div
        aria-hidden="true"
        className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-[color:var(--surface-inset)] shadow-[var(--shadow-inset)]"
      >
        {cmeCategories.map((category) =>
          totals[category] > 0 ? (
            <span
              key={category}
              data-category={category}
              className={cn("h-full forced-colors:bg-[CanvasText]", CATEGORY_FILL[category])}
              style={{ width: `${(totals[category] / scale) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Hours by category">
        {cmeCategories.map((category) => (
          <li key={category} className="flex items-center gap-1.5 text-xs text-[color:var(--text)]">
            <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", CATEGORY_FILL[category])} />
            <span title={cmeCategoryLabels[category]}>{CATEGORY_SHORT[category]}</span>
            <span className="nums font-semibold">{formatHours(totals[category])} h</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A slim bar under one requirement, with a tick once it is met. The summary
 * sentence beside it ("3 hours short") stays the thing that is read out; the
 * bar is only for the eye.
 */
export function CmeRequirementMeter({
  progress,
  met,
}: {
  progress: { value: number; target: number } | null;
  met: boolean;
}) {
  if (!progress || progress.target <= 0) {
    return met ? <Check aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text)]" /> : null;
  }
  const fraction = Math.max(0, Math.min(1, progress.value / progress.target));
  return (
    <div className="flex items-center gap-2" data-testid="cme-requirement-meter">
      <span
        aria-hidden="true"
        className="block h-1.5 w-20 overflow-hidden rounded-full bg-[color:var(--surface-inset)] shadow-[var(--shadow-inset)]"
      >
        <span
          className="block h-full origin-left rounded-full bg-[color:var(--command)] forced-colors:bg-[CanvasText]"
          style={{ transform: `scaleX(${fraction})` }}
        />
      </span>
      {met ? <Check aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text)]" /> : null}
    </div>
  );
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 112;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;

function dayIndex(dateIso: string, year: number): number {
  const day = Date.parse(`${dateIso}T00:00:00Z`);
  const start = Date.parse(`${year}-01-01T00:00:00Z`);
  return Math.round((day - start) / 86_400_000);
}

const MONTH_TICKS = [
  { month: 1, label: "Jan" },
  { month: 4, label: "Apr" },
  { month: 7, label: "Jul" },
  { month: 10, label: "Oct" },
] as const;

/**
 * Hours logged so far, as a rising line, against a straight dashed line from
 * nothing on 1 January to the target on 31 December. Above the dashed line is
 * ahead of an even pace; below it is behind. The chart is one image with a
 * sentence for its name, so a screen reader hears the comparison, not points.
 */
export function CmePaceChart({
  entries,
  year,
  targetHours,
  todayIndex,
}: {
  entries: readonly CmeEntry[];
  year: number;
  targetHours: number;
  /** Days since 1 January (0-based) for "today", or null for a past year shown whole. */
  todayIndex: number | null;
}) {
  const yearDays = daysInCpdYear(year);
  const lastDay = yearDays - 1;
  const endIndex = todayIndex === null ? lastDay : Math.max(0, Math.min(lastDay, todayIndex));

  const perDay = new Map<number, number>();
  for (const entry of activeEntries(entries)) {
    if (!entry.date.startsWith(`${year}-`)) continue;
    const index = dayIndex(entry.date, year);
    if (index < 0 || index > endIndex) continue;
    const hours = entry.allocations.reduce((sum, allocation) => sum + allocation.hours, 0);
    perDay.set(index, (perDay.get(index) ?? 0) + hours);
  }
  const days = [...perDay.keys()].sort((a, b) => a - b);
  let running = 0;
  const steps: Array<{ day: number; hours: number }> = [{ day: 0, hours: 0 }];
  for (const day of days) {
    steps.push({ day, hours: running });
    running += perDay.get(day) ?? 0;
    steps.push({ day, hours: running });
  }
  steps.push({ day: endIndex, hours: running });

  const maxHours = Math.max(targetHours, running, 1) * 1.05;
  const plotWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const x = (day: number) => PAD_LEFT + (day / lastDay) * plotWidth;
  const y = (hours: number) => PAD_TOP + plotHeight - (hours / maxHours) * plotHeight;

  const linePoints = steps.map((step) => `${x(step.day).toFixed(1)},${y(step.hours).toFixed(1)}`).join(" ");
  const evenPaceToday = (targetHours * (endIndex + 1)) / yearDays;
  const ahead = running >= evenPaceToday;
  const description =
    todayIndex === null
      ? `${formatHours(running)} hours logged in ${year}, against a target of ${formatHours(targetHours)}.`
      : `${formatHours(running)} hours logged so far. An even pace to ${formatHours(targetHours)} hours by 31 December would be about ${Math.round(evenPaceToday)} by today, so you are ${ahead ? "ahead of" : "behind"} that pace.`;

  return (
    <figure data-testid="cme-pace-chart" className="m-0">
      <svg
        role="img"
        aria-label={description}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="block h-auto w-full overflow-visible"
      >
        {/* Target level. */}
        <line
          x1={PAD_LEFT}
          x2={CHART_WIDTH - PAD_RIGHT}
          y1={y(targetHours)}
          y2={y(targetHours)}
          className="stroke-[color:var(--border)]"
          strokeWidth={1}
        />
        {/* Even pace: nothing on 1 January to the target on 31 December. */}
        <line
          data-testid="cme-pace-chart-even"
          x1={x(0)}
          y1={y(0)}
          x2={x(lastDay)}
          y2={y(targetHours)}
          className="stroke-[color:var(--text-muted)]"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        {/* Hours logged. */}
        <polyline
          data-testid="cme-pace-chart-logged"
          points={linePoints}
          fill="none"
          className="stroke-[color:var(--command)] forced-colors:stroke-[CanvasText]"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={x(endIndex)}
          cy={y(running)}
          r={4}
          className="fill-[color:var(--command)] forced-colors:fill-[CanvasText]"
        />
        {MONTH_TICKS.map((tick) => {
          const index = dayIndex(`${year}-${String(tick.month).padStart(2, "0")}-01`, year);
          return (
            <text
              key={tick.label}
              x={x(index)}
              y={CHART_HEIGHT - 4}
              className="fill-[color:var(--text-muted)] text-2xs"
            >
              {tick.label}
            </text>
          );
        })}
      </svg>
      <figcaption className={cn(textMuted, "mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs")}>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-[color:var(--command)]" />
          Hours logged
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-[color:var(--text-muted)]" />
          Even pace to {formatHours(targetHours)} h
        </span>
      </figcaption>
    </figure>
  );
}
