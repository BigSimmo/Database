import { addDays, dateKeyToUtcMillis, utcMillisToDateKey } from "@/lib/calendar/calendar-event";

/**
 * A month laid out as whole weeks, Monday first (the Australian convention),
 * padded with the neighbouring months' days so every row has seven cells.
 */
export type MonthGridDay = { readonly date: string; readonly inMonth: boolean };

export const WEEKDAY_SHORT_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const MONTH_KEY = /^(\d{4})-(\d{2})$/;

export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(monthKey: string, months: number): string {
  const match = MONTH_KEY.exec(monthKey);
  if (!match) throw new Error(`Not a month key: ${monthKey}`);
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + months, 1));
  return utcMillisToDateKey(shifted.getTime()).slice(0, 7);
}

/** Monday = 0 … Sunday = 6. */
function mondayIndex(date: string): number {
  const millis = dateKeyToUtcMillis(date);
  if (millis === null) throw new Error(`Not a calendar date: ${date}`);
  return (new Date(millis).getUTCDay() + 6) % 7;
}

export function monthGrid(monthKey: string): readonly (readonly MonthGridDay[])[] {
  if (!MONTH_KEY.test(monthKey)) throw new Error(`Not a month key: ${monthKey}`);
  const first = `${monthKey}-01`;
  const last = addDays(`${shiftMonth(monthKey, 1)}-01`, -1);
  const start = addDays(first, -mondayIndex(first));
  const end = addDays(last, 6 - mondayIndex(last));
  const weeks: MonthGridDay[][] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) weeks.push([]);
    weeks[weeks.length - 1].push({ date: day, inMonth: monthKeyOf(day) === monthKey });
  }
  return weeks;
}

export function monthGridRange(monthKey: string): { start: string; end: string } {
  const weeks = monthGrid(monthKey);
  return { start: weeks[0][0].date, end: weeks[weeks.length - 1][6].date };
}
