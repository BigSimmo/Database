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
    const next = nextTeachingOccurrence(details.nextOccurrenceDate, frequency, today);
    if (!next) continue;
    // A monthly session starts its series on the owner's own anchor, not on the
    // rolled-forward date: rolled onto a clamped short month (31 January to
    // 28 February), the series would repeat on the 28th for ever after while
    // the Teaching page shows 31 March. `expandEvents` and the alarms already
    // read a series from any start date. Weekly and fortnightly cannot drift,
    // so they keep the rolled date and stay clear of the occurrence cap.
    const date = frequency === "monthly" ? details.nextOccurrenceDate : next;
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
        // Admin > Renewals, where compliance rows live since Admin update 1. The ICS
        // feed never writes `href`, so the live calendar feed is unchanged.
        href: "/admin/renewals",
        notes: "The date you recorded. Confirm it with the issuing body.",
      },
    ];
  });
}

export function onCallCalendarEvents(entries: readonly OnCallEntry[], today: string): CalendarEvent[] {
  return [...onCallTeachingEvents(entries, today), ...onCallExpiryEvents(entries)];
}
