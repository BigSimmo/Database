"use client";

import { useCallback, useSyncExternalStore } from "react";

const documentViewDensityStorageKey = "clinical-kb:document-view-density";
const documentViewDensityEvent = "clinical-kb:document-view-density-change";

// Session fallback when localStorage is unavailable (private mode / quota).
// Mirrors use-theme / use-app-preferences so the toggle still updates the UI.
let transientCompactPreference: boolean | null = null;

function readCompactPreference(): boolean {
  if (transientCompactPreference !== null) return transientCompactPreference;
  try {
    return window.localStorage.getItem(documentViewDensityStorageKey) !== "full";
  } catch {
    return true;
  }
}

function subscribeDocumentViewDensity(onStoreChange: () => void) {
  window.addEventListener(documentViewDensityEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(documentViewDensityEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useDocumentViewDensity() {
  const compact = useSyncExternalStore(subscribeDocumentViewDensity, readCompactPreference, () => true);

  const setCompact = useCallback((nextCompact: boolean) => {
    try {
      window.localStorage.setItem(documentViewDensityStorageKey, nextCompact ? "compact" : "full");
      transientCompactPreference = null;
    } catch {
      // Storage blocked: keep the choice in memory for this session.
      transientCompactPreference = nextCompact;
    }
    window.dispatchEvent(new Event(documentViewDensityEvent));
  }, []);

  return [compact, setCompact] as const;
}
