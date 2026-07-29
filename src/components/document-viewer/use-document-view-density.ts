"use client";

import { useCallback, useEffect, useState } from "react";

const documentViewDensityStorageKey = "clinical-kb:document-view-density";

export function useDocumentViewDensity() {
  const [compact, setCompactState] = useState(true);

  useEffect(() => {
    try {
      setCompactState(window.localStorage.getItem(documentViewDensityStorageKey) !== "full");
    } catch {
      // Keep the compact default when storage is unavailable.
    }
  }, []);

  const setCompact = useCallback((nextCompact: boolean) => {
    setCompactState(nextCompact);
    try {
      window.localStorage.setItem(documentViewDensityStorageKey, nextCompact ? "compact" : "full");
    } catch {
      // The in-memory choice still works when storage is unavailable.
    }
  }, []);

  return [compact, setCompact] as const;
}
