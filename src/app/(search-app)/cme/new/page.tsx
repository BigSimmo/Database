import { parseCmeLearningPrefill } from "@/lib/cme/learning-source";
import type { Metadata } from "next";

import { CmeNewEntryRoute } from "@/components/cme/cme-new-entry-route";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";

export const metadata: Metadata = {
  title: "Log an activity | CME | PsychSift",
  description: "Record one continuing-education activity, its hours, and how they split across categories.",
};

export default async function CmeNewEntryPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string; year?: string; title?: string; sourceUrl?: string }>;
}) {
  const query = await searchParams;
  const requestedYear = query.year ? Number(query.year) : undefined;
  const data = await loadCmePageData(
    Number.isInteger(requestedYear) && requestedYear! >= 2000 && requestedYear! <= 2100 ? requestedYear : undefined,
  );
  if (data.state !== "ready") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <CmeStateNotice state={data.state} year={data.year} />
      </main>
    );
  }
  const learningPrefill = parseCmeLearningPrefill(query);
  const routine = data.routines.find((candidate) => candidate.id === query.routine) ?? null;
  return (
    <CmeNewEntryRoute
      key={`${data.year}:${routine?.id ?? "manual"}:${learningPrefill.title ?? ""}:${learningPrefill.sourceUrl ?? ""}`}
      routine={routine}
      learningPrefill={learningPrefill}
      set={data.set}
      demoMode={data.demoMode}
    />
  );
}
