import type { Metadata } from "next";
import { TeachingCpdReview } from "@/components/teaching/teaching-cpd-review";
import { isDemoMode } from "@/lib/env";
export const metadata: Metadata = { title: "Weekly CPD review | Teaching | PsychSift", robots: { index: false, follow: false } };
export default function Page() { return <TeachingCpdReview demoMode={isDemoMode()} />; }
