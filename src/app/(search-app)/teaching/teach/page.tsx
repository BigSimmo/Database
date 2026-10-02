import type { Metadata } from "next";
import { TeachingTeach } from "@/components/teaching/teaching-teach";
import { teachingDemoMode } from "@/lib/teaching/sample";
export const metadata: Metadata = { title: "Teach | Teaching | PsychSift", robots: { index: false, follow: false } };
export default async function Page() {
  return <TeachingTeach demoMode={await teachingDemoMode()} />;
}
