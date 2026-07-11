export const savedServicesStorageKey = "clinical-kb-saved-services";
export const savedFormsStorageKey = "clinical-kb-saved-forms";
export const savedDifferentialsStorageKey = "clinical-kb-saved-differentials";
export const savedRegistryStorageChangedEvent = "clinical-kb-saved-registry-changed";

export function readSavedRegistrySlugs(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function writeSavedRegistrySlugs(key: string, slugs: string[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(slugs));
    window.dispatchEvent(new CustomEvent(savedRegistryStorageChangedEvent, { detail: { key } }));
    return true;
  } catch {
    // Quota exceeded, private-mode, or blocked storage: report failure so callers
    // can surface a save-failed state instead of throwing unhandled.
    return false;
  }
}

export function subscribeSavedRegistrySlugs(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === savedServicesStorageKey ||
      event.key === savedFormsStorageKey ||
      event.key === savedDifferentialsStorageKey
    ) {
      onChange();
    }
  };
  const handleCustom = () => onChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(savedRegistryStorageChangedEvent, handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(savedRegistryStorageChangedEvent, handleCustom);
  };
}
