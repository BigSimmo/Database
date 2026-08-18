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
  "dictionary",
  "tools",
  "calculators",
]);

/**
 * Exact pathnames that own an in-flow hero composer (no phone bottom dock).
 * Derived from the URL alone so an optimistic mode-state update during
 * navigation cannot flip the shell into dock reserve mid-transition.
 */
const standaloneModeHomePaths = new Set<string>([
  // The four modes that still own a home of their own. Every other mode was
  // consolidated onto the shared home at `/?mode=<id>`, whose composer the
  // dashboard owns; their bare paths redirect and render nothing to reserve
  // geometry for (`consolidatedModeHomePaths`).
  "/favourites",
  "/tools",
  "/medications",
]);

export function isStandaloneModeHomePath(pathname: string): boolean {
  return standaloneModeHomePaths.has(pathname);
}

/**
 * Pathnames that never mount ClinicalDashboard, regardless of `?mode=` / `?run=`.
 * Used to keep `{children}` out of a `useSearchParams()` Suspense boundary so the
 * route segment is not streamed as a nested incomplete `S:` template inside the
 * shell boundary (duplicate page-root `data-testid`s under CI load).
 */
const alwaysStandaloneShellPathPrefixes = [
  "/services",
  "/forms",
  "/favourites",
  "/differentials",
  "/dsm",
  "/specifiers",
  "/formulation",
  "/factsheets",
  "/dictionary",
  "/therapy-compass",
  "/medications",
  "/calculators",
  "/tools",
] as const;

export function isAlwaysStandaloneShellPath(pathname: string): boolean {
  return alwaysStandaloneShellPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
    // `/` is now the only unsubmitted mode home the dashboard renders. `/documents`
    // was the last exception and it redirects here, so the separate
    // `dashboardOwnedModeHomePaths` set it justified went with it.
    (pathname === "/" || shouldRenderDashboardSearch({ hasSubmittedSearch, mode, pathname }))
  );
}
