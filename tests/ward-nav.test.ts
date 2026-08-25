import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { WARD_NAV, WARD_NAV_INTENTIONALLY_UNLISTED } from "../src/components/ward-management/ward-nav";

const REPO_ROOT = path.resolve(__dirname, "..");
const WARD_FLOW_ROOT = path.join(REPO_ROOT, "src", "app", "mockups", "ward-flow");
const ROUTE_PREFIX = "/mockups/ward-flow";

type WardFlowRoute = { route: string; dynamic: boolean };

/**
 * Recursively collects every `page.tsx` under the Ward Flow route tree and converts its file path
 * into the route it serves. Enumerated straight from the filesystem, **never** a hand-written
 * list — a hand-written list of routes is exactly the shape of the D8 defect this file exists to
 * prevent from recurring: a route that nobody remembered to add to the list stays invisible to
 * both sides of the check.
 */
function collectWardFlowRoutes(dir: string, segments: string[] = []): WardFlowRoute[] {
  const routes: WardFlowRoute[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      routes.push(...collectWardFlowRoutes(path.join(dir, entry.name), [...segments, entry.name]));
    } else if (entry.name === "page.tsx") {
      const dynamic = segments.some((segment) => segment.startsWith("[") && segment.endsWith("]"));
      const route = segments.length === 0 ? ROUTE_PREFIX : `${ROUTE_PREFIX}/${segments.join("/")}`;
      routes.push({ route, dynamic });
    }
  }
  return routes;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Converts a dynamic route like `/mockups/ward-flow/ward/[unitId]` into a matcher for any one
 *  concrete instance, e.g. `/mockups/ward-flow/ward/rph-adult-secure`. */
function routeToPattern(route: string): RegExp {
  const pattern = route
    .split("/")
    .map((segment) => (/^\[.+\]$/.test(segment) ? "[^/]+" : escapeRegex(segment)))
    .join("/");
  return new RegExp(`^${pattern}$`);
}

const wardFlowRoutes = collectWardFlowRoutes(WARD_FLOW_ROOT);
const staticRoutes = wardFlowRoutes.filter((entry) => !entry.dynamic).map((entry) => entry.route);
const dynamicPatterns = wardFlowRoutes.filter((entry) => entry.dynamic).map((entry) => routeToPattern(entry.route));

describe("Ward Flow route enumeration (sanity check on the scan itself)", () => {
  it("finds every known page.tsx under src/app/mockups/ward-flow, both static and dynamic", () => {
    // 16 page.tsx files measured on this branch at HEAD: 13 static + 3 dynamic
    // (ed/[edId], patients/[patientId], ward/[unitId]). A silently broken scan (e.g. resolving
    // the wrong directory) would collapse this to 0 or a handful, and every assertion below would
    // then vacuously pass — so this is checked before trusting any of them.
    expect(wardFlowRoutes.length).toBe(16);
    expect(staticRoutes).toContain(ROUTE_PREFIX);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/handover`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/escalation`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/search`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/transport/officer`);
    expect(dynamicPatterns.some((pattern) => pattern.test(`${ROUTE_PREFIX}/ward/rph-adult-secure`))).toBe(true);
    expect(dynamicPatterns.some((pattern) => pattern.test(`${ROUTE_PREFIX}/ed/peel-ed`))).toBe(true);
  });
});

describe("Ward Flow navigation — single source (ward-nav.ts)", () => {
  // Direction 1: every WARD_NAV href must be a real route (static or one instance of a dynamic
  // route). This is the direction a purely "does every link work" check would already cover.
  it("every WARD_NAV href resolves to a real route under src/app/mockups/ward-flow/", () => {
    const unresolved = WARD_NAV.filter(
      (item) => !staticRoutes.includes(item.href) && !dynamicPatterns.some((pattern) => pattern.test(item.href)),
    ).map((item) => item.href);
    expect(unresolved, `WARD_NAV href(s) with no matching route: ${unresolved.join(", ")}`).toEqual([]);
  });

  // Direction 2: every real STATIC route must appear in WARD_NAV or be recorded as intentionally
  // unlisted with a reason. This is the direction a one-way "is every link real" check cannot
  // see — and its absence is exactly how D8 shipped three boards with no rail entry.
  it("every static Ward Flow route appears in WARD_NAV or is recorded as intentionally unlisted", () => {
    const navHrefs = new Set(WARD_NAV.map((item) => item.href));
    const missing = staticRoutes.filter((route) => !navHrefs.has(route) && !WARD_NAV_INTENTIONALLY_UNLISTED.has(route));
    expect(
      missing,
      `Static Ward Flow route(s) in neither WARD_NAV nor WARD_NAV_INTENTIONALLY_UNLISTED: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("WARD_NAV_INTENTIONALLY_UNLISTED has no stale entries, no empty reasons, and never overlaps WARD_NAV", () => {
    const navHrefs = new Set(WARD_NAV.map((item) => item.href));
    for (const [route, reason] of WARD_NAV_INTENTIONALLY_UNLISTED) {
      expect(
        staticRoutes,
        `${route} is recorded as intentionally unlisted but is no longer a static Ward Flow route`,
      ).toContain(route);
      expect(reason.trim().length, `${route}'s intentionally-unlisted reason is empty`).toBeGreaterThan(0);
      expect(navHrefs.has(route), `${route} is in both WARD_NAV and WARD_NAV_INTENTIONALLY_UNLISTED — pick one`).toBe(
        false,
      );
    }
  });

  it("WARD_NAV item ids and hrefs are each unique", () => {
    expect(new Set(WARD_NAV.map((item) => item.id)).size).toBe(WARD_NAV.length);
    expect(new Set(WARD_NAV.map((item) => item.href)).size).toBe(WARD_NAV.length);
  });

  it("marks exactly the two arbitrary hardcoded instances exampleOnly (D10), and nothing else", () => {
    const exampleOnlyHrefs = WARD_NAV.filter((item) => item.exampleOnly)
      .map((item) => item.href)
      .sort();
    expect(exampleOnlyHrefs).toEqual(
      ["/mockups/ward-flow/ed/peel-ed", "/mockups/ward-flow/ward/rph-adult-secure"].sort(),
    );
  });

  it("groups every item as either a role screen or a specialist board", () => {
    for (const item of WARD_NAV) {
      expect(["role", "board"]).toContain(item.group);
    }
  });
});

describe("ClinicalRail's aria-label is honest for a sandboxed prototype (D11)", () => {
  const source = readFileSync(
    path.join(REPO_ROOT, "src/components/ward-management/ward-management-navigation.tsx"),
    "utf8",
  );

  it("no longer claims Ward Flow is a clinical application", () => {
    expect(source).not.toContain("Clinical applications");
  });

  it("labels the app-switcher nav with an honest, non-clinical name", () => {
    expect(source).toContain('aria-label="Applications"');
  });
});
