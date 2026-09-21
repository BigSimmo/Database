import type { Metadata } from "next";

import { CmeLogPage } from "@/components/cme/cme-log-page";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";
import type { CmeRequirementSet } from "@/lib/cme/types";

export const metadata: Metadata = {
  title: "Log | CME | PsychSift",
  description: "Every continuing-education activity you have recorded, by year.",
};

/** Skeletal set so the log can still render year tabs before targets are confirmed. */
function placeholderSet(year: number): CmeRequirementSet {
  return { year, confirmedOn: "", confirmedSource: "", totalHours: 0, requirements: [] };
}

export default async function CmeLogRoute() {
  const data = await loadCmePageData();
  return <CmeLogPage entries={data.entries} set={data.set ?? placeholderSet(data.year)} />;
}
