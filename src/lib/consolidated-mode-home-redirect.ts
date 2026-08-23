import type { AppModeId } from "@/lib/app-modes";

/**
 * Bare mode paths that no longer render a home of their own.
 *
 * Every mode shares one lightweight home at `/?mode=<id>`, whose per-mode copy
 * lives in `sharedHomePresentation` (src/lib/ui-copy.ts). These paths stay so
 * bookmarks, the sitemap and external deep links keep resolving; they forward
 * to that shared home instead of rendering a second one.
 *
 * Five modes are deliberately absent, because none of them is a duplicate of the
 * shared home — each is its mode's only functional surface, so folding it in
 * would delete a feature rather than de-duplicate a page:
 *   /tools        the launcher (categories, filters, saved)
 *   /favourites   the hub (Continue, Recent, sets, sort/view)
 *   /medications  the prescribing workspace (dose/safety/monitoring checks)
 *   /documents    dashboard-owned: the shell mounts ClinicalDashboard for that
 *                 pathname, so `/documents` renders a real Documents home —
 *                 browse, recent documents and the document-search empty state
 *                 — not a duplicate of the generic shared home. Folding it in
 *                 here silently deleted those three affordances (`/issues`
 *                 tracked this as a Production UI regression); restored.
 *   /            the shared home itself
 *
 * Sub-routes are deliberately NOT listed: `/dsm/search`, `/factsheets/[slug]`
 * and friends are real surfaces and must keep rendering themselves.
 */
const consolidatedModeHomePaths = {
  "/dsm": "dsm",
  "/dictionary": "dictionary",
  "/factsheets": "factsheets",
  "/services": "services",
  "/forms": "forms",
  "/calculators": "calculators",
  "/specifiers": "specifiers",
  "/formulation": "formulation",
  "/differentials": "differentials",
  "/therapy-compass": "therapy-compass",
} as const satisfies Record<string, AppModeId>;

type ConsolidatedModeHomePath = keyof typeof consolidatedModeHomePaths;

function isConsolidatedPath(pathname: string): pathname is ConsolidatedModeHomePath {
  return Object.hasOwn(consolidatedModeHomePaths, pathname);
}

export function isConsolidatedModeHomePath(pathname: string): boolean {
  return isConsolidatedPath(pathname);
}

export function consolidatedModeHomeModeId(pathname: string): AppModeId | null {
  return isConsolidatedPath(pathname) ? consolidatedModeHomePaths[pathname] : null;
}

/**
 * Where a consolidated bare path forwards to.
 *
 * Resolved in the proxy rather than by the page's own `redirect()`, because the
 * `(search-app)` layout streams: Next 16 documents that `redirect()` in a
 * streaming context "will insert a meta tag to emit the redirect on the client
 * side" instead of serving a 307 (`redirect.md`). Measured here, that produced
 * `<meta http-equiv="refresh" content="1;url=/?mode=dsm">` — an empty shell for
 * a whole second on a primary navigation path. The same reasoning already put
 * the document-source fallbacks in this proxy (issue #024).
 *
 * The destination depends on whether the link was submitted, because the bare
 * path used to serve both roles:
 *
 * - Unsubmitted (`/dsm`) forwards to the shared home, `/?mode=dsm`.
 * - Submitted (`/dsm?q=…&run=1`) forwards to the mode's own results surface,
 *   `/dsm/search?q=…&run=1`, which is exactly where it rendered before.
 *
 * Sending a submitted link to the shared home instead is what broke four phone
 * journeys: the dashboard rendered its own in-place results for some modes and
 * nothing at all for others, so `/forms?q=transport&run=1` stopped reaching
 * `FormsSearchResultsPage`. Forwarding straight to `<mode>/search` restores the
 * pre-consolidation destination for every deep link and bookmark.
 *
 * Every other query parameter rides along untouched, so navigation context
 * (`queryMode`, scope filters, `focus`) survives the hop. `mode` is the one
 * exception: it is always overwritten from the pathname, so a crafted
 * `/dsm?mode=…` cannot redirect the visitor to an unrelated mode.
 */
export function consolidatedModeHomeTarget(pathname: string, search: URLSearchParams): string | null {
  const modeId = consolidatedModeHomeModeId(pathname);
  if (!modeId) return null;

  const params = new URLSearchParams(search);
  params.set("mode", modeId);

  // `query` is the legacy alias several of these paths accepted before `q`. It
  // has to count as a query here too, or `/services?q=%20&query=13YARN&run=1`
  // reads as unsubmitted and lands on the home — the old deep link silently
  // stops finding anything. The search routes canonicalise it back to `q`.
  const query = (params.get("q")?.trim() || params.get("query")?.trim()) ?? "";
  const submitted = query.length > 0 && params.get("run") === "1";
  // `pathname` is the key that resolved `modeId`, and every consolidated mode's
  // route namespace is that same path — so this is the mode's own search route,
  // never a path built from unvalidated input.
  return submitted ? `${pathname}/search?${params.toString()}` : `/?${params.toString()}`;
}

