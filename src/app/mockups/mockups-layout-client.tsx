"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { GlobalMockupSearchShell } from "@/components/clinical-dashboard/global-mockup-search-shell";

export function MockupsLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isToolsPageMockup = pathname.startsWith("/mockups/tools-");
  const isToolsSearchModeMockup = pathname === "/mockups/tools-search-mode";
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
  // Draws its own phone/desktop frames with a top bar, mode nav and composer in
  // every frame, because the header under study sits directly beneath them.
  const isDictionaryBrowseHeaderMockup = pathname.startsWith("/mockups/dictionary-browse-header");
  // Same reason: this study draws its own tab rail, page card and site-wide
  // composer inside every frame, so shared chrome would read as a second real
  // header and a second real search bar over the row under review.
  const isDictionaryControlRowMockup = pathname === "/mockups/dictionary-control-row";
  // Renders the results header inside its own device frames; the shared composer
  // would read as a second, real search bar over the study.
  const isSearchRefineAdaptiveMockup = pathname === "/mockups/search-refine-adaptive";
  // Draws its own result bands inside device frames; the shared chrome above
  // them would read as a third, real band competing with the two on offer.
  const isSearchBandDirectionsMockup = pathname === "/mockups/search-band-directions";
  // Draws its own results band and an in-frame filter sheet inside every device
  // frame; the shared composer would read as a second, real search bar over a
  // study whose whole subject is the control that sits in that band.
  const isServicesFilterRefinedMockup = pathname === "/mockups/services-filter-refined";
  // Option 3 in this study draws its own services composer with suggestion chips
  // beside it — that is the concept under judgement, so the shared composer
  // above it would be a second, real search bar competing with the proposal.
  const isServicesFilterOptionsMockup = pathname === "/mockups/services-filter-options";
  // Draws its own formulation band and an in-frame filter sheet in every device
  // frame; the shared composer would read as a second, real search bar over a
  // study about the control that opens from that band.
  const isFilterSheetRestyleMockup = pathname === "/mockups/filter-sheet-restyle";
  const isPhoneInPageNavigationMockup = pathname === "/mockups/phone-inpage-navigation";
  // Draws its own composer in every frame, and the notice under study is the one
  // the shared composer renders — showing both would put two different privacy
  // lines on screen at once.
  const isWarningConsolidationMockup = pathname === "/mockups/warning-consolidation";
  const isWarningLineMockup = pathname === "/mockups/warning-line";
  // Owns the also-matches panel as the subject; shared composer chrome would
  // sit on top of a study about results-card identity.
  const isAlsoMatchesAccentMockup = pathname === "/mockups/also-matches-accents";
  const isAnswerHomeProposalMockup = pathname === "/mockups/answer-home-proposal";
  // Every direction in this study draws its own top bar, transcript and
  // composer inside phone/desktop frames — the reference system under review
  // sits directly between them, so shared chrome would read as a second real
  // header and a second real search bar over the study.
  const isAnswerChatRedesignMockup = pathname === "/mockups/answer-chat-redesign";
  const isAnswerChatPerfectedMockup =
    pathname === "/mockups/answer-chat-perfected" || pathname === "/mockups/answer-chat-perfected-v2";
  // Draws its own sticky chrome + device frames for /privacy; shared shell would
  // read as a second real header over the study.
  const isPrivacyPageDirectionsMockup = pathname === "/mockups/privacy-page-directions";
  const isPrivacyLiveSignalPerfectedMockup = pathname === "/mockups/privacy-live-signal-perfected";
  // These studies draw complete app shells and their own search composers, so
  // shared chrome would make the interaction studies ambiguous.
  const isSearchLensMenuMockup = pathname === "/mockups/search-lens-menu";
  const isPinnedPlusMenuMockup = pathname === "/mockups/pinned-plus-menu";
  // Draws its own phone frames with an in-frame Choose mode sheet; shared chrome
  // would read as a second real header over the study.
  const isPhoneModeSheetYesMockup = pathname === "/mockups/phone-mode-sheet-yes";
  // A full-shell sidebar study: it owns the desktop rail, phone slide-over,
  // command surface, and composer inside one frame. Shared mockup chrome would
  // duplicate every surface under review and distort the responsive contract.
  const isSidebarLiveMockup = pathname === "/mockups/sidebar-live";
  // These studies render their own top bar and composer inside each device
  // frame. Suppress shared chrome so it cannot be mistaken for the concept.
  const isTherapyNavigationMockup = pathname.startsWith("/mockups/therapy-navigation-");
  // The calculators search page owns its own search input (top on desktop, docked
  // at the bottom on phones), so the shared universal composer is suppressed here
  // to avoid a second, floating search bar.
  const isCalculatorsSearchPageMockup = pathname === "/mockups/calculators-search-page";
  // Draws its own phone chrome, hero, Show all chip, and composer inside every
  // frame. Shared header + composer would read as a second live home over the study.
  const isCalculatorsShowAllMockup = pathname === "/mockups/calculators-show-all";
  // Draws its own top bar, composer and results band inside every device frame, because two of
  // the three directions restructure that band. Shared chrome above them would read as a second,
  // real header and a second real composer over the study.
  const isToolsSearchDirectionsMockup = pathname === "/mockups/tools-search-directions";
  // Caring Contact owns a complete patient-first operational shell. It is not a
  // search mode, and its synthetic patient context must never enter shared search.
  const isCaringContactMockup =
    pathname === "/mockups/caring-contacts" || pathname.startsWith("/mockups/caring-contacts/");
  // Care Plan owns a complete clinical shell with its own rail, phone dock and a
  // single search slot of its own. It is not a search mode, and its synthetic
  // patient context must never enter shared search.
  const isCarePlanMockup = pathname === "/mockups/care-plan" || pathname.startsWith("/mockups/care-plan/");
  // Ward Flow owns a complete operational shell — its own rail, its own in-page view navigation,
  // and a single search slot of its own on the patient-search board. It is not a search mode, and
  // its synthetic patient context must never enter shared search. Without this entry the shared
  // composer renders a SECOND real search bar over the prototype and the coordinator screen stops
  // being visible at all: every test in `ui-ward-management.spec.ts` failed on
  // `[data-testid="ward-coordinator"]:visible` resolving to zero elements, while that element was
  // plainly present in the served markup. Added when Ward Flow moved under `/mockups/ward-flow`.
  const isWardFlowMockup = pathname === "/mockups/ward-flow" || pathname.startsWith("/mockups/ward-flow/");

  /*
   * Ward Flow is not wrapped at all — it BYPASSES the shell rather than rendering inside it with
   * the chrome switched off, which is what every other entry above does.
   *
   * `GlobalMockupSearchShell` is a re-export of `GlobalSearchShell`, the clinical application's
   * own shell. Hiding its chrome hides the header and composer but still nests the prototype
   * inside the application it is meant to be separate from, and the wrapper it leaves behind
   * intercepts pointer events: with the chrome hidden, `ui-ward-management.spec.ts`'s
   * "opens every Ward Flow mode" still failed because clicking a rail link timed out. Verified
   * this is not the rail's fault by re-running that test against the pre-grouping rail — it fails
   * identically — and not a CSS overflow problem either, by reverting a speculative fix and
   * getting the same failure.
   *
   * The product owner's instruction is that each prototype is "its own sandbox only interacting
   * via the developer page, otherwise standalone app". A standalone app does not render inside
   * the shell of the application it stands apart from.
   */
  if (isWardFlowMockup) {
    return <>{children}</>;
  }

  // Draws its own phone frames with ModeNav Search | Topics and a docked composer,
  // so shared chrome would read as a second real header and a second search bar.
  const isFactsheetsTopicsPhoneMockup = pathname === "/mockups/factsheets-topics-phone";

  // Every frame draws the universal phone header, the page header and the
  // docked composer inside itself, because measuring the chrome budget is the
  // whole argument of the study. The `favourites-` prefix above already hides
  // the shared composer; the shared header still has to go or it reads as a
  // second real header above nine phone frames that each have their own.
  const isFavouritesPhonePerfectedMockup = pathname === "/mockups/favourites-phone-perfected";

  return (
    <GlobalMockupSearchShell
      initialMode={
        isToolsPageMockup
          ? "tools"
          : isFavouritesPageMockup
            ? "favourites"
            : isTherapyNavigationMockup
              ? "therapy-compass"
              : isDocumentSearchMockup ||
                  isDocumentTopNavigationMockup ||
                  isDocumentNavigationPaneMockup ||
                  isDocumentPhoneTitleMockup ||
                  isDocumentNavigationContractMockup
                ? "documents"
                : "answer"
      }
      searchComposerVisible={
        (!isToolsPageMockup || isToolsSearchModeMockup) &&
        !isFavouritesPageMockup &&
        !isStandaloneDocumentFlow &&
        !isDocumentTopNavigationMockup &&
        !isDocumentNavigationPaneMockup &&
        !isDocumentPhoneTitleMockup &&
        !isDocumentNavigationContractMockup &&
        !isUniversalSearchRedesignMockup &&
        !isCalculatorsSearchPageMockup &&
        !isCalculatorsShowAllMockup &&
        !isPhoneInPageNavigationMockup &&
        !isSearchBandDirectionsMockup &&
        !isServicesFilterRefinedMockup &&
        !isServicesFilterOptionsMockup &&
        !isFilterSheetRestyleMockup &&
        !isTherapyNavigationMockup &&
        !isWarningConsolidationMockup &&
        !isWarningLineMockup &&
        !isAlsoMatchesAccentMockup &&
        !isAnswerHomeProposalMockup &&
        !isAnswerChatRedesignMockup &&
        !isAnswerChatPerfectedMockup &&
        !isPrivacyPageDirectionsMockup &&
        !isPrivacyLiveSignalPerfectedMockup &&
        !isSearchLensMenuMockup &&
        !isPinnedPlusMenuMockup &&
        !isPhoneModeSheetYesMockup &&
        !isSidebarLiveMockup &&
        !isCaringContactMockup &&
        !isCarePlanMockup &&
        !isWardFlowMockup &&
        !isDictionaryBrowseHeaderMockup &&
        !isDictionaryControlRowMockup &&
        !isFactsheetsTopicsPhoneMockup &&
        !isFavouritesPhonePerfectedMockup
      }
      chromeVisible={
        !isSourceOverlayRedesignMockup &&
        !isToolsSearchDirectionsMockup &&
        !isCalculatorsShowAllMockup &&
        !isSearchHeadingMockup &&
        !isSearchRefineAdaptiveMockup &&
        !isSearchBandDirectionsMockup &&
        !isServicesFilterRefinedMockup &&
        !isServicesFilterOptionsMockup &&
        !isFilterSheetRestyleMockup &&
        !isPhoneInPageNavigationMockup &&
        !isTherapyNavigationMockup &&
        !isWarningConsolidationMockup &&
        !isWarningLineMockup &&
        !isAlsoMatchesAccentMockup &&
        !isAnswerHomeProposalMockup &&
        !isAnswerChatRedesignMockup &&
        !isAnswerChatPerfectedMockup &&
        !isPrivacyPageDirectionsMockup &&
        !isPrivacyLiveSignalPerfectedMockup &&
        !isSearchLensMenuMockup &&
        !isPinnedPlusMenuMockup &&
        !isPhoneModeSheetYesMockup &&
        !isSidebarLiveMockup &&
        !isCaringContactMockup &&
        !isCarePlanMockup &&
        !isWardFlowMockup &&
        !isDictionaryBrowseHeaderMockup &&
        !isDictionaryControlRowMockup &&
        !isFactsheetsTopicsPhoneMockup &&
        !isFavouritesPhonePerfectedMockup
      }
    >
      {children}
    </GlobalMockupSearchShell>
  );
}
