"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

// Matches phoneSearchLayoutMediaQuery in master-search-header.tsx — the repo's
// phone/tablet seam. Collapse only ever runs below the sm breakpoint.
const phoneMediaQuery = "(max-width: 639px)";

// Reserved height for the fixed answer footer composer (pill + chips + safe area).
const defaultComposerInsetPx = 132;
// Small tolerance so the row hides just before it visually overlaps the composer.
const dockBandThresholdPx = 12;

function subscribeToPhoneMedia(onChange: () => void) {
  const media = window.matchMedia(phoneMediaQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readPhoneMedia() {
  return window.matchMedia(phoneMediaQuery).matches;
}

function readPhoneMediaServer() {
  return false;
}

interface UseCollapseWhenContentBelowOptions {
  /** Scroll container (`#main-content`). */
  containerRef?: RefObject<HTMLElement | null>;
  /** The Clinical notes / Evidence row wrapper. */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Sentinel placed after all content below the action row. */
  belowSentinelRef?: RefObject<HTMLElement | null>;
  /** Viewport inset reserved for the fixed bottom composer. */
  composerInsetPx?: number;
  /** Disables the behavior entirely (state resets to expanded). */
  disabled?: boolean;
}

/**
 * On phones, collapses the answer support action row when it sits in the
 * composer dock band while unscrolled content still lives below it (e.g.
 * follow-up suggestions). Expands again at the true scroll bottom or when
 * the row leaves the dock band.
 */
export function useCollapseWhenContentBelow({
  containerRef,
  anchorRef,
  belowSentinelRef,
  composerInsetPx = defaultComposerInsetPx,
  disabled = false,
}: UseCollapseWhenContentBelowOptions): boolean {
  const [collapsed, setCollapsed] = useState(false);
  const isPhone = useSyncExternalStore(subscribeToPhoneMedia, readPhoneMedia, readPhoneMediaServer);
  const active = isPhone && !disabled;

  useEffect(() => {
    if (!active) return;

    const container = containerRef?.current ?? null;
    const anchor = anchorRef?.current ?? null;
    const sentinel = belowSentinelRef?.current ?? null;
    if (!container || !anchor || !sentinel) return;

    let frame = 0;

    const evaluate = () => {
      frame = 0;
      const dockLine = window.innerHeight - composerInsetPx;
      const anchorRect = anchor.getBoundingClientRect();
      const sentinelRect = sentinel.getBoundingClientRect();
      const inDockBand = anchorRect.bottom >= dockLine - dockBandThresholdPx;
      const contentBelow = sentinelRect.top > dockLine;
      setCollapsed(inDockBand && contentBelow);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    };

    container.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();

    return () => {
      container.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      setCollapsed(false);
    };
  }, [active, containerRef, anchorRef, belowSentinelRef, composerInsetPx]);

  return active && collapsed;
}
