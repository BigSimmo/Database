import "server-only";

import { cpdYearOf } from "@/lib/cme/cpd-year";
import { DEMO_CME_ENTRIES, DEMO_CME_INSTANT, DEMO_CME_YEAR } from "@/lib/cme/demo-year";
import { fetchOwnerCmeEntries, fetchOwnerCmeYear } from "@/lib/cme/repository";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";
import { isDemoMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CmePageData = {
  readonly demoMode: boolean;
  readonly year: number;
  /** Null when the owner has not confirmed targets for `year` yet (non-demo only). */
  readonly set: CmeRequirementSet | null;
  readonly entries: readonly CmeEntry[];
  readonly now: Date;
};

function withoutYearId(row: CmeRequirementSet & { readonly id: string }): CmeRequirementSet {
  return {
    year: row.year,
    confirmedOn: row.confirmedOn,
    confirmedSource: row.confirmedSource,
    totalHours: row.totalHours,
    requirements: row.requirements,
  };
}

/**
 * Server-side load for CME product pages.
 *
 * Demo mode keeps the fixed corpus and frozen instant so server and client
 * agree on pace. Every other deployment reads the signed-in owner's confirmed
 * year and entries through the same repository the API uses — never the demo
 * fixtures — so a saved entry is visible on `/cme/log` after redirect.
 */
export async function loadCmePageData(year?: number): Promise<CmePageData> {
  if (isDemoMode()) {
    const targetYear = year ?? DEMO_CME_YEAR.year;
    return {
      demoMode: true,
      year: targetYear,
      set: targetYear === DEMO_CME_YEAR.year ? DEMO_CME_YEAR : null,
      entries: targetYear === DEMO_CME_YEAR.year ? DEMO_CME_ENTRIES : [],
      now: DEMO_CME_INSTANT,
    };
  }

  const now = new Date();
  const targetYear = year ?? cpdYearOf(now);
  const serverClient = await createSupabaseServerClient();
  if (!serverClient) {
    return { demoMode: false, year: targetYear, set: null, entries: [], now };
  }

  const { data: auth, error: authError } = await serverClient.auth.getUser();
  if (authError || !auth.user) {
    return { demoMode: false, year: targetYear, set: null, entries: [], now };
  }

  const admin = createAdminClient();
  const yearRow = await fetchOwnerCmeYear(admin, auth.user.id, targetYear);
  if (!yearRow) {
    return { demoMode: false, year: targetYear, set: null, entries: [], now };
  }

  const entries = await fetchOwnerCmeEntries(admin, auth.user.id, yearRow.id);
  return {
    demoMode: false,
    year: targetYear,
    set: withoutYearId(yearRow),
    entries,
    now,
  };
}
