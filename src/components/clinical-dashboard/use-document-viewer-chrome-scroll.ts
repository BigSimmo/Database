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
  // Safari browser tabs deliberately scroll the document so its own toolbar
  // can collapse. Installed PWAs retain #main-content as a bounded scroller.
  // Observe both potential owners and combine their identical state machines;
  // only the active owner emits movement. Binding only to the always-present
  // #main-content leaves DocumentViewer's footer pinned open in Safari.
  const innerScrollHidden = useHideOnScroll({
    scrollContainer: shellScrollContainer,
    disabled: !shellScrollContainer,
    resetKey,
  });
  const documentScrollHidden = useHideOnScroll({
    documentCollapseRoot: shellScrollContainer,
    resetKey,
  });
  const scrollHidden = innerScrollHidden || documentScrollHidden;
  const composerScrollHidden = scrollHidden && !mobileActionsOpen && !composerChromeFocused;
  const reserveTransitioning = useReserveTransitionMarker(composerScrollHidden, resetKey);
  return { composerScrollHidden, reserveTransitioning };
}
