import "server-only";
import { fetchCmeEvidenceCounts } from "@/lib/cme/evidence-repository";
import { cpdYearOf } from "@/lib/cme/cpd-year";
import { DEMO_CME_ENTRIES, DEMO_CME_INSTANT, DEMO_CME_YEAR, DEMO_CME_ROUTINES } from "@/lib/cme/demo-year";
import {
  fetchOwnerCmeEntries,
  fetchOwnerCmeEntry,
  fetchOwnerCmeRoutines,
  fetchOwnerCmeYear,
} from "@/lib/cme/repository";
import type { CmeRoutine } from "@/lib/cme/routines";
import { cmeYearConfigurationState } from "@/lib/cme/year-configuration";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";
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
    const entries = loadedEntries.map((item) => ({ ...item, evidenceCount: evidenceCounts[item.id] ?? 0 }));
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
      entry: entry ? { ...entry, evidenceCount: evidenceCounts[entry.id] ?? 0 } : null,
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
