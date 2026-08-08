"use client";

import { useCallback } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";
import { isAppModeId, type AppModeId } from "@/lib/app-modes";

/** localStorage key for the most recently selected app mode. */
export const LAST_APP_MODE_STORAGE_KEY = "clinical-kb-last-app-mode";

const changeEvent = "clinical-kb-last-app-mode-change";

/**
 * The mode a cold visit to `/` opens in. Answer is the product default and the
 * same fallback `src/app/(search-app)/page.tsx` resolves an unknown `?mode=` to,
 * so server and client agree before any stored preference is read.
 */
export const DEFAULT_APP_MODE: AppModeId = "answer";

/**
 * Maps a raw stored value to a mode id. Anything absent, malformed, or naming a
 * mode that no longer exists resolves to the default rather than throwing — the
 * key outlives mode-registry changes, so a stale value must degrade quietly.
 */
export function readLastAppModePreference(storedValue: string | null | undefined): AppModeId {
  return isAppModeId(storedValue) ? storedValue : DEFAULT_APP_MODE;
}

// In-memory fallback when localStorage writes fail (e.g. private browsing mode).
// Null means no fallback needed; storage is the source of truth.
let inMemoryFallback: AppModeId | null = null;

function getSnapshot(): AppModeId {
  // When storage writes have failed, the in-memory fallback takes precedence so
  // the pill still reflects the user's pick even when persistence is unavailable.
  if (inMemoryFallback !== null) {
    return inMemoryFallback;
  }
  try {
    return readLastAppModePreference(window.localStorage.getItem(LAST_APP_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_APP_MODE;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

const useLastAppModeStore = createBrowserStore(subscribe, getSnapshot, DEFAULT_APP_MODE);

/**
 * The last mode picked from the shared composer's mode pill, persisted per
 * browser and mirroring the use-sidebar-collapsed.ts / use-theme.ts external-store
 * pattern so the choice survives route changes between the dashboard and the
 * standalone shells.
 *
 * This is a *seed* for a bare `/` visit only. Whenever the URL carries `?mode=`,
 * that param wins: it is the SSR source of truth, so a reloaded or shared
 * `/?mode=dsm` server-renders the DSM placeholder with no hydration flip.
 */
export function useLastAppMode() {
  const lastMode = useLastAppModeStore();
  const setLastMode = useCallback((next: AppModeId) => {
    try {
      window.localStorage.setItem(LAST_APP_MODE_STORAGE_KEY, next);
      // Storage write succeeded; clear the in-memory fallback so persisted
      // storage remains the source of truth.
      inMemoryFallback = null;
    } catch {
      // Storage write failed (private mode, quota exceeded, etc.); remember the
      // requested mode in memory so the UI can reflect the pick.
      inMemoryFallback = next;
    }
    window.dispatchEvent(new Event(changeEvent));
  }, []);
  return [lastMode, setLastMode] as const;
}
