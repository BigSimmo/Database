"use client";

import { useRouter } from "next/navigation";

import { cmeRoutineLogHref } from "@/components/cme/cme-route-navigation";
import { CmeRoutinesPage } from "@/components/cme/cme-routines-page";
import { DEMO_CME_INSTANT } from "@/lib/cme/demo-year";

/**
 * Routines, wired to real destinations.
 *
 * `onLogRoutine` and `onNewRoutine` are required props on `CmeRoutinesPage`,
 * with no silent no-op defaults, so this file is what stops either control
 * rendering and then doing nothing when tapped. Neither handler writes
 * anything: Log opens the entry form for the owner to confirm, and New routine
 * goes to the mode's own setup surface.
 *
 * `onNewRoutine` is the one placeholder in this mode's wiring, and it is a
 * placeholder because Phase 1 ships no routine editor and no routine store at
 * all. It sends the owner to the Set up screen's "Set up your routines" card —
 * the only place in the mode that offers routine setup — rather than to a
 * screen that does not exist. When the editor lands, this handler points at it.
 *
 * `now` is `DEMO_CME_INSTANT` for the reason given in `cme-dashboard-route.tsx`:
 * the prop is required so server and client agree on what is due, and a fresh
 * `new Date()` on each side is the disagreement it exists to prevent.
 */
export function CmeRoutinesRoute() {
  const router = useRouter();

  return (
    <CmeRoutinesPage
      now={DEMO_CME_INSTANT}
      onLogRoutine={(prefill) => router.push(cmeRoutineLogHref(prefill))}
      onNewRoutine={() => router.push("/cme/setup#cme-setup-routines")}
    />
  );
}
