"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { GlobalMockupSearchShell } from "@/components/clinical-dashboard/global-mockup-search-shell";

export function MockupsLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isToolsPageMockup = pathname.startsWith("/mockups/tools-");
  const isFavouritesPageMockup = pathname.startsWith("/mockups/favourites-");
  const isDocumentSearchMockup = pathname.startsWith("/mockups/document-search");
  const isSourceOverlayRedesignMockup = pathname === "/mockups/document-search/source-overlays";
  const isStandaloneDocumentFlow = pathname === "/mockups/document-search";
  const isUniversalSearchRedesignMockup = pathname === "/mockups/universal-search-redesign";
  // The calculators search page owns its own search input (top on desktop, docked
  // at the bottom on phones), so the shared universal composer is suppressed here
  // to avoid a second, floating search bar.
  const isCalculatorsSearchPageMockup = pathname === "/mockups/calculators-search-page";
  // The safety-plan generator is a full builder workspace with its own primary
  // surfaces, so it hides the shared bottom search composer (same treatment as
  // the tool and favourites mockups).
  const isSafetyPlanMockup = pathname === "/mockups/patient-safety-plan";

  return (
    <GlobalMockupSearchShell
      initialMode={
        isToolsPageMockup
          ? "tools"
          : isFavouritesPageMockup
            ? "favourites"
            : isDocumentSearchMockup
              ? "documents"
              : "answer"
      }
      searchComposerVisible={
        !isToolsPageMockup &&
        !isFavouritesPageMockup &&
        !isStandaloneDocumentFlow &&
        !isUniversalSearchRedesignMockup &&
        !isCalculatorsSearchPageMockup &&
        !isSafetyPlanMockup
      }
      chromeVisible={!isSourceOverlayRedesignMockup}
    >
      {children}
    </GlobalMockupSearchShell>
  );
}
