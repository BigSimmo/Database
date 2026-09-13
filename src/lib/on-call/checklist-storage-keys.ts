/**
 * The orientation checklist's storage key, its change event, and the one
 * operation the sign-out path needs — deliberately alone in a module that
 * imports nothing.
 *
 * Sibling of `recent-storage-keys.ts` and `entry-cache-keys.ts`, and here for
 * the same measured reason: `src/app/layout.tsx` mounts the auth provider on
 * every page, so importing the store instead would pull the On Call domain
 * model into every page's bundle — that cost 21 KiB gzip on `/` last time.
 *
 * Keep it free of imports. Anything added here is added to every page.
 */

export const onCallChecklistStorageKey = "clinical-kb-on-call-checklist";
export const onCallChecklistChangedEvent = "clinical-kb-on-call-checklist-changed";

/**
 * Sign-out, session-expiry and account-switch boundary.
 *
 * A tick here says "I have collected the on-call phone" — a statement about a
 * person, not about the hub. On a shared ward computer the next registrar must
 * start their term with an unticked list rather than inherit someone else's
 * progress and skip the step. Called from `src/lib/supabase/client.tsx`; do not
 * invent a second sign-out path.
 */
export function clearOnCallChecklists(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(onCallChecklistStorageKey);
    window.dispatchEvent(new Event(onCallChecklistChangedEvent));
  } catch {
    // Nothing further to do if storage itself is unavailable; there is then
    // nothing on the device to clear.
  }
}
