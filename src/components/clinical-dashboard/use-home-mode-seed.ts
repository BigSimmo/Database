import { useEffect, useRef } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { appModeSelectionHref } from "@/lib/app-modes";
import { dashboardOwnedModeHomeModeId } from "@/lib/search-route-ownership";
import { DEFAULT_APP_MODE } from "@/components/clinical-dashboard/use-last-app-mode";
import { landingModeForPreference, readAppPreferences } from "@/components/clinical-dashboard/use-app-preferences";
import { readSearchNavigationContext } from "@/lib/search-navigation-context";
import type { AppModeId } from "@/lib/app-modes";

/**
 * Seed a cold `/` visit from the remembered mode. `?mode=` always wins — it is
 * the SSR source of truth, so a reloaded or shared link server-renders the right
 * placeholder with no hydration flip. This only fills the gap when the URL says
 * nothing, and does it with replaceState: no history entry, no server round trip,
 * and only the placeholder changes (never composer geometry).
 *
 * Seeds at most once per mount, and never reads `searchMode`. Both matter: in-app
 * actions change the mode on `/` without touching the URL (openDocumentsDrawer
 * does exactly that), so a re-firing effect would rewrite `?mode=` back to the
 * remembered mode and silently undo them.
 *
 * Settings landing view also wins over last-mode: when landing is Documents or
 * Tools the shell navigates to those homes, and seeding `?mode=` here would
 * race that redirect and leave the landing preference ignored.
 */
export function useHomeModeSeed({
  pathname,
  searchParams,
  lastAppMode,
  searchMode,
  setSearchMode,
}: {
  pathname: string | null;
  searchParams: ReadonlyURLSearchParams;
  lastAppMode: AppModeId;
  searchMode: AppModeId;
  setSearchMode: (mode: AppModeId) => void;
}) {
  const homeModeSeededRef = useRef(false);

  /*
   * The same gap on a dashboard-owned mode home. `/documents` names its mode
   * through the pathname rather than `?mode=`, so the dashboard's `?mode=` sync
   * returns early on it — and the dashboard stays mounted across a client
   * navigation onto it, unlike `/tools`, `/favourites` and `/medications`, which
   * are always-standalone and remount. Nothing read the pathname, so clicking
   * Documents in the sidebar moved the URL while the header, composer placeholder
   * and highlight stayed on the mode the visitor came from; a full page load
   * looked correct, which is what kept it hidden. Only reachable once
   * `/?mode=<id>` became a real destination.
   *
   * Deferred a frame to match the `?mode=` sync and to satisfy the repo's ban on
   * a bare setState in an effect.
   */
  useEffect(() => {
    if (!pathname) return;
    const pathMode = dashboardOwnedModeHomeModeId(pathname);
    if (!pathMode || pathMode === searchMode) return;
    if (searchParams.has("mode")) return;
    const frame = window.requestAnimationFrame(() => setSearchMode(pathMode));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, searchParams, searchMode, setSearchMode]);

  useEffect(() => {
    if (homeModeSeededRef.current) return;
    if (pathname !== "/") return;
    if (searchParams.has("mode") || searchParams.has("q") || searchParams.has("query")) return;
    homeModeSeededRef.current = true;
    if (landingModeForPreference(readAppPreferences().landing)) return;
    if (lastAppMode === DEFAULT_APP_MODE) return;
    // Carry the rest of the URL through. Seeding only runs when the URL names no
    // mode or query, but `focus=1` and the scope/queryMode context can still be
    // present — rewriting without them silently dropped a requested composer
    // focus and any scoped-search context on a cold `/` visit.
    const navigationContext = readSearchNavigationContext(searchParams);
    window.history.replaceState(
      null,
      "",
      appModeSelectionHref(lastAppMode, {
        focus: searchParams.get("focus") === "1",
        queryMode: navigationContext.queryMode,
        scopeFilters: navigationContext.scopeFilters,
        scopeRef: navigationContext.scopeRef,
      }),
    );
  }, [pathname, searchParams, lastAppMode]);
}
