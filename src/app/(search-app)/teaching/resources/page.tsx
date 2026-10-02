import type { Metadata } from "next";

import { TeachingResources } from "@/components/teaching/teaching-resources";
import { demoTeachingResources } from "@/lib/teaching/demo-resources";
import type { ResourcesForWeek } from "@/lib/teaching/model";
import { mondayOf, perthDateKey } from "@/components/teaching/teaching-dates";
import { teachingDemoMode, teachingSampleOn } from "@/lib/teaching/sample";

export const metadata: Metadata = {
  title: "Resources | Teaching | PsychSift",
  description: "Your service's teaching materials as links: this week's, collections, recordings and saved items.",
  robots: { index: false, follow: false },
};

/* Demo mode is read on the server; in the demo the page still reads, and the server serves made-up links. */
export default async function TeachingResourcesRoute() {
  const now = new Date();
  const sampleData = (await teachingSampleOn())
    ? (demoTeachingResources(
        { action: "resources.read", weekStart: mondayOf(perthDateKey(now)) },
        now,
      ) as ResourcesForWeek)
    : undefined;
  return <TeachingResources demoMode={await teachingDemoMode()} sampleData={sampleData} />;
}
