import { addDaysToDate, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { isoWeekday } from "./cover";
import { gradeRank, placementProblem, swapCandidates, teamPeople } from "./eligibility";
import type { RosterAssignment, RosterGrade, RosterSettings, RosterTeamMember, SwapNeedsManagerReason } from "./model";

/**
 * The swap flow's "who" and "check" steps, worked out on the phone. Advice
 * only: `swap.create` and `swap.accept` recheck everything in SQL. Nobody
 * vanishes: a colleague who cannot take the shift is listed with one plain
 * reason, so a missing grade or name never hides a person from the board.
 */

export type CannotReason = "lower_grade" | "no_grade" | "on_leave" | "already_working" | "rest_rule";

export type SwapChoice = {
  userId: string;
  name: string | null;
  grade: RosterGrade | null;
  sameGrade: boolean;
  takeBack: RosterAssignment[];
};

export type SwapBlocked = { userId: string; name: string | null; reason: CannotReason; words: string };

export const reasonWords = {
  team_setting: "the team asks your manager to approve swaps",
  within_7_days: "it's within 7 days",
  different_grade: "the grades differ",
  team_rule: "a team rule needs a check",
} as const;

const CANNOT_WORDS: Record<CannotReason, string> = {
  lower_grade: "Lower grade than this shift needs",
  no_grade: "No grade on the roster",
  on_leave: "On leave then",
  already_working: "Already working then",
  rest_rule: "Would break the team's rest rule",
};

const SHIFT_HAS_NO_GRADE_WORDS = "This shift has no grade on the roster, so the manager needs to set one first";

type Person = { userId: string; name: string | null; grade: RosterGrade | null };

/**
 * Everyone to weigh except the reader: the team's current members when known,
 * otherwise everyone with a live shift in the window (see `teamPeople`).
 */
function colleagues(rows: readonly RosterAssignment[], meId: string, members?: readonly RosterTeamMember[]): Person[] {
  return teamPeople(rows, members).filter((person) => person.userId !== meId);
}

const byStart = (a: RosterAssignment, b: RosterAssignment) =>
  Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id);

/**
 * What the reader could take back from `userId`: their shifts still to come
 * that the reader could work without a clash (the shift being given away
 * leaves the reader, so it is not counted). Leave is not a shift to take.
 */
function takeBackFrom(
  rows: readonly RosterAssignment[],
  give: RosterAssignment,
  meId: string,
  userId: string,
  now: Date,
): RosterAssignment[] {
  return rows
    .filter(
      (row) =>
        row.userId === userId &&
        row.kind !== "leave" &&
        Date.parse(row.endsAt) > now.getTime() &&
        placementProblem(rows, meId, row.startsAt, row.endsAt, [give.id], null) === null,
    )
    .sort(byStart);
}

function whyNot(
  rows: readonly RosterAssignment[],
  give: RosterAssignment,
  person: Person,
  giverRank: number | null,
): { reason: CannotReason; words: string } {
  const rank = gradeRank(person.grade);
  // A colleague with no grade is told so; otherwise a missing shift grade is the shift's problem.
  if (rank === null) return { reason: "no_grade", words: CANNOT_WORDS.no_grade };
  if (giverRank === null) return { reason: "no_grade", words: SHIFT_HAS_NO_GRADE_WORDS };
  let reason: CannotReason = "rest_rule";
  if (rank < giverRank) reason = "lower_grade";
  else if (placementProblem(rows, person.userId, give.startsAt, give.endsAt, [], null)) {
    const start = Date.parse(give.startsAt);
    const end = Date.parse(give.endsAt);
    const onLeave = rows.some(
      (row) =>
        row.userId === person.userId &&
        row.kind === "leave" &&
        Date.parse(row.startsAt) < end &&
        Date.parse(row.endsAt) > start,
    );
    reason = onLeave ? "on_leave" : "already_working";
  }
  return { reason, words: CANNOT_WORDS[reason] };
}

const byName = (a: { name: string | null }, b: { name: string | null }) => {
  if ((a.name === null) !== (b.name === null)) return a.name === null ? 1 : -1;
  return (a.name ?? "").localeCompare(b.name ?? "");
};

export function swapOptions(input: {
  rows: readonly RosterAssignment[];
  give: RosterAssignment;
  me: { userId: string; grade: RosterGrade | null };
  settings: Pick<RosterSettings, "rules" | "swapApproval">;
  now: Date;
  /** The team's current members; without them, only colleagues with shifts in `rows` are weighed. */
  members?: readonly RosterTeamMember[];
}): { can: SwapChoice[]; cannot: SwapBlocked[] } {
  const { rows, give, me, settings, now, members } = input;
  const candidates = swapCandidates(rows, give, me, settings, members);
  const can = candidates.map((candidate): SwapChoice => ({
    userId: candidate.userId,
    name: candidate.name,
    grade: candidate.grade,
    sameGrade: candidate.sameGrade,
    takeBack: takeBackFrom(rows, give, me.userId, candidate.userId, now),
  }));
  const canIds = new Set(can.map((choice) => choice.userId));
  const giverRank = gradeRank(give.grade ?? me.grade);
  const cannot = colleagues(rows, me.userId, members)
    .filter((person) => !canIds.has(person.userId))
    .map((person): SwapBlocked => {
      return { userId: person.userId, name: person.name, ...whyNot(rows, give, person, giverRank) };
    })
    .sort(byName);
  return { can, cannot };
}

/** Each person's shifts before and after the swap, for the Monday-to-Sunday weeks of both shifts. */
export function swapPreview(
  rows: readonly RosterAssignment[],
  give: RosterAssignment,
  take: RosterAssignment | null,
  meId: string,
  otherId: string,
): {
  mine: { before: RosterAssignment[]; after: RosterAssignment[] };
  theirs: { before: RosterAssignment[]; after: RosterAssignment[] };
} {
  const dates = new Set<string>();
  for (const shift of take ? [give, take] : [give]) {
    const date = perthDateOf(shift.startsAt);
    const monday = addDaysToDate(date, 1 - isoWeekday(date));
    for (let index = 0; index < 7; index += 1) dates.add(addDaysToDate(monday, index));
  }
  const inWeek = (row: RosterAssignment) => dates.has(perthDateOf(row.startsAt));
  const week = (userId: string) => rows.filter((row) => row.userId === userId && inWeek(row)).sort(byStart);
  const swapped = (before: RosterAssignment[], leaving: RosterAssignment | null, arriving: RosterAssignment | null) =>
    [...before.filter((row) => row.id !== leaving?.id), ...(arriving && inWeek(arriving) ? [arriving] : [])].sort(
      byStart,
    );
  const mine = week(meId);
  const theirs = week(otherId);
  return {
    mine: { before: mine, after: swapped(mine, give, take) },
    theirs: { before: theirs, after: swapped(theirs, take, give) },
  };
}

/** The line under the Check step: whether the swap approves itself or waits for the manager. */
export function approvalWords(reason: SwapNeedsManagerReason | null): string {
  return reason === null
    ? "Goes through straight away once they accept."
    : `Needs your manager's approval because ${reasonWords[reason]}`;
}
