/**
 * Client-safe differentials href helpers.
 * Keep this module free of `@/lib/differentials` / snapshot imports so the
 * clinical-dashboard client bundle stays fixture-free.
 */

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
 * Compare-selected CTA href. Resolves the presentation workflow on the server
 * via `/differentials/presentations` (see presentations/route.ts) so the client
 * never loads the differentials snapshot just to build a link.
 */
export function differentialSelectedCompareHref(query: string, selectedIds: Iterable<string>) {
  return differentialRouteWithQuery("/differentials/presentations", query, selectedIds);
}
