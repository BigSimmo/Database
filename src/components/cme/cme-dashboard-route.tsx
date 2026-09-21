"use client";

import { useRouter } from "next/navigation";

import { CmeDashboard } from "@/components/cme/cme-dashboard";
import { cmeRoutineLogHref } from "@/components/cme/cme-route-navigation";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

export type CmeDashboardRouteProps = {
  readonly set: CmeRequirementSet;
  readonly entries: readonly CmeEntry[];
  /** ISO instant from the server load — Dates cannot cross the RSC boundary intact. */
  readonly nowIso: string;
};

/**
 * The CME mode home, wired to real destinations.
 *
 * A Client Component because `CmeDashboard`'s two controls are callbacks, and a
 * function prop cannot cross the Server Component boundary. The route file
 * itself stays a thin Server Component that exports only `metadata` and loads
 * owner (or demo) data — this is where the wiring lives.
 *
 * `now` is supplied by the server load so a server render and the client it
 * hydrates into agree on which season of the year the screen is in. Demo mode
 * freezes that instant against the corpus; live mode uses the request time.
 */
export function CmeDashboardRoute({ set, entries, nowIso }: CmeDashboardRouteProps) {
  const router = useRouter();

  return (
    <CmeDashboard
      set={set}
      entries={entries}
      now={new Date(nowIso)}
      onLogRoutine={(prefill) => router.push(cmeRoutineLogHref(prefill))}
      onOpenCustomise={() => router.push("/cme/customise")}
    />
  );
}
