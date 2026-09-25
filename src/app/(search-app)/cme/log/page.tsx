import type { Metadata } from "next";

import { CmeLogPage } from "@/components/cme/cme-log-page";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { cpdYearOf } from "@/lib/cme/cpd-year";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";
import type { CmeRequirementSet } from "@/lib/cme/types";

export const metadata: Metadata = {
  title: "Log | CME | PsychSift",
  description: "Every continuing-education activity you have recorded, by year.",
};

/** Skeletal set so the log can still render year tabs before targets are confirmed. */
function placeholderSet(year: number): CmeRequirementSet {
  return { year, confirmedOn: "", confirmedSource: "", totalHours: 0, requirements: [] };
}

export default async function CmeLogRoute({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const requestedYear = query.year ? Number(query.year) : undefined;
  const data = await loadCmePageData(
    Number.isInteger(requestedYear) && requestedYear! >= 2000 && requestedYear! <= 2100 ? requestedYear : undefined,
    { includeArchived: true },
  );
  if (data.state === "signed-out" || data.state === "unavailable") {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <CmeStateNotice state={data.state} year={data.year} />
      </main>
    );
  }
  const currentYear = cpdYearOf(data.now);
  return (
    <CmeLogPage
      entries={data.entries}
      set={data.set ?? placeholderSet(data.year)}
      navigationYears={[currentYear, currentYear - 1, data.year]}
      justSaved={query.saved === "1"}
      demoMode={data.demoMode}
    />
  );
}
