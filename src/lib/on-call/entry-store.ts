"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { createBrowserStore } from "@/lib/client-store-factory";
import { onCallEntrySchema, type OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * On-device offline cache for On Call entries (`src/lib/on-call/entry-model.ts`).
 * A junior doctor reading this in a hospital basement with no signal needs the
 * last-known phone numbers, not a spinner — so every entry the app has ever
 * successfully fetched for this owner is kept here until sign-out.
 *
 * Follows `src/lib/saved-registry-storage.ts` for the storage shape and
 * `src/components/clinical-dashboard/use-sidebar-pins.ts` for wiring a
 * `localStorage`-backed value through `createBrowserStore`.
 */

export const onCallEntryCacheStorageKey = "clinical-kb-on-call-entries-cache";
export const onCallEntryCacheChangedEvent = "clinical-kb-on-call-entries-cache-changed";

export type CachedOnCallEntries = {
  entries: OnCallEntry[];
  /** ISO timestamp of when this cache was written. A cached number with no
   *  recorded age is worse than no number — the UI must always be able to
   *  show "as of when". */
  savedAt: string;
};

const cachedEntriesSchema = z
  .object({
    entries: z.array(onCallEntrySchema),
    savedAt: z.string(),
  })
  .strict();

function parseCachedPayload(raw: string | null): CachedOnCallEntries | null {
  if (!raw) return null;
  try {
    const parsed = cachedEntriesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Read the cached copy of On Call entries. Never throws: a browser with site
 * data blocked, corrupt JSON, or a shape that no longer matches the schema all
 * return null rather than propagate into render.
 */
export function readCachedOnCallEntries(): CachedOnCallEntries | null {
  if (typeof window === "undefined") return null;
  try {
    return parseCachedPayload(window.localStorage.getItem(onCallEntryCacheStorageKey));
  } catch {
    return null;
  }
}

/**
 * Write a fresh cache and record when it was saved. Returns whether the write
 * durably succeeded; callers still have the freshly fetched entries for this
 * render even when it did not.
 */
export function cacheOnCallEntries(entries: OnCallEntry[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload: CachedOnCallEntries = { entries, savedAt: new Date().toISOString() };
    window.localStorage.setItem(onCallEntryCacheStorageKey, JSON.stringify(payload));
    window.dispatchEvent(new Event(onCallEntryCacheChangedEvent));
    return true;
  } catch {
    // Quota exceeded, private mode, or blocked storage: the caller already has
    // the entries in memory for this render, so there is nothing more to do.
    return false;
  }
}

/**
 * Sign-out / session-expiry boundary. These are a hospital's internal numbers
 * and some are marked personal, so they must not outlive the session on a
 * shared machine. Called from the existing sign-out and session-expiry paths
 * in `src/lib/supabase/client.tsx` — do not invent a second sign-out path.
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

function getCacheSnapshot(): string {
  try {
    return window.localStorage.getItem(onCallEntryCacheStorageKey) ?? "";
  } catch {
    return "";
  }
}

function subscribeToCache(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(onCallEntryCacheChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(onCallEntryCacheChangedEvent, onChange);
  };
}

// A raw JSON string gives useSyncExternalStore a stable primitive to compare
// between renders; the hook below derives the parsed value with useMemo.
const useOnCallEntryCacheSnapshot = createBrowserStore(subscribeToCache, getCacheSnapshot, "");

const onCallEntriesResponseSchema = z.object({
  entries: z.array(z.unknown()),
  signedOut: z.boolean().default(false),
});

export type OnCallEntriesState = {
  /** Last-known-good entries: freshly fetched when reachable, otherwise the
   *  cached copy. Empty, never undefined, so a render never has to guard a
   *  hole in the data. */
  entries: OnCallEntry[];
  /** When the entries currently shown were saved to this device. Null only
   *  when nothing has ever been cached here. */
  cachedAt: string | null;
  /** True until the first fetch attempt has settled, success or failure. */
  loading: boolean;
  /** True when the most recent fetch attempt failed, so `entries` (if any)
   *  are being served from the offline cache rather than the network. */
  isOffline: boolean;
  /** Mirrors the API's `signedOut` flag from the most recent successful
   *  fetch. A signed-out response is never written to the cache, so a stale
   *  cache from a previous signed-in session can still be read while this
   *  is true. */
  signedOut: boolean;
};

/**
 * Fetches On Call entries and keeps a per-device offline cache so a phone
 * with no signal still shows the last-known numbers. Every storage access
 * goes through `readCachedOnCallEntries` / `cacheOnCallEntries`, both wrapped
 * in try/catch, so a browser blocking site data degrades to "no cached
 * entries" rather than throwing into render.
 */
export function useOnCallEntries(): OnCallEntriesState {
  const cacheSnapshot = useOnCallEntryCacheSnapshot();
  const cached = useMemo(() => parseCachedPayload(cacheSnapshot || null), [cacheSnapshot]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  // What the fetch returned, held in memory. The cache is the live source once
  // it works — edits write there and must be seen — but a browser blocking
  // site data makes every write a silent no-op, and reading only the cache
  // then reported an empty hub after a perfectly successful fetch: search said
  // "nothing to search", the card said "nothing is flagged". This is the
  // fallback for that browser, not a second source of truth.
  const [fetched, setFetched] = useState<OnCallEntry[] | null>(null);

  useEffect(() => {
    // Runs once on mount only (empty deps): `loading` already starts `true`,
    // so there is nothing to reset here — setting it synchronously inside the
    // effect body would just cause an extra render.
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/on-call/entries");
        if (!response.ok) throw new Error(`On Call entries request failed: ${response.status}`);

        const rawBody: unknown = await response.json();
        const parsedResponse = onCallEntriesResponseSchema.safeParse(rawBody);
        if (!parsedResponse.success) throw new Error("On Call entries response was malformed.");

        const entries = parsedResponse.data.entries
          .map((entry) => onCallEntrySchema.safeParse(entry))
          .filter((result): result is { success: true; data: OnCallEntry } => result.success)
          .map((result) => result.data);

        if (cancelled) return;
        setIsOffline(false);
        setSignedOut(parsedResponse.data.signedOut);
        setFetched(entries);
        // Never write a signed-out (always-empty) response over a good cache:
        // a session expiring mid-shift must not erase numbers that were
        // readable a moment earlier.
        if (!parsedResponse.data.signedOut) {
          cacheOnCallEntries(entries);
        }
      } catch {
        // Offline, server error, or a malformed payload: fall back to
        // whatever is already cached rather than surfacing a blank state.
        if (cancelled) return;
        setIsOffline(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    entries: cached?.entries ?? fetched ?? [],
    cachedAt: cached?.savedAt ?? null,
    loading,
    isOffline,
    signedOut,
  };
}
