import type { Metadata } from "next";

import { TeachingLogbook } from "@/components/teaching/teaching-logbook";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = {
  title: "Logbook | Teaching | PsychSift",
  description: "Your teaching attendance, hours and what is not yet in CPD.",
};

/* Demo mode is read on the server. */
export default function TeachingLogbookRoute() {
  return <TeachingLogbook demoMode={isDemoMode()} />;
}
