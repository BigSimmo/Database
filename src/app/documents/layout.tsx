import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="documents" searchComposerVisible={false}>
      {children}
    </GlobalSearchShell>
  );
}
