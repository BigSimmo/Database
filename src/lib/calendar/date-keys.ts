/**
 * Perth calendar-date and wall-clock helpers with no other dependencies, so the
 * reminder settings model can validate stored dates without loading the whole
 * calendar event model. `@/lib/calendar/calendar-event` re-exports them.
 */
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;

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

export function isValidTime(time: string): boolean {
  return TIME_KEY.test(time);
}
