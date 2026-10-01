import type { Metadata } from "next";

import { TeachingResources } from "@/components/teaching/teaching-resources";
import { teachingDemoMode } from "@/lib/teaching/sample";

export const metadata: Metadata = {
  title: "Resources | Teaching | PsychSift",
  description: "Your service's teaching materials as links: this week's, collections, recordings and saved items.",
  robots: { index: false, follow: false },
};

/* Demo mode is read on the server; in the demo the page still reads, and the server serves made-up links. */
export default async function TeachingResourcesRoute() {
  return <TeachingResources demoMode={await teachingDemoMode()} />;
}
