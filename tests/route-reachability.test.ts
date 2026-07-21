import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { appModeDefinitions, appModeHomeHref } from "@/lib/app-modes";
import { tools } from "@/components/tools-page-mockups/tool-fixtures";
import { collectSiteMapData } from "../scripts/generate-site-map";

/**
 * Orphan-route guard. `site-map.test.ts` proves every route is *documented*;
 * this proves every static production page route is *reachable* — i.e. some
 * in-app navigation actually links to it. A page you can only reach by typing
 * its URL (the `/tools` class) is an orphan and must be either wired into nav
 * or added, with a reason, to REACHABILITY_ALLOWLIST below.
 *
 * Scope: static page routes only. Dynamic `[slug]` detail routes are reached
 * via href builders from live/seeded data (`universal-search.ts`, registry
 * loaders); their targets are covered by `site-map.test.ts`'s documented-href
 * assertions, and pattern-matching interpolated hrefs here would be brittle.
 * Mockups (`src/app/mockups/**`, `*-mockups/**`) are design-scratch and 404 in
 * production, so a link *from* a mockup does not count and mockup routes are
 * not required to be linked.
 */

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");

/** Intentionally-unlinked static page routes, each with the reason it is exempt. */
const REACHABILITY_ALLOWLIST = new Map<string, string>([
  [
    "/tools",
    "Orphan parallel to /?mode=tools; nothing links to the standalone page. Tracked as issue #007 (decide the canonical Tools entry point). Reachable via URL and the /applications redirect.",
  ],
  [
    "/documents/source",
    "Legacy compatibility redirect target reached by external/legacy deep links, not in-app navigation (frontend-architecture.md).",
  ],
  [
    "/documents/source/evidence",
    "Legacy compatibility redirect target reached by external/legacy deep links, not in-app navigation (frontend-architecture.md).",
  ],
]);

function isMockupPath(relPosix: string) {
  return relPosix.toLowerCase().includes("mockup");
}

function pathOnly(href: string) {
  return href.split(/[?#]/)[0] || "/";
}

function collectSourceFiles(dir: string): { rel: string; content: string }[] {
  const out: { rel: string; content: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(abs));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      const rel = path.relative(repoRoot, abs).split(path.sep).join("/");
      if (!isMockupPath(rel)) out.push({ rel, content: readFileSync(abs, "utf8") });
    }
  }
  return out;
}

const sourceFiles = collectSourceFiles(srcRoot);

/** Route targets produced by the canonical nav builders (never bare string literals). */
const builderTargets = new Set<string>();
for (const mode of appModeDefinitions) {
  // Record both the default home path and a query-bearing variant: appModeHomeHref
  // can emit a different path when given a query (e.g. document / namespaced-search
  // routes), and those are valid static targets that must not read as orphaned.
  const hrefs = [
    ("href" in mode ? mode.href : undefined) ?? appModeHomeHref(mode.id),
    appModeHomeHref(mode.id, { query: "__reachability__" }),
  ];
  for (const href of hrefs) builderTargets.add(pathOnly(href));
}
for (const tool of tools) builderTargets.add(pathOnly(tool.href));

// Therapy Compass owns a self-contained route family whose fixed screens are
// navigated via a local `screenHref(screen)` builder (`go*()` → router.push),
// so the sub-route paths never appear as literals a static scan could see. Read
// the family's reserved segments straight from the source of truth so new screens
// are picked up automatically. See src/components/therapy-compass/bindings.tsx.
const tcBindingsSrc = readFileSync(path.join(srcRoot, "components/therapy-compass/bindings.tsx"), "utf8");
const tcBaseMatch = tcBindingsSrc.match(/const BASE = "([^"]+)"/);
const tcReservedMatch = tcBindingsSrc.match(/RESERVED_SEGMENTS = new Set\(\[([^\]]*)]\)/);
// Fail loudly if the source shape changed: a silent `?? default` / empty fallback
// would drop every reserved Therapy Compass route from the guard without notice.
if (!tcBaseMatch || !tcReservedMatch) {
  throw new Error(
    "route-reachability: could not parse BASE / RESERVED_SEGMENTS from therapy-compass/bindings.tsx — " +
      "update this parser to match the current source so reserved routes stay covered.",
  );
}
const tcBase = tcBaseMatch[1];
const tcReservedSegments = [...tcReservedMatch[1].matchAll(/"([^"]+)"/g)];
if (tcReservedSegments.length === 0) {
  throw new Error(
    "route-reachability: RESERVED_SEGMENTS parsed to an empty set — Therapy Compass routes would be unchecked.",
  );
}
for (const match of tcReservedSegments) {
  builderTargets.add(`${tcBase}/${match[1]}`);
}

/** A route is reachable if a builder emits it, or a non-mockup source file links to it. */
function referenceRegExp(route: string) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Require a navigation context immediately before the path literal — an `href`
  // attribute/prop or a router/redirect call — so that route-ownership checks
  // (`pathname === "/tools"`), switch cases, and comment mentions do NOT count as
  // a link. Left boundary is the opening quote/backtick; the right boundary
  // forbids a path-continuation char so `/dsm/compare` does not match inside
  // `/dsm/comparexyz` but does match `/dsm/compare"` or `/dsm/compare?q=…`.
  const navLeadIn = "(?:href\\s*[=:]\\s*\\{?\\s*|(?:push|replace|prefetch|redirect|permanentRedirect)\\s*\\(\\s*)";
  return new RegExp(navLeadIn + "[\"'`]" + escaped + "(?![A-Za-z0-9_\\-/])");
}

function isReachable(route: string, selfFile: string) {
  if (builderTargets.has(route)) return true;
  const re = referenceRegExp(route);
  return sourceFiles.some((file) => file.rel !== selfFile && re.test(file.content));
}

const staticPageRoutes = collectSiteMapData()
  .pageRoutes.map((route) => ({ route: route.route, file: route.file.split(path.sep).join("/") }))
  .filter(
    (entry) =>
      entry.route !== "/" && // app root, trivially the entry point
      !entry.route.includes("[") && // dynamic families reached via builders (see header)
      !entry.route.startsWith("/mockups"),
  );

describe("route reachability", () => {
  it("every static production page route is linked from in-app navigation", () => {
    const orphans = staticPageRoutes
      .filter((entry) => !REACHABILITY_ALLOWLIST.has(entry.route))
      .filter((entry) => !isReachable(entry.route, entry.file))
      .map((entry) => entry.route);

    expect(
      orphans,
      `Orphan page route(s) with no inbound <Link>/router.push/redirect. Wire them into nav ` +
        `(sidebar/launcher/mode home/search), or add to REACHABILITY_ALLOWLIST with a reason: ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("reachability allowlist has no stale entries", () => {
    const routes = new Set(staticPageRoutes.map((entry) => entry.route));
    for (const route of REACHABILITY_ALLOWLIST.keys()) {
      expect(routes.has(route), `${route} is allowlisted but is no longer a static page route`).toBe(true);
    }
  });
});
