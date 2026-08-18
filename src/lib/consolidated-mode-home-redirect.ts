import type { AppModeId } from "@/lib/app-modes";

/**
 * Bare mode paths that no longer render a home of their own.
 *
 * Every mode shares one lightweight home at `/?mode=<id>`, whose per-mode copy
 * lives in `sharedHomePresentation` (src/lib/ui-copy.ts). These paths stay so
 * bookmarks, the sitemap and external deep links keep resolving; they forward
 * to that shared home instead of rendering a second one. The retired detailed
 * pages are preserved off the live routes under `/mockups/<mode>-home-detailed`.
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
 * The shared-home URL a consolidated bare path forwards to.
 *
 * Resolved in the proxy rather than by the page's own `redirect()`, because the
 * `(search-app)` layout streams: Next 16 documents that `redirect()` in a
 * streaming context "will insert a meta tag to emit the redirect on the client
 * side" instead of serving a 307 (`redirect.md`). Measured here, that produced
 * `<meta http-equiv="refresh" content="1;url=/?mode=dsm">` — an empty shell for
 * a whole second on a primary navigation path. The same reasoning already put
 * the document-source fallbacks in this proxy (issue #024).
 *
 * The incoming query is carried across untouched so a submitted deep link keeps
 * working: `/dsm?q=x&run=1` becomes `/?mode=dsm&q=x&run=1`, which the shared home
 * then resolves onward to `/dsm/search`. That cannot loop, because the onward hop
 * targets the search surface rather than the bare path.
 *
 * `mode` is always overwritten from the pathname, so a crafted `/dsm?mode=…`
 * cannot redirect the visitor to an unrelated mode.
 */
export function consolidatedModeHomeTarget(pathname: string, search: URLSearchParams): string | null {
  const modeId = consolidatedModeHomeModeId(pathname);
  if (!modeId) return null;

  const params = new URLSearchParams(search);
  params.set("mode", modeId);
  return `/?${params.toString()}`;
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
