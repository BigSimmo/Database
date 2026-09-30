import { addDaysToDate, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { isoWeekday } from "./cover";
import { gradeRank, placementProblem, swapCandidates } from "./eligibility";
import type { RosterAssignment, RosterGrade, RosterSettings, SwapNeedsManagerReason } from "./model";

/**
 * The swap flow's "who" and "check" steps, worked out on the phone. Advice
 * only: `swap.create` and `swap.accept` recheck everything in SQL. Nobody
 * vanishes: a colleague who cannot take the shift is listed with one plain
 * reason, so a missing grade or name never hides a person from the board.
 */

export type CannotReason = "lower_grade" | "no_grade" | "already_working" | "rest_rule";

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
  already_working: "Already working then",
  rest_rule: "Would break the team's rest rule",
};

type Person = { userId: string; name: string | null; grade: RosterGrade | null };

/** Everyone with a live shift in the window except the reader, with the latest name and grade seen. */
function colleagues(rows: readonly RosterAssignment[], meId: string): Person[] {
  const people = new Map<string, Person>();
  for (const row of rows) {
    if (!row.userId || row.userId === meId) continue;
    const known = people.get(row.userId);
    people.set(row.userId, {
      userId: row.userId,
      name: row.name ?? known?.name ?? null,
      grade: row.grade ?? known?.grade ?? null,
    });
  }
  return [...people.values()];
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
): CannotReason {
  const rank = gradeRank(person.grade);
  if (rank === null || giverRank === null) return "no_grade";
  if (rank < giverRank) return "lower_grade";
  if (placementProblem(rows, person.userId, give.startsAt, give.endsAt, [], null)) return "already_working";
  return "rest_rule";
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
}): { can: SwapChoice[]; cannot: SwapBlocked[] } {
  const { rows, give, me, settings, now } = input;
  const candidates = swapCandidates(rows, give, me, settings);
  const can = candidates.map((candidate): SwapChoice => ({
    userId: candidate.userId,
    name: candidate.name,
    grade: candidate.grade,
    sameGrade: candidate.sameGrade,
    takeBack: takeBackFrom(rows, give, me.userId, candidate.userId, now),
  }));
  const canIds = new Set(can.map((choice) => choice.userId));
  const giverRank = gradeRank(give.grade ?? me.grade);
  const cannot = colleagues(rows, me.userId)
    .filter((person) => !canIds.has(person.userId))
    .map((person): SwapBlocked => {
      const reason = whyNot(rows, give, person, giverRank);
      return { userId: person.userId, name: person.name, reason, words: CANNOT_WORDS[reason] };
    })
    .sort(byName);
  return { can, cannot };
}

/** The seven days from the Monday of `give`, each person's shifts before and after the swap. */
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
  const giveDate = perthDateOf(give.startsAt);
  const monday = addDaysToDate(giveDate, 1 - isoWeekday(giveDate));
  const dates = new Set(Array.from({ length: 7 }, (_, index) => addDaysToDate(monday, index)));
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
