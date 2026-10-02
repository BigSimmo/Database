import type { Metadata } from "next";
import { TeachingImport } from "@/components/teaching/teaching-import";
import { teachingDemoMode } from "@/lib/teaching/sample";
export const metadata: Metadata = {
  title: "Import a timetable | Teaching | PsychSift",
  robots: { index: false, follow: false },
};
export default async function Page() {
  return <TeachingImport demoMode={await teachingDemoMode()} />;
}
