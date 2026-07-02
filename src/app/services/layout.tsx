import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function ServicesLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="services" availableModeIds={["services"]} desktopSearchPlacement="hero">
      {children}
    </GlobalSearchShell>
  );
}
