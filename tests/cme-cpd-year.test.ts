import { describe, expect, it } from "vitest";

import {
  CPD_PACE_MINIMUM_ELAPSED_DAYS,
  cpdYearBounds,
  cpdYearOf,
  daysElapsedInCpdYear,
  daysInCpdYear,
  daysRemainingInCpdYear,
  formatCalendarDateLong,
  formatCalendarDateShort,
  formatCalendarMonthLabel,
  paceProjection,
  perthCalendarDate,
} from "@/lib/cme/cpd-year";

describe("the CPD year is a Perth year", () => {
  it("puts the first hours of a Perth new year in the new year, though UTC is still in the old one", () => {
    // 07:00 on 1 January 2027 in Perth is 23:00 on 31 December 2026 in UTC.
    const instant = new Date("2026-12-31T23:00:00Z");
    expect(perthCalendarDate(instant)).toBe("2027-01-01");
    expect(cpdYearOf(instant)).toBe(2027);
    expect(instant.getUTCFullYear()).toBe(2026); // the bug this function exists to prevent
  });

  it("puts a late Perth evening on 31 December in the year that is closing", () => {
    // 22:00 on 31 December 2026 in Perth is 14:00 the same day in UTC.
    const instant = new Date("2026-12-31T14:00:00Z");
    expect(perthCalendarDate(instant)).toBe("2026-12-31");
    expect(cpdYearOf(instant)).toBe(2026);
  });

  it("runs the year from 1 January to 31 December", () => {
    expect(cpdYearBounds(2026)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(daysInCpdYear(2026)).toBe(365);
    expect(daysInCpdYear(2028)).toBe(366);
  });

  it("counts elapsed and remaining days from a Perth calendar date", () => {
    const instant = new Date("2026-09-19T02:00:00Z"); // 10:00, 19 September, Perth
    expect(daysElapsedInCpdYear(instant, 2026)).toBe(262);
    expect(daysRemainingInCpdYear(instant, 2026)).toBe(103);
  });
});

describe("pace", () => {
  it("projects the year's total from the rate so far", () => {
    const projection = paceProjection({
      hoursSoFar: 32.5,
      targetHours: 50,
      instant: new Date("2026-09-19T02:00:00Z"),
      year: 2026,
    });
    expect(projection).not.toBeNull();
    expect(projection!.projectedHours).toBeCloseTo(45.27, 1);
    expect(projection!.shortfallHours).toBeCloseTo(4.73, 1);
  });

  it("reports no shortfall when the rate finishes the year", () => {
    const projection = paceProjection({
      hoursSoFar: 40,
      targetHours: 50,
      instant: new Date("2026-09-19T02:00:00Z"),
      year: 2026,
    });
    expect(projection!.shortfallHours).toBe(0);
  });

  it("says nothing in January, because a rate from a fortnight is noise", () => {
    expect(
      paceProjection({
        hoursSoFar: 1.5,
        targetHours: 50,
        instant: new Date("2026-01-06T02:00:00Z"),
        year: 2026,
      }),
    ).toBeNull();
    expect(CPD_PACE_MINIMUM_ELAPSED_DAYS).toBe(28);
  });

  it("says nothing about a year the instant is not inside", () => {
    // Opening last year's record in September does not make last year 531 days
    // long. Without this guard the elapsed-day count runs past the end of the
    // year and the projection reads as a confident, wrong number of hours.
    const instant = new Date("2026-09-19T02:00:00Z");
    expect(paceProjection({ hoursSoFar: 32.5, targetHours: 50, instant, year: 2025 })).toBeNull();
    expect(paceProjection({ hoursSoFar: 0, targetHours: 50, instant, year: 2027 })).toBeNull();
  });

  it("reports hours to two decimals, because the screen reads them as hours", () => {
    const projection = paceProjection({
      hoursSoFar: 32.5,
      targetHours: 50,
      instant: new Date("2026-09-19T02:00:00Z"),
      year: 2026,
    });
    expect(projection).toEqual({ projectedHours: 45.28, shortfallHours: 4.72 });
  });
});

/**
 * All three formatters below are plain string arithmetic on an already-known
 * Perth calendar date — never `Date.UTC` plus `Intl.DateTimeFormat` — for the
 * same reason `formatRoutineDueDate` in `routines.ts` gives: the value is
 * already the correct Perth calendar day, so routing it through an instant
 * and re-projecting it through a time zone is a needless round trip a
 * runtime whose local zone sits behind UTC could roll onto the wrong day.
 * These three tests would not catch a `Date.UTC` regression by running slow
 * or flaky — they would catch it by being logically incapable of drifting
 * with the reader's local clock, since there is no clock involved at all.
 */
describe("calendar date formatting stays plain string arithmetic", () => {
  it("formats a long calendar date with the full month name and year", () => {
    expect(formatCalendarDateLong("2026-09-19")).toBe("19 September 2026");
    expect(formatCalendarDateLong("2026-01-01")).toBe("1 January 2026");
    expect(formatCalendarDateLong("2026-12-31")).toBe("31 December 2026");
  });

  it("formats a short calendar date with the abbreviated month and no year", () => {
    expect(formatCalendarDateShort("2026-09-16")).toBe("16 Sep");
    expect(formatCalendarDateShort("2026-01-01")).toBe("1 Jan");
  });

  it("formats a YYYY-MM month key as a month name and year", () => {
    expect(formatCalendarMonthLabel("2026-09")).toBe("September 2026");
    expect(formatCalendarMonthLabel("2025-12")).toBe("December 2025");
  });
});
