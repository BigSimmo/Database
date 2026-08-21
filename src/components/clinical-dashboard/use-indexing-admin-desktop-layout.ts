import { useSyncExternalStore } from "react";

// The indexing administration view switches to a two-region desktop layout at
// >=1024px. useSyncExternalStore keeps the media-query value correct across SSR
// and live viewport changes without an effect-driven hydration mismatch.
const indexingAdminDesktopMediaQuery = "(min-width: 1024px)";

function subscribeToIndexingAdminDesktopLayout(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(indexingAdminDesktopMediaQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getIndexingAdminDesktopLayoutSnapshot() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(indexingAdminDesktopMediaQuery).matches
  );
}

/**
 * Whether indexing administration has room for its desktop two-region layout.
 * The server snapshot is false to keep hydration stable, and the client value
 * follows viewport changes.
 */
export function useIndexingAdminDesktopLayout() {
  return useSyncExternalStore(
    subscribeToIndexingAdminDesktopLayout,
    getIndexingAdminDesktopLayoutSnapshot,
    () => false,
  );
}
