import type { Metadata } from "next";
import { TeachingSupervision } from "@/components/teaching/teaching-supervision";
import { isDemoMode } from "@/lib/env";
export const metadata: Metadata = { title: "Supervision | Teaching | PsychSift", robots: { index: false, follow: false } };
export default function Page() { return <TeachingSupervision demoMode={isDemoMode()} />; }
