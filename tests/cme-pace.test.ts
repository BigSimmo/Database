import { describe, expect, it } from "vitest";

import { perthCalendarDate } from "@/lib/cme/cpd-year";
import {
  buildCmeWeekBars,
  cmeRoutineGapScenarios,
  cmeSeasonLine,
  cmeTargetReachedOn,
  cmeWeeklyPace,
} from "@/lib/cme/pace";
import type { CmeRoutine } from "@/lib/cme/routines";
import type { CmeEntry } from "@/lib/cme/types";

function entry(id: string, date: string, hours: number, archivedAt: string | null = null): CmeEntry {
  return {
    id,
    date,
    title: "Demo journal club",
    allocations: [{ category: "educational", hours }],
    reflection: "",
    costCents: null,
    transcribed: false,
    routineId: null,
    documentId: null,
    buckets: [],
    archivedAt,
  };
}

describe("cmeRoutineGapScenarios", () => {
  const routines: CmeRoutine[] = [
    {
      id: "active",
      title: "Journal club",
      cadence: "monthly",
      usualHours: 2,
      usualAllocations: [{ category: "educational", hours: 1 }],
      nextDue: null,
      archivedAt: null,
    },
    {
      id: "archived",
      title: "Old round",
      cadence: "weekly",
      usualHours: 10,
      usualAllocations: [{ category: "educational", hours: 10 }],
      nextDue: null,
      archivedAt: "2026-02-01T00:00:00Z",
    },
  ];

  it("uses active templates for illustrative total and category scenarios", () => {
    expect(cmeRoutineGapScenarios(routines, 5)).toEqual([
      { routineId: "active", title: "Journal club", hoursPerOccurrence: 2, occurrences: 3, projectedHours: 6 },
    ]);
    expect(cmeRoutineGapScenarios(routines, 5, "educational")[0]?.occurrences).toBe(5);
    expect(cmeRoutineGapScenarios(routines, 0)).toEqual([]);
  });
});

describe("buildCmeWeekBars", () => {
  it("uses 53 spans from 1 January and counts the last day and leap day once", () => {
    const entries = [entry("first", "2024-01-01", 1), entry("leap", "2024-02-29", 2), entry("last", "2024-12-31", 3)];
    const bars = buildCmeWeekBars(entries, 2024, "2024-03-01");
    expect(bars).toHaveLength(53);
    expect(bars[0].hours).toBe(1);
    expect(bars[8].hours).toBe(2);
    expect(bars[52].hours).toBe(3);
    expect(bars.reduce((sum, bar) => sum + bar.hours, 0)).toBe(6);
    expect(bars[8].state).toBe("now");
    expect(bars[52].state).toBe("future");
  });

  it("leaves archived and other-year activities out", () => {
    const bars = buildCmeWeekBars(
      [entry("old", "2025-12-31", 5), entry("archived", "2026-01-01", 7, "2026-01-02T00:00:00Z")],
      2026,
      "2026-12-31",
    );
    expect(bars.reduce((sum, bar) => sum + bar.hours, 0)).toBe(0);
    expect(bars[52].state).toBe("now");
  });
});

