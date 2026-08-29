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
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { MorningPage } from "@/components/ward-management/morning/morning-page";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { LiveTracker } from "@/components/ward-management/tracker/live-tracker";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";

import {
  WARD_DEVELOPER_HUB_HREF,
  WARD_NAV,
  WARD_NAV_INTENTIONALLY_UNLISTED,
  WARD_REFERRAL_INTAKE_HREF,
  WARD_VIEWS,
} from "../src/components/ward-management/ward-nav";
import { WARD_NAV_ICONS } from "../src/components/ward-management/ward-nav-icons";

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
const dynamicRoutes = wardFlowRoutes.filter((entry) => entry.dynamic).map((entry) => entry.route);
const dynamicPatterns = wardFlowRoutes.filter((entry) => entry.dynamic).map((entry) => routeToPattern(entry.route));

describe("Ward Flow route enumeration (sanity check on the scan itself)", () => {
  it("finds every known page.tsx under src/app/mockups/ward-flow, both static and dynamic", () => {
    // 22 page.tsx files measured on the merged tree: 18 static + 4 dynamic. Both branches added a
    // route independently and both moved this number to 21 for different routes — Phase 8 for the
    // out-of-area ledger, the ward board branch for board/[unitId] — so 22 is the merged truth and
    // neither side's copy held it. Resolved by hand at the fold, taking both nav entries; the count
    // moved only after both routes were confirmed reachable from the rail.
    // (ed/[edId], patients/[patientId], ward/[unitId], board/[unitId]) — Task 6 added the
    // discharges board,
    // Phase 6 Task 2 added the morning bed state page, Phase 7 Task 4 added the referral intake
    // form's route (referrals/new), Phase 7 Task 5 added the referral board's route (referrals),
    // Phase 8 Task 5 added the out-of-area ledger's route (out-of-area), and the ward board
    // branch added the board's route (board/[unitId]).
    // A silently broken scan (e.g. resolving the wrong directory) would collapse this to 0 or a
    // handful, and every assertion below would then vacuously pass — so this is checked before
    // trusting any of them.
    expect(wardFlowRoutes.length).toBe(22);
    expect(staticRoutes).toContain(ROUTE_PREFIX);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/handover`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/escalation`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/search`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/discharges`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/morning`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/referrals/new`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/referrals`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/out-of-area`);
    expect(staticRoutes).toContain(`${ROUTE_PREFIX}/transport/officer`);
    expect(dynamicPatterns.some((pattern) => pattern.test(`${ROUTE_PREFIX}/ward/rph-adult-secure`))).toBe(true);
    expect(dynamicPatterns.some((pattern) => pattern.test(`${ROUTE_PREFIX}/ed/peel-ed`))).toBe(true);
  });
});

/* ------------------------------------------------------------------------------------------ *
 * The DYNAMIC half of the D8 check.
 *
 * `staticRoutes` above is filtered to static routes, so until now a dynamic route was checked for
 * pattern SHAPE only — never for whether anything links it. The one orphan this programme found,
 * the board's ward-detail route, was dynamic, which is exactly why nothing caught it.
 *
 * **What these assertions prove, stated precisely, because the obvious version of this guard is
 * wrong.** A source scan can see that a route is REFERENCED. It cannot see that every instance
 * the route serves is REACHABLE, and the difference is not academic: a link built inside a
 * `.map()` may iterate the whole collection or a context-derived subset of three, and the two are
 * textually identical. `ward-role-switcher.tsx` builds `/mockups/ward-flow/ward/${unit.id}` over
 * `wardCandidates`, which is EMPTY unless a movement is focused and is otherwise that movement's
 * accepted unit or its referred units — nought to three. So `ward/[unitId]` HAS a link builder
 * while twenty-two of its twenty-three wards have no route in at all. A guard reading that
 * builder as reachability would certify those twenty-two as fine, which is the same defect class
 * as the orphan it was written to catch. Nothing below claims reachability.
 *
 * The property that IS mechanical: how many of a route's instances are named by a CONCRETE href
 * somewhere in `src/` — an href a reader can follow with nothing selected and no state at all.
 * That number is computed by the scan, the number of instances is read from the live fixture, and
 * any shortfall must be recorded in `WARD_DYNAMIC_ROUTE_ORPHANS` with BOTH numbers written out in
 * full. A reason can be vague and still satisfy a check; a coverage figure cannot, because the
 * scan recomputes both halves of it and compares them to the words. Seed a twenty-fourth unit and
 * every entry that says "of 23" goes red until somebody re-counts.
 * ------------------------------------------------------------------------------------------ */

