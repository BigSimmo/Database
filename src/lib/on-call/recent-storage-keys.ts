/**
 * The storage key, its change event, and the one operation the sign-out path
 * needs — deliberately alone in a module that imports nothing.
 *
 * This is the sibling of `entry-cache-keys.ts` and exists for the same measured
 * reason: `src/app/layout.tsx` mounts the auth provider on every page, and that
 * provider clears this list when the session ends or the account changes.
 * Importing the store instead would pull the On Call domain model into every
 * page's bundle — that cost 21 KiB gzip on `/` last time.
 *
 * Keep it free of imports. Anything added here is added to every page.
 */

export const onCallRecentStorageKey = "clinical-kb-on-call-recent";
export const onCallRecentChangedEvent = "clinical-kb-on-call-recent-changed";

/**
 * Sign-out, session-expiry and account-switch boundary.
 *
 * This is a list of what the last person looked up and rang during their shift.
 * On a shared ward phone that must not survive the account that made it, so it
 * is cleared alongside the entry cache. Called from `src/lib/supabase/client.tsx`
 * — do not invent a second sign-out path.
 *
 * The key is REMOVED rather than set to an empty list, so "nobody has used this
 * device" and "somebody used it and signed out" leave the same trace.
 */
export function clearOnCallRecent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(onCallRecentStorageKey);
    window.dispatchEvent(new Event(onCallRecentChangedEvent));
  } catch {
    // Nothing further to do if storage itself is unavailable; there is then
    // nothing on the device to clear.
  }
}
