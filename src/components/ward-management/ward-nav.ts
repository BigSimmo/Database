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

/**
 * Every `WARD_NAV` id, as a union rather than `string`.
 *
 * `WARD_VIEWS`' ids have always been union-typed (`WardMode`), which is what makes
 * `WARD_VIEW_ICONS: Record<WardMode, LucideIcon>` in `ward-nav-icons.ts` compiler-guarded — a view
 * with no icon does not build. `WARD_NAV`'s ids were `string`, so its sibling `WARD_NAV_ICONS` had
 * to be `Record<string, LucideIcon>`, which accepts anything and guarantees nothing. Both the rail
 * and the drawer do `const Icon = WARD_NAV_ICONS[item.id]` and then render `<Icon />`, so a
 * missing entry throws `Element type is invalid` at render on EVERY Ward Flow screen (the rail
 * mounts on all of them), not just the one whose id lost its icon. That has already happened once.
 *
 * Adding an id here and to `WARD_NAV` without adding its icon is now a type error at the icon map.
 * `tests/ward-nav.test.ts` still asserts the same property at test time and MUST be kept: the two
 * mechanisms fail differently — the compiler catches it before anything runs, the test catches the
 * case where a `Record` key is present but resolves to nothing usable — and a phase that has spent
 * two days on guards that turned out not to guard does not trade a real check for a newer one.
 */
export type WardNavId =
  | "wards"
  | "community"
  | "ward"
  | "board"
  | "officer"
  | "ed"
  | "handover"
  | "escalation"
  | "search"
  | "discharges"
  | "morning"
  | "referrals"
  | "referral-intake"
  | "out-of-area"
  | "statistics";

export type WardNavItem = {
  id: WardNavId;
  href: string;
  label: string;
  group: WardNavGroup;
  /** True when the href names one specific synthetic ward or department rather than a section. */
  exampleOnly?: boolean;
};

/**
 * The referral intake form's path, in one place.
 *
 * ⚠️ MUST STAY ABOVE `WARD_NAV`, which now references it (owner ruling 2026-09-03 put the form in
 * the rail). A `const` used before its declaration throws at module load, and because the rail
 * mounts on every Ward Flow screen that would be a crash on all of them rather than on one.
 *
 * `referral-board.tsx` also links here, so the constant is what stops a hand-written string in
 * that file drifting from the route on disk. `tests/ward-nav.test.ts` checks every `WARD_NAV`
 * href against the real route tree, so the constant, the nav entry and the route stay one fact.
 */
export const WARD_REFERRAL_INTAKE_HREF = "/mockups/ward-flow/referrals/new";

/**
 * `role` — entry points for the role screens `WardRoleSwitcher` offers (Coordinator, Ward,
 * Officer, Emergency department — see that component's own doc comment). Coordinator is
 * deliberately absent here: it is `/mockups/ward-flow` itself, already present in `WARD_VIEWS`
 * as "Command" — see `WARD_NAV_INTENTIONALLY_UNLISTED` below, which is where that reasoning is
 * recorded and checked. Ward and Emergency department are dynamic detail routes
 * (`ward/[unitId]`, `ed/[edId]`); the rail can only ever link to one concrete instance of each,
 * so both carry `exampleOnly: true` (D10) — the navigation must present them as an example entry
 * point into that role screen, never as though they were a section of the app in their own
 * right. **Do not delete either.** `ed` is still the only way to reach the emergency department
 * role screen at all. `ward` is no longer the only way to reach a ward — `wards` above is the ward
 * index, which links every unit in the network — but it remains the ONE concrete `ward/[unitId]`
 * href in the source, and `tests/ward-nav.test.ts` measures that route's recorded coverage from
 * exactly that: delete it and the figure falls to nought, having made nothing more reachable.
 *
 * `wards` is a section rather than an example, so it carries no `exampleOnly` flag: it is the
 * index of every ward, not one ward standing in for the rest.
 *
 * `community` is the same shape as `wards` and is here for the same reason: it is the index of
 * every community team a referral can name, each linked, so it too is a section rather than an
 * example and carries no `exampleOnly` flag. **It must not be moved to
 * `WARD_NAV_INTENTIONALLY_UNLISTED`.** Its whole purpose is to be the front door to
 * `community/[teamId]`, whose pages were reachable only by typing an address; an index nothing
 * links to confers no reachability on anything it links, and burying it here would leave every
 * team page exactly as unreachable as it was while every scan started reporting them healthy.
 * (No count of teams is written here on purpose — `community-index.tsx` records why a team count
 * typed into prose is a claim that falsifies itself the first time the seed changes.)
 *

 * `board` — the specialist boards that sit outside the eight views.
 */

