import type { Metadata } from "next";
import { connection } from "next/server";

import { CmeLearningPage } from "@/components/cme/cme-learning-page";
import { loadLearningDirectory } from "@/lib/cme/learning-directory";

export const metadata: Metadata = {
  title: "Learning | CPD | PsychSift",
  description: "Upcoming Western Australian courses and events for psychiatrists, curated and checked monthly.",
};

export default async function CmeLearningRoute() {
  // Render per request, not at build time: past events drop off by today's
  // Perth date, which a prerendered page would freeze at the last deploy.
  await connection();
  const directory = loadLearningDirectory();
  return (
    <CmeLearningPage
      items={directory.items}
      lastCheckedOn={directory.lastCheckedOn}
      nowIso={new Date().toISOString()}
    />
  );
}
