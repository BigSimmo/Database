"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { mayContainOnCallCompliance } from "@/lib/on-call/compliance";
import { createBrowserStore } from "@/lib/client-store-factory";
// The key, its event and the clear function live in a module that imports
// nothing, so the auth provider can clear this cache without pulling the On
// Call domain model into every page's bundle. Re-exported here so existing
// call sites are unchanged.
import {
  clearOnCallEntryCache,
  isOnCallDemoPreviewActive,
  onCallEntryCacheChangedEvent,
  onCallEntryCacheStorageKey,
  peekOnCallEntrySessionEpoch,
} from "@/lib/on-call/entry-cache-keys";
import { onCallEntrySchema, type OnCallEntry } from "@/lib/on-call/entry-model";

export { clearOnCallEntryCache, onCallEntryCacheChangedEvent, onCallEntryCacheStorageKey, peekOnCallEntrySessionEpoch };

/**
 * On-device offline cache for On Call entries (`src/lib/on-call/entry-model.ts`).
 * A junior doctor reading this in a hospital basement with no signal needs the
 * last-known phone numbers, not a spinner — public entries are kept for at most seven days. Private entries stay in
 * session memory and are dropped on sign-out or an account change.
 *
 * Follows `src/lib/saved-registry-storage.ts` for the storage shape and
 * `src/components/clinical-dashboard/use-sidebar-pins.ts` for wiring a
 * `localStorage`-backed value through `createBrowserStore`.
 */

export type CachedOnCallEntries = {
  entries: OnCallEntry[];
  /** ISO timestamp of when this cache was written. A cached number with no
   *  recorded age is worse than no number — the UI must always be able to
   *  show "as of when". */
  savedAt: string;
};

export const ON_CALL_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Private entries belong to the current session, never durable device storage.
let sessionCache: string | null = null;
let sessionCacheEpoch = peekOnCallEntrySessionEpoch();

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
    if (!parsed.success) return null;
    const age = Date.now() - Date.parse(parsed.data.savedAt);
    if (!Number.isFinite(age) || age < 0 || age >= ON_CALL_CACHE_MAX_AGE_MS) return null;
    return parsed.data;
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
    scrubPersistedOnCallCache();
    return parseCachedPayload(getCacheSnapshot());
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
    sessionCache = JSON.stringify(payload);
    sessionCacheEpoch = peekOnCallEntrySessionEpoch();
    window.localStorage.setItem(
      onCallEntryCacheStorageKey,
      JSON.stringify({
        ...payload,
        entries: entries.filter(
          (entry) => !entry.isPersonal && !mayContainOnCallCompliance(entry.section, entry.details),
        ),
      }),
    );
    window.dispatchEvent(new Event(onCallEntryCacheChangedEvent));
    return true;
  } catch {
    // Quota exceeded, private mode, or blocked storage: the caller already has
    // the entries in memory for this render, so there is nothing more to do.
    return false;
  }
}

function scrubPersistedOnCallCache(): void {
  try {
    const raw = window.localStorage.getItem(onCallEntryCacheStorageKey);
    const persisted = parseCachedPayload(raw);
    if (!persisted) {
      if (raw !== null) window.localStorage.removeItem(onCallEntryCacheStorageKey);
      return;
    }
    // Retire legacy durable private rows on first read, even while offline.
    const safe = JSON.stringify({
      ...persisted,
      entries: persisted.entries.filter(
        (entry) => !entry.isPersonal && !mayContainOnCallCompliance(entry.section, entry.details),
      ),
    });
    if (safe !== raw) {
      try {
        window.localStorage.setItem(onCallEntryCacheStorageKey, safe);
      } catch {
        try {
          window.localStorage.removeItem(onCallEntryCacheStorageKey);
        } catch {
          /* Storage denied; only safe data is returned. */
        }
      }
    }
  } catch {
    /* Denied storage remains inaccessible; rendering still filters private rows. */
  }
}

function getCacheSnapshot(): string {
  if (sessionCacheEpoch !== peekOnCallEntrySessionEpoch()) {
    sessionCache = null;
    sessionCacheEpoch = peekOnCallEntrySessionEpoch();
  }
  if (sessionCache !== null) return parseCachedPayload(sessionCache) ? sessionCache : "";
  try {
    const persisted = parseCachedPayload(window.localStorage.getItem(onCallEntryCacheStorageKey));
    return persisted
      ? JSON.stringify({
          ...persisted,
          entries: persisted.entries.filter(
            (entry) => !entry.isPersonal && !mayContainOnCallCompliance(entry.section, entry.details),
          ),
        })
      : "";
  } catch {
    return "";
  }
}

function subscribeToCache(onChange: () => void) {
  // Subscription runs after render, keeping the external-store snapshot pure.
  scrubPersistedOnCallCache();
  function onFocus() {
    scrubPersistedOnCallCache();
    onChange();
  }
  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== onCallEntryCacheStorageKey) return;
    // Another tab's sign-out must also invalidate this tab's in-memory rows.
    if (event.newValue === null) clearOnCallEntryCache();
    else sessionCache = null;
    onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", onFocus);
  window.addEventListener(onCallEntryCacheChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener(onCallEntryCacheChangedEvent, onChange);
  };
}

