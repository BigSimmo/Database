import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { appModeDefinitions } from "@/lib/app-modes";

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

/** Resolve a mode href like `/services` to its App Router page file when present. */
function modeHrefToPagePath(href: string): string | null {
  const pathOnly = href.split("?")[0]?.trim() ?? "";
  if (!pathOnly.startsWith("/") || pathOnly === "/") return null;
  const candidate = path.join(APP_DIR, "(search-app)", pathOnly.slice(1), "page.tsx");
  if (!existsSync(candidate)) return null;
  return path.relative(REPO_ROOT, candidate).replaceAll(path.sep, "/");
}

/** One or two import hops from a route into `@/components/**` that mounts the band. */
function routeReachesBand(routeSource: string, componentSources: Map<string, string>) {
  if (rendersBand(routeSource)) return true;
  const imported = [...routeSource.matchAll(/from "@\/(components\/[^"]+)"/g)].map((match) => match[1]);
  for (const specifier of imported) {
    const componentPath = `src/${specifier}.tsx`;
    const source = componentSources.get(componentPath);
    if (!source) continue;
    if (rendersBand(source)) return true;
    // Page wrappers often re-export a child that mounts the band (e.g. differentials).
    const nested = [...source.matchAll(/from "@\/(components\/[^"]+)"/g)].map((match) => match[1]);
    if (
      nested.some((nestedSpec) => {
        const nestedSource = componentSources.get(`src/${nestedSpec}.tsx`);
        return nestedSource ? rendersBand(nestedSource) : false;
      })
    ) {
      return true;
    }
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
    const modeHomeRoutes = appModeDefinitions
      .filter((mode) => mode.search.resultsSurface === "results-band")
      .map((mode) => ("href" in mode && typeof mode.href === "string" ? modeHrefToPagePath(mode.href) : null))
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

    const componentSources = new Map(
      productionComponents.map(({ abs, rel }) => [rel.replaceAll(path.sep, "/"), readFileSync(abs, "utf8")]),
    );

    const orphans: string[] = [];
    for (const { abs, rel } of searchRoutes) {
      if (BAND_ROUTE_ALLOWLIST.has(rel)) continue;
      const routeSource = readFileSync(abs, "utf8");
      if (!routeReachesBand(routeSource, componentSources)) orphans.push(rel);
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

  it("treats a root-level mode page that never reaches the band as an orphan", () => {
    const componentSources = new Map<string, string>([
      [
        "src/components/orphan-results-page.tsx",
        'export function OrphanResultsPage() { return <div data-testid="orphan-results" />; }',
      ],
    ]);
    const routeSource =
      'import { OrphanResultsPage } from "@/components/orphan-results-page";\nexport default OrphanResultsPage;';
    expect(routeReachesBand(routeSource, componentSources)).toBe(false);
  });
});
