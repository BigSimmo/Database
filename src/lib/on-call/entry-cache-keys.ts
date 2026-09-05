/**
 * The storage key, its change event, and the one operation the sign-out path
 * needs — deliberately alone in a module that imports nothing.
 *
 * `src/app/layout.tsx` mounts the auth provider on every page, and that
 * provider clears this cache when the session ends or the account changes. It
 * used to import `clearOnCallEntryCache` from `entry-store`, which pulls in
 * `entry-model` and its six per-section Zod schemas — so the whole On Call
 * domain model was downloaded by anyone opening the home page, purely so that
 * signing out could remove one `localStorage` key. Measured: route `/` fell
 * from 265.3 KiB to 244.4 KiB gzip once this module existed.
 *
 * Keep it free of imports. Anything added here is added to every page.
 */

export const onCallEntryCacheStorageKey = "clinical-kb-on-call-entries-cache";
export const onCallEntryCacheChangedEvent = "clinical-kb-on-call-entries-cache-changed";

/**
 * Sign-out, session-expiry and account-switch boundary. These are a hospital's
 * internal numbers and some are marked personal, so they must not outlive the
 * session on a shared machine. Called from `src/lib/supabase/client.tsx` — do
 * not invent a second sign-out path.
 */
export function clearOnCallEntryCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(onCallEntryCacheStorageKey);
    window.dispatchEvent(new Event(onCallEntryCacheChangedEvent));
  } catch {
    // Nothing further to do if storage itself is unavailable; there is then
    // nothing on the device to clear.
  }
}
