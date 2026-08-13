"use client";

import dynamic from "next/dynamic";
import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";
import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";
import { searchShellPropsForPathname } from "@/lib/search-shell-props";

const TherapyCompassWorkspace = dynamic(
  () => import("@/components/therapy-compass/workspace").then((module) => module.TherapyCompassWorkspace),
  { loading: () => <ModeHomeRouteLoading /> },
);

/**
 * Owns one GlobalSearchShell across mode homes so navigating between
 * /services, /dsm, /, etc. does not remount the shared composer chrome.
 */
export function SharedSearchAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const shellProps = searchShellPropsForPathname(pathname);
  // The Therapy home is already a complete lightweight mode home. Only richer
  // child routes need the catalogue provider and Therapy navigation workspace;
  // keeping that graph off the home also keeps it off every non-Therapy route.
  const content = pathname.startsWith("/therapy-compass/") ? (
    <Suspense fallback={<ModeHomeRouteLoading />}>
      <TherapyCompassWorkspace>{children}</TherapyCompassWorkspace>
    </Suspense>
  ) : (
    children
  );

  return <GlobalSearchShell {...shellProps}>{content}</GlobalSearchShell>;
}
