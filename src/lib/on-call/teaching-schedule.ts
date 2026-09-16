import { onCallDetailsSchemaFor, type OnCallEntry, type OnCallRecurrenceFrequency } from "@/lib/on-call/entry-model";

/**
 * When the next teaching session actually is.
 *
 * The home's "Coming up" module used to read one manually typed date off each
 * session and drop anything already past. That is right for a one-off and wrong
 * for everything else: the weekly journal club disappeared every Thursday
 * afternoon and stayed gone until somebody edited the entry. Nobody edits an
 * entry at 3am, so the module was empty exactly when the shift was reading it.
 *
 * So a session may now carry `details.recurrenceRule`, and this module rolls its
 * anchor forward to the next occurrence on or after today. Two properties are
 * load-bearing and are the reason this is a module rather than four lines
 * inside a component:
 *
 * **Dates are compared as strings.** `YYYY-MM-DD` sorts lexicographically, so
 * "is this session in the past" is answered without a clock and without a zone.
 * It must not change answer between a phone in Perth and a server in another
 * one — a session that reads as yesterday's in Sydney and tomorrow's in London
 * is a session somebody misses. `home-modules.ts` established that discipline
 * for `selectUpcomingSessions` and it is preserved here exactly.
 *
 * **Where days or months must genuinely be added, the arithmetic happens on a
 * UTC-anchored date and is formatted straight back to `YYYY-MM-DD`.** Local
 * `Date` arithmetic shifts by a day across a daylight-saving boundary — not a
 * risk in Perth, which has no DST, but this code runs on servers that are not
 * in Perth. UTC has no such boundary, so the same anchor gives the same answer
 * everywhere. `tests/on-call-teaching-schedule.test.ts` pins that by running the
 * roll-forward under five process time zones and demanding one answer.
 */

const DAY_MS = 86_400_000;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * How many periods we will step forward before giving up.
 *
 * 1200 is a hundred years of monthly sessions, or twenty-three years of weekly
 * ones — far past any real teaching calendar, and far short of a loop that
 * spins. It exists for the pathological input: an anchor typed as `1026-09-17`
 * rather than `2026-09-17` would otherwise ask for fifty thousand steps on
 * every render. Past the cap the session is dropped from the list rather than
 * shown at a guessed date, which is the conservative direction: a missing row
 * sends the reader to the Teaching page, a wrong one sends them to an empty
 * room.
 */
export const ON_CALL_RECURRENCE_MAX_PERIODS = 1200;

/**
 * How many sessions the "Coming up" strip holds by default.
 *
 * Four rather than the flat list's two: the strip scrolls sideways, so a fourth
 * card costs no vertical space on the home, and "what is on this fortnight" is
 * a more useful answer than "what is on next".
 */
export const ON_CALL_UPCOMING_SESSION_LIMIT = 4;

export interface OnCallTeachingSession {
  entry: OnCallEntry;
  /** `YYYY-MM-DD`, already known to be on or after `today`. */
  date: string;
  /** The owner's own wording for when it runs, if they gave one. */
  when: string | null;
  presenter: string | null;
  location: string | null;
  recordingUrl: string | null;
  /** True when `date` was computed by rolling a structured rule forward. */
  isRecurring: boolean;
}

interface EducationDetails {
  recurrence?: string;
  nextOccurrence?: string;
  nextOccurrenceDate?: string;
  recurrenceRule?: { frequency: OnCallRecurrenceFrequency };
  presenter?: string;
  location?: string;
  recordingUrl?: string;
}

function educationDetails(entry: OnCallEntry): EducationDetails | null {
  if (entry.section !== "education") return null;
  const result = onCallDetailsSchemaFor("education").safeParse(entry.details);
  return result.success ? (result.data as EducationDetails) : null;
}

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
 * `Date.UTC(2026, 1, 30)` does not refuse 30 February — it silently rolls it
 * into 2 March. A typo would then produce a confidently wrong date every week
 * forever, so the result is formatted back and compared: a key that does not
 * round-trip is not a date.
 */
function toUtcMillis(date: string): number | null {
  const match = DATE_KEY.exec(date);
  if (!match) return null;
  const millis = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(millis)) return null;
  return formatUtc(millis) === date ? millis : null;
}

/**
 * The anchor moved on by whole months, clamped to the end of a shorter one.
 *
 * **The documented answer for an anchor on the 29th, 30th or 31st: it clamps to
 * the last day of any month too short to hold it, and the month after that goes
 * back to the anchor's own day.** A session anchored on 31 January falls on
 * 28 February (29th in a leap year), then 31 March. The alternative — letting
 * the date spill into the first of the next month, which is what `setUTCMonth`
 * does unaided — walks the whole series forward a day at a time and is how a
 * monthly meeting ends up listed on the wrong date by June. Clamping keeps
 * every later occurrence anchored to the day the owner actually typed.
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
 * The next occurrence of a session on or after `today`, or null if there is
 * none.
 *
 * With no frequency this is the behaviour the home has always had, unchanged
 * and still a bare string comparison: the anchor if it is today or later,
 * nothing if it has passed.
 */
