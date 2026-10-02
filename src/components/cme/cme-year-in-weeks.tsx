"use client";

import { useMemo } from "react";

import { cn } from "@/components/ui-primitives";
import type { CmeEntry } from "@/lib/cme/types";

const TOTAL_WEEKS = 53;
const MAX_BAR_HEIGHT = 28; // pixels
const MIN_ACTIVE_BAR_HEIGHT = 4; // pixels
const FUTURE_STUB_HEIGHT = 3; // pixels

export type WeekHours = {
  readonly weekIndex: number;
  readonly hours: number;
  readonly isCurrent: boolean;
  readonly isPast: boolean;
  readonly isFuture: boolean;
};

export function calculateYearWeeks(
  entries: readonly CmeEntry[],
  year: number,
  now: Date,
): {
  readonly weeks: readonly WeekHours[];
  readonly currentWeekIndex: number;
  readonly weeksToGo: number;
  readonly maxWeekHours: number;
} {
  const startOfYear = Date.parse(`${year}-01-01T00:00:00+08:00`);
  const nowMs = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;

  const nowYear = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Perth", year: "numeric" }).format(now);
  const currentYearNum = Number(nowYear);

  let currentWeekIndex = -1;
  let weeksToGo = 0;
  if (currentYearNum === year) {
    const currentDayIndex = Math.max(0, Math.floor((nowMs - startOfYear) / dayMs));
    currentWeekIndex = Math.min(TOTAL_WEEKS - 1, Math.max(0, Math.floor(currentDayIndex / 7)));
    weeksToGo = Math.max(0, TOTAL_WEEKS - 1 - currentWeekIndex);
  } else if (currentYearNum < year) {
    currentWeekIndex = -1;
    weeksToGo = TOTAL_WEEKS;
  } else {
    currentWeekIndex = TOTAL_WEEKS;
    weeksToGo = 0;
  }

  // Group active entry hours by 7-day bucket
  const weekSums = new Array<number>(TOTAL_WEEKS).fill(0);

  for (const entry of entries) {
    if (entry.archivedAt) continue;
    if (!entry.date.startsWith(`${year}-`)) continue;
    const entryMs = Date.parse(`${entry.date}T00:00:00+08:00`);
    const dayOffset = Math.floor((entryMs - startOfYear) / dayMs);
    if (dayOffset < 0) continue;
    const weekIdx = Math.min(TOTAL_WEEKS - 1, Math.floor(dayOffset / 7));
    const hours = entry.allocations.reduce((sum, a) => sum + a.hours, 0);
    weekSums[weekIdx] += hours;
  }

  let maxWeekHours = 4; // reasonable floor so 1h doesn't cap at 100%
  for (const sum of weekSums) {
    if (sum > maxWeekHours) maxWeekHours = sum;
  }

  const weeks: WeekHours[] = weekSums.map((hours, weekIndex) => ({
    weekIndex,
    hours,
    isCurrent: weekIndex === currentWeekIndex,
    isPast: weekIndex < currentWeekIndex,
    isFuture: weekIndex > currentWeekIndex,
  }));

  return { weeks, currentWeekIndex, weeksToGo, maxWeekHours };
}

export function CmeYearInWeeks({
  entries,
  year,
  now,
  testId = "cme-year-in-weeks",
}: {
  readonly entries: readonly CmeEntry[];
  readonly year: number;
  readonly now: Date;
  readonly testId?: string;
}) {
  const { weeks, weeksToGo, maxWeekHours } = useMemo(
    () => calculateYearWeeks(entries, year, now),
    [entries, year, now],
  );

  const ariaDescription = `Hours logged in each week of ${year}, this week highlighted; ${weeksToGo} weeks to go`;

  return (
    <figure
      data-testid={testId}
      aria-label={ariaDescription}
      className="m-0 grid gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-xs"
    >
      <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">Your year in weeks</span>
        <span className="text-2xs font-normal">{weeksToGo === 0 ? "Year complete" : `${weeksToGo} weeks to go`}</span>
      </div>

      <div className="flex h-8 items-end justify-between gap-px pt-1" role="group" aria-hidden="true">
        {weeks.map((w) => {
          let heightPx = FUTURE_STUB_HEIGHT;
          if (w.isPast || w.isCurrent) {
            if (w.hours > 0) {
              const scaled = (w.hours / maxWeekHours) * MAX_BAR_HEIGHT;
              heightPx = Math.max(MIN_ACTIVE_BAR_HEIGHT, Math.min(MAX_BAR_HEIGHT, Math.round(scaled)));
            } else {
              heightPx = 2;
            }
          }

          return (
            <span
              key={w.weekIndex}
              data-testid={`${testId}-bar-${w.weekIndex}`}
              title={`Week ${w.weekIndex + 1}: ${w.hours.toFixed(1)} h`}
              style={{ height: `${heightPx}px` }}
              className={cn(
                "w-full min-w-0.5 rounded-xs transition-all",
                w.isCurrent &&
                  "bg-[color:var(--command,#3b82f6)] ring-1 ring-[color:var(--command,#3b82f6)] ring-offset-1",
                w.isPast && w.hours > 0 && "bg-[color:var(--tone-indigo,#6366f1)]",
                w.isPast && w.hours === 0 && "bg-[color:var(--surface-inset)]",
                w.isFuture && "bg-[color:var(--surface-inset)] opacity-60",
              )}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-2xs text-[color:var(--text-muted)]" aria-hidden="true">
        <span>1 Jan</span>
        <span>Jul</span>
        <span>31 Dec</span>
      </div>
    </figure>
  );
}
