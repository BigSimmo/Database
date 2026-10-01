import { describe, expect, it } from "vitest";

import {
  gradeRank,
  hoursSinceLastShift,
  hoursUntilNextShift,
  openShiftCandidates,
  placementProblem,
  swapCandidates,
  swapNeedsManager,
  type SwapCheck,
} from "@/lib/roster/team/eligibility";
import type { RosterAssignment, RosterGrade } from "@/lib/roster/team/model";
import { demoRosterRead } from "@/lib/roster/team/demo-team";
import { perthWallToIso } from "@/lib/roster/shifts/perth-time";

/*
 * Who can take a shift, and whether a swap needs the manager, as the phone
 * works it out before sending. Mirrors the SQL; the server rechecks. Every
 * person here is invented.
 */

let nextId = 1;
function id(): string {
  return `e1000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, "0")}`;
}

function shift(
  userId: string | null,
  grade: RosterGrade | null,
  date: string,
  start: string,
  endDate: string,
  end: string,
  kind: RosterAssignment["kind"] = "day",
): RosterAssignment {
  return {
    id: id(),
    userId,
    name: userId ? `Dr ${userId} Example` : null,
    grade,
    siteId: null,
    siteName: null,
    startsAt: perthWallToIso(date, start)!,
    endsAt: perthWallToIso(endDate, end)!,
    shiftCode: kind.slice(0, 1).toUpperCase(),
    kind,
  };
}

const rules = { rules: {} };
const meResident = { userId: "mei", grade: "resident" as const };

const giveResidentNight = shift("mei", "resident", "2026-10-20", "21:30", "2026-10-21", "08:00", "night");
const team: RosterAssignment[] = [
  giveResidentNight,
  shift("sam", "registrar", "2026-10-18", "08:00", "2026-10-18", "16:30"),
  shift("noor", "resident", "2026-10-19", "08:00", "2026-10-19", "16:30"),
  shift("intern-1", "intern", "2026-10-19", "08:00", "2026-10-19", "16:30"),
  // Kai works the same night: never a candidate.
  shift("kai", "resident", "2026-10-20", "21:30", "2026-10-21", "08:00", "night"),
];

describe("grade order", () => {
  it("ranks intern to consultant and leaves other and a missing grade out", () => {
    expect(["intern", "resident", "registrar", "fellow", "consultant"].map(gradeRank)).toEqual([1, 2, 3, 4, 5]);
    expect(gradeRank("other")).toBeNull();
    expect(gradeRank(null)).toBeNull();
  });
});

describe("swap candidates", () => {
  it("lets a registrar take a resident's shift but never the reverse", () => {
    expect(gradeRank("registrar")! >= gradeRank("resident")!).toBe(true);
    const ids = swapCandidates(team, giveResidentNight, meResident, rules).map((c) => c.userId);
    expect(ids).not.toContain("intern-1");
    expect(ids).not.toContain("mei");
    expect(ids).not.toContain("kai");
    expect(ids).toEqual(["noor", "sam"]);
  });

  it("lists the same grade first, then the longest break before", () => {
    const withTwoResidents = [...team, shift("priya", "resident", "2026-10-20", "08:00", "2026-10-20", "16:30")];
    const list = swapCandidates(withTwoResidents, giveResidentNight, meResident, rules);
    expect(list.map((c) => c.userId)).toEqual(["noor", "priya", "sam"]);
    expect(list[0].hoursSinceLastShift).toBe(29);
    expect(list[1].hoursSinceLastShift).toBe(5);
  });

  it("treats a member with no grade as not eligible, and a giver with no grade has nobody", () => {
    const ungraded = [...team, shift("no-grade", null, "2026-10-19", "08:00", "2026-10-19", "16:30")];
    expect(swapCandidates(ungraded, giveResidentNight, meResident, rules).map((c) => c.userId)).not.toContain(
      "no-grade",
    );
    const ungradedGive = { ...giveResidentNight, grade: null };
    expect(swapCandidates(team, ungradedGive, { userId: "mei", grade: null }, rules)).toEqual([]);
  });
});

