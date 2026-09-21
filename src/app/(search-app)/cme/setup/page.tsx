import type { Metadata } from "next";

import { CmeSetupPage } from "@/components/cme/cme-setup-page";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";
import type { CmeRequirementSet } from "@/lib/cme/types";

export const metadata: Metadata = {
  title: "Set up | CME | PsychSift",
  description: "Four things to set up once, then the mode runs itself.",
};

function placeholderSet(year: number): CmeRequirementSet {
  return { year, confirmedOn: "", confirmedSource: "", totalHours: 0, requirements: [] };
}

export default async function CmeSetupRoute() {
  const data = await loadCmePageData();
  return <CmeSetupPage set={data.set ?? placeholderSet(data.year)} />;
}
