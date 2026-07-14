import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function SpecifiersLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="specifiers" desktopSearchPlacement="hero">
      {children}
    </GlobalSearchShell>
  );
}
