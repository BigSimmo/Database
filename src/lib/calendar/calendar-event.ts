/**
 * One shape for every dated thing the app can put on a calendar: a CME routine
 * coming due, the end of the CPD year, an On Call teaching session, a
 * compliance item expiring.
 *
 * Every date here is a Perth calendar date or a Perth wall-clock time. Perth is
 * UTC+8 with no daylight saving, so a wall-clock time converts to UTC by a
 * fixed eight hours, all year, with no time-zone database. That is the only
 * reason `CALENDAR_TIME_ZONE` is a constant rather than a field: an event from
 * another zone would need a real zone conversion before it could live here.
 *
 * The model is deliberately provider-neutral. Exporting a file, opening
 * Google's or Outlook's "add event" page, and a future two-way sync are all
 * adapters over this one type (see `CalendarSource`), so adding a provider never
 * changes what a page hands the calendar.
 */
export const CALENDAR_TIME_ZONE = "Australia/Perth";

/** Perth is UTC+8 all year. */
export const CALENDAR_UTC_OFFSET_MINUTES = 8 * 60;

export type CalendarRecurrence = "weekly" | "fortnightly" | "monthly" | "quarterly";

/** What an event is about, which sets its colour dot and its legend label. */
export type CalendarEventKind = "logged" | "due" | "deadline" | "teaching" | "expiry" | "other";

export type CalendarEvent = {
  /** Stable across renders and exports: it becomes the file's UID, so re-importing updates rather than duplicates. */
  readonly id: string;
  readonly title: string;
  /** Perth calendar date, `YYYY-MM-DD`. */
  readonly date: string;
  /** Perth wall-clock start, `HH:MM`. Absent for an all-day event. */
  readonly startTime?: string;
  /** Minutes. Ignored for an all-day event. Defaults to 60. */
  readonly durationMinutes?: number;
  readonly kind: CalendarEventKind;
  /** Repeats from `date` onwards. */
  readonly recurrence?: CalendarRecurrence;
  readonly location?: string;
  readonly notes?: string;
  /** An in-app page about this event, if there is one. */
  readonly href?: string;
};

/**
 * Where events come from. Today every source is the app's own data; a Google
 * or Outlook sync would be one more implementation, reading the owner's
 * calendar for the visible range, without any page changing.
 */
export interface CalendarSource {
  readonly id: string;
  listEvents(range: { start: string; end: string }): readonly CalendarEvent[];
}

export const calendarEventKindLabels: Record<CalendarEventKind, string> = {
  logged: "Logged",
  due: "Due",
  deadline: "Deadline",
  teaching: "Teaching",
  expiry: "Expires",
  other: "Other",
};

export const calendarRecurrenceLabels: Record<CalendarRecurrence, string> = {
  weekly: "Every week",
  fortnightly: "Every fortnight",
  monthly: "Every month",
  quarterly: "Every three months",
};

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

/** UTC midnight for a real `YYYY-MM-DD`, or null (30 February is not a date). */
export function dateKeyToUtcMillis(date: string): number | null {
  const match = DATE_KEY.exec(date);
  if (!match) return null;
  const millis = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return utcMillisToDateKey(millis) === date ? millis : null;
}

export function utcMillisToDateKey(millis: number): string {
  const date = new Date(millis);
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const millis = dateKeyToUtcMillis(date);
  if (millis === null) throw new Error(`Not a calendar date: ${date}`);
  return utcMillisToDateKey(millis + days * DAY_MS);
}

/** Whole months later, clamped to the end of a shorter month (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsClamped(date: string, months: number): string {
  const millis = dateKeyToUtcMillis(date);
  if (millis === null) throw new Error(`Not a calendar date: ${date}`);
  const anchor = new Date(millis);
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return utcMillisToDateKey(Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay)));
}

export function isValidTime(time: string): boolean {
  return TIME_KEY.test(time);
}

/** The event's start and end as UTC instants (all-day events: null). */
export function eventUtcRange(event: CalendarEvent): { start: Date; end: Date } | null {
  if (!event.startTime || !isValidTime(event.startTime)) return null;
  const day = dateKeyToUtcMillis(event.date);
  if (day === null) return null;
  const [hours, minutes] = event.startTime.split(":").map(Number);
  const start = day + (hours * 60 + minutes - CALENDAR_UTC_OFFSET_MINUTES) * 60_000;
  const duration = Math.max(1, event.durationMinutes ?? 60);
  return { start: new Date(start), end: new Date(start + duration * 60_000) };
}

function occurrenceAfter(anchor: string, recurrence: CalendarRecurrence, index: number): string {
  switch (recurrence) {
    case "weekly":
      return addDays(anchor, 7 * index);
    case "fortnightly":
      return addDays(anchor, 14 * index);
    case "monthly":
      return addMonthsClamped(anchor, index);
    case "quarterly":
      return addMonthsClamped(anchor, 3 * index);
  }
}

/** Safety cap: a weekly series over a year is 53; nothing a page shows needs more. */
const MAX_OCCURRENCES_PER_EVENT = 400;

/**
 * Every occurrence that falls inside `[start, end]` (inclusive dates), with
 * repeating events expanded. Each occurrence keeps its series id plus its date,
 * so two occurrences of one series never share a React key.
 */
export function expandEvents(
  events: readonly CalendarEvent[],
  range: { start: string; end: string },
): readonly (CalendarEvent & { readonly occurrenceKey: string })[] {
  const result: (CalendarEvent & { occurrenceKey: string })[] = [];
  for (const event of events) {
    if (dateKeyToUtcMillis(event.date) === null) continue;
    if (!event.recurrence) {
      if (event.date >= range.start && event.date <= range.end) result.push({ ...event, occurrenceKey: event.id });
      continue;
    }
    for (let index = 0; index < MAX_OCCURRENCES_PER_EVENT; index += 1) {
      const date = occurrenceAfter(event.date, event.recurrence, index);
      if (date > range.end) break;
      if (date >= range.start) result.push({ ...event, date, occurrenceKey: `${event.id}@${date}` });
    }
  }
  return result.sort(compareEvents);
}

export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  // All-day first, then by start time, then by title so the order is stable.
  const aTime = a.startTime ?? "";
  const bTime = b.startTime ?? "";
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/** "12:30 pm" from "12:30". */
export function formatEventTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
