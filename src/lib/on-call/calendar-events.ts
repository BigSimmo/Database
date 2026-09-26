import { isValidTime, type CalendarEvent, type CalendarRecurrence } from "@/lib/calendar/calendar-event";
import { complianceExpiresOn, isComplianceEntry } from "@/lib/on-call/compliance";
import { onCallDetailsSchemaFor, type OnCallEntry, type OnCallRecurrenceFrequency } from "@/lib/on-call/entry-model";
import { nextTeachingOccurrence } from "@/lib/on-call/teaching-schedule";

/**
 * On Call's dates as calendar events: teaching sessions (repeating ones keep
 * their repeat) and the expiry dates recorded against compliance items.
 *
 * A session's time is used only when the owner wrote it as a plain 24-hour
 * "HH:MM"; any other wording ("Thursday lunchtime") stays as the event's note
 * on an all-day event, rather than being guessed into a time.
 */

const FREQUENCY_RECURRENCE: Record<OnCallRecurrenceFrequency, CalendarRecurrence> = {
  weekly: "weekly",
  fortnightly: "fortnightly",
  monthly: "monthly",
};

type EducationDetails = {
  nextOccurrence?: string;
  nextOccurrenceDate?: string;
  recurrenceRule?: { frequency: OnCallRecurrenceFrequency };
  location?: string;
  presenter?: string;
};

export function onCallTeachingEvents(entries: readonly OnCallEntry[], today: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const entry of entries) {
    if (entry.section !== "education") continue;
    const parsed = onCallDetailsSchemaFor("education").safeParse(entry.details);
    if (!parsed.success) continue;
    const details = parsed.data as EducationDetails;
    if (!details.nextOccurrenceDate) continue;
    const frequency = details.recurrenceRule?.frequency ?? null;
    const date = nextTeachingOccurrence(details.nextOccurrenceDate, frequency, today);
    if (!date) continue;
    const when = details.nextOccurrence?.trim();
    const startTime = when && isValidTime(when) ? when : undefined;
    const notes = [
      !startTime && when ? when : null,
      details.presenter ? `Presenter: ${details.presenter}` : null,
    ].filter(Boolean);
    events.push({
      id: `on-call-teaching-${entry.id}`,
      title: entry.title,
      date,
      startTime,
      kind: "teaching",
      reminderType: "teaching",
      recurrence: frequency ? FREQUENCY_RECURRENCE[frequency] : undefined,
      location: details.location,
      notes: notes.length ? notes.join(". ") : undefined,
      href: "/on-call/education",
    });
  }
  return events;
}

export function onCallExpiryEvents(entries: readonly OnCallEntry[]): CalendarEvent[] {
  return entries.filter(isComplianceEntry).flatMap((entry) => {
    const expiresOn = complianceExpiresOn(entry);
    if (!expiresOn) return [];
    return [
      {
        id: `on-call-expiry-${entry.id}`,
        title: `${entry.title} expires`,
        date: expiresOn,
        kind: "expiry" as const,
        reminderType: "compliance-dates" as const,
        href: "/on-call/compliance",
        notes: "The date you recorded. Confirm it with the issuing body.",
      },
    ];
  });
}

export function onCallCalendarEvents(entries: readonly OnCallEntry[], today: string): CalendarEvent[] {
  return [...onCallTeachingEvents(entries, today), ...onCallExpiryEvents(entries)];
}
