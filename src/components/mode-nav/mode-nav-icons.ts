import {
  BookOpen,
  BookOpenText,
  BookMarked,
  ClipboardCheck,
  ClipboardList,
  GitCompareArrows,
  GraduationCap,
  Landmark,
  LibraryBig,
  ListChecks,
  MapPinned,
  MoonStar,
  Network,
  Phone,
  Printer,
  Repeat,
  Search,
  Sparkles,
  Stethoscope,
  Scale,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import { type RoutedModeSecondaryNavigationId } from "@/lib/mode-secondary-navigation";

/**
 * Exhaustive by type, deliberately. A `?? FileText` fallback compiles for a
 * registry id nobody has chosen an icon for, and the entry then ships wearing a
 * document icon that means nothing — a silent default on the one surface where
 * the icon is half the slot's width. Adding a routed entry to the registry
 * without an icon fails the typecheck instead.
 */
export const iconByItemId: Record<RoutedModeSecondaryNavigationId, LucideIcon> = {
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
  catalogue: LibraryBig,
  publishers: Landmark,
  method: Scale,
  // On Call. These are the glyphs `ON_CALL_SECTION_ICONS` already gives each
  // section, so a section wears one mark in the rail, its own header and the
  // home's tile grid. `extended` hides them below its top band; they still have
  // to be right, because the sheet and the wide bar both show them.
  tonight: MoonStar,
  contacts: Phone,
  playbook: ListChecks,
  referrals: Repeat,
  orientation: BookOpen,
  teaching: GraduationCap,
  logistics: MapPinned,
  whoswho: Users,
  card: Printer,
};

/**
 * The glyph for one registry destination, for callers outside the rail.
 *
 * The mode sheet draws this mode's own pages using the same rows it draws modes
 * with, so it needs the same marks — a section must not wear one glyph in the
 * rail and another in the sheet. Returns a widened lookup rather than the
 * exhaustive record, because a caller holding a plain string id cannot prove it
 * is a registered one; an unregistered id gets no icon rather than a wrong one.
 */
export function modeSectionIcon(itemId: string): LucideIcon | null {
  return iconByItemId[itemId as RoutedModeSecondaryNavigationId] ?? null;
}
