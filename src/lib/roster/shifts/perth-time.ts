import {
  addDaysToDate as sharedAddDaysToDate,
  formatPerthDay as sharedFormatPerthDay,
  PERTH_OFFSET_MS,
  PERTH_TIME_ZONE,
  PERTH_UTC_OFFSET_MINUTES,
  perthCalendarDate as sharedPerthCalendarDate,
  perthDateOf as sharedPerthDateOf,
  perthTimeOf as sharedPerthTimeOf,
  perthWallToIso as sharedPerthWallToIso,
} from "@/lib/perth-time";

export { PERTH_OFFSET_MS, PERTH_TIME_ZONE, PERTH_UTC_OFFSET_MINUTES };

export const OFFSET_MS = PERTH_OFFSET_MS;
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** `YYYY-MM-DD` + `HH:MM` in Perth → ISO instant, or null for an impossible date or time. */
export function perthWallToIso(date: string, time: string): string | null {
  return sharedPerthWallToIso(date, time);
}

/** The Perth calendar date of an instant, `YYYY-MM-DD`. */
export function perthDateOf(instant: string | Date): string {
  return sharedPerthDateOf(instant);
}

/** The Perth wall-clock time of an instant, `HH:MM`. */
export function perthTimeOf(instant: string | Date): string {
  return sharedPerthTimeOf(instant);
}

/** `YYYY-MM-DD` plus `days`. */
export function addDaysToDate(date: string, days: number): string {
  return sharedAddDaysToDate(date, days);
}

/** "Mon 3 Oct" for a Perth date. */
export function formatPerthDay(date: string): string {
  return sharedFormatPerthDay(date);
}

export function perthCalendarDate(date: string | Date): string {
  return sharedPerthCalendarDate(date);
}
