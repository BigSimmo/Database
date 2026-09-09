import type { Metadata } from "next";

import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";

export const metadata: Metadata = {
  title: "Statistics — Ward Flow",
  description: "Synthetic coordinator statistics view for the Ward Flow prototype.",
};

/**
 * The route that makes the coordinator statistics screen reachable. It has no params and supplies
 * nothing.
 *
 * ⚠️ **It must never pass `admissions`, `referrals`, `bedReleases` or `movements`.**
 * `StatisticsScreen` accepts all four as optional overrides so a test can render populations the
 * seed cannot produce, and all four fall back to `useWardFlow()`. A route that passed any of them
 * would pin the page to a fixture and quietly override live state — and on THIS page that would
 * mean publishing a figure computed from something other than the world the rest of the prototype
 * is showing.
 *
 * There is no role gate here, and the screen says so on itself rather than implying one exists.
 */
export default function WardStatisticsPage() {
  return <StatisticsScreen />;
}
