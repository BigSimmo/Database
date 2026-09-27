/**
 * A trainee's own training timeline: stages, rotations, breaks and milestones.
 *
 * Nothing here is preloaded. The college's stage lengths and milestone figures
 * are unverified, so every period and every milestone is something the trainee
 * records themselves; this module only does arithmetic on what they entered.
 *
 * Everything is pure. No function reads the clock: each one takes the Perth
 * calendar date (`YYYY-MM-DD`, from `perthCalendarDate`) it should answer for,
 * so "today" is always the caller's explicit, testable decision.
 *
 * This module is deliberately separate from CPD evaluation. It never reads or
 * touches CPD targets, and it must not import `evaluate.ts` (nor the reverse);
 * `tests/cme-training-timeline.test.ts` pins that boundary.
 *
 * Date arithmetic is done on whole-day numbers derived with `Date.UTC`, never
 * on local-time `Date` objects, so the runtime's own time zone cannot move a
 * day. All periods are inclusive of both their start and end day.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const trainingPeriodKinds = ["stage", "rotation", "break"] as const;
export type TrainingPeriodKind = (typeof trainingPeriodKinds)[number];

export const trainingMilestoneDueKinds = ["fte-months", "date"] as const;
export type TrainingMilestoneDueKind = (typeof trainingMilestoneDueKinds)[number];

/** A stored training period. `endsOn: null` means ongoing. */
export type TrainingPeriod = {
  id: string;
  kind: TrainingPeriodKind;
  label: string;
  startsOn: string;
  endsOn: string | null;
  /** 0–1. A break is always 0, a rotation is above 0, a stage's value is ignored. */
  fte: number;
};

/** A stored milestone. Exactly one of `dueFteMonths` / `dueOn` is set, matching `dueKind`. */
export type TrainingMilestone = {
  id: string;
  label: string;
  dueKind: TrainingMilestoneDueKind;
  dueFteMonths: number | null;
  dueOn: string | null;
  completedOn: string | null;
};

// ---------------------------------------------------------------------------
// Day arithmetic
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

/**
 * How many days make one month on the training clock: an average Gregorian
 * month, 365.25 / 12 = 30.4375 days. One FTE month is therefore 30.4375 days
 * at 1.0 FTE (or 60.875 days at 0.5 FTE). Values are kept unrounded internally;
 * only `formatFteMonths` rounds, and only for display.
 */
export const TRAINING_DAYS_PER_MONTH = 365.25 / 12;

/** Guards against float artefacts such as 91.31000000000001 rounding up a whole day. */
const EPSILON = 1e-9;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dayNumber(dateOnly: string): number {
  const [year, month, day] = dateOnly.split("-").map((part) => Number.parseInt(part, 10));
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function dateFromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

/** Inclusive day span of a period; an ongoing period runs to +Infinity. */
function spanOf(period: Pick<TrainingPeriod, "startsOn" | "endsOn">): { start: number; end: number } {
  return {
    start: dayNumber(period.startsOn),
    end: period.endsOn === null ? Number.POSITIVE_INFINITY : dayNumber(period.endsOn),
  };
}

function covers(period: TrainingPeriod, today: number): boolean {
  const { start, end } = spanOf(period);
  return start <= today && today <= end;
}

function spansOverlap(a: TrainingPeriod, b: TrainingPeriod): boolean {
  const left = spanOf(a);
  const right = spanOf(b);
  return left.start <= right.end && right.start <= left.end;
}

/** Earliest start first; ties broken by id so the order never depends on input order. */
function byStart(a: TrainingPeriod, b: TrainingPeriod): number {
  return dayNumber(a.startsOn) - dayNumber(b.startsOn) || a.id.localeCompare(b.id);
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

// ---------------------------------------------------------------------------
// Input schemas (one schema per record, used for create and full-replace update)
// ---------------------------------------------------------------------------

const trainingDateSchema = z
  .string()
  .regex(DATE_PATTERN, "Use a YYYY-MM-DD date.")
  .refine(isRealDate, "Use a real calendar date between 2000 and 2100.");

/**
 * Create or full-replace input for a training period. An update sends the
 * whole record, as the CME entry update does, so an omitted field can never
 * silently erase a stored one.
 */
export const trainingPeriodInputSchema = z
  .object({
    kind: z.enum(trainingPeriodKinds),
    label: z.string().trim().min(1, "Add a label.").max(120, "Keep the label to 120 characters."),
    startsOn: trainingDateSchema,
    endsOn: trainingDateSchema.nullable(),
    fte: z
      .number()
      .min(0, "FTE cannot be below 0.")
      .max(1, "FTE cannot be above 1.")
      .refine(hasAtMostTwoDecimals, "Use at most two decimal places for FTE."),
  })
  .superRefine((period, ctx) => {
    if (period.endsOn !== null && period.endsOn < period.startsOn) {
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: "The end date cannot be before the start date." });
    }
    if (period.kind === "break" && period.fte !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["fte"],
        message: "A break counts no training time, so its FTE must be 0.",
      });
    }
    if (period.kind === "rotation" && period.fte <= 0) {
      ctx.addIssue({ code: "custom", path: ["fte"], message: "A rotation needs an FTE above 0." });
    }
  });
