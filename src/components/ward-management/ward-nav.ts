/**
 * The single source for Ward Flow's own rail navigation — see `ward-management-navigation.tsx`'s
 * `ClinicalRail`. Before this file, the rail's Ward-Flow-specific destinations (everything beyond
 * the eight views `WardModeNavigation` already sources statically) were 329 lines of individually
 * hand-pasted link blocks, one appended per task over two phases. Nothing enumerated the two
 * sides — nav links and real routes — against each other, which is *why* three boards
 * (`/handover`, `/escalation`, `/search`) could ship with no rail entry and nothing noticed
 * (plan defects D8/D9).
 *
 * `tests/ward-nav.test.ts` enforces the two-way property this file exists to make possible:
 * every href below must resolve to a real route under `src/app/mockups/ward-flow/`, **and**
 * every *static* route under that tree must appear here or in `WARD_NAV_INTENTIONALLY_UNLISTED`
 * with a stated reason. A one-way check ("every nav link is a real route") is exactly what let
 * D8 happen — it says nothing about a route with no link pointing at it at all.
 */

export type WardNavGroup = "role" | "board";

export type WardNavItem = {
  id: string;
  href: string;
  label: string;
  group: WardNavGroup;
  /** True when the href names one specific synthetic ward or department rather than a section. */
  exampleOnly?: boolean;
};

/**
 * `role` — entry points for the role screens `WardRoleSwitcher` offers (Coordinator, Ward,
 * Officer, Emergency department — see that component's own doc comment). Coordinator is
 * deliberately absent here: it is `/mockups/ward-flow` itself, already reachable via
 * `WardModeNavigation`'s "Command" view and the app-switcher's own "Ward Flow" link one section
 * up in the same rail — see `WARD_NAV_INTENTIONALLY_UNLISTED` below, which is where that
 * reasoning is recorded and checked. Ward and Emergency department are dynamic detail routes
 * (`ward/[unitId]`, `ed/[edId]`); the rail can only ever link to one concrete instance of each,
 * so both carry `exampleOnly: true` (D10) — the rail must present them as an example entry point
 * into that role screen, never as though they were a section of the app in their own right.
 * **Do not delete either** — they are currently the only way to reach those two role screens.
 *
 * `board` — the specialist boards that sit outside `WardModeNavigation`'s eight-view strip.
 */
export const WARD_NAV: readonly WardNavItem[] = [
  {
    id: "ward",
    href: "/mockups/ward-flow/ward/rph-adult-secure",
    label: "Ward — RPH Adult Secure",
    group: "role",
    exampleOnly: true,
  },
  { id: "officer", href: "/mockups/ward-flow/transport/officer", label: "Officer", group: "role" },
  {
    id: "ed",
    href: "/mockups/ward-flow/ed/peel-ed",
    label: "Emergency department",
    group: "role",
    exampleOnly: true,
  },
  { id: "handover", href: "/mockups/ward-flow/handover", label: "Handover", group: "board" },
  { id: "escalation", href: "/mockups/ward-flow/escalation", label: "Escalation", group: "board" },
  { id: "search", href: "/mockups/ward-flow/search", label: "Patient search", group: "board" },
];

/**
 * Static Ward Flow routes intentionally absent from `WARD_NAV`, each with the reason it is
 * exempt — mirrors `REACHABILITY_ALLOWLIST` in `tests/route-reachability.test.ts`. Every key must
 * be a real static route under `src/app/mockups/ward-flow/` (checked by `tests/ward-nav.test.ts`,
 * which fails on a stale entry) and must never also appear in `WARD_NAV` — a route belongs in
 * exactly one of the two.
 */
export const WARD_NAV_INTENTIONALLY_UNLISTED: ReadonlyMap<string, string> = new Map([
  [
    "/mockups/ward-flow",
    "Coordinator's own entry point — already reachable via WardModeNavigation's \"Command\" view " +
      'and the app-switcher\'s "Ward Flow" link; not duplicated in the role/board rail groups.',
  ],
  [
    "/mockups/ward-flow/network",
    "One of WardModeNavigation's eight views — sourced, rendered and tested separately from this file.",
  ],
  [
    "/mockups/ward-flow/queue",
    "One of WardModeNavigation's eight views — sourced, rendered and tested separately from this file.",
  ],
  [
    "/mockups/ward-flow/capacity",
    "One of WardModeNavigation's eight views — sourced, rendered and tested separately from this file.",
  ],
  [
    "/mockups/ward-flow/movements",
    "One of WardModeNavigation's eight views — sourced, rendered and tested separately from this file.",
  ],
  [
    "/mockups/ward-flow/exceptions",
    "One of WardModeNavigation's eight views — sourced, rendered and tested separately from this file.",
  ],
  [
    "/mockups/ward-flow/transport",
    "One of WardModeNavigation's eight views (the live tracker) — sourced, rendered and tested " +
      "separately from this file. Distinct from /transport/officer, which is in WARD_NAV.",
  ],
  [
    "/mockups/ward-flow/governance",
    "One of WardModeNavigation's eight views — sourced, rendered and tested separately from this file.",
  ],
  [
    "/mockups/ward-flow/constellation",
    "A deliberate 307 redirect to /network, documented in its own route file (constellation/page.tsx) — not a destination.",
  ],
]);
