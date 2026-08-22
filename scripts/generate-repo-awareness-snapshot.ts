import { appModeDefinitions, appModeHomeHref } from "@/lib/app-modes";
import {
  REPO_AWARENESS_SNAPSHOT_VERSION,
  type RouteArea,
  type RoutesSection,
} from "@/lib/developer-area/repo-awareness-types";

import { collectSiteMapData } from "./generate-site-map";

export const SNAPSHOT_VERSION = REPO_AWARENESS_SNAPSHOT_VERSION;
export const OUTPUT_PATH = "data/repo-awareness-snapshot.json";

/**
 * Only the parts of `collectSiteMapData()`'s return value this generator reads.
 * Declared structurally rather than imported, because `generate-site-map.ts`
 * does not export its `SiteMapData` type — and narrowing here also lets a test
 * build a three-route fixture instead of walking the whole app directory.
 */
export type SiteMapInput = {
  pageRoutes: readonly { route: string; file: string }[];
  apiRoutes: readonly { route: string; file: string }[];
  redirects: readonly { route: string; file: string; target: string }[];
};

function byPath<T extends { path: string }>(left: T, right: T) {
  return left.path.localeCompare(right.path);
}

export function buildRoutesSection(siteMap: SiteMapInput = collectSiteMapData()): RoutesSection {
  // A redirect route is discovered from the page routes, so it appears in both
  // lists. Listing it in `pages` as well would double-count it and tell the
  // reader a redirect stub is a page they can visit.
  const redirectPaths = new Set(siteMap.redirects.map((redirect) => redirect.route));

  const pages = siteMap.pageRoutes
    .filter((route) => !redirectPaths.has(route.route))
    .map((route) => ({
      path: route.route,
      file: route.file,
      area: (route.route.startsWith("/mockups") ? "mockup" : "product") as RouteArea,
    }))
    .sort(byPath);

  const redirects = siteMap.redirects
    .map((redirect) => ({ path: redirect.route, file: redirect.file, target: redirect.target }))
    .sort(byPath);

  const api = siteMap.apiRoutes.map((route) => ({ path: route.route, file: route.file })).sort(byPath);

  const modes = appModeDefinitions
    .map((mode) => ({
      id: mode.id,
      label: mode.label,
      home: appModeHomeHref(mode.id),
      // Some modes are hidden outside development. That is a fact about the
      // product surface a reader of this panel needs, and it is not visible
      // from the route list alone.
      dev_only: "devOnly" in mode && mode.devOnly === true,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    modes,
    pages,
    redirects,
    api,
    counts: {
      modes: modes.length,
      pages: pages.length,
      product_pages: pages.filter((page) => page.area === "product").length,
      mockup_pages: pages.filter((page) => page.area === "mockup").length,
      redirects: redirects.length,
      api: api.length,
    },
  };
}
