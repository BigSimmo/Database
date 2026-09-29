import "server-only";

import { randomUUID } from "node:crypto";

import { cmeRepositoryError } from "@/lib/cme/repository";
import {
  validateTrainingPeriods,
  type TrainingMilestone,
  type TrainingMilestoneInput,
  type TrainingPeriod,
  type TrainingPeriodInput,
} from "@/lib/cme/training-timeline";
import { PublicApiError } from "@/lib/http";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

/**
 * Reads and writes for the trainee's own training timeline.
 *
 * Every query — reads, inserts, updates and deletes — carries the owner
 * predicate on the same chain as `.from()` (`npm run check:owner-scope`).
 * Nothing here touches a CPD year or a requirement, so none of it can move
 * hours or a target.
 *
 * A period write is checked against the owner's whole timeline first: the
 * existing periods are read, the change is applied in memory, and
 * `validateTrainingPeriods` must return no problems before anything is
 * written. Two overlapping writes racing each other could still both pass;
 * that is accepted for a single-owner record with no database-level overlap
 * constraint.
 */

/** Upper bound on each list. A training record is a few dozen rows at most. */
export const CME_TRAINING_MAX_ROWS = 200;

const PERIOD_COLUMNS = "id, kind, label, starts_on, ends_on, fte";
const MILESTONE_COLUMNS = "id, label, due_kind, due_fte_months, due_on, completed_on";

type PeriodRow = {
  id: string;
  kind: TrainingPeriod["kind"];
  label: string;
  starts_on: string;
  ends_on: string | null;
  fte: number | string;
};

type MilestoneRow = {
  id: string;
  label: string;
  due_kind: TrainingMilestone["dueKind"];
  due_fte_months: number | string | null;
  due_on: string | null;
  completed_on: string | null;
};

/** `numeric` columns can arrive as strings from PostgREST; the domain always sees numbers. */
function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export function rowToTrainingPeriod(row: PeriodRow): TrainingPeriod {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    fte: toNumber(row.fte),
  };
}

export function rowToTrainingMilestone(row: MilestoneRow): TrainingMilestone {
  return {
    id: row.id,
    label: row.label,
    dueKind: row.due_kind,
    dueFteMonths: row.due_fte_months === null ? null : toNumber(row.due_fte_months),
    dueOn: row.due_on,
    completedOn: row.completed_on,
  };
}

function periodColumns(input: TrainingPeriodInput) {
  return {
    kind: input.kind,
    label: input.label,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    fte: input.fte,
  };
}

function milestoneColumns(input: TrainingMilestoneInput) {
  return {
    label: input.label,
    due_kind: input.dueKind,
    due_fte_months: input.dueFteMonths,
    due_on: input.dueOn,
    completed_on: input.completedOn,
  };
}

function requireOwner(ownerId: string) {
  if (!ownerId) throw new Error("Training records were requested without an ownerId; refusing to run.");
}

const periodNotFound = () => new PublicApiError("Training period not found.", 404, { code: "cme_training_not_found" });
const milestoneNotFound = () => new PublicApiError("Milestone not found.", 404, { code: "cme_training_not_found" });

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export async function fetchOwnerTrainingPeriods(supabase: AdminClient, ownerId: string): Promise<TrainingPeriod[]> {
  requireOwner(ownerId);
  const { data, error } = await supabase
    .from("cme_training_periods")
    .select(PERIOD_COLUMNS)
    .eq("owner_id", ownerId)
    .order("starts_on", { ascending: true })
    .limit(CME_TRAINING_MAX_ROWS);
  if (error) throw cmeRepositoryError(error);
  return ((data ?? []) as PeriodRow[]).map(rowToTrainingPeriod);
}

/** Throws a 400 naming every cross-record problem the proposed timeline would have. */
function assertValidTimeline(periods: readonly TrainingPeriod[]) {
  const problems = validateTrainingPeriods(periods);
  if (problems.length > 0) {
    throw new PublicApiError(problems.map((problem) => problem.message).join(" "), 400, {
      code: "cme_training_invalid_timeline",
    });
  }
}

