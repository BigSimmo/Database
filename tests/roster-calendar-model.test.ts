import { describe, expect, it } from "vitest";
import {
  calendarStateQuery,
  calendarWindow,
  filterAssignments,
  monthCells,
  readCalendarState,
  stepCalendar,
  weekBoard,
  type CalendarState,
} from "@/lib/roster/team/calendar-model";
import { ROSTER_MAX_WINDOW_DAYS, type RosterAssignment } from "@/lib/roster/team/model";

const TODAY = "2026-10-14";
const ME = "11111111-1111-4111-8111-111111111111";
const ALEX = "22222222-2222-4222-8222-222222222222";
const SAM = "33333333-3333-4333-8333-333333333333";

let counter = 0;
function shift(overrides: Partial<RosterAssignment>): RosterAssignment {
  counter += 1;
  return {
    id: `a${counter}`,
    userId: ALEX,
    name: "Dr Alex Example",
    grade: "registrar",
    siteId: null,
    siteName: null,
    startsAt: "2026-10-14T08:00:00+08:00",
    endsAt: "2026-10-14T16:00:00+08:00",
    shiftCode: "D",
    kind: "day",
    ...overrides,
  };
}

const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

describe("readCalendarState and calendarStateQuery", () => {
  it("defaults to the week view, today and everyone", () => {
    expect(readCalendarState(new URLSearchParams(""), TODAY)).toEqual({
      view: "week",
      date: TODAY,
      show: { kind: "everyone" },
    });
  });

  it("falls back to defaults for anything it does not recognise", () => {
    const state = readCalendarState(new URLSearchParams("view=year&date=2026-02-30&show=grade:wizard"), TODAY);
    expect(state).toEqual({ view: "week", date: TODAY, show: { kind: "everyone" } });
    expect(readCalendarState(new URLSearchParams("show=person:not-a-uuid"), TODAY).show).toEqual({ kind: "everyone" });
    expect(readCalendarState(new URLSearchParams("show=compare:"), TODAY).show).toEqual({ kind: "everyone" });
    expect(readCalendarState(new URLSearchParams("date=tomorrow"), TODAY).date).toBe(TODAY);
  });

  it("round-trips every view and show through the query string", () => {
    const shows: CalendarState["show"][] = [
      { kind: "everyone" },
      { kind: "me" },
      { kind: "grade", grade: "consultant" },
      { kind: "person", userId: ALEX },
      { kind: "compare", userId: SAM },
    ];
    for (const view of ["month", "week", "day"] as const) {
      for (const show of shows) {
        const state: CalendarState = { view, date: "2026-11-03", show };
        const query = calendarStateQuery(state);
        expect(readCalendarState(new URLSearchParams(query), TODAY)).toEqual(state);
      }
    }
  });

  it("omits the default view and show, and keeps the show readable", () => {
    expect(calendarStateQuery({ view: "week", date: "2026-11-03", show: { kind: "everyone" } })).toBe(
      "date=2026-11-03",
    );
    expect(calendarStateQuery({ view: "month", date: "2026-11-03", show: { kind: "grade", grade: "fellow" } })).toBe(
      "view=month&date=2026-11-03&show=grade:fellow",
    );
  });
});

describe("calendarWindow", () => {
  it("reads the whole month grid for the month view", () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    expect(calendarWindow({ view: "month", date: "2026-10-14", show: { kind: "everyone" } })).toEqual({
      from: "2026-09-28",
      to: "2026-11-01",
    });
  });

  it("reads Monday to Sunday for the week view", () => {
    const window = { from: "2026-10-12", to: "2026-10-18" };
    expect(calendarWindow({ view: "week", date: "2026-10-14", show: { kind: "everyone" } })).toEqual(window);
    expect(calendarWindow({ view: "week", date: "2026-10-18", show: { kind: "everyone" } })).toEqual(window);
    expect(calendarWindow({ view: "week", date: "2026-10-12", show: { kind: "everyone" } })).toEqual(window);
  });

  it("reads the day either side for the day view", () => {
    expect(calendarWindow({ view: "day", date: "2026-10-14", show: { kind: "everyone" } })).toEqual({
      from: "2026-10-13",
      to: "2026-10-15",
    });
  });

  it("never asks for more than the 62 days the server allows, including six-week months", () => {
    // August 2026 is the longest grid: Saturday the 1st runs to Monday 31 Aug, six weeks.
    for (const date of ["2026-08-15", "2026-02-10", "2026-03-31", "2027-05-01", "2026-12-31"]) {
      for (const view of ["month", "week", "day"] as const) {
        const { from, to } = calendarWindow({ view, date, show: { kind: "everyone" } });
        expect(days(from, to)).toBeLessThanOrEqual(ROSTER_MAX_WINDOW_DAYS);
        expect(days(from, to)).toBeGreaterThanOrEqual(0);
      }
    }
    const august = calendarWindow({ view: "month", date: "2026-08-15", show: { kind: "everyone" } });
    expect(days(august.from, august.to) + 1).toBe(42);
  });
});

