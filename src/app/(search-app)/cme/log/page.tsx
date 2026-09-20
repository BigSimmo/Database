import type { Metadata } from "next";

import { CmeLogPage } from "@/components/cme/cme-log-page";

export const metadata: Metadata = {
  title: "Log | CME | PsychSift",
  description: "Every continuing-education activity you have recorded, by year.",
};

export default function CmeLogRoute() {
  return <CmeLogPage />;
}