const SRC_ROOT = path.join(REPO_ROOT, "src");

/** Every `.ts`/`.tsx` file under `src/`, so a link may live anywhere — the developer hub that
 *  opens the sandbox is not under `src/components/ward-management/`. */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full, acc);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

const sourceFiles = collectSourceFiles(SRC_ROOT);

/** The three characters a JSX/TS href can sit between. Built by concatenation rather than written
 *  into a template literal, because `${` inside one is an interpolation and a regex escape that
 *  survives review can still arrive as a different byte — this project has lost a whole guard to a
 *  literal `\b` becoming 0x08 four times. */
const HREF_QUOTE = "[\"'`]";
/** One concrete path segment: `rph-adult-secure`, `peel-ed`. Deliberately cannot start with `[`,
 *  which is what keeps a prose mention of `/mockups/ward-flow/ward/[unitId]` out of the results. */
const CONCRETE_SEGMENT = "[A-Za-z0-9][A-Za-z0-9._-]*";
/** A template hole: `${unit.id}`. */
const BUILT_SEGMENT = "\\$\\{[^}]*\\}";

function dynamicRouteLinkPatterns(route: string) {
  const base = route
    .split("/")
    .filter((segment) => !/^\[.+\]$/.test(segment))
    .map(escapeRegex)
    .join("/");
  return {
    concrete: new RegExp(HREF_QUOTE + base + "/(" + CONCRETE_SEGMENT + ")" + HREF_QUOTE, "g"),
    built: new RegExp(HREF_QUOTE + base + "/" + BUILT_SEGMENT + HREF_QUOTE),
  };
}

type DynamicRouteScan = {
  /** Distinct concrete instances named by a literal href — `{"rph-adult-secure"}`. */
  concreteInstances: Set<string>;
  /** Repo-relative files holding at least one concrete href for this route. */
  concreteSites: string[];
  /** Repo-relative files that BUILD an href for this route. What they iterate is not visible. */
  builtSites: string[];
};

/** A route's own `page.tsx` directory cannot vouch for the route — a route referencing itself is
 *  not a way in. Sibling Ward Flow pages still count; they are real links. */
function ownRouteDir(route: string) {
  return path.join(WARD_FLOW_ROOT, ...route.slice(ROUTE_PREFIX.length).split("/").filter(Boolean));
}

function scanDynamicRoute(route: string): DynamicRouteScan {
  const { concrete, built } = dynamicRouteLinkPatterns(route);
  const ownDir = ownRouteDir(route) + path.sep;
  const scan: DynamicRouteScan = { concreteInstances: new Set(), concreteSites: [], builtSites: [] };
  for (const file of sourceFiles) {
    if (file.startsWith(ownDir)) continue;
    const text = readFileSync(file, "utf8");
    const relative = path.relative(REPO_ROOT, file).split(path.sep).join("/");
    concrete.lastIndex = 0;
    let found = false;
    for (let match = concrete.exec(text); match !== null; match = concrete.exec(text)) {
      scan.concreteInstances.add(match[1]);
      found = true;
    }
    if (found) scan.concreteSites.push(relative);
    if (built.test(text)) scan.builtSites.push(relative);
  }
  return scan;
}

const dynamicRouteScans = new Map(dynamicRoutes.map((route) => [route, scanDynamicRoute(route)]));

