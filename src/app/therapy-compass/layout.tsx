import { Suspense, type ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";
import { TherapyCompassWorkspace } from "@/components/therapy-compass";
import { Skeleton, searchPageShell, searchPageContainer } from "@/components/ui-primitives";
import "@/components/therapy-compass/therapy-compass.css";

function TherapyCompassSkeleton() {
  return (
    <div className={searchPageShell} role="status" aria-label="Loading therapy compass">
      <div className={searchPageContainer}>
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-10 w-1/3 max-w-sm" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-6 md:grid-cols-[1fr_300px]">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading therapy compass</span>
    </div>
  );
}

// Therapy Compass uses the same universal header, rail, and responsive search
// composer as the other mode homes. The workspace is mounted at the layout level
// so the therapy dataset and interaction state are shared across every
// /therapy-compass/* route, while each route renders its own screen into the
// workspace's main content.
export default function TherapyCompassLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="therapy-compass">
      {/* The workspace provider reads useSearchParams; an explicit boundary lets the
          route family prerender on its own, independent of the shell's Suspense. */}
      <Suspense fallback={<TherapyCompassSkeleton />}>
        <TherapyCompassWorkspace>{children}</TherapyCompassWorkspace>
      </Suspense>
    </GlobalSearchShell>
  );
}
