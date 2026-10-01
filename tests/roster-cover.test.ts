import { describe, expect, it } from "vitest";

import { coverForDay, needsOn } from "@/lib/roster/team/cover";
import type { RosterAssignment, RosterMaker } from "@/lib/roster/team/model";
import { perthWallToIso } from "@/lib/roster/shifts/perth-time";

/* Cover counts for the manager calendar. Every person is invented. */

let nextId = 1;
function id(): string {
  return `c1000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, "0")}`;
}

function shift(
  kind: RosterAssignment["kind"],
  startsAt: string,
  endsAt: string,
  userId: string | null = "sam",
): RosterAssignment {
  return {
    id: id(),
    userId,
    name: userId ? `Dr ${userId} Example` : null,
    grade: "registrar",
    siteId: null,
    siteName: null,
    startsAt,
    endsAt,
    shiftCode: kind.slice(0, 1).toUpperCase(),
    kind,
  };
}

const wall = (date: string, time: string) => perthWallToIso(date, time)!;

function need(over: Partial<RosterMaker["needs"][number]>): RosterMaker["needs"][number] {
  return { id: id(), weekday: null, date: null, kind: "day", grade: null, siteId: null, needed: 2, ...over };
}

describe("coverForDay", () => {
  it("returns nothing when the team has set no targets", () => {
    const rows = [shift("day", wall("2026-10-19", "08:00"), wall("2026-10-19", "16:30"))];
    expect(coverForDay("2026-10-19", rows, [])).toEqual([]);
  });

  it("counts rostered against needed and reports short, met and over", () => {
    const rows = [
      shift("day", wall("2026-10-19", "08:00"), wall("2026-10-19", "16:30"), "a"),
      shift("day", wall("2026-10-19", "08:00"), wall("2026-10-19", "16:30"), "b"),
      shift("evening", wall("2026-10-19", "13:00"), wall("2026-10-19", "21:30"), "c"),
      shift("night", wall("2026-10-19", "21:30"), wall("2026-10-20", "08:00"), "d"),
      shift("night", wall("2026-10-19", "21:30"), wall("2026-10-20", "08:00"), "e"),
      shift("night", wall("2026-10-19", "21:30"), wall("2026-10-20", "08:00"), "f"),
    ];
    const needs = [
      need({ weekday: 1, kind: "day", needed: 2 }),
      need({ weekday: 1, kind: "evening", needed: 2 }),
      need({ weekday: 1, kind: "night", needed: 2 }),
    ];
    expect(coverForDay("2026-10-19", rows, needs)).toEqual([
      { kind: "day", rostered: 2, needed: 2, state: "met" },
      { kind: "evening", rostered: 1, needed: 2, state: "short" },
      { kind: "night", rostered: 3, needed: 2, state: "over" },
    ]);
  });

  it("lets a dated need beat a weekday need", () => {
    const needs = [need({ weekday: 1, kind: "day", needed: 4 }), need({ date: "2026-10-19", kind: "day", needed: 1 })];
    expect(coverForDay("2026-10-19", [], needs)).toEqual([{ kind: "day", rostered: 0, needed: 1, state: "short" }]);
    // The next Monday has no dated need, so the weekday target applies again.
    expect(coverForDay("2026-10-26", [], needs)).toEqual([{ kind: "day", rostered: 0, needed: 4, state: "short" }]);
  });

  it("lets a dated need replace only the weekday need of the same kind and grade", () => {
    const needs = [
      need({ weekday: 1, kind: "day", grade: "registrar", needed: 2 }),
      need({ weekday: 1, kind: "day", grade: "resident", needed: 3 }),
      need({ weekday: 1, kind: "night", grade: null, needed: 1 }),
      need({ date: "2026-10-19", kind: "day", grade: "registrar", needed: 1 }),
    ];
    // The dated registrar target stands in for the weekday one; the resident target still applies.
    expect(coverForDay("2026-10-19", [], needs)).toEqual([
      { kind: "day", rostered: 0, needed: 4, state: "short" },
      { kind: "night", rostered: 0, needed: 1, state: "short" },
    ]);
    expect(needsOn("2026-10-19", needs).map((item) => [item.kind, item.grade, item.needed])).toEqual([
      ["day", "registrar", 1],
      ["day", "resident", 3],
      ["night", null, 1],
    ]);
    // A dated target for any grade replaces every weekday target of that kind.
    const anyGrade = [...needs, need({ date: "2026-10-19", kind: "day", grade: null, needed: 5 })];
    expect(needsOn("2026-10-19", anyGrade).filter((item) => item.kind === "day")).toHaveLength(2);
    expect(coverForDay("2026-10-19", [], anyGrade)[0]).toMatchObject({ kind: "day", needed: 6 });
  });

  it("reads weekday 1 as Monday and weekday 7 as Sunday", () => {
    const needs = [need({ weekday: 7, kind: "day", needed: 1 }), need({ weekday: 1, kind: "night", needed: 1 })];
    // 2026-10-25 is a Sunday, 2026-10-26 a Monday.
    expect(coverForDay("2026-10-25", [], needs).map((c) => c.kind)).toEqual(["day"]);
    expect(coverForDay("2026-10-26", [], needs).map((c) => c.kind)).toEqual(["night"]);
    expect(coverForDay("2026-10-27", [], needs)).toEqual([]);
  });

  it("counts an overnight shift on its start day only", () => {
    const rows = [shift("night", wall("2026-10-31", "21:30"), wall("2026-11-01", "08:00"))];
    const needs = [
      need({ kind: "night", needed: 1, date: null, weekday: 6 }),
      need({ kind: "night", needed: 1, weekday: 7 }),
    ];
    expect(coverForDay("2026-10-31", rows, needs)).toEqual([{ kind: "night", rostered: 1, needed: 1, state: "met" }]);
    expect(coverForDay("2026-11-01", rows, needs)).toEqual([{ kind: "night", rostered: 0, needed: 1, state: "short" }]);
  });

  it("places a UTC timestamp on its Perth date", () => {
    // 13:30Z is 21:30 in Perth on 31 October.
    const rows = [shift("night", "2026-10-31T13:30:00Z", "2026-10-31T23:30:00Z")];
    const needs = [
      need({ kind: "night", needed: 1, date: "2026-10-31" }),
      need({ kind: "night", needed: 1, date: "2026-11-01" }),
    ];
    expect(coverForDay("2026-10-31", rows, needs)[0].rostered).toBe(1);
    // A 17:00Z start is 01:00 Perth the next morning.
    const late = [shift("night", "2026-10-31T17:00:00Z", "2026-10-31T23:30:00Z")];
    expect(coverForDay("2026-10-31", late, needs)[0].rostered).toBe(0);
    expect(coverForDay("2026-11-01", late, needs)[0].rostered).toBe(1);
  });

  it("never counts leave and omits a leave target", () => {
    const rows = [shift("leave", wall("2026-10-19", "00:00"), wall("2026-10-20", "00:00"))];
    const needs = [need({ weekday: 1, kind: "leave", needed: 1 }), need({ weekday: 1, kind: "day", needed: 1 })];
    expect(coverForDay("2026-10-19", rows, needs)).toEqual([{ kind: "day", rostered: 0, needed: 1, state: "short" }]);
  });

  it("adds up targets of one kind for several grades and sites", () => {
    const needs = [
      need({ weekday: 1, grade: "registrar", needed: 1 }),
      need({ weekday: 1, grade: "resident", needed: 1 }),
    ];
    expect(coverForDay("2026-10-19", [], needs)).toEqual([{ kind: "day", rostered: 0, needed: 2, state: "short" }]);
  });
});
