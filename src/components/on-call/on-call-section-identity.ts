import {
  BookOpen,
  BriefcaseBusiness,
  GraduationCap,
  ListChecks,
  MoonStar,
  Phone,
  Repeat,
  ShieldCheck,
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

export const ON_CALL_VIEW_ICONS: Record<OnCallPageView, LucideIcon> = {
  ...ON_CALL_SECTION_ICONS,
  "who-is-who": Users,
  compliance: ShieldCheck,
};

/** The glyph for the mode home. Not a section, so it is not in the maps above. */
export const ON_CALL_HOME_ICON: LucideIcon = MoonStar;

/**
 * Which stored section a view writes to. Who's who writes `contacts` rows; every
 * other view writes its own. The editor takes this rather than the view, so a
 * role explainer is saved as what it actually is.
 */
export function onCallViewStorageSection(view: OnCallPageView): OnCallSection {
  if (view === "who-is-who") return "contacts";
  if (view === "compliance") return "logistics";
  return view;
}
