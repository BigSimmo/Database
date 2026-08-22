import { execFileSync } from "node:child_process";
import path from "node:path";

import { appModeDefinitions, appModeHomeHref } from "@/lib/app-modes";
import {
  REPO_AWARENESS_SNAPSHOT_VERSION,
  type DocumentationSection,
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

// `path` alone is not a total order: a redirect and its originating page can
// share a route path, and nothing in the input types rules out two entries
// with equal `path` in general. Break ties on `file` — every caller's array
// (`pages`, `redirects`, `api`) carries one — so a repeated regeneration on an
// unchanged repository can never reorder two entries and fail the staleness
// gate.
function byPath<T extends { path: string; file: string }>(left: T, right: T) {
  return left.path.localeCompare(right.path) || left.file.localeCompare(right.file);
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
    // App-mode ids are unique by construction (they are a hand-maintained
    // enum-like registry in `app-modes.ts`), so `id` alone is already a total
    // order and needs no tiebreaker.
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

const DOCS_ROOT = "docs";
export const README_PATH = "docs/README.md";

/**
 * Review records get their own panel and would otherwise be 455 of the ~280
 * rows here, drowning the documents a reader is actually looking for. Inbox
 * requests are JSON transactions, not documents.
 */
const EXCLUDED_DOC_PREFIXES = ["docs/branch-review-records/", "docs/outstanding-issues-inbox/"];

/**
 * Tracked files only. Walking the filesystem would list a developer's untracked
 * scratch notes, and the staleness gate would then fail on a clean tree for
 * everyone but that developer — a gate that fires when nothing is wrong.
 */
export function listDocumentPaths(): string[] {
  const output = execFileSync("git", ["ls-files", "-z", "--", DOCS_ROOT], { encoding: "utf8" });
  return output
    .split("\0")
    .filter((entry) => entry.endsWith(".md"))
    .filter((entry) => !EXCLUDED_DOC_PREFIXES.some((prefix) => entry.startsWith(prefix)));
}

function documentSection(repoPath: string): string {
  // "docs/a.md" -> root; "docs/design-system/SPEC.md" -> design-system.
  const segments = repoPath.split("/");
  return segments.length > 2 ? segments[1] : "root";
}

/**
 * Every repo-relative doc path `docs/README.md` refers to, by either route it
 * uses: a markdown link written relative to `docs/`, or a full `docs/…` path
 * named in prose or a code span.
 *
 * An absolute URL is stripped before either scan runs, so neither route can be
 * fooled by a plausible-looking `docs/…md` substring inside it — a GitHub blob
 * link such as `https://github.com/…/blob/main/docs/some-doc.md` must not
 * catalogue `docs/some-doc.md`, and a document catalogued by a third-party or
 * repository URL rather than the index's own text is a false positive in the
 * one column this panel exists to report.
 */
function catalogueTargets(readmeMarkdown: string): Set<string> {
  const targets = new Set<string>();

  // Both loops below scan for `docs/…md`, and an absolute URL can contain that
  // substring — `https://github.com/…/blob/main/docs/some-doc.md` would
  // otherwise mark that document catalogued when the index never listed it.
  // Stripping URLs first is what makes the claim in this docstring true for
  // BOTH loops rather than only the link loop.
  const withoutUrls = readmeMarkdown.replace(/https?:\/\/\S+/g, " ");

  for (const match of withoutUrls.matchAll(/\]\(([^)\s#]+)/g)) {
    const target = match[1];
    if (target.includes("://") || target.startsWith("/") || target.startsWith("#")) continue;
    targets.add(path.posix.normalize(path.posix.join(DOCS_ROOT, target)));
  }

  for (const match of withoutUrls.matchAll(/docs\/[A-Za-z0-9._/-]+\.md/g)) targets.add(match[0]);

  return targets;
}

export function buildDocumentationSection(docPaths: readonly string[], readmeMarkdown: string): DocumentationSection {
  const catalogued = catalogueTargets(readmeMarkdown);

  // `path` alone is already a total order here: `docPaths` comes from
  // `git ls-files`, which cannot list the same repo path twice, so no two
  // entries can compare equal and no tiebreaker is needed.
  const documents = [...docPaths]
    .sort((left, right) => left.localeCompare(right))
    .map((repoPath) => ({
      path: repoPath,
      section: documentSection(repoPath),
      catalogued: catalogued.has(repoPath),
    }));

  const bySection = new Map<string, { name: string; documents: number; uncatalogued: number }>();
  for (const document of documents) {
    const entry = bySection.get(document.section) ?? { name: document.section, documents: 0, uncatalogued: 0 };
    entry.documents += 1;
    if (!document.catalogued) entry.uncatalogued += 1;
    bySection.set(document.section, entry);
  }
  // `name` alone is already a total order here too: it is the key of the Map
  // it was read from, so `bySection.values()` contains at most one entry per
  // name and no tiebreaker is needed.
  const sections = [...bySection.values()].sort((left, right) => left.name.localeCompare(right.name));

  return {
    documents,
    sections,
    counts: {
      documents: documents.length,
      catalogued: documents.filter((document) => document.catalogued).length,
      uncatalogued: documents.filter((document) => !document.catalogued).length,
      sections: sections.length,
    },
  };
}
