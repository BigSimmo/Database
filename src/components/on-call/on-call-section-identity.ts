import {
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  GraduationCap,
  ListChecks,
  MoonStar,
  Phone,
  Repeat,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { type OnCallSection } from "@/lib/on-call/entry-model";

/**
 * What each On Call surface is called and which glyph it wears, in one place.
 *
 * These used to live in `on-call-nav-header.tsx`, which the mode-nav adoption
 * deleted. They are not navigation data — the editor's sheet title, the printed
 * card's group headings and the search result rows all read them — so they
 * outlive whichever component draws the navigation, and keeping them here is
 * what stops the next chrome change stranding them again.
 *
 * No JSX and no client directive: this is imported by both server and client
 * modules.
 *
 * **Type-only imports from the domain model, and that is load-bearing.** This
 * module is reached from `mode-nav-icons.ts`, which the shared
 * `MasterSearchHeader` imports, which renders on `/` and `/documents/search`.
 * A VALUE import of `@/lib/on-call/compliance`, `who-is-who` or `entry-model`
 * here therefore ships the whole On Call domain model — six Zod schemas — to
 * someone who only opened the home page. That is not hypothetical: it is the
 * regression recorded in `tests/on-call-root-bundle-isolation.test.ts`, which
 * measured `/` at 265.3 KiB gzip against 244.0 KiB and desktop LCP 940 ms
 * against 772 ms. The pair of functions that needs the model lives in
 * `on-call-entry-view.ts` for exactly this reason.
 */

/**
 * Display title per section. `education` is titled "Teaching" everywhere a
 * reader sees it — the rail slot, the page heading, the editor — even though the
 * underlying section id (route segment, database check constraint,
 * `OnCallSection` value) stays `education`. Only the label changed; renaming the
 * id would be a migration for no functional gain.
 */
export const ON_CALL_SECTION_TITLES: Record<OnCallSection, string> = {
  contacts: "Contacts",
  playbook: "Playbook",
  referrals: "Referrals",
  orientation: "Orientation",
  education: "Teaching",
  // Label only, exactly as `education` → "Teaching" above. The stored section
  // id, the route segment and the database check constraint all stay
  // `logistics`; renaming them is a migration for no functional gain. What the
  // section HOLDS changed with the label — site logistics became the work
  // admin a doctor does for themselves — but that is content, not schema.
  logistics: "Admin",
};

export const ON_CALL_SECTION_ICONS: Record<OnCallSection, LucideIcon> = {
  contacts: Phone,
  playbook: ListChecks,
  referrals: Repeat,
  orientation: BookOpen,
  education: GraduationCap,
  logistics: BriefcaseBusiness,
};

/**
 * Four-ish words saying what a section holds, for the home's tile grid.
 *
 * Short on purpose: a tile is read at a glance in a corridor, and a sentence
 * there is a sentence nobody reads. The full framing lives on each section page.
 */
export const ON_CALL_SECTION_TILE_DESCRIPTIONS: Record<OnCallSection, string> = {
  contacts: "Numbers, by role",
  playbook: "Who to ring, in order",
  referrals: "Who takes whom",
  orientation: "Starting and leaving",
  education: "What's on this term",
  logistics: "Leave, forms, rosters",
};

/**
 * The routes this mode's pages live at, as literal strings.
 *
 * `modeSecondaryNavigationRegistry` is the canonical destination list and the
 * reachability guard reads it directly, so these are not a second source of
 * truth for navigation — they exist so the home's tile grid and the section
 * pages can name a route without interpolating one.
 */
export const ON_CALL_SECTION_HREFS: Record<OnCallSection, string> = {
  contacts: "/on-call/contacts",
  playbook: "/on-call/playbook",
  referrals: "/on-call/referrals",
  orientation: "/on-call/orientation",
  education: "/on-call/education",
  logistics: "/on-call/logistics",
};

/**
 * A page of this mode that is not one of the six stored sections.
 *
 * Who's who is `contacts` rows behind a `details.kind` discriminator rather than
 * a seventh section value, because `section` is a database CHECK constraint. It
 * still needs a page, a title and a glyph, so the view union carries it.
 */
export type OnCallPageView = OnCallSection | "who-is-who" | "compliance";

export const ON_CALL_VIEW_TITLES: Record<OnCallPageView, string> = {
  ...ON_CALL_SECTION_TITLES,
  "who-is-who": "Who's who",
  compliance: "Compliance",
};

/**
 * Compliance wears `CalendarClock`, and deliberately not a shield with a tick.
 *
 * `ShieldCheck` was the first choice and is wrong for one reason the compliance
 * module already spelled out for its own scope note: nothing on that page is
 * checked with an issuing body, so a tick beside it is a glyph arguing with its
 * own caption (`src/lib/on-call/compliance.ts`, "What this page may never say").
 * The mark is `aria-hidden` everywhere, so nothing is voiced — but it is the
 * first thing seen in the rail, the loading state and the home tile, and a tick
 * read at a glance is exactly the verdict this page may never render.
 *
 * `ShieldAlert` only flips the verdict's sign — it asserts something is wrong,
 * which is as much a judgement as asserting all is well — and this mode already
 * uses it as a warning mark. Plain `Shield` is taken: `on-call-home.tsx` draws
 * the pinned reminder with it, on the same screen as the Compliance tile, and
 * one glyph must not mean two things on one screen. `CalendarClock` carries no
 * verdict in either direction and names what every row on the page actually is:
 * something with a date on it that runs out.
 */
export const ON_CALL_VIEW_ICONS: Record<OnCallPageView, LucideIcon> = {
  ...ON_CALL_SECTION_ICONS,
  "who-is-who": Users,
  compliance: CalendarClock,
};

/**
 * The route each VIEW lives at — `ON_CALL_SECTION_HREFS` widened by the two
 * pages that are views rather than stored sections.
 *
 * A separate table rather than pouring the two view routes into
 * `ON_CALL_SECTION_HREFS`, for the same reason the titles and icons above come
 * in pairs: that map is keyed by `OnCallSection` and is read all over the mode
 * with a section in hand, and a map whose name says "section" must not answer
 * to `compliance`. Keeping the pair means the section-keyed map stays honest
 * and this one is exhaustive over the views — a new view with no route is a
 * compile error here rather than a tile that has to hardcode its own string.
 *
 * That hardcoding is what this replaces. The home's tile grid carried
 * `/on-call/compliance` and `/on-call/who-is-who` as literals while the search
 * box and the Recent list interpolated neither, so the same route was written
 * in three places and only one of them could be wrong at a time.
 */
export const ON_CALL_VIEW_HREFS: Record<OnCallPageView, string> = {
  ...ON_CALL_SECTION_HREFS,
  "who-is-who": "/on-call/who-is-who",
  compliance: "/on-call/compliance",
};

/** The glyph for the mode home. Not a section, so it is not in the maps above. */
export const ON_CALL_HOME_ICON: LucideIcon = MoonStar;
