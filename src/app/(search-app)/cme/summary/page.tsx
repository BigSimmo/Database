import type { Metadata } from "next";
import Link from "next/link";
import { CmeAnnualSummary } from "@/components/cme/cme-annual-summary";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";
export const metadata: Metadata = {
  title: "Annual summary | CPD | PsychSift",
  description: "A printable record of one CPD year: hours against each target and every activity logged.",
};
/**
 * `/cme/summary` with no `?year=` opens the current CPD year: `loadCmePageData(undefined)` picks
 * today's Perth year (`cpdYearOf`), or the demo year in demo mode. A year that is given but is
 * not a real year still gets the plain message, so an explicit address never opens another year. A repeated
 * `?year=` uses the first one.
 */
export default async function CmeAnnualSummaryRoute({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[] }>;
}) {
  const query = await searchParams;
  // `?year=2025&year=2026` arrives as an array; read the first rather than fail.
  const raw = Array.isArray(query.year) ? query.year[0] : query.year;
  const requested = raw?.trim();
  const year = requested ? Number(requested) : undefined;
  if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100))
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p>Choose a valid year from your CPD log.</p>
        <Link
          href="/cme/log"
          className="mt-2 inline-flex min-h-tap items-center text-sm font-semibold text-[color:var(--clinical-accent)]"
        >
          Open the CPD log
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
  return (
    <CmeAnnualSummary
      set={data.set}
      entries={data.entries}
      demoMode={data.demoMode}
      close={data.close}
      now={data.now}
    />
  );
}