/**
 * How many instances each dynamic route can serve, read from the live fixture rather than written
 * down — so the coverage figures below cannot quietly go stale the way this branch's "22 units"
 * comments did when Phase 7 seeded the twenty-third.
 */
const WARD_DYNAMIC_ROUTE_INSTANCES: ReadonlyMap<string, () => number> = new Map([
  ["/mockups/ward-flow/ward/[unitId]", () => allUnits().length],
  ["/mockups/ward-flow/board/[unitId]", () => allUnits().length],
  ["/mockups/ward-flow/ed/[edId]", () => allEmergencyDepartments().length],
  ["/mockups/ward-flow/patients/[patientId]", () => wardMovements.length],
]);

/**
 * Dynamic routes that do NOT name every instance they serve, each recording the coverage as a
 * figure the scan recomputes: the entry must contain the exact words "<linked> of <instances>
 * instances reachable without state". Both numbers are computed, so neither can drift, and an
 * entry cannot be satisfied by prose alone.
 *
 * "Without state" is the whole qualification. Three of the four routes are also reachable through
 * a context-derived builder — but only after a coordinator has selected something, and only for
 * whatever that selection implies. That is described in each entry and is deliberately NOT
 * counted, because nothing here can see how many instances such a builder actually covers.
 */
const WARD_DYNAMIC_ROUTE_ORPHANS: ReadonlyMap<string, string> = new Map([
  [
    "/mockups/ward-flow/ward/[unitId]",
    "1 of 23 instances reachable without state — ward-nav.ts's one seeded example (rph-adult-secure), " +
      "carried as exampleOnly. ward-role-switcher.tsx builds the rest, but only over `wardCandidates`: " +
      "empty with no movement focused, otherwise the focused movement's accepted unit or its referred " +
      "units, so nought to three more and only after a selection. The other 22 wards have no route in. " +
      "Owner decision pending on where a full ward index belongs.",
  ],
  [
    "/mockups/ward-flow/board/[unitId]",
    "1 of 23 instances reachable without state — ward-nav.ts's one seeded example (rph-adult-secure). " +
      "Nothing builds a board href anywhere, so unlike the ward route there is not even a context-derived " +
      "path to the other 22; they can be reached only by typing the URL. This is the orphan the fold " +
      "found: the nav entry made ONE board reachable, not twenty-three. Owner decision pending on where " +
      "a full board index belongs.",
  ],
  [
    "/mockups/ward-flow/ed/[edId]",
    "1 of 8 instances reachable without state — ward-nav.ts's one seeded example (peel-ed). " +
      "ward-role-switcher.tsx builds one more, but only the focused movement's own originEdId, so nought " +
      "or one and only after a selection. The other 7 departments have no route in.",
  ],
  [
    "/mockups/ward-flow/patients/[patientId]",
    "0 of 48 instances reachable without state — nothing names a concrete movement anywhere. All four " +
      "builders (patient-search.tsx, live-tracker.tsx, ward-management-modes.tsx, " +
      "ward-management-network.tsx) work from a query or a selection, so which movements are reachable " +
      "depends entirely on what the coordinator has already done. Unlike the three above this is the " +
      "intended shape — a patient workspace is reached from a patient, never from a list of all 48 — but " +
      "it is recorded rather than exempted, because the figure is what makes the claim checkable.",
  ],
]);

function coverageSentence(route: string) {
  const scan = dynamicRouteScans.get(route);
  const instances = WARD_DYNAMIC_ROUTE_INSTANCES.get(route);
  return `${scan?.concreteInstances.size ?? 0} of ${instances ? instances() : 0} instances reachable without state`;
}

