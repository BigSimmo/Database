/**
 * Phone bottom-dock content clearance for GlobalSearchShell + ClinicalDashboard.
 *
 * Visible docks include `var(--safe-area-bottom)` so Playwright can simulate a
 * Safari toolbar inset. Once the dock is actually hidden, clearance collapses to
 * {@link mobileComposerHiddenReserve} — never back to the browser safe-area
 * inset env(), which recreates a toolbar-sized blank band on iOS Safari.
 *
 * Keep these string values aligned with `--phone-dock-*` tokens in globals.css.
 */

/**
 * Content pad after the phone bottom composer has scrolled away. It must be
 * zero so content can paint all the way to the viewport edge once the dock is
 * invisible. The rem number is exported separately so the scroll-hide
 * collapse budget
 * (use-hide-on-scroll's readChromeCollapseBudget) measures against the same
 * value; tests/mobile-composer-reserve.test.ts pins the pair together.
 */
export const mobileComposerHiddenReserveRem = 0;
export const mobileComposerHiddenReserve = "0rem";

/** Routes with no floating bottom dock (info pages, the answer home hero). */
export const mobileComposerIdleReserve = "2rem";

/** Differentials Compare selected bar + compact search pill. */
export const mobileComposerDifferentialsCompareReserve = "calc(12.5rem + var(--safe-area-bottom))";

// Every phone dock is the compact single-row pill (mode homes and result views
// alike); only the answer dock with a follow-up chip row is taller. The answer
// values are derived from the dock constants so the pairs cannot silently
// diverge — master-search-header's compact styling assumes they stay equal.
const shellCompactSingleRowReserve = "calc(5.5rem + var(--safe-area-bottom))";
const dashboardCompactSingleRowReserve = "calc(5rem + var(--safe-area-bottom))";

export const mobileComposerVisibleReserve = {
  shellAnswer: shellCompactSingleRowReserve,
  shellDock: shellCompactSingleRowReserve,
  dashboardAnswerWithFollowUps: "calc(7.5rem + var(--safe-area-bottom))",
  dashboardAnswer: dashboardCompactSingleRowReserve,
  dashboardDock: dashboardCompactSingleRowReserve,
  differentialsCompare: mobileComposerDifferentialsCompareReserve,
} as const;

export function resolveMobileComposerReserve(bottomComposerHidden: boolean, visibleReserve: string): string {
  return bottomComposerHidden ? mobileComposerHiddenReserve : visibleReserve;
}

/** Document detail / source flows own a floating composer outside MasterSearchHeader. */
export function isDocumentViewerOwnedRoute(pathname: string): boolean {
  if (!pathname.startsWith("/documents/")) return false;
  // /documents/search is the shell-owned index; every other /documents/* route
  // (detail, source, evidence) owns its floating composer in DocumentViewer.
  return pathname !== "/documents/search";
}

export function resolveDashboardVisibleMobileComposerReserve(input: {
  searchMode: string;
  hasAnswerFollowUps: boolean;
  differentialsCompareAddonActive: boolean;
  /** Hero owns the phone composer (no fixed bottom dock) — match shell idle pad. */
  heroOwnsPhoneComposer?: boolean;
}): string {
  // Mode homes / answer home keep the in-flow hero pill on phones, so there is
  // no floating dock to clear — only the idle content pad (same as standalone
  // shell mode homes). Using the dock reserve here opens a blank bottom band.
  if (input.heroOwnsPhoneComposer) {
    return mobileComposerIdleReserve;
  }
  if (input.searchMode === "answer") {
    return input.hasAnswerFollowUps
      ? mobileComposerVisibleReserve.dashboardAnswerWithFollowUps
      : mobileComposerVisibleReserve.dashboardAnswer;
  }
  if (input.differentialsCompareAddonActive) {
    return mobileComposerVisibleReserve.differentialsCompare;
  }
  return mobileComposerVisibleReserve.dashboardDock;
}

export function resolveShellVisibleMobileComposerReserve(input: {
  shouldShowSearchComposer: boolean;
  documentViewerOwnedRoute: boolean;
  isStandaloneModeHome: boolean;
  searchMode: string;
  differentialsCompareAddonActive: boolean;
}): string {
  if (!input.shouldShowSearchComposer) {
    // DocumentViewer owns its dock; shell keeps only the hidden-size pad.
    return input.documentViewerOwnedRoute ? mobileComposerHiddenReserve : mobileComposerIdleReserve;
  }
  // Standalone mode homes keep the in-flow hero pill at every width (phones
  // included), so the composer sits in the content flow rather than docking to
  // the bottom edge. Reserve only the idle content pad — matching the answer
  // home hero — so no empty band opens below the pill.
  if (input.isStandaloneModeHome) return mobileComposerIdleReserve;
  if (input.searchMode === "answer") return mobileComposerVisibleReserve.shellAnswer;
  if (input.differentialsCompareAddonActive) return mobileComposerVisibleReserve.differentialsCompare;
  return mobileComposerVisibleReserve.shellDock;
}
