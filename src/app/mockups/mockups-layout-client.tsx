"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { GlobalMockupSearchShell } from "@/components/clinical-dashboard/global-mockup-search-shell";

export function MockupsLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isToolsPageMockup = pathname.startsWith("/mockups/tools-");
  const isFavouritesPageMockup = pathname.startsWith("/mockups/favourites-");
  const isDocumentSearchMockup = pathname.startsWith("/mockups/document-search");
  const isDocumentTopNavigationMockup = pathname === "/mockups/document-top-navigation";
  const isSourceOverlayRedesignMockup = pathname === "/mockups/document-search/source-overlays";
  const isStandaloneDocumentFlow = pathname === "/mockups/document-search";
  const isUniversalSearchRedesignMockup = pathname === "/mockups/universal-search-redesign";
  const isSearchHeadingMockup = pathname === "/mockups/search-heading";
  const isPhoneInPageNavigationMockup = pathname === "/mockups/phone-inpage-navigation";
  // These studies render their own top bar and composer inside each device
  // frame. Suppress shared chrome so it cannot be mistaken for the concept.
  const isTherapyNavigationMockup = pathname.startsWith("/mockups/therapy-navigation-");
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
            : isTherapyNavigationMockup
              ? "therapy-compass"
              : isDocumentSearchMockup || isDocumentTopNavigationMockup
                ? "documents"
                : "answer"
      }
      searchComposerVisible={
        !isToolsPageMockup &&
        !isFavouritesPageMockup &&
        !isStandaloneDocumentFlow &&
        !isDocumentTopNavigationMockup &&
        !isUniversalSearchRedesignMockup &&
        !isCalculatorsSearchPageMockup &&
        !isPhoneInPageNavigationMockup &&
        !isTherapyNavigationMockup
      }
      chromeVisible={
        !isSourceOverlayRedesignMockup &&
        !isSearchHeadingMockup &&
        !isPhoneInPageNavigationMockup &&
        !isTherapyNavigationMockup
      }
    >
      {children}
    </GlobalMockupSearchShell>
  );
}