describe("cmeWeeklyPace", () => {
  it("spreads the hours still to go over the weeks left to 31 December", () => {
    // 26 Sep: 96 days left = 13.7 weeks; 17.5 h / 13.71 = 1.28, shown as 1.3.
    expect(cmeWeeklyPace({ targetHours: 50, loggedHours: 32.5, today: "2026-09-26", year: 2026 })).toEqual({
      weeksLeft: 13.7,
      weeklyHours: 1.3,
    });
    // 19 Sep (the browser tests' frozen day): 103 days = 14.7 weeks; 1.19, shown as 1.2.
    expect(cmeWeeklyPace({ targetHours: 50, loggedHours: 32.5, today: "2026-09-19", year: 2026 })).toEqual({
      weeksLeft: 14.7,
      weeklyHours: 1.2,
    });
  });

  it("counts from the Perth date, not the UTC one, and never divides by less than a week", () => {
    // 16:30 UTC on 30 December is 00:30 on 31 December in Perth.
    const perthNewYearsEve = perthCalendarDate(new Date("2026-12-30T16:30:00Z"));
    expect(perthNewYearsEve).toBe("2026-12-31");
    expect(cmeWeeklyPace({ targetHours: 50, loggedHours: 32.5, today: perthNewYearsEve, year: 2026 })).toEqual({
      weeksLeft: 0,
      weeklyHours: 17.5,
    });
    // The UTC calendar date would still be 30 December: one day, a different answer.
    expect(cmeWeeklyPace({ targetHours: 50, loggedHours: 32.5, today: "2026-12-30", year: 2026 })).toEqual({
      weeksLeft: 0.1,
      weeklyHours: 17.5,
    });
    // 16:30 UTC on 31 December is already 1 January 2027 in Perth: outside the year.
    const perthNewYear = perthCalendarDate(new Date("2026-12-31T16:30:00Z"));
    expect(cmeWeeklyPace({ targetHours: 50, loggedHours: 32.5, today: perthNewYear, year: 2026 })).toBeNull();
  });

  it("says nothing for the first four weeks of the year", () => {
    expect(cmeWeeklyPace({ targetHours: 50, loggedHours: 1, today: "2026-01-27", year: 2026 })).toBeNull();
    expect(cmeWeeklyPace({ targetHours: 50, loggedHours: 2, today: "2026-01-28", year: 2026 })).toEqual({
      weeksLeft: 48.1,
      weeklyHours: 1,
    });
  });

  it("says nothing once the target is reached, for a zero target, or outside the year", () => {
    expect(cmeWeeklyPace({ targetHours: 50, loggedHours: 50, today: "2026-09-26", year: 2026 })).toBeNull();
    expect(cmeWeeklyPace({ targetHours: 0, loggedHours: 0, today: "2026-09-26", year: 2026 })).toBeNull();
    expect(cmeWeeklyPace({ targetHours: 50, loggedHours: 10, today: "2027-02-14", year: 2026 })).toBeNull();
  });
});

describe("cmeTargetReachedOn", () => {
  it("gives the day the running total first reached the target, whatever order the activities arrive in", () => {
    const entries = [entry("b", "2026-11-12", 20), entry("a", "2026-03-02", 30), entry("c", "2026-12-01", 5)];
    expect(cmeTargetReachedOn(entries, 50)).toBe("2026-11-12");
    expect(cmeTargetReachedOn(entries, 30)).toBe("2026-03-02");
  });

  it("leaves archived activities out", () => {
    const entries = [
      entry("a", "2026-03-02", 30),
      entry("archived", "2026-06-01", 20, "2026-06-02T00:00:00Z"),
      entry("b", "2026-11-12", 20),
    ];
    expect(cmeTargetReachedOn(entries, 50)).toBe("2026-11-12");
  });

  it("adds small amounts without a rounding error", () => {
    const entries = Array.from({ length: 10 }, (_, index) =>
      entry(`tenth-${index}`, `2026-02-${String(index + 10).padStart(2, "0")}`, 0.1),
    );
    expect(cmeTargetReachedOn(entries, 1)).toBe("2026-02-19");
  });

  it("returns null before the target is reached, and for a zero target", () => {
    expect(cmeTargetReachedOn([entry("a", "2026-03-02", 30)], 50)).toBeNull();
    expect(cmeTargetReachedOn([entry("a", "2026-03-02", 30)], 0)).toBeNull();
  });
});

describe("cmeSeasonLine", () => {
  it.each([
    ["2026-01-01", "Early in the year · write your plan"],
    ["2026-01-27", "Early in the year · write your plan"],
    ["2026-01-28", "Year ends 31 Dec 2026, in 48 weeks"],
    ["2026-09-26", "Year ends 31 Dec 2026, in 14 weeks"],
    ["2026-10-01", "Last quarter · year ends 31 Dec 2026, in 13 weeks"],
    ["2026-12-16", "Last quarter · year ends 31 Dec 2026, in 2 weeks"],
    ["2026-12-17", "Last fortnight · closing the year · 31 Dec 2026, in 14 days"],
    ["2026-12-30", "Last fortnight · closing the year · 31 Dec 2026, in 1 day"],
    ["2026-12-31", "Last fortnight · closing the year · 31 Dec 2026, today"],
    ["2027-01-05", "Year ended 31 Dec 2026"],
    ["2025-12-31", "Year starts 1 Jan 2026"],
  ])("on %s reads %j", (today, expected) => {
    expect(cmeSeasonLine({ year: 2026, today })).toBe(expected);
  });
});
