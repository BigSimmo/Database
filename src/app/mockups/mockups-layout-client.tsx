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
  const isDocumentNavigationPaneMockup = pathname === "/mockups/document-navigation-pane";
  const isDocumentPhoneTitleMockup = pathname.startsWith("/mockups/document-phone-");
  // Draws its own universal top bar and document composer inside every frame, so
  // the shared composer would read as a second, real search bar over the study.
  const isDocumentNavigationContractMockup =
    pathname === "/mockups/document-navigation-contract" ||
    pathname === "/mockups/document-navigation-perfected" ||
    pathname.startsWith("/mockups/document-navigation-final");
  const isSourceOverlayRedesignMockup = pathname === "/mockups/document-search/source-overlays";
  const isStandaloneDocumentFlow = pathname === "/mockups/document-search";
  const isUniversalSearchRedesignMockup = pathname === "/mockups/universal-search-redesign";
  const isSearchHeadingMockup = pathname === "/mockups/search-heading";
  const isPhoneInPageNavigationMockup = pathname === "/mockups/phone-inpage-navigation";
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
            : isDocumentSearchMockup ||
                isDocumentTopNavigationMockup ||
                isDocumentNavigationPaneMockup ||
                isDocumentPhoneTitleMockup ||
                isDocumentNavigationContractMockup
              ? "documents"
              : "answer"
      }
      searchComposerVisible={
        !isToolsPageMockup &&
        !isFavouritesPageMockup &&
        !isStandaloneDocumentFlow &&
        !isDocumentTopNavigationMockup &&
        !isDocumentNavigationPaneMockup &&
        !isDocumentPhoneTitleMockup &&
        !isDocumentNavigationContractMockup &&
        !isUniversalSearchRedesignMockup &&
        !isCalculatorsSearchPageMockup &&
        !isPhoneInPageNavigationMockup
      }
      chromeVisible={!isSourceOverlayRedesignMockup && !isSearchHeadingMockup && !isPhoneInPageNavigationMockup}
    >
      {children}
    </GlobalMockupSearchShell>
  );
}
