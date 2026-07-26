import type { AppModeId } from "@/lib/app-modes";

/**
 * Decides whether a submitted shared-composer search belongs to the dashboard
 * or to the route that is already mounted. This is deliberately a pure routing
 * boundary: it does not parse URLs, fetch data, or depend on React state.
 */
const routeOwnedSubmittedSearchModes = new Set<AppModeId>([
  "services",
  "forms",
  "favourites",
  "differentials",
  "dsm",
  "specifiers",
  "formulation",
  "therapy-compass",
  "factsheets",
]);

/**
 * Exact pathnames that own an in-flow hero composer (no phone bottom dock).
 * Derived from the URL alone so an optimistic mode-state update during
 * navigation cannot flip the shell into dock reserve mid-transition.
 */
const standaloneModeHomePaths = new Set<string>([
  "/services",
  "/forms",
  "/favourites",
  "/differentials",
  "/dsm",
  "/specifiers",
  "/formulation",
  "/factsheets",
  "/therapy-compass",
  "/tools",
]);

export function isStandaloneModeHomePath(pathname: string): boolean {
  return standaloneModeHomePaths.has(pathname);
}

/** Dashboard-owned hrefs stay on `/` with `?mode=`, or the submitted documents search route. */
export function isDashboardModeHref(href: string): boolean {
  if (href === "/" || href.startsWith("/?")) return true;
  // Submitted document searches still render ClinicalDashboard; treat them as
  // in-shell so cross-mode navigation can sync searchMode/query before push.
  const path = href.split(/[?#]/, 1)[0] ?? href;
  return path === "/documents/search";
}

export function shouldRenderDashboardSearch({
  hasSubmittedSearch,
  mode,
  pathname,
}: {
  hasSubmittedSearch: boolean;
  mode: AppModeId;
  pathname: string;
}) {
  return (
    hasSubmittedSearch && !routeOwnedSubmittedSearchModes.has(mode) && !pathname.startsWith("/mockups/document-search")
  );
}

export function shouldRenderClinicalDashboard({
  hasSubmittedSearch,
  mode,
  pathname,
}: {
  hasSubmittedSearch: boolean;
  mode: AppModeId;
  pathname: string;
}) {
  const isMedicationDetailRoute = /^\/medications\/[^/]+$/.test(pathname);
  return (
    !isMedicationDetailRoute &&
    (pathname === "/" || shouldRenderDashboardSearch({ hasSubmittedSearch, mode, pathname }))
  );
}
