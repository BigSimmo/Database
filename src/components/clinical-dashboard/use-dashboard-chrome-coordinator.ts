"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveScrollOwner } from "@/components/clinical-dashboard/use-active-scroll-owner";
import { useEventCallback } from "@/components/clinical-dashboard/use-event-callback";
import {
  readChromeCollapseMetrics,
  useDocumentScrollHideReporter,
  useReserveTransitionMarker,
  useScrollHideReporter,
} from "@/components/clinical-dashboard/use-hide-on-scroll";
import { usePhoneOverlayChromeReserve } from "@/components/clinical-dashboard/use-phone-overlay-chrome-reserve";

/**
 * The dashboard's hide-on-scroll descriptor, by mode.
 *
 * Answer view: the header overlays `<main>` at every width (main reserves
 * matching top padding) so content frosts under the glass bar. Other modes keep
 * the wide collapse — an absolute header would bury their in-flow composer —
 * but overlay on phones, because collapsing there animates the header height
 * plus the top safe area back into the scroller and drags the reader's position
 * with it: measured 72px of unwanted content movement per hide on
 * `/?mode=documents` and `/?mode=prescribing` with no top inset reported, more
 * wherever the OS reports one. `<main>` reserves the constant
 * `--phone-overlay-chrome-h` instead. See docs/search-chrome-behaviour.md.
 */
export function resolveDashboardHideOnScroll(searchMode: string, scrollHidden: boolean) {
  return searchMode === "answer"
    ? ({ strategy: "overlay", allBreakpoints: true, scrollHidden } as const)
    : ({ strategy: "collapse", wide: "collapse", phoneMotion: "overlay", scrollHidden } as const);
}

export function useDashboardChromeCoordinator(resetKey: unknown) {
  const mainRef = useRef<HTMLElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [mainScrollRoot, setMainScrollRoot] = useState<HTMLElement | null>(null);
  const [bottomComposerHidden, setBottomComposerHidden] = useState(false);
  const chromeScrollHide = useScrollHideReporter(false, true, resetKey);
  // Publishes `--phone-overlay-chrome-h` for the overlaid phone header; no-ops
  // above the phone breakpoint.
  usePhoneOverlayChromeReserve();
  const reserveTransitioning = useReserveTransitionMarker(bottomComposerHidden, resetKey);
  const chromeTransitioning = useReserveTransitionMarker(chromeScrollHide.hidden, resetKey);
  const reportChromeScrollHide = useEventCallback(chromeScrollHide.reportScroll);
  const activeScrollOwner = useActiveScrollOwner(mainScrollRoot, resetKey);

  const assignMainRef = useCallback((node: HTMLElement | null) => {
    mainRef.current = node;
    setMainScrollRoot(node);
  }, []);

  useDocumentScrollHideReporter(chromeScrollHide.reportScroll, mainScrollRoot, composerInputRef);

  useEffect(() => {
    const main = mainScrollRoot;
    if (!main) return undefined;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        reportChromeScrollHide({
          offset: main.scrollTop,
          maxOffset: Math.max(0, main.scrollHeight - main.clientHeight),
          ...readChromeCollapseMetrics(main),
          source: main,
        });
      });
    };

    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [mainScrollRoot, reportChromeScrollHide]);

  return {
    activeScrollOwner,
    assignMainRef,
    bottomComposerHidden,
    chromeScrollHidden: chromeScrollHide.hidden,
    chromeTransitioning,
    composerInputRef,
    mainRef,
    reserveTransitioning,
    setBottomComposerHidden,
  };
}