export function nextTeachingOccurrence(
  anchor: string,
  frequency: OnCallRecurrenceFrequency | null | undefined,
  today: string,
): string | null {
  if (!DATE_KEY.test(anchor) || !DATE_KEY.test(today)) return null;
  // A one-off, and the string comparison is the whole implementation.
  if (!frequency) return anchor >= today ? anchor : null;
  // On the boundary counts as upcoming: a session running this afternoon has
  // not been missed.
  if (anchor >= today) return anchor;

  const anchorMillis = toUtcMillis(anchor);
  const todayMillis = toUtcMillis(today);
  if (anchorMillis === null || todayMillis === null) return null;

  if (frequency === "weekly" || frequency === "fortnightly") {
    // Solved rather than stepped. Fortnightly especially: counting whole
    // periods from the anchor is what keeps the series on the owner's own
    // week, instead of snapping it to whichever fortnight `today` sits in.
    const step = frequency === "weekly" ? 7 : 14;
    const gapDays = Math.round((todayMillis - anchorMillis) / DAY_MS);
    const periods = Math.ceil(gapDays / step);
    if (periods > ON_CALL_RECURRENCE_MAX_PERIODS) return null;
    return formatUtc(anchorMillis + periods * step * DAY_MS);
  }

  // Monthly cannot be solved the same way — months are not a fixed number of
  // days — so it is estimated to the right month and then nudged. Clamping
  // makes the series monotonically increasing, so at most one nudge is ever
  // needed; the loop is bounded anyway, because "at most one" is a claim about
  // today's arithmetic and the cap is a guarantee about tomorrow's.
  const anchorDate = new Date(anchorMillis);
  const todayDate = new Date(todayMillis);
  let periods =
    (todayDate.getUTCFullYear() - anchorDate.getUTCFullYear()) * 12 +
    (todayDate.getUTCMonth() - anchorDate.getUTCMonth());
  if (periods < 0) periods = 0;
  if (periods > ON_CALL_RECURRENCE_MAX_PERIODS) return null;

  let candidate = addMonthsClamped(anchorMillis, periods);
  while (candidate < today) {
    periods += 1;
    if (periods > ON_CALL_RECURRENCE_MAX_PERIODS) return null;
    candidate = addMonthsClamped(anchorMillis, periods);
  }
  return candidate;
}

/**
 * The date a Teaching entry next runs, rolled forward if it repeats.
 *
 * Null when the owner gave no date at all. That session is not dropped from the
 * app — it still lists on the Teaching page, where their free-text "Thursday
 * 1pm" is the answer — it simply cannot be ranked against the others.
 */
export function onCallTeachingDate(entry: OnCallEntry, today: string): string | null {
  const details = educationDetails(entry);
  if (!details?.nextOccurrenceDate) return null;
  return nextTeachingOccurrence(details.nextOccurrenceDate, details.recurrenceRule?.frequency ?? null, today);
}

/**
 * The next teaching sessions, soonest first.
 *
 * The replacement for `selectUpcomingSessions` in `home-modules.ts`. Same
 * contract — `(entries, today, limit)`, string dates throughout — with the one
 * difference that a session carrying a structured recurrence rolls forward
 * instead of falling off the list.
 *
 * Everything a card needs to draw comes back with it, including the owner's own
 * `when`, so no surface downstream has to parse a date or re-derive a label.
 */
export function selectUpcomingTeachingSessions(
  entries: readonly OnCallEntry[],
  today: string,
  limit: number = ON_CALL_UPCOMING_SESSION_LIMIT,
): OnCallTeachingSession[] {
  const sessions: OnCallTeachingSession[] = [];
  for (const entry of entries) {
    const details = educationDetails(entry);
    if (!details?.nextOccurrenceDate) continue;
    const date = nextTeachingOccurrence(details.nextOccurrenceDate, details.recurrenceRule?.frequency ?? null, today);
    if (!date) continue;
    sessions.push({
      entry,
      date,
      when: details.nextOccurrence ?? null,
      presenter: details.presenter ?? null,
      location: details.location ?? null,
      recordingUrl: details.recordingUrl ?? null,
      isRecurring: Boolean(details.recurrenceRule),
    });
  }
  // Title then slug after the date, so two sessions on the same day always come
  // back in the same order — a strip that reshuffles itself between renders
  // reads as a bug even when both orders are defensible.
  return sessions
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.entry.title.localeCompare(b.entry.title) ||
        a.entry.slug.localeCompare(b.entry.slug),
    )
    .slice(0, limit);
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface OnCallTeachingDateParts {
  weekday: string;
  /** The day of the month, unpadded — "7", not "07". */
  day: string;
  month: string;
  year: string;
}

/**
 * A date key split into the pieces a card prints.
 *
 * The month and the day come straight out of the string, because the string is
 * already the answer and parsing it would reintroduce a zone. Only the weekday
 * needs a `Date`, and it is built at UTC noon and read in UTC — the one way to
 * turn a bare date into a weekday without a zone shifting it either way. The
 * reader is in Perth and checking this against a roster, so "Tue" showing as
 * "Mon" is the whole failure.
 *
 * `on-call-home.tsx` has its own private copies of these two labels for the
 * older "Coming up" rows; these are the shared versions, and that file's pair
 * can collapse into them whenever it is next opened.
 */
export function onCallTeachingDateParts(date: string): OnCallTeachingDateParts {
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

/** A whole date, written the Australian way round: "Thu 17 Sep 2026". */
export function onCallTeachingDateLabel(date: string): string {
  const { weekday, day, month, year } = onCallTeachingDateParts(date);
  if (!day || !month) return date;
  return `${weekday} ${day} ${month} ${year}`.trim();
}
