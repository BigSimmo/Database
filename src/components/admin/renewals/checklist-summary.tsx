import { Diamond, Triangle } from "lucide-react";

import { modeModuleSurface } from "@/components/mode-kit/recipes";
import { cn, textMuted } from "@/components/ui-primitives";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import type { RequirementChecklistRow } from "@/lib/admin/requirements";

/** `YYYY-MM-DD` -> the calendar-month index (0-11) it falls in, Perth calendar. */
function monthIndex(date: string): number {
  return Number(date.slice(5, 7)) - 1;
}

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;

/**
 * The twelve-month timeline (final design, screens-v3): one row per item due
 * for action, a bar from today to its start-renewing date, a mark at its
 * expiry (a filled triangle for a row still open to renew, a filled diamond
 * for one already passed). A light, faithful recreation rather than a
 * pixel-identical port of the mockup's drawing — the shapes, the "today" line
 * and the twelve month letters are what a reader actually reads off it.
 *
 * Shown for at most the five soonest rows with a usable date, so the chart
 * never grows taller than the list above it; the list itself carries the
 * full count.
 */
function ChecklistTimeline({
  rows,
  now,
  testId,
}: {
  readonly rows: readonly RequirementChecklistRow[];
  readonly now: Date;
  readonly testId?: string;
}) {
  const today = perthCalendarDate(now);
  const dated = rows.filter((row): row is RequirementChecklistRow & { expiresOn: string } => Boolean(row.expiresOn));
  if (dated.length === 0) return null;
  const items = dated.slice(0, 5);
  const startMonth = monthIndex(today);
  const monthLabels = Array.from({ length: 12 }, (_, offset) => MONTH_LETTERS[(startMonth + offset) % 12]);
  // 12 month-wide columns from "today"'s month; a date beyond the twelfth
  // column clamps to the last one rather than overflowing the chart.
  const columnOf = (date: string) => {
    const months = (Number(date.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + (monthIndex(date) - startMonth);
    return Math.min(Math.max(months, 0), 11);
  };
  return (
    <div
      data-testid={testId}
      className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-2 gap-y-1.5 border-t border-[color:var(--border)] pt-3"
    >
      {items.map((row) => {
        const passed = row.expiresOn < today;
        const Mark = passed ? Diamond : Triangle;
        const column = columnOf(row.expiresOn);
        return (
          <span key={row.item.id} className="contents">
            <span className={cn(textMuted, "self-center truncate text-xs")}>{row.item.title}</span>
            <span className="relative h-4 self-center">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-px bg-[color:var(--clinical-accent)]"
                style={{ left: "0%" }}
              />
              {/* Shape, not shade (M8): a triangle still open to renew, a
                  diamond already passed — the same shapes the list's status
                  words carry, so the mark never depends on colour alone. */}
              <Mark
                aria-hidden="true"
                data-mark={passed ? "diamond" : "triangle"}
                strokeWidth={1.75}
                className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 fill-current text-[color:var(--text-muted)]"
                style={{ left: `${(column / 12) * 100}%` }}
              />
            </span>
          </span>
        );
      })}
      <span aria-hidden="true" className="col-span-2 mt-1 flex justify-between text-3xs text-[color:var(--text-muted)]">
        {monthLabels.map((letter, index) => (
          <span key={index}>{letter}</span>
        ))}
      </span>
    </div>
  );
}

/**
 * The count module at the top of the Checklist tab: "7 of 10 recorded · 1 not
 * for this job", "Dates you entered, not a check", then the timeline above.
 * The count is in words, never a percentage or a verdict (spec rule 10).
 */
export function ChecklistSummary({
  rows,
  recorded,
  total,
  notForThisJob,
  now,
  testId,
}: {
  readonly rows: readonly RequirementChecklistRow[];
  readonly recorded: number;
  readonly total: number;
  readonly notForThisJob: number;
  readonly now: Date;
  readonly testId?: string;
}) {
  const soonest = rows.filter((row) => row.state === "needs-action");
  return (
    <div className={cn(modeModuleSurface, "grid min-w-0 gap-3 p-3")} data-testid={testId}>
      <div className="grid gap-0.5">
        <p className="text-base-minus font-medium text-[color:var(--text-heading)]">
          {`${recorded} of ${total} recorded`}
          {notForThisJob > 0 ? (
            <span className={cn(textMuted, "font-normal")}>{` · ${notForThisJob} not for this job`}</span>
          ) : null}
        </p>
        <p className={cn(textMuted, "text-xs")}>Dates you entered, not a check</p>
      </div>
      <ChecklistTimeline rows={soonest} now={now} testId={testId ? `${testId}-timeline` : undefined} />
    </div>
  );
}
