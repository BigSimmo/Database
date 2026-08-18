"use client";

import { RegistryModeNav } from "@/components/mode-nav/registry-mode-nav";
import { type AppModeId } from "@/lib/app-modes";
import { isInformationPage } from "@/lib/information-pages";
import {
  activeModeSecondaryNavigationId,
  isModeSecondaryNavigationRoute,
  modeUsesHeaderModeNav,
} from "@/lib/mode-secondary-navigation";

/**
 * Information pages own their header navigation. Most render
 * `InPageNavHeader`; presentation comparisons render the same shared
 * Differentials `RegistryModeNav` with their resolved selection, so the shell
 * must not add a second bar.
 */
export function hasLocalInformationPageNavigation(pathname: string): boolean {
  return isInformationPage(pathname);
}

export function PageSecondaryNavigation({
  modeId,
  pathname,
  hasSubmittedSearch,
  /**
   * Bridged query string from GlobalStandaloneSearchShellBody. Must not call
   * useSearchParams here — that reintroduces a nested Suspense boundary under
   * the standalone shell body (search-chrome invariant 17).
   */
  searchParamString = "",
}: {
  modeId: AppModeId;
  pathname: string;
  hasSubmittedSearch: boolean;
  searchParamString?: string;
}) {
  const locallyOwnedInformationNavigation = hasLocalInformationPageNavigation(pathname);
  const activeId = activeModeSecondaryNavigationId(modeId, pathname);

  if (locallyOwnedInformationNavigation) return null;
  // A mode with no registered destinations gets no bar and no landmark. The
  // seven that used to register a lone `action` entry each rendered one
  // <button> that focused a composer already on screen; it was deleted rather
  // than ported, so there is nothing left to draw for them.
  if (!modeUsesHeaderModeNav(modeId)) return null;
  if (!isModeSecondaryNavigationRoute({ modeId, pathname, hasSubmittedSearch })) return null;
  // An adopted mode's bar portals into the header's single addon slot, which
  // holds ONE page-owned header. What keeps it to one is the
  // `locallyOwnedInformationNavigation` return above: every route that portals
  // its own header (`DocumentViewer`, `differential-detail-page`, and now the
  // six converted information routes) is also locally-owned information
  // navigation, so it never reaches here. That is a coincidence of two separate
  // lists, not a stated rule — `isHeaderAddonSlotOwnedRoute` names the
  // claimants and `tests/mode-nav-addon-slot.dom.test.tsx` fails if a future one
  // falls outside that cover, which is when this needs its own guard.
  return <RegistryModeNav modeId={modeId} activeId={activeId} searchParamString={searchParamString} />;
}
