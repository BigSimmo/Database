import { describe, expect, it } from "vitest";

import { toIcs } from "@/lib/calendar/ics";
import { onCallTeachingEvents } from "@/lib/on-call/calendar-events";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { teachingCalendarEvents } from "@/lib/teaching/calendar-events";
import type { SessionSummary } from "@/lib/teaching/model";

const occurrenceId = "33333333-3333-4333-8333-333333333333";

function session(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    occurrenceId,
    serviceId: "22222222-2222-4222-8222-222222222222",
    title: "Invented journal club",
    startsAt: "2026-09-30T04:30:00.000Z",
    endsAt: "2026-09-30T05:45:00.000Z",
    venue: "Invented room",
    hasJoinLink: true,
    status: "scheduled",
    isPresenter: true,
    source: "teaching",
    ...overrides,
  };
}

describe("teachingCalendarEvents", () => {
  it("carries the title, Perth time and place only, and opens the session in Teaching", () => {
    expect(teachingCalendarEvents([session()])).toEqual([
      {
        id: `teaching-${occurrenceId}`,
        title: "Invented journal club",
        date: "2026-09-30",
        startTime: "12:30",
        durationMinutes: 75,
        kind: "teaching",
        reminderType: "teaching",
        location: "Invented room",
        href: `/teaching/session/${occurrenceId}`,
      },
    ]);
  });

  it("marks a cancelled session in words and as cancelled, and never as a reminder", () => {
    const [event] = teachingCalendarEvents([session({ status: "cancelled" })]);
    expect(event).toMatchObject({
      id: `teaching-${occurrenceId}`,
      title: "Cancelled: Invented journal club",
      status: "cancelled",
    });
    expect(event.reminderType).toBeUndefined();
  });

  it("keeps a moved session's id, so a calendar moves it rather than adding a copy", () => {
    const [event] = teachingCalendarEvents([
      session({ status: "moved", startsAt: "2026-09-30T06:00:00.000Z", endsAt: "2026-09-30T07:00:00.000Z" }),
    ]);
    expect(event).toMatchObject({ id: `teaching-${occurrenceId}`, title: "Invented journal club", startTime: "14:00" });
    expect(event.status).toBeUndefined();
  });

  it("uses the Perth date for an early-morning session", () => {
    const [event] = teachingCalendarEvents([
      session({ startsAt: "2026-09-29T23:30:00.000Z", endsAt: "2026-09-30T00:30:00.000Z" }),
    ]);
    expect(event).toMatchObject({ date: "2026-09-30", startTime: "07:30", durationMinutes: 60 });
  });

  it("leaves relocated On Call sessions to On Call's own events", () => {
    expect(teachingCalendarEvents([session({ source: "on_call_relocated", occurrenceId: "x@2026-10-01" })])).toEqual(
      [],
    );
  });
});

describe("the calendar file", () => {
  it("writes a cancelled event as cancelled and refuses it an alarm, whatever it was given", () => {
    const [event] = teachingCalendarEvents([session({ status: "cancelled" })]);
    const body = toIcs([{ ...event, alarmAt: "2026-09-29T04:30:00.000Z" }], { now: new Date("2026-09-26T00:00:00Z") });
    expect(body).toContain("SUMMARY:Cancelled: Invented journal club\r\nSTATUS:CANCELLED\r\n");
    expect(body).not.toContain("VALARM");
  });

  it("leaves a scheduled event as it was before cancellations existed", () => {
    const [event] = teachingCalendarEvents([session()]);
    const body = toIcs([{ ...event, alarmAt: "2026-09-29T04:30:00.000Z" }], { now: new Date("2026-09-26T00:00:00Z") });
    expect(body).not.toContain("STATUS:");
    expect(body).toContain("BEGIN:VALARM");
    expect(body).toContain(`UID:teaching-${occurrenceId}@psychiatry.tools`);
  });
});

describe("On Call's relocated teaching events", () => {
  it("keep their ids, so subscribers see no gap, and now open Teaching's week", () => {
    const entry = {
      id: "44444444-4444-4444-8444-444444444444",
      section: "education",
      slug: "invented-teaching",
      title: "Invented teaching",
      subtitle: null,
      body: null,
      details: { nextOccurrenceDate: "2026-10-01", nextOccurrence: "12:30" },
      linkedDocumentIds: [],
      tags: [],
      isPersonal: false,
      includeOnCard: false,
      sortOrder: 0,
      lastVerifiedAt: null,
    } as OnCallEntry;
    expect(onCallTeachingEvents([entry], "2026-09-28")).toEqual([
      expect.objectContaining({ id: `on-call-teaching-${entry.id}`, href: "/teaching/week" }),
    ]);
  });
});
