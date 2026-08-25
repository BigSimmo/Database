import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Task 7 (D8). Same "SSR-string component test" pattern tests/ward-landmarks.test.ts uses (see
 * that file's own header comment for the full reasoning): this file is `.test.ts`, so it
 * collects under vitest.config.mts's "node" project rather than jsdom, and `renderToStaticMarkup`
 * renders each route's real component tree to a string without needing `document`. The two
 * mocks below are the same ones that file needs for the same reasons: `ClinicalRail` renders
 * `next/link` anchors, and `ContextualBackLink` (mounted by `WardPatientWorkspace`) calls
 * `next/navigation`'s `useRouter` synchronously during render.
 */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { EscalationBoardPage } from "@/components/ward-management/escalation/escalation-board";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { LiveTracker } from "@/components/ward-management/tracker/live-tracker";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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

/**
 * Task 7 (D8). `aria-label="Ward Flow views"` is `WardModeNavigation`'s nav, mounted inside
 * `ClinicalRail` — the in-page navigation between Ward Flow's boards. It used to render only when
 * a screen passed `ClinicalRail` an `activeMode`, which only the eight `WardModeWorkspace`
 * screens plus the coordinator root and the live tracker did; the other six screens (the four
 * detail/role screens and two boards below) called `<ClinicalRail />` with no `activeMode` and
 * silently got no nav at all — a defect a user feels, because the rail alone never says which
 * board they are on.
 *
 * **Ruling (recorded here, the one place this decision needs to live): adopt the nav on every
 * route rather than carve out an exemption.** `ClinicalRail` now renders `WardModeNavigation`
 * unconditionally (see its own doc comment) instead of only when `activeMode` is set — no route
 * is exempt, so `WARD_NAV_INTENTIONALLY_UNLISTED`-style exemption data was not needed for this
 * decision. If a future screen needs to opt out, that exemption must be added here as data with a
 * reason, not created by a screen quietly omitting `activeMode` again.
 */
type RouteRender = { route: string; render: () => ReactNode };

const RENDERABLE_ROUTES: RouteRender[] = [
  { route: ROUTE_PREFIX, render: () => createElement(CoordinatorScreen) },
  { route: `${ROUTE_PREFIX}/queue`, render: () => createElement(WardModeWorkspace, { mode: "queue" }) },
  { route: `${ROUTE_PREFIX}/capacity`, render: () => createElement(WardModeWorkspace, { mode: "capacity" }) },
  { route: `${ROUTE_PREFIX}/governance`, render: () => createElement(WardModeWorkspace, { mode: "governance" }) },
  { route: `${ROUTE_PREFIX}/movements`, render: () => createElement(WardModeWorkspace, { mode: "movements" }) },
  { route: `${ROUTE_PREFIX}/network`, render: () => createElement(WardModeWorkspace, { mode: "network" }) },
  { route: `${ROUTE_PREFIX}/exceptions`, render: () => createElement(WardModeWorkspace, { mode: "exceptions" }) },
  { route: `${ROUTE_PREFIX}/ed/[edId]`, render: () => createElement(EdScreen, { edId: "peel-ed" }) },
  { route: `${ROUTE_PREFIX}/escalation`, render: () => createElement(EscalationBoardPage) },
  { route: `${ROUTE_PREFIX}/handover`, render: () => createElement(HandoverPage) },
  { route: `${ROUTE_PREFIX}/search`, render: () => createElement(PatientSearchPage) },
  { route: `${ROUTE_PREFIX}/transport`, render: () => createElement(LiveTracker) },
  { route: `${ROUTE_PREFIX}/transport/officer`, render: () => createElement(OfficerScreen) },
  { route: `${ROUTE_PREFIX}/ward/[unitId]`, render: () => createElement(WardScreen, { unitId: "rph-adult-secure" }) },
  {
    route: `${ROUTE_PREFIX}/patients/[patientId]`,
    render: () => createElement(WardPatientWorkspace, { patientId: "WF-001" }),
  },
];

describe("Ward Flow route/render-map coverage (D8 nav check — sanity check on the map)", () => {
  it("RENDERABLE_ROUTES covers every route the filesystem scan found except the redirect-only stub, and nothing else", () => {
    const scanned = new Set(wardFlowRoutes.map((entry) => entry.route));
    const mapped = new Set(RENDERABLE_ROUTES.map((entry) => entry.route));
    const redirectOnly = `${ROUTE_PREFIX}/constellation`;
    const uncovered = [...scanned].filter((route) => route !== redirectOnly && !mapped.has(route));
    const stale = [...mapped].filter((route) => !scanned.has(route));
    expect(uncovered, `route(s) on disk with no test coverage: ${uncovered.join(", ")}`).toEqual([]);
    expect(stale, `mapped route(s) no longer on disk: ${stale.join(", ")}`).toEqual([]);
    expect(RENDERABLE_ROUTES.length).toBe(15);
  });
});

describe("Every Ward Flow route carries the 'Ward Flow views' in-page nav (D8)", () => {
  for (const entry of RENDERABLE_ROUTES) {
    it(`renders the Ward Flow views nav on ${entry.route}`, () => {
      const markup = renderToStaticMarkup(
        createElement(WardFlowProvider, { initialNow: NOW_ANCHOR, children: entry.render() }),
      );
      const matches = markup.match(/aria-label="Ward Flow views"/g) ?? [];
      expect(
        matches.length,
        `expected exactly one "Ward Flow views" nav on ${entry.route}, found ${matches.length}`,
      ).toBe(1);
    });
  }
});
