import type { Metadata } from "next";

import { TeachingWhatsOn } from "@/components/teaching/teaching-whats-on";
import { demoWhatsOnSessions } from "@/lib/teaching/demo-programme";
import type { WhatsOnRead } from "@/lib/teaching/model";
import { addDays, mondayOf, perthDateKey } from "@/components/teaching/teaching-dates";
import { teachingDemoMode, teachingSampleOn } from "@/lib/teaching/sample";

export const metadata: Metadata = {
  title: "What's on | Teaching | PsychSift",
  description: "Teaching open to your health service this week, with what is on now.",
  robots: { index: false, follow: false },
};

/* Demo mode is read on the server; the server itself decides which sessions the reader sees. */
export default async function TeachingWhatsOnRoute() {
  const now = new Date();
  const monday = mondayOf(perthDateKey(now));
  const sampleData: WhatsOnRead | undefined = (await teachingSampleOn())
    ? { healthServices: ["demo"], sessions: demoWhatsOnSessions({ from: monday, to: addDays(monday, 6) }, now) }
    : undefined;
  return <TeachingWhatsOn demoMode={await teachingDemoMode()} sampleData={sampleData} />;
}
