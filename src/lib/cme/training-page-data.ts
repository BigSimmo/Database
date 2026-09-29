import "server-only";

import { DEMO_CME_INSTANT } from "@/lib/cme/demo-year";
import { fetchOwnerTrainingMilestones, fetchOwnerTrainingPeriods } from "@/lib/cme/training-repository";
import type { TrainingMilestone, TrainingPeriod } from "@/lib/cme/training-timeline";
import { isDemoMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CmeTrainingPageData = {
  readonly state: "ready" | "signed-out" | "unavailable";
  readonly demoMode: boolean;
  readonly periods: readonly TrainingPeriod[];
  readonly milestones: readonly TrainingMilestone[];
  readonly now: Date;
};

/**
 * The Training page's data: the signed-in owner's own periods and milestones.
 *
 * Resolves the owner exactly as `loadCmePageData` does (the server session's
 * verified user, then the service-role client scoped to that owner), and
 * keeps the same distinction between signed out and unavailable, so an outage
 * never reads as an empty record. Demo mode has no training record at all:
 * nothing is preloaded, even synthetically.
 *
 * The timeline is not tied to a CPD year, so an unconfigured year does not
 * block this page.
 */
export async function loadCmeTrainingPageData(): Promise<CmeTrainingPageData> {
  if (isDemoMode()) {
    return { state: "ready", demoMode: true, periods: [], milestones: [], now: DEMO_CME_INSTANT };
  }
  const now = new Date();
  const empty = { demoMode: false, periods: [], milestones: [], now };
  try {
    const server = await createSupabaseServerClient();
    if (!server) return { ...empty, state: "unavailable" };
    const { data: auth, error } = await server.auth.getUser();
    if (error) return { ...empty, state: error.name === "AuthSessionMissingError" ? "signed-out" : "unavailable" };
    if (!auth.user) return { ...empty, state: "signed-out" };
    const admin = createAdminClient();
    const [periods, milestones] = await Promise.all([
      fetchOwnerTrainingPeriods(admin, auth.user.id),
      fetchOwnerTrainingMilestones(admin, auth.user.id),
    ]);
    return { state: "ready", demoMode: false, periods, milestones, now };
  } catch {
    return { ...empty, state: "unavailable" };
  }
}