/**
 * The modes whose bare path redirects — the same set, keyed by mode instead of path.
 *
 * `app-modes.ts` reads this to route submitted searches to `<href>/search` and
 * unsubmitted ones straight to `/?mode=<id>`. Deriving it here rather than
 * restating the list there is what stops the two drifting: a mode added to the
 * redirect map without a `/search` route would otherwise send a submitted query
 * back through its own redirect and loop.
 */
export const consolidatedModeHomeModeIds: ReadonlySet<AppModeId> = new Set<AppModeId>(
  Object.values(consolidatedModeHomePaths),
);

/**
 * The same decision as `consolidatedModeHomeTarget`, for a page's own
 * `searchParams` rather than a `URLSearchParams`.
 *
 * Each consolidated bare path keeps a page-level `redirect()` as a backstop for
 * any request the proxy matcher misses. Without this the backstop resolved to a
 * bare `/?mode=<id>`, so if it ever fired, `/forms?q=transport&run=1` arrived at
 * the home having silently dropped the query, the submission and the navigation
 * context — a worse answer than the proxy gives for the same URL. Routing both
 * through one resolver means the fallback cannot disagree with the proxy.
 */
export function consolidatedModeHomeTargetForSearchParams(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else if (value !== undefined) params.set(key, value);
  }
  return consolidatedModeHomeTarget(pathname, params);
}

/**
 * `<mode>/search` routes that have no browse view of their own.
 *
 * `/calculators/search` and `/differentials/search`: their idle bodies were the
 * retired tile homes, so an unsubmitted visit has nothing useful to show.
 * Redirecting them home is correct. Calculators coverage is
 * `tests/calculators-mode.dom.test.tsx`; differentials is this module's own
 * unsubmitted-search cases.
 *
 * `/formulation/search` and `/specifiers/search` are deliberately NOT here:
 * their components render a real browsable catalogue on an empty query — the
 * same content `/formulation` and `/specifiers` held as a long list, relocated
 * here rather than duplicated. That is pinned by
 * `tests/ui-phone-scroll-routes.spec.ts` ("phone scroll stays smooth on
 * /formulation/search"), which navigates there with no query and asserts the
 * long mechanism list renders and scrolls. Do not add them without first
 * running that spec and confirming it still passes.
 *
 * `/factsheets/search`, `/dictionary/search` and `/therapy-compass/search` are
 * absent for a different, unrelated reason: they're linked from their mode nav
 * with no query at all (`modeSecondaryNavigationRegistry`), so they're browse
 * surfaces too — redirecting them would break the tab that points at them.
 */
const modeSearchRoutesWithoutBrowseView = {
  "/calculators/search": "calculators",
  "/differentials/search": "differentials",
} as const satisfies Record<string, AppModeId>;

/**
 * The shared-home URL an unsubmitted mode-search route forwards to, if any.
 *
 * Resolved in the proxy for the same reason as the bare paths: a page-level
 * `redirect()` under the streaming `(search-app)` layout emits a client-side meta
 * refresh rather than a 307, which is a second of empty shell. The pages keep
 * their own redirect as a backstop, exactly as the bare paths do.
 *
 * `query` counts alongside `q` so a legacy `?query=` deep link is treated as
 * submitted and reaches the route's own canonicalisation rather than bouncing home.
 */
export function unsubmittedModeSearchTarget(pathname: string, search: URLSearchParams): string | null {
  if (!Object.hasOwn(modeSearchRoutesWithoutBrowseView, pathname)) return null;
  const modeId = modeSearchRoutesWithoutBrowseView[pathname as keyof typeof modeSearchRoutesWithoutBrowseView];

  const query = (search.get("q")?.trim() || search.get("query")?.trim()) ?? "";
  if (query) return null;

  const params = new URLSearchParams(search);
  params.delete("q");
  params.delete("query");
  params.set("mode", modeId);
  return `/?${params.toString()}`;
}

/**
 * `[bare path, mode]` for every consolidated home, and `[search path, mode]` for
 * every unsubmitted mode-search forward.
 *
 * Exported for `scripts/generate-site-map.ts`. The generator used to learn which
 * routes redirect by regex-scraping `redirect("…")` out of page bodies, which
 * stopped seeing these the moment the stubs began computing their target instead
 * of naming it as a literal — so the site map described the bare paths as pages
 * that render a home. Reading the map itself cannot drift from the map.
 */
export const consolidatedModeHomeRedirectEntries = Object.entries(consolidatedModeHomePaths) as ReadonlyArray<
  readonly [string, AppModeId]
>;

export const unsubmittedModeSearchRedirectEntries = Object.entries(modeSearchRoutesWithoutBrowseView) as ReadonlyArray<
  readonly [string, AppModeId]
>;
