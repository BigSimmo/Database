import type { Metadata } from "next";

import { TeachingSessionScreen } from "@/components/teaching/teaching-session";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = { title: "Session | Teaching | PsychSift", robots: { index: false, follow: false } };

type TeachingSessionRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Today's hero links to `?check-in=scan`, which opens the scan sheet on arrival. */
export default async function TeachingSessionRoute({ params, searchParams }: TeachingSessionRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <TeachingSessionScreen
      occurrenceId={id}
      demoMode={isDemoMode()}
      initialSheet={query["check-in"] === "scan" ? "scan" : undefined}
    />
  );
}
