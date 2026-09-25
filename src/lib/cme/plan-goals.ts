import { z } from "zod";

import type { CmeEntry } from "@/lib/cme/types";

/**
 * The year's professional development plan: a few goals written near the
 * start of the year, and which goal each activity served.
 *
 * The Medical Board asks for a plan before CPD starts each year; this is where
 * it is written and then checked against. Goals are the owner's own words — the
 * app suggests nothing and judges nothing.
 */

export const CME_PLAN_GOAL_MAX = 10;
export const CME_PLAN_GOAL_MIN_LENGTH = 3;
export const CME_PLAN_GOAL_MAX_LENGTH = 300;

export type CmePlanGoal = {
  readonly id: string;
  readonly goal: string;
  readonly sortOrder: number;
};

export const cmePlanGoalsSaveSchema = z
  .object({
    year: z.number().int().min(2000).max(2100),
    goals: z
      .array(
        z
          .object({
            id: z.string().uuid().optional(),
            goal: z.string().trim().min(CME_PLAN_GOAL_MIN_LENGTH).max(CME_PLAN_GOAL_MAX_LENGTH),
          })
          .strict(),
      )
      .max(CME_PLAN_GOAL_MAX),
  })
  .strict();

export const cmeEntryGoalSchema = z.object({ goalId: z.string().uuid().nullable() }).strict();

export function rowToCmePlanGoal(row: { id: string; goal: string; sort_order: number }): CmePlanGoal {
  return { id: row.id, goal: row.goal, sortOrder: row.sort_order };
}

/** Hours and activities per goal, plus what served no goal, for the year-end view. */
export function hoursByGoal(
  goals: readonly CmePlanGoal[],
  entries: readonly CmeEntry[],
): { goal: CmePlanGoal | null; hours: number; entryCount: number }[] {
  const active = entries.filter((entry) => !entry.archivedAt);
  const hoursOf = (entry: CmeEntry) => entry.allocations.reduce((sum, allocation) => sum + allocation.hours, 0);
  const round = (value: number) => Math.round(value * 100) / 100;
  const rows = goals.map((goal) => {
    const served = active.filter((entry) => entry.goalId === goal.id);
    return { goal, hours: round(served.reduce((sum, entry) => sum + hoursOf(entry), 0)), entryCount: served.length };
  });
  const known = new Set(goals.map((goal) => goal.id));
  const unassigned = active.filter((entry) => !entry.goalId || !known.has(entry.goalId));
  return [
    ...rows,
    {
      goal: null,
      hours: round(unassigned.reduce((sum, entry) => sum + hoursOf(entry), 0)),
      entryCount: unassigned.length,
    },
  ];
}
