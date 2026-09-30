import { describe, expect, it } from "vitest";

import { ruleFlags, swapRuleFlags } from "@/lib/roster/team/rule-flags";
import type { RosterAssignment } from "@/lib/roster/team/model";
import { perthWallToIso } from "@/lib/roster/shifts/perth-time";

/* Team-rule flags on a roster, for the manager calendar. Every person is invented. */

let nextId = 1;
function shift(
  userId: string,
  kind: RosterAssignment["kind"],
  date: string,
  start: string,
  endDate: string,
  end: string,
): RosterAssignment {
  return {
    id: `f1000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, "0")}`,
    userId,
    name: `Dr ${userId} Example`,
    grade: "registrar",
    siteId: null,
    siteName: null,
    startsAt: perthWallToIso(date, start)!,
    endsAt: perthWallToIso(endDate, end)!,
    shiftCode: kind.slice(0, 1).toUpperCase(),
    kind,
  };
}

describe("ruleFlags", () => {
  it("flags nothing when the team has no rules", () => {
    const rows = [
      shift("sam", "day", "2026-10-19", "08:00", "2026-10-19", "16:30"),
      shift("sam", "night", "2026-10-19", "21:30", "2026-10-20", "08:00"),
    ];
    expect(ruleFlags(rows, {})).toEqual([]);
  });

  it("flags a shift that starts 8 hours after the last one when the break rule is 10 hours", () => {
    const first = shift("sam", "day", "2026-10-19", "08:00", "2026-10-19", "16:00");
    const second = shift("sam", "evening", "2026-10-20", "00:00", "2026-10-20", "08:00");
    expect(ruleFlags([first, second], { minBreakHours: 10 })).toEqual([
      { assignmentId: second.id, rule: "minBreakHours", words: "Less than 10 hours' rest before this shift" },
    ]);
  });

  it("does not flag a break of exactly the minimum, or another person's shift", () => {
    const rows = [
      shift("sam", "day", "2026-10-19", "08:00", "2026-10-19", "16:00"),
      shift("sam", "day", "2026-10-20", "02:00", "2026-10-20", "10:00"),
      shift("noor", "day", "2026-10-19", "17:00", "2026-10-19", "23:00"),
    ];
    expect(ruleFlags(rows, { minBreakHours: 10 })).toEqual([]);
  });

  it("ignores on-call and leave for the break rule", () => {
    const rows = [
      shift("sam", "on_call", "2026-10-19", "08:00", "2026-10-19", "16:00"),
      shift("sam", "leave", "2026-10-19", "00:00", "2026-10-20", "00:00"),
      shift("sam", "day", "2026-10-20", "00:00", "2026-10-20", "08:00"),
    ];
    expect(ruleFlags(rows, { minBreakHours: 10 })).toEqual([]);
  });

  it("flags the fourth night in a row when the limit is 3, and only that night", () => {
    const nights = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map((date, index, all) =>
      shift("sam", "night", date, "21:30", index + 1 < all.length ? all[index + 1] : "2026-10-23", "08:00"),
    );
    expect(ruleFlags(nights, { maxNightsInRow: 3 })).toEqual([
      { assignmentId: nights[3].id, rule: "maxNightsInRow", words: "4th night in a row (team limit 3)" },
    ]);
  });

  it("starts the count again after a night off", () => {
    const nights = ["2026-10-19", "2026-10-20", "2026-10-22", "2026-10-23"].map((date) =>
      shift("sam", "night", date, "21:30", date, "23:59"),
    );
    expect(ruleFlags(nights, { maxNightsInRow: 2 })).toEqual([]);
  });

  it("flags the day after the limit of days in a row", () => {
    const days = ["2026-10-19", "2026-10-20", "2026-10-21"].map((date) =>
      shift("sam", "day", date, "08:00", date, "16:00"),
    );
    expect(ruleFlags(days, { maxDaysInRow: 2 })).toEqual([
      { assignmentId: days[2].id, rule: "maxDaysInRow", words: "3rd day in a row (team limit 2)" },
    ]);
  });

  it("flags the shift that takes hours over the 7-day and 14-day limits", () => {
    const week = ["2026-10-19", "2026-10-20", "2026-10-21"].map((date) =>
      shift("sam", "day", date, "08:00", date, "18:00"),
    );
    expect(ruleFlags(week, { maxHours7d: 25 })).toEqual([
      { assignmentId: week[2].id, rule: "maxHours7d", words: "30 hours in 7 days (team limit 25)" },
    ]);
    expect(ruleFlags(week, { maxHours14d: 25 })).toEqual([
      { assignmentId: week[2].id, rule: "maxHours14d", words: "30 hours in 14 days (team limit 25)" },
    ]);
  });

  it("does not count hours from more than 7 days earlier", () => {
    const rows = [
      shift("sam", "day", "2026-10-01", "08:00", "2026-10-01", "18:00"),
      shift("sam", "day", "2026-10-19", "08:00", "2026-10-19", "18:00"),
    ];
    expect(ruleFlags(rows, { maxHours7d: 15 })).toEqual([]);
  });
});

