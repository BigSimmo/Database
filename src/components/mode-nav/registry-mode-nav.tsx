"use client";

import {
  BookOpenText,
  BookMarked,
  ClipboardCheck,
  ClipboardList,
  GitCompareArrows,
  ListChecks,
  Network,
  Search,
  Sparkles,
  Stethoscope,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { ModeNav, type ModeNavItem } from "@/components/mode-nav/mode-nav";
import { type ModeNavDensityProfile } from "@/components/mode-nav/mode-nav-bands";
import { appModeDefinition } from "@/lib/app-modes";
import {
  modeSecondaryNavigationEntries,
  modeSecondaryNavigationHref,
  type ModeNavAdoptedMode,
  type RoutedModeSecondaryNavigationId,
} from "@/lib/mode-secondary-navigation";

/**
 * Each adopted mode opts into a label-width budget. Keeping this exhaustive
 * means a newly adopted mode cannot inherit a density that was calibrated for
 * different words and silently clip them.
 */
export const registryModeNavDensityProfiles = {
  dsm: "two-item",
  specifiers: "compact-four",
  formulation: "compact-four",
  differentials: "balanced-four",
  factsheets: "two-item",
  "therapy-compass": "extended",
  // Four destinations with medium labels, the same family as differentials:
  // "Compare" and "Sources" are well inside the budget calibrated for
  // "Presentations". `extended` was chosen when the mode had five destinations
  // and Search/Browse were two names for one place.
  dictionary: "balanced-four",
} as const satisfies Record<ModeNavAdoptedMode, ModeNavDensityProfile>;

/**
 * Exhaustive by type, deliberately. A `?? FileText` fallback compiles for a
 * registry id nobody has chosen an icon for, and the entry then ships wearing a
 * document icon that means nothing — a silent default on the one surface where
 * the icon is half the slot's width. Adding a routed entry to the registry
 * without an icon fails the typecheck instead.
 */
const iconByItemId: Record<RoutedModeSecondaryNavigationId, LucideIcon> = {
  search: Search,
  review: ClipboardCheck,
  diagnoses: Stethoscope,
  presentations: ClipboardList,
  compare: GitCompareArrows,
  builder: ListChecks,
  map: Network,
  recommend: Sparkles,
  pathways: Waypoints,
  // The Factsheets hero glyph (`appModeIcons.factsheets`), so the tab wears the
  // same mark as the surface it points at. Not LayoutGrid: the search page uses
  // that for its card/list view toggle, and one glyph must not mean two things
  // on the same screen.
  topics: BookOpenText,
  sources: BookMarked,
};

/**
 * Adapts the canonical route registry to the shared header-integrated bar.
 *
 * One adapter rather than a hand-written item list per mode: the registry is
 * already the single source of destinations, labels and query-state carrying
 * (`modeSecondaryNavigationHref`), and a per-mode list would let the shell and
 * the mode drift onto different URLs for the same tab.
 *
 * `activeId` is always passed explicitly. `ModeNav`'s own path derivation
 * prefix-matches, and every routed entry whose href is the mode home
 * (`appModeHomeHref`) would then claim to be the current page on every route in
 * the mode.
 */
export function RegistryModeNav({
  modeId,
  activeId,
  searchParamString = "",
}: {
  modeId: ModeNavAdoptedMode;
  /** `null` marks no destination as current (record/detail routes). */
  activeId: string | null;
  searchParamString?: string;
}) {
  const pathname = usePathname();
  const embeddedPresentationOnCompare =
    pathname === "/differentials/compare" || pathname.startsWith("/differentials/compare/");
  // The ad-hoc compare workspace reuses DifferentialPresentationWorkflowPage,
  // but its shell already owns the Compare bar. Suppress only that embedded
  // page-owned Presentations bar so the header slot keeps one correct occupant.
  if (modeId === "differentials" && activeId === "presentations" && embeddedPresentationOnCompare) return null;

  const currentSearchParams = new URLSearchParams(searchParamString);
  // Action-only entries are dropped, not adapted: `ModeNavItem` takes an href
  // by design so deep links, back and prefetch keep working.
  const items = modeSecondaryNavigationEntries(modeId).flatMap<ModeNavItem>((entry) =>
    entry.href
      ? [
          {
            id: entry.id,
            label: entry.label,
            href: modeSecondaryNavigationHref({
              modeId,
              itemId: entry.id,
              href: entry.href,
              currentSearchParams,
            }),
            // The accessor widens `id` to `string`; the guarantee lives on the
            // map's key type above, which is derived from the registry literal.
            icon: iconByItemId[entry.id as RoutedModeSecondaryNavigationId],
          },
        ]
      : [],
  );

  return (
    <ModeNav
      items={items}
      label={`${appModeDefinition(modeId).label} pages`}
      densityProfile={registryModeNavDensityProfiles[modeId]}
      activeId={activeId}
    />
  );
}
