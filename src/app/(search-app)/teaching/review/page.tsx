import type { Metadata } from "next";
import { TeachingCpdReview } from "@/components/teaching/teaching-cpd-review";
import { teachingDemoMode } from "@/lib/teaching/sample";
export const metadata: Metadata = {
  title: "Weekly CPD review | Teaching | PsychSift",
  robots: { index: false, follow: false },
};
export default async function Page() {
  return <TeachingCpdReview demoMode={await teachingDemoMode()} />;
}
