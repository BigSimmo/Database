import { useSyncExternalStore } from "react";

// The upload view switches to a two-region desktop layout at >=1024px. This is a
// useSyncExternalStore-backed media-query subscription so the value stays correct
// across SSR (no window) and live viewport changes. Extracted from
// ClinicalDashboard.tsx (maturity X3) as a pure move.
const uploadDesktopMediaQuery = "(min-width: 1024px)";

function subscribeToUploadDesktopLayout(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(uploadDesktopMediaQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getUploadDesktopLayoutSnapshot() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(uploadDesktopMediaQuery).matches
  );
}

/**
 * Whether the upload view has room for its desktop two-region layout (viewport >= 1024px).
 * Server-safe: the getServerSnapshot returns false during SSR to avoid a hydration
 * mismatch, and the value updates on viewport changes on the client.
 */
export function useUploadDesktopLayout() {
  return useSyncExternalStore(subscribeToUploadDesktopLayout, getUploadDesktopLayoutSnapshot, () => false);
}
