import type { Metadata } from "next";
import { TeachingFeedback } from "@/components/teaching/teaching-feedback";
import { isDemoMode } from "@/lib/env";
export const metadata: Metadata = { title: "Feedback | Teaching | PsychSift", robots: { index: false, follow: false } };
export default function Page() {
  return <TeachingFeedback demoMode={isDemoMode()} />;
}
