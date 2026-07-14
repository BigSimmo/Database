import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function FormulationLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="formulation" desktopSearchPlacement="hero">
      {children}
    </GlobalSearchShell>
  );
}
