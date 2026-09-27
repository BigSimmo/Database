import { describe, expect, it } from "vitest";

import {
  addDaysToDate,
  formatPerthDay,
  PERTH_OFFSET_MS,
  PERTH_TIME_ZONE,
  PERTH_UTC_OFFSET_MINUTES,
  perthCalendarDate,
  perthDateOf,
  perthTimeOf,
  perthWallToIso,
} from "@/lib/perth-time";

describe("perth-time utility", () => {
  it("defines constant Perth timezone and UTC offset", () => {
    expect(PERTH_TIME_ZONE).toBe("Australia/Perth");
    expect(PERTH_UTC_OFFSET_MINUTES).toBe(480);
    expect(PERTH_OFFSET_MS).toBe(480 * 60 * 1000);
  });

  describe("perthCalendarDate / perthDateOf", () => {
    it("matches Intl en-CA formatting across various dates and UTC boundaries", () => {
      const intlFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Australia/Perth",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      const testInstants = [
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T15:59:59.000Z", // 23:59 in Perth -> 2026-01-01
        "2026-01-01T16:00:00.000Z", // 00:00 next day in Perth -> 2026-01-02
        "2026-06-15T12:00:00.000Z",
        "2026-12-31T15:59:59.000Z", // 23:59:59 in Perth -> 2026-12-31
        "2026-12-31T16:00:00.000Z", // 00:00 in Perth -> 2027-01-01
        "2028-02-28T20:00:00.000Z", // Leap year 2028-02-29 in Perth
        "2028-02-29T10:00:00.000Z",
        "2028-02-29T16:00:00.000Z", // 2028-03-01 in Perth
      ];

      for (const iso of testInstants) {
        const date = new Date(iso);
        const expected = intlFormatter.format(date);
        expect(perthCalendarDate(date)).toBe(expected);
        expect(perthCalendarDate(iso)).toBe(expected);
        expect(perthCalendarDate(date.getTime())).toBe(expected);
        expect(perthDateOf(date)).toBe(expected);
      }
    });

    it("defaults to current date when called without arguments", () => {
      const result = perthCalendarDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("throws on invalid instant inputs", () => {
      expect(() => perthCalendarDate("not-a-date")).toThrow("invalid instant");
    });
  });

  describe("perthTimeOf", () => {
    it("extracts HH:MM in Perth wall time", () => {
      // 00:00 UTC = 08:00 AWST
      expect(perthTimeOf("2026-03-14T00:00:00.000Z")).toBe("08:00");
      // 16:30 UTC = 00:30 AWST next day
      expect(perthTimeOf("2026-03-14T16:30:00.000Z")).toBe("00:30");
      // 23:45 UTC = 07:45 AWST next day
      expect(perthTimeOf("2026-03-14T23:45:00.000Z")).toBe("07:45");
    });

    it("throws on invalid instant inputs", () => {
      expect(() => perthTimeOf("invalid")).toThrow("invalid instant");
    });
  });

  describe("perthWallToIso", () => {
    it("converts valid Perth YYYY-MM-DD + HH:MM to UTC ISO string", () => {
      expect(perthWallToIso("2026-03-14", "08:00")).toBe("2026-03-14T00:00:00.000Z");
      expect(perthWallToIso("2026-01-01", "00:00")).toBe("2025-12-31T16:00:00.000Z");
    });

    it("returns null for impossible date or time values", () => {
      expect(perthWallToIso("2026-02-30", "08:00")).toBeNull();
      expect(perthWallToIso("2026-03-14", "25:00")).toBeNull();
      expect(perthWallToIso("invalid", "08:00")).toBeNull();
      expect(perthWallToIso("2026-03-14", "invalid")).toBeNull();
    });
  });

  describe("addDaysToDate", () => {
    it("steps date forward and backward across month and leap boundaries", () => {
      expect(addDaysToDate("2026-03-14", 1)).toBe("2026-03-15");
      expect(addDaysToDate("2026-03-31", 1)).toBe("2026-04-01");
      expect(addDaysToDate("2026-03-01", -1)).toBe("2026-02-28");
      expect(addDaysToDate("2028-02-28", 1)).toBe("2028-02-29"); // Leap year
      expect(addDaysToDate("2028-02-29", 1)).toBe("2028-03-01");
    });
  });

  describe("formatPerthDay", () => {
    it("formats Perth date into weekday day month string", () => {
      expect(formatPerthDay("2026-10-05")).toBe("Mon 5 Oct");
      expect(formatPerthDay("2026-01-01")).toBe("Thu 1 Jan");
    });
  });

  describe("Adversarial edge-cases and Intl parity", () => {
    it("matches Intl.DateTimeFormat across thousands of sampled instants from 2020 to 2035", () => {
      const intlFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Australia/Perth",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      // Sample every 5 hours and 17 minutes across 15 years
      const start = Date.parse("2020-01-01T00:00:00.000Z");
      const end = Date.parse("2035-01-01T00:00:00.000Z");
      const step = (5 * 60 + 17) * 60 * 1000;

      for (let t = start; t < end; t += step) {
        const d = new Date(t);
        expect(perthCalendarDate(d)).toBe(intlFormatter.format(d));
      }
    });

    it("handles exact millisecond transitions at Perth midnight (16:00:00.000Z)", () => {
      // 15:59:59.999Z is 23:59:59.999 in Perth -> same calendar day
      expect(perthCalendarDate("2026-06-15T15:59:59.999Z")).toBe("2026-06-15");
      expect(perthTimeOf("2026-06-15T15:59:59.999Z")).toBe("23:59");

      // 16:00:00.000Z is 00:00:00.000 in Perth -> next calendar day
      expect(perthCalendarDate("2026-06-15T16:00:00.000Z")).toBe("2026-06-16");
      expect(perthTimeOf("2026-06-15T16:00:00.000Z")).toBe("00:00");
    });

    it("handles year transition boundary at 16:00:00.000Z on Dec 31", () => {
      expect(perthCalendarDate("2026-12-31T15:59:59.999Z")).toBe("2026-12-31");
      expect(perthTimeOf("2026-12-31T15:59:59.999Z")).toBe("23:59");

      expect(perthCalendarDate("2026-12-31T16:00:00.000Z")).toBe("2027-01-01");
      expect(perthTimeOf("2026-12-31T16:00:00.000Z")).toBe("00:00");
    });

    it("handles leap year boundaries (2024, 2028) vs non-leap years (2025, 2026)", () => {
      // 2024 leap year
      expect(perthCalendarDate("2024-02-28T16:00:00.000Z")).toBe("2024-02-29");
      expect(perthCalendarDate("2024-02-29T15:59:59.999Z")).toBe("2024-02-29");
      expect(perthCalendarDate("2024-02-29T16:00:00.000Z")).toBe("2024-03-01");

      // 2028 leap year
      expect(perthCalendarDate("2028-02-28T16:00:00.000Z")).toBe("2028-02-29");
      expect(perthCalendarDate("2028-02-29T15:59:59.999Z")).toBe("2028-02-29");
      expect(perthCalendarDate("2028-02-29T16:00:00.000Z")).toBe("2028-03-01");

      // 2026 non-leap year
      expect(perthCalendarDate("2026-02-28T15:59:59.999Z")).toBe("2026-02-28");
      expect(perthCalendarDate("2026-02-28T16:00:00.000Z")).toBe("2026-03-01");
    });

    it("rigorously validates impossible dates in perthWallToIso", () => {
      // Leap year validations
      expect(perthWallToIso("2024-02-29", "12:00")).toBe("2024-02-29T04:00:00.000Z");
      expect(perthWallToIso("2028-02-29", "12:00")).toBe("2028-02-29T04:00:00.000Z");
      expect(perthWallToIso("2026-02-29", "12:00")).toBeNull(); // non-leap
      expect(perthWallToIso("2024-02-30", "12:00")).toBeNull();
      expect(perthWallToIso("2026-02-30", "12:00")).toBeNull();

      // Month day limit validations
      expect(perthWallToIso("2026-04-30", "12:00")).toBe("2026-04-30T04:00:00.000Z");
      expect(perthWallToIso("2026-04-31", "12:00")).toBeNull();
      expect(perthWallToIso("2026-06-31", "12:00")).toBeNull();
      expect(perthWallToIso("2026-09-31", "12:00")).toBeNull();
      expect(perthWallToIso("2026-11-31", "12:00")).toBeNull();
      expect(perthWallToIso("2026-01-32", "12:00")).toBeNull();
      expect(perthWallToIso("2026-00-10", "12:00")).toBeNull();
      expect(perthWallToIso("2026-13-10", "12:00")).toBeNull();

      // Time limit validations
      expect(perthWallToIso("2026-05-10", "23:59")).toBe("2026-05-10T15:59:00.000Z");
      expect(perthWallToIso("2026-05-10", "24:00")).toBeNull();
      expect(perthWallToIso("2026-05-10", "12:60")).toBeNull();
      expect(perthWallToIso("2026-05-10", "-1:00")).toBeNull();
      expect(perthWallToIso("2026-05-10", "12:-5")).toBeNull();

      // Midnight wrap to previous day in UTC
      expect(perthWallToIso("2026-01-01", "00:00")).toBe("2025-12-31T16:00:00.000Z");
      expect(perthWallToIso("2026-01-01", "07:59")).toBe("2025-12-31T23:59:00.000Z");
      expect(perthWallToIso("2026-01-01", "08:00")).toBe("2026-01-01T00:00:00.000Z");
    });

    it("verifies addDaysToDate across month, year, and leap-year boundaries", () => {
      // Leap year additions
      expect(addDaysToDate("2028-02-28", 1)).toBe("2028-02-29");
      expect(addDaysToDate("2028-02-28", 2)).toBe("2028-03-01");
      expect(addDaysToDate("2028-03-01", -1)).toBe("2028-02-29");
      expect(addDaysToDate("2028-03-01", -2)).toBe("2028-02-28");

      // Non-leap year additions
      expect(addDaysToDate("2026-02-28", 1)).toBe("2026-03-01");
      expect(addDaysToDate("2026-03-01", -1)).toBe("2026-02-28");

      // Year boundary additions
      expect(addDaysToDate("2026-12-31", 1)).toBe("2027-01-01");
      expect(addDaysToDate("2027-01-01", -1)).toBe("2026-12-31");
      expect(addDaysToDate("2026-12-30", 365)).toBe("2027-12-30");

      // Zero days
      expect(addDaysToDate("2026-07-15", 0)).toBe("2026-07-15");
    });

    it("throws expected errors on invalid instant objects or strings", () => {
      expect(() => perthCalendarDate(new Date("invalid"))).toThrow("invalid instant");
      expect(() => perthCalendarDate("not-a-date")).toThrow("invalid instant");
      expect(() => perthCalendarDate(NaN)).toThrow("invalid instant");

      expect(() => perthTimeOf(new Date("invalid"))).toThrow("invalid instant");
      expect(() => perthTimeOf("not-a-date")).toThrow("invalid instant");
      expect(() => perthTimeOf(NaN)).toThrow("invalid instant");
    });
  });
});
