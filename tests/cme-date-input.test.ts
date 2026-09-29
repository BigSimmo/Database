import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { addCalendarDays, formatCmeDayInput, formatCmeRowDate, parseCmeDayInput } from "@/lib/cme/cpd-year";

describe("formatCmeRowDate", () => {
  it("reads a date in the current year as weekday, day and short month", () => {
    expect(formatCmeRowDate("2026-09-26", "2026-09-26")).toBe("Sat 26 Sep");
    expect(formatCmeRowDate("2026-09-19", "2026-09-26")).toBe("Sat 19 Sep");
    expect(formatCmeRowDate("2026-03-04", "2026-09-26")).toBe("Wed 4 Mar");
    expect(formatCmeRowDate("2027-02-01", "2027-02-01")).toBe("Mon 1 Feb");
  });

  it("adds the year only when it is not today's year", () => {
    expect(formatCmeRowDate("2025-12-31", "2026-01-01")).toBe("Wed 31 Dec 2025");
    expect(formatCmeRowDate("2026-01-01", "2026-01-01")).toBe("Thu 1 Jan");
    expect(formatCmeRowDate("2027-02-01", "2026-09-26")).toBe("Mon 1 Feb 2027");
  });

  it("names leap days correctly", () => {
    expect(formatCmeRowDate("2024-02-29", "2026-09-26")).toBe("Thu 29 Feb 2024");
    expect(formatCmeRowDate("2028-02-29", "2028-03-01")).toBe("Tue 29 Feb");
  });
});

describe("addCalendarDays", () => {
  it("steps across month, year and leap-day boundaries", () => {
    expect(addCalendarDays("2026-09-26", -1)).toBe("2026-09-25");
    expect(addCalendarDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addCalendarDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("formatCmeDayInput", () => {
  it("shows a stored date the Australian way, and nothing for no date", () => {
    expect(formatCmeDayInput("2026-09-26")).toBe("26/09/2026");
    expect(formatCmeDayInput("2026-03-04")).toBe("04/03/2026");
    expect(formatCmeDayInput("")).toBe("");
  });
});

describe("parseCmeDayInput", () => {
  it("reads the ways an Australian doctor types a day", () => {
    for (const text of [
      "26/9/2026",
      "26/09/2026",
      "26-09-2026",
      "26.09.2026",
      "26 09 2026",
      "26092026",
      "26 Sep 2026",
      "26 sep 2026",
      "26 Sept 2026",
      "26 September 2026",
      " 26/09/2026 ",
      "2026-09-26",
    ]) {
      expect(parseCmeDayInput(text), text).toBe("2026-09-26");
    }
    expect(parseCmeDayInput("1/1/2027")).toBe("2027-01-01");
    expect(parseCmeDayInput("29/2/2024")).toBe("2024-02-29");
  });

  it("refuses impossible days and the US order instead of guessing", () => {
    for (const text of [
      "31/2/2026",
      "29/2/2026",
      "31/4/2026",
      "32/1/2026",
      "0/1/2026",
      "26/13/2026",
      "9/26/2026",
      "26/9/26",
      "2692026",
      "26 Foo 2026",
      "26 Ju 2026",
      "",
      "today",
      "1e10",
    ]) {
      expect(parseCmeDayInput(text), text).toBeNull();
    }
  });
});

describe("no browser date box in CPD", () => {
  it('has no type="date" input left in src/components/cme', () => {
    const dir = new URL("../src/components/cme/", import.meta.url);
    const offenders = readdirSync(dir)
      .filter((name) => name.endsWith(".tsx"))
      .filter((name) => readFileSync(new URL(name, dir), "utf8").includes('type="date"'));
    expect(offenders).toEqual([]);
  });
});
