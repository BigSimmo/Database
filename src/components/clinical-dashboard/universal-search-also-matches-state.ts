import type { AppModeId } from "@/lib/app-modes";

/**
 * Answer threads may be restored from session storage on the shared home. The
 * cross-mode panel belongs only to a submitted Answer URL, not to a persisted
 * answer object that happens to still be available after navigation.
 *
 * `locationSearch === null` is the server-render path. The Answer panel is not
 * mounted there until client-side answer state exists, so allowing it preserves
 * hydration while the client applies the actual URL contract before fetching.
 */
export function shouldRunUniversalAlsoMatches(modeId: AppModeId, locationSearch: string | null) {
  if (modeId !== "answer" || locationSearch === null) return true;
  const params = new URLSearchParams(locationSearch);
  const query = (params.get("q") ?? params.get("query") ?? "").trim();
  return params.get("run") === "1" && query.length > 0;
}
