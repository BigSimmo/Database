/**
 * The storage key for Admin's pinned numbers, its change event, and the one
 * operation the sign-out path needs — deliberately alone in a module that
 * imports nothing, the same reason as `src/lib/on-call/recent-storage-keys.ts`:
 * the auth provider on every page calls `clearAdminPins`, so anything imported
 * here is added to every page.
 *
 * Owner decision, 2026-10-01: pins live on this device only, and hold row ids
 * and nothing else — never a title, a phone number or any other record text.
 */

export const adminPinsStorageKey = "clinical-kb-admin-pins";
export const adminPinsChangedEvent = "clinical-kb-admin-pins-changed";

/**
 * Sign-out, session-expiry and account-switch boundary. Pins name the entries a
 * person rings, which belongs to that person and not to the next one to pick up
 * a shared ward phone. Called from `src/lib/supabase/client.tsx`. The key is
 * removed rather than emptied, so "never pinned" and "signed out" look alike.
 */
export function clearAdminPins(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(adminPinsStorageKey);
    window.dispatchEvent(new Event(adminPinsChangedEvent));
  } catch {
    // Storage unavailable: there is nothing on the device to clear.
  }
}
