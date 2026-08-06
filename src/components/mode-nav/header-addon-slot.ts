import { isDocumentViewerOwnedRoute } from "@/components/clinical-dashboard/mobile-composer-reserve";

/**
 * Routes whose page already portals a header into the single addon slot.
 *
 * The slot holds ONE page-owned header. Until #1642 nothing enforced that: the
 * only modes with a claimant — `documents` and `differentials` — also had fewer
 * than `MODE_NAV_MIN_ITEMS` destinations, so `ModeNav` rendered nothing and the
 * two could not collide. That is incidental protection, and it expires the
 * moment a claimant's mode gains a second destination.
 *
 * `/differentials/diagnoses/<slug>` is exactly that case. It is
 * `hasLocalInformationPageNavigation`, so it skips the information-sections
 * branch, and `isModeSecondaryNavigationRoute` returns true on it whenever a
 * search has been submitted — which, once Differentials carries three
 * destinations, mounts a second header into a slot `DifferentialDetailPage`
 * already owns.
 *
 * Claimants are named individually rather than derived, because the only
 * evidence that a route claims the slot is that its component renders
 * `PhoneHeaderCollapsePortal`. `tests/mode-nav-addon-slot.dom.test.tsx` asserts
 * exactly one occupant per route and fails if a new claimant appears without an
 * entry here.
 */
export function isHeaderAddonSlotOwnedRoute(pathname: string): boolean {
  // DocumentViewer.tsx
  if (isDocumentViewerOwnedRoute(pathname)) return true;
  // differentials/differential-detail-page.tsx (diagnoses detail only — the
  // presentations workflow page renders no portal).
  if (pathname.startsWith("/differentials/diagnoses/")) return true;
  return false;
}
