"use client";

import { useCallback } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";

/** localStorage key for an explicit expanded/collapsed pin. */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = "clinical-kb-sidebar-collapsed";

const changeEvent = "clinical-kb-sidebar-collapsed-change";

/**
 * Maps a raw stored value to the collapsed preference. Absent key (`null` /
 * `undefined`) resolves to collapsed so first-run and never-toggled browsers
 * match the closed-by-default product choice. When a value is present,
 * collapsed is true only for the explicit `"1"` pin (same ternary the store
 * used before this helper was extracted). Storage errors are handled by
 * callers (they pass null / use their own catch path).
 */
export function readSidebarCollapsedPreference(storedValue: string | null | undefined): boolean {
  return storedValue === null || storedValue === undefined ? true : storedValue === "1";
}

// In-memory fallback when localStorage writes fail (e.g. private browsing mode).
// Null means no fallback needed; storage is the source of truth.
let inMemoryFallback: boolean | null = null;

function getSnapshot() {
  // When storage writes have failed, the in-memory fallback takes precedence
  // so the UI reflects the user's toggle even when persistence is unavailable.
  if (inMemoryFallback !== null) {
    return inMemoryFallback;
  }
  try {
    const storedValue = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    // Collapsed is the default whenever the key is absent. The key is only
    // written after an explicit toggle, so browsers that never touched the
    // control (returning users included) also land on collapsed — matching
    // the already-closed mobile drawer. Explicit "0"/"1" preferences still
    // win; expanding remains a remembered choice.
    return readSidebarCollapsedPreference(storedValue);
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

const useSidebarCollapsedStore = createBrowserStore(subscribe, getSnapshot, true);

/**
 * Desktop sidebar collapse state shared across shells and persisted per
 * browser, mirroring the use-theme.ts external-store pattern so the choice
 * survives route changes between the dashboard and standalone shells.
 */
export function useSidebarCollapsed() {
  const collapsed = useSidebarCollapsedStore();
  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      // Storage write succeeded; clear the in-memory fallback so persisted
      // storage remains the source of truth.
      inMemoryFallback = null;
    } catch {
      // Storage write failed (private mode, quota exceeded, etc.); remember
      // the requested state in memory so the UI can reflect the toggle.
      inMemoryFallback = next;
    }
    window.dispatchEvent(new Event(changeEvent));
  }, []);
  return [collapsed, setCollapsed] as const;
}
