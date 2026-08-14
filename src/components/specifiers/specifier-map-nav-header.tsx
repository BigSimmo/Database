"use client";

import { Clock3, Gauge, Sparkles } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";
import { appModeHomeHref } from "@/lib/app-modes";

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
 * Owns the map route's fixed in-page-navigation declaration and its scroll spy.
 * The page body consumes this single source so the header and role buttons stay
 * synchronized during ordinary scrolling as well as explicit section jumps.
 */
export function SpecifierMapNavHeader({ children }: { children: ReactNode }) {
  const { sections, activeId, selectSection } = useInPageSectionNav(specifierMapSections);

  return (
    <SpecifierMapNavigationContext.Provider value={{ activeId, selectSection }}>
      <InPageNavHeader
        back={{ href: appModeHomeHref("specifiers"), label: "Specifiers" }}
        title="Specifier map"
        sectionSheetTitle="Specifier map"
        sections={sections}
        activeId={activeId}
        onSelectSection={selectSection}
        testIdPrefix="specifier-map"
      />
      {children}
    </SpecifierMapNavigationContext.Provider>
  );
}

export function useSpecifierMapNavigation(): SpecifierMapNavigation {
  const navigation = useContext(SpecifierMapNavigationContext);
  if (!navigation) throw new Error("useSpecifierMapNavigation must be used within SpecifierMapNavHeader");
  return navigation;
}
