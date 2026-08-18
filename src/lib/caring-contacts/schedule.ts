// src/lib/caring-contacts/schedule.ts
//
// The discharge-anchored twelve-month caring-contact schedule.
//
// Safety contract (decision lock, 2026-08-19):
//   * every contact date is derived from the DISCHARGE calendar day in AWST, never from UTC and
//     never from the first-contact date, so moving the first contact cannot rebase the year;
//   * month arithmetic clamps to the last day of a shorter month (31 Jan + 1 month = 28/29 Feb);
//   * two caring contacts must never land on the same calendar day;
//   * every send instant falls inside the approved 09:00-18:00 AWST window.
//
// Pure and deterministic: the same input always yields byte-identical output.
import { awstCalendarDay, awstWallTimeToInstant } from "./clock";
import type { MessageType, SendingPreference } from "./model";

export type ScheduleInput = {
  dischargeAt: Date;
  sendingPreference: SendingPreference;
  firstContactDate?: string; // AWST calendar day, YYYY-MM-DD
  firstContactReason?: string;
};

export type PlannedContact = {
  sequence: number; // 1..10
  cadenceLabel: string; // "Day 1" | "Week 1" | "Month 1" ...
  calendarDay: string; // AWST YYYY-MM-DD
  sendAt: Date; // exact instant
  messageType: MessageType;
  suppressed?: { reason: "absorbedByFirstContact" };
};

export type ScheduleResult = { ok: true; contacts: PlannedContact[] } | { ok: false; reason: string };

/** Approved AWST wall-clock send hours. */
const SEND_HOUR_BY_PREFERENCE: Record<SendingPreference, number> = {
  morning: 10,
  afternoon: 14,
  earlyEvening: 17,
};

/** Nothing may be scheduled before 09:00 or at/after 18:00 AWST. */
const EARLIEST_SEND_HOUR = 9;
const LATEST_SEND_HOUR_EXCLUSIVE = 18;

// Fail loudly at load time if a future edit moves a send hour outside the approved window.
for (const hour of Object.values(SEND_HOUR_BY_PREFERENCE)) {
  if (hour < EARLIEST_SEND_HOUR || hour >= LATEST_SEND_HOUR_EXCLUSIVE) {
    throw new Error(`caring-contacts schedule: send hour ${hour} falls outside the approved 09:00-18:00 AWST window`);
  }
}

const WEEK_ONE_OFFSET_DAYS = 7;
const MONTH_OFFSETS = [1, 2, 3, 4, 6, 8, 10, 12] as const;

const FIRST_CONTACT_DEFAULT_OFFSET_DAYS = 1;
const FIRST_CONTACT_MIN_OFFSET_DAYS = 0;
const FIRST_CONTACT_MAX_OFFSET_DAYS = 7;

