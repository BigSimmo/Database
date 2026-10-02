import { describe, expect, it } from "vitest";

import { swapCandidates } from "@/lib/roster/team/eligibility";
import type { RosterAssignment, RosterGrade } from "@/lib/roster/team/model";
import { approvalWords, reasonWords, swapOptions, swapPreview } from "@/lib/roster/team/swap-options";
import { perthWallToIso } from "@/lib/roster/shifts/perth-time";

/*
 * Who can take a shift and who cannot, with a plain reason each, plus the
 * before-and-after preview. Advice only: the server rechecks. Every person is invented.
 */

let nextId = 1;
function shift(
  userId: string | null,
  grade: RosterGrade | null,
  date: string,
  start: string,
  endDate: string,
  end: string,
  kind: RosterAssignment["kind"] = "day",
  name: string | null | undefined = undefined,
): RosterAssignment {
  return {
    id: `d1000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, "0")}`,
    userId,
    name: name === undefined ? (userId ? `Dr ${userId} Example` : null) : name,
    grade,
    siteId: null,
    siteName: null,
    startsAt: perthWallToIso(date, start)!,
    endsAt: perthWallToIso(endDate, end)!,
    shiftCode: kind.slice(0, 1).toUpperCase(),
    kind,
  };
}

const NOW = new Date("2026-10-01T00:00:00Z");
const settings = { rules: {}, swapApproval: "auto_same_grade" as const };
const me = { userId: "mei", grade: "registrar" as const };

const give = shift("mei", "registrar", "2026-10-20", "21:30", "2026-10-21", "08:00", "night");
const rows: RosterAssignment[] = [
  give,
  shift("mei", "registrar", "2026-10-22", "08:00", "2026-10-22", "16:30"),
  // Same grade, free.
  shift("sam", "registrar", "2026-10-19", "08:00", "2026-10-19", "16:30"),
  shift("sam", "registrar", "2026-10-21", "08:00", "2026-10-21", "16:30"),
  shift("sam", "registrar", "2026-10-22", "09:00", "2026-10-22", "17:00"),
  // Higher grade, free.
  shift("dana", "consultant", "2026-10-19", "08:00", "2026-10-19", "16:30"),
  // Lower grade.
  shift("noor", "resident", "2026-10-19", "08:00", "2026-10-19", "16:30"),
  // No grade on the roster.
  shift("lee", null, "2026-10-19", "08:00", "2026-10-19", "16:30"),
  // Already working the night.
  shift("kai", "registrar", "2026-10-20", "21:30", "2026-10-21", "08:00", "night"),
];

describe("swapOptions", () => {
  it("lists who can take the shift in the same order as swapCandidates", () => {
    const { can } = swapOptions({ rows, give, me, settings, now: NOW });
    const expected = swapCandidates(rows, give, me, settings).map((c) => c.userId);
    expect(expected).toEqual(["sam", "dana"]);
    expect(can.map((c) => c.userId)).toEqual(expected);
    expect(can[0]).toMatchObject({ name: "Dr sam Example", grade: "registrar", sameGrade: true });
    expect(can[1]).toMatchObject({ grade: "consultant", sameGrade: false });
  });

  it("keeps a lower-grade colleague, one with no grade, and one already working, each with a reason", () => {
    const { cannot } = swapOptions({ rows, give, me, settings, now: NOW });
    const byId = Object.fromEntries(cannot.map((c) => [c.userId, c]));
    expect(byId.noor).toMatchObject({ reason: "lower_grade", words: "Lower grade than this shift needs" });
    expect(byId.lee).toMatchObject({ reason: "no_grade", words: "No grade on the roster" });
    expect(byId.kai).toMatchObject({ reason: "already_working", words: "Already working then" });
    expect(cannot).toHaveLength(3);
  });

  it("still lists a colleague whose name and grade are missing", () => {
    const nameless = shift("zed", null, "2026-10-19", "08:00", "2026-10-19", "16:30", "day", null);
    const { can, cannot } = swapOptions({ rows: [...rows, nameless], give, me, settings, now: NOW });
    expect(can.some((c) => c.userId === "zed")).toBe(false);
    expect(cannot.find((c) => c.userId === "zed")).toMatchObject({ name: null, reason: "no_grade" });
  });

  it("never lists the reader, and puts everyone in cannot when the shift has no grade at all", () => {
    const ungraded = { ...give, grade: null };
    const { can, cannot } = swapOptions({
      rows,
      give: ungraded,
      me: { userId: "mei", grade: null },
      settings,
      now: NOW,
    });
    expect(can).toEqual([]);
    expect(cannot.some((c) => c.userId === "mei")).toBe(false);
    expect(cannot.map((c) => c.userId).sort()).toEqual(["dana", "kai", "lee", "noor", "sam"]);
  });

  it("says a colleague on leave at that time is on leave, not working", () => {
    const leave = shift("ola", "registrar", "2026-10-19", "00:00", "2026-10-22", "00:00", "leave");
    const { can, cannot } = swapOptions({ rows: [...rows, leave], give, me, settings, now: NOW });
    expect(can.some((c) => c.userId === "ola")).toBe(false);
    expect(cannot.find((c) => c.userId === "ola")).toMatchObject({ reason: "on_leave", words: "On leave then" });
    expect(cannot.find((c) => c.userId === "kai")).toMatchObject({ reason: "already_working" });
  });

  it("blames the shift, not the colleague, when the shift itself has no grade", () => {
    const ungraded = { ...give, grade: null };
    const { cannot } = swapOptions({ rows, give: ungraded, me: { userId: "mei", grade: null }, settings, now: NOW });
    const shiftWords = "This shift has no grade on the roster, so the manager needs to set one first";
    expect(cannot.find((c) => c.userId === "dana")).toMatchObject({ reason: "no_grade", words: shiftWords });
    expect(cannot.find((c) => c.userId === "sam")).toMatchObject({ reason: "no_grade", words: shiftWords });
    // A colleague with no grade of their own is still told so.
    expect(cannot.find((c) => c.userId === "lee")).toMatchObject({
      reason: "no_grade",
      words: "No grade on the roster",
    });
  });

  it("offers as take-back only the colleague's future shifts that do not clash with the reader", () => {
    const { can } = swapOptions({ rows, give, me, settings, now: NOW });
    const sam = can.find((c) => c.userId === "sam")!;
    // Sam's 22 Oct 09:00 shift overlaps Mei's own 22 Oct 08:00 shift, so it is left out.
    expect(sam.takeBack.map((a) => a.startsAt)).toEqual([
      perthWallToIso("2026-10-19", "08:00"),
      perthWallToIso("2026-10-21", "08:00"),
    ]);
  });

  it("leaves out take-back shifts already in the past, and leave", () => {
    const later = new Date("2026-10-20T00:00:00Z");
    const withLeave = [...rows, shift("sam", "registrar", "2026-10-26", "00:00", "2026-10-27", "00:00", "leave")];
    const sam = swapOptions({ rows: withLeave, give, me, settings, now: later }).can.find((c) => c.userId === "sam")!;
    expect(sam.takeBack.map((a) => a.startsAt)).toEqual([perthWallToIso("2026-10-21", "08:00")]);
  });
});

