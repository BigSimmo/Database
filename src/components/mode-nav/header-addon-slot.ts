import { isDocumentViewerOwnedRoute } from "@/components/clinical-dashboard/mobile-composer-reserve";
import { isSlugDetail } from "@/lib/information-pages";

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
 * `PhoneHeaderCollapsePortal`, `InPageNavHeader`, or `RegistryModeNav`.
 */
export function isHeaderAddonSlotOwnedRoute(pathname: string): boolean {
  // DocumentViewer.tsx
  if (isDocumentViewerOwnedRoute(pathname)) return true;
  // Differentials detail and presentation workflows both provide their own
  // header navigation. Presentation workflows use the shared RegistryModeNav
  // with the workflow-resolved selection.
  if (pathname.startsWith("/differentials/diagnoses/") || pathname.startsWith("/differentials/presentations/"))
    return true;
  // factsheets/factsheet-nav-header.tsx, mounted by the detail page.
  if (isSlugDetail(pathname, "/factsheets", ["search", "topics"])) return true;
  if (isSlugDetail(pathname, "/dictionary", ["search", "browse", "topics", "compare", "sources"])) return true;
  if (pathname.startsWith("/dictionary/topics/") && !pathname.slice("/dictionary/topics/".length).includes("/"))
    return true;
  // clinical-dashboard/medication-nav-header.tsx, mounted by
  // `MedicationRecordPage`. The header drives the panel swap that
  // `SectionTabs` used to own, so the record page now claims the slot too.
  if (isSlugDetail(pathname, "/medications")) return true;
  // The six information routes converted onto the shared `InPageNavHeader`,
  // which portals through `PhoneHeaderCollapsePortal` exactly as the two above
  // do. Each is a slug detail page, never the mode home or a
  // builder/compare/map/search surface.
  if (isSlugDetail(pathname, "/services", ["search"])) return true;
  if (isSlugDetail(pathname, "/forms", ["search"])) return true;
  if (isSlugDetail(pathname, "/specifiers", ["search"])) return true;
  if (isSlugDetail(pathname, "/formulation", ["search"])) return true;
  // dsm/dsm-diagnosis-page.tsx and dsm/dsm-differential-considerations-page.tsx
  // — the record and its `/differentials` child, but not /dsm/search or
  // /dsm/compare.
  if (pathname.startsWith("/dsm/diagnoses/")) return true;
  // developer-area/developer-hub-nav-header.tsx, mounted by the hub index page
  // only. Its `/ledger` child route owns no header of its own — a plain
  // back-link `<Link>` — so an exact match is correct here, not a prefix: a
  // `startsWith` would wrongly claim the slot for that child route too.
  if (pathname === "/mockups/development") return true;
  return false;
}
