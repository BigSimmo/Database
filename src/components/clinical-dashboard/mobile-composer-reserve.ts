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

/** Content pad after the phone bottom composer has scrolled away. */
export const mobileComposerHiddenReserve = "0.75rem";

/** Routes with no floating bottom dock (info pages, in-flow mode-home composers). */
export const mobileComposerIdleReserve = "2rem";

/** Differentials Compare selected bar + compact search pill. */
export const mobileComposerDifferentialsCompareReserve = "calc(12.5rem + var(--safe-area-bottom))";

export const mobileComposerVisibleReserve = {
  shellAnswer: "calc(9rem + var(--safe-area-bottom))",
  shellCompactSubmitted: "calc(5.5rem + var(--safe-area-bottom))",
  shellDefaultDock: "calc(9rem + var(--safe-area-bottom))",
  dashboardAnswerWithFollowUps: "calc(7.5rem + var(--safe-area-bottom))",
  dashboardAnswer: "calc(5.25rem + var(--safe-area-bottom))",
  dashboardCompactSubmitted: "calc(5rem + var(--safe-area-bottom))",
  dashboardDefaultDock: "calc(5.25rem + var(--safe-area-bottom))",
  differentialsCompare: mobileComposerDifferentialsCompareReserve,
} as const;

export function resolveMobileComposerReserve(bottomComposerHidden: boolean, visibleReserve: string): string {
  return bottomComposerHidden ? mobileComposerHiddenReserve : visibleReserve;
}

/** Document detail / source flows own a floating composer outside MasterSearchHeader. */
export function isDocumentViewerOwnedRoute(pathname: string): boolean {
  if (pathname.startsWith("/documents/source")) return true;
  if (!pathname.startsWith("/documents/")) return false;
  return pathname !== "/documents/search";
}

export function resolveDashboardVisibleMobileComposerReserve(input: {
  searchMode: string;
  hasAnswerFollowUps: boolean;
  differentialsCompareAddonActive: boolean;
  compactMobileBottomSearch: boolean;
}): string {
  if (input.searchMode === "answer") {
    return input.hasAnswerFollowUps
      ? mobileComposerVisibleReserve.dashboardAnswerWithFollowUps
      : mobileComposerVisibleReserve.dashboardAnswer;
  }
  if (input.differentialsCompareAddonActive) {
    return mobileComposerVisibleReserve.differentialsCompare;
  }
  return input.compactMobileBottomSearch
    ? mobileComposerVisibleReserve.dashboardCompactSubmitted
    : mobileComposerVisibleReserve.dashboardDefaultDock;
}

export function resolveShellVisibleMobileComposerReserve(input: {
  shouldShowSearchComposer: boolean;
  documentViewerOwnedRoute: boolean;
  isStandaloneModeHome: boolean;
  searchMode: string;
  differentialsCompareAddonActive: boolean;
  useCompactBottomSearch: boolean;
}): string {
  if (!input.shouldShowSearchComposer) {
    // DocumentViewer owns its dock; shell keeps only the hidden-size pad.
    return input.documentViewerOwnedRoute ? mobileComposerHiddenReserve : mobileComposerIdleReserve;
  }
  if (input.isStandaloneModeHome) return mobileComposerIdleReserve;
  if (input.searchMode === "answer") return mobileComposerVisibleReserve.shellAnswer;
  if (input.differentialsCompareAddonActive) return mobileComposerVisibleReserve.differentialsCompare;
  return input.useCompactBottomSearch
    ? mobileComposerVisibleReserve.shellCompactSubmitted
    : mobileComposerVisibleReserve.shellDefaultDock;
}
