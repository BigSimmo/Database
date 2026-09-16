import { describe, expect, it } from "vitest";

import type { OnCallEntry } from "@/lib/on-call/entry-model";
import {
  ON_CALL_RECURRENCE_MAX_PERIODS,
  nextTeachingOccurrence,
  onCallTeachingDate,
  onCallTeachingDateLabel,
  onCallTeachingDateParts,
  selectUpcomingTeachingSessions,
} from "@/lib/on-call/teaching-schedule";

function teaching(slug: string, details: Record<string, unknown>, title = slug): OnCallEntry {
  return {
    id: slug,
    slug,
    section: "education",
    title,
    subtitle: null,
    body: null,
    details: { topics: [], ...details },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
  };
}

/** Runs `fn` with the process pinned to `zone`, then puts the zone back. */
function inTimeZone<T>(zone: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

describe("nextTeachingOccurrence", () => {
  it("keeps today's answer for a session with no recurrence", () => {
    expect(nextTeachingOccurrence("2026-09-16", null, "2026-09-16")).toBe("2026-09-16");
    expect(nextTeachingOccurrence("2026-09-17", null, "2026-09-16")).toBe("2026-09-17");
    expect(nextTeachingOccurrence("2026-09-15", null, "2026-09-16")).toBeNull();
  });

  it("rolls a weekly session forward from an anchor months in the past", () => {
    expect(nextTeachingOccurrence("2026-01-01", "weekly", "2026-09-16")).toBe("2026-09-17");
  });

  it("keeps fortnightly parity rather than snapping to the next week", () => {
    expect(nextTeachingOccurrence("2026-01-01", "fortnightly", "2026-09-16")).toBe("2026-09-24");
  });

  it("treats an occurrence falling on today as still upcoming", () => {
    expect(nextTeachingOccurrence("2026-09-03", "weekly", "2026-09-17")).toBe("2026-09-17");
  });

  it("clamps a month-end monthly anchor to the last day of a shorter month", () => {
    expect(nextTeachingOccurrence("2026-01-31", "monthly", "2026-02-01")).toBe("2026-02-28");
    expect(nextTeachingOccurrence("2024-01-31", "monthly", "2024-02-01")).toBe("2024-02-29");
    expect(nextTeachingOccurrence("2026-01-31", "monthly", "2026-04-02")).toBe("2026-04-30");
  });

  it("does not let a clamped February drag later months off the 31st", () => {
    expect(nextTeachingOccurrence("2026-01-31", "monthly", "2026-03-01")).toBe("2026-03-31");
  });

  it("gives the same answer whatever zone the process is running in", () => {
    const zones = ["UTC", "Australia/Perth", "Pacific/Kiritimati", "Etc/GMT+12", "America/Los_Angeles"];
    const weekly = zones.map((zone) =>
      inTimeZone(zone, () => nextTeachingOccurrence("2026-01-01", "weekly", "2026-09-16")),
    );
    expect(new Set(weekly)).toEqual(new Set(["2026-09-17"]));

    const monthly = zones.map((zone) =>
      inTimeZone(zone, () => nextTeachingOccurrence("2026-01-31", "monthly", "2026-02-01")),
    );
    expect(new Set(monthly)).toEqual(new Set(["2026-02-28"]));

    const labels = zones.map((zone) => inTimeZone(zone, () => onCallTeachingDateLabel("2026-09-17")));
    expect(new Set(labels)).toEqual(new Set(["Thu 17 Sep 2026"]));
  });

  it("drops an anchor so far in the past that rolling it forward would spin", () => {
    expect(nextTeachingOccurrence("1900-01-01", "weekly", "2026-09-16")).toBeNull();
    expect(ON_CALL_RECURRENCE_MAX_PERIODS).toBeGreaterThan(52);
  });

  it("drops a date that never existed rather than rolling from it", () => {
    expect(nextTeachingOccurrence("2026-02-30", "weekly", "2026-09-16")).toBeNull();
    expect(nextTeachingOccurrence("Thursday", "weekly", "2026-09-16")).toBeNull();
  });
});

describe("onCallTeachingDate", () => {
  it("reads the anchor and the structured rule off an entry", () => {
    const entry = teaching("journal-club", {
      nextOccurrenceDate: "2026-01-01",
      recurrenceRule: { frequency: "weekly" },
    });
    expect(onCallTeachingDate(entry, "2026-09-16")).toBe("2026-09-17");
  });

  it("is null for an entry with no date at all", () => {
    expect(onCallTeachingDate(teaching("workshop", {}), "2026-09-16")).toBeNull();
  });
});

describe("selectUpcomingTeachingSessions", () => {
  const JOURNAL_CLUB = teaching(
    "journal-club",
    {
      nextOccurrence: "Thursday 1pm",
      nextOccurrenceDate: "2026-01-01",
      recurrenceRule: { frequency: "weekly" },
      presenter: "Dr Ng",
      location: "Seminar room 2",
      recordingUrl: "https://example-hospital-intranet.test/journal-club",
    },
    "Journal club",
  );
  const GRAND_ROUNDS = teaching(
    "grand-rounds",
    { nextOccurrenceDate: "2026-09-16", presenter: "Prof Ash" },
    "Grand rounds",
  );
  const LAPSED = teaching("lapsed-tutorial", { nextOccurrenceDate: "2026-08-01" }, "Lapsed tutorial");
  const UNDATED = teaching("ad-hoc-workshop", { nextOccurrence: "When it is called" }, "Ad hoc workshop");

  it("keeps a recurring session on the list long after its typed date passed", () => {
    const sessions = selectUpcomingTeachingSessions([JOURNAL_CLUB], "2026-09-16");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.date).toBe("2026-09-17");
    expect(sessions[0]?.entry.slug).toBe("journal-club");
  });

  it("drops a one-off session whose date has passed, exactly as today", () => {
    expect(selectUpcomingTeachingSessions([LAPSED], "2026-09-16")).toEqual([]);
  });

  it("ignores a session with no date at all", () => {
    expect(selectUpcomingTeachingSessions([UNDATED], "2026-09-16")).toEqual([]);
  });

  it("carries the owner's own wording so the UI never recomputes it", () => {
    const [session] = selectUpcomingTeachingSessions([JOURNAL_CLUB], "2026-09-16");
    expect(session).toMatchObject({
      when: "Thursday 1pm",
      presenter: "Dr Ng",
      location: "Seminar room 2",
      recordingUrl: "https://example-hospital-intranet.test/journal-club",
    });
  });

  it("sorts soonest first and breaks a tie on title", () => {
    const alsoToday = teaching("all-staff-forum", { nextOccurrenceDate: "2026-09-16" }, "All-staff forum");
    const sessions = selectUpcomingTeachingSessions([JOURNAL_CLUB, GRAND_ROUNDS, alsoToday], "2026-09-16", 10);
    expect(sessions.map((session) => session.entry.slug)).toEqual(["all-staff-forum", "grand-rounds", "journal-club"]);
  });

  it("honours the limit", () => {
    expect(selectUpcomingTeachingSessions([JOURNAL_CLUB, GRAND_ROUNDS], "2026-09-16", 1)).toHaveLength(1);
  });

  it("skips an entry outside the Teaching section", () => {
    const contact = { ...teaching("switchboard", { nextOccurrenceDate: "2026-09-16" }), section: "contacts" as const };
    expect(selectUpcomingTeachingSessions([contact], "2026-09-16")).toEqual([]);
  });
});

describe("date labels", () => {
  it("splits a date key into the parts the strip prints", () => {
    expect(onCallTeachingDateParts("2026-09-17")).toEqual({
      weekday: "Thu",
      day: "17",
      month: "Sep",
      year: "2026",
    });
  });

  it("writes the day before the month, as Australia does", () => {
    expect(onCallTeachingDateLabel("2026-09-17")).toBe("Thu 17 Sep 2026");
  });
});
