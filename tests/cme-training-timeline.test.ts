import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  currentPosition,
  formatFteMonths,
  fteMonthsAsOf,
  nextMilestone,
  TRAINING_DAYS_PER_MONTH,
  trainingMilestoneInputSchema,
  trainingPeriodInputSchema,
  validateTrainingPeriods,
  type TrainingMilestone,
  type TrainingPeriod,
} from "@/lib/cme/training-timeline";

function period(
  id: string,
  kind: TrainingPeriod["kind"],
  startsOn: string,
  endsOn: string | null,
  fte = kind === "break" ? 0 : 1,
): TrainingPeriod {
  return { id, kind, label: id, startsOn, endsOn, fte };
}

function dateMilestone(id: string, dueOn: string, completedOn: string | null = null): TrainingMilestone {
  return { id, label: id, dueKind: "date", dueFteMonths: null, dueOn, completedOn };
}

function fteMilestone(id: string, dueFteMonths: number, completedOn: string | null = null): TrainingMilestone {
  return { id, label: id, dueKind: "fte-months", dueFteMonths, dueOn: null, completedOn };
}

const months = (days: number) => days / TRAINING_DAYS_PER_MONTH;

describe("the training clock counts FTE months from rotations only", () => {
  it("defines a month as 365.25 / 12 days", () => {
    expect(TRAINING_DAYS_PER_MONTH).toBe(30.4375);
  });

  it("halves the clock at 0.5 FTE", () => {
    const full = [period("r", "rotation", "2026-01-01", "2026-12-31", 1)];
    const half = [period("r", "rotation", "2026-01-01", "2026-12-31", 0.5)];
    expect(fteMonthsAsOf(full, "2026-12-31")).toBeCloseTo(months(365), 10);
    expect(fteMonthsAsOf(half, "2026-12-31")).toBeCloseTo(months(365) / 2, 10);
  });

  it("pauses the clock during a break", () => {
    const periods = [
      period("r1", "rotation", "2026-01-01", "2026-01-31"),
      period("b", "break", "2026-02-01", "2026-02-28"),
      period("r2", "rotation", "2026-03-01", null),
    ];
    expect(fteMonthsAsOf(periods, "2026-01-31")).toBeCloseTo(months(31), 10);
    expect(fteMonthsAsOf(periods, "2026-02-28")).toBeCloseTo(months(31), 10);
    expect(fteMonthsAsOf(periods, "2026-03-10")).toBeCloseTo(months(41), 10);
  });

  it("counts gaps between rotations as zero", () => {
    const periods = [
      period("r1", "rotation", "2026-01-01", "2026-01-31"),
      period("r2", "rotation", "2026-03-01", "2026-03-31"),
    ];
    expect(fteMonthsAsOf(periods, "2026-02-15")).toBeCloseTo(months(31), 10);
    expect(fteMonthsAsOf(periods, "2026-03-31")).toBeCloseTo(months(62), 10);
  });

  it("clips an ongoing rotation to today and ignores one not yet started", () => {
    const periods = [period("now", "rotation", "2026-09-01", null), period("next", "rotation", "2026-10-01", null)];
    expect(fteMonthsAsOf(periods, "2026-09-26")).toBeCloseTo(months(26), 10);
  });

  it("does not count stages, even though they cover the same days", () => {
    const periods = [period("s", "stage", "2026-01-01", null), period("r", "rotation", "2026-01-01", "2026-01-31")];
    expect(fteMonthsAsOf(periods, "2026-03-01")).toBeCloseTo(months(31), 10);
  });
});

describe("validateTrainingPeriods", () => {
  it("rejects rotations that share even one day", () => {
    const problems = validateTrainingPeriods([
      period("a", "rotation", "2026-01-01", "2026-06-30"),
      period("b", "rotation", "2026-06-30", "2026-12-31"),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ code: "rotation-overlaps-rotation", periodIds: ["a", "b"] });
  });

  it("treats an ongoing rotation as open-ended", () => {
    const problems = validateTrainingPeriods([
      period("later", "rotation", "2027-02-01", "2027-06-30"),
      period("ongoing", "rotation", "2026-01-01", null),
    ]);
    expect(problems.map((problem) => problem.code)).toEqual(["rotation-overlaps-rotation"]);
  });

  it("rejects a rotation overlapping a break", () => {
    const problems = validateTrainingPeriods([
      period("r", "rotation", "2026-01-01", "2026-06-30"),
      period("b", "break", "2026-06-01", "2026-07-31"),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ code: "rotation-overlaps-break", periodIds: ["r", "b"] });
  });

  it("accepts back-to-back rotations and stages that contain rotations", () => {
    expect(
      validateTrainingPeriods([
        period("s", "stage", "2026-01-01", "2027-12-31"),
        period("r1", "rotation", "2026-01-01", "2026-06-30"),
        period("r2", "rotation", "2026-07-01", null),
      ]),
    ).toEqual([]);
  });
});

