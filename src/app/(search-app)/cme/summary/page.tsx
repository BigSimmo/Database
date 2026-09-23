import type { Metadata } from "next";
import { CmeAnnualSummary } from "@/components/cme/cme-annual-summary";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";
export const metadata: Metadata = { title: "Annual summary | CME | PsychSift" };
export default async function CmeAnnualSummaryRoute({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const query = await searchParams;
  const year = Number(query.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    return <main className="p-6">Choose a valid year from your CME log.</main>;
  const data = await loadCmePageData(year);
  if (data.state !== "ready" || !data.set)
    return (
      <main className="p-6">
        <CmeStateNotice state={data.state === "ready" ? "unavailable" : data.state} year={data.year} />
      </main>
    );
  return <CmeAnnualSummary set={data.set} entries={data.entries} demoMode={data.demoMode} />;
}
