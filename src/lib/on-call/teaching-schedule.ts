import {
  isOnCallHttpUrl,
  onCallDetailsSchemaFor,
  type OnCallEntry,
  type OnCallRecurrenceFrequency,
} from "@/lib/on-call/entry-model";
import { nextTeachingOccurrence, recurringSessionDateParts } from "@/lib/dates/recurring-session";

/**
 * When the next On Call teaching session actually is.
 *
 * The roll-forward (`nextTeachingOccurrence`) and the date parts now live in the
 * neutral `@/lib/dates/recurring-session`, because Teaching, compliance, My Work and
 * entry search all need them. The old names below are re-exports of that one
 * implementation, so every existing import keeps working unchanged.
 *
 * What stays here is On Call specific: reading an education entry's details and
 * choosing the sessions for On Call's "Coming up" strip.
 */

export {
  nextTeachingOccurrence,
  RECURRING_SESSION_MAX_PERIODS as ON_CALL_RECURRENCE_MAX_PERIODS,
  recurringSessionDateParts as onCallTeachingDateParts,
  type RecurringSessionDateParts as OnCallTeachingDateParts,
} from "@/lib/dates/recurring-session";

/**
 * How many sessions the "Coming up" strip holds by default. Four rather than two:
 * the strip scrolls sideways, so a fourth card costs no vertical space.
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

/**
 * The date a Teaching entry next runs, rolled forward if it repeats. Null when the
 * owner gave no date at all; that session still lists on the Teaching page.
 */
export function onCallTeachingDate(entry: OnCallEntry, today: string): string | null {
  const details = educationDetails(entry);
  if (!details?.nextOccurrenceDate) return null;
  return nextTeachingOccurrence(details.nextOccurrenceDate, details.recurrenceRule?.frequency ?? null, today);
}

/**
 * The next teaching sessions, soonest first: `(entries, today, limit)`, string dates
 * throughout, and a session carrying a structured recurrence rolls forward instead of
 * falling off the list.
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
      // http(s) only, so no surface downstream can be handed a `javascript:` link.
      recordingUrl: isOnCallHttpUrl(details.recordingUrl) ? details.recordingUrl : null,
      isRecurring: Boolean(details.recurrenceRule),
    });
  }
  // Title then slug after the date, so two sessions on the same day always come back
  // in the same order.
  return sessions
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.entry.title.localeCompare(b.entry.title) ||
        a.entry.slug.localeCompare(b.entry.slug),
    )
    .slice(0, limit);
}

/** A whole date, written the Australian way round: "Thu 17 Sep 2026". */
export function onCallTeachingDateLabel(date: string): string {
  const { weekday, day, month, year } = recurringSessionDateParts(date);
  if (!day || !month) return date;
  return `${weekday} ${day} ${month} ${year}`.trim();
}
