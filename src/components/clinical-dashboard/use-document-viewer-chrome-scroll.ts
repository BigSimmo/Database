"use client";

import { useHideOnScroll, useReserveTransitionMarker } from "@/components/clinical-dashboard/use-hide-on-scroll";

/** Document viewer phone chrome: scroll-hide + short-lived reserve transition marker. */
export function useDocumentViewerChromeScroll(
  shellScrollContainer: HTMLElement | null,
  documentId: string,
  activePage: number,
  activeChunkId: string | null | undefined,
  mobileActionsOpen: boolean,
  composerChromeFocused: boolean,
) {
  const resetKey = `${documentId}:${activePage}:${activeChunkId ?? ""}`;
  const scrollHidden = useHideOnScroll({
    ...(shellScrollContainer ? { scrollContainer: shellScrollContainer } : {}),
    resetKey,
  });
  const composerScrollHidden = scrollHidden && !mobileActionsOpen && !composerChromeFocused;
  const reserveTransitioning = useReserveTransitionMarker(composerScrollHidden, resetKey);
  return { composerScrollHidden, reserveTransitioning };
}
