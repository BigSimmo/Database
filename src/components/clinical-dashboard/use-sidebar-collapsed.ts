"use client";

import { useCallback, useSyncExternalStore } from "react";

const storageKey = "clinical-kb-sidebar-collapsed";
const changeEvent = "clinical-kb-sidebar-collapsed-change";

function getSnapshot() {
  try {
    const storedValue = window.localStorage.getItem(storageKey);
    // New users get the labelled (expanded) sidebar: eight icon-only
    // destinations demand recall/hover; collapsing stays a remembered choice.
    return storedValue === null ? false : storedValue === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

/**
 * Desktop sidebar collapse state shared across shells and persisted per
 * browser, mirroring the use-theme.ts external-store pattern so the choice
 * survives route changes between the dashboard and standalone shells.
 */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // Ignore storage failures (private mode); state simply won't persist.
    }
    window.dispatchEvent(new Event(changeEvent));
  }, []);
  return [collapsed, setCollapsed] as const;
}
