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

export function useDashboardChromeCoordinator(resetKey: unknown) {
  const mainRef = useRef<HTMLElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [mainScrollRoot, setMainScrollRoot] = useState<HTMLElement | null>(null);
  const [bottomComposerHidden, setBottomComposerHidden] = useState(false);
  const chromeScrollHide = useScrollHideReporter(false, true, resetKey);
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