export type TrainingPeriodInput = z.infer<typeof trainingPeriodInputSchema>;

/** Create or full-replace input for a milestone. */
export const trainingMilestoneInputSchema = z
  .object({
    label: z.string().trim().min(3, "Use at least 3 characters.").max(200, "Keep the label to 200 characters."),
    dueKind: z.enum(trainingMilestoneDueKinds),
    dueFteMonths: z
      .number()
      .positive("FTE months must be above 0.")
      .max(600, "Use no more than 600 FTE months.")
      .refine(hasAtMostTwoDecimals, "Use at most two decimal places for FTE months.")
      .nullable(),
    dueOn: trainingDateSchema.nullable(),
    completedOn: trainingDateSchema.nullable(),
  })
  .superRefine((milestone, ctx) => {
    if (milestone.dueFteMonths !== null && milestone.dueOn !== null) {
      ctx.addIssue({ code: "custom", path: ["dueOn"], message: "Set either FTE months or a due date, not both." });
      return;
    }
    if (milestone.dueKind === "fte-months" && milestone.dueFteMonths === null) {
      ctx.addIssue({ code: "custom", path: ["dueFteMonths"], message: "Add the FTE months this milestone is due at." });
    }
    if (milestone.dueKind === "fte-months" && milestone.dueOn !== null) {
      ctx.addIssue({ code: "custom", path: ["dueOn"], message: "An FTE-months milestone has no due date." });
    }
    if (milestone.dueKind === "date" && milestone.dueOn === null) {
      ctx.addIssue({ code: "custom", path: ["dueOn"], message: "Add the date this milestone is due." });
    }
    if (milestone.dueKind === "date" && milestone.dueFteMonths !== null) {
      ctx.addIssue({ code: "custom", path: ["dueFteMonths"], message: "A dated milestone has no FTE months." });
    }
  });
export type TrainingMilestoneInput = z.infer<typeof trainingMilestoneInputSchema>;

// ---------------------------------------------------------------------------
// Timeline validation
// ---------------------------------------------------------------------------

export type TrainingPeriodProblemCode = "ends-before-starts" | "rotation-overlaps-rotation" | "rotation-overlaps-break";

export type TrainingPeriodProblem = {
  code: TrainingPeriodProblemCode;
  /** The period(s) involved, in timeline order. */
  periodIds: string[];
  message: string;
};

/**
 * Cross-record checks the per-record schema cannot make. Rotations may not
 * overlap each other or a break (an ongoing period is open-ended, so it
 * overlaps everything after its start). Stages may overlap rotations freely:
 * a stage is meant to contain rotations. Returns an empty list when valid.
 */
export function validateTrainingPeriods(periods: readonly TrainingPeriod[]): TrainingPeriodProblem[] {
  const problems: TrainingPeriodProblem[] = [];
  const ordered = [...periods].sort(byStart);

  for (const period of ordered) {
    if (period.endsOn !== null && period.endsOn < period.startsOn) {
      problems.push({
        code: "ends-before-starts",
        periodIds: [period.id],
        message: `"${period.label}" ends before it starts.`,
      });
    }
  }

  const clockPeriods = ordered.filter(
    (period) =>
      (period.kind === "rotation" || period.kind === "break") &&
      (period.endsOn === null || period.endsOn >= period.startsOn),
  );
  for (let i = 0; i < clockPeriods.length; i += 1) {
    for (let j = i + 1; j < clockPeriods.length; j += 1) {
      const first = clockPeriods[i];
      const second = clockPeriods[j];
      if (first.kind === "break" && second.kind === "break") continue;
      if (!spansOverlap(first, second)) continue;
      const bothRotations = first.kind === "rotation" && second.kind === "rotation";
      problems.push({
        code: bothRotations ? "rotation-overlaps-rotation" : "rotation-overlaps-break",
        periodIds: [first.id, second.id],
        message: bothRotations
          ? `Rotations "${first.label}" and "${second.label}" overlap. A day can belong to only one rotation.`
          : `"${first.label}" and "${second.label}" overlap. A rotation cannot run during a break.`,
      });
    }
  }

  return problems;
}

