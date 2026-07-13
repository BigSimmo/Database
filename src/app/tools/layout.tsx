import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="tools" desktopSearchPlacement="hero">
      {children}
    </GlobalSearchShell>
  );
}
