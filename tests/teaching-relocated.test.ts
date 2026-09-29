import { describe, expect, it } from "vitest";

import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { relocatedOnCallSessions } from "@/lib/teaching/relocated";

function education(id: string, details: Record<string, unknown>, extra: Partial<OnCallEntry> = {}): OnCallEntry {
  return {
    id,
    section: "education",
    slug: id,
    title: `Invented session ${id.slice(0, 4)}`,
    subtitle: null,
    body: null,
    details,
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
    ...extra,
  };
}

const weeklyId = "11111111-1111-4111-8111-111111111111";
const onceId = "22222222-2222-4222-8222-222222222222";

describe("relocatedOnCallSessions", () => {
  it("returns only the next occurrence when no range end is given, as On Call listed it", () => {
    const sessions = relocatedOnCallSessions(
      [
        education(weeklyId, {
          nextOccurrenceDate: "2026-09-03",
          nextOccurrence: "12:30",
          recurrenceRule: { frequency: "weekly" },
        }),
      ],
      "2026-09-28",
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      occurrenceId: `${weeklyId}@2026-10-01`,
      serviceId: "on-call",
      startsAt: "2026-10-01T04:30:00.000Z",
      endsAt: "2026-10-01T05:30:00.000Z",
      source: "on_call_relocated",
      status: "scheduled",
      hasJoinLink: false,
      isPresenter: false,
    });
  });

  it("repeats a weekly session in every week of a longer range, each with its own id", () => {
    const sessions = relocatedOnCallSessions(
      [
        education(weeklyId, {
          nextOccurrenceDate: "2026-09-03",
          nextOccurrence: "12:30",
          recurrenceRule: { frequency: "weekly" },
        }),
      ],
      "2026-09-28",
      "2026-10-18",
    );
    expect(sessions.map((session) => session.occurrenceId)).toEqual([
      `${weeklyId}@2026-10-01`,
      `${weeklyId}@2026-10-08`,
      `${weeklyId}@2026-10-15`,
    ]);
  });

  it("keeps a one-off inside the range and drops one that has passed", () => {
    const entries = [
      education(onceId, { nextOccurrenceDate: "2026-10-02", nextOccurrence: "13:00" }),
      education(weeklyId, { nextOccurrenceDate: "2026-09-01", nextOccurrence: "13:00" }),
    ];
    expect(relocatedOnCallSessions(entries, "2026-09-28", "2026-10-04").map((s) => s.occurrenceId)).toEqual([
      `${onceId}@2026-10-02`,
    ]);
  });

  it("marks a session whose time is words, not a clock time, as all day rather than guessing", () => {
    const [session] = relocatedOnCallSessions(
      [education(onceId, { nextOccurrenceDate: "2026-10-02", nextOccurrence: "Thursday lunchtime" })],
      "2026-09-28",
    );
    expect(session).toMatchObject({
      allDay: true,
      startsAt: "2026-10-01T16:00:00.000Z",
      endsAt: "2026-10-02T16:00:00.000Z",
    });
  });

  it("carries the place but never the presenter or recording link", () => {
    const [session] = relocatedOnCallSessions(
      [
        education(onceId, {
          nextOccurrenceDate: "2026-10-02",
          nextOccurrence: "13:00",
          location: "Invented room",
          presenter: "Dr Invented Person",
          recordingUrl: "https://example.org/recording",
        }),
      ],
      "2026-09-28",
    );
    expect(session.venue).toBe("Invented room");
    expect(JSON.stringify(session)).not.toContain("Invented Person");
    expect(JSON.stringify(session)).not.toContain("recording");
  });

  it("ignores undated sessions and other sections", () => {
    const entries = [
      education(onceId, { recurrence: "Weekly, by arrangement" }),
      education(weeklyId, { nextOccurrenceDate: "2026-10-02" }, { section: "contacts" }),
    ];
    expect(relocatedOnCallSessions(entries, "2026-09-28", "2026-10-30")).toEqual([]);
  });

  it("sorts by start time, then title", () => {
    const sessions = relocatedOnCallSessions(
      [
        education(weeklyId, { nextOccurrenceDate: "2026-10-02", nextOccurrence: "13:00" }, { title: "B session" }),
        education(onceId, { nextOccurrenceDate: "2026-10-02", nextOccurrence: "13:00" }, { title: "A session" }),
      ],
      "2026-09-28",
    );
    expect(sessions.map((session) => session.title)).toEqual(["A session", "B session"]);
  });
});
