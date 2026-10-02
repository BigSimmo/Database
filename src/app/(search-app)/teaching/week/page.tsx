import type { Metadata } from "next";

import { TeachingWeekWithPanel } from "@/components/teaching/teaching-week-panel";
import { teachingDemoMode } from "@/lib/teaching/sample";

export const metadata: Metadata = {
  title: "Week | Teaching | PsychSift",
  description: "This week's teaching, day by day, with the sessions you present and your On Call teaching list.",
};

/* Demo mode is read on the server. On a wide screen a tapped session opens beside the list (U4 Step 9). */
export default async function TeachingWeekRoute() {
  return <TeachingWeekWithPanel demoMode={await teachingDemoMode()} />;
}