describe("placement", () => {
  const nightStart = perthWallToIso("2026-10-20", "21:30")!;
  const nightEnd = perthWallToIso("2026-10-21", "08:00")!;
  const withLeave = [shift("mei", "resident", "2026-10-20", "00:00", "2026-10-22", "00:00", "leave")];

  it("counts planned leave on the roster as a clash, even when excluded", () => {
    expect(placementProblem(withLeave, "mei", nightStart, nightEnd, [], null)).toBe("clash");
    expect(placementProblem(withLeave, "mei", nightStart, nightEnd, [withLeave[0].id], null)).toBe("clash");
  });

  it("ignores on-call for breaks, but not a day shift", () => {
    const dayStart = perthWallToIso("2026-10-21", "08:00")!;
    const dayEnd = perthWallToIso("2026-10-21", "16:30")!;
    const withOnCallEndingAtStart = [shift("mei", "resident", "2026-10-20", "17:00", "2026-10-21", "08:00", "on_call")];
    expect(placementProblem(withOnCallEndingAtStart, "mei", dayStart, dayEnd, [], 10)).toBeNull();
    const withDayEndingNineHoursBefore = [shift("mei", "resident", "2026-10-20", "14:00", "2026-10-20", "23:00")];
    expect(placementProblem(withDayEndingNineHoursBefore, "mei", dayStart, dayEnd, [], 10)).toBe("short_break");
    expect(placementProblem(withDayEndingNineHoursBefore, "mei", dayStart, dayEnd, [], null)).toBeNull();
  });

  it("does not count a shift the swap hands over", () => {
    const own = shift("sam", "registrar", "2026-10-20", "21:30", "2026-10-21", "08:00", "night");
    expect(placementProblem([own], "sam", nightStart, nightEnd, [own.id], null)).toBeNull();
    expect(placementProblem([own], "sam", nightStart, nightEnd, [], null)).toBe("clash");
  });
});

describe("does a swap need the manager", () => {
  const give = shift("alex", "resident", "2026-11-10", "08:00", "2026-11-10", "16:30");
  const take = shift("sam", "resident", "2026-11-12", "08:00", "2026-11-12", "16:30");
  const s = { swapApproval: "auto_same_grade" as const, rules: {} };
  const clean: SwapCheck = {
    give,
    take,
    giverGrade: "resident",
    takerGrade: "resident",
    counterpartyId: "sam",
    settings: s,
    assignments: [give, take],
    now: new Date("2026-10-20T00:00:00Z"),
  };
  const sixDaysBefore = new Date(Date.parse(give.startsAt) - 6 * 86_400_000);
  const dayEndingNineHoursBefore = [give, take, shift("sam", "resident", "2026-11-09", "14:00", "2026-11-09", "23:00")];

  it("gives the reasons in the SQL's order", () => {
    expect(swapNeedsManager({ ...clean, settings: { ...s, swapApproval: "manager" } })).toBe("team_setting");
    expect(swapNeedsManager({ ...clean, now: sixDaysBefore })).toBe("within_7_days");
    expect(swapNeedsManager({ ...clean, takerGrade: "registrar" })).toBe("different_grade");
    expect(
      swapNeedsManager({
        ...clean,
        settings: { ...s, rules: { minBreakHours: 10 } },
        assignments: dayEndingNineHoursBefore,
      }),
    ).toBe("team_rule");
    expect(swapNeedsManager(clean)).toBeNull();
  });

  it("puts the team setting ahead of every other reason", () => {
    expect(
      swapNeedsManager({
        ...clean,
        now: sixDaysBefore,
        takerGrade: "registrar",
        settings: { ...s, swapApproval: "manager" },
      }),
    ).toBe("team_setting");
  });

  it("uses the earlier of the two shifts for the 7-day test", () => {
    const soonTake = shift("sam", "resident", "2026-10-22", "08:00", "2026-10-22", "16:30");
    expect(swapNeedsManager({ ...clean, take: soonTake, assignments: [give, soonTake] })).toBe("within_7_days");
  });

  it("checks the requester's break on the shift they take back", () => {
    const tight = [give, take, shift("alex", "resident", "2026-11-12", "00:00", "2026-11-12", "02:00")];
    expect(swapNeedsManager({ ...clean, settings: { ...s, rules: { minBreakHours: 10 } }, assignments: tight })).toBe(
      "team_rule",
    );
  });
});

