import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function ApplicationsLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="tools" desktopSearchPlacement="hero">
      {children}
    </GlobalSearchShell>
  );
}
