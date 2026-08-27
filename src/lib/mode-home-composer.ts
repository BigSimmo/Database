export const modeHomeDesktopComposerSlotId = "mode-home-desktop-composer-slot";
export const desktopPageComposerSlotId = "desktop-page-search-composer-slot";

/** Set on page-owned composer slots only after the owning segment has hydrated. */
export const desktopComposerSlotReadyAttr = "data-composer-slot-ready";
export const desktopComposerSlotReadyValue = "true";

/**
 * Mode-home hero slots SSR with this attribute so settled composer geometry is
 * reserved before the portal attaches (CLS). MasterSearchHeader clears it when
 * the home media query does not match or portal adoption falls back, so a never-
 * filled phone slot collapses instead of leaving a permanent empty band.
 */
export const modeHomeComposerReserveAttr = "data-composer-reserve";
export const modeHomeComposerReservePendingValue = "pending";

export function isDesktopComposerSlotReady(slot: Element | null | undefined): boolean {
  return slot?.getAttribute(desktopComposerSlotReadyAttr) === desktopComposerSlotReadyValue;
}

export function setModeHomeComposerReservePending(slot: Element | null | undefined, pending: boolean): void {
  if (!slot) return;
  if (pending) {
    slot.setAttribute(modeHomeComposerReserveAttr, modeHomeComposerReservePendingValue);
  } else {
    slot.removeAttribute(modeHomeComposerReserveAttr);
  }
}

/** Mobile/tablet search-composer slot for differentials compare actions. */
export const differentialsMobileCompareAddonSlotId = "differentials-mobile-compare-addon-slot";

/** Phone search-composer slot for the medication surfaces' Patient details pill. */
export const patientDetailsAddonSlotId = "patient-details-addon-slot";

/** Phone search-composer slot for the Therapy Compass compare tray. */
export const therapyCompareAddonSlotId = "therapy-compare-addon-slot";

/**
 * Which page-owned action currently occupies the phone dock's addon slot.
 *
 * The dock carries exactly ONE addon at a time — `data-footer-addon` is a single
 * attribute value, and the scrim height, hide transform, and content reserve are
 * all keyed off it. The two claimants are mutually exclusive by surface
 * (differentials vs medications/prescribing vs therapy) and
 * `tests/phone-dock-addon-contract.test.ts` pins that, so the slot never has to
 * hold two.
 */
export type PhoneDockAddonKind = "differentials-compare" | "patient-details" | "therapy-compare";

export const phoneDockAddonSlotId: Record<PhoneDockAddonKind, string> = {
  "differentials-compare": differentialsMobileCompareAddonSlotId,
  "patient-details": patientDetailsAddonSlotId,
  "therapy-compare": therapyCompareAddonSlotId,
};

/**
 * The one page-owned phone navigation host inside `universal-header-collapse`.
 * Portaled chrome here shares the universal header's scroll signal, safe-area
 * release, focus pinning, transition timing, and collapse-budget measurement.
 */
export const phoneHeaderCollapseAddonSlotId = "phone-header-collapse-addon-slot";
