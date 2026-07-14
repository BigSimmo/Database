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
  // Therapy Compass keeps the universal header + rail but provides its own
  // primary search surface, so the shared bottom composer is hidden (as with
  // the tools/favourites mockups).
  const isTherapyCompassMockup = pathname.startsWith("/mockups/therapy-compass");
  // The calculators search page owns its own search input (top on desktop, docked
  // at the bottom on phones), so the shared universal composer is suppressed here
  // to avoid a second, floating search bar.
  const isCalculatorsSearchPageMockup = pathname === "/mockups/calculators-search-page";

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
        !isTherapyCompassMockup &&
        !isCalculatorsSearchPageMockup
      }
      chromeVisible={!isSourceOverlayRedesignMockup}
    >
      {children}
    </GlobalMockupSearchShell>
  );
}
