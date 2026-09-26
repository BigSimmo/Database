import {
  addDays,
  CALENDAR_UTC_OFFSET_MINUTES,
  dateKeyToUtcMillis,
  eventUtcRange,
  expandEvents,
  isValidTime,
  utcMillisToDateKey,
  type CalendarEvent,
} from "@/lib/calendar/calendar-event";

/**
 * The owner's reminder controls: whether each kind of reminder shows in the
 * app, whether it puts an alert on the phone through the calendar, quiet hours
 * for those alerts, and how many alerts one day may carry.
 *
 * This is a settings layer over reminders that already exist. It never decides
 * when a CME routine is due or when a compliance date passes; it only decides
 * whether an existing nudge is shown, and whether an existing calendar event
 * carries an alarm. The defaults reproduce the app as it was before this
 * existed: every nudge shown in the app, no calendar alarms at all.
 *
 * Nothing here sends anything anywhere. A calendar alarm reaches a phone only
 * through the owner's own calendar link or a file they downloaded.
 */

/**
 * Every reminder type, in priority order: when a day has more alerts than the
 * owner allows, the ones earlier in this list are kept. A new reminder (for
 * example a future "Shifts" type) is one more line here plus its labels.
 */
export const REMINDER_TYPES = [
  "compliance-dates",
  "on-call-checks",
  "cpd-year-end",
  "cpd-routines",
  "teaching",
] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

/** The order the Settings block lists them in: CPD first, as the plan reads. */
export const REMINDER_TYPE_DISPLAY_ORDER: readonly ReminderType[] = [
  "cpd-routines",
  "cpd-year-end",
  "on-call-checks",
  "compliance-dates",
  "teaching",
];

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  "cpd-routines": "CPD routines due",
  "cpd-year-end": "CPD year-end claim",
  "on-call-checks": "On Call checks",
  "compliance-dates": "Compliance dates",
  teaching: "Teaching",
};

/**
 * Where a type's calendar alert can reach. On Call checks are never calendar
 * events (they are derived from how long ago a row was confirmed), and
 * compliance dates are deliberately kept out of the private calendar link, so
 * they reach a phone only through a downloaded file.
 */
export type ReminderCalendarReach = "link-and-file" | "file-only" | "none";
export const REMINDER_CALENDAR_REACH: Record<ReminderType, ReminderCalendarReach> = {
  "cpd-routines": "link-and-file",
  "cpd-year-end": "link-and-file",
  "on-call-checks": "none",
  "compliance-dates": "file-only",
  teaching: "link-and-file",
};

export const REMINDER_LEAD_TIMES = ["off", "at-time", "1h", "1d", "1w"] as const;
export type ReminderLeadTime = (typeof REMINDER_LEAD_TIMES)[number];

export const REMINDER_LEAD_TIME_LABELS: Record<ReminderLeadTime, string> = {
  off: "Off",
  "at-time": "At the time",
  "1h": "1 hour before",
  "1d": "1 day before",
  "1w": "1 week before",
};

const LEAD_MINUTES: Record<Exclude<ReminderLeadTime, "off">, number> = {
  "at-time": 0,
  "1h": 60,
  "1d": 24 * 60,
  "1w": 7 * 24 * 60,
};

export type ReminderTypeSettings = {
  /** Off hides this type's nudges in the app. It never touches the calendar. */
  readonly showInApp: boolean;
  readonly calendarAlert: ReminderLeadTime;
  /** Perth date, `YYYY-MM-DD`: the nudge is hidden before this day. Null when not snoozed. */
  readonly snoozedUntil: string | null;
};

export type ReminderQuietHours = {
  readonly enabled: boolean;
  /** Perth wall-clock `HH:MM`. A window may cross midnight (21:00 to 07:00). */
  readonly start: string;
  readonly end: string;
};

export type ReminderSettings = {
  readonly types: Readonly<Record<ReminderType, ReminderTypeSettings>>;
  readonly quietHours: ReminderQuietHours;
  /** Calendar alerts a single Perth day may carry. */
  readonly maxAlertsPerDay: number;
};

export type ReminderSettingsPatch = {
  readonly types?: Partial<Record<ReminderType, Partial<ReminderTypeSettings>>>;
  readonly quietHours?: Partial<ReminderQuietHours>;
  readonly maxAlertsPerDay?: number;
};

