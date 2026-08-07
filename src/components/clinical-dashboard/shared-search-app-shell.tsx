"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";
import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";
import { searchShellPropsForPathname } from "@/lib/search-shell-props";

const TherapyCompassWorkspace = dynamic(
  () => import("@/components/therapy-compass").then((mod) => mod.TherapyCompassWorkspace),
  { ssr: true, loading: () => <ModeHomeRouteLoading /> },
);

/**
 * Owns one GlobalSearchShell across mode homes so navigating between
 * /services, /dsm, /, etc. does not remount the shared composer chrome.
 */
export function SharedSearchAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const shellProps = searchShellPropsForPathname(pathname);
  const content = pathname.startsWith("/therapy-compass") ? (
    <TherapyCompassWorkspace>{children}</TherapyCompassWorkspace>
  ) : (
    children
  );

  return <GlobalSearchShell {...shellProps}>{content}</GlobalSearchShell>;
}
