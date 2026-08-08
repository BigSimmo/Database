import { useEffect, useRef } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { appModeSelectionHref } from "@/lib/app-modes";
import { DEFAULT_APP_MODE } from "@/components/clinical-dashboard/use-last-app-mode";
import { landingModeForPreference, readAppPreferences } from "@/components/clinical-dashboard/use-app-preferences";
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
}: {
  pathname: string | null;
  searchParams: ReadonlyURLSearchParams;
  lastAppMode: AppModeId;
}) {
  const homeModeSeededRef = useRef(false);

  useEffect(() => {
    if (homeModeSeededRef.current) return;
    if (pathname !== "/") return;
    if (searchParams.has("mode") || searchParams.has("q") || searchParams.has("query")) return;
    homeModeSeededRef.current = true;
    if (landingModeForPreference(readAppPreferences().landing)) return;
    if (lastAppMode === DEFAULT_APP_MODE) return;
    window.history.replaceState(null, "", appModeSelectionHref(lastAppMode));
  }, [pathname, searchParams, lastAppMode]);
}
