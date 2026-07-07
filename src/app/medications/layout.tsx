import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function MedicationsLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="prescribing" desktopSearchPlacement="hero">
      {children}
    </GlobalSearchShell>
  );
}
