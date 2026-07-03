"use client";

import { useSyncExternalStore } from "react";

const sourcePreviewSheetMediaQuery = "(max-width: 1023px)";

function subscribeToMobilePreviewMedia(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(sourcePreviewSheetMediaQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getMobilePreviewSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(sourcePreviewSheetMediaQuery).matches;
}

export function useMobilePreviewSheet() {
  return useSyncExternalStore(subscribeToMobilePreviewMedia, getMobilePreviewSnapshot, () => false);
}
