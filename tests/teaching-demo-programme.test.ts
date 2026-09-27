import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  DEMO_TEACHING_SERVICE_ID,
  DEMO_TEACHING_TEAM,
  demoOccurrenceId,
  demoTeachingLogbook,
  demoTeachingSessionDetail,
  demoTeachingSessions,
  demoTeachingWeek,
} from "@/lib/teaching/demo-programme";
import { logbookSchema, sessionDetailSchema, teachingWeekSchema } from "@/lib/teaching/model";

// Wednesday 30 September 2026, 09:00 in Perth.
const now = new Date("2026-09-30T01:00:00Z");
const term = { from: "2026-09-28", to: "2026-11-15" };
// The week that holds the next case conference (Monday 5 October), which the demo shows as moved.
const week = { from: "2026-09-30", to: "2026-10-06" };

describe("the demo teaching programme", () => {
  it("is one demo team that accepts only made-up data", () => {
    expect(DEMO_TEACHING_TEAM).toEqual({
      id: DEMO_TEACHING_SERVICE_ID,
      name: "Demo teaching service",
      role: "doctor",
      acceptsRealData: true,
      isDemo: true,
    });
  });

  it("converts all seven On Call demo sessions, every one plainly made up", () => {
    const sessions = demoTeachingSessions(term, now);
    const titles = new Set(sessions.map((session) => session.title));
    expect(titles).toEqual(
      new Set([
        "Demo registrar teaching",
        "Demo journal club",
        "Demo case conference",
        "Demo exam preparation group",
        "Demo grand rounds",
        "Demo simulation afternoon",
        "Demo supervision hour",
      ]),
    );
    for (const session of sessions) {
      expect(session.title.startsWith("Demo ")).toBe(true);
      expect(session.venue?.startsWith("Demo ")).toBe(true);
      expect(session.serviceId).toBe(DEMO_TEACHING_SERVICE_ID);
    }
  });

  it("parses as a real week, with valid unique ids, inside the asked range", () => {
    const parsed = teachingWeekSchema.parse(demoTeachingWeek(week, now));
    const ids = parsed.sessions.map((session) => session.occurrenceId);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(z.uuid().safeParse(id).success).toBe(true);
    for (const session of parsed.sessions) {
      expect(session.startsAt >= "2026-09-29T16:00:00.000Z").toBe(true);
      expect(session.startsAt < "2026-10-06T16:00:00.000Z").toBe(true);
    }
  });

  it("shows one moved session with its notice, so the change banner has something to show", () => {
    const result = demoTeachingWeek(week, now);
    const moved = result.sessions.filter((session) => session.status === "moved");
    expect(moved).toHaveLength(1);
    expect(moved[0].title).toBe("Demo case conference");
    expect(moved[0].startsAt).toBe("2026-10-05T04:30:00.000Z");
    expect(result.notices).toEqual([
      expect.objectContaining({
        occurrenceId: moved[0].occurrenceId,
        kind: "moved",
        serviceId: DEMO_TEACHING_SERVICE_ID,
      }),
    ]);
  });

  it("opens any listed session, with example.org links and no real names", () => {
    const [first] = demoTeachingSessions(term, now);
    const detail = sessionDetailSchema.parse(demoTeachingSessionDetail(first.occurrenceId, now));
    expect(detail.occurrenceId).toBe(first.occurrenceId);
    expect([null, "Demo presenter"]).toContain(detail.presenterName);
    for (const url of [detail.joinUrl, ...detail.materials.map((material) => material.url)]) {
      if (url) expect(new URL(url).hostname).toBe("example.org");
    }
  });

  it("refuses an id that is not a real demo occurrence", () => {
    expect(demoTeachingSessionDetail("11111111-1111-4111-8111-111111111111", now)).toBeNull();
    expect(demoTeachingSessionDetail(demoOccurrenceId(1, "2026-09-29"), now)).toBeNull();
    expect(demoTeachingSessionDetail(demoOccurrenceId(99, "2026-09-30"), now)).toBeNull();
  });

  it("keeps a short logbook of past sessions, most recent first", () => {
    const rows = logbookSchema.parse({ attendance: demoTeachingLogbook(now) }).attendance;
    expect(rows).toHaveLength(2);
    expect(rows[0].startsAt > rows[1].startsAt).toBe(true);
    for (const row of rows) expect(row.startsAt < now.toISOString()).toBe(true);
  });
});
