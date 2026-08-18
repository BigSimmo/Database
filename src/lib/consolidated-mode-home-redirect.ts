import type { AppModeId } from "@/lib/app-modes";

/**
 * Bare mode paths that no longer render a home of their own.
 *
 * Therapy and Documents are deliberately absent. Documents is dashboard-owned:
 * the shell mounts ClinicalDashboard for that pathname, so `/documents` renders
 * a real Documents home — browse, recent documents and the document-search empty
 * state — exactly as `/medications` renders the prescribing workspace. Its page
 * component being an empty fragment says nothing about what the route paints.
 *
 * Therapy is deliberately absent. It is `devOnly` (app-modes.ts) pending
 * qualified-clinician sign-off on its catalogue, so the shared home falls back
 * to Answer for it in production — while `/therapy-compass` itself still
 * renders. Consolidating it therefore removed Therapy from production
 * altogether; measured against a production build, `/?mode=therapy-compass`
 * came back as mode Answer. It keeps its own home until that gate lifts.
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