describe("stepCalendar", () => {
  const everyone = { kind: "everyone" } as const;
  it("moves a month, a week or a day at a time", () => {
    expect(stepCalendar({ view: "month", date: "2026-10-14", show: everyone }, 1).date).toBe("2026-11-14");
    expect(stepCalendar({ view: "month", date: "2026-10-14", show: everyone }, -1).date).toBe("2026-09-14");
    expect(stepCalendar({ view: "week", date: "2026-10-14", show: everyone }, 1).date).toBe("2026-10-21");
    expect(stepCalendar({ view: "week", date: "2026-10-14", show: everyone }, -1).date).toBe("2026-10-07");
    expect(stepCalendar({ view: "day", date: "2026-10-31", show: everyone }, 1).date).toBe("2026-11-01");
    expect(stepCalendar({ view: "day", date: "2026-10-01", show: everyone }, -1).date).toBe("2026-09-30");
  });

  it("keeps the view and show, and clamps to the end of a shorter month", () => {
    const state: CalendarState = { view: "month", date: "2026-01-31", show: { kind: "me" } };
    expect(stepCalendar(state, 1)).toEqual({ view: "month", date: "2026-02-28", show: { kind: "me" } });
  });
});

describe("filterAssignments", () => {
  const mine = shift({ userId: ME, name: "Dr Me", grade: "consultant" });
  const alex = shift({ userId: ALEX });
  const sam = shift({ userId: SAM, name: "Dr Sam", grade: "consultant" });
  const nobody = shift({ userId: null, name: null, grade: null });
  const rows = [mine, alex, sam, nobody];

  it("shows everyone, including rows with no name or grade", () => {
    expect(filterAssignments(rows, { kind: "everyone" }, ME)).toEqual(rows);
  });
  it("shows only me, or nothing when I am not known", () => {
    expect(filterAssignments(rows, { kind: "me" }, ME)).toEqual([mine]);
    expect(filterAssignments(rows, { kind: "me" }, null)).toEqual([]);
  });
  it("shows one grade", () => {
    expect(filterAssignments(rows, { kind: "grade", grade: "consultant" }, ME)).toEqual([mine, sam]);
  });
  it("shows one person, and compares that person with me", () => {
    expect(filterAssignments(rows, { kind: "person", userId: ALEX }, ME)).toEqual([alex]);
    expect(filterAssignments(rows, { kind: "compare", userId: ALEX }, ME)).toEqual([mine, alex]);
    expect(filterAssignments(rows, { kind: "compare", userId: ALEX }, null)).toEqual([alex]);
  });
});

