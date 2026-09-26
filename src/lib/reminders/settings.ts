import {
  addDays,
  CALENDAR_UTC_OFFSET_MINUTES,
  eventUtcRange,
  expandEvents,
  utcMillisToDateKey,
  type CalendarEvent,
} from "@/lib/calendar/calendar-event";
import { dateKeyToUtcMillis } from "@/lib/calendar/date-keys";
import {
  ALL_DAY_ALERT_BASE_MINUTES,
  REMINDER_TYPES,
  SNOOZE_DAYS,
  updateReminderType,
  type ReminderLeadTime,
  type ReminderQuietHours,
  type ReminderSettings,
  type ReminderType,
} from "@/lib/reminders/settings-model";

// Types, defaults and normalising live in the import-light settings model, so the
// account preferences that load on every page never pull in this alarm logic.
export * from "@/lib/reminders/settings-model";

const LEAD_MINUTES: Record<Exclude<ReminderLeadTime, "off">, number> = {
  "at-time": 0,
  "1h": 60,
  "1d": 24 * 60,
  "1w": 7 * 24 * 60,
};

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const OFFSET_MS = CALENDAR_UTC_OFFSET_MINUTES * MINUTE_MS;

/** Today's Perth calendar date for an instant. Perth is UTC+8 all year. */
export function perthDateKey(now: Date): string {
  return utcMillisToDateKey(now.getTime() + OFFSET_MS);
}

/** Hidden by a snooze on `today` (a Perth date). The nudge returns on the snooze date itself. */
export function isSnoozed(settings: ReminderSettings, type: ReminderType, today: string): boolean {
  const until = settings.types[type].snoozedUntil;
  return until !== null && today < until;
}

/** Whether an in-app nudge of this type should be shown today. */
export function showsReminderInApp(settings: ReminderSettings, type: ReminderType, today: string): boolean {
  return settings.types[type].showInApp && !isSnoozed(settings, type, today);
}

export function snoozeReminder(
  settings: ReminderSettings,
  type: ReminderType,
  today: string,
  days: number = SNOOZE_DAYS,
): ReminderSettings {
  return updateReminderType(settings, type, { snoozedUntil: addDays(today, days) });
}

export function resumeReminder(settings: ReminderSettings, type: ReminderType): ReminderSettings {
  return updateReminderType(settings, type, { snoozedUntil: null });
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Moves an alarm that would go off inside quiet hours to the moment they end.
 * Everything is Perth wall-clock time; a window whose start is later than its
 * end runs across midnight. A window that starts and ends at the same minute
 * is empty.
 */
export function applyQuietHours(alarmMillis: number, quietHours: ReminderQuietHours): number {
  if (!quietHours.enabled) return alarmMillis;
  const start = minutesOf(quietHours.start);
  const end = minutesOf(quietHours.end);
  if (start === end) return alarmMillis;
  const perth = alarmMillis + OFFSET_MS;
  const dayStart = Math.floor(perth / DAY_MS) * DAY_MS;
  const minute = (perth - dayStart) / MINUTE_MS;
  let movedPerth: number | null = null;
  if (start < end) {
    if (minute >= start && minute < end) movedPerth = dayStart + end * MINUTE_MS;
  } else if (minute >= start) {
    movedPerth = dayStart + DAY_MS + end * MINUTE_MS;
  } else if (minute < end) {
    movedPerth = dayStart + end * MINUTE_MS;
  }
  return movedPerth === null ? alarmMillis : movedPerth - OFFSET_MS;
}

/** A timed event's start, or 09:00 Perth on an all-day event's date. */
function alertBaseMillis(event: CalendarEvent): number | null {
  const range = eventUtcRange(event);
  if (range) return range.start.getTime();
  const day = dateKeyToUtcMillis(event.date);
  if (day === null) return null;
  return day + ALL_DAY_ALERT_BASE_MINUTES * MINUTE_MS - OFFSET_MS;
}

/**
 * The alarm for ONE occurrence of an event, after its type's lead time and the
 * quiet hours: an absolute instant, or null when the event has no reminder
 * type or its type's alert is off. Does not apply the daily cap, which needs
 * every event at once — see `applyReminderAlarms`.
 */
export function alarmFor(event: CalendarEvent, settings: ReminderSettings): Date | null {
  if (!event.reminderType) return null;
  const lead = settings.types[event.reminderType].calendarAlert;
  if (lead === "off") return null;
  const base = alertBaseMillis(event);
  if (base === null) return null;
  return new Date(applyQuietHours(base - LEAD_MINUTES[lead] * MINUTE_MS, settings.quietHours));
}

type AlarmCandidate = { index: number; type: ReminderType; at: number; day: string; id: string };

/**
 * The first alarm, at or after `now`, across an event's occurrences. A
 * repeating event gets the alarm of its next occurrence only: an absolute
 * alarm cannot repeat, so the calendar link moves it forward each time the
 * calendar re-reads the feed.
 */
function nextAlarm(event: CalendarEvent, settings: ReminderSettings, now: Date): number | null {
  const today = perthDateKey(now);
  // From yesterday: quiet hours can push last night's alarm into this morning.
  const occurrences = expandEvents([event], { start: addDays(today, -1), end: addDays(today, 400) });
  for (const occurrence of occurrences) {
    const alarm = alarmFor(occurrence, settings);
    if (alarm && alarm.getTime() >= now.getTime()) return alarm.getTime();
  }
  return null;
}

/**
 * Every event, with `alarmAt` set on those that should alert: lead time, then
 * quiet hours, then at most `maxAlertsPerDay` alarms on any one Perth day,
 * keeping the higher-priority types (see `REMINDER_TYPES`). Events without a
 * reminder type, with their type's alert off, or whose alarm is already in the
 * past are returned as they were. With the default settings nothing changes.
 */
export function applyReminderAlarms(
  events: readonly CalendarEvent[],
  settings: ReminderSettings,
  now: Date,
): CalendarEvent[] {
  const candidates: AlarmCandidate[] = [];
  events.forEach((event, index) => {
    if (!event.reminderType || settings.types[event.reminderType].calendarAlert === "off") return;
    const at = nextAlarm(event, settings, now);
    if (at === null) return;
    candidates.push({ index, type: event.reminderType, at, day: perthDateKey(new Date(at)), id: event.id });
  });
  if (candidates.length === 0) return [...events];

  const priority = (type: ReminderType) => REMINDER_TYPES.indexOf(type);
  candidates.sort(
    (a, b) => priority(a.type) - priority(b.type) || a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const perDay = new Map<string, number>();
  const kept = new Map<number, number>();
  for (const candidate of candidates) {
    const used = perDay.get(candidate.day) ?? 0;
    if (used >= settings.maxAlertsPerDay) continue;
    perDay.set(candidate.day, used + 1);
    kept.set(candidate.index, candidate.at);
  }
  return events.map((event, index) => {
    const at = kept.get(index);
    return at === undefined ? event : { ...event, alarmAt: new Date(at).toISOString() };
  });
}
