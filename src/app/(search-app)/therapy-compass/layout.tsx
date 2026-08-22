import { Suspense } from "react";
import type { ReactNode } from "react";

import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";
import { TherapyCompassRouteLayout } from "@/components/therapy-compass/therapy-compass-route-layout";

// Therapy-only state belongs at the deepest shared route segment. Keeping this
// provider out of the global search shell prevents every other mode from
// downloading Therapy's client graph, while the client boundary can still read
// current pathname/search params on each navigation.
//
// This segment previously returned a not-found response in production, because
// Therapy was a dev-only mode while its catalogue awaited qualified-clinician
// sign-off. That gate is gone: the review state is now disclosed on the library
// notice and on every record instead of removing the mode, so this layout has no
// environment branch at all. See `src/lib/therapies.ts` and the contracts in
// tests/therapy-review-regressions.test.ts, which assert the gate stays absent
// by scanning this file — keep the prose here free of the literal call.
export default function TherapyCompassLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ModeHomeRouteLoading />}>
      <TherapyCompassRouteLayout>{children}</TherapyCompassRouteLayout>
    </Suspense>
  );
}
