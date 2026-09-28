import { describe, expect, it } from "vitest";

import { fortnightFor, summariseHours, type HoursShift } from "@/lib/roster/hours";
import type { ShiftKind } from "@/lib/roster/shift-kind";
import { perthWallToIso, addDaysToDate } from "@/lib/roster/shifts/perth-time";
import { summariseToday, type TodayShift } from "@/lib/roster/today";

/* Hours and Today from invented shifts, all in Perth time. */

function shift(
  date: string,
  start: string,
  end: string,
  kind: ShiftKind,
  id = `${date}-${kind}`,
): TodayShift & HoursShift {
  const endDate = end > start ? date : addDaysToDate(date, 1);
  return { id, kind, startsAt: perthWallToIso(date, start)!, endsAt: perthWallToIso(endDate, end)! };
}

describe("fortnightFor", () => {
  it("starts on the Monday of last week without a pay anchor", () => {
    expect(fortnightFor("2026-10-07", null)).toEqual({ start: "2026-09-28", end: "2026-10-11" });
  });
  it("lines up with a pay fortnight, before or after the anchor", () => {
    expect(fortnightFor("2026-10-07", "2026-09-24")).toEqual({ start: "2026-09-24", end: "2026-10-07" });
    expect(fortnightFor("2026-09-20", "2026-09-24")).toEqual({ start: "2026-09-10", end: "2026-09-23" });
  });
});

describe("summariseHours", () => {
  const window = { start: "2026-09-28", end: "2026-10-11" };
  const shifts = [
    shift("2026-09-28", "08:00", "16:30", "day"),
    shift("2026-09-29", "08:00", "16:30", "day"),
    shift("2026-09-30", "14:00", "22:30", "evening"),
    shift("2026-10-01", "21:30", "08:00", "night"),
    shift("2026-10-02", "21:30", "08:00", "night"),
    shift("2026-10-04", "08:00", "08:00", "on_call"),
    shift("2026-10-05", "08:00", "16:30", "leave"),
  ];

  it("counts worked hours only, on the day each shift starts", () => {
    const summary = summariseHours(shifts, [], window);
    expect(summary.totalHours).toBe(8.5 * 3 + 10.5 * 2);
    expect(summary.days.find((day) => day.date === "2026-10-01")?.hours).toBe(10.5);
    expect(summary.days.find((day) => day.date === "2026-10-04")?.hours).toBe(0);
    expect(summary.days).toHaveLength(14);
  });

  it("gives the fatigue facts", () => {
    const summary = summariseHours(shifts, [], window);
    expect(summary.shortestBreakHours).toBe(13.5); // night ends 08:00, next night starts 21:30
    expect(summary.maxDaysInRow).toBe(5);
    expect(summary.maxNightsInRow).toBe(2);
    expect(summary.maxHoursIn7Days).toBe(46.5);
  });

  it("adds finished extra time and ignores a recall still running", () => {
    const summary = summariseHours(
      shifts,
      [
        { startedAt: perthWallToIso("2026-09-28", "16:30")!, endedAt: perthWallToIso("2026-09-28", "17:45")! },
        { startedAt: perthWallToIso("2026-10-06", "02:10")!, endedAt: null },
      ],
      window,
    );
    expect(summary.extraHours).toBe(1.25);
  });

  it("has no shortest break with a single shift", () => {
    expect(summariseHours([shifts[0]!], [], window).shortestBreakHours).toBeNull();
  });
});

describe("summariseToday", () => {
  const at = (date: string, time: string) => new Date(perthWallToIso(date, time)!);
  const shifts = [
    shift("2026-10-12", "08:00", "16:30", "day"),
    shift("2026-10-15", "21:30", "08:00", "night"),
    shift("2026-10-16", "21:30", "08:00", "night"),
    shift("2026-10-17", "08:00", "16:30", "day"),
    shift("2026-10-24", "08:00", "16:30", "day"),
    shift("2026-10-26", "00:00", "00:00", "leave"),
    shift("2026-10-27", "00:00", "00:00", "leave"),
    shift("2026-11-01", "08:00", "16:30", "day"),
  ];

  it("leads with the shift before it starts, then while it is on", () => {
    expect(summariseToday(shifts, at("2026-10-12", "06:00")).lead).toMatchObject({ state: "before" });
    expect(summariseToday(shifts, at("2026-10-12", "09:00")).lead).toMatchObject({ state: "on_now", isNight: false });
    expect(summariseToday(shifts, at("2026-10-16", "03:00")).lead).toMatchObject({ state: "on_now", isNight: true });
  });

  it("leads a day off with the next shift", () => {
    const lead = summariseToday(shifts, at("2026-10-13", "10:00")).lead;
    expect(lead.state).toBe("day_off");
    expect(lead.state === "day_off" && lead.next?.id).toBe("2026-10-15-night");
  });

  it("says a day off only when no worked shift ended earlier today", () => {
    const dayOff = summariseToday(shifts, at("2026-10-13", "10:00")).lead;
    expect(dayOff).toMatchObject({ state: "day_off", finishedToday: false });
    const afterDayShift = summariseToday(shifts, at("2026-10-12", "18:00")).lead;
    expect(afterDayShift).toMatchObject({ state: "day_off", finishedToday: true });
    const afterNightThenDay = summariseToday(shifts, at("2026-10-17", "17:00")).lead;
    expect(afterNightThenDay).toMatchObject({ state: "day_off", finishedToday: true });
    const postNightsDay = summariseToday(shifts, at("2026-10-18", "10:00")).lead;
    expect(postNightsDay).toMatchObject({ state: "day_off", finishedToday: false });
  });

  it("says empty when there are no shifts", () => {
    expect(summariseToday([], at("2026-10-13", "10:00")).lead).toEqual({ state: "empty" });
  });

  it("finds next nights, next leave and the week's letters", () => {
    const summary = summariseToday(shifts, at("2026-10-13", "10:00"));
    expect(summary.nextNights).toEqual({ start: "2026-10-15", end: "2026-10-16" });
    expect(summary.nextLeave).toEqual({ start: "2026-10-26", end: "2026-10-27" });
    expect(summary.week.map((day) => day.kinds.join(""))).toEqual(["day", "", "", "night", "night", "day", ""]);
  });

  it("finds the next weekend off only inside the known roster", () => {
    // Sat 17 is worked; Sat 24 is worked; Sat 31 / Sun 1 Nov: Sunday worked. Nothing after 1 Nov is known.
    expect(summariseToday(shifts, at("2026-10-13", "10:00")).nextWeekendOff).toBeNull();
    const withGap = [...shifts, shift("2026-11-15", "08:00", "16:30", "day")];
    expect(summariseToday(withGap, at("2026-10-13", "10:00")).nextWeekendOff).toEqual({
      saturday: "2026-11-07",
      sunday: "2026-11-08",
    });
  });
});
