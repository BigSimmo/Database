"use client";

import { FileText, GitCompareArrows, ListChecks, Network, Search, type LucideIcon } from "lucide-react";

import { ModeNav, type ModeNavItem } from "@/components/mode-nav/mode-nav";
import { appModeDefinition, type AppModeId } from "@/lib/app-modes";
import {
  modeSecondaryNavigationEntries,
  modeSecondaryNavigationHref,
} from "@/lib/mode-secondary-navigation";

const iconByItemId: Record<string, LucideIcon> = {
  search: Search,
  diagnoses: FileText,
  compare: GitCompareArrows,
  builder: ListChecks,
  map: Network,
};

/**
 * Adapts the canonical route registry to the universal header-integrated mode
 * navigation. Keeping this mapping in one component prevents the page shell,
 * Specifiers, and Formulation from drifting onto different labels or URLs.
 */
export function RegistryModeNav({
  modeId,
  activeId,
  searchParamString = "",
}: {
  modeId: AppModeId;
  activeId: string;
  searchParamString?: string;
}) {
  const currentSearchParams = new URLSearchParams(searchParamString);
  const items = modeSecondaryNavigationEntries(modeId).flatMap<ModeNavItem>((entry) => {
    if (!entry.href) return [];
    return [
      {
        id: entry.id,
        label: entry.label,
        href: modeSecondaryNavigationHref({
          modeId,
          itemId: entry.id,
          href: entry.href,
          currentSearchParams,
        }),
        icon: iconByItemId[entry.id] ?? FileText,
      },
    ];
  });

  return <ModeNav items={items} label={`${appModeDefinition(modeId).label} pages`} activeId={activeId} />;
}