describe("Ward Flow dynamic routes — what links them, and what they leave orphaned (D8, dynamic half)", () => {
  /**
   * The floor, in the style of the route-enumeration canary above and for the same reason: three
   * of the four assertions below are "this list is empty", and an empty list is what a scan that
   * silently found nothing produces too.
   */
  it("scanned real routes and real source, and counts a prose mention as a link in neither direction", () => {
    // Written out in full rather than counted. A fifth dynamic route arriving here should cost
    // somebody a decision about how its instances are reached, not a number.
    expect([...dynamicRoutes].sort()).toEqual([
      "/mockups/ward-flow/board/[unitId]",
      "/mockups/ward-flow/ed/[edId]",
      "/mockups/ward-flow/patients/[patientId]",
      "/mockups/ward-flow/ward/[unitId]",
    ]);

    // 1306 .ts/.tsx files under src/ on this tree. Floored rather than pinned, because src/ grows
    // for reasons that have nothing to do with Ward Flow — but a walk that resolved the wrong root
    // or lost its extension filter returns 0 or a handful, and every per-route result below would
    // then read "nothing links this route" for reasons having nothing to do with the navigation.
    expect(sourceFiles.length).toBeGreaterThan(900);

    // Positive pins: the scan reads file CONTENT, and tells a concrete href from a built one.
    const board = dynamicRouteScans.get("/mockups/ward-flow/board/[unitId]");
    expect(board?.concreteSites).toEqual(["src/components/ward-management/ward-nav.ts"]);
    expect([...(board?.concreteInstances ?? [])]).toEqual(["rph-adult-secure"]);
    expect(board?.builtSites).toEqual([]);
    const ward = dynamicRouteScans.get("/mockups/ward-flow/ward/[unitId]");
    expect(ward?.builtSites).toEqual(["src/components/ward-management/ward-role-switcher.tsx"]);

    // NEGATIVE pin, and the reason this query is narrow enough to mean anything at all.
    // `ward-flow-events.ts` and `ward-flow-reducer.ts` both mention `/mockups/ward-flow/ward/[unitId]`
    // in prose, wrapped in markdown backticks — so each sits between exactly the quote characters a
    // real href sits between, and only the leading `[` of the placeholder segment separates the two.
    // A pattern loose enough to admit them would report almost every route as linked while proving
    // nothing, and would read exactly like a passing result.
    const wardLinkSites = new Set([...(ward?.concreteSites ?? []), ...(ward?.builtSites ?? [])]);
    expect([...wardLinkSites]).not.toContain("src/components/ward-management/ward-flow-reducer.ts");
    expect([...wardLinkSites]).not.toContain("src/components/ward-management/ward-flow-events.ts");
  });

  /**
   * Direction 2 of the two-way check, for dynamic routes. Titled for what it proves: a route is
   * REFERENCED. It is the floor beneath the coverage assertion below — a route nothing mentions
   * anywhere is unreachable outright, which needs no argument about how many instances a builder
   * covers, and is the state the board's route shipped in.
   */
  it("every dynamic Ward Flow route is referenced by at least one link in src/ (referenced — NOT proven reachable)", () => {
    const unreferenced = dynamicRoutes.filter((route) => {
      const scan = dynamicRouteScans.get(route);
      return (scan?.concreteSites.length ?? 0) === 0 && (scan?.builtSites.length ?? 0) === 0;
    });
    expect(
      unreferenced,
      `Dynamic Ward Flow route(s) with no href anywhere under src/ — nothing can reach any instance of them: ${unreferenced.join(", ")}`,
    ).toEqual([]);
  });

  it("declares, for every dynamic Ward Flow route, the collection whose instances it serves", () => {
    const undeclared = dynamicRoutes.filter((route) => !WARD_DYNAMIC_ROUTE_INSTANCES.has(route));
    expect(
      undeclared,
      `Dynamic Ward Flow route(s) with no entry in WARD_DYNAMIC_ROUTE_INSTANCES, so no coverage figure can be computed for them: ${undeclared.join(", ")}`,
    ).toEqual([]);
    const stale = [...WARD_DYNAMIC_ROUTE_INSTANCES.keys()].filter((route) => !dynamicRoutes.includes(route));
    expect(stale, `WARD_DYNAMIC_ROUTE_INSTANCES entr(ies) for route(s) no longer on disk: ${stale.join(", ")}`).toEqual(
      [],
    );
  });

  /**
   * The assertion that goes red on a new orphan. It is satisfied EITHER by naming every instance
   * — which is the only thing a source scan can actually establish — OR by an entry stating the
   * shortfall as the two computed numbers. All four routes currently take the second branch, and
   * that is not a softening: it is the deficiency put on the record as a figure, which is what
   * anyone fixing it has to change.
   */
  it("every dynamic Ward Flow route names every instance it serves, or records exactly how many it orphans", () => {
    const unrecorded = dynamicRoutes
      .map((route) => {
        const linked = dynamicRouteScans.get(route)?.concreteInstances.size ?? 0;
        const instances = WARD_DYNAMIC_ROUTE_INSTANCES.get(route)?.() ?? 0;
        if (linked >= instances) return undefined;
        const recorded = WARD_DYNAMIC_ROUTE_ORPHANS.get(route);
        if (recorded === undefined) {
          return `${route}: ${coverageSentence(route)}, and WARD_DYNAMIC_ROUTE_ORPHANS has no entry for it`;
        }
        if (!recorded.includes(coverageSentence(route))) {
          return `${route}: the scan measures "${coverageSentence(route)}" but its WARD_DYNAMIC_ROUTE_ORPHANS entry does not say so`;
        }
        return undefined;
      })
      .filter((problem): problem is string => problem !== undefined);
    expect(unrecorded, `Dynamic Ward Flow route coverage problem(s):\n  ${unrecorded.join("\n  ")}`).toEqual([]);
  });

  it("WARD_DYNAMIC_ROUTE_ORPHANS has no entry for a route that is no longer dynamic, or no longer orphans anything", () => {
    for (const [route, reason] of WARD_DYNAMIC_ROUTE_ORPHANS) {
      expect(dynamicRoutes, `${route} is recorded as orphaning instances but is no longer a dynamic route`).toContain(
        route,
      );
      expect(reason.trim().length, `${route}'s recorded reason is empty`).toBeGreaterThan(0);
      const linked = dynamicRouteScans.get(route)?.concreteInstances.size ?? 0;
      const instances = WARD_DYNAMIC_ROUTE_INSTANCES.get(route)?.() ?? 0;
      expect(
        linked,
        `${route} now names all ${instances} of its instances — delete its WARD_DYNAMIC_ROUTE_ORPHANS entry rather than leaving a false record`,
      ).toBeLessThan(instances);
    }
  });
});

