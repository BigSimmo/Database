"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { GlobalMockupSearchShell } from "@/components/clinical-dashboard/global-mockup-search-shell";

export function MockupsLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isToolsPageMockup = pathname.startsWith("/mockups/tools-");

  return (
    <GlobalMockupSearchShell
      initialMode={isToolsPageMockup ? "tools" : "answer"}
      searchComposerVisible={!isToolsPageMockup}
    >
      {children}
    </GlobalMockupSearchShell>
  );
}
