import type { Metadata } from "next";

import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";

export const metadata: Metadata = {
  title: "Ward and ED comparisons — Ward Flow",
  description: "Synthetic ward and emergency department comparison section for the Ward Flow prototype.",
};

/**
 * The route that makes the comparisons section reachable, and with it the only chooser that reaches
 * the per-unit detail pages.
 *
 * ⚠️ **It must never pass `units` or `emergencyDepartments`.** The screen accepts both as optional
 * overrides so a test can render a network the seed cannot produce, and both fall back to live
 * state. A route that passed either would pin the chooser to a fixture, and a ward added to the
 * prototype would then be missing from the only list that links to its statistics page.
 */
export default function WardStatisticsComparePage() {
  return <StatisticsCompareScreen />;
}