// A raw JSON string gives useSyncExternalStore a stable primitive to compare
// between renders; the hook below derives the parsed value with useMemo.
const useOnCallEntryCacheSnapshot = createBrowserStore(subscribeToCache, getCacheSnapshot, "");

const onCallEntriesResponseSchema = z.object({
  entries: z.array(z.unknown()),
  signedOut: z.boolean().default(false),
  // The API sets this only in demo mode, where the corpus is served from
  // memory and Supabase is never reached. Defaulted rather than required, so a
  // live response (which omits it) parses unchanged.
  demoMode: z.boolean().default(false),
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
   *  fetch. Signed-out responses replace the cache with public entries only. */
  signedOut: boolean;
  /** True when the entries came from the in-memory demo corpus rather than the
   *  database. Nothing in this mode can be written, so a control that offers to
   *  is a control that can only fail. */
  demoMode: boolean;
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
  const [demoMode, setDemoMode] = useState(false);
  // What the fetch returned, held in memory. The cache is the live source once
  // it works — edits write there and must be seen — but a browser blocking
  // site data makes every write a silent no-op, and reading only the cache
  // then reported an empty hub after a perfectly successful fetch: search said
  // "nothing to search", the card said "nothing is flagged". This is the
  // fallback for that browser, not a second source of truth.
  const [fetched, setFetched] = useState<OnCallEntry[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  // Advanced only when `clearOnCallEntryCache` runs (sign-out / account
  // switch). Restarting the fetch on that number, and tagging the in-flight
  // request with it, is what stops a late response from account A writing
  // personal rows back after the persisted key has gone.
  const [sessionEpoch, setSessionEpoch] = useState(peekOnCallEntrySessionEpoch);

  useEffect(() => {
    function onCacheChanged() {
      if (peekOnCallEntrySessionEpoch() === sessionEpoch) return;
      // The persisted key is gone. Drop the in-memory fallback immediately —
      // `cached?.entries ?? fetched` would otherwise keep rendering account A's
      // personal rows once `cached` is null. Loading goes true here rather
      // than inside the fetch effect: that effect cannot call setState
      // synchronously (react-hooks/set-state-in-effect).
      setFetched(null);
      setLoading(true);
      setSessionEpoch(peekOnCallEntrySessionEpoch());
    }
    window.addEventListener(onCallEntryCacheChangedEvent, onCacheChanged);
    return () => window.removeEventListener(onCallEntryCacheChangedEvent, onCacheChanged);
  }, [sessionEpoch]);

  useEffect(() => {
    const epochAtStart = peekOnCallEntrySessionEpoch();
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/on-call/entries", { signal: controller.signal });
        if (!response.ok) throw new Error(`On Call entries request failed: ${response.status}`);

        const rawBody: unknown = await response.json();
        const parsedResponse = onCallEntriesResponseSchema.safeParse(rawBody);
        if (!parsedResponse.success) throw new Error("On Call entries response was malformed.");

        const entries = parsedResponse.data.entries
          .map((entry) => onCallEntrySchema.safeParse(entry))
          .filter((result): result is { success: true; data: OnCallEntry } => result.success)
          .map((result) => result.data)
          .filter(
            (entry) =>
              !parsedResponse.data.signedOut ||
              (!entry.isPersonal && !mayContainOnCallCompliance(entry.section, entry.details)),
          );

        if (cancelled || peekOnCallEntrySessionEpoch() !== epochAtStart) return;
        setIsOffline(false);
        setSignedOut(parsedResponse.data.signedOut);
        setDemoMode(parsedResponse.data.demoMode);
        setFetched(entries);
        setFetchedAt(Date.now());
        // A successful empty response withdraws the previous rows. Only a failed
        // request may fall back to cache. Synthetic preview is an explicit,
        // separately marked choice and is not overwritten by real responses.
        if (!isOnCallDemoPreviewActive()) {
          cacheOnCallEntries(entries);
        }
      } catch (error) {
        // Abort is the account-transition path, not a network failure.
        if (cancelled || peekOnCallEntrySessionEpoch() !== epochAtStart) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Offline, server error, or a malformed payload: fall back to
        // whatever is already cached rather than surfacing a blank state.
        setIsOffline(true);
      } finally {
        if (!cancelled && peekOnCallEntrySessionEpoch() === epochAtStart) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionEpoch]);

  return {
    entries:
      cached?.entries ??
      (fetchedAt !== null && Date.now() - fetchedAt < ON_CALL_CACHE_MAX_AGE_MS ? fetched : null) ??
      [],
    cachedAt: cached?.savedAt ?? null,
    loading,
    isOffline,
    signedOut,
    demoMode,
  };
}
