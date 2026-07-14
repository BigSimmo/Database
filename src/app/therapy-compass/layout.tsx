import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

// Therapy Compass keeps the universal header + rail but provides its own primary
// search surface (the in-tool therapy search), so the shared search composer is
// suppressed here — mirroring how the mockup mounted it.
export default function TherapyCompassLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="therapy-compass" searchComposerVisible={false}>
      {children}
    </GlobalSearchShell>
  );
}
