import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { appModeDefinitions } from "@/lib/app-modes";
import { isAlwaysStandaloneShellPath, isStandaloneModeHomePath } from "@/lib/search-route-ownership";

/**
 * The shared results band is what stops a search surface asserting "0 matches"
 * when the search actually failed. That guarantee is only worth anything if
 * every result list wears it, so this file is the gate that a *future* search
 * page cannot quietly skip.
 *
 * It pairs with the required `resultsSurface` field on `AppModeSearchConfig`:
 * that field makes a new mode fail `typecheck` until its author declares which
 * surface it is, and this test then holds them to the declaration.
 */

const REPO_ROOT = path.resolve(__dirname, "..");
const COMPONENTS_DIR = path.join(REPO_ROOT, "src", "components");
const APP_DIR = path.join(REPO_ROOT, "src", "app");
const BAND_IDENTIFIER = "SearchResultsHeaderBand";
/** A rendered element, not a bare mention. Matching the identifier alone counts
    an import, a comment, or a dead reference as adoption, so a production route
    could drop the band while this gate stayed green. */
const BAND_ELEMENT = `<${BAND_IDENTIFIER}`;
function rendersBand(source: string) {
  return source.includes(BAND_ELEMENT);
}

/** Mockups are design scratch and exempt from production wiring gates. */
function isMockupPath(relativePath: string) {
  return /mockup/i.test(relativePath);
}

function walk(dir: string, extension = ".tsx"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(abs, extension));
    } else if (entry.name.endsWith(extension)) {
      out.push(abs);
    }
  }
  return out;
}

/**
 * Collect every string literal appearing in each `modeId=` initializer on a
 * band element. Literals are gathered recursively rather than matched as a
 * single `modeId="x"` because at least one production call site computes the
 * mode: `document-search-results.tsx` writes
 * `modeId={showRecordMatches ? recordMode : "documents"}`, and a naive matcher
 * would report that page as having no mode at all.
 */