describe("monthCells", () => {
  it("places an overnight shift on its start day only", () => {
    const night = shift({
      userId: ME,
      shiftCode: "N",
      kind: "night",
      startsAt: "2026-10-31T21:30:00+08:00",
      endsAt: "2026-11-01T07:30:00+08:00",
    });
    const october = monthCells("2026-10", [night], ME).flat();
    const november = monthCells("2026-11", [night], ME).flat();
    const withShift = (cells: ReturnType<typeof monthCells>[number]) => cells.filter((cell) => cell.shifts.length);
    expect(withShift(october).map((cell) => cell.date)).toEqual(["2026-10-31"]);
    // The November grid also shows 31 Oct as a padding day, and 1 Nov must stay empty.
    expect(withShift(november).map((cell) => cell.date)).toEqual(["2026-10-31"]);
    const first = november.find((cell) => cell.date === "2026-11-01");
    expect(first?.shifts).toEqual([]);
    expect(october.find((cell) => cell.date === "2026-10-31")?.mine).toEqual([night]);
  });

  it("lays out whole Monday-first weeks and marks in-month days", () => {
    const grid = monthCells("2026-10", [], ME);
    expect(grid).toHaveLength(5);
    for (const week of grid) expect(week).toHaveLength(7);
    expect(grid[0][0]).toMatchObject({ date: "2026-09-28", inMonth: false });
    expect(grid[0][3]).toMatchObject({ date: "2026-10-01", inMonth: true });
    expect(grid[4][6]).toMatchObject({ date: "2026-11-01", inMonth: false });
  });

  it("flags Western Australian public holidays", () => {
    const cells = monthCells("2026-09", [], ME).flat();
    expect(cells.find((cell) => cell.date === "2026-09-28")?.holiday).toBe(true);
    expect(cells.find((cell) => cell.date === "2026-09-29")?.holiday).toBe(false);
  });

  it("separates my shifts from everyone's and orders each day by start time", () => {
    const late = shift({ userId: ALEX, startsAt: "2026-10-14T13:00:00+08:00", endsAt: "2026-10-14T21:00:00+08:00" });
    const early = shift({ userId: ME, startsAt: "2026-10-14T07:00:00+08:00", endsAt: "2026-10-14T15:00:00+08:00" });
    const cell = monthCells("2026-10", [late, early], ME)
      .flat()
      .find((day) => day.date === "2026-10-14");
    expect(cell?.shifts).toEqual([early, late]);
    expect(cell?.mine).toEqual([early]);
    const nobodyKnown = monthCells("2026-10", [late, early], null)
      .flat()
      .find((day) => day.date === "2026-10-14");
    expect(nobodyKnown?.mine).toEqual([]);
  });
});

describe("weekBoard", () => {
  const MONDAY = "2026-10-12";

  it("puts me first, then higher grades, then names", () => {
    const rows = [
      shift({ userId: ALEX, name: "Dr Alex", grade: "registrar" }),
      shift({ userId: SAM, name: "Dr Sam", grade: "consultant" }),
      shift({ userId: ME, name: "Dr Me", grade: "intern" }),
      shift({ userId: "44444444-4444-4444-8444-444444444444", name: "Dr Bea", grade: "registrar" }),
    ];
    const board = weekBoard(MONDAY, rows, ME);
    expect(board.map((row) => row.name)).toEqual(["Dr Me", "Dr Sam", "Dr Alex", "Dr Bea"]);
    expect(board[0].isMe).toBe(true);
    expect(board.slice(1).every((row) => !row.isMe)).toBe(true);
  });

  it("keeps a colleague with no name or grade on the board, labelled Unnamed", () => {
    const ghost = shift({ userId: SAM, name: null, grade: null });
    const board = weekBoard(MONDAY, [shift({ userId: ME, name: "Dr Me" }), ghost], ME);
    expect(board).toHaveLength(2);
    expect(board[1]).toMatchObject({ userId: SAM, name: "Unnamed", grade: null, isMe: false });
    expect(board[1].days[2]).toEqual([ghost]);
  });

  it("keeps a shift with no person as its own row", () => {
    const open = shift({ userId: null, name: null, grade: null });
    const board = weekBoard(MONDAY, [open], ME);
    expect(board).toEqual([expect.objectContaining({ userId: null, name: "Unnamed", days: expect.any(Array) })]);
    expect(board[0].days[2]).toEqual([open]);
  });

  it("lays out seven days from Monday and counts an overnight shift on its start day only", () => {
    const sunday = shift({
      userId: ME,
      kind: "night",
      shiftCode: "N",
      startsAt: "2026-10-18T21:30:00+08:00",
      endsAt: "2026-10-19T07:30:00+08:00",
    });
    const tuesday = shift({ userId: ME });
    const board = weekBoard(MONDAY, [tuesday, sunday], ME);
    expect(board).toHaveLength(1);
    expect(board[0].days).toHaveLength(7);
    expect(board[0].days.map((list) => list.length)).toEqual([0, 0, 1, 0, 0, 0, 1]);
    expect(board[0].days[6]).toEqual([sunday]);
    // Next week's board does not pick the same night up again.
    expect(weekBoard("2026-10-19", [sunday], ME)).toEqual([]);
  });

  it("ignores shifts that start outside the week", () => {
    const outside = shift({ userId: ME, startsAt: "2026-10-11T08:00:00+08:00", endsAt: "2026-10-11T16:00:00+08:00" });
    expect(weekBoard(MONDAY, [outside], ME)).toEqual([]);
  });
});
