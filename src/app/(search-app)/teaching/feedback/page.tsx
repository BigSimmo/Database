import type { Metadata } from "next";
import { TeachingFeedback } from "@/components/teaching/teaching-feedback";
import { teachingDemoMode } from "@/lib/teaching/sample";
export const metadata: Metadata = { title: "Feedback | Teaching | PsychSift", robots: { index: false, follow: false } };
export default async function Page() {
  return <TeachingFeedback demoMode={await teachingDemoMode()} />;
}
