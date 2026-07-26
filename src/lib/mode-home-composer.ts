export const modeHomeDesktopComposerSlotId = "mode-home-desktop-composer-slot";
export const desktopPageComposerSlotId = "desktop-page-search-composer-slot";

/** Set on page-owned composer slots only after the owning segment has hydrated. */
export const desktopComposerSlotReadyAttr = "data-composer-slot-ready";
export const desktopComposerSlotReadyValue = "true";

export function isDesktopComposerSlotReady(slot: Element | null | undefined): boolean {
  return slot?.getAttribute(desktopComposerSlotReadyAttr) === desktopComposerSlotReadyValue;
}

/** Mobile/tablet search-composer slot for differentials compare actions. */
export const differentialsMobileCompareAddonSlotId = "differentials-mobile-compare-addon-slot";

/**
 * The one page-owned phone navigation host inside `universal-header-collapse`.
 * Portaled chrome here shares the universal header's scroll signal, safe-area
 * release, focus pinning, transition timing, and collapse-budget measurement.
 */
export const phoneHeaderCollapseAddonSlotId = "phone-header-collapse-addon-slot";

export const phoneHeaderCollapsePortalFocusEvent = "phone-header-collapse-portal-focus";

export type PhoneHeaderCollapsePortalFocusDetail = {
  focused: boolean;
};
