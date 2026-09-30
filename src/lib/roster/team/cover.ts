import { dateKeyToUtcMillis } from "@/lib/calendar/calendar-event";
import { SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import { ROSTER_ASSIGNMENT_KINDS, type RosterAssignment, type RosterAssignmentKind, type RosterMaker } from "./model";
import { assignmentStartDate } from "./team-view";

/**
 * How many people are rostered against the team's targets on a day. Every
 * assignment counts on the Perth date it starts, so an overnight shift is
 * never counted twice. A team with no targets has no cover counts at all.
 */

export type CoverCount = {
  kind: RosterAssignmentKind;
  rostered: number;
  needed: number;
  state: "short" | "met" | "over";
};

type Need = RosterMaker["needs"][number];

/** "Nights 1 of 2": the words for one cover count, on the week board and in each month cell. */
export function coverText(count: CoverCount): string {
  return `${SHIFT_KIND_LABEL[count.kind]}s ${count.rostered} of ${count.needed}`;
}

/** ISO weekday of a `YYYY-MM-DD` date: 1 = Monday … 7 = Sunday (the database's `weekday between 1 and 7`). */
export function isoWeekday(date: string): number {
  const millis = dateKeyToUtcMillis(date);
  if (millis === null) throw new Error(`Not a calendar date: ${date}`);
  return new Date(millis).getUTCDay() || 7;
}

/**
 * The targets that apply on `date`. A target set for that exact date replaces
 * the weekday target for the same kind and grade only, so a dated registrar
 * target never silences the weekday resident target. A dated target for
 * "any grade" replaces every weekday target of its kind. Leave is never a target.
 */
export function needsOn(date: string, needs: RosterMaker["needs"]): Need[] {
  const weekday = isoWeekday(date);
  return ROSTER_ASSIGNMENT_KINDS.flatMap((kind) => {
    if (kind === "leave") return [];
    const ofKind = needs.filter((need) => need.kind === kind);
    const dated = ofKind.filter((need) => need.date === date);
    const weekdayNeeds = ofKind.filter((need) => need.date === null && need.weekday === weekday);
    if (!dated.length) return weekdayNeeds;
    const anyGrade = dated.some((need) => need.grade === null);
    const datedGrades = new Set(dated.map((need) => need.grade));
    return [...dated, ...weekdayNeeds.filter((need) => !anyGrade && !datedGrades.has(need.grade))];
  });
}

export function coverForDay(
  date: string,
  rows: readonly RosterAssignment[],
  needs: RosterMaker["needs"],
): CoverCount[] {
  const applicable = needsOn(date, needs);
  return ROSTER_ASSIGNMENT_KINDS.flatMap((kind): CoverCount[] => {
    const ofKind = applicable.filter((need) => need.kind === kind);
    if (!ofKind.length) return [];
    const needed = ofKind.reduce((sum, need) => sum + need.needed, 0);
    const rostered = rows.filter((row) => row.kind === kind && assignmentStartDate(row) === date).length;
    return [{ kind, rostered, needed, state: rostered < needed ? "short" : rostered > needed ? "over" : "met" }];
  });
}