describe("open-shift candidates", () => {
  const residentGap = {
    startsAt: perthWallToIso("2026-10-18", "14:00")!,
    endsAt: perthWallToIso("2026-10-18", "22:30")!,
    minGrade: "resident" as const,
  };

  it("treats a member with no grade as not eligible", () => {
    const teamWithUngraded = [...team, shift("no-grade", null, "2026-10-19", "08:00", "2026-10-19", "16:30")];
    const ids = openShiftCandidates(teamWithUngraded, residentGap, rules, null).map((c) => c.userId);
    expect(ids).not.toContain("no-grade");
    expect(ids).not.toContain("intern-1");
  });

  it("leaves out the poster, the shift's holder and anyone already working then", () => {
    const busy = shift("noor", "resident", "2026-10-18", "12:00", "2026-10-18", "20:00");
    const ids = openShiftCandidates([...team, busy], residentGap, rules, "sam").map((c) => c.userId);
    expect(ids).not.toContain("sam");
    expect(ids).not.toContain("noor");
    const given = openShiftCandidates(
      team,
      { ...giveResidentNight, minGrade: "resident", assignmentId: giveResidentNight.id },
      rules,
      null,
    );
    expect(given.map((c) => c.userId)).not.toContain("mei");
  });

  it("puts the needed grade first", () => {
    const laterGap = {
      ...residentGap,
      startsAt: perthWallToIso("2026-10-24", "14:00")!,
      endsAt: perthWallToIso("2026-10-24", "22:30")!,
    };
    const ids = openShiftCandidates(team, laterGap, rules, null).map((c) => c.userId);
    expect(ids).toContain("sam");
    expect(ids.indexOf("noor")).toBeLessThan(ids.indexOf("sam"));
  });
});

describe("breaks around a moment", () => {
  it("measures hours since the last shift and until the next, ignoring on-call and leave", () => {
    const rows = [
      shift("mei", "resident", "2026-10-19", "08:00", "2026-10-19", "16:00"),
      shift("mei", "resident", "2026-10-19", "17:00", "2026-10-20", "08:00", "on_call"),
      shift("mei", "resident", "2026-10-22", "08:00", "2026-10-22", "16:00"),
    ];
    const at = perthWallToIso("2026-10-20", "16:00")!;
    expect(hoursSinceLastShift(rows, "mei", at)).toBe(24);
    expect(hoursUntilNextShift(rows, "mei", at)).toBe(40);
    expect(hoursSinceLastShift(rows, "nobody", at)).toBeNull();
  });
});

describe("the sample team's swap waiting on the reader", () => {
  // Every day of a fortnight, so the sample is checked whatever day it is opened.
  const days = Array.from({ length: 14 }, (_, index) => new Date(Date.UTC(2026, 9, 1 + index, 2)));

  it.each(days.map((now) => [now.toISOString().slice(0, 10), now] as const))(
    "can be accepted on %s: neither doctor would be double-booked",
    (_, now) => {
      const swap = demoRosterRead("requests", {}, now).swaps[0];
      const rows = demoRosterRead("assignments", {}, now).assignments;
      expect(swap.give && swap.take).toBeTruthy();
      expect(
        placementProblem(rows, swap.counterpartyId, swap.give!.startsAt, swap.give!.endsAt, [swap.take?.id], null),
      ).toBeNull();
      expect(
        placementProblem(rows, swap.requesterId, swap.take!.startsAt, swap.take!.endsAt, [swap.give?.id], null),
      ).toBeNull();
    },
  );
});
