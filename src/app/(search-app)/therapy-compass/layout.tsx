import { Suspense } from "react";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";
import { TherapyCompassRouteLayout } from "@/components/therapy-compass/therapy-compass-route-layout";
import { isAppModeVisible } from "@/lib/app-modes";

// Therapy-only state belongs at the deepest shared route segment. Keeping this
// provider out of the global search shell prevents every other mode from
// downloading Therapy's client graph, while the client boundary can still read
// current pathname/search params on each navigation.
export default function TherapyCompassLayout({ children }: { children: ReactNode }) {
  const offlineReviewBuild = process.env.PLAYWRIGHT_OFFLINE_MODE === "true";
  if (
    process.env.NODE_ENV === "production" &&
    !offlineReviewBuild &&
    !isAppModeVisible("therapy-compass", "production")
  ) {
    notFound();
  }

  return (
    <Suspense fallback={<ModeHomeRouteLoading />}>
      <TherapyCompassRouteLayout>{children}</TherapyCompassRouteLayout>
    </Suspense>
  );
}