describe("swapPreview", () => {
  it("swaps the two shifts in the after lists, for the seven days from the Monday of the shift", () => {
    const take = rows.find((r) => r.userId === "sam" && r.startsAt === perthWallToIso("2026-10-21", "08:00"))!;
    const outside = shift("mei", "registrar", "2026-10-26", "08:00", "2026-10-26", "16:30");
    const preview = swapPreview([...rows, outside], give, take, "mei", "sam");
    const ids = (list: RosterAssignment[]) => list.map((a) => a.id);
    // 20 Oct 2026 is a Tuesday, so the week runs Monday 19 to Sunday 25 October.
    expect(ids(preview.mine.before)).toEqual([give.id, rows[1].id]);
    expect(ids(preview.mine.after)).toEqual([take.id, rows[1].id]);
    expect(preview.theirs.before.map((a) => a.startsAt)).toEqual([
      perthWallToIso("2026-10-19", "08:00"),
      perthWallToIso("2026-10-21", "08:00"),
      perthWallToIso("2026-10-22", "09:00"),
    ]);
    expect(ids(preview.theirs.after)).toContain(give.id);
    expect(ids(preview.theirs.after)).not.toContain(take.id);
    expect(preview.theirs.after).toHaveLength(3);
  });

  it("shows the take-back shift too when it falls outside the give's week", () => {
    const later = shift("sam", "registrar", "2026-10-28", "08:00", "2026-10-28", "16:30");
    const preview = swapPreview([...rows, later], give, later, "mei", "sam");
    const ids = (list: RosterAssignment[]) => list.map((a) => a.id);
    expect(ids(preview.mine.after)).toEqual([rows[1].id, later.id]);
    expect(ids(preview.theirs.after)).toContain(give.id);
    expect(ids(preview.theirs.after)).not.toContain(later.id);
    // Both shifts' weeks are shown, so Sam's 28 Oct shift is in his before list.
    expect(ids(preview.theirs.before)).toContain(later.id);
  });

  it("just moves the shift across when nothing is taken back", () => {
    const preview = swapPreview(rows, give, null, "mei", "sam");
    expect(preview.mine.after.map((a) => a.id)).toEqual([rows[1].id]);
    expect(preview.theirs.after.map((a) => a.id)).toContain(give.id);
    expect(preview.theirs.after).toHaveLength(4);
  });

  it("never changes the rows it was given", () => {
    const before = JSON.stringify(rows);
    swapPreview(rows, give, null, "mei", "sam");
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe("approvalWords", () => {
  it("says a swap goes straight through when nothing needs the manager", () => {
    expect(approvalWords(null)).toBe("Goes through straight away once they accept.");
  });

  it("names the reason a swap waits for the manager", () => {
    expect(approvalWords("within_7_days")).toContain("it's within 7 days");
    expect(approvalWords("within_7_days")).toBe("Needs your manager's approval because it's within 7 days");
    expect(approvalWords("different_grade")).toContain(reasonWords.different_grade);
  });
});
