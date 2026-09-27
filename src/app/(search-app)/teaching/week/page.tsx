import type { Metadata } from "next";

import { TeachingWeekScreen } from "@/components/teaching/teaching-week";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = {
  title: "Week | Teaching | PsychSift",
  description: "This week's teaching, day by day, with the sessions you present and your On Call teaching list.",
};

/* Demo mode is read on the server. U4 Step 9 adds the wide-screen side panel here. */
export default function TeachingWeekRoute() {
  return <TeachingWeekScreen demoMode={isDemoMode()} />;
}
