import type { Metadata } from "next";

import { TeachingCheckinScreen } from "@/components/teaching/teaching-checkin";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = {
  title: "Check-in code | Teaching | PsychSift",
  robots: { index: false, follow: false },
};

type TeachingCheckinRouteProps = { params: Promise<{ id: string }> };

export default async function TeachingCheckinRoute({ params }: TeachingCheckinRouteProps) {
  const { id } = await params;
  return <TeachingCheckinScreen occurrenceId={id} demoMode={isDemoMode()} />;
}
