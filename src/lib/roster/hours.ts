import { isWorkedKind, type ShiftKind } from "@/lib/roster/shift-kind";
import { addDaysToDate, perthDateOf } from "@/lib/roster/shifts/perth-time";

/**
 * Hours: rostered hours and fatigue facts for a fortnight. Facts only: this is
 * not pay, and in Release 1 no limit is shown because a doctor on their own has
 * no team rules. On call from home and leave are not worked hours. A shift's
 * hours belong to the day it starts, as they do on a printed roster.
 */

export type HoursShift = { readonly startsAt: string; readonly endsAt: string; readonly kind: ShiftKind };
/** One extra-time record from the shared record Admin owns. `endedAt` is null while it is still running. */
export type HoursExtra = { readonly startedAt: string; readonly endedAt: string | null };

export type HoursSummary = {
  /** Perth dates, inclusive. */
  readonly start: string;
  readonly end: string;
  readonly totalHours: number;
  readonly days: { readonly date: string; readonly hours: number; readonly extraHours: number }[];
  /** Shortest gap between two worked shifts that touch the fortnight; null with fewer than two. */
  readonly shortestBreakHours: number | null;
  readonly maxHoursIn7Days: number;
  readonly maxDaysInRow: number;
  readonly maxNightsInRow: number;
  readonly extraHours: number;
};

const HOUR = 60 * 60 * 1000;

function hoursOf(startsAt: string, endsAt: string): number {
  return (Date.parse(endsAt) - Date.parse(startsAt)) / HOUR;
}

function round(hours: number): number {
  return Math.round(hours * 100) / 100;
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / (24 * HOUR));
}

/**
 * The fortnight holding `today`. With a pay-fortnight start date it lines up
 * with pay; without one it starts on the Monday of last week.
 */
export function fortnightFor(today: string, anchor: string | null): { start: string; end: string } {
  let start: string;
  if (anchor) {
    const offset = ((daysBetween(anchor, today) % 14) + 14) % 14;
    start = addDaysToDate(today, -offset);
  } else {
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    start = addDaysToDate(today, -weekday - 7);
  }
  return { start, end: addDaysToDate(start, 13) };
}

/** The longest run of consecutive dates in `dates` that touches the window. */
function longestRun(dates: ReadonlySet<string>, window: { start: string; end: string }): number {
  let best = 0;
  for (const date of dates) {
    if (dates.has(addDaysToDate(date, -1))) continue;
    let length = 1;
    while (dates.has(addDaysToDate(date, length))) length += 1;
    const last = addDaysToDate(date, length - 1);
    if (last >= window.start && date <= window.end) best = Math.max(best, length);
  }
  return best;
}

export function summariseHours(
  shifts: readonly HoursShift[],
  extras: readonly HoursExtra[],
  window: { start: string; end: string },
): HoursSummary {
  const worked = shifts
    .filter((shift) => isWorkedKind(shift.kind))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const hoursByDate = new Map<string, number>();
  for (const shift of worked) {
    const date = perthDateOf(shift.startsAt);
    hoursByDate.set(date, (hoursByDate.get(date) ?? 0) + hoursOf(shift.startsAt, shift.endsAt));
  }
  const extraByDate = new Map<string, number>();
  for (const extra of extras) {
    if (!extra.endedAt) continue;
    const date = perthDateOf(extra.startedAt);
    extraByDate.set(date, (extraByDate.get(date) ?? 0) + hoursOf(extra.startedAt, extra.endedAt));
  }

  const days = Array.from({ length: daysBetween(window.start, window.end) + 1 }, (_, index) => {
    const date = addDaysToDate(window.start, index);
    return { date, hours: round(hoursByDate.get(date) ?? 0), extraHours: round(extraByDate.get(date) ?? 0) };
  });

  let maxHoursIn7Days = 0;
  for (let offset = -6; offset <= daysBetween(window.start, window.end); offset += 1) {
    const first = addDaysToDate(window.start, offset);
    let sum = 0;
    for (let day = 0; day < 7; day += 1) sum += hoursByDate.get(addDaysToDate(first, day)) ?? 0;
    maxHoursIn7Days = Math.max(maxHoursIn7Days, sum);
  }

  let shortestBreakHours: number | null = null;
  for (let index = 1; index < worked.length; index += 1) {
    const before = worked[index - 1]!;
    const after = worked[index]!;
    const touches = perthDateOf(after.startsAt) >= window.start && perthDateOf(before.startsAt) <= window.end;
    if (!touches) continue;
    const gap = Math.max(0, hoursOf(before.endsAt, after.startsAt));
    shortestBreakHours = shortestBreakHours === null ? gap : Math.min(shortestBreakHours, gap);
  }

  const workedDates = new Set(worked.map((shift) => perthDateOf(shift.startsAt)));
  const nightDates = new Set(
    worked.filter((shift) => shift.kind === "night").map((shift) => perthDateOf(shift.startsAt)),
  );

  return {
    start: window.start,
    end: window.end,
    totalHours: round(days.reduce((total, day) => total + day.hours, 0)),
    days,
    shortestBreakHours: shortestBreakHours === null ? null : round(shortestBreakHours),
    maxHoursIn7Days: round(maxHoursIn7Days),
    maxDaysInRow: longestRun(workedDates, window),
    maxNightsInRow: longestRun(nightDates, window),
    extraHours: round(days.reduce((total, day) => total + day.extraHours, 0)),
  };
}
