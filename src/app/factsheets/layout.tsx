import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function FactsheetsLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="factsheets" desktopSearchPlacement="hero">
      {children}
    </GlobalSearchShell>
  );
}