const MILLISECONDS_PER_DAY = 86_400_000;
const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type CalendarParts = { year: number; month: number; day: number };

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function formatCalendarDay(parts: CalendarParts): string {
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCalendarDay(calendarDay: string): CalendarParts | null {
  if (!CALENDAR_DAY_PATTERN.test(calendarDay)) return null;
  const [year, month, day] = calendarDay.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** UTC midnight is used purely as a calendar cursor; it never leaves this module. */
function toUtcCursor(parts: CalendarParts): Date {
  const cursor = new Date(0);
  cursor.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  cursor.setUTCHours(0, 0, 0, 0);
  return cursor;
}

function fromUtcCursor(cursor: Date): CalendarParts {
  return { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate() };
}

function addCalendarDays(parts: CalendarParts, amount: number): CalendarParts {
  return fromUtcCursor(new Date(toUtcCursor(parts).getTime() + amount * MILLISECONDS_PER_DAY));
}

/** Adds whole calendar months, clamping the day to the length of the target month. */
function addCalendarMonths(parts: CalendarParts, amount: number): CalendarParts {
  const monthIndex = parts.month - 1 + amount;
  const year = parts.year + Math.floor(monthIndex / 12);
  const month = (((monthIndex % 12) + 12) % 12) + 1;
  return { year, month, day: Math.min(parts.day, daysInMonth(year, month)) };
}

function differenceInCalendarDays(later: CalendarParts, earlier: CalendarParts): number {
  return Math.round((toUtcCursor(later).getTime() - toUtcCursor(earlier).getTime()) / MILLISECONDS_PER_DAY);
}

function sendHourFor(preference: SendingPreference): number | undefined {
  return Object.prototype.hasOwnProperty.call(SEND_HOUR_BY_PREFERENCE, preference)
    ? SEND_HOUR_BY_PREFERENCE[preference]
    : undefined;
}

export function buildApprovedSchedule(input: ScheduleInput): ScheduleResult {
  const sendHour = sendHourFor(input.sendingPreference);
  if (sendHour === undefined) return { ok: false, reason: "unknown-sending-preference" };

  if (!(input.dischargeAt instanceof Date) || Number.isNaN(input.dischargeAt.getTime())) {
    return { ok: false, reason: "invalid-discharge-instant" };
  }

  // The whole calendar hangs off the AWST discharge day, not the UTC date.
  const dischargeDay = parseCalendarDay(awstCalendarDay(input.dischargeAt));
  if (!dischargeDay) return { ok: false, reason: "invalid-discharge-instant" };

  let firstContactDay = addCalendarDays(dischargeDay, FIRST_CONTACT_DEFAULT_OFFSET_DAYS);

  if (input.firstContactDate !== undefined) {
    const requested = parseCalendarDay(input.firstContactDate);
    if (!requested) return { ok: false, reason: "first-contact-invalid-date" };

    const offset = differenceInCalendarDays(requested, dischargeDay);
    if (offset < FIRST_CONTACT_MIN_OFFSET_DAYS || offset > FIRST_CONTACT_MAX_OFFSET_DAYS) {
      return { ok: false, reason: "first-contact-out-of-range" };
    }

    const isDefault = offset === FIRST_CONTACT_DEFAULT_OFFSET_DAYS;
    if (!isDefault && (input.firstContactReason ?? "").trim() === "") {
      return { ok: false, reason: "first-contact-reason-required" };
    }

    firstContactDay = requested;
  }

  const firstContactCalendarDay = formatCalendarDay(firstContactDay);
  const weekOneCalendarDay = formatCalendarDay(addCalendarDays(dischargeDay, WEEK_ONE_OFFSET_DAYS));

  const cadence: { label: string; calendarDay: string }[] = [
    { label: "Day 1", calendarDay: firstContactCalendarDay },
    { label: "Week 1", calendarDay: weekOneCalendarDay },
    ...MONTH_OFFSETS.map((months) => ({
      label: `Month ${months}`,
      calendarDay: formatCalendarDay(addCalendarMonths(dischargeDay, months)),
    })),
  ];

  const contacts: PlannedContact[] = cadence.map((entry, index) => {
    const sequence = index + 1;
    const messageType: MessageType = sequence === 1 ? "first" : sequence === cadence.length ? "closing" : "standard";
    const contact: PlannedContact = {
      sequence,
      cadenceLabel: entry.label,
      calendarDay: entry.calendarDay,
      sendAt: awstWallTimeToInstant(entry.calendarDay, sendHour),
      messageType,
    };
    // Only Week 1 can collide with the first contact, and only at discharge + 7. Keep the entry so
    // the interface can explain the nine-contact plan, but never send it.
    if (entry.label === "Week 1" && entry.calendarDay === firstContactCalendarDay) {
      contact.suppressed = { reason: "absorbedByFirstContact" };
    }
    return contact;
  });

  // Fail closed rather than ever schedule two caring contacts on one day.
  const sendingDays = contacts.filter((contact) => !contact.suppressed).map((contact) => contact.calendarDay);
  for (let index = 1; index < sendingDays.length; index += 1) {
    if (sendingDays[index] <= sendingDays[index - 1]) {
      return { ok: false, reason: "contacts-not-strictly-increasing" };
    }
  }

  return { ok: true, contacts };
}
