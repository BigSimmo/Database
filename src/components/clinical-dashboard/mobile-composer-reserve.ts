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

/** Shell pad on DocumentViewer-owned routes; the viewer manages dock clearance. */
export const mobileComposerDocumentViewerShellReserve = mobileComposerHiddenReserve;

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
