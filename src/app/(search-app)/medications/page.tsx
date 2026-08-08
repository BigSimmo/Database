import type { Metadata } from "next";

import { MedicationsHomeClient } from "./medications-home-client";

export const metadata: Metadata = {
  title: "Medication - Clinical KB",
  description: "Medication dosing, safety, and monitoring guidance from indexed sources.",
};

/**
 * The Medication mode home.
 *
 * Replaces the former 307 alias to `/?mode=prescribing`: `/` is now the single
 * shared home for every mode, so prescribing needs its own home like every other
 * mode. A submitted search still resolves to `/?mode=prescribing&q=…&run=1`, which
 * stays dashboard-owned. The body comes from ClinicalDashboard, which the shared
 * shell mounts for this pathname; this route is the content slot.
 */
export default function MedicationsHomeRoute() {
  return <MedicationsHomeClient />;
}
