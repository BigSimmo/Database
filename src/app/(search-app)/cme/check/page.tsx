import type { Metadata } from "next";

import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { CmeYearCheckPage } from "@/components/cme/cme-year-check-page";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";

export const metadata: Metadata = {
  title: "Year check | CME | PsychSift",
  description: "Your CPD year as an audit would read it: every target, evidence, reflections and what is copied.",
};

export default async function CmeYearCheckRoute({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const query = await searchParams;
  const requestedYear = query.year ? Number(query.year) : undefined;
  const data = await loadCmePageData(
    Number.isInteger(requestedYear) && requestedYear! >= 2000 && requestedYear! <= 2100 ? requestedYear : undefined,
  );
  if (data.state !== "ready" || !data.set) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <CmeStateNotice state={data.state === "ready" ? "unavailable" : data.state} year={data.year} />
      </main>
    );
  }
  return <CmeYearCheckPage set={data.set} entries={data.entries} />;
}