describe("input schemas", () => {
  const validPeriod = {
    kind: "rotation",
    label: "Adult inpatient",
    startsOn: "2026-02-02",
    endsOn: "2026-08-02",
    fte: 0.5,
  } as const;
  const validMilestone = {
    label: "Scholarly project",
    dueKind: "date",
    dueFteMonths: null,
    dueOn: "2027-03-01",
    completedOn: null,
  } as const;

  it("accepts a valid rotation, break and stage", () => {
    expect(trainingPeriodInputSchema.safeParse(validPeriod).success).toBe(true);
    expect(trainingPeriodInputSchema.safeParse({ ...validPeriod, kind: "break", fte: 0 }).success).toBe(true);
    expect(trainingPeriodInputSchema.safeParse({ ...validPeriod, kind: "stage", endsOn: null }).success).toBe(true);
  });

  it("rejects a break with FTE above 0", () => {
    expect(trainingPeriodInputSchema.safeParse({ ...validPeriod, kind: "break", fte: 0.2 }).success).toBe(false);
  });

  it("rejects a rotation with FTE 0", () => {
    expect(trainingPeriodInputSchema.safeParse({ ...validPeriod, fte: 0 }).success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    expect(trainingPeriodInputSchema.safeParse({ ...validPeriod, endsOn: "2026-02-01" }).success).toBe(false);
  });

  it("rejects FTE outside 0–1 or with more than two decimals, and impossible dates", () => {
    expect(trainingPeriodInputSchema.safeParse({ ...validPeriod, fte: 1.2 }).success).toBe(false);
    expect(trainingPeriodInputSchema.safeParse({ ...validPeriod, fte: 0.333 }).success).toBe(false);
    expect(trainingPeriodInputSchema.safeParse({ ...validPeriod, startsOn: "2026-02-30" }).success).toBe(false);
    expect(trainingPeriodInputSchema.safeParse({ ...validPeriod, label: "" }).success).toBe(false);
  });

  it("accepts a milestone with exactly one due field matching its kind", () => {
    expect(trainingMilestoneInputSchema.safeParse(validMilestone).success).toBe(true);
    expect(
      trainingMilestoneInputSchema.safeParse({
        ...validMilestone,
        dueKind: "fte-months",
        dueFteMonths: 12,
        dueOn: null,
      }).success,
    ).toBe(true);
  });

  it("rejects a milestone with both or neither due field", () => {
    expect(trainingMilestoneInputSchema.safeParse({ ...validMilestone, dueFteMonths: 12 }).success).toBe(false);
    expect(trainingMilestoneInputSchema.safeParse({ ...validMilestone, dueOn: null }).success).toBe(false);
    expect(
      trainingMilestoneInputSchema.safeParse({ ...validMilestone, dueKind: "fte-months", dueOn: null }).success,
    ).toBe(false);
  });

  it("rejects a milestone whose due field does not match its kind", () => {
    expect(trainingMilestoneInputSchema.safeParse({ ...validMilestone, dueKind: "fte-months" }).success).toBe(false);
  });
});

describe("currentPosition", () => {
  const periods = [
    period("stage-1", "stage", "2025-01-01", "2025-12-31"),
    period("r0", "rotation", "2025-07-01", "2025-12-31"),
    period("r4", "rotation", "2027-07-01", "2027-12-31"),
    period("r2", "rotation", "2026-07-01", "2026-12-31"),
    period("stage-2", "stage", "2026-01-01", "2027-12-31"),
    period("r3", "rotation", "2027-01-01", "2027-06-30"),
    period("r1", "rotation", "2026-01-01", "2026-06-30"),
  ];

  it('reports "rotation 3 of 4" within the current stage', () => {
    const position = currentPosition(periods, "2027-03-15");
    expect(position.stage?.id).toBe("stage-2");
    expect(position.rotation?.id).toBe("r3");
    expect(position.rotationIndex).toBe(3);
    expect(position.rotationCount).toBe(4);
    expect(position.onBreak).toBe(false);
  });

  it("lets the latest-starting stage win when stages overlap", () => {
    const overlapping = [period("outer", "stage", "2025-01-01", null), period("inner", "stage", "2026-01-01", null)];
    expect(currentPosition(overlapping, "2026-05-01").stage?.id).toBe("inner");
  });

  it("reports a break with no current rotation", () => {
    const position = currentPosition(
      [period("s", "stage", "2026-01-01", null), period("b", "break", "2026-09-01", null)],
      "2026-09-26",
    );
    expect(position).toMatchObject({ onBreak: true, rotation: null, rotationIndex: null, rotationCount: 0 });
    expect(position.breakPeriod?.id).toBe("b");
  });
});

describe("nextMilestone", () => {
  // 1 January to 26 September 2026 is 269 days; at 0.5 FTE that is 134.5 FTE days.
  const halfTime = [period("r", "rotation", "2026-01-01", null, 0.5)];
  const today = "2026-09-26";

  it("projects an FTE-months milestone at the current 0.5 FTE", () => {
    // 6 FTE months = 182.625 FTE days; 48.125 remain, which takes 96.25 → 97 days at 0.5 FTE.
    const next = nextMilestone([fteMilestone("six", 6)], halfTime, today);
    expect(next).toMatchObject({ projectedOn: "2027-01-01", overdue: false, reason: null });
    expect(fteMonthsAsOf(halfTime, "2026-12-31")).toBeLessThan(6);
    expect(fteMonthsAsOf(halfTime, "2027-01-01")).toBeGreaterThanOrEqual(6);
  });

  it("chooses the earliest due date among incomplete milestones", () => {
    const next = nextMilestone(
      [dateMilestone("later", "2027-03-01"), fteMilestone("six", 6), dateMilestone("done", "2026-01-01", "2026-01-01")],
      halfTime,
      today,
    );
    expect(next?.milestone.id).toBe("six");
  });

  it("puts overdue milestones first", () => {
    const next = nextMilestone([fteMilestone("six", 6), dateMilestone("late", "2026-08-01")], halfTime, today);
    expect(next).toMatchObject({ projectedOn: "2026-08-01", overdue: true });
    expect(next?.milestone.id).toBe("late");
  });

  it("dates an FTE-months milestone already reached to the day the clock crossed it", () => {
    // 3 FTE months = 91.3125 FTE days = 182.625 days at 0.5 FTE → day 183 = 2 July.
    const next = nextMilestone([fteMilestone("three", 3)], halfTime, today);
    expect(next).toMatchObject({ projectedOn: "2026-07-02", overdue: true });
  });

  it("does not call a milestone due today overdue", () => {
    expect(nextMilestone([dateMilestone("today", today)], halfTime, today)?.overdue).toBe(false);
  });

  it("gives no projection on a break, and explains why", () => {
    const onBreak = [period("r", "rotation", "2026-01-01", "2026-06-30"), period("b", "break", "2026-07-01", null)];
    const next = nextMilestone([fteMilestone("twelve", 12)], onBreak, today);
    expect(next?.projectedOn).toBeNull();
    expect(next?.overdue).toBe(false);
    expect(next?.reason).toMatch(/break/i);
  });

  it("gives no projection with no current rotation, and ranks it after dated milestones", () => {
    const gap = [period("r", "rotation", "2026-01-01", "2026-06-30")];
    expect(nextMilestone([fteMilestone("twelve", 12)], gap, today)?.reason).toMatch(/no rotation/i);
    const next = nextMilestone([fteMilestone("twelve", 12), dateMilestone("dated", "2030-01-01")], gap, today);
    expect(next?.milestone.id).toBe("dated");
  });

  it("returns null when every milestone is complete", () => {
    expect(nextMilestone([dateMilestone("done", "2026-01-01", "2026-01-02")], halfTime, today)).toBeNull();
  });
});

describe("formatFteMonths", () => {
  it("rounds to one decimal for display", () => {
    expect(formatFteMonths(14.46)).toBe("14.5 FTE months");
    expect(formatFteMonths(12)).toBe("12 FTE months");
    expect(formatFteMonths(11.98)).toBe("12 FTE months");
    expect(formatFteMonths(1)).toBe("1 FTE month");
    expect(formatFteMonths(0)).toBe("0 FTE months");
  });
});

describe("the training timeline stays separate from CPD evaluation", () => {
  const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
  const importSpecifiers = (source: string) =>
    [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((match) => match[1]);

  it("training-timeline does not import evaluate", () => {
    const specifiers = importSpecifiers(read("src/lib/cme/training-timeline.ts"));
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((specifier) => /(^|\/)evaluate$/.test(specifier))).toEqual([]);
  });

  it("evaluate does not import training-timeline", () => {
    const specifiers = importSpecifiers(read("src/lib/cme/evaluate.ts"));
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((specifier) => /training-timeline/.test(specifier))).toEqual([]);
  });
});
