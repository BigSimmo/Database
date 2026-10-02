"use client";

import { useEffect } from "react";

/*
 * Keeps the screen awake while a check-in code is on show (Screen Wake Lock).
 * The browser drops the lock whenever the page is hidden, so it is asked for
 * again when the page is visible again. Released on unmount or when `active`
 * turns false. Where the API is missing or the request is refused, nothing
 * happens: the screen simply sleeps as it normally would.
 */
type Sentinel = { release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

function wakeLockApi(): WakeLockApi | null {
  if (typeof navigator === "undefined") return null;
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  return api && typeof api.request === "function" ? api : null;
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const api = active ? wakeLockApi() : null;
    if (!api) return;
    let stopped = false;
    let held: Sentinel | null = null;
    let requesting = false;

    const release = (sentinel: Sentinel | null) => {
      if (sentinel) void sentinel.release().catch(() => undefined);
    };

    const acquire = () => {
      if (stopped || held || requesting || document.visibilityState !== "visible") return;
      requesting = true;
      let pending: Promise<Sentinel>;
      try {
        pending = api.request("screen");
      } catch {
        requesting = false;
        return;
      }
      pending.then(
        (sentinel) => {
          requesting = false;
          if (stopped) release(sentinel);
          else held = sentinel;
        },
        () => {
          requesting = false;
        },
      );
    };

    const onVisibility = () => {
      // Hidden: the browser has already let go of the lock, so forget it and ask again on return.
      if (document.visibilityState === "visible") acquire();
      else held = null;
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release(held);
      held = null;
    };
  }, [active]);
}