function collectBandModeIds(source: string): Set<string> {
  const found = new Set<string>();
  let cursor = source.indexOf(`<${BAND_IDENTIFIER}`);
  while (cursor !== -1) {
    const modeIdAt = source.indexOf("modeId", cursor);
    if (modeIdAt === -1) break;
    // Bound the search to this element's opening tag so we never read props
    // belonging to the next component.
    const elementEnd = source.indexOf("\n    />", cursor);
    const window = source.slice(modeIdAt, elementEnd === -1 ? modeIdAt + 400 : Math.min(elementEnd, modeIdAt + 400));
    const attribute = window.slice(0, window.indexOf("\n", window.indexOf("\n") + 1) + 1 || window.length);
    for (const match of attribute.matchAll(/["']([a-z-]+)["']/g)) found.add(match[1]);
    cursor = source.indexOf(`<${BAND_IDENTIFIER}`, cursor + 1);
  }
  return found;
}

/**
 * Routes that legitimately render no band. Each entry must say why, so an
 * exemption is a reviewed decision rather than a silent hole — the same idiom
 * `tests/route-reachability.test.ts` uses for its allowlist.
 */
const BAND_ROUTE_ALLOWLIST = new Map<string, string>([
  [
    "src/app/(search-app)/documents/search/page.tsx",
    "Composer-driven landing stub with no result list of its own; the band is mounted by document-search-results.tsx inside the dashboard shell.",
  ],
  [
    "src/app/(search-app)/dsm/page.tsx",
    "DSM mode home is a catalogue landing; result lists (and the band) live on /dsm/search.",
  ],
  [
    "src/app/(search-app)/factsheets/page.tsx",
    "Factsheets mode home is a catalogue landing; result lists (and the band) live on /factsheets/search.",
  ],
  [
    "src/app/(search-app)/therapy-compass/page.tsx",
    "Therapy home is the library landing; the search results band lives on /therapy-compass/search.",
  ],
]);

const ROOT_DASHBOARD_ROUTE = path.join(APP_DIR, "(search-app)", "page.tsx");

/**
 * Resolve a mode href to its App Router page file.
 *
 * Query-backed modes are the reason this is not a plain path join. `prescribing`
 * declares `href: "/?mode=prescribing"`, whose pathname is `/`, and the previous
 * implementation returned null for that — so it, and every href-less mode such
 * as Documents, stayed outside the inventory and the root dashboard page was
 * never checked at all.
 */
function modeHrefToPagePath(href: string | null): string | null {
  const pathOnly = (href ?? "/").split("?")[0]?.trim() || "/";
  if (!pathOnly.startsWith("/")) return null;
  const candidate =
    pathOnly === "/" ? ROOT_DASHBOARD_ROUTE : path.join(APP_DIR, "(search-app)", pathOnly.slice(1), "page.tsx");
  if (!existsSync(candidate)) return null;
  return path.relative(REPO_ROOT, candidate).replaceAll(path.sep, "/");
}

/** `src/app/(search-app)/services/page.tsx` -> `/services`; the group page -> `/`. */
function routePathname(routeAbs: string): string {
  const rel = path.relative(APP_DIR, routeAbs).replaceAll(path.sep, "/");
  const segments = rel
    .replace(/\/page\.tsx$/, "")
    .split("/")
    .filter((segment) => segment && !segment.startsWith("("));
  return `/${segments.join("/")}`;
}

/**
 * Layouts count toward reachability only for dashboard-owned routes.
 *
 * In App Router a page's output includes its layouts, and the root dashboard
 * route depends on that: `(search-app)/page.tsx` renders only a pass-through and
 * its band arrives through the group layout's shared shell.
 *
 * But that layout transitively imports `ClinicalDashboard`, so following it for
 * *every* route made the gate worthless — a namespaced page could be reduced to
 * `<div />` and still "reach" the band. Page-owned result surfaces must reach
 * the band through their own page:
 * - `isAlwaysStandaloneShellPath` — never mounts the dashboard (services, forms, …)
 * - `isStandaloneModeHomePath` — mode homes with their own results page, including
 *   `/tools`, which is intentionally outside the always-standalone Suspense list
 *   but still mounts `ApplicationsLauncherPage` rather than the dashboard body
 */
function reachabilityRoots(routeAbs: string): string[] {
  const pathname = routePathname(routeAbs);
  if (isAlwaysStandaloneShellPath(pathname) || isStandaloneModeHomePath(pathname)) return [routeAbs];
  const layouts: string[] = [];
  let dir = path.dirname(routeAbs);
  while (dir.startsWith(APP_DIR)) {
    const candidate = path.join(dir, "layout.tsx");
    if (existsSync(candidate)) layouts.push(candidate);
    if (dir === APP_DIR) break;
    dir = path.dirname(dir);
  }
  return [routeAbs, ...layouts];
}

/** `from "x"` and `import("x")`. The lazy form is load-bearing: the dashboard
    code-splits its mode workspaces through `dynamic(() => import(...))` in
    `clinical-dashboard-lazy.tsx`, so a static-only walk cannot see the band
    behind Differentials, Favourites or the prescribing workspace. */
const IMPORT_SPECIFIER = /(?:from\s*"([^"]+)")|(?:import\(\s*"([^"]+)"\s*\))/g;

function resolveSpecifier(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(REPO_ROOT, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;
  const candidates = [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/**
 * Breadth-first search from a route (and its layouts) to a rendered band.
 *
 * The previous implementation hard-coded two hops into `@/components/**`. The
 * real chain on the root dashboard route is four —
 * `layout → shared-search-app-shell → global-search-shell → ClinicalDashboard →
 * document-search-results` — so a fixed hop count silently under-reported
 * reachability rather than failing loudly.
 */
const MAX_IMPORT_DEPTH = 8;

function routeReachesBand(routeAbs: string): boolean {
  const roots = reachabilityRoots(routeAbs);
  const seen = new Set(roots);
  let frontier = roots.map((file) => ({ file, depth: 0 }));
  while (frontier.length > 0) {
    const next: Array<{ file: string; depth: number }> = [];
    for (const { file, depth } of frontier) {
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (rendersBand(source)) return true;
      if (depth >= MAX_IMPORT_DEPTH) continue;
      for (const match of source.matchAll(IMPORT_SPECIFIER)) {
        const specifier = match[1] ?? match[2];
        if (!specifier) continue;
        const target = resolveSpecifier(specifier, file);
        if (!target || seen.has(target) || isMockupPath(target)) continue;
        seen.add(target);
        next.push({ file: target, depth: depth + 1 });
      }
    }
    frontier = next;
  }
  return false;
}

describe("search results band adoption", () => {
  const productionComponents = walk(COMPONENTS_DIR)
    .map((abs) => ({ abs, rel: path.relative(REPO_ROOT, abs) }))
    .filter(({ rel }) => !isMockupPath(rel));

  it("mounts the shared band on every mode that presents a result list", () => {
    const mounted = new Set<string>();
    for (const { abs } of productionComponents) {
      const source = readFileSync(abs, "utf8");
      if (!rendersBand(source)) continue;
      for (const modeId of collectBandModeIds(source)) mounted.add(modeId);
    }

    const expected = appModeDefinitions
      .filter((mode) => mode.search.resultsSurface === "results-band")
      .map((mode) => mode.id);
    const missing = expected.filter((modeId) => !mounted.has(modeId));

    expect(
      missing,
      `These modes declare resultsSurface: "results-band" but no production component renders ` +
        `<${BAND_IDENTIFIER} modeId="…"> for them. A result list without the band can report ` +
        `"0 matches" for a search that failed. Mount the band, or change the mode's resultsSurface.`,
    ).toEqual([]);
  });

  it("reaches the band from every production search route", () => {
    const nestedSearchRoutes = walk(APP_DIR)
      .map((abs) => ({ abs, rel: path.relative(REPO_ROOT, abs).replaceAll(path.sep, "/") }))
      .filter(({ rel }) => !isMockupPath(rel))
      .filter(({ rel }) => rel.includes("/search/") && rel.endsWith("page.tsx"));

    // Top-level mode homes such as /services and /favourites also present result
    // lists. Restricting the inventory to `/search/` left those pages unchecked.
    // An href-less mode (Documents) is served by the root dashboard route, so it
    // resolves to the same page as the query-backed hrefs rather than dropping out.
    const modeHomeRoutes = appModeDefinitions
      .filter((mode) => mode.search.resultsSurface === "results-band")
      .map((mode) => modeHrefToPagePath("href" in mode && typeof mode.href === "string" ? mode.href : null))
      .filter((rel): rel is string => Boolean(rel))
      .map((rel) => ({ abs: path.join(REPO_ROOT, rel), rel }));

    const routeKeys = new Map<string, { abs: string; rel: string }>();
    for (const route of [...nestedSearchRoutes, ...modeHomeRoutes]) {
      routeKeys.set(route.rel, route);
    }
    const searchRoutes = [...routeKeys.values()];

    // If this ever hits zero the assertion below passes vacuously, which would
    // make the gate silently useless.
    expect(searchRoutes.length).toBeGreaterThan(0);
    expect(
      searchRoutes.some((route) => route.rel === "src/app/(search-app)/services/page.tsx"),
      "Mode-href discovery must include top-level results pages such as /services.",
    ).toBe(true);
    // Query-backed and href-less modes (`/?mode=prescribing`, Documents) are all
    // served by the root dashboard route. Leaving it out is how the gate could
    // report "every production search route" while never checking that page.
    expect(
      searchRoutes.some((route) => route.rel === "src/app/(search-app)/page.tsx"),
      "Mode-href discovery must include the root dashboard route that serves query-backed modes.",
    ).toBe(true);

    const orphans: string[] = [];
    for (const { abs, rel } of searchRoutes) {
      if (BAND_ROUTE_ALLOWLIST.has(rel)) continue;
      if (!routeReachesBand(abs)) orphans.push(rel);
    }

    expect(
      orphans,
      `These search routes never reach <${BAND_IDENTIFIER}>. Mount the band, or add a documented ` +
        `entry to BAND_ROUTE_ALLOWLIST in this file explaining why the route has no result list.`,
    ).toEqual([]);
  });

  it("keeps the band's forced-colors rules inside the final forced-colors block", () => {
    // At equal specificity a later rule wins, so a forced-colors block placed
    // before another one is silently overridden while still reading correctly.
    const globals = readFileSync(path.join(REPO_ROOT, "src", "app", "globals.css"), "utf8");
    const forcedColorsOpeners = [...globals.matchAll(/@media \(forced-colors: active\)/g)].map(
      (match) => match.index ?? -1,
    );
    expect(forcedColorsOpeners.length).toBeGreaterThan(0);

    const lastOpener = forcedColorsOpeners[forcedColorsOpeners.length - 1];
    let depth = 0;
    let lastCloser = -1;
    for (let index = lastOpener; index < globals.length; index += 1) {
      const char = globals[index];
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          lastCloser = index;
          break;
        }
      }
    }
    expect(lastCloser).toBeGreaterThan(lastOpener);

    const bandRule = globals.indexOf(".search-band", lastOpener);
    expect(
      bandRule,
      "The band's forced-colors rules must exist inside the last @media (forced-colors: active) " +
        "block, or an earlier block at equal specificity will override them.",
    ).toBeGreaterThan(lastOpener);
    expect(bandRule).toBeLessThan(lastCloser);
  });
});

describe("band adoption detection", () => {
  // Negative fixture: importing or mentioning the identifier is not adoption.
  // Without this, the gate above passes on a route that never mounts the band.
  it("does not count an import, comment, or dead reference as a mount", () => {
    const imported =
      'import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";';
    const mentioned = "// SearchResultsHeaderBand is rendered by the shell, not here.";
    const referenced = "const Band = SearchResultsHeaderBand;";
    const mounted = '<SearchResultsHeaderBand modeId="services" query={q} matchCount={0} />';

    for (const source of [imported, mentioned, referenced]) {
      expect(source.includes("<SearchResultsHeaderBand"), source.slice(0, 40)).toBe(false);
    }
    expect(mounted.includes("<SearchResultsHeaderBand")).toBe(true);
  });

  it("counts layouts only for dashboard-owned routes", () => {
    // The group layout transitively imports ClinicalDashboard, so following it
    // for every route would let any page under (search-app) pass while rendering
    // nothing. Verified by gutting services/page.tsx to `<div />`: with layouts
    // followed unconditionally the gate still passed; scoped to dashboard-owned
    // routes it reports that page as an orphan.
    const standalone = path.join(APP_DIR, "(search-app)", "services", "page.tsx");
    expect(reachabilityRoots(standalone)).toEqual([standalone]);

    // `/tools` is a standalone mode home but not always-standalone (Suspense
    // boundary differs). It must still be page-only — otherwise gutting
    // tools/page.tsx stays green via the layout → dashboard import chain.
    const tools = path.join(APP_DIR, "(search-app)", "tools", "page.tsx");
    expect(reachabilityRoots(tools)).toEqual([tools]);

    // The root dashboard route is the case that genuinely needs its layout: the
    // page renders only a pass-through and the band arrives via the shared shell.
    const rootRoute = path.join(APP_DIR, "(search-app)", "page.tsx");
    const rootRoots = reachabilityRoots(rootRoute);
    expect(rootRoots[0]).toBe(rootRoute);
    expect(rootRoots.length).toBeGreaterThan(1);
    expect(rootRoots.some((file) => file.endsWith(`(search-app)${path.sep}layout.tsx`))).toBe(true);
  });

  it("resolves a route to the band through imports, and reports one that never gets there", () => {
    // Real files on disk, because the walker resolves specifiers rather than
    // consulting a map. Both directions are asserted: a fixture that only ever
    // returns false would pass against a walker that is broken outright.
    const dir = mkdtempSync(path.join(tmpdir(), "band-adoption-"));
    try {
      writeFileSync(
        path.join(dir, "child.tsx"),
        "export function Child() { return <div data-testid='child' />; }\n",
        "utf8",
      );
      writeFileSync(
        path.join(dir, "orphan-route.tsx"),
        'import { Child } from "./child";\nexport default Child;\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "orphan-route.tsx"))).toBe(false);

      // Same shape, but the child mounts the band — and via a lazy import, which
      // is how the dashboard code-splits its mode workspaces.
      writeFileSync(
        path.join(dir, "banded-child.tsx"),
        `export function Banded() { return <${BAND_IDENTIFIER} modeId="documents" />; }\n`,
        "utf8",
      );
      writeFileSync(
        path.join(dir, "wired-route.tsx"),
        'const Lazy = () => import("./banded-child");\nexport default Lazy;\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "wired-route.tsx"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