describe("swapRuleFlags", () => {
  const swap = (give: RosterAssignment | null, take: RosterAssignment | null) => ({
    requesterId: "pat",
    counterpartyId: "sam",
    give,
    take,
  });

  it("warns when the shift given away makes the colleague's run break a rule", () => {
    const samThursday = shift("sam", "night", "2026-10-22", "21:30", "2026-10-23", "08:00");
    const patFriday = shift("pat", "night", "2026-10-23", "21:30", "2026-10-24", "08:00");
    const rows = [samThursday, patFriday];
    // Before the swap nobody breaks the rule.
    expect(ruleFlags(rows, { maxNightsInRow: 1 })).toEqual([]);
    expect(swapRuleFlags(rows, { maxNightsInRow: 1 }, swap(patFriday, null))).toEqual([
      {
        assignmentId: patFriday.id,
        userId: "sam",
        rule: "maxNightsInRow",
        words: "2nd night in a row (team limit 1)",
      },
    ]);
  });

  it("warns for the requester too, on the shift they take back", () => {
    const patDay = shift("pat", "day", "2026-10-22", "08:00", "2026-10-22", "16:00");
    const patNext = shift("pat", "day", "2026-10-23", "08:00", "2026-10-23", "16:00");
    const samEvening = shift("sam", "evening", "2026-10-23", "22:00", "2026-10-24", "06:00");
    const rows = [patDay, patNext, samEvening];
    const flags = swapRuleFlags(rows, { minBreakHours: 10 }, swap(patDay, samEvening));
    expect(flags).toEqual([
      {
        assignmentId: samEvening.id,
        userId: "pat",
        rule: "minBreakHours",
        words: "Less than 10 hours' rest before this shift",
      },
    ]);
  });

  it("gives no warning for a swap that keeps both people inside the rules", () => {
    const samMonday = shift("sam", "night", "2026-10-19", "21:30", "2026-10-20", "08:00");
    const patFriday = shift("pat", "night", "2026-10-23", "21:30", "2026-10-24", "08:00");
    expect(swapRuleFlags([samMonday, patFriday], { maxNightsInRow: 1 }, swap(patFriday, null))).toEqual([]);
  });

  it("does not repeat a warning the roster already had before the swap", () => {
    const nights = ["2026-10-19", "2026-10-20"].map((date, index) =>
      shift("sam", "night", date, "21:30", index ? "2026-10-21" : "2026-10-20", "08:00"),
    );
    const patDay = shift("pat", "day", "2026-10-25", "08:00", "2026-10-25", "16:00");
    const rows = [...nights, patDay];
    expect(ruleFlags(rows, { maxNightsInRow: 1 })).toHaveLength(1);
    expect(swapRuleFlags(rows, { maxNightsInRow: 1 }, swap(patDay, null))).toEqual([]);
  });

  it("counts a swapped shift the rows did not hold", () => {
    const samThursday = shift("sam", "night", "2026-10-22", "21:30", "2026-10-23", "08:00");
    const patFriday = shift("pat", "night", "2026-10-23", "21:30", "2026-10-24", "08:00");
    expect(swapRuleFlags([samThursday], { maxNightsInRow: 1 }, swap(patFriday, null))).toHaveLength(1);
  });
});
