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
import { awstCalendarDay, awstWallTimeToInstant, toAwstParts } from "./clock";
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

/**
 * `firstContactReason` is the reason this function ACCEPTED, ready to be stored, or null when the
 * plan holds none.
 *
 * It is published here rather than left for each store to work out from its own copy of the input,
 * because deciding whether a reason is required is this module's rule and nowhere else's: the
 * reason is demanded only when the first contact moves off the default day, and a store that
 * re-derived "did it move?" would be a second copy of that rule, free to disagree with this one.
 * Both stores then write exactly what was validated -- trimmed, and null when nothing was required
 * -- so neither can persist a string this function refused or a string it never looked at.
 */
export type ScheduleResult =
  { ok: true; contacts: PlannedContact[]; firstContactReason: string | null } | { ok: false; reason: string };

/** Approved AWST wall-clock send hours. */
const SEND_HOUR_BY_PREFERENCE: Record<SendingPreference, number> = {
  morning: 10,
  afternoon: 14,
  earlyEvening: 17,
};

/**
 * A sending preference as a screen may present it: the value, its name, and the AWST wall-clock
 * time it actually sends at.
 *
 * PUBLISHED HERE BECAUSE THE HOUR IS THIS MODULE'S RULE. `SEND_HOUR_BY_PREFERENCE` above is what
 * `buildApprovedSchedule` uses, and a screen that wrote "10:00 am AWST" beside a radio button would
 * be a second copy of it — free to go on saying 10:00 after the hour moved, on the screen where a
 * coordinator decides when a discharged patient hears from the service. `sendTime` is DERIVED from
 * the same constant rather than restated, so it cannot drift, and the wording sits beside the rule
 * it names exactly as `APPROVAL_ROLE_WORDING` does in `service-state.ts`.
 */
export type SendingPreferenceOption = {
  preference: SendingPreference;
  /** The choice's name, in plain words. */
  label: string;
  /** The approved AWST wall-clock send time, derived from `SEND_HOUR_BY_PREFERENCE`. */
  sendTime: string;
};

const SENDING_PREFERENCE_LABELS: Record<SendingPreference, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  earlyEvening: "Early evening",
};

