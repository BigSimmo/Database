"use client";

import { useCallback } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";

const storageKey = "clinical-kb-sidebar-collapsed";
const changeEvent = "clinical-kb-sidebar-collapsed-change";

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
    const storedValue = window.localStorage.getItem(storageKey);
    // New users get the labelled (expanded) sidebar: eight icon-only
    // destinations demand recall/hover; collapsing stays a remembered choice.
    return storedValue === null ? false : storedValue === "1";
  } catch {
    return false;
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

const useSidebarCollapsedStore = createBrowserStore(subscribe, getSnapshot, false);

/**
 * Desktop sidebar collapse state shared across shells and persisted per
 * browser, mirroring the use-theme.ts external-store pattern so the choice
 * survives route changes between the dashboard and standalone shells.
 */
export function useSidebarCollapsed() {
  const collapsed = useSidebarCollapsedStore();
  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
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
