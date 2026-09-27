"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/*
 * The time, rounded down to the tick so the snapshot is stable. An external
 * store, not state set in an effect. Null on the server and during hydration,
 * so a page never shows a time the browser then contradicts.
 */
export function useTeachingNow(intervalMs: number = 30_000): Date | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const timer = window.setInterval(onChange, intervalMs);
      return () => window.clearInterval(timer);
    },
    [intervalMs],
  );
  const tick = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
  return useMemo(() => (tick === null ? null : new Date(tick)), [tick]);
}
