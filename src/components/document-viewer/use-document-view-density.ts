"use client";

import { useCallback, useSyncExternalStore } from "react";

const documentViewDensityStorageKey = "clinical-kb:document-view-density";
const documentViewDensityEvent = "clinical-kb:document-view-density-change";

function readCompactPreference(): boolean {
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
    } catch {
      // Keep the previous preference when storage is unavailable.
      return;
    }
    window.dispatchEvent(new Event(documentViewDensityEvent));
  }, []);

  return [compact, setCompact] as const;
}
