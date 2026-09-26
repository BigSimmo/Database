import { onCallDeviceStoreChangedEvent, onCallEmergencyPinnedStorageKey } from "@/lib/on-call/device-state-keys";

/**
 * Whether a hospital showed a pinned emergency row the last time it loaded on
 * this device — a yes or no only, never the number (review F7, idea 4).
 *
 * Now reserves the emergency module's space from this answer before the network
 * replies, so the row never arrives above something the reader is about to tap.
 * Keyed `service:site`. `clearOnCallDeviceState()` wipes it at sign-out.
 */

function readMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(onCallEmergencyPinnedStorageKey) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>);
    return entries.every(([, value]) => typeof value === "boolean") ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** `null` when this hospital has never loaded on this device. */
export function readOnCallEmergencyPinned(hospitalKey: string): boolean | null {
  const value = readMap()[hospitalKey];
  return typeof value === "boolean" ? value : null;
}

export function rememberOnCallEmergencyPinned(hospitalKey: string, hasPinned: boolean): void {
  if (typeof window === "undefined" || !hospitalKey) return;
  const map = readMap();
  if (map[hospitalKey] === hasPinned) return;
  try {
    window.localStorage.setItem(onCallEmergencyPinnedStorageKey, JSON.stringify({ ...map, [hospitalKey]: hasPinned }));
    window.dispatchEvent(new Event(onCallDeviceStoreChangedEvent));
  } catch {
    // Blocked storage: Now reserves no space and simply waits for the network.
  }
}
