"use client";

import { useRouter } from "next/navigation";

import { CmeDashboard } from "@/components/cme/cme-dashboard";
import { cmeRoutineLogHref } from "@/components/cme/cme-route-navigation";
import { DEMO_CME_ENTRIES, DEMO_CME_INSTANT, DEMO_CME_YEAR } from "@/lib/cme/demo-year";

/**
 * The CME mode home, wired to real destinations.
 *
 * A Client Component because `CmeDashboard`'s two controls are callbacks, and a
 * function prop cannot cross the Server Component boundary. The route file
 * itself stays a thin Server Component that exports only `metadata` and a
 * default — this is where the wiring lives.
 *
 * `now` is `DEMO_CME_INSTANT` rather than `new Date()`, deliberately. The
 * dashboard requires the instant as a prop so a server render and the client it
 * hydrates into agree on which season of the year the screen is in; a fresh
 * `new Date()` on each side is exactly the disagreement that prop exists to
 * prevent. The figures on this screen come from the demo corpus in Phase 1, and
 * that corpus is written against this instant — reading the wall clock would
 * date a fixed year's data against a moving today and report a pace that means
 * nothing.
 */
export function CmeDashboardRoute() {
  const router = useRouter();

  return (
    <CmeDashboard
      set={DEMO_CME_YEAR}
      entries={DEMO_CME_ENTRIES}
      now={DEMO_CME_INSTANT}
      // No routines exist yet: Phase 1 has no routine store and no editor, so
      // the dashboard's routines-due module stays empty rather than being
      // handed invented rows. The handler below is still real, because the
      // module renders a Log button the moment a routine does exist.
      onLogRoutine={(prefill) => router.push(cmeRoutineLogHref(prefill))}
      onOpenCustomise={() => router.push("/cme/customise")}
    />
  );
}
