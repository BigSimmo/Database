import { describe, expect, it } from "vitest";

import { formatClockRange, formatClockTime, perthHour } from "@/lib/clock-time";

describe("clock times are 24-hour Perth time (Josh, 16:29Z)", () => {
  it("prints HH:MM in Perth", () => {
    expect(formatClockTime("2026-09-26T09:30:00Z")).toBe("17:30");
    expect(formatClockTime(new Date("2026-09-26T16:05:00Z"))).toBe("00:05");
    expect(formatClockTime("not a time")).toBe("");
  });

  it("joins a range with an en dash, and marks a range that crosses midnight", () => {
    expect(formatClockRange("2026-09-26T00:00:00Z", "2026-09-26T08:30:00Z")).toBe("08:00–16:30");
    expect(formatClockRange("2026-09-26T14:00:00Z", "2026-09-27T00:00:00Z")).toBe("22:00–08:00 +1");
  });

  it("reads the Perth hour for a greeting", () => {
    expect(perthHour(new Date("2026-09-26T21:00:00Z"))).toBe(5);
  });
});
