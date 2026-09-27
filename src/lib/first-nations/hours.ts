import { awstCalendarDay, awstCalendarDayOffset, toAwstParts } from "@/lib/caring-contacts/clock";
import {
  WA_PUBLIC_HOLIDAYS,
  WA_PUBLIC_HOLIDAYS_LAST_YEAR,
  waPublicHolidaysByRule,
} from "@/lib/on-call/wa-public-holidays";

export type Hours = { days: number[]; open: string; close: string };
export type CallState =
  | { kind: "open"; closesAt: string }
  | { kind: "closed"; opensAt: string | null; opensOn: string | null }
  | { kind: "overdue" }
  | { kind: "unconfirmed" };

const MS_PER_DAY = 86_400_000;
const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function isoWeekdayOf(dayKey: string): number {
  const weekday = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function isHoliday(dayKey: string): boolean {
  const year = Number(dayKey.slice(0, 4));
  return year <= WA_PUBLIC_HOLIDAYS_LAST_YEAR
    ? WA_PUBLIC_HOLIDAYS.has(dayKey)
    : waPublicHolidaysByRule(year).includes(dayKey);
}

function opensOnDay(hours: Hours, dayKey: string): boolean {
  return hours.days.includes(isoWeekdayOf(dayKey)) && !isHoliday(dayKey);
}

function minuteOfDay(now: Date): number {
  const { hour, minute } = toAwstParts(now);
  return hour * 60 + minute;
}

export function isOverdue(checkedAt: string, now: Date, maxDays = 90): boolean {
  const checked = Date.parse(`${checkedAt}T00:00:00+08:00`);
  return Math.floor((now.getTime() - checked) / MS_PER_DAY) > maxDays;
}

function nextOpening(hours: Hours, now: Date): { opensAt: string; opensOn: string } | null {
  const today = awstCalendarDay(now);
  const nowMin = minuteOfDay(now);
  for (let offset = 0; offset < 8; offset += 1) {
    const key = awstCalendarDayOffset(today, offset);
    if (!opensOnDay(hours, key)) continue;
    if (offset === 0 && nowMin >= toMinutes(hours.open)) continue;
    const opensOn = offset === 0 ? "today" : offset === 1 ? "tomorrow" : WEEKDAY_SHORT[isoWeekdayOf(key) - 1];
    return { opensAt: hours.open, opensOn };
  }
  return null;
}

export function callState(hours: Hours | undefined, checkedAt: string, now: Date): CallState {
  if (isOverdue(checkedAt, now)) return { kind: "overdue" };
  if (!hours) return { kind: "unconfirmed" };
  const nowMin = minuteOfDay(now);
  if (opensOnDay(hours, awstCalendarDay(now)) && nowMin >= toMinutes(hours.open) && nowMin < toMinutes(hours.close))
    return { kind: "open", closesAt: hours.close };
  const next = nextOpening(hours, now);
  return { kind: "closed", opensAt: next?.opensAt ?? null, opensOn: next?.opensOn ?? null };
}

export function dayTrack(
  hours: Hours | undefined,
  now: Date,
): { open: { from: number; to: number } | null; now: number } | null {
  if (!hours) return null;
  const open = opensOnDay(hours, awstCalendarDay(now))
    ? { from: toMinutes(hours.open) / 1440, to: toMinutes(hours.close) / 1440 }
    : null;
  return { open, now: minuteOfDay(now) / 1440 };
}

export function hoursInWords(hours: Hours): string {
  const days = [...new Set(hours.days)].sort((a, b) => a - b);
  const range = `${hours.open}–${hours.close}`;
  if (days.length === 7) return `Open ${range}, 7 days`;
  if (days.join() === "1,2,3,4,5") return `Open ${range}, Monday to Friday`;
  const names = days.map((d) => WEEKDAY_LONG[d - 1]);
  const words = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `Open ${range}, ${words}`;
}
