import { describe, expect, it } from "vitest";

import { formatHours, formatSessionTime, perthDate, perthInstant, perthTime, perthToday } from "@/lib/teaching/time";

/** Runs `fn` with the process pinned to `zone`, as tests/on-call-teaching-schedule.test.ts does. */
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

const zones = ["UTC", "Australia/Perth", "Australia/Sydney", "Pacific/Kiritimati", "Etc/GMT+12", "America/Los_Angeles"];

describe("formatSessionTime", () => {
  it("writes the design's own form: 24-hour, Australian order, 'Sep' not 'Sept'", () => {
    expect(formatSessionTime("2026-09-30T04:30:00Z", "2026-09-30T05:30:00Z")).toBe("Wed 30 Sep, 12:30 to 13:30");
  });

  it("reads database timestamps with microseconds and an offset", () => {
    expect(formatSessionTime("2026-09-30T04:30:00.123456+00:00", "2026-09-30T13:30:00+08:00")).toBe(
      "Wed 30 Sep, 12:30 to 13:30",
    );
  });

  it("names both days when a session crosses Perth midnight", () => {
    expect(formatSessionTime("2026-09-30T15:30:00Z", "2026-09-30T16:30:00Z")).toBe(
      "Wed 30 Sep, 23:30 to Thu 1 Oct, 00:30",
    );
  });

  it("puts a session at Perth midnight on the new day, written 00:00, never 24:00", () => {
    expect(formatSessionTime("2026-09-30T16:00:00Z", "2026-09-30T17:00:00Z")).toBe("Thu 1 Oct, 00:00 to 01:00");
  });

  it("gives the same answer on a server in any zone, including across Sydney's daylight-saving change", () => {
    // Sydney moves its clocks on Sunday 4 October 2026. Perth does not.
    const answers = zones.map((zone) =>
      inTimeZone(zone, () => formatSessionTime("2026-10-04T01:00:00Z", "2026-10-04T02:30:00Z")),
    );
    expect(new Set(answers)).toEqual(new Set(["Sun 4 Oct, 09:00 to 10:30"]));
  });

  it("returns nothing rather than a wrong time for an unreadable instant", () => {
    expect(formatSessionTime("not a time", "2026-09-30T05:30:00Z")).toBe("");
  });
});

describe("Perth date parts", () => {
  it("dates a late-evening UTC instant on the next Perth day, including across a year end", () => {
    expect(perthDate("2026-12-31T16:30:00Z")).toBe("2027-01-01");
    expect(perthTime("2026-12-31T16:30:00Z")).toBe("00:30");
    expect(perthDate("2026-12-31T15:59:00Z")).toBe("2026-12-31");
  });

  it("gives today's Perth date from any server zone", () => {
    const now = new Date("2026-09-29T20:00:00Z");
    const answers = zones.map((zone) => inTimeZone(zone, () => perthToday(now)));
    expect(new Set(answers)).toEqual(new Set(["2026-09-30"]));
  });

  it("turns a Perth date and time into the matching instant", () => {
    expect(perthInstant("2026-09-30", "12:30")).toBe("2026-09-30T04:30:00.000Z");
    expect(perthInstant("2026-10-01", "00:00")).toBe("2026-09-30T16:00:00.000Z");
  });

  it("refuses a day that does not exist instead of rolling it into the next month", () => {
    expect(() => perthInstant("2026-02-30", "09:00")).toThrow(RangeError);
    expect(() => perthInstant("2026-09-30", "24:00")).toThrow(RangeError);
  });

  it("returns empty text for an unreadable instant", () => {
    expect(perthDate("")).toBe("");
    expect(perthTime("yesterday")).toBe("");
  });
});

describe("formatHours", () => {
  it.each([
    [90, "1.5"],
    [60, "1"],
    [45, "0.75"],
    [20, "0.33"],
    [100, "1.67"],
    [0, "0"],
    [-15, "0"],
    [Number.NaN, "0"],
  ])("%s minutes is %s hours", (minutes, expected) => {
    expect(formatHours(minutes)).toBe(expected);
  });
});
