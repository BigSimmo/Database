import type { Metadata } from "next";

import { TeachingToday } from "@/components/teaching/teaching-today";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = {
  title: "Teaching | PsychSift",
  description: "Your hospital's teaching: the next session, check-in, and what needs you.",
};

/* Like My Work and CPD it declares no search surface, so it renders its own body. Demo mode is read on the server. */
export default function TeachingTodayRoute() {
  return <TeachingToday demoMode={isDemoMode()} />;
}
