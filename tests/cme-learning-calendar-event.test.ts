import { describe, expect, it } from "vitest";

import { canAddLearningToCalendar, learningCalendarEventIcs } from "@/lib/cme/calendar-event";
import type { LearningDirectoryItem } from "@/lib/cme/learning-directory";

const event: LearningDirectoryItem = {
  id: "wa-learning-day",
  title: "Learning, safety & care",
  provider: "Synthetic organiser",
  kind: "event",
  datesConfirmed: true,
  startsOn: "2026-10-14",
  endsOn: "2026-10-16",
  mode: "in-person",
  location: "Perth; WA",
  costNote: "Free",
  url: "https://example.org/private-query",
  sourceUrl: "https://example.org/source",
  lastCheckedOn: "2026-09-26",
};

describe("one public Learning event calendar file", () => {
  it("has exact deterministic all-day ICS text, an inclusive date range and a one-day alert", () => {
    const expected = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PsychSift//Learning//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:wa-learning-day@psychiatry.tools",
      "DTSTAMP:20260926T000000Z",
      "DTSTART;VALUE=DATE:20261014",
      "DTEND;VALUE=DATE:20261017",
      "SUMMARY:Learning\\, safety & care",
      "LOCATION:Perth\\; WA",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-P1D",
      "DESCRIPTION:Learning\\, safety & care",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    expect(learningCalendarEventIcs(event)).toBe(expected);
    expect(learningCalendarEventIcs({ ...event })).toBe(expected);
    expect(expected).not.toContain("example.org");
    expect(expected).not.toContain("Synthetic organiser");
  });

  it("converts Perth wall times to UTC and refuses guessed dates", () => {
    const timed = learningCalendarEventIcs({
      ...event,
      startsOn: "2026-10-14",
      endsOn: null,
      startsAt: "09:30",
      endsAt: "16:00",
    });
    expect(timed).toContain("DTSTART:20261014T013000Z\r\nDTEND:20261014T080000Z");
    expect(timed).not.toContain("VALUE=DATE");
    const unconfirmed = { ...event, datesConfirmed: false, startsOn: null };
    expect(canAddLearningToCalendar(unconfirmed)).toBe(false);
    expect(learningCalendarEventIcs(unconfirmed)).toBeNull();
  });
});
