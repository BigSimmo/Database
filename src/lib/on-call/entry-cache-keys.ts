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
 * Whether the cache currently holds the example corpus put there by a preview
 * rather than real entries.
 *
 * A separate key, and not a `demo-` prefix test over the entries themselves,
 * because signed out the entries in view are the SHARED read — every
 * non-personal row across every account. If another account has loaded the
 * example corpus into their hub, its rows are on this reader's page too, and a
 * prefix test would call that a local preview and offer to "clear" something
 * this device never wrote. The flag records what THIS device did, which is the
 * only thing a preview may claim.
 */
export const onCallDemoPreviewStorageKey = "clinical-kb-on-call-demo-preview";

export function isOnCallDemoPreviewActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(onCallDemoPreviewStorageKey) === "1";
  } catch {
    return false;
  }
}

export function setOnCallDemoPreviewActive(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (active) window.localStorage.setItem(onCallDemoPreviewStorageKey, "1");
    else window.localStorage.removeItem(onCallDemoPreviewStorageKey);
  } catch {
    // Storage blocked or full. The preview still renders for this session from
    // the entry cache write that accompanies it; only the marker is lost, and
    // the worst outcome is the control offering Preview again.
  }
}

/**
 * Bumped only by `clearOnCallEntryCache` — the sign-out / account-switch
 * boundary. `useOnCallEntries` tags its in-flight fetch with this so a late
 * response from the previous account cannot write personal rows back after
 * the persisted key has gone.
 */
let onCallEntrySessionEpoch = 0;

export function peekOnCallEntrySessionEpoch(): number {
  return onCallEntrySessionEpoch;
}

/**
 * Sign-out, session-expiry and account-switch boundary. These are a hospital's
 * internal numbers and some are marked personal, so they must not outlive the
 * session on a shared machine. Called from `src/lib/supabase/client.tsx` — do
 * not invent a second sign-out path.
 */
export function clearOnCallEntryCache(): void {
  onCallEntrySessionEpoch += 1;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(onCallEntryCacheStorageKey);
    // The preview marker describes the cache that just went, so it goes too.
    window.localStorage.removeItem(onCallDemoPreviewStorageKey);
  } catch {
    // Storage blocked or unavailable. The epoch still advanced, so a late
    // fetch from the previous account is rejected even when this write fails.
  }
  try {
    // Always notify mounted hooks, even when the key was already gone or
    // storage itself threw: in-memory `fetched` is what they have to drop.
    window.dispatchEvent(new Event(onCallEntryCacheChangedEvent));
  } catch {
    // Event construction / dispatch failed. In-flight fetches still check the epoch.
  }
}
