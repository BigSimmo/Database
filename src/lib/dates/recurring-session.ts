/**
 * When a repeating session next runs, and how to print a date key.
 *
 * Moved here from `src/lib/on-call/teaching-schedule.ts` so Teaching, On Call's
 * compliance section, My Work and On Call's entry search share one implementation
 * without Teaching importing from On Call. `teaching-schedule.ts` re-exports the old
 * names, so existing callers are unchanged.
 *
 * Two properties are load-bearing:
 *
 * **Dates are compared as strings.** `YYYY-MM-DD` sorts lexicographically, so
 * "is this session in the past" is answered without a clock and without a zone.
 * It must not change answer between a phone in Perth and a server in another one.
 *
 * **Where days or months must genuinely be added, the arithmetic happens on a
 * UTC-anchored date and is formatted straight back to `YYYY-MM-DD`.** Local `Date`
 * arithmetic shifts by a day across a daylight-saving boundary on servers that are
 * not in Perth. `tests/on-call-teaching-schedule.test.ts` pins that by running the
 * roll-forward under five process time zones and demanding one answer.
 */

/** The same three values as On Call's `ON_CALL_RECURRENCE_FREQUENCIES`, kept local so this module is neutral. */
export type RecurringSessionFrequency = "weekly" | "fortnightly" | "monthly";

const DAY_MS = 86_400_000;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * How many periods we will step forward before giving up.
 *
 * 1200 is a hundred years of monthly sessions, or twenty-three years of weekly
 * ones: far past any real teaching calendar, and far short of a loop that spins.
 * Past the cap the session is dropped rather than shown at a guessed date, which is
 * the conservative direction: a missing row sends the reader to the Teaching page,
 * a wrong one sends them to an empty room.
 */
export const RECURRING_SESSION_MAX_PERIODS = 1200;

/** `YYYY-MM-DD` for a UTC instant. Never reads a local field. */
function formatUtc(millis: number): string {
  const date = new Date(millis);
  const year = `${date.getUTCFullYear()}`.padStart(4, "0");
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * UTC midnight for a `YYYY-MM-DD` key, or null if that day never existed.
 *
 * `Date.UTC(2026, 1, 30)` silently rolls 30 February into 2 March, so the result is
 * formatted back and compared: a key that does not round-trip is not a date.
 */
function toUtcMillis(date: string): number | null {
  const match = DATE_KEY.exec(date);
  if (!match) return null;
  const millis = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(millis)) return null;
  return formatUtc(millis) === date ? millis : null;
}

/**
 * The anchor moved on by whole months, clamped to the end of a shorter one. A session
 * anchored on 31 January falls on 28 February (29th in a leap year), then 31 March.
 */
function addMonthsClamped(anchorMillis: number, months: number): string {
  const anchor = new Date(anchorMillis);
  const day = anchor.getUTCDate();
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  // Day 0 of the following month is the last day of this one.
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return formatUtc(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth)));
}

/**
 * The next occurrence of a session on or after `today`, or null if there is none.
 * With no frequency this is a bare string comparison: the anchor if it is today or
 * later, nothing if it has passed.
 */
export function nextTeachingOccurrence(
  anchor: string,
  frequency: RecurringSessionFrequency | null | undefined,
  today: string,
): string | null {
  if (!DATE_KEY.test(anchor) || !DATE_KEY.test(today)) return null;
  if (!frequency) return anchor >= today ? anchor : null;
  // On the boundary counts as upcoming: a session running this afternoon has not been missed.
  if (anchor >= today) return anchor;

  const anchorMillis = toUtcMillis(anchor);
  const todayMillis = toUtcMillis(today);
  if (anchorMillis === null || todayMillis === null) return null;

  if (frequency === "weekly" || frequency === "fortnightly") {
    // Solved rather than stepped, so a fortnightly series stays on the owner's own week.
    const step = frequency === "weekly" ? 7 : 14;
    const gapDays = Math.round((todayMillis - anchorMillis) / DAY_MS);
    const periods = Math.ceil(gapDays / step);
    if (periods > RECURRING_SESSION_MAX_PERIODS) return null;
    return formatUtc(anchorMillis + periods * step * DAY_MS);
  }

  // Months are not a fixed number of days, so estimate the month and nudge. Clamping
  // makes the series increase monotonically, so at most one nudge is needed; the loop
  // is bounded anyway.
  const anchorDate = new Date(anchorMillis);
  const todayDate = new Date(todayMillis);
  let periods =
    (todayDate.getUTCFullYear() - anchorDate.getUTCFullYear()) * 12 +
    (todayDate.getUTCMonth() - anchorDate.getUTCMonth());
  if (periods < 0) periods = 0;
  if (periods > RECURRING_SESSION_MAX_PERIODS) return null;

  let candidate = addMonthsClamped(anchorMillis, periods);
  while (candidate < today) {
    periods += 1;
    if (periods > RECURRING_SESSION_MAX_PERIODS) return null;
    candidate = addMonthsClamped(anchorMillis, periods);
  }
  return candidate;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface RecurringSessionDateParts {
  weekday: string;
  /** The day of the month, unpadded: "7", not "07". */
  day: string;
  month: string;
  year: string;
}

/**
 * A date key split into the pieces a card prints. Month and day come straight out of
 * the string; only the weekday needs a `Date`, built at UTC noon and read in UTC, the
 * one way to turn a bare date into a weekday without a zone shifting it.
 */
export function recurringSessionDateParts(date: string): RecurringSessionDateParts {
  const match = DATE_KEY.exec(date);
  if (!match) return { weekday: "", day: "", month: "", year: "" };
  const [, year, month, day] = match;
  const parsed = new Date(`${date}T12:00:00Z`);
  return {
    weekday: Number.isNaN(parsed.getTime()) ? "" : (WEEKDAY_LABELS[parsed.getUTCDay()] ?? ""),
    day: `${Number(day)}`,
    month: MONTH_LABELS[Number(month) - 1] ?? "",
    year: year ?? "",
  };
}
