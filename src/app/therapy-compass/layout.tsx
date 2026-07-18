import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";
import { TherapyCompassWorkspace } from "@/components/therapy-compass";

// Therapy Compass keeps the universal header + rail but provides its own primary
// search surface (the in-tool therapy search), so the shared search composer is
// suppressed here. The workspace is mounted at the layout level so the therapy
// dataset and interaction state are shared across every /therapy-compass/* route,
// while each route renders its own screen into the workspace's main content.
export default function TherapyCompassLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="therapy-compass" searchComposerVisible={false}>
      <TherapyCompassWorkspace>{children}</TherapyCompassWorkspace>
    </GlobalSearchShell>
  );
}
