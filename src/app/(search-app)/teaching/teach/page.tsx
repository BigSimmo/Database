import type { Metadata } from "next";
import { TeachingTeach } from "@/components/teaching/teaching-teach";
import { isDemoMode } from "@/lib/env";
export const metadata: Metadata = { title: "Teach | Teaching | PsychSift", robots: { index: false, follow: false } };
export default function Page() {
  return <TeachingTeach demoMode={isDemoMode()} />;
}
