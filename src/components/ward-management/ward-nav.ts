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

/**
 * The eight coordinator-level mode ids.
 *
 * ⚠️ **THIS COMMENT USED TO SAY "the eight coordinator-level views, ordered as the rail and the
 * panel present them", AND BY 2026-09-05 THAT WAS FALSE IN BOTH HALVES.** MERGE 01 folded the
 * priority queue and the exceptions inbox into `DelaysScreen`, and MERGE 03 folded the vehicle
 * tracker into `MovementsScreen`. `WARD_VIEWS` has listed SIX ever since; `exceptions` and
 * `transport` are presented nowhere and are not views at all. The sentence describing this file's
 * central fact was left behind by two merges that each updated the array beneath it — which is the
 * ordinary way a comment goes wrong, and the reason the count below is now DERIVED rather than
 * written down.
 *
 * 🔴 **A RUNTIME LIST, WITH THE TYPE DERIVED FROM IT — not a hand-written union beside a
 * hand-written array.** A union is erased before any test runs, so nothing could ever walk the
 * eight ids and check them against the six that are listed; the only enforcement was two total
 * `Record`s (`WARD_VIEW_ICONS`, `modeCopy`), and a total `Record` proves every id HAS an entry,
 * never that any entry is READ. Six of `modeCopy`'s eight are read by nothing today. With
 * `WARD_MODES` as the source, `tests/ward-nav.test.ts` can require every id to be either a listed
 * view or a recorded exception with a reason — the same two-way property this file already
 * enforces for routes, which is what stopped D8.
 *
 * The order is the rail's order for the six that are listed, with the two retained ids last.
 */
export const WARD_MODES = [
  "command",
  "network",
  "queue",
  "capacity",
  "movements",
  "governance",
  "exceptions",
  "transport",
] as const;

export type WardMode = (typeof WARD_MODES)[number];

/**
 * A mode id that is deliberately NOT a listed view, and why it is still here.
 *
 * ⚠️ **"NOT LISTED" IS NOT "DEAD", AND THE DIFFERENCE IS THE WHOLE POINT OF THIS MAP.** Both ids
 * below are still branched on by `ModeBody` (`ward-management-modes.tsx`) and still rendered by
 * test files, so deleting either is a decision with consequences elsewhere — not a tidy-up. What
 * they have lost is a place in the rail.
 *
 * ⚠️ **`command` IS NOT IN THIS MAP, AND WAS NEARLY RECORDED AS DEAD.** It is excluded from
 * `WardModeWorkspace`'s prop type, which reads like absence; measured 2026-09-05 it has two live
 * consumers — its own `WARD_VIEWS` entry pointing at `/mockups/ward-flow`, and
 * `coordinator-screen.tsx`, which renders `<ClinicalRail activeMode="command" />` so the Command
 * screen highlights itself in the rail. It is the most-used mode id in the application. An id that
 * is absent from ONE consumer is not an unused id, and the two claims look identical from inside
 * that consumer.
 */
export const WARD_MODES_NOT_LISTED: ReadonlyMap<WardMode, string> = new Map([
  [
    "exceptions",
    "MERGE 01 (owner-approved 2026-09-05) folded the exceptions inbox into DelaysScreen — the same waiting patients the priority queue already listed, under a second lens. The id stays because ModeBody still branches on it and ward-pull-vocabulary.dom.test.tsx still renders it; retiring the id is part of answering that test, not a separate tidy-up.",
  ],
  [
    "transport",
    "MERGE 03 (owner-approved 2026-09-05) folded the live vehicle tracker into MovementsScreen. /mockups/ward-flow/transport still exists as a redirect to /movements, recorded in WARD_NAV_INTENTIONALLY_UNLISTED below. The id stays for the same reason 'exceptions' does.",
  ],
] as const);

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
 *
 * ⚠️ SEVEN, NOT EIGHT, as of MERGE 01 (owner-approved 2026-09-05). `queue` and `exceptions` used
 * to be two separate entries, "Priority queue" and "Exceptions" — the same waiting patients,
 * listed twice under two different lenses, plus a third list on the escalation board that was
 * never one of these eight at all. `DelaysScreen` answers what all three were separately trying
 * to answer ("why is this person still waiting?"), so the `queue` entry now points at `/delays`
 * and carries the label "Delays"; the `exceptions` entry is gone. The `queue` and `exceptions` ids
 * themselves are untouched in the `WardMode` type below — see that type's own comment — this is a
 * change to which destinations get listed, not to what a mode id can be.
 *
 * ⚠️ SIX, NOT SEVEN, as of MERGE 03 (owner-approved 2026-09-05). `movements` and `transport`
 * used to be two separate entries — the six-stage movement board and the live vehicle tracker,
 * asking "where is everyone right now" two different ways. `MovementsScreen` answers both, so the
 * `transport` entry is gone; the route still exists as a redirect to `/movements` — see
 * `WARD_NAV_INTENTIONALLY_UNLISTED` below. The `transport` id itself is untouched in the `WardMode`
 * type below, for the same reason `queue`/`exceptions` stayed untouched after MERGE 01.
 */
