import { describe, expect, it } from "vitest";

import {
  attendanceLabels,
  checkinOpenBodySchema,
  linkCarriesPasscode,
  memberLabel,
  seriesInputSchema,
  sessionDetailSchema,
  teachingCpdBodySchema,
  teachingCpdEntryHref,
  teachingOverviewQuerySchema,
  teachingServiceActionSchema,
  teachingServiceQuerySchema,
  teachingWeekSchema,
} from "@/lib/teaching/model";

const id = "11111111-1111-4111-8111-111111111111";

const series = {
  title: "Invented journal club",
  kind: "journal",
  repeat: "weekly",
  firstDate: "2026-10-01",
  startTime: "12:30",
  minutes: 60,
  endDate: "2026-12-17",
};

const session = {
  occurrenceId: id,
  serviceId: id,
  title: "Invented journal club",
  startsAt: "2026-09-30T04:30:00+00:00",
  endsAt: "2026-09-30T05:30:00+00:00",
  venue: "Invented room",
  hasJoinLink: true,
  status: "scheduled",
  isPresenter: false,
  source: "teaching",
};

describe("Teaching request schemas", () => {
  it("accepts a plain weekly series and fills the optional fields", () => {
    const parsed = seriesInputSchema.parse(series);
    expect(parsed).toMatchObject({ groupIds: [], skipDates: [], venue: null, joinUrl: null, materials: [] });
  });

  // Master plan R4: a series says which level it is for; left out, the database keeps the current value.
  it("takes an optional audience level and never fills one in", () => {
    expect(seriesInputSchema.parse(series)).not.toHaveProperty("audience");
    for (const audience of ["interns", "residents", "registrars", "consultants", "all_doctors"]) {
      expect(seriesInputSchema.safeParse({ ...series, audience }).success).toBe(true);
    }
    expect(seriesInputSchema.safeParse({ ...series, audience: "students" }).success).toBe(false);
    expect(
      teachingServiceActionSchema.safeParse({ action: "series.save", ...series, audience: "registrars" }).success,
    ).toBe(true);
  });

  it("refuses caller identities and unknown fields on every write", () => {
    for (const extra of [{ actorId: id }, { ownerId: id }, { userId: id }, { checkinSecret: "x" }]) {
      expect(
        teachingServiceActionSchema.safeParse({ action: "attendance.self", occurrenceId: id, ...extra }).success,
      ).toBe(false);
    }
    expect(teachingServiceActionSchema.safeParse({ action: "week.read" }).success).toBe(false);
  });

  it.each([
    "http://teams.microsoft.com/l/meetup-join/abc",
    "https://user:secret@example.org/join",
    "https://localhost/join",
    "https://10.0.0.4/join",
    "javascript:alert(1)",
  ])("refuses the unsafe join link %s", (joinUrl) => {
    expect(seriesInputSchema.safeParse({ ...series, joinUrl }).success).toBe(false);
  });

  // Review focus 3: a passcode inside a meeting link is still a stored passcode.
  it.each([
    "https://teams.microsoft.com/meet/123456789?p=AbCdEf",
    "https://example.zoom.us/j/123456789?pwd=abc123",
    "https://example.webex.com/meet/room?PASSWORD=abc",
    "https://example.org/join?pin=4455",
  ])("refuses a join link that carries a passcode: %s", (joinUrl) => {
    const result = seriesInputSchema.safeParse({ ...series, joinUrl });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("Remove the passcode from this link");
  });

  it("accepts a Teams meeting link that has no passcode in it", () => {
    const joinUrl = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d";
    expect(linkCarriesPasscode(joinUrl)).toBe(false);
    expect(seriesInputSchema.safeParse({ ...series, joinUrl }).success).toBe(true);
  });

  it("refuses a series that ends before it starts, runs over a year, or a one-off with two dates", () => {
    expect(seriesInputSchema.safeParse({ ...series, endDate: "2026-09-30" }).success).toBe(false);
    expect(seriesInputSchema.safeParse({ ...series, endDate: "2027-10-03" }).success).toBe(false);
    expect(seriesInputSchema.safeParse({ ...series, repeat: "once", endDate: "2026-10-08" }).success).toBe(false);
    expect(seriesInputSchema.safeParse({ ...series, firstDate: "2026-02-30" }).success).toBe(false);
    expect(seriesInputSchema.safeParse({ ...series, startTime: "24:00" }).success).toBe(false);
  });

  it("checks series rules inside the action union too", () => {
    expect(teachingServiceActionSchema.safeParse({ action: "series.save", ...series }).success).toBe(true);
    expect(
      teachingServiceActionSchema.safeParse({ action: "series.save", ...series, endDate: "2026-09-30" }).success,
    ).toBe(false);
  });

  it("needs new times to move a session, and refuses times when cancelling", () => {
    const base = { action: "occurrence.change", occurrenceId: id, reason: "room_change" };
    expect(teachingServiceActionSchema.safeParse({ ...base, status: "moved" }).success).toBe(false);
    expect(
      teachingServiceActionSchema.safeParse({
        ...base,
        status: "moved",
        startsAt: "2026-10-01T05:00:00Z",
        endsAt: "2026-10-01T04:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      teachingServiceActionSchema.safeParse({
        ...base,
        status: "moved",
        startsAt: "2026-10-01T04:00:00Z",
        endsAt: "2026-10-01T05:00:00Z",
      }).success,
    ).toBe(true);
    expect(
      teachingServiceActionSchema.safeParse({ ...base, status: "cancelled", startsAt: "2026-10-01T04:00:00Z" }).success,
    ).toBe(false);
    expect(teachingServiceActionSchema.safeParse({ ...base, status: "cancelled" }).success).toBe(true);
  });

  it("stores invitation emails trimmed and lower-cased", () => {
    const parsed = teachingServiceActionSchema.parse({ action: "invitation.create", email: "  Doctor@Example.ORG " });
    expect(parsed).toEqual({ action: "invitation.create", email: "doctor@example.org" });
    expect(teachingServiceActionSchema.safeParse({ action: "invitation.create", email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("accepts only six digits as a typed code", () => {
    const base = { action: "checkin.typed", occurrenceId: id, stream: "room" };
    expect(teachingServiceActionSchema.safeParse({ ...base, code: "123456" }).success).toBe(true);
    expect(teachingServiceActionSchema.safeParse({ ...base, code: "12345" }).success).toBe(false);
    expect(teachingServiceActionSchema.safeParse({ ...base, code: "12345a" }).success).toBe(false);
  });

  it("revokes a display link by its secret, never by an id someone could guess", () => {
    expect(teachingServiceActionSchema.safeParse({ action: "display.revoke", token: "a".repeat(64) }).success).toBe(
      true,
    );
    expect(teachingServiceActionSchema.safeParse({ action: "display.revoke", token: id }).success).toBe(false);
  });

  it("limits a week view to 42 days and needs both ends of a range", () => {
    expect(teachingOverviewQuerySchema.parse({})).toEqual({ view: "week" });
    expect(teachingOverviewQuerySchema.safeParse({ from: "2026-09-28" }).success).toBe(false);
    expect(teachingOverviewQuerySchema.safeParse({ from: "2026-09-28", to: "2026-11-08" }).success).toBe(true);
    expect(teachingOverviewQuerySchema.safeParse({ from: "2026-09-28", to: "2026-11-09" }).success).toBe(false);
    expect(teachingOverviewQuerySchema.safeParse({ from: "2026-09-28", to: "2026-09-27" }).success).toBe(false);
    expect(teachingOverviewQuerySchema.safeParse({ view: "logbook", from: "2026-09-28" }).success).toBe(false);
    expect(teachingOverviewQuerySchema.parse({ view: "unlogged-count" })).toEqual({ view: "unlogged-count" });
  });

  it("reads one session by occurrence id, and only in the session view", () => {
    const occurrenceId = "33333333-3333-4333-8333-333333333333";
    expect(teachingOverviewQuerySchema.parse({ view: "session", occurrenceId })).toEqual({
      view: "session",
      occurrenceId,
    });
    expect(teachingOverviewQuerySchema.safeParse({ view: "session" }).success).toBe(false);
    expect(teachingOverviewQuerySchema.safeParse({ view: "week", occurrenceId }).success).toBe(false);
    expect(teachingOverviewQuerySchema.safeParse({ view: "session", occurrenceId: "not-a-uuid" }).success).toBe(false);
  });

  it("limits an attendance export to a year", () => {
    const base = { action: "export.attendance" };
    expect(teachingServiceQuerySchema.safeParse({ ...base, from: "2026-01-01", to: "2026-12-31" }).success).toBe(true);
    expect(teachingServiceQuerySchema.safeParse({ ...base, from: "2026-01-01", to: "2027-01-03" }).success).toBe(false);
  });

  // Master plan R20: capped at 8 hours, matching cme_save_teaching_entry.
  it("takes CPD hours in quarter hours, up to 8", () => {
    const base = { occurrenceId: id, requestId: id };
    expect(teachingCpdBodySchema.safeParse({ ...base, hours: 1.25 }).success).toBe(true);
    expect(teachingCpdBodySchema.safeParse({ ...base, hours: 8 }).success).toBe(true);
    expect(teachingCpdBodySchema.safeParse({ ...base, hours: 1.3 }).success).toBe(false);
    expect(teachingCpdBodySchema.safeParse({ ...base, hours: 0 }).success).toBe(false);
    expect(teachingCpdBodySchema.safeParse({ ...base, hours: 8.25 }).success).toBe(false);
    expect(teachingCpdBodySchema.safeParse({ ...base, hours: 24.25 }).success).toBe(false);
    expect(teachingCpdBodySchema.safeParse({ ...base, hours: 1, ownerId: id }).success).toBe(false);
  });

  it("bounds a scanned token before any parsing", () => {
    expect(checkinOpenBodySchema.safeParse({ token: "x".repeat(101) }).success).toBe(false);
  });
});

describe("Teaching result schemas", () => {
  it("drops any field a database function should never have returned", () => {
    const parsed = sessionDetailSchema.parse({
      ...session,
      joinUrl: "https://example.org/join",
      presenterName: null,
      materials: [],
      changeReason: null,
      canShowCode: false,
      counts: null,
      checkin_secret: "\\x00",
      checkinSecret: "leak",
    });
    expect(parsed).not.toHaveProperty("checkin_secret");
    expect(parsed).not.toHaveProperty("checkinSecret");
  });

  // Master plan R3 and R15: the optional session fields session.read sends survive parsing.
  it("keeps the session fields the database sends for the session page", () => {
    const parsed = sessionDetailSchema.parse({
      ...session,
      status: "moved",
      seriesId: id,
      previousStartsAt: "2026-09-30T04:00:00+00:00",
      visitor: false,
      joinUrl: null,
      presenterName: "Demo Presenter",
      materials: [],
      changeReason: "room_change",
      myAttendance: { method: "self", recordedAt: "2026-09-30T04:40:00+00:00" },
      inCalendar: true,
      canShowCode: true,
      counts: { expected: 12, code: 5, self: 2, visitors: 1 },
    });
    expect(parsed).toMatchObject({
      seriesId: id,
      previousStartsAt: "2026-09-30T04:00:00+00:00",
      visitor: false,
      myAttendance: { method: "self", recordedAt: "2026-09-30T04:40:00+00:00" },
      inCalendar: true,
      counts: { expected: 12, code: 5, self: 2, visitors: 1 },
    });
  });

  it("marks a health-service visitor, and treats a missing marker as a member", () => {
    const base = {
      ...session,
      joinUrl: null,
      presenterName: null,
      materials: [],
      changeReason: null,
      canShowCode: false,
      counts: null,
    };
    expect(sessionDetailSchema.parse({ ...base, visitor: true }).visitor).toBe(true);
    expect(sessionDetailSchema.parse(base).visitor).toBe(false);
    expect(sessionDetailSchema.parse({ ...base, previousStartsAt: null, myAttendance: null })).toMatchObject({
      previousStartsAt: null,
      myAttendance: null,
    });
    expect(
      sessionDetailSchema.safeParse({ ...base, myAttendance: { method: "verified", recordedAt: "x" } }).success,
    ).toBe(false);
  });

  it("keeps a week's sessions free of join links, which only the session page carries", () => {
    const week = teachingWeekSchema.parse({
      teams: [],
      sessions: [{ ...session, joinUrl: "https://example.org/join" }],
      notices: [],
      attendance: [],
    });
    expect(week.sessions[0]).not.toHaveProperty("joinUrl");
  });
});

describe("labels", () => {
  it("names a removed account 'Former member' and an unnamed one 'Member'", () => {
    expect(memberLabel({ userId: null, name: "Demo Doctor" })).toBe("Former member");
    expect(memberLabel({ userId: id, name: null })).toBe("Member");
    expect(memberLabel({ userId: id, name: "  " })).toBe("Member");
    expect(memberLabel({ userId: id, name: "Demo Doctor" })).toBe("Demo Doctor");
  });

  it("never calls attendance verified", () => {
    expect(Object.values(attendanceLabels).join(" ").toLowerCase()).not.toContain("verified");
  });

  // Master plan R1/R16: the label is "Self-reported"; the stored value stays `self`.
  it("labels a self check-in 'Self-reported'", () => {
    expect(attendanceLabels.self).toBe("Self-reported");
    expect(Object.values(attendanceLabels).join(" ")).not.toContain("Self-declared");
  });

  it("links a saved CPD entry to its own page", () => {
    expect(teachingCpdEntryHref(id)).toBe(`/cme/log/${id}`);
  });
});