// ---------------------------------------------------------------------------
// The training clock
// ---------------------------------------------------------------------------

type ClockSegment = { start: number; end: number; fte: number };

/** Rotation days up to and including today, oldest first. Breaks and gaps contribute nothing. */
function clockSegments(periods: readonly TrainingPeriod[], today: number): ClockSegment[] {
  return periods
    .filter((period) => period.kind === "rotation" && period.fte > 0)
    .sort(byStart)
    .map((period) => {
      const { start, end } = spanOf(period);
      return { start, end: Math.min(end, today), fte: period.fte };
    })
    .filter((segment) => segment.end >= segment.start);
}

/**
 * Training time in FTE months as of the end of `todayPerth`.
 *
 * Only rotations count: each contributes (days in the rotation up to and
 * including today) × its FTE, divided by `TRAINING_DAYS_PER_MONTH`. A rotation
 * that has not started contributes nothing; an ongoing one is clipped to
 * today. Breaks and gaps between periods count zero. Run
 * `validateTrainingPeriods` first: overlapping rotations would be counted twice.
 * The result is unrounded; use `formatFteMonths` to display it.
 */
export function fteMonthsAsOf(periods: readonly TrainingPeriod[], todayPerth: string): number {
  const today = dayNumber(todayPerth);
  const fteDays = clockSegments(periods, today).reduce(
    (sum, segment) => sum + (segment.end - segment.start + 1) * segment.fte,
    0,
  );
  return fteDays / TRAINING_DAYS_PER_MONTH;
}

/**
 * The past date on which the clock reached `targetFteMonths`, or null if it
 * has not reached it by the end of today. Independent of the current FTE.
 */
