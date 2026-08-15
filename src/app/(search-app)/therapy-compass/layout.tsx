import { Suspense } from "react";
import type { ReactNode } from "react";

import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";
import { TherapyCompassRouteLayout } from "@/components/therapy-compass/therapy-compass-route-layout";

// Therapy-only state belongs at the deepest shared route segment. Keeping this
// provider out of the global search shell prevents every other mode from
// downloading Therapy's client graph, while the client boundary can still read
// current pathname/search params on each navigation.
export default function TherapyCompassLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ModeHomeRouteLoading />}>
      <TherapyCompassRouteLayout>{children}</TherapyCompassRouteLayout>
    </Suspense>
  );
}
