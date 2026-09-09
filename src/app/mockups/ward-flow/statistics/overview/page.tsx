import type { Metadata } from "next";

import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";

export const metadata: Metadata = {
  title: "Statistics across all services — Ward Flow",
  description: "Synthetic whole-of-prototype statistics section for the Ward Flow prototype.",
};

/**
 * The route that makes the across-all-services statistics section reachable. It has no params and
 * supplies nothing: the screen reads its own name and description from `statistics-sections.ts`,
 * the one module the hub index reads too.
 */
export default function WardStatisticsOverviewPage() {
  return <StatisticsOverviewScreen />;
}
