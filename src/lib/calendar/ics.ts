import { addDays, eventUtcRange, type CalendarEvent, type CalendarRecurrence } from "@/lib/calendar/calendar-event";

/**
 * An iCalendar (RFC 5545) file for a set of events: the one format every
 * calendar — Apple, Google, Outlook — imports. Built on the device and handed
 * to the owner as a download; nothing is sent anywhere.
 *
 * Timed events are written in UTC (`Z`) rather than with a `TZID`, which is
 * exact for Perth (no daylight saving) and avoids shipping a VTIMEZONE block.
 */

const PRODUCT_ID = "-//PsychSift//Calendar//EN";
const UID_DOMAIN = "psychiatry.tools";

/** RFC 5545 §3.3.11: backslash, semicolon and comma are escaped; newlines become `\n`. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + one space.
 * Counted in UTF-8 bytes, and never splitting a multi-byte character.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    // The first line may hold 75 octets; continuation lines lose one to the leading space.
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function compactDate(date: string): string {
  return date.replace(/-/g, "");
}

export function compactUtc(instant: Date): string {
  return instant
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function recurrenceRule(recurrence: CalendarRecurrence): string {
  switch (recurrence) {
    case "weekly":
      return "FREQ=WEEKLY";
    case "fortnightly":
      return "FREQ=WEEKLY;INTERVAL=2";
    case "monthly":
      return "FREQ=MONTHLY";
    case "quarterly":
      return "FREQ=MONTHLY;INTERVAL=3";
  }
}

function eventLines(event: CalendarEvent, stamp: Date): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${event.id}@${UID_DOMAIN}`, `DTSTAMP:${compactUtc(stamp)}`];
  const range = eventUtcRange(event);
  if (range) {
    lines.push(`DTSTART:${compactUtc(range.start)}`, `DTEND:${compactUtc(range.end)}`);
  } else {
    // All-day: DTEND is the day after, exclusive.
    lines.push(
      `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(event.date, 1))}`,
    );
  }
  if (event.recurrence) lines.push(`RRULE:${recurrenceRule(event.recurrence)}`);
  lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.notes) lines.push(`DESCRIPTION:${escapeIcsText(event.notes)}`);
  lines.push("END:VEVENT");
  return lines;
}

export function toIcs(
  events: readonly CalendarEvent[],
  options: { name?: string; now?: Date; refreshHours?: number } = {},
): string {
  const stamp = options.now ?? new Date();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${PRODUCT_ID}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (options.name) lines.push(`X-WR-CALNAME:${escapeIcsText(options.name)}`);
  // A subscribed feed asks the calendar app to re-read it this often. Apple and
  // Outlook honour it; Google keeps its own schedule (roughly daily).
  if (options.refreshHours && Number.isInteger(options.refreshHours) && options.refreshHours > 0) {
    lines.push(
      `REFRESH-INTERVAL;VALUE=DURATION:PT${options.refreshHours}H`,
      `X-PUBLISHED-TTL:PT${options.refreshHours}H`,
    );
  }
  for (const event of events) lines.push(...eventLines(event, stamp));
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

/** A file name safe on every platform: letters, digits and hyphens. */
export function icsFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "calendar"}.ics`;
}
