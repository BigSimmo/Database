import { Suspense, type ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";
import { TherapyCompassWorkspace } from "@/components/therapy-compass";

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
      <Suspense fallback={null}>
        <TherapyCompassWorkspace>{children}</TherapyCompassWorkspace>
      </Suspense>
    </GlobalSearchShell>
  );
}