function dateFteMonthsReached(
  periods: readonly TrainingPeriod[],
  targetFteMonths: number,
  todayPerth: string,
): string | null {
  const targetFteDays = targetFteMonths * TRAINING_DAYS_PER_MONTH;
  let accrued = 0;
  for (const segment of clockSegments(periods, dayNumber(todayPerth))) {
    const segmentFteDays = (segment.end - segment.start + 1) * segment.fte;
    if (accrued + segmentFteDays >= targetFteDays - EPSILON) {
      const daysIntoSegment = Math.max(1, Math.ceil((targetFteDays - accrued) / segment.fte - EPSILON));
      return dateFromDayNumber(segment.start + daysIntoSegment - 1);
    }
    accrued += segmentFteDays;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Where the trainee is now
// ---------------------------------------------------------------------------

export type TrainingPosition = {
  /** The stage covering today; when stages overlap, the latest start wins. */
  stage: TrainingPeriod | null;
  /** The rotation covering today. */
  rotation: TrainingPeriod | null;
  /** 1-based position of `rotation` among the stage's rotations ("rotation 3 of 4"), or null. */
  rotationIndex: number | null;
  /** Rotations whose start falls within the current stage's span, or null with no current stage. */
  rotationCount: number | null;
  /** True when a break covers today. */
  onBreak: boolean;
  /** The break covering today, if any. */
  breakPeriod: TrainingPeriod | null;
};

function latestStartCovering(periods: readonly TrainingPeriod[], kind: TrainingPeriodKind, today: number) {
  const covering = periods.filter((period) => period.kind === kind && covers(period, today)).sort(byStart);
  return covering.at(-1) ?? null;
}

export function currentPosition(periods: readonly TrainingPeriod[], todayPerth: string): TrainingPosition {
  const today = dayNumber(todayPerth);
  const stage = latestStartCovering(periods, "stage", today);
  const rotation = latestStartCovering(periods, "rotation", today);
  const breakPeriod = latestStartCovering(periods, "break", today);

  let rotationIndex: number | null = null;
  let rotationCount: number | null = null;
  if (stage) {
    const { start, end } = spanOf(stage);
    const stageRotations = periods
      .filter((period) => {
        if (period.kind !== "rotation") return false;
        const rotationStart = dayNumber(period.startsOn);
        return rotationStart >= start && rotationStart <= end;
      })
      .sort(byStart);
    rotationCount = stageRotations.length;
    const position = rotation ? stageRotations.findIndex((period) => period.id === rotation.id) : -1;
    rotationIndex = position >= 0 ? position + 1 : null;
  }

  return { stage, rotation, rotationIndex, rotationCount, onBreak: breakPeriod !== null, breakPeriod };
}

// ---------------------------------------------------------------------------
// What is due next
// ---------------------------------------------------------------------------

export type NextMilestone = {
  milestone: TrainingMilestone;
  /**
   * The known due date (a dated milestone), the date the clock reached the
   * target (an FTE-months milestone already reached), or the projected date
   * at the current FTE. Null when no date can honestly be given.
   */
  projectedOn: string | null;
  /** Due date strictly before today. A milestone due today is not overdue. */
  overdue: boolean;
  /** Why `projectedOn` is null; null whenever a date is given. */
  reason: string | null;
};

function assessMilestone(
  milestone: TrainingMilestone,
  periods: readonly TrainingPeriod[],
  todayPerth: string,
): NextMilestone {
  const dated = (projectedOn: string): NextMilestone => ({
    milestone,
    projectedOn,
    overdue: projectedOn < todayPerth,
    reason: null,
  });
  const undated = (reason: string): NextMilestone => ({ milestone, projectedOn: null, overdue: false, reason });

  if (milestone.dueKind === "date") {
    return milestone.dueOn !== null && isRealDate(milestone.dueOn)
      ? dated(milestone.dueOn)
      : undated("No due date is recorded for this milestone.");
  }

  const target = milestone.dueFteMonths;
  if (target === null || !Number.isFinite(target) || target <= 0) {
    return undated("No FTE-months figure is recorded for this milestone.");
  }

  const reachedOn = dateFteMonthsReached(periods, target, todayPerth);
  if (reachedOn !== null) return dated(reachedOn);

  const position = currentPosition(periods, todayPerth);
  if (position.onBreak) {
    return undated("You are on a break, so the training clock is paused and no date can be projected.");
  }
  if (!position.rotation || position.rotation.fte <= 0) {
    return undated("No rotation covers today, so there is no current FTE to project from.");
  }

  // Today is already counted, so projection starts tomorrow and assumes the
  // current rotation's FTE continues until the target is reached.
  const remainingFteDays = (target - fteMonthsAsOf(periods, todayPerth)) * TRAINING_DAYS_PER_MONTH;
  const daysNeeded = Math.max(1, Math.ceil(remainingFteDays / position.rotation.fte - EPSILON));
  return dated(dateFromDayNumber(dayNumber(todayPerth) + daysNeeded));
}

/**
 * The next incomplete milestone. Overdue ones come first (oldest first), then
 * the earliest known or projected due date; milestones with no date sort last
 * (smallest FTE-months figure first). Ties keep input order. Returns null when
 * every milestone is complete.
 *
 * An FTE-months projection assumes the FTE of the rotation covering today
 * continues; it is an estimate, not a college date.
 */
export function nextMilestone(
  milestones: readonly TrainingMilestone[],
  periods: readonly TrainingPeriod[],
  todayPerth: string,
): NextMilestone | null {
  const assessed = milestones
    .filter((milestone) => milestone.completedOn === null)
    .map((milestone) => assessMilestone(milestone, periods, todayPerth));
  if (assessed.length === 0) return null;

  const ordered = assessed
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (a.item.overdue !== b.item.overdue) return a.item.overdue ? -1 : 1;
      const aDate = a.item.projectedOn;
      const bDate = b.item.projectedOn;
      if (aDate !== null && bDate !== null && aDate !== bDate) return aDate < bDate ? -1 : 1;
      if ((aDate === null) !== (bDate === null)) return aDate === null ? 1 : -1;
      if (aDate === null && bDate === null) {
        const aMonths = a.item.milestone.dueFteMonths ?? Number.POSITIVE_INFINITY;
        const bMonths = b.item.milestone.dueFteMonths ?? Number.POSITIVE_INFINITY;
        if (aMonths !== bMonths) return aMonths - bMonths;
      }
      return a.index - b.index;
    });
  return ordered[0].item;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** "14.5 FTE months", "12 FTE months", "1 FTE month". Rounds to one decimal, for display only. */
export function formatFteMonths(fteMonths: number): string {
  const safe = Number.isFinite(fteMonths) ? fteMonths : 0;
  const rounded = Math.round(safe * 10) / 10 || 0;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} FTE ${rounded === 1 ? "month" : "months"}`;
}
