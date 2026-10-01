import { describe, expect, it } from "vitest";

import { buildCmeCatchUpPlan } from "@/lib/cme/catch-up-plan";
import { furthestFromMet, rankRequirementsByGap } from "@/lib/cme/requirement-gaps";
import { evaluateYear } from "@/lib/cme/evaluate";
import type { CmeRoutine } from "@/lib/cme/routines";
import type { CmeCategory, CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

function entry(id: string, date: string, hours: number, category: CmeCategory = "educational", archivedAt?: string) {
  return {
    id,
    date,
    title: "Activity",
    allocations: [{ category, hours }],
    reflection: "",
    costCents: null,
    transcribed: false,
    routineId: null,
    documentId: null,
    buckets: [],
    archivedAt: archivedAt ?? null,
  } satisfies CmeEntry;
}

function routine(overrides: Partial<CmeRoutine> & Pick<CmeRoutine, "id">): CmeRoutine {
  return {
    title: overrides.id,
    cadence: "monthly",
    usualHours: 1,
    usualAllocations: [],
    nextDue: null,
    archivedAt: null,
    ...overrides,
  };
}

const SET: CmeRequirementSet = {
  year: 2026,
  confirmedOn: "2026-01-05",
  confirmedSource: "Test fixture",
  totalHours: 50,
  requirements: [
    {
      id: "measuring",
      label: "Measuring outcomes",
      source: "national",
      spec: { shape: "hours-in-category", category: "measuring", minimumHours: 3 },
      completedOn: null,
    },
    {
      id: "educational",
      label: "Educational activities",
      source: "national",
      spec: { shape: "hours-in-category", category: "educational", minimumHours: 10 },
      completedOn: null,
    },
    {
      id: "plan",
      label: "Professional development plan",
      source: "national",
      spec: { shape: "task" },
      completedOn: null,
    },
    {
      id: "reviewing",
      label: "Reviewing performance",
      source: "national",
      spec: { shape: "hours-in-category", category: "reviewing", minimumHours: 20 },
      completedOn: null,
    },
  ],
};

/** 30 h logged in 2026, plus an archived 10 h that must count nothing. */
const ENTRIES: readonly CmeEntry[] = [
  entry("a", "2026-03-01", 20),
  entry("b", "2026-06-01", 10),
  entry("archived", "2026-07-01", 10, "reviewing", "2026-07-02T00:00:00Z"),
];

// Thursday 24 September 2026: 98 days to 31 December, exactly 14 weeks.
const TODAY = "2026-09-24";

describe("buildCmeCatchUpPlan", () => {
  it("splits what is left into routine hours likely by 31 Dec and hours still to find, as a weekly figure", () => {
    const plan = buildCmeCatchUpPlan({
      set: SET,
      entries: ENTRIES,
      today: TODAY,
      routines: [
        // 5 Oct, 5 Nov, 5 Dec: three future occurrences × 2 h.
        routine({ id: "journal", cadence: "monthly", usualHours: 2, nextDue: "2026-10-05" }),
        // 20 and 27 Dec: two × 1 h.
        routine({ id: "grand-round", cadence: "weekly", usualHours: 1, nextDue: "2026-12-20" }),
        routine({ id: "retired", cadence: "weekly", usualHours: 5, archivedAt: "2026-02-01T00:00:00Z" }),
        routine({ id: "no-hours", cadence: "weekly", usualHours: 0 }),
      ],
    });
    expect(plan).toEqual({
      status: "plan",
      yearEnd: "2026-12-31",
      hoursLogged: 30,
      targetHours: 50,
      hoursToGo: 20,
      weeksLeft: 14,
      routineEstimateHours: 8,
      routineCoverHours: 8,
      remainingAfterRoutines: 12,
      // 12 h ÷ 14 weeks = 0.857…
      hoursPerWeek: 0.9,
      biggestGap: {
        requirementId: "reviewing",
        label: "Reviewing performance",
        hoursToGo: 20,
        // The status wording, with its non-breaking space before "h".
        summary: "20\u00a0h to go",
      },
    });
  });

  it("with no routines, leaves the whole gap still to find", () => {
    const plan = buildCmeCatchUpPlan({ set: SET, entries: ENTRIES, routines: [], today: TODAY });
    expect(plan.routineEstimateHours).toBe(0);
    expect(plan.routineCoverHours).toBe(0);
    expect(plan.remainingAfterRoutines).toBe(20);
    // 20 ÷ 14 = 1.43
    expect(plan.hoursPerWeek).toBe(1.4);
  });

  it("never lets a routine estimate larger than the gap push the remainder below zero", () => {
    const plan = buildCmeCatchUpPlan({
      set: { ...SET, totalHours: 32 },
      entries: ENTRIES,
      today: TODAY,
      routines: [routine({ id: "weekly", cadence: "weekly", usualHours: 1, nextDue: "2026-09-25" })],
    });
    expect(plan.hoursToGo).toBe(2);
    expect(plan.routineEstimateHours).toBe(14);
    expect(plan.routineCoverHours).toBe(2);
    expect(plan.remainingAfterRoutines).toBe(0);
    expect(plan.hoursPerWeek).toBe(0);
  });

  it("counts an overdue routine from today, never its missed past dates", () => {
    const plan = buildCmeCatchUpPlan({
      set: SET,
      entries: ENTRIES,
      // 17 Dec: 17, 24 and 31 Dec remain — not the fifteen weeks since 1 Sep.
      today: "2026-12-17",
      routines: [routine({ id: "overdue", cadence: "weekly", usualHours: 1, nextDue: "2026-09-01" })],
    });
    expect(plan.routineEstimateHours).toBe(3);
  });

  it("keeps fractional weeks, and floors the divisor at one week in the last days", () => {
    const tenDaysLeft = buildCmeCatchUpPlan({ set: SET, entries: ENTRIES, routines: [], today: "2026-12-21" });
    // 10 days = 1.43 weeks; 20 h ÷ 1.43 = 14 h a week.
    expect(tenDaysLeft.weeksLeft).toBe(1.4);
    expect(tenDaysLeft.hoursPerWeek).toBe(14);

    const threeDaysLeft = buildCmeCatchUpPlan({ set: SET, entries: ENTRIES, routines: [], today: "2026-12-28" });
    expect(threeDaysLeft.weeksLeft).toBe(0.4);
    // Divided by one week, not 0.43: never a weekly figure larger than what is left.
    expect(threeDaysLeft.hoursPerWeek).toBe(20);

    const lastDay = buildCmeCatchUpPlan({ set: SET, entries: ENTRIES, routines: [], today: "2026-12-31" });
    expect(lastDay.status).toBe("plan");
    expect(lastDay.weeksLeft).toBe(0);
    expect(lastDay.hoursPerWeek).toBe(20);
  });

  it("says the target is met, with nothing to plan, once the total is reached", () => {
    const plan = buildCmeCatchUpPlan({
      set: SET,
      entries: [...ENTRIES, entry("c", "2026-08-01", 20, "measuring")],
      today: TODAY,
      routines: [routine({ id: "journal", cadence: "monthly", usualHours: 2, nextDue: "2026-10-05" })],
    });
    expect(plan.status).toBe("met");
    expect(plan.hoursToGo).toBe(0);
    expect(plan.routineEstimateHours).toBe(0);
    expect(plan.hoursPerWeek).toBe(0);
    // A category can still be short when the total is reached; the gap is still named.
    expect(plan.biggestGap?.requirementId).toBe("reviewing");
  });

  it("says the year has ended once 31 Dec has passed, or the year is closed", () => {
    const after = buildCmeCatchUpPlan({
      set: SET,
      entries: ENTRIES,
      today: "2027-01-03",
      routines: [routine({ id: "weekly", cadence: "weekly", usualHours: 1 })],
    });
    expect(after.status).toBe("year-ended");
    expect(after.weeksLeft).toBe(0);
    expect(after.routineEstimateHours).toBe(0);
    expect(after.hoursPerWeek).toBe(0);
    expect(after.hoursToGo).toBe(20);

    const closed = buildCmeCatchUpPlan({
      set: { ...SET, closedAt: "2026-12-20T02:00:00Z" },
      entries: ENTRIES,
      today: "2026-12-22",
      routines: [],
    });
    expect(closed.status).toBe("year-ended");
  });

  it("plans a year that has not started over the whole of it", () => {
    const plan = buildCmeCatchUpPlan({ set: SET, entries: [], routines: [], today: "2025-12-01" });
    expect(plan.status).toBe("plan");
    // 1 Jan to 31 Dec 2026 is 364 days after the first: 52 weeks.
    expect(plan.weeksLeft).toBe(52);
    expect(plan.hoursPerWeek).toBe(1);
  });

  it("names no gap when no hours requirement is short", () => {
    const plan = buildCmeCatchUpPlan({
      set: { ...SET, requirements: SET.requirements.filter((requirement) => requirement.id === "plan") },
      entries: ENTRIES,
      routines: [],
      today: TODAY,
    });
    expect(plan.biggestGap).toBeNull();
  });
});

describe("rankRequirementsByGap", () => {
  it("orders unmet hours gaps largest first, then counts, then tasks, then everything met", () => {
    const { statuses, unmet } = evaluateYear({ set: SET, entries: ENTRIES });
    expect(rankRequirementsByGap(SET, statuses).map((status) => status.requirementId)).toEqual([
      "reviewing",
      "measuring",
      "plan",
      "educational",
    ]);
    expect(furthestFromMet(SET, unmet)?.requirementId).toBe("reviewing");
  });
});
