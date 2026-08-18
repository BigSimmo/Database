export const AWST_TIME_ZONE = "Australia/Perth";

export type Clock = { now(): Date };

export function fixedClock(iso: string): Clock {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) throw new Error(`fixedClock: invalid instant ${iso}`);
  return { now: () => new Date(instant.getTime()) };
}

export function systemClock(): Clock {
  return { now: () => new Date() };
}

export type AwstParts = { year: number; month: number; day: number; hour: number; minute: number };

const AWST_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: AWST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function toAwstParts(instant: Date): AwstParts {
  const parts = Object.fromEntries(AWST_FORMAT.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function awstCalendarDay(instant: Date): string {
  const { year, month, day } = toAwstParts(instant);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** AWST is UTC+8 year-round, so a local wall time maps to exactly one instant. */
export function awstWallTimeToInstant(calendarDay: string, hour: number, minute = 0): Date {
  const [year, month, day] = calendarDay.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0, 0));
}
