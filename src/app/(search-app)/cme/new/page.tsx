import { parseCmeLearningPrefill } from "@/lib/cme/learning-source";
import type { Metadata } from "next";

import { CmeNewEntryRoute } from "@/components/cme/cme-new-entry-route";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";

export const metadata: Metadata = {
  title: "Log an activity | CPD | PsychSift",
  description: "Record one continuing-education activity, its hours, and how they split across categories.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CmeNewEntryPageRoute({
  searchParams,
}: {
  searchParams: Promise<{
    routine?: string;
    year?: string;
    title?: string;
    sourceUrl?: string;
    repeat?: string;
    draft?: string;
    missed?: string;
  }>;
}) {
  const query = await searchParams;
  const requestedYear = query.year ? Number(query.year) : undefined;
  const draftId = query.draft && UUID.test(query.draft) ? query.draft : undefined;
  const data = await loadCmePageData(
    Number.isInteger(requestedYear) && requestedYear! >= 2000 && requestedYear! <= 2100 ? requestedYear : undefined,
    { draftId },
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
  // Only an entry already loaded for this owner and year can be copied, so a
  // guessed id copies nothing rather than reaching another record.
  const repeatOf = query.repeat ? (data.entries.find((candidate) => candidate.id === query.repeat) ?? null) : null;
  // The draft is read with this owner's id, so a guessed id opens an empty form, not a record.
  // The missed session is linked by the save, which is owner-scoped the same way.
  const missedSessionId = query.missed && UUID.test(query.missed) ? query.missed : null;
  return (
    <CmeNewEntryRoute
      key={`${data.year}:${routine?.id ?? "manual"}:${repeatOf?.id ?? ""}:${learningPrefill.title ?? ""}:${learningPrefill.sourceUrl ?? ""}:${data.draft?.id ?? ""}:${missedSessionId ?? ""}`}
      resumeDraft={data.draft}
      missedSessionId={missedSessionId}
      routine={routine}
      repeatOf={repeatOf}
      learningPrefill={learningPrefill}
      set={data.set}
      demoMode={data.demoMode}
    />
  );
}
