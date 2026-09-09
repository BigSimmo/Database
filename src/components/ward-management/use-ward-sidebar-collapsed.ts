"use client";

import { useCallback } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";

/**
 * Ward Flow's desktop sidebar collapse preference. Deliberately mirrors the structure of
 * `src/components/clinical-dashboard/use-sidebar-collapsed.ts` — external store over
 * `localStorage`, collapsed by default, in-memory fallback when a storage write fails — because
 * that is the repository's established pattern and Ward Flow should behave the way the rest of
 * the application behaves.
 *
 * It does **not** reuse the clinical hook or its storage key. Ward Flow is a sandbox that
 * interacts with the application only through the developer hub; sharing a persisted preference
 * would be a second channel between them, and expanding the prototype's sidebar would silently
 * expand the clinical application's.
 */
export const WARD_SIDEBAR_COLLAPSED_STORAGE_KEY = "ward-flow-sidebar-collapsed";

const changeEvent = "ward-flow-sidebar-collapsed-change";

/**
 * Maps a raw stored value to the collapsed preference. An absent key resolves to collapsed, so a
 * first visit gets the icon rail the prototype has always had rather than a panel it never
 * asked for. Once a value is present, collapsed is true only for the explicit `"1"` pin.
 */
export function readWardSidebarCollapsedPreference(storedValue: string | null | undefined): boolean {
  return storedValue === null || storedValue === undefined ? true : storedValue === "1";
}

// Null means no fallback is needed and storage is the source of truth.
let inMemoryFallback: boolean | null = null;

function getSnapshot() {
  if (inMemoryFallback !== null) {
    return inMemoryFallback;
  }
  try {
    return readWardSidebarCollapsedPreference(window.localStorage.getItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY));
  } catch {
    return true;
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

const useWardSidebarCollapsedStore = createBrowserStore(subscribe, getSnapshot, true);

export function useWardSidebarCollapsed() {
  const collapsed = useWardSidebarCollapsedStore();
  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      inMemoryFallback = null;
    } catch {
      // Private browsing or quota exhaustion: remember the toggle in memory so the UI still
      // reflects what the user just did, even though it will not survive a reload.
      inMemoryFallback = next;
    }
    window.dispatchEvent(new Event(changeEvent));
  }, []);
  return [collapsed, setCollapsed] as const;
}
