import { Suspense, type ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";
import dynamic from "next/dynamic";

const TherapyCompassWorkspace = dynamic(
  () => import("@/components/therapy-compass").then((m) => m.TherapyCompassWorkspace),
  {
    ssr: false,
    loading: () => <div className="animate-pulse h-96 bg-neutral-100 rounded-lg dark:bg-neutral-800" />,
  }
);
import "@/components/therapy-compass/therapy-compass.css";

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