export const MIN_ALERTS_PER_DAY = 1;
export const MAX_ALERTS_PER_DAY = 10;
export const SNOOZE_DAYS = 7;

/** Where an all-day event's alert is anchored, in Perth wall-clock minutes (09:00). */
export const ALL_DAY_ALERT_BASE_MINUTES = 9 * 60;

const DEFAULT_TYPE_SETTINGS: ReminderTypeSettings = { showInApp: true, calendarAlert: "off", snoozedUntil: null };

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  types: {
    "compliance-dates": DEFAULT_TYPE_SETTINGS,
    "on-call-checks": DEFAULT_TYPE_SETTINGS,
    "cpd-year-end": DEFAULT_TYPE_SETTINGS,
    "cpd-routines": DEFAULT_TYPE_SETTINGS,
    teaching: DEFAULT_TYPE_SETTINGS,
  },
  quietHours: { enabled: false, start: "21:00", end: "07:00" },
  maxAlertsPerDay: 3,
};

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const OFFSET_MS = CALENDAR_UTC_OFFSET_MINUTES * MINUTE_MS;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isReminderType(value: unknown): value is ReminderType {
  return typeof value === "string" && (REMINDER_TYPES as readonly string[]).includes(value);
}

function isLeadTime(value: unknown): value is ReminderLeadTime {
  return typeof value === "string" && (REMINDER_LEAD_TIMES as readonly string[]).includes(value);
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && dateKeyToUtcMillis(value) !== null;
}

function normalizeTypeSettings(input: unknown): ReminderTypeSettings {
  if (!isPlainObject(input)) return DEFAULT_TYPE_SETTINGS;
  return {
    showInApp: typeof input.showInApp === "boolean" ? input.showInApp : DEFAULT_TYPE_SETTINGS.showInApp,
    calendarAlert: isLeadTime(input.calendarAlert) ? input.calendarAlert : DEFAULT_TYPE_SETTINGS.calendarAlert,
    snoozedUntil: isDateKey(input.snoozedUntil) ? input.snoozedUntil : null,
  };
}

/** Any stored value, including garbage, becomes a complete and valid settings object. */
export function normalizeReminderSettings(input: unknown): ReminderSettings {
  if (!isPlainObject(input)) return DEFAULT_REMINDER_SETTINGS;
  const types = isPlainObject(input.types) ? input.types : {};
  const quiet = isPlainObject(input.quietHours) ? input.quietHours : {};
  const defaults = DEFAULT_REMINDER_SETTINGS;
  const cap = input.maxAlertsPerDay;
  return {
    types: Object.fromEntries(REMINDER_TYPES.map((type) => [type, normalizeTypeSettings(types[type])])) as Record<
      ReminderType,
      ReminderTypeSettings
    >,
    quietHours: {
      enabled: typeof quiet.enabled === "boolean" ? quiet.enabled : defaults.quietHours.enabled,
      start: typeof quiet.start === "string" && isValidTime(quiet.start) ? quiet.start : defaults.quietHours.start,
      end: typeof quiet.end === "string" && isValidTime(quiet.end) ? quiet.end : defaults.quietHours.end,
    },
    maxAlertsPerDay:
      typeof cap === "number" && Number.isInteger(cap) && cap >= MIN_ALERTS_PER_DAY && cap <= MAX_ALERTS_PER_DAY
        ? cap
        : defaults.maxAlertsPerDay,
  };
}

/**
 * Apply a partial update field by field, so a client that knows fewer reminder
 * types than the server (an older tab) never resets the ones it omits.
 */
export function mergeReminderSettings(base: ReminderSettings, patch: ReminderSettingsPatch): ReminderSettings {
  return normalizeReminderSettings({
    types: Object.fromEntries(
      REMINDER_TYPES.map((type) => [type, { ...base.types[type], ...(patch.types?.[type] ?? {}) }]),
    ),
    quietHours: { ...base.quietHours, ...(patch.quietHours ?? {}) },
    maxAlertsPerDay: patch.maxAlertsPerDay ?? base.maxAlertsPerDay,
  });
}

export function updateReminderType(
  settings: ReminderSettings,
  type: ReminderType,
  patch: Partial<ReminderTypeSettings>,
): ReminderSettings {
  return { ...settings, types: { ...settings.types, [type]: { ...settings.types[type], ...patch } } };
}

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
