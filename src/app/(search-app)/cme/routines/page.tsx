import type { Metadata } from "next";

import { CmeRoutinesRoute } from "@/components/cme/cme-routines-route";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";

export const metadata: Metadata = {
  title: "Routines | CME | PsychSift",
  description: "The activities you do every month or term, and when each is next due.",
};

export default async function CmeRoutinesPageRoute() {
  const data = await loadCmePageData();
  return <CmeRoutinesRoute nowIso={data.now.toISOString()} />;
}
