import type { Metadata } from "next";

import { CmeRoutinesRoute } from "@/components/cme/cme-routines-route";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";

export const metadata: Metadata = {
  title: "Routines | CME | PsychSift",
  description: "The activities you do every month or term, and when each is next due.",
};

export default async function CmeRoutinesPageRoute() {
  const data = await loadCmePageData();
  if (data.state === "signed-out" || data.state === "unavailable") {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <CmeStateNotice state={data.state} year={data.year} />
      </main>
    );
  }
  return <CmeRoutinesRoute nowIso={data.now.toISOString()} initialRoutines={data.routines} demoMode={data.demoMode} />;
}
