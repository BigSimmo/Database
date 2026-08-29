/**
 * Stable identifiers shared by the settings surface and its tests.
 *
 * Search and section-jump navigation were removed from this deliberately
 * compact surface. Keep this module limited to DOM/test identifiers so adding
 * a setting does not require maintaining a parallel navigation or search
 * index.
 */

export type SettingsSectionId =
  | "account"
  | "clinical-defaults"
  | "app-preferences"
  | "personalisation"
  | "notifications"
  | "privacy"
  | "keyboard"
  | "help"
  | "development";

export function sectionDomId(id: SettingsSectionId) {
  return `settings-section-${id}`;
}

/** Stable per-row test id, derived from the visible label. */
export function settingsRowTestId(label: string) {
  return `settings-row-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}
