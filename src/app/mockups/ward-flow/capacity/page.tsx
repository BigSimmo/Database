import type { Metadata } from "next";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";

/**
 * MERGE 02 (owner-approved 2026-09-05, `docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md`
 * §2) folded the former bed-state view and the morning bed state board into this one screen —
 * `CapacityScreen`. `/mockups/ward-flow/morning` now redirects here; see that route's own doc
 * comment for the reasoning.
 */
export const metadata: Metadata = {
  title: "Capacity - Ward Flow",
  description: "Synthetic ward-confirmed mental health bed-state and capability view.",
};

export default function WardCapacityPage() {
  return <CapacityScreen />;
}
