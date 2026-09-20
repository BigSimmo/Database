import type { Metadata } from "next";

import { CmeRoutinesRoute } from "@/components/cme/cme-routines-route";

export const metadata: Metadata = {
  title: "Routines | CME | PsychSift",
  description: "The activities you do every month or term, and when each is next due.",
};

export default function CmeRoutinesPageRoute() {
  return <CmeRoutinesRoute />;
}
