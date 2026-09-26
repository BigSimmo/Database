import { CALENDAR_UTC_OFFSET_MINUTES } from "@/lib/calendar/calendar-event";

/**
 * Perth wall-clock arithmetic for rosters. Perth has no daylight saving, so a
 * fixed UTC+8 offset is exact, and it is the same offset the calendar module
 * uses. Every function here is pure and ignores the device's own zone, so a
 * roster reads the same on a phone set to any zone.
 */

const OFFSET_MS = CALENDAR_UTC_OFFSET_MINUTES * 60 * 1000;

/** `YYYY-MM-DD` + `HH:MM` in Perth → ISO instant, or null for an impossible date or time. */
export function perthWallToIso(date: string, time: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [year, month, day] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const [hour, minute] = [Number(timeMatch[1]), Number(timeMatch[2])];
  if (hour > 23 || minute > 59) return null;
  const utc = Date.UTC(year, month - 1, day, hour, minute) - OFFSET_MS;
  const check = new Date(utc + OFFSET_MS);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return new Date(utc).toISOString();
}

/** The Perth calendar date of an instant, `YYYY-MM-DD`. */
export function perthDateOf(instant: string | Date): string {
  const ms = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 10);
}

/** The Perth wall-clock time of an instant, `HH:MM`. */
export function perthTimeOf(instant: string | Date): string {
  const ms = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  return new Date(ms + OFFSET_MS).toISOString().slice(11, 16);
}

/** `YYYY-MM-DD` plus `days`. */
export function addDaysToDate(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "Mon 3 Oct" for a Perth date. */
export function formatPerthDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[parsed.getUTCDay()]} ${parsed.getUTCDate()} ${MONTHS[parsed.getUTCMonth()]}`;
}
