import "server-only";

import { CME_MAX_ENTRIES, cmeRepositoryError } from "@/lib/cme/repository";
import { rowToCmePlanGoal, type CmePlanGoal } from "@/lib/cme/plan-goals";
import type { Json } from "@/lib/supabase/database.types";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

/**
 * Reads and writes for the development plan. Every read carries the owner
 * predicate on the same chain as `.from()` (`npm run check:owner-scope`), and
 * both writes go through database functions that take the owner lock and
 * refuse a closed year.
 */

export async function fetchOwnerCmePlanGoals(
  supabase: AdminClient,
  ownerId: string,
  yearId: string,
): Promise<CmePlanGoal[]> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { data, error } = await supabase
    .from("cme_plan_goals")
    .select("id, goal, sort_order")
    .eq("owner_id", ownerId)
    .eq("year_id", yearId)
    .order("sort_order", { ascending: true })
    .limit(CME_MAX_ENTRIES);
  if (error) throw cmeRepositoryError(error);
  return (data ?? []).map(rowToCmePlanGoal);
}

/** Entry id -> goal id, for the given entries. */
export async function fetchOwnerCmeEntryGoals(
  supabase: AdminClient,
  ownerId: string,
  entryIds: readonly string[],
): Promise<Record<string, string>> {
  if (!ownerId) throw new Error("Missing CME owner.");
  if (entryIds.length === 0) return {};
  const { data, error } = await supabase
    .from("cme_entry_goals")
    .select("entry_id, goal_id")
    .eq("owner_id", ownerId)
    .in("entry_id", [...entryIds])
    .limit(CME_MAX_ENTRIES);
  if (error) throw cmeRepositoryError(error);
  return Object.fromEntries((data ?? []).map((row) => [row.entry_id, row.goal_id]));
}

export async function saveOwnerCmePlanGoals(
  supabase: AdminClient,
  ownerId: string,
  yearId: string,
  goals: readonly { id?: string; goal: string }[],
): Promise<CmePlanGoal[]> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { data, error } = await supabase.rpc("cme_save_plan_goals", {
    p_owner_id: ownerId,
    p_year_id: yearId,
    p_goals: goals.map((goal) => (goal.id ? { id: goal.id, goal: goal.goal } : { goal: goal.goal })) as Json,
  });
  if (error) throw cmeRepositoryError(error);
  return ((data ?? []) as { id: string; goal: string; sortOrder: number }[]).map((goal) => ({
    id: goal.id,
    goal: goal.goal,
    sortOrder: goal.sortOrder,
  }));
}

export async function setOwnerCmeEntryGoal(
  supabase: AdminClient,
  ownerId: string,
  entryId: string,
  goalId: string | null,
): Promise<void> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { error } = await supabase.rpc("cme_set_entry_goal", {
    p_owner_id: ownerId,
    p_entry_id: entryId,
    p_goal_id: goalId,
  });
  if (error) throw cmeRepositoryError(error);
}
