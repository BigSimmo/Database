"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export function DocumentsLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDocumentSearchRoute = pathname === "/documents/search";
  const documentViewerOwnsMobileChrome =
    pathname.startsWith("/documents/") && pathname !== "/documents/search";
  const documentFlowOwnsMobileChrome =
    pathname.startsWith("/documents/source") || documentViewerOwnsMobileChrome;

  return (
    <GlobalSearchShell
      initialMode="documents"
      searchComposerVisible={isDocumentSearchRoute}
      mobileChromeVisible={!documentFlowOwnsMobileChrome}
    >
      {children}
    </GlobalSearchShell>
  );
}
