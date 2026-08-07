import type { ReactNode } from "react";
import dynamic from "next/dynamic";

import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";
import "@/components/therapy-compass/therapy-compass.css";

const SharedSearchAppShell = dynamic(
  () =>
    import("@/components/clinical-dashboard/shared-search-app-shell").then((mod) => ({
      default: mod.SharedSearchAppShell,
    })),
  { ssr: true, loading: () => <ModeHomeRouteLoading /> },
);

/**
 * Shared search chrome for mode homes and related routes. Keeping GlobalSearchShell
 * in this route-group layout prevents remounting the composer when navigating
 * between namespaced modes (e.g. /services ↔ /dsm ↔ /).
 */
export default function SearchAppLayout({ children }: { children: ReactNode }) {
  return <SharedSearchAppShell>{children}</SharedSearchAppShell>;
}
