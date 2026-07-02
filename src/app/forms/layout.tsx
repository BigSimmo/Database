import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function FormsLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="forms" availableModeIds={["forms"]} desktopSearchPlacement="hero">
      {children}
    </GlobalSearchShell>
  );
}
