import type { Metadata } from "next";

import { CmeEntryRouteClient } from "@/components/cme/cme-entry-route-client";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";
import type { CmeRequirementSet } from "@/lib/cme/types";

type CmeEntryRouteProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Entry | CME | PsychSift",
  description: "One recorded activity: its hours, the categories they count toward, and your reflection.",
};

function placeholderSet(year: number): CmeRequirementSet {
  return { year, confirmedOn: "", confirmedSource: "", totalHours: 0, requirements: [] };
}

export default async function CmeEntryRoute({ params }: CmeEntryRouteProps) {
  const { id } = await params;
  const data = await loadCmePageData();
  return (
    <CmeEntryRouteClient
      entryId={id}
      entries={data.entries}
      set={data.set ?? placeholderSet(data.year)}
      persistTranscribed={!data.demoMode}
    />
  );
}
