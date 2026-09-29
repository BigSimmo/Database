"use client";

import { useSyncExternalStore } from "react";

import { onCallYouCalledAt } from "@/lib/on-call/call-marks";
import { onCallDeviceStateChangedEvent, onCallDeviceStoreChangedEvent } from "@/lib/on-call/device-state-keys";
import { ON_CALL_YOU_CALLED_ENABLED } from "@/lib/on-call/feature-flags";

/**
 * Re-read on a store write in this tab, the sign-out wipe, or a write in
 * another tab. The snapshot is a string or null, so an unrelated write returns
 * the same value and React skips the render.
 */
function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(onCallDeviceStoreChangedEvent, onChange);
  window.addEventListener(onCallDeviceStateChangedEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(onCallDeviceStoreChangedEvent, onChange);
    window.removeEventListener(onCallDeviceStateChangedEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** When this reader last called `entryId` within 12 hours, or null (and always null while the flag is off). */
export function useOnCallYouCalledAt(entryId: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (ON_CALL_YOU_CALLED_ENABLED ? onCallYouCalledAt(entryId) : null),
    () => null,
  );
}
