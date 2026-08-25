import { readdirSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Task 5/6 (D5, D6, D7). This file is `.test.ts`, not `.dom.test.tsx`, so it collects under
 * vitest.config.mts's "node" project (no jsdom, no DOM globals) rather than the "jsdom" project
 * the sibling `*.dom.test.tsx` suites use. `renderToStaticMarkup` renders the real component tree
 * to an HTML string without needing `document` — the same "SSR-string component test" pattern
 * already established in this repo (see tests/route-error-boundary.test.ts and vitest.config.mts's
 * own "pure logic + route + SSR-string component tests" comment) — and the landmark/heading counts
 * are read back from that string. `.ts` cannot contain JSX, so every element below is built with
 * `createElement` instead, exactly like route-error-boundary.test.ts does.
 *
 * `renderToStaticMarkup` never runs effects (`useEffect`/`useLayoutEffect`), so any `window.`/
 * `document.` access confined to an effect or an event handler is safe here — checked directly
 * against every file in RENDERABLE_ROUTES below (coordinator-screen.tsx's `window.matchMedia`,
 * handover-page.tsx's `window.print`, ward-role-switcher.tsx's and ward-demo-controls.tsx's
 * `document.addEventListener`, all effect/handler-only). `next/navigation`'s `useRouter` is
 * different: `ContextualBackLink` (used by `WardPatientWorkspace`) calls it synchronously during
 * render, so it needs the same module mock tests/ward-patient-page.dom.test.tsx already uses.
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

const REPO_ROOT = path.resolve(__dirname, "..");
const WARD_FLOW_ROOT = path.join(REPO_ROOT, "src", "app", "mockups", "ward-flow");
const ROUTE_PREFIX = "/mockups/ward-flow";

type WardFlowRoute = { route: string; dynamic: boolean };

/**
 * Same scan as tests/ward-nav.test.ts's `collectWardFlowRoutes` — deliberately duplicated rather
 * than imported, matching that file's own established pattern of every structural-contract test
 * owning its own filesystem scan, so a change to one enumeration can never silently blind the
 * other. Enumerated straight from the filesystem, never a hand-written list.
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

const wardFlowRoutes = collectWardFlowRoutes(WARD_FLOW_ROOT);

/**
 * `/mockups/ward-flow/constellation` is a `redirect()`-only stub (its own doc comment: "Phase 2
 * retired the constellation command view into the coordinator screen and the network diagram. The
 * route stays as a bookmark/deep-link backstop..."). It renders no landmark, no heading, and no
 * nav of its own — it is not one of the 15 live routes the D5/D7/D8 measurements are about.
 * Recorded here, by name, with a reason, rather than silently missing from RENDERABLE_ROUTES: the
 * coverage test below fails loudly if this set and the filesystem scan ever disagree on anything
 * else.
 */
const REDIRECT_ONLY_ROUTES = new Set<string>([`${ROUTE_PREFIX}/constellation`]);

type RouteRender = { route: string; render: () => ReactNode };

/**
 * One entry per real, renderable Ward Flow page — the same component each page.tsx under
 * src/app/mockups/ward-flow/ actually mounts (checked against every page.tsx file directly), with
 * real fixture ids standing in for the two dynamic segments: `peel-ed` and `rph-adult-secure`, the
 * same instances tests/ward-nav.test.ts and the sibling `*.dom.test.tsx` suites already use, and
 * `WF-001` for the patient workspace's movement id (tests/ward-patient-page.dom.test.tsx uses the
 * same fixture movement as `patientId`). This mapping is checked against the filesystem scan in
 * the coverage test below — a route with no entry here, or an entry with no matching route, fails
 * that test rather than silently under- or over-counting.
 */
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

describe("Ward Flow route/render-map coverage (sanity check on the scan and the map)", () => {
  it("finds every known page.tsx under src/app/mockups/ward-flow: 16 measured on this branch (15 renderable + 1 redirect-only)", () => {
    // A silently broken scan (wrong directory, wrong glob) would collapse this to 0 or a handful,
    // and every assertion below would then vacuously pass — so this is checked before trusting
    // any of them. Mirrors tests/ward-nav.test.ts's own sanity count.
    expect(wardFlowRoutes.length).toBe(16);
  });

  it("RENDERABLE_ROUTES plus REDIRECT_ONLY_ROUTES covers every route the scan found, and nothing else", () => {
    const scanned = new Set(wardFlowRoutes.map((entry) => entry.route));
    const mapped = new Set<string>([...RENDERABLE_ROUTES.map((entry) => entry.route), ...REDIRECT_ONLY_ROUTES]);
    const uncovered = [...scanned].filter((route) => !mapped.has(route));
    const stale = [...mapped].filter((route) => !scanned.has(route));
    expect(uncovered, `route(s) on disk with no test coverage: ${uncovered.join(", ")}`).toEqual([]);
    expect(stale, `mapped route(s) no longer on disk: ${stale.join(", ")}`).toEqual([]);
  });

  it("RENDERABLE_ROUTES has exactly 15 entries, one per live route", () => {
    expect(RENDERABLE_ROUTES.length).toBe(15);
  });
});

function renderRoute(entry: RouteRender): string {
  return renderToStaticMarkup(createElement(WardFlowProvider, { initialNow: NOW_ANCHOR, children: entry.render() }));
}

describe("Every Ward Flow route has exactly one #main-content skip-link target (D5, D6)", () => {
  for (const entry of RENDERABLE_ROUTES) {
    it(`renders exactly one <main id="main-content"> on ${entry.route}`, () => {
      const markup = renderRoute(entry);
      const matches = markup.match(/<main\b[^>]*\bid="main-content"/g) ?? [];
      expect(
        matches.length,
        `expected exactly one <main id="main-content"> on ${entry.route}, found ${matches.length}`,
      ).toBe(1);
    });
  }
});

// Task 6 (D7). Every Ward Flow route needs a heading a screen reader can jump straight to, and
// exactly one — a second <h1> is as much a defect as none, for the same reason a duplicated
// #main-content landmark is (see the describe block above).
describe("Every Ward Flow route has exactly one <h1> (D7)", () => {
  for (const entry of RENDERABLE_ROUTES) {
    it(`renders exactly one <h1> on ${entry.route}`, () => {
      const markup = renderRoute(entry);
      const matches = markup.match(/<h1\b/g) ?? [];
      expect(matches.length, `expected exactly one <h1> on ${entry.route}, found ${matches.length}`).toBe(1);
    });
  }
});
