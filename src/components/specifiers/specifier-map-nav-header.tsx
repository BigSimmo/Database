"use client";

import { Clock3, Gauge, Sparkles } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";

import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";

export const specifierMapSteps = [
  {
    id: "episode-features",
    label: "Episode features",
    description: "What is present now",
    icon: Sparkles,
  },
  {
    id: "course-onset",
    label: "Course and onset",
    description: "When and how it unfolds",
    icon: Clock3,
  },
  {
    id: "severity-remission",
    label: "Severity or remission",
    description: "Current burden or recovery",
    icon: Gauge,
  },
] as const;

export const specifierMapSections: readonly PageSection[] = specifierMapSteps.map(({ id, label, icon }) => ({
  id,
  label,
  icon,
}));

type SpecifierMapNavigation = {
  activeId: string | null;
  selectSection: (id: string) => void;
};

const SpecifierMapNavigationContext = createContext<SpecifierMapNavigation | null>(null);

/**
 * Owns the map route's scroll spy and exposes it to the page body via
 * context. `/specifiers/map` is a top-level tab (`isSlugDetail` excludes the
 * "map" tool suffix, so `isInformationPage`/`hasLocalInformationPageNavigation`
 * are both false for it), not a slug detail page, so it must not claim the
 * header's addon slot the way `/specifiers/[slug]` does — see
 * `header-addon-slot.ts` and `docs/search-chrome-behaviour.md`'s "Adopted so
 * far" list, which never included this route. This component therefore
 * renders no header of its own; the page keeps the shared Find/Build/Compare/Map
 * tab bar plus its own numbered jump cards for in-page navigation.
 */
export function SpecifierMapNavHeader({ children }: { children: ReactNode }) {
  const { activeId, selectSection } = useInPageSectionNav(specifierMapSections);

  return (
    <SpecifierMapNavigationContext.Provider value={{ activeId, selectSection }}>
      {children}
    </SpecifierMapNavigationContext.Provider>
  );
}

export function useSpecifierMapNavigation(): SpecifierMapNavigation {
  const navigation = useContext(SpecifierMapNavigationContext);
  if (!navigation) throw new Error("useSpecifierMapNavigation must be used within SpecifierMapNavHeader");
  return navigation;
}
