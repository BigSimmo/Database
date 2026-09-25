import type { Metadata } from "next";

import { CmePlanPage } from "@/components/cme/cme-plan-page";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";

export const metadata: Metadata = {
  title: "Development plan | CME | PsychSift",
  description: "Your yearly development plan: your goals, and how the year's hours fall across them.",
};

export default async function CmePlanRoute({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
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
  return <CmePlanPage set={data.set} goals={data.goals} entries={data.entries} demoMode={data.demoMode} />;
}