describe("Ward Flow navigation — single source (ward-nav.ts)", () => {
  // Every destination the rail, the panel and the drawer render, from the one file all three read.
  const navHrefs = new Set([...WARD_VIEWS, ...WARD_NAV].map((item) => item.href));

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
  it("every static Ward Flow route appears in the navigation or is recorded as intentionally unlisted", () => {
    const missing = staticRoutes.filter((route) => !navHrefs.has(route) && !WARD_NAV_INTENTIONALLY_UNLISTED.has(route));
    expect(
      missing,
      `Static Ward Flow route(s) in neither the nav arrays nor WARD_NAV_INTENTIONALLY_UNLISTED: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  // The eight views moved out of eight literal `<Link>` blocks and into `WARD_VIEWS` so the
  // labelled panel and drawer could render the same destinations the icon rail renders. Direction
  // 1 has to cover them too, or half the navigation would be unchecked.
  it("every WARD_VIEWS href resolves to a real static route, and ids and hrefs are unique", () => {
    const unresolved = WARD_VIEWS.filter((view) => !staticRoutes.includes(view.href)).map((view) => view.href);
    expect(unresolved, `WARD_VIEWS href(s) with no matching route: ${unresolved.join(", ")}`).toEqual([]);
    expect(new Set(WARD_VIEWS.map((view) => view.id)).size).toBe(WARD_VIEWS.length);
    expect(new Set(WARD_VIEWS.map((view) => view.href)).size).toBe(WARD_VIEWS.length);
    expect(WARD_VIEWS).toHaveLength(8);
  });

  it("no route is listed in both WARD_VIEWS and WARD_NAV", () => {
    const viewHrefs = new Set(WARD_VIEWS.map((view) => view.href));
    const overlap = WARD_NAV.filter((item) => viewHrefs.has(item.href)).map((item) => item.href);
    expect(overlap, `href(s) in both WARD_VIEWS and WARD_NAV — pick one: ${overlap.join(", ")}`).toEqual([]);
  });

  it("every destination carries a non-empty label, so the panel and drawer can name it", () => {
    for (const item of [...WARD_VIEWS, ...WARD_NAV]) {
      expect(item.label.trim().length, `${item.href} has an empty label`).toBeGreaterThan(0);
    }
  });

  it("WARD_NAV_INTENTIONALLY_UNLISTED has no stale entries, no empty reasons, and never overlaps the nav", () => {
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

  /**
   * WIDENED DELIBERATELY on 2026-08-29, from two to three. The ward board
   * (`board/[unitId]`) is a dynamic route of exactly the shape D10 describes: the rail can only
   * ever link one concrete instance of it, so it must be presented as an example entry point and
   * never as a section of the app in its own right.
   *
   * The list is written out in full rather than counted, so a third entry could not appear by
   * accident — which is the whole point of "and nothing else". A route arriving here should cost
   * somebody a decision, not a number.
   */
  it("marks exactly the three arbitrary hardcoded instances exampleOnly (D10), and nothing else", () => {
    const exampleOnlyHrefs = WARD_NAV.filter((item) => item.exampleOnly)
      .map((item) => item.href)
      .sort();
    expect(exampleOnlyHrefs).toEqual(
      [
        "/mockups/ward-flow/board/rph-adult-secure",
        "/mockups/ward-flow/ed/peel-ed",
        "/mockups/ward-flow/ward/rph-adult-secure",
      ].sort(),
    );
  });

  /**
   * Task 6 (Phase 7), pinned by name rather than left to the two generic directions above.
   * Direction 2 is satisfied by a route being in EITHER a nav array OR
   * `WARD_NAV_INTENTIONALLY_UNLISTED`, so it stays green if the referral board silently moves
   * from the nav into the exemption map — it cannot tell "wired into nav" from "exempted with a
   * reason". This phase's whole premise is that the referral board IS the coordinator's front
   * door, so which of the two it lands in is the decision, and the decision is what needs an
   * assertion. The board is a `board` alongside Escalation and Discharges; the intake form is an
   * action reached from it, never a peer in the rail.
   */
  it("puts the referral board in the coordinator's boards and keeps the intake form out of the rail", () => {
    const board = WARD_NAV.find((item) => item.href === "/mockups/ward-flow/referrals");
    expect(board, "the referral board must be a WARD_NAV destination, not an unlisted exemption").toBeDefined();
    expect(board?.group).toBe("board");
    expect(board?.label).toBe("Referral board");

    // The intake form is deliberately NOT a nav destination — it is reached from the board. Both
    // halves are asserted: absent from every nav array, and present in the exemption map with the
    // reason, so "not in the nav" can never be satisfied by the route simply having vanished.
    expect(WARD_VIEWS.map((view) => view.href)).not.toContain(WARD_REFERRAL_INTAKE_HREF);
    expect(WARD_NAV.map((item) => item.href)).not.toContain(WARD_REFERRAL_INTAKE_HREF);
    expect(WARD_NAV_INTENTIONALLY_UNLISTED.has(WARD_REFERRAL_INTAKE_HREF)).toBe(true);
    expect(WARD_REFERRAL_INTAKE_HREF).toBe("/mockups/ward-flow/referrals/new");
    expect(staticRoutes, "the intake route the constant names must exist on disk").toContain(WARD_REFERRAL_INTAKE_HREF);
  });

  /**
   * Phase 8 Task 5, pinned by name for the same reason the referral board above is: direction 2 of
   * the two-way check is satisfied by a route being in EITHER a nav array OR
   * `WARD_NAV_INTENTIONALLY_UNLISTED`, so it stays green if the out-of-area ledger silently moves
   * out of the rail into the exemption map. Which of the two it lands in is the decision — the
   * ledger is the phase's headline screen and a coordinator has to be able to reach it — so that
   * is what needs the assertion.
   */
  it("puts the out-of-area ledger in the coordinator's boards", () => {
    const board = WARD_NAV.find((item) => item.href === "/mockups/ward-flow/out-of-area");
    expect(board, "the out-of-area ledger must be a WARD_NAV destination, not an unlisted exemption").toBeDefined();
    expect(board?.group).toBe("board");
    expect(board?.label).toBe("Out of area");
    expect(staticRoutes, "the route the nav entry names must exist on disk").toContain(
      "/mockups/ward-flow/out-of-area",
    );
  });

  it("groups every item as either a role screen or a specialist board", () => {
    for (const item of WARD_NAV) {
      expect(["role", "board"]).toContain(item.group);
    }
  });

  /**
   * Gap 5 (final review). `ward-management-navigation.tsx` and `ward-sidebar-content.tsx` both do
   * `const Icon = WARD_NAV_ICONS[item.id]` then `<Icon />`, with `WARD_NAV_ICONS` typed
   * `Record<string, LucideIcon>` — no compile-time link to `WARD_NAV`'s ids at all, so a missing
   * entry throws `Element type is invalid` at render, on EVERY Ward Flow screen (the rail mounts
   * on all of them), not just the one whose id lost its icon. This has already happened once in
   * this phase. Phase 7 is adding routes to `WARD_NAV` right now, which is exactly when a new id
   * is most likely to be added without its icon.
   */
  it("gives every WARD_NAV id an icon in WARD_NAV_ICONS, so no Ward Flow screen throws 'Element type is invalid'", () => {
    const missing = WARD_NAV.filter((item) => !(item.id in WARD_NAV_ICONS)).map((item) => item.id);
    expect(missing, `WARD_NAV id(s) with no icon in WARD_NAV_ICONS: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("ClinicalRail's aria-label is honest for a sandboxed prototype (D11)", () => {
  /**
   * Every file that can put a link on a Ward Flow screen, concatenated. The sidebar is now three
   * surfaces (icon rail, labelled panel, phone drawer) across three files plus the data they all
   * read, so scanning only `ward-management-navigation.tsx` would leave two of the three
   * unguarded — and a link out of the sandbox added to the drawer is exactly as wrong as one
   * added to the rail.
   */
  const source = [
    "src/components/ward-management/ward-management-navigation.tsx",
    "src/components/ward-management/ward-sidebar-content.tsx",
    "src/components/ward-management/ward-nav.ts",
  ]
    .map((file) => readFileSync(path.join(REPO_ROOT, file), "utf8"))
    .join("\n");

  it("no longer claims Ward Flow is a clinical application", () => {
    expect(source).not.toContain("Clinical applications");
  });

  it("labels the rail's own nav for Ward Flow, not for a set of applications", () => {
    expect(source).toContain('aria-label="Ward Flow"');
  });

  /**
   * The sandbox rule, asserted rather than trusted. The rail used to carry Ward Flow's own copy of
   * the clinical application's app switcher — Clinical Answers, Documents, Services, Medication,
   * Tools, All applications — plus Favourites and Settings in the bottom block: eight links routing
   * out of the sandbox and into the application it is meant to stand apart from. The product
   * owner's instruction is that each prototype is "its own sandbox only interacting via the
   * developer page, otherwise standalone app".
   *
   * Removing them also fixed the last red browser test. The rail is a fixed-height flex column;
   * those eight icons pushed its content past a 1024px viewport, so `.railBottom` overlapped the
   * final nav links and swallowed their clicks — while every link stayed in the DOM and stayed
   * keyboard-reachable, so no unit test could see it. **That is why this guard is a source scan
   * rather than a render assertion: the defect it prevents is invisible to rendering.**
   */
  it("routes nowhere in the clinical application — the developer hub is the only way out", () => {
    // `"/"` is the clinical application's home, and it is in this list because it was the NINTH
    // exit — the logo. Eight were found by reading the source; the logo was missed, because a
    // brand mark linking to `/` looks completely unremarkable in source and only reads as wrong
    // once you see it sitting above a sandboxed prototype's own rail.
    const clinicalExits = ["/", "/documents", "/services", "/medications", "/tools", "/?mode=answer"];
    const found = clinicalExits.filter((href) => source.includes(`href="${href}"`) || source.includes(`"${href}",`));
    expect(found, `the sidebar must not link into the clinical app, but found: ${found.join(", ")}`).toEqual([]);
    // Non-vacuity: the one legitimate exit must still be there, or this test would also pass on a
    // sidebar with no links at all. The href is now a named constant shared by the rail and the
    // drawer, so both its value and its use are asserted.
    expect(WARD_DEVELOPER_HUB_HREF).toBe("/mockups/development");
    expect(source).toContain("WARD_DEVELOPER_HUB_HREF");
    expect(source).toContain('"/mockups/development"');
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
  { route: `${ROUTE_PREFIX}/discharges`, render: () => createElement(DischargeBoard) },
  { route: `${ROUTE_PREFIX}/handover`, render: () => createElement(HandoverPage) },
  { route: `${ROUTE_PREFIX}/morning`, render: () => createElement(MorningPage) },
  { route: `${ROUTE_PREFIX}/search`, render: () => createElement(PatientSearchPage) },
  { route: `${ROUTE_PREFIX}/transport`, render: () => createElement(LiveTracker) },
  { route: `${ROUTE_PREFIX}/transport/officer`, render: () => createElement(OfficerScreen) },
  { route: `${ROUTE_PREFIX}/ward/[unitId]`, render: () => createElement(WardScreen, { unitId: "rph-adult-secure" }) },
  {
    route: `${ROUTE_PREFIX}/board/[unitId]`,
    render: () => createElement(WardBoard, { unitId: "rph-adult-secure" }),
  },
  {
    route: `${ROUTE_PREFIX}/patients/[patientId]`,
    render: () => createElement(WardPatientWorkspace, { patientId: "WF-001" }),
  },
  { route: `${ROUTE_PREFIX}/referrals/new`, render: () => createElement(ReferralIntakeForm) },
  { route: `${ROUTE_PREFIX}/referrals`, render: () => createElement(ReferralBoard) },
  { route: `${ROUTE_PREFIX}/out-of-area`, render: () => createElement(OutOfAreaBoard) },
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
    // 21 at the fold. NOTE: this is the SECOND map named RENDERABLE_ROUTES — tests/ward-landmarks.test.ts
    // declares its own, with the same name and a near-identical route list. Two hand-maintained maps
    // sharing a name across two files is how one gets updated and the other silently does not; both
    // were moved together here, and a future route must move both.
    expect(RENDERABLE_ROUTES.length).toBe(21);
  });
});

describe("Every Ward Flow route carries the 'Ward Flow views' in-page nav (D8)", () => {
  for (const entry of RENDERABLE_ROUTES) {
    it(`renders the Ward Flow views nav on ${entry.route}`, () => {
      // `children` in the props object, not positional — `WardFlowProviderProps` declares it
      // required, so the positional form fails the type (TS2769). This file cannot use JSX
      // instead: it is deliberately `.test.ts` so it collects under vitest's "node" project
      // rather than jsdom (see the header). Same exception as tests/ward-landmarks.test.ts.
      // eslint-disable-next-line react/no-children-prop -- WardFlowProviderProps requires `children`
      const element = createElement(WardFlowProvider, { initialNow: NOW_ANCHOR, children: entry.render() });
      const markup = renderToStaticMarkup(element);
      const matches = markup.match(/aria-label="Ward Flow views"/g) ?? [];
      expect(
        matches.length,
        `expected exactly one "Ward Flow views" nav on ${entry.route}, found ${matches.length}`,
      ).toBe(1);
    });
  }
});
