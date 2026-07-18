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
