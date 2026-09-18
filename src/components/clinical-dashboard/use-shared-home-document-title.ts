"use client";

import { useEffect, useRef } from "react";

import type { AppModeId } from "@/lib/app-modes";
import { sharedHomeDocumentTitle } from "@/lib/ui-copy";

/**
 * Keep the browser/assistive-technology title aligned with the mode pill on the
 * shared home — and, the half that was missing, hand the title back when the
 * shared home stops owning it.
 *
 * The pill rewrites the shared-home URL with `history.replaceState` rather than
 * asking Next to navigate, so server metadata cannot update on that path and the
 * title has to be written imperatively. An imperative write outlives its writer:
 * the effect only ever ran while the shared home was showing, so the LAST mode
 * title written on `/` was still in the tab after a client navigation to a route
 * that declares its own metadata. `/calculators/search` declares
 * "Search clinical calculators | PsychSift" and showed the shared home's title
 * instead (#3CJPX5).
 *
 * The restore is deliberately conditional. Ownership ends at the same moment the
 * next route's metadata takes over, and the order of those two is not ours to
 * decide, so the title is handed back only while it is still the exact string
 * this hook wrote. Anything else means a later owner already wrote it, and
 * restoring then would reintroduce the same defect pointing the other way.
 */
export function useSharedHomeDocumentTitle(active: boolean, modeId: AppModeId) {
  const releasedTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    // Captured before the first write and kept across mode changes, so the
    // title handed back is the route's own, not the previous mode's.
    if (releasedTitleRef.current === null) releasedTitleRef.current = document.title;
    const ownedTitle = sharedHomeDocumentTitle(modeId);
    document.title = ownedTitle;
    return () => {
      const releasedTitle = releasedTitleRef.current;
      releasedTitleRef.current = null;
      if (releasedTitle !== null && document.title === ownedTitle) document.title = releasedTitle;
    };
  }, [active, modeId]);
}
