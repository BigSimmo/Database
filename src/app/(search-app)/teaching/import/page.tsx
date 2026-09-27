import type { Metadata } from "next";
import { TeachingImport } from "@/components/teaching/teaching-import";
import { isDemoMode } from "@/lib/env";
export const metadata: Metadata = { title: "Import a timetable | Teaching | PsychSift", robots: { index: false, follow: false } };
export default function Page() { return <TeachingImport demoMode={isDemoMode()} />; }
