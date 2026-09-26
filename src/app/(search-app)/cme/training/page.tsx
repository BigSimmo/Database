import type { Metadata } from "next";

import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { CmeTrainingPage } from "@/components/cme/cme-training-page";
import { cpdYearOf } from "@/lib/cme/cpd-year";
import { loadCmeTrainingPageData } from "@/lib/cme/training-page-data";

export const metadata: Metadata = {
  title: "Training | CPD | PsychSift",
  description:
    "Your own record of your training: stages, rotations and breaks, where you are now, and the next milestone due.",
};

export default async function CmeTrainingRoute() {
  const data = await loadCmeTrainingPageData();
  if (data.state !== "ready") {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <CmeStateNotice state={data.state} year={cpdYearOf(data.now)} />
      </main>
    );
  }
  return (
    <CmeTrainingPage
      nowIso={data.now.toISOString()}
      initialPeriods={data.periods}
      initialMilestones={data.milestones}
      demoMode={data.demoMode}
    />
  );
}
