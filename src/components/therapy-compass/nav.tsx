"use client";

import { Columns3, FileText, House, Search, Sparkles, Timer, Waypoints } from "lucide-react";

import { ModeNav, type ModeNavItem } from "@/components/mode-nav/mode-nav";

import { MAX_COMPARE, useTcBindings, type TherapyScreen } from "./bindings";

const BASE = "/therapy-compass";

/**
 * Every id is a `resolveRoute` screen name. That is what lets `TherapyModeNav`
 * hand `ModeNav` the current screen as its `activeId` with no second pathname
 * parser and no lookup table in between, and the type is the guard: rename a
 * screen and this stops compiling rather than quietly un-highlighting a tab.
 *
 * `review` and `detail` have no entry, and their screen names therefore resolve
 * to "no active item" — correct for both. Review is a governance queue rather
 * than a step in delivering care, reachable from the detail and pathway
 * screens; a record is not a destination.
 */
type TherapyNavItem = ModeNavItem & { id: TherapyScreen };

/**
 * Therapy's pages for the shared `ModeNav`, in declared order.
 *
 * Order is load-bearing, not editorial: at three slots the survivors are the
 * first two, so the library door and the only destination carrying state are
 * the ones that stay on the bar at every width. Everything after Pathways is
 * reached through More at every band — which is why the two long labels and
 * Home sit there rather than competing for a slot they would never win.
 *
 * Home duplicates the mode pill directly above it and is the one entry the
 * app-wide secondary-navigation registry deliberately omits for every mode
 * (`src/lib/mode-secondary-navigation.ts`); it is here because Therapy's menu
 * is meant to list every Therapy page, and it never occupies a tab.
 *
 * Brief intervention and Patient sheet act on a selected therapy. Their hrefs
 * resolve through `briefHref`/`sheetHref`, which fall back to the first
 * catalogue record carrying that artifact when nothing is selected — so with
 * no selection they open a therapy the reader was not looking at. That is a
 * deliberate product decision, not an oversight; the availability-guarded
 * buttons on the record page (`screens/detail-screen.tsx`) remain the safe
 * route for a specific therapy.
 */
function useTherapyNavItems(): TherapyNavItem[] {
  const b = useTcBindings();

  return [
    { id: "search", label: "Search", href: `${BASE}/search`, icon: Search },
    {
      id: "compare",
      label: "Compare",
      href: `${BASE}/compare`,
      icon: Columns3,
      // Fill, not catalogue size: the basket holds four and the strip never
      // showed how many were in it.
      count: `${b.compareSlugs.length}/${MAX_COMPARE}`,
    },
    { id: "recommend", label: "Recommend", href: `${BASE}/recommend`, icon: Sparkles },
    { id: "pathways", label: "Pathways", href: `${BASE}/pathways`, icon: Waypoints },
    { id: "home", label: "Home", href: BASE, icon: House },
    { id: "brief", label: "Brief Intervention", href: b.briefHref, icon: Timer },
    { id: "sheets", label: "Patient Sheets", href: b.sheetHref, icon: FileText },
  ];
}

/**
 * The shared mode bar, pinned inside the universal header at every width.
 *
 * `activeId` is passed rather than left to `ModeNav`'s own path matching, which
 * treats a prefix as a match: Home's href is the mode base, so every Therapy
 * route starts with it and Home would read as the current page everywhere.
 * `b.screen` is the single canonical pathname-to-screen mapping and already
 * answers the question exactly.
 */
export function TherapyModeNav() {
  const b = useTcBindings();
  const items = useTherapyNavItems();
  return <ModeNav items={items} label="Therapy pages" activeId={b.screen} />;
}
