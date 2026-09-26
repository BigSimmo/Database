import type { Metadata } from "next";

import { CmeCalendarPage } from "@/components/cme/cme-calendar-page";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";

export const metadata: Metadata = {
  title: "Calendar | CPD | PsychSift",
  description: "What you logged, when your routines come round, and the dates that close the CPD year.",
};

export default async function CmeCalendarRoute({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
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
  return (
    <CmeCalendarPage set={data.set} entries={data.entries} routines={data.routines} nowIso={data.now.toISOString()} />
  );
}