function awstWallClockLabel(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:00 ${suffix} AWST`;
}

/**
 * The three preferences in the order they occur in a day, earliest first.
 *
 * The ORDER is derived from the send hours too, not chosen by whoever renders it: a list whose
 * order was typed out separately could present early evening between morning and afternoon and
 * nothing would say so.
 */
export const SENDING_PREFERENCE_OPTIONS: readonly SendingPreferenceOption[] = Object.freeze(
  (Object.keys(SENDING_PREFERENCE_LABELS) as SendingPreference[])
    .sort((left, right) => SEND_HOUR_BY_PREFERENCE[left] - SEND_HOUR_BY_PREFERENCE[right])
    .map((preference) =>
      Object.freeze({
        preference,
        label: SENDING_PREFERENCE_LABELS[preference],
        sendTime: awstWallClockLabel(SEND_HOUR_BY_PREFERENCE[preference]),
      }),
    ),
);

/** Nothing may be scheduled before 09:00 or at/after 18:00 AWST. */
const EARLIEST_SEND_HOUR = 9;
const LATEST_SEND_HOUR_EXCLUSIVE = 18;

// Fail loudly at load time if a future edit moves a send hour outside the approved window.
for (const hour of Object.values(SEND_HOUR_BY_PREFERENCE)) {
  if (hour < EARLIEST_SEND_HOUR || hour >= LATEST_SEND_HOUR_EXCLUSIVE) {
    throw new Error(`caring-contacts schedule: send hour ${hour} falls outside the approved 09:00-18:00 AWST window`);
  }
}

/**
 * The approved window, published so a caller does not have to restate it. It is the same pair of
 * constants the load-time assertion above enforces -- exported, not duplicated -- because anything
 * that decides whether a send is still allowed (a retry, for instance) is deciding it against this
 * window, and a second copy of these numbers is how the two would drift apart.
 */
export const APPROVED_SEND_WINDOW = Object.freeze({
  earliestHour: EARLIEST_SEND_HOUR,
  latestHourExclusive: LATEST_SEND_HOUR_EXCLUSIVE,
});

/** True when `instant` falls inside the approved AWST send window of its own calendar day. */
export function isWithinApprovedSendWindow(instant: Date): boolean {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) return false;
  const { hour } = toAwstParts(instant);
  return hour >= APPROVED_SEND_WINDOW.earliestHour && hour < APPROVED_SEND_WINDOW.latestHourExclusive;
}

const WEEK_ONE_OFFSET_DAYS = 7;
const MONTH_OFFSETS = [1, 2, 3, 4, 6, 8, 10, 12] as const;

const FIRST_CONTACT_DEFAULT_OFFSET_DAYS = 1;
const FIRST_CONTACT_MIN_OFFSET_DAYS = 0;
const FIRST_CONTACT_MAX_OFFSET_DAYS = 7;

/**
 * The longest first-contact reason this domain accepts, in characters after trimming (Ruling 106).
 *
 * Five hundred is a few sentences: enough for a coordinator to say what the ward agreed with the
 * patient and why, and short enough that the field stays a reason rather than becoming a clinical
 * note nobody reviews. It is a limit chosen to be generous, so hitting it is a signal that the
 * wrong thing is being written here, not an obstacle to writing the right one.
 *
 * An over-long reason is REFUSED by its own name, never trimmed to fit. A clinical reason cut off
 * mid-sentence can invert its meaning -- "not because the family objected" truncated after "not"
 * says the opposite -- and nothing in the record would show that it had happened.
 *
 * The Postgres column carries a matching check. That is defence in depth, exactly as
 * `isAwstCalendarDay` is against the schema's calendar-day pattern: the rule is enforced here,
 * where the input arrives and where the refusal can be named, and the column is the backstop for a
 * write that somehow reached it another way.
 */
export const FIRST_CONTACT_REASON_MAX_LENGTH = 500;

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

/**
 * True only for a real AWST calendar day in `YYYY-MM-DD` form — the shape `PlannedContact.calendarDay`
 * carries and every calendar comparison in this domain assumes.
 *
 * Exported because it was needed twice and existed once. `./assignment` compares coverage windows as
 * calendar days, but validated them only with `until > from` — a LEXICAL string compare that
 * `"cherry" > "banana"` satisfies — so a window of nonsense was accepted, stored, and then silently
 * named the wrong responder. The Postgres schema carried a `~ '^\d{4}-\d{2}-\d{2}$'` check, which
 * made the database the only thing enforcing a rule the domain owns, and made the two stores answer
 * the same malformed request differently. The rule belongs here, beside the format it defines.
 *
 * Stricter than that regular expression on purpose: it rejects `2026-02-30` and `2026-13-01` as
 * well, so the SQL check is defence in depth rather than the enforcement.
 */
export function isAwstCalendarDay(value: string): boolean {
  return typeof value === "string" && parseCalendarDay(value) !== null;
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

  // What this function accepted, for the store to persist. Null while the first contact is on the
  // usual day: no reason was required then, so there is nothing the record is missing. A reason
  // supplied alongside an unmoved date is deliberately NOT kept -- it explains nothing, and free
  // text about a patient that no surface ever accounts for is text that should not be stored.
  let acceptedReason: string | null = null;

  if (input.firstContactDate !== undefined) {
    const requested = parseCalendarDay(input.firstContactDate);
    if (!requested) return { ok: false, reason: "first-contact-invalid-date" };

    const offset = differenceInCalendarDays(requested, dischargeDay);
    if (offset < FIRST_CONTACT_MIN_OFFSET_DAYS || offset > FIRST_CONTACT_MAX_OFFSET_DAYS) {
      return { ok: false, reason: "first-contact-out-of-range" };
    }

    const isDefault = offset === FIRST_CONTACT_DEFAULT_OFFSET_DAYS;
    if (!isDefault) {
      const reason = (input.firstContactReason ?? "").trim();
      if (reason === "") return { ok: false, reason: "first-contact-reason-required" };
      if (reason.length > FIRST_CONTACT_REASON_MAX_LENGTH) {
        return { ok: false, reason: "first-contact-reason-too-long" };
      }
      acceptedReason = reason;
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

  return { ok: true, contacts, firstContactReason: acceptedReason };
}
