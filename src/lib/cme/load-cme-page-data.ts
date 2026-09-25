import "server-only";
import { fetchCmeEvidenceCounts } from "@/lib/cme/evidence-repository";
import { cpdYearOf } from "@/lib/cme/cpd-year";
import type { CmePlanGoal } from "@/lib/cme/plan-goals";
import { fetchOwnerCmeEntryGoals, fetchOwnerCmePlanGoals } from "@/lib/cme/plan-goals-repository";
import {
  DEMO_CME_ENTRIES,
  DEMO_CME_INSTANT,
  DEMO_CME_PLAN_GOALS,
  DEMO_CME_YEAR,
  DEMO_CME_ROUTINES,
} from "@/lib/cme/demo-year";
import {
  fetchOwnerCmeEntries,
  fetchOwnerCmeEntry,
  fetchOwnerCmeRoutines,
  fetchOwnerCmeYear,
  fetchOwnerCmeYearClose,
} from "@/lib/cme/repository";
import type { CmeRoutine } from "@/lib/cme/routines";
import { cmeYearConfigurationState } from "@/lib/cme/year-configuration";
import type { CmeEntry, CmeRequirementSet, CmeYearClose } from "@/lib/cme/types";
import { isDemoMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CmePageData = {
  readonly state: "ready" | "unconfigured" | "signed-out" | "unavailable";
  readonly demoMode: boolean;
  readonly year: number;
  readonly set: CmeRequirementSet | null;
  readonly entries: readonly CmeEntry[];
  readonly routines: readonly CmeRoutine[];
  readonly now: Date;
  /** The closing snapshot and amendments, when the year is closed. */
  readonly close: CmeYearClose | null;
  /** The year's development-plan goals, in the owner's order. */
  readonly goals: readonly CmePlanGoal[];
};

async function load(
  year?: number,
  entryId?: string,
  options: { includeArchived?: boolean } = {},
): Promise<CmePageData & { entry: CmeEntry | null }> {
  if (isDemoMode()) {
    const entry = entryId ? (DEMO_CME_ENTRIES.find((e) => e.id === entryId) ?? null) : null;
    const targetYear = entry ? Number(entry.date.slice(0, 4)) : (year ?? DEMO_CME_YEAR.year);
    return {
      state: targetYear === DEMO_CME_YEAR.year ? "ready" : "unconfigured",
      demoMode: true,
      year: targetYear,
      set: targetYear === DEMO_CME_YEAR.year ? DEMO_CME_YEAR : null,
      entries: targetYear === DEMO_CME_YEAR.year ? DEMO_CME_ENTRIES : [],
      routines: DEMO_CME_ROUTINES,
      now: DEMO_CME_INSTANT,
      // The demo year is never closed; closing is refused in demo mode.
      close: null,
      goals: targetYear === DEMO_CME_YEAR.year ? DEMO_CME_PLAN_GOALS : [],
      entry,
    };
  }
  const now = new Date();
  const empty = {
    demoMode: false,
    year: year ?? cpdYearOf(now),
    set: null,
    entries: [],
    routines: [],
    now,
    close: null,
    goals: [],
    entry: null,
  };
  try {
    const server = await createSupabaseServerClient();
    if (!server) return { ...empty, state: "unavailable" };
    const { data: auth, error } = await server.auth.getUser();
    if (error) return { ...empty, state: error.name === "AuthSessionMissingError" ? "signed-out" : "unavailable" };
    if (!auth.user) return { ...empty, state: "signed-out" };
    const admin = createAdminClient();
    const entry = entryId ? await fetchOwnerCmeEntry(admin, auth.user.id, entryId) : null;
    const targetYear = entry ? Number(entry.date.slice(0, 4)) : empty.year;
    const [set, routines] = await Promise.all([
      fetchOwnerCmeYear(admin, auth.user.id, targetYear),
      fetchOwnerCmeRoutines(admin, auth.user.id),
    ]);
    if (!set) return { ...empty, year: targetYear, routines, state: "unconfigured" };
    const loadedEntries = await fetchOwnerCmeEntries(admin, auth.user.id, set.id, options);
    const evidenceCounts = await fetchCmeEvidenceCounts(admin, auth.user.id, targetYear);
    const [goals, entryGoals] = await Promise.all([
      fetchOwnerCmePlanGoals(admin, auth.user.id, set.id),
      fetchOwnerCmeEntryGoals(admin, auth.user.id, entry ? [entry.id] : loadedEntries.map((item) => item.id)),
    ]);
    const entries = loadedEntries.map((item) => ({
      ...item,
      evidenceCount: evidenceCounts[item.id] ?? 0,
      // Only an activity linked to a goal carries the field, so an unlinked one reads as before.
      ...(entryGoals[item.id] ? { goalId: entryGoals[item.id] } : {}),
    }));
    const close = set.closedAt ? await fetchOwnerCmeYearClose(admin, auth.user.id, set.id) : null;
    const state = cmeYearConfigurationState(set);
    if (state === "unavailable") return { ...empty, year: targetYear, state };
    // Preserve the original settings and history for explicit owner repair.
    return {
      state,
      demoMode: false,
      year: targetYear,
      set,
      entries,
      routines,
      now,
      close,
      goals,
      entry: entry
        ? {
            ...entry,
            evidenceCount: evidenceCounts[entry.id] ?? 0,
            ...(entryGoals[entry.id] ? { goalId: entryGoals[entry.id] } : {}),
          }
        : null,
    };
  } catch {
    // Failure is distinct from setup: an outage must never invite replacing a saved year.
    return { ...empty, state: "unavailable" };
  }
}
export async function loadCmePageData(
  year?: number,
  options: { includeArchived?: boolean } = {},
): Promise<CmePageData> {
  return load(year, undefined, options);
}
export async function loadCmeEntryPageData(id: string): Promise<CmePageData & { entry: CmeEntry | null }> {
  return load(undefined, id);
}
