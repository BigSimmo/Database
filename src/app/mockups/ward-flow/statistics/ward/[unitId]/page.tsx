import type { Metadata } from "next";

import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";

export const metadata: Metadata = {
  title: "Ward statistics — Ward Flow",
  description: "Synthetic single-ward statistics section for the Ward Flow prototype.",
};

/**
 * One route serving every ward, not a page per ward.
 *
 * `params` is a Promise in this version of Next and is awaited here; `decodeURIComponent` undoes
 * the encoding `wardStatisticsHref` applies on the way out, so the pair stays symmetric. An id that
 * resolves to no ward is the screen's own honest not-found state — never a redirect to a different
 * ward, and never an empty page that reads as a ward with nothing to show.
 *
 * ⚠️ **It must never pass `units`.** The screen's override exists for tests; the route takes the
 * live network, so a ward resolves as it is rather than as it was seeded.
 */
export default async function WardStatisticsUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  return <StatisticsWardScreen unitId={decodeURIComponent(unitId)} />;
}
