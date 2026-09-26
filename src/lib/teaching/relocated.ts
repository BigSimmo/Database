import { addDays, isValidTime } from "@/lib/calendar/calendar-event";
import { nextTeachingOccurrence, type RecurringSessionFrequency } from "@/lib/dates/recurring-session";
import { onCallDetailsSchemaFor, type OnCallEntry } from "@/lib/on-call/entry-model";
import { RELOCATED_SERVICE_ID, type SessionSummary } from "@/lib/teaching/model";
import { perthInstant } from "@/lib/teaching/time";

/**
 * On Call's teaching list, shown in Teaching's Week under "Teaching list (from On
 * Call)" until a team goes live on Teaching's own tables (spec §8).
 *
 * Only the title, time and place come across. The presenter's name and any
 * recording link stay in On Call, where the owner typed them. A time is used only
 * when it was typed as a plain 24-hour "HH:MM"; anything else ("Thursday
 * lunchtime") makes the session all day rather than guessing a clock time.
 */

type EducationDetails = {
  nextOccurrence?: string;
  nextOccurrenceDate?: string;
  recurrenceRule?: { frequency: RecurringSessionFrequency };
  location?: string;
};

/** On Call gives no length; its calendar events use the same hour. */
const DEFAULT_MINUTES = 60;
const DAY_MINUTES = 24 * 60;
/** A year of weekly sessions; a 42-day view needs at most seven. */
const MAX_OCCURRENCES_PER_ENTRY = 60;

function toSession(
  entry: OnCallEntry,
  date: string,
  time: string | null,
  location: string | undefined,
): SessionSummary | null {
  let startsAt: string;
  try {
    startsAt = perthInstant(date, time ?? "00:00");
  } catch {
    return null;
  }
  const minutes = time ? DEFAULT_MINUTES : DAY_MINUTES;
  return {
    occurrenceId: `${entry.id}@${date}`,
    serviceId: RELOCATED_SERVICE_ID,
    title: entry.title,
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + minutes * 60_000).toISOString(),
    venue: location?.trim() || null,
    hasJoinLink: false,
    status: "scheduled",
    isPresenter: false,
    source: "on_call_relocated",
    ...(time ? {} : { allDay: true as const }),
  };
}

/**
 * Without `until`: each entry's next occurrence on or after `today` (On Call's own
 * list). With `until`: every occurrence from `today` to `until`, inclusive.
 */
export function relocatedOnCallSessions(
  entries: readonly OnCallEntry[],
  today: string,
  until?: string,
): SessionSummary[] {
  const sessions: SessionSummary[] = [];
  for (const entry of entries) {
    if (entry.section !== "education") continue;
    const parsed = onCallDetailsSchemaFor("education").safeParse(entry.details);
    if (!parsed.success) continue;
    const details = parsed.data as EducationDetails;
    const anchor = details.nextOccurrenceDate;
    if (!anchor) continue;
    const frequency = details.recurrenceRule?.frequency ?? null;
    const when = details.nextOccurrence?.trim();
    const time = when && isValidTime(when) ? when : null;
    let date = nextTeachingOccurrence(anchor, frequency, today);
    for (let count = 0; date && count < MAX_OCCURRENCES_PER_ENTRY; count += 1) {
      if (until !== undefined && date > until) break;
      const session = toSession(entry, date, time, details.location);
      if (session) sessions.push(session);
      if (until === undefined || !frequency) break;
      date = nextTeachingOccurrence(anchor, frequency, addDays(date, 1));
    }
  }
  return sessions.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title));
}
