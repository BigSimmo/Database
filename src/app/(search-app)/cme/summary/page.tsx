import type { Metadata } from "next";
import Link from "next/link";
import { CmeAnnualSummary } from "@/components/cme/cme-annual-summary";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";
export const metadata: Metadata = {
  title: "Annual summary | CME | PsychSift",
  description: "A printable record of one CPD year: hours against each target and every activity logged.",
};
export default async function CmeAnnualSummaryRoute({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const query = await searchParams;
  const year = Number(query.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p>Choose a valid year from your CME log.</p>
        <Link
          href="/cme/log"
          className="mt-2 inline-flex min-h-tap items-center text-sm font-semibold text-[color:var(--clinical-accent)]"
        >
          Open the CME log
        </Link>
      </main>
    );
  const data = await loadCmePageData(year);
  if (data.state !== "ready" || !data.set)
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <CmeStateNotice state={data.state === "ready" ? "unavailable" : data.state} year={data.year} />
      </main>
    );
  return <CmeAnnualSummary set={data.set} entries={data.entries} demoMode={data.demoMode} />;
}