export const WARD_NAV: readonly WardNavItem[] = [
  {
    id: "statistics",
    href: "/mockups/ward-flow/statistics",
    label: "Statistics",
    group: "role",
  },
  {
    id: "wards",
    href: "/mockups/ward-flow/wards",
    label: "All wards",
    group: "role",
  },
  {
    id: "community",
    href: "/mockups/ward-flow/community",
    label: "All community teams",
    group: "role",
  },
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
  /*
   * ⚠️ THIS ENTRY REVERSES A DELIBERATE DESIGN DECISION, BY OWNER RULING ON 2026-09-03:
   * "I would like the referral form/hub in the sidebar please."
   *
   * The argument it overrules is kept here rather than deleted, because a design argument that
   * simply vanishes reads as though nobody ever thought about it. Until today this route sat in
   * `WARD_NAV_INTENTIONALLY_UNLISTED` with this reasoning:
   *
   *   "An action taken from the referral board, not a section of the app: the board carries the
   *    'New referral' <Link> that is the only way in, mirroring how a coordinator actually reaches
   *    it — they are looking at the queue when they raise the next one. Listing an intake form in
   *    the rail beside Handover, Escalation and Discharges would present a form as though it were
   *    a board."
   *
   * That reasoning was sound and it is not what the owner wants. He asked for the form as well as
   * the board — "form/hub", and the board is already here as `referrals` — so BOTH are listed and
   * neither replaces the other. The `New referral` link on the board stays: this adds a second way
   * in, it does not move the first one.
   */
  {
    id: "referral-intake",
    href: WARD_REFERRAL_INTAKE_HREF,
    label: "New referral",
    group: "board",
  },
  { id: "out-of-area", href: "/mockups/ward-flow/out-of-area", label: "Out of area", group: "board" },
];

/**
 * The one link out of the sandbox. A sandbox has exactly one exit and it is the developer page
 * it was opened from — see `ward-management-navigation.tsx` for the eight that were removed and
 * why.
 */
export const WARD_DEVELOPER_HUB_HREF = "/mockups/development";

/* `WARD_REFERRAL_INTAKE_HREF` was declared here until 2026-09-03. It moved ABOVE `WARD_NAV`
 * because `WARD_NAV` now references it, and a `const` used before its declaration is a temporal
 * dead zone error at module load — a crash on every Ward Flow screen, since the rail mounts on
 * all of them. Nothing else changed about it. */

/**
 * Where a person who is not in the system yet gets added.
 *
 * A constant for the same reason `WARD_REFERRAL_INTAKE_HREF` above is one: the only way in is a
 * `<Link>` inside another screen — here the patient search's empty state — so nothing in `WARD_NAV`
 * pins its path, and a hand-written string in `patient-search.tsx` could drift from the route on
 * disk with nothing noticing. The constant, the exemption below and the route are one fact in one
 * place.
 */
export const WARD_ADD_PERSON_HREF = "/mockups/ward-flow/people/new";

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
  /* The entry for `WARD_REFERRAL_INTAKE_HREF` was REMOVED on 2026-09-03, in the same change that
   * listed the form in `WARD_NAV` by owner ruling. It had to go in THAT commit and not a later
   * one: this map means "a real route deliberately absent from the nav", and `tests/ward-nav.test.ts`
   * fails any route that appears in both. Leaving it would have shipped a document contradicting
   * the nav it describes. The argument it carried is preserved verbatim at the new
   * `referral-intake` entry above, so the overruled reasoning is still readable. */
  [
    WARD_ADD_PERSON_HREF,
    "An action taken from the patient search, not a section of the app: the search's empty state carries the 'Add this person' <Link> that is the only way in, and it appears exactly when it is needed — you have searched, nobody came up, and this is the person who does not exist yet. Listing it in the rail would invite adding a person nobody had looked for first, which is how a duplicate record gets made.",
  ],
  [
    "/mockups/ward-flow/statistics/overview",
    "Reached by Link from the statistics hub, not from the rail. Three statistics entries in the sidebar would bury the hub the owner actually wants to land on — the same reasoning WARD_REFERRAL_INTAKE_HREF above already sets, where a destination inside a screen is not a section of the app.",
  ],
  [
    "/mockups/ward-flow/statistics/compare",
    "Reached by Link from the statistics hub, for the same reason as /overview above.",
  ],
]);
