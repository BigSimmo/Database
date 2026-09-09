"use client";

import { useSyncExternalStore } from "react";

// Matches Tailwind `sm` / Dictionary compare: phone sheet below 640px.
// useSyncExternalStore keeps the media-query value correct across SSR and
// live viewport changes without an effect-driven hydration mismatch — see
// `use-indexing-admin-desktop-layout.ts` for the same pattern.
const phoneMediaQuery = "(max-width: 639px)";

function subscribeToPhoneMedia(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(phoneMediaQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getPhoneMediaSnapshot() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(phoneMediaQuery).matches
  );
}

/**
 * Whether the viewport is phone-width. The server snapshot is false to keep
 * hydration stable, and the client value follows viewport changes.
 */
export function usePhoneMedia() {
  return useSyncExternalStore(subscribeToPhoneMedia, getPhoneMediaSnapshot, () => false);
}