export const WARD_VIEWS: readonly WardViewItem[] = [
  { id: "command", href: "/mockups/ward-flow", label: "Command" },
  { id: "network", href: "/mockups/ward-flow/network", label: "Network" },
  { id: "queue", href: "/mockups/ward-flow/delays", label: "Delays" },
  { id: "capacity", href: "/mockups/ward-flow/capacity", label: "Capacity" },
  { id: "movements", href: "/mockups/ward-flow/movements", label: "Movements" },
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
  /* The `escalation` entry was REMOVED here by MERGE 01 (owner-approved 2026-09-05): the
   * escalation board's list of patients is now shown inside `DelaysScreen`, under its own cause
   * group, so a separate board entry would be a second listing of the same people. The route
   * itself still exists as a redirect to `/delays` — see `WARD_NAV_INTENTIONALLY_UNLISTED` below
   * — and the `escalation` id stays a member of `WardNavId` even though nothing in this array
   * uses it any more, for the same reason `queue`/`exceptions` stay in `WardMode`: nothing else
   * in this file depends on removing it, and leaving it costs nothing. */
  { id: "search", href: "/mockups/ward-flow/search", label: "Patient search", group: "board" },
  { id: "discharges", href: "/mockups/ward-flow/discharges", label: "Discharges", group: "board" },
  /* The `morning` entry was REMOVED here by MERGE 02 (owner-approved 2026-09-05): the morning bed
   * state board's figures are now shown inside `CapacityScreen`, so a separate board entry would be
   * a second listing of the same network/hospital/ward numbers. The route itself still exists as a
   * redirect to `/capacity` — see `WARD_NAV_INTENTIONALLY_UNLISTED` below — and the `morning` id
   * stays a member of `WardNavId` even though nothing in this array uses it any more, for the same
   * reason `escalation` stays in `WardNavId` after MERGE 01: nothing else in this file depends on
   * removing it, and leaving it costs nothing. */
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
  /* The next three entries were added by MERGE 01 (owner-approved 2026-09-05), which folded the
   * priority queue, the exceptions inbox and the escalation board into one screen, `DelaysScreen`
   * at /mockups/ward-flow/delays. Each of the three old routes now redirects there rather than
   * being deleted, so an existing bookmark or deep link does not 404 — the same reasoning
   * `/constellation` above already sets for a retired route kept as a redirect stub. */
  [
    "/mockups/ward-flow/queue",
    "A deliberate redirect to /delays (MERGE 01), documented in its own route file (queue/page.tsx) — not a destination in its own right.",
  ],
  [
    "/mockups/ward-flow/exceptions",
    "A deliberate redirect to /delays (MERGE 01), documented in its own route file (exceptions/page.tsx) — not a destination in its own right.",
  ],
  [
    "/mockups/ward-flow/escalation",
    "A deliberate redirect to /delays (MERGE 01), documented in its own route file (escalation/page.tsx) — not a destination in its own right.",
  ],
  /* MERGE 02 (owner-approved 2026-09-05) folded the morning bed state board into `CapacityScreen`.
   * The old route now redirects there rather than being deleted, for the same bookmark/deep-link
   * reason MERGE 01's three entries above already set. */
  [
    "/mockups/ward-flow/morning",
    "A deliberate redirect to /capacity (MERGE 02), documented in its own route file (morning/page.tsx) — not a destination in its own right.",
  ],
  /* MERGE 03 (owner-approved 2026-09-05) folded the live vehicle tracker into `MovementsScreen`.
   * The old route now redirects there rather than being deleted, for the same bookmark/deep-link
   * reason MERGE 01's and MERGE 02's entries above already set. `/transport/officer` is a separate,
   * nested route and is unaffected: it stays listed in WARD_NAV under its own `officer` entry. */
  [
    "/mockups/ward-flow/transport",
    "A deliberate redirect to /movements (MERGE 03), documented in its own route file (transport/page.tsx) — not a destination in its own right.",
  ],
]);
