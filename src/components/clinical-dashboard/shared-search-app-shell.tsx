"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";
import { TherapyCompassWorkspace } from "@/components/therapy-compass";
import { searchShellPropsForPathname } from "@/lib/search-shell-props";

/**
 * Owns one GlobalSearchShell across mode homes so navigating between
 * /services, /dsm, /, etc. does not remount the shared composer chrome.
 */
export function SharedSearchAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const shellProps = searchShellPropsForPathname(pathname);
  const content = pathname.startsWith("/therapy-compass") ? (
    <Suspense fallback={null}>
      <TherapyCompassWorkspace>{children}</TherapyCompassWorkspace>
    </Suspense>
  ) : (
    children
  );

  return <GlobalSearchShell {...shellProps}>{content}</GlobalSearchShell>;
}
