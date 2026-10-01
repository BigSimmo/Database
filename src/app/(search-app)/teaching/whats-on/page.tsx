import type { Metadata } from "next";

import { TeachingWhatsOn } from "@/components/teaching/teaching-whats-on";
import { teachingDemoMode } from "@/lib/teaching/sample";

export const metadata: Metadata = {
  title: "What's on | Teaching | PsychSift",
  description: "Teaching open to your health service this week, with what is on now.",
  robots: { index: false, follow: false },
};

/* Demo mode is read on the server; the server itself decides which sessions the reader sees. */
export default async function TeachingWhatsOnRoute() {
  return <TeachingWhatsOn demoMode={await teachingDemoMode()} />;
}
