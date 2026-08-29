/**
 * The single source for every Ward Flow destination — rendered three ways by
 * `ward-management-navigation.tsx` (icon rail, expanded panel, phone drawer) and checked both
 * ways by `tests/ward-nav.test.ts`.
 *
 * Before this file, the rail's Ward-Flow-specific destinations were 329 lines of individually
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

/** The eight coordinator-level views. Ordered as the rail and the panel present them. */
export type WardMode =
  "command" | "network" | "queue" | "capacity" | "movements" | "exceptions" | "transport" | "governance";

export type WardViewItem = {
  id: WardMode;
  href: string;
  label: string;
};

/**
 * The eight views, moved here from eight hand-written `<Link>` blocks inside
 * `WardModeNavigation`. Those blocks were literal so that a source-text regex in
 * `tests/ward-management.test.ts` could read the hrefs back, and so that
 * `tests/route-reachability.test.ts`'s literal-href AST scan could see them. Neither reason
 * survives: that reachability test's `staticPageRoutes` excludes every `/mockups/**` route
 * outright (Ward Flow's sandbox move), and the mode-href test now reads this array directly,
 * which is a stronger check than a regex over a function body.
 *
 * The move is what makes a labelled sidebar possible at all. A panel and a drawer that render
 * labelled links cannot read a rail's icon-only JSX, so leaving the views in JSX would have
 * meant a second hand-maintained list of the same eight destinations — the precise defect this
 * file was created to end.
 */
export const WARD_VIEWS: readonly WardViewItem[] = [
  { id: "command", href: "/mockups/ward-flow", label: "Command" },
  { id: "network", href: "/mockups/ward-flow/network", label: "Network" },
  { id: "queue", href: "/mockups/ward-flow/queue", label: "Priority queue" },
  { id: "capacity", href: "/mockups/ward-flow/capacity", label: "Capacity" },
  { id: "movements", href: "/mockups/ward-flow/movements", label: "Movements" },
  { id: "exceptions", href: "/mockups/ward-flow/exceptions", label: "Exceptions" },
  { id: "transport", href: "/mockups/ward-flow/transport", label: "Transport" },
  { id: "governance", href: "/mockups/ward-flow/governance", label: "Governance" },
];

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
 * deliberately absent here: it is `/mockups/ward-flow` itself, already present in `WARD_VIEWS`
 * as "Command" — see `WARD_NAV_INTENTIONALLY_UNLISTED` below, which is where that reasoning is
 * recorded and checked. Ward and Emergency department are dynamic detail routes
 * (`ward/[unitId]`, `ed/[edId]`); the rail can only ever link to one concrete instance of each,
 * so both carry `exampleOnly: true` (D10) — the navigation must present them as an example entry
 * point into that role screen, never as though they were a section of the app in their own
 * right. **Do not delete either** — they are currently the only way to reach those two role
 * screens.
 *
 * `board` — the specialist boards that sit outside the eight views.
 */
export const WARD_NAV: readonly WardNavItem[] = [
  {
    id: "ward",
    href: "/mockups/ward-flow/ward/rph-adult-secure",
    label: "Ward — RPH Adult Secure",
    group: "role",
    exampleOnly: true,
  },
  {
    id: "board",
    href: "/mockups/ward-flow/board/rph-adult-secure",
    label: "Ward board — RPH Adult Secure",
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
  { id: "discharges", href: "/mockups/ward-flow/discharges", label: "Discharges", group: "board" },
  { id: "morning", href: "/mockups/ward-flow/morning", label: "Morning bed state", group: "board" },
  { id: "referrals", href: "/mockups/ward-flow/referrals", label: "Referral board", group: "board" },
  { id: "out-of-area", href: "/mockups/ward-flow/out-of-area", label: "Out of area", group: "board" },
];

/**
 * The one link out of the sandbox. A sandbox has exactly one exit and it is the developer page
 * it was opened from — see `ward-management-navigation.tsx` for the eight that were removed and
 * why.
 */
export const WARD_DEVELOPER_HUB_HREF = "/mockups/development";

/**
 * The referral intake form. Named here, beside the nav data, for the same reason
 * `WARD_DEVELOPER_HUB_HREF` is: it is a destination reached by a `<Link>` from inside a screen
 * rather than from the rail, so nothing in `WARD_NAV` would otherwise pin its path, and a
 * hand-written string in `referral-board.tsx` could drift from the route on disk with nothing
 * noticing. `WARD_NAV_INTENTIONALLY_UNLISTED` below keys its exemption off this same constant,
 * and `tests/ward-nav.test.ts` checks that key against the real route tree — so the constant, the
 * exemption and the route are one fact in one place.
 */
export const WARD_REFERRAL_INTAKE_HREF = "/mockups/ward-flow/referrals/new";

/**
 * Static Ward Flow routes intentionally absent from `WARD_VIEWS` and `WARD_NAV`, each with the
 * reason it is exempt — mirrors `REACHABILITY_ALLOWLIST` in `tests/route-reachability.test.ts`.
 * Every key must be a real static route under `src/app/mockups/ward-flow/` (checked by
 * `tests/ward-nav.test.ts`, which fails on a stale entry) and must never also appear in a nav
 * array — a route belongs in exactly one of the two.
 */
export const WARD_NAV_INTENTIONALLY_UNLISTED: ReadonlyMap<string, string> = new Map([
  [
    "/mockups/ward-flow/constellation",
    "A deliberate 307 redirect to /network, documented in its own route file (constellation/page.tsx) — not a destination.",
  ],
  [
    WARD_REFERRAL_INTAKE_HREF,
    "An action taken from the referral board, not a section of the app: the board (WARD_NAV's `referrals`) carries the 'New referral' <Link> that is the only way in, mirroring how a coordinator actually reaches it — they are looking at the queue when they raise the next one. Listing an intake form in the rail beside Handover, Escalation and Discharges would present a form as though it were a board.",
  ],
]);
