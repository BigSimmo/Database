/**
 * Client-safe differentials href helpers.
 * Keep this module free of `@/lib/differentials` / snapshot imports so the
 * clinical-dashboard client bundle stays fixture-free.
 */

import { appModeHomeHref } from "@/lib/app-modes";

/** Search home/results href that preserves compare-queue diagnosis ids. */
export function differentialCompareSearchHref(query: string, selectedIds: Iterable<string> = []) {
  const trimmedQuery = query.trim();
  const ids = Array.from(selectedIds, (id) => id.trim()).filter(Boolean);

  // When there are selected IDs, always target /differentials/search so the
  // edit-selection link lands on the search page regardless of whether there is
  // a query.  /differentials is now a consolidated redirect — appModeHomeHref
  // with no query returns /?mode=differentials (the shared home), which is the
  // wrong destination for an edit-selection link.
  if (ids.length) {
    const params = new URLSearchParams();
    if (trimmedQuery) {
      params.set("q", trimmedQuery);
      params.set("run", "1");
    }
    params.set("focus", "1");
    params.set("ids", ids.join(","));
    return `/differentials/search?${params.toString()}`;
  }

  return appModeHomeHref("differentials", {
    query: trimmedQuery || undefined,
    run: Boolean(trimmedQuery),
    focus: true,
  });
}

export function differentialRouteWithQuery(
  path: string,
  query: string,
  selectedIds?: Iterable<string>,
  focus?: string,
) {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();
  if (trimmedQuery) params.set("q", trimmedQuery);
  const ids = selectedIds ? Array.from(selectedIds, (id) => id.trim()).filter(Boolean) : [];
  if (ids.length > 0) params.set("ids", ids.join(","));
  const trimmedFocus = focus?.trim();
  if (trimmedFocus) params.set("focus", trimmedFocus);
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

/**
 * Compare-selected CTA href. The compare page resolves presentation vs ad-hoc
 * workflows on the server (see compare/page.tsx) so the client never loads the
 * differentials snapshot just to build a link. Legacy `/differentials/presentations?ids=`
 * still redirects when hit directly.
 */
export function differentialSelectedCompareHref(query: string, selectedIds: Iterable<string>) {
  return differentialRouteWithQuery("/differentials/compare", query, selectedIds);
}

/** Parse `ids` from a query string (comma-separated diagnosis slugs). */
export function differentialIdsFromSearchParams(searchParams: URLSearchParams | string): string[] {
  const params = typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const raw of (params.get("ids") ?? "").split(",")) {
    // Lowercase to match server-side `normalizeRequestedDiagnosisIds` and catalogue slugs.
    const id = raw.trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** Pure helper: next `?…` suffix (including leading `?`) after writing `ids`. */
export function differentialSelectionIdsSearch(selectedIds: Iterable<string>, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch);
  const nextIds = Array.from(selectedIds, (id) => id.trim()).filter(Boolean);
  const current = params.get("ids") ?? "";
  const next = nextIds.join(",");
  if (current === next) {
    const existing = params.toString();
    return existing ? `?${existing}` : "";
  }
  if (next) params.set("ids", next);
  else params.delete("ids");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Keep the current URL's `ids` param aligned with the active compare selection
 * without a Next navigation (ModeNav reads this on Compare handoff).
 */
export function syncDifferentialSelectionIdsToUrl(
  selectedIds: Iterable<string>,
  location: Pick<Location, "pathname" | "search" | "hash"> = window.location,
) {
  const nextSearch = differentialSelectionIdsSearch(selectedIds, location.search);
  const currentSearch = location.search.startsWith("?") || !location.search ? location.search : `?${location.search}`;
  if (currentSearch === nextSearch) return;
  window.history.replaceState(null, "", `${location.pathname}${nextSearch}${location.hash}`);
}
