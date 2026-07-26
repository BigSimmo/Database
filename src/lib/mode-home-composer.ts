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
 * Host inside `universal-header-collapse` for Therapy section nav on phones.
 * Portaled chrome here hides/reveals with the top bar on the shared scroll signal.
 */
export const therapyHeaderCollapseAddonSlotId = "therapy-header-collapse-addon-slot";
