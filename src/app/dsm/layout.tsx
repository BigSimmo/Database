import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function DsmLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="dsm" desktopSearchPlacement="hero">
      {children}
    </GlobalSearchShell>
  );
}
