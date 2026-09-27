import { CALENDAR_UTC_OFFSET_MINUTES } from "@/lib/calendar/calendar-event";

/**
 * Shared Perth wall-clock and calendar-date arithmetic.
 *
 * Perth (AWST) is UTC+8 with no daylight saving time. A fixed UTC+8 offset is
 * exact year-round, identical to the offset used in the calendar and on-call
 * modules. Every function here is pure and ignores device local time zone so
 * calculations and displays remain deterministic regardless of client locale.
 */

export const PERTH_TIME_ZONE = "Australia/Perth";
export const PERTH_UTC_OFFSET_MINUTES = CALENDAR_UTC_OFFSET_MINUTES; // 480
export const PERTH_OFFSET_MS = PERTH_UTC_OFFSET_MINUTES * 60 * 1000;

export const OFFSET_MS = PERTH_OFFSET_MS;

/**
 * Derives the Perth calendar date `YYYY-MM-DD` for an instant (Date, ISO string, or epoch ms).
 * Defaults to current time when omitted.
 */
export function perthCalendarDate(instant: Date | string | number = new Date()): string {
  const ms =
    typeof instant === "string" ? Date.parse(instant) : typeof instant === "number" ? instant : instant.getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`perthCalendarDate: invalid instant ${String(instant)}`);
  }
  return new Date(ms + PERTH_OFFSET_MS).toISOString().slice(0, 10);
}

/** The Perth calendar date of an instant, `YYYY-MM-DD`. */
export function perthDateOf(instant: string | Date | number = new Date()): string {
  return perthCalendarDate(instant);
}

/** The Perth wall-clock time of an instant, `HH:MM`. */
export function perthTimeOf(instant: string | Date | number): string {
  const ms =
    typeof instant === "string" ? Date.parse(instant) : typeof instant === "number" ? instant : instant.getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`perthTimeOf: invalid instant ${String(instant)}`);
  }
  return new Date(ms + PERTH_OFFSET_MS).toISOString().slice(11, 16);
}

/** `YYYY-MM-DD` + `HH:MM` in Perth → ISO instant, or null for an impossible date or time. */
export function perthWallToIso(date: string, time: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [year, month, day] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const [hour, minute] = [Number(timeMatch[1]), Number(timeMatch[2])];
  if (hour > 23 || minute > 59) return null;
  const utc = Date.UTC(year, month - 1, day, hour, minute) - PERTH_OFFSET_MS;
  const check = new Date(utc + PERTH_OFFSET_MS);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return new Date(utc).toISOString();
}

/** `YYYY-MM-DD` plus `days`. */
export function addDaysToDate(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Alias for addDaysToDate for parity with CME date arithmetic. */
export function addCalendarDays(date: string, days: number): string {
  return addDaysToDate(date, days);
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "Mon 3 Oct" for a Perth date. */
export function formatPerthDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[parsed.getUTCDay()]} ${parsed.getUTCDate()} ${MONTHS[parsed.getUTCMonth()]}`;
}