export async function createOwnerTrainingPeriod(
  supabase: AdminClient,
  ownerId: string,
  input: TrainingPeriodInput,
): Promise<TrainingPeriod> {
  requireOwner(ownerId);
  const existing = await fetchOwnerTrainingPeriods(supabase, ownerId);
  if (existing.length >= CME_TRAINING_MAX_ROWS) {
    throw new PublicApiError(`A training record holds at most ${CME_TRAINING_MAX_ROWS} periods.`, 409, {
      code: "cme_training_limit",
    });
  }
  const id = randomUUID();
  assertValidTimeline([...existing, { id, ...input }]);
  const { data, error } = await supabase
    .from("cme_training_periods")
    .insert({ ...periodColumns(input), id, owner_id: ownerId })
    .select(PERIOD_COLUMNS)
    .single();
  if (error) throw cmeRepositoryError(error);
  return rowToTrainingPeriod(data as PeriodRow);
}

export async function updateOwnerTrainingPeriod(
  supabase: AdminClient,
  ownerId: string,
  id: string,
  input: TrainingPeriodInput,
): Promise<TrainingPeriod> {
  requireOwner(ownerId);
  const existing = await fetchOwnerTrainingPeriods(supabase, ownerId);
  if (!existing.some((period) => period.id === id)) throw periodNotFound();
  assertValidTimeline(existing.map((period) => (period.id === id ? { id, ...input } : period)));
  const { data, error } = await supabase
    .from("cme_training_periods")
    .update(periodColumns(input))
    .eq("owner_id", ownerId)
    .eq("id", id)
    .select(PERIOD_COLUMNS)
    .maybeSingle();
  if (error) throw cmeRepositoryError(error);
  if (!data) throw periodNotFound();
  return rowToTrainingPeriod(data as PeriodRow);
}

export async function deleteOwnerTrainingPeriod(supabase: AdminClient, ownerId: string, id: string): Promise<void> {
  requireOwner(ownerId);
  const { data, error } = await supabase
    .from("cme_training_periods")
    .delete()
    .eq("owner_id", ownerId)
    .eq("id", id)
    .select("id");
  if (error) throw cmeRepositoryError(error);
  if (!data || data.length === 0) throw periodNotFound();
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function fetchOwnerTrainingMilestones(
  supabase: AdminClient,
  ownerId: string,
): Promise<TrainingMilestone[]> {
  requireOwner(ownerId);
  const { data, error } = await supabase
    .from("cme_training_milestones")
    .select(MILESTONE_COLUMNS)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(CME_TRAINING_MAX_ROWS);
  if (error) throw cmeRepositoryError(error);
  return ((data ?? []) as MilestoneRow[]).map(rowToTrainingMilestone);
}

export async function createOwnerTrainingMilestone(
  supabase: AdminClient,
  ownerId: string,
  input: TrainingMilestoneInput,
): Promise<TrainingMilestone> {
  requireOwner(ownerId);
  const { count, error: countError } = await supabase
    .from("cme_training_milestones")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  if (countError) throw cmeRepositoryError(countError);
  if ((count ?? 0) >= CME_TRAINING_MAX_ROWS) {
    throw new PublicApiError(`A training record holds at most ${CME_TRAINING_MAX_ROWS} milestones.`, 409, {
      code: "cme_training_limit",
    });
  }
  const { data, error } = await supabase
    .from("cme_training_milestones")
    .insert({ ...milestoneColumns(input), id: randomUUID(), owner_id: ownerId })
    .select(MILESTONE_COLUMNS)
    .single();
  if (error) throw cmeRepositoryError(error);
  return rowToTrainingMilestone(data as MilestoneRow);
}

export async function updateOwnerTrainingMilestone(
  supabase: AdminClient,
  ownerId: string,
  id: string,
  input: TrainingMilestoneInput,
): Promise<TrainingMilestone> {
  requireOwner(ownerId);
  const { data, error } = await supabase
    .from("cme_training_milestones")
    .update(milestoneColumns(input))
    .eq("owner_id", ownerId)
    .eq("id", id)
    .select(MILESTONE_COLUMNS)
    .maybeSingle();
  if (error) throw cmeRepositoryError(error);
  if (!data) throw milestoneNotFound();
  return rowToTrainingMilestone(data as MilestoneRow);
}

export async function deleteOwnerTrainingMilestone(supabase: AdminClient, ownerId: string, id: string): Promise<void> {
  requireOwner(ownerId);
  const { data, error } = await supabase
    .from("cme_training_milestones")
    .delete()
    .eq("owner_id", ownerId)
    .eq("id", id)
    .select("id");
  if (error) throw cmeRepositoryError(error);
  if (!data || data.length === 0) throw milestoneNotFound();
}
