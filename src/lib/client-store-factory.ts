"use client";

import { useSyncExternalStore } from "react";

/**
 * Creates a safe, SSR-compatible wrapper for useSyncExternalStore that guards
 * browser-only APIs (window, navigator, localStorage) behind a typeof window
 * check, ensuring deterministic hydration and eliminating code duplication.
 */
export function createBrowserStore<T>(
  subscribeFn: (onStoreChange: () => void) => () => void,
  getSnapshotFn: () => T,
  serverSnapshot: T,
) {
  const subscribe = (onStoreChange: () => void) => {
    if (typeof window === "undefined") {
      return () => {};
    }
    return subscribeFn(onStoreChange);
  };

  const getSnapshot = () => {
    if (typeof window === "undefined") {
      return serverSnapshot;
    }
    return getSnapshotFn();
  };

  return function useBrowserStore() {
    return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  };
}
