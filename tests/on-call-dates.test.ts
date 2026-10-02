import { describe, expect, it } from "vitest";

import { formatOnCallDate, formatOnCallDateTime, ON_CALL_SERVER_ANCHOR } from "@/components/on-call/on-call-dates";

describe("on-call-dates", () => {
  describe("formatOnCallDate", () => {
    it("formats a Date in AWST (Perth) time", () => {
      // 02:00 UTC is 10:00 AWST on the same day
      const date = new Date("2026-09-23T02:00:00.000Z");
      expect(formatOnCallDate(date)).toBe("23 Sep 2026");
    });

    it("crosses the calendar date boundary when UTC is the previous day", () => {
      // 20:00 UTC on 22 Sep is 04:00 AWST on 23 Sep
      const date = new Date("2026-09-22T20:00:00.000Z");
      expect(formatOnCallDate(date)).toBe("23 Sep 2026");
    });

    it("accepts string and timestamp numbers", () => {
      expect(formatOnCallDate("2026-09-23T02:00:00.000Z")).toBe("23 Sep 2026");
      expect(formatOnCallDate(new Date("2026-09-23T02:00:00.000Z").getTime())).toBe("23 Sep 2026");
    });

    it("returns an empty string without throwing RangeError for invalid or missing inputs", () => {
      expect(formatOnCallDate(null)).toBe("");
      expect(formatOnCallDate(undefined)).toBe("");
      expect(formatOnCallDate("invalid-date-string")).toBe("");
      expect(formatOnCallDate(NaN)).toBe("");
    });
  });

  describe("formatOnCallDateTime", () => {
    it("formats date and time in 12-hour Perth time", () => {
      const morning = new Date("2026-09-23T02:15:00.000Z"); // 10:15 am AWST
      expect(formatOnCallDateTime(morning)).toBe("23 Sep 2026, 10:15 am");

      const evening = new Date("2026-09-23T10:45:00.000Z"); // 6:45 pm AWST
      expect(formatOnCallDateTime(evening)).toBe("23 Sep 2026, 6:45 pm");
    });

    it("handles invalid or missing values gracefully", () => {
      expect(formatOnCallDateTime(null)).toBe("");
      expect(formatOnCallDateTime(undefined)).toBe("");
      expect(formatOnCallDateTime("invalid")).toBe("");
    });
  });

  describe("ON_CALL_SERVER_ANCHOR", () => {
    it("is a valid Date anchored in Perth working hours", () => {
      expect(ON_CALL_SERVER_ANCHOR).toBeInstanceOf(Date);
      expect(Number.isFinite(ON_CALL_SERVER_ANCHOR.getTime())).toBe(true);
      expect(formatOnCallDate(ON_CALL_SERVER_ANCHOR)).toBe("23 Sep 2026");
      expect(formatOnCallDateTime(ON_CALL_SERVER_ANCHOR)).toBe("23 Sep 2026, 10:00 am");
    });
  });
});
