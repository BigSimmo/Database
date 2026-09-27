import { CPD_PACE_MINIMUM_ELAPSED_DAYS } from "@/lib/cme/cpd-year";
import type { CmeEntry } from "@/lib/cme/types";
import { CME_CLOSE_WINDOW_DAYS } from "@/lib/cme/year-close";

/**
 * The words on Today's hero summary: which part of the year it is, the weekly
 * pace that reaches the target, and the day the target was reached.
 *
 * Every function takes the Perth calendar date (`YYYY-MM-DD`, from
 * `perthCalendarDate`) it should answer for and never reads the clock, so a
 * server render and the client it hydrates into always say the same thing.
 * Date arithmetic is on whole UTC day numbers, so the runtime's own time zone
 * cannot move a day.
 *
 * Nothing here grades the doctor. The pace is plain arithmetic on hours they
 * logged against a target they entered: "About 1.3 h a week reaches 50 h by
 * 31 Dec", never a verdict on it.
 */

const MS_PER_DAY = 86_400_000;

/** The last quarter of a CPD year starts on 1 October. */
const LAST_QUARTER_STARTS = "-10-01";

function dayNumber(dateOnly: string): number {
  return Math.round(Date.parse(`${dateOnly}T00:00:00Z`) / MS_PER_DAY);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Days after `today` up to and including 31 December: 0 on 31 December itself. */
function daysLeftInYear(year: number, today: string): number {
  return dayNumber(`${year}-12-31`) - dayNumber(today);
}

/** 1 on 1 January. */
function dayOfYear(year: number, today: string): number {
  return dayNumber(today) - dayNumber(`${year}-01-01`) + 1;
}

/** "14 weeks", "1 day": a non-breaking space between the number and its unit. */
function count(value: number, unit: "week" | "day"): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

/**
 * The weekly hours that reach the target by 31 December:
 * `(target − logged) ÷ max(1, weeks left)`, weeks left counted from the Perth
 * date `today` to 31 December, and the result rounded to one decimal.
 *
 * Null, so the line is hidden, when:
 *   - the target is zero or less;
 *   - `today` is not in `year`;
 *   - fewer than `CPD_PACE_MINIMUM_ELAPSED_DAYS` (28) days of the year have
 *     passed, the same first-four-weeks rule the dashboard already keeps;
 *   - the target is already reached (`cmeTargetReachedOn` says when instead).
 */
export function cmeWeeklyPace(args: {
  targetHours: number;
  loggedHours: number;
  today: string;
  year: number;
}): { weeksLeft: number; weeklyHours: number } | null {
  const { targetHours, loggedHours, today, year } = args;
  if (!(targetHours > 0)) return null;
  if (!today.startsWith(`${year}-`)) return null;
  if (dayOfYear(year, today) < CPD_PACE_MINIMUM_ELAPSED_DAYS) return null;
  const hoursToGo = targetHours - loggedHours;
  if (hoursToGo <= 0) return null;
  const weeksLeft = daysLeftInYear(year, today) / 7;
  return { weeksLeft: round1(weeksLeft), weeklyHours: round1(hoursToGo / Math.max(1, weeksLeft)) };
}

/**
 * The date (`YYYY-MM-DD`) on which the running total of the doctor's own
 * activities first reached `targetHours`, oldest activity first. Archived
 * activities count nothing, as everywhere else in CPD. Null when the total
 * has not reached the target, or the target is zero or less.
 *
 * The caller passes one year's activities; this does not filter by year.
 */
export function cmeTargetReachedOn(entries: readonly CmeEntry[], targetHours: number): string | null {
  if (!(targetHours > 0)) return null;
  const dated = entries
    .filter((entry) => !entry.archivedAt)
    .map((entry) => ({
      date: entry.date,
      hours: entry.allocations.reduce((sum, allocation) => sum + allocation.hours, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  for (const item of dated) {
    // Two decimals at every step, so ten 0.1 h activities make exactly 1 h.
    running = round2(running + item.hours);
    if (running >= targetHours) return item.date;
  }
  return null;
}

/**
 * The hero's first line: the season, then the year's end, date first.
 *
 *   - Early in the year (the first 27 days, the same rule that hides the pace):
 *     "Early in the year · write your plan"
 *   - Mid year: "Year ends 31 Dec 2026, in 30 weeks"
 *   - From 1 October: "Last quarter · year ends 31 Dec 2026, in 13 weeks"
 *   - The last `CME_CLOSE_WINDOW_DAYS` (14) days, the same window in which the
 *     year can be closed: "Last fortnight · closing the year · 31 Dec 2026, in 9 days",
 *     and on 31 December "… · 31 Dec 2026, today"
 *   - Another year: "Year ended 31 Dec 2025" or "Year starts 1 Jan 2027"
 */
export function cmeSeasonLine(args: { year: number; today: string }): string {
  const { year, today } = args;
  const yearEnd = `31 Dec ${year}`;
  const daysLeft = daysLeftInYear(year, today);
  if (daysLeft < 0) return `Year ended ${yearEnd}`;
  if (dayOfYear(year, today) < 1) return `Year starts 1 Jan ${year}`;
  if (daysLeft <= CME_CLOSE_WINDOW_DAYS) {
    return `Last fortnight · closing the year · ${yearEnd}, ${daysLeft === 0 ? "today" : `in ${count(daysLeft, "day")}`}`;
  }
  const inWeeks = `in ${count(Math.round(daysLeft / 7), "week")}`;
  if (today >= `${year}${LAST_QUARTER_STARTS}`) return `Last quarter · year ends ${yearEnd}, ${inWeeks}`;
  if (dayOfYear(year, today) < CPD_PACE_MINIMUM_ELAPSED_DAYS) return "Early in the year · write your plan";
  return `Year ends ${yearEnd}, ${inWeeks}`;
}
