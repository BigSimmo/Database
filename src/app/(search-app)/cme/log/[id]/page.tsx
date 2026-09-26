import type { Metadata } from "next";

import { CmeEntryRouteClient } from "@/components/cme/cme-entry-route-client";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { loadCmeEntryPageData } from "@/lib/cme/load-cme-page-data";
import type { CmeRequirementSet } from "@/lib/cme/types";

type CmeEntryRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export const metadata: Metadata = {
  title: "Entry | CPD | PsychSift",
  description: "One recorded activity: its hours, the categories they count toward, and your reflection.",
};

function placeholderSet(year: number): CmeRequirementSet {
  return { year, confirmedOn: "", confirmedSource: "", totalHours: 0, requirements: [] };
}

export default async function CmeEntryRoute({ params, searchParams }: CmeEntryRouteProps) {
  const { id } = await params;
  const query = await searchParams;
  const data = await loadCmeEntryPageData(id);
  if (data.state === "signed-out" || data.state === "unavailable") {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <CmeStateNotice state={data.state} year={data.year} />
      </main>
    );
  }
  return (
    <CmeEntryRouteClient
      entry={data.entry}
      set={data.set ?? placeholderSet(data.year)}
      edit={query.edit === "1"}
      demoMode={data.demoMode}
      goals={data.goals}
    />
  );
}
