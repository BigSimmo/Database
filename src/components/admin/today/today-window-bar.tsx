import type { CSSProperties } from "react";

import { onCallTeachingDateParts } from "@/lib/on-call/teaching-schedule";

const DAY_MS = 86_400_000;

function dayIndex(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}

/** "16 Sep": day and short month, no year — the window bar's own two end labels. */
function shortDate(date: string): string {
  const { day, month } = onCallTeachingDateParts(date);
  return day && month ? `${day} ${month}` : date;
}

/**
 * The lead-time window drawing on the "Renew next" card: a track from the day
 * renewing opens to the recorded date, with today marked on it. Grey only —
 * this is a picture of a date range, not a verdict.
 *
 * `today` may fall before, on or after the window; the marker clamps to the
 * track so a passed date still draws (fully filled, today past the end)
 * rather than overflowing it, and the "Today" label stays inside the bar's
 * own bounds at either end.
 */
export function TodayWindowBar({ start, end, today }: { start: string; end: string; today: string }) {
  const startIndex = dayIndex(start);
  const endIndex = dayIndex(end);
  const span = endIndex - startIndex;
  const raw = span > 0 ? (dayIndex(today) - startIndex) / span : 1;
  const percent = Math.max(0, Math.min(1, raw)) * 100;

  return (
    <div className="grid gap-1.5" data-testid="admin-today-renew-next-window">
      {/* One measured value, `--today-at`, drives the label, the fill and the
          marker, so the three can never disagree. */}
      <div
        className="relative pt-4"
        style={{ "--today-at": `${percent}%` } as CSSProperties}
        data-testid="admin-today-renew-next-window-track"
      >
        {/* The label slides along its own width as the marker moves: centred
            at the middle, flush left at the start, flush right at the end
            (`left: p%` + `translateX(-p%)`). So it can never spill past the
            card's edge, and the marker always sits under the word. */}
        <span
          className="absolute left-[var(--today-at)] top-0 -translate-x-[var(--today-at)] whitespace-nowrap text-xs font-medium text-[color:var(--text-heading)]"
          data-testid="admin-today-renew-next-window-today"
        >
          Today
        </span>
        <div className="relative h-1.5 w-full overflow-visible rounded-full bg-[color:var(--border)]">
          <div className="h-full w-[var(--today-at)] rounded-full bg-[color:var(--text-muted)]" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute left-[var(--today-at)] top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--text-heading)]"
          />
          <span
            aria-hidden="true"
            className="absolute right-0 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-[color:var(--text-heading)]"
          />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)]">
        <span>Opens {shortDate(start)}</span>
        <span className="text-[color:var(--text-heading)]">{shortDate(end)}</span>
      </div>
    </div>
  );
}
