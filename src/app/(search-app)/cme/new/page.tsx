import type { Metadata } from "next";

import { CmeNewEntryRoute } from "@/components/cme/cme-new-entry-route";

export const metadata: Metadata = {
  title: "Log an activity | CME | PsychSift",
  description: "Record one continuing-education activity, its hours, and how they split across categories.",
};

export default function CmeNewEntryPageRoute() {
  return <CmeNewEntryRoute />;
}
