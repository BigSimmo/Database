import { evaluateYear } from "@/lib/cme/evaluate";
import { routineOccurrencesBeforeYearEnd } from "@/lib/cme/pace";
import { isHoursRequirementShape, rankRequirementsByGap, requirementGap } from "@/lib/cme/requirement-gaps";
import type { CmeRoutine } from "@/lib/cme/routines";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

/**
 * THE CATCH-UP PLANNER: what is left of the year's total-hours target, how
 * much of it the owner's own active routines would likely cover by 31
 * December, and what that leaves as a weekly figure.
 *
 * An estimate, never a record. A routine is a reminder to log something, not a
 * log of it (`src/lib/cme/routines.ts`), so the routine figure only says how
 * many hours those routines would add IF the owner does them at their usual
 * hours; nothing here counts them as done, and Today labels the card as an
 * estimate from the owner's routines.
 *
 * Pure: it takes the Perth calendar date (`YYYY-MM-DD`, from
 * `perthCalendarDate`) it should answer for and never reads the clock, so a
 * server render and the client it hydrates into agree. Date arithmetic is on
 * whole UTC day numbers, as in `src/lib/cme/pace.ts`, so the runtime's own
 * time zone cannot move a day.
 *
 * Pace is a number here, never a verdict: no "ahead", no "behind".
 */

export type CmeCatchUpPlanStatus = "met" | "year-ended" | "plan";

export type CmeCatchUpGap = {
  readonly requirementId: string;
  readonly label: string;
  /** `progress.target - progress.value`, two decimals. */
  readonly hoursToGo: number;
  /** The requirement's own status wording ("15 h to go", "2 h to go in measuring outcomes"). */
  readonly summary: string;
};

export type CmeCatchUpPlan = {
  readonly status: CmeCatchUpPlanStatus;
  /** Perth date the year ends, `YYYY-12-31`. */
  readonly yearEnd: string;
  /** Hours logged this year, archived activities excluded — the same figure as Today's hero. */
  readonly hoursLogged: number;
  readonly targetHours: number;
  /** `targetHours - hoursLogged`, never below zero. */
  readonly hoursToGo: number;
  /** Weeks from `today` to 31 December, one decimal. Zero once the year has ended. */
  readonly weeksLeft: number;
  /** Future occurrences of each active routine before 31 December × its usual hours, summed. Zero unless `plan`. */
  readonly routineEstimateHours: number;
  /** The part of `hoursToGo` the routine estimate would cover: `min(routineEstimateHours, hoursToGo)`. */
  readonly routineCoverHours: number;
  /** `hoursToGo - routineEstimateHours`, never below zero. */
  readonly remainingAfterRoutines: number;
  /**
   * `remainingAfterRoutines ÷ max(1, weeks left)`, one decimal. The floor of one
   * week matches the hero's weekly pace, so the last few days never read as a
   * weekly figure larger than what is actually left. Zero unless `plan`.
   */
  readonly hoursPerWeek: number;
  /** The unmet hours requirement furthest from met, or null when none is short. */
  readonly biggestGap: CmeCatchUpGap | null;
};

const MS_PER_DAY = 86_400_000;

function dayNumber(dateOnly: string): number {
  return Math.round(Date.parse(`${dateOnly}T00:00:00Z`) / MS_PER_DAY);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildCmeCatchUpPlan(args: {
  readonly set: CmeRequirementSet;
  /** The year's activities; archived ones are ignored, as everywhere in CPD. */
  readonly entries: readonly CmeEntry[];
  /** Every routine the owner has; archived ones are ignored. */
  readonly routines: readonly CmeRoutine[];
  /** Perth calendar date, `YYYY-MM-DD`. */
  readonly today: string;
}): CmeCatchUpPlan {
  const { set, entries, routines, today } = args;
  const { totalHours, statuses } = evaluateYear({ set, entries });
  const yearStart = `${set.year}-01-01`;
  const yearEnd = `${set.year}-12-31`;
  const hoursLogged = round2(totalHours);
  const targetHours = set.totalHours;
  const hoursToGo = Math.max(0, round2(targetHours - hoursLogged));

  const gap = rankRequirementsByGap(set, statuses).find(
    (status) =>
      !status.met &&
      isHoursRequirementShape(
        set.requirements.find((requirement) => requirement.id === status.requirementId)?.spec.shape,
      ),
  );
  const biggestGap: CmeCatchUpGap | null = gap
    ? {
        requirementId: gap.requirementId,
        label: set.requirements.find((requirement) => requirement.id === gap.requirementId)?.label ?? "",
        hoursToGo: requirementGap(gap),
        summary: gap.summary,
      }
    : null;

  // Counting from 1 January when the year has not started yet, so a future year plans over all of it.
  const from = today < yearStart ? yearStart : today;
  const daysLeft = Math.max(0, dayNumber(yearEnd) - dayNumber(from));
  const weeksLeftExact = daysLeft / 7;
  const ended = today > yearEnd || Boolean(set.closedAt);
  const met = hoursToGo === 0;

  const base = {
    yearEnd,
    hoursLogged,
    targetHours,
    hoursToGo,
    biggestGap,
  };

  if (met || ended) {
    return {
      ...base,
      status: met ? "met" : "year-ended",
      weeksLeft: ended ? 0 : round1(weeksLeftExact),
      routineEstimateHours: 0,
      routineCoverHours: 0,
      remainingAfterRoutines: hoursToGo,
      hoursPerWeek: 0,
    };
  }

  const routineEstimateHours = round2(
    routines
      .filter((routine) => routine.archivedAt === null && routine.usualHours > 0)
      .reduce((sum, routine) => sum + routineOccurrencesBeforeYearEnd(routine, from, set.year) * routine.usualHours, 0),
  );
  const remainingAfterRoutines = Math.max(0, round2(hoursToGo - routineEstimateHours));

  return {
    ...base,
    status: "plan",
    weeksLeft: round1(weeksLeftExact),
    routineEstimateHours,
    routineCoverHours: Math.min(routineEstimateHours, hoursToGo),
    remainingAfterRoutines,
    hoursPerWeek: round1(remainingAfterRoutines / Math.max(1, weeksLeftExact)),
  };
}
