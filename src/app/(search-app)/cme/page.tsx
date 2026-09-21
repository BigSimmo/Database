import type { Metadata } from "next";

import { CmeDashboardRoute } from "@/components/cme/cme-dashboard-route";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";
import type { CmeRequirementSet } from "@/lib/cme/types";

export const metadata: Metadata = {
  title: "CME | PsychSift",
  description: "What you have done this year, and what is still short.",
};

function placeholderSet(year: number): CmeRequirementSet {
  return { year, confirmedOn: "", confirmedSource: "", totalHours: 0, requirements: [] };
}

/**
 * The CME mode home: a dashboard, not a redirect stub.
 *
 * `/cme` renders a body rather than forwarding to the shared home at
 * `/?mode=cme`, for On Call's reason exactly — the shared home is a search
 * home, and this mode declares no search surface (`resultsSurface: "none"`), so
 * a redirect would send the reader to the one page a composer could reach them
 * on and then ignore whatever they typed.
 */
export default async function CmeHomeRoute() {
  const data = await loadCmePageData();
  return (
    <CmeDashboardRoute
      set={data.set ?? placeholderSet(data.year)}
      entries={data.entries}
      nowIso={data.now.toISOString()}
    />
  );
}
