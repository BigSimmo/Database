/**
 * Every clock time a reader sees: 24-hour, Perth, "17:30" (Josh, 16:29Z).
 * Built once; `formatToParts` keeps the output "HH:MM" whatever the runtime's
 * en-AU separator is.
 */
const CLOCK = new Intl.DateTimeFormat("en-AU", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Australia/Perth",
});
const PERTH_DAY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Australia/Perth",
});

function toDate(value: Date | string): Date | null {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

function part(date: Date, type: "hour" | "minute"): string {
  return CLOCK.formatToParts(date).find((piece) => piece.type === type)?.value ?? "";
}

export function formatClockTime(value: Date | string): string {
  const date = toDate(value);
  return date ? `${part(date, "hour")}:${part(date, "minute")}` : "";
}

/** "08:00–16:30", or "22:00–08:00 +1" when the end falls on a later Perth day (standard §2). */
export function formatClockRange(start: Date | string, end: Date | string): string {
  const from = toDate(start);
  const to = toDate(end);
  if (!from || !to) return "";
  const dayGap = Math.round(
    (Date.parse(`${PERTH_DAY.format(to)}T00:00:00Z`) - Date.parse(`${PERTH_DAY.format(from)}T00:00:00Z`)) / 86_400_000,
  );
  return `${formatClockTime(from)}–${formatClockTime(to)}${dayGap > 0 ? ` +${dayGap}` : ""}`;
}

/** The Perth hour, 0–23, for a greeting. */
export function perthHour(now: Date): number {
  return Number(part(now, "hour"));
}
