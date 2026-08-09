import { isDocumentViewerOwnedRoute } from "@/components/clinical-dashboard/mobile-composer-reserve";

/**
 * Routes whose page already portals a header into the header's single addon
 * slot, which holds ONE page-owned header.
 *
 * This exists because nothing states that invariant. What has always enforced
 * it is a coincidence: `documents` and `differentials`, the only modes with a
 * claimant, had fewer than `MODE_NAV_MIN_ITEMS` destinations, so `ModeNav`
 * rendered nothing. Differentials now has three, and the protection that
 * replaced it is a second coincidence — every claimant route is also
 * `hasLocalInformationPageNavigation`, which returns null in
 * `PageSecondaryNavigation` before the mode branch is reached.
 *
 * Both are properties of separate lists that happen to agree, not rules. This
 * predicate makes the claimant set explicit so the agreement is checkable:
 * `tests/mode-nav-addon-slot.dom.test.tsx` asserts every route here is covered
 * by that early return, and fails when a future claimant is not — which is the
 * point at which the mode branch needs a guard of its own.
 *
 * Claimants are named individually rather than derived, because the only
 * evidence that a route claims the slot is that its component renders
 * `PhoneHeaderCollapsePortal`.
 */
export function isHeaderAddonSlotOwnedRoute(pathname: string): boolean {
  // DocumentViewer.tsx
  if (isDocumentViewerOwnedRoute(pathname)) return true;
  // differentials/differential-detail-page.tsx (diagnoses detail only — the
  // presentations workflow page renders no portal).
  if (pathname.startsWith("/differentials/diagnoses/")) return true;
  // The six information routes converted onto the shared `InPageNavHeader`,
  // which portals through `PhoneHeaderCollapsePortal` exactly as the two above
  // do. Each is a slug detail page, never the mode home or a
  // builder/compare/map/search surface.
  if (isSlugDetailRoute(pathname, "/services")) return true;
  if (isSlugDetailRoute(pathname, "/forms")) return true;
  if (isSlugDetailRoute(pathname, "/specifiers")) return true;
  if (isSlugDetailRoute(pathname, "/formulation")) return true;
  // dsm/dsm-diagnosis-page.tsx and dsm/dsm-differential-considerations-page.tsx
  // — the record and its `/differentials` child, but not /dsm/search or
  // /dsm/compare.
  if (pathname.startsWith("/dsm/diagnoses/")) return true;
  return false;
}

/** `/services/some-slug`, but not `/services`, `/services/compare` or a deeper path. */
function isSlugDetailRoute(pathname: string, home: string): boolean {
  if (!pathname.startsWith(`${home}/`)) return false;
  const rest = pathname.slice(home.length + 1);
  if (!rest || rest.includes("/")) return false;
  return !["builder", "compare", "map", "search"].includes(rest);
}
