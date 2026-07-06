"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

// Matches phoneSearchLayoutMediaQuery in master-search-header.tsx — the repo's
// phone/tablet seam. Hide-on-scroll only ever runs below the sm breakpoint.
const phoneMediaQuery = "(max-width: 639px)";

// Scroll offset (px) that must be passed before the chrome may hide; roughly
// the header's own height so it never vanishes while still fully in view.
const hideActivationOffset = 56;
// Offset (px) at or below which the chrome is always shown.
const topRevealOffset = 8;
// Minimum per-event delta (px) before we treat movement as intentional, to
// avoid jitter from momentum settling and fractional scroll positions.
const minimumDelta = 4;

/** Pure scroll-direction evaluation used by the hook; exported for unit tests. */
export function computeScrollHideUpdate(params: { offset: number; lastOffset: number; currentlyHidden: boolean }): {
  hidden: boolean;
  lastOffset: number;
} {
  const { offset, lastOffset, currentlyHidden } = params;
  // Ignore iOS rubber-band overscroll at the top.
  if (offset < 0) return { hidden: currentlyHidden, lastOffset };
  const delta = offset - lastOffset;
  if (offset <= topRevealOffset) {
    return { hidden: false, lastOffset: offset };
  }
  if (Math.abs(delta) < minimumDelta) {
    return { hidden: currentlyHidden, lastOffset };
  }
  if (delta > 0) {
    return { hidden: offset > hideActivationOffset, lastOffset: offset };
  }
  return { hidden: false, lastOffset: offset };
}

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

interface UseHideOnScrollOptions {
  /**
   * Element that owns the scrolling. When omitted the window/document scroll
   * position is observed instead.
   */
  containerRef?: RefObject<HTMLElement | null>;
  /** Disables the behavior entirely (state resets to visible). */
  disabled?: boolean;
}

/**
 * Tracks scroll direction on phones and reports when top chrome (the
 * universal header) and the bottom search dock should hide to maximise
 * content space. Hidden while scrolling down past the header, shown again
 * on any deliberate scroll up or when near the top. Inert (always visible)
 * above the phone breakpoint.
 */
export function useHideOnScroll({ containerRef, disabled = false }: UseHideOnScrollOptions): boolean {
  const [hidden, setHidden] = useState(false);
  const isPhone = useSyncExternalStore(subscribeToPhoneMedia, readPhoneMedia, readPhoneMediaServer);
  const active = isPhone && !disabled;

  useEffect(() => {
    if (!active) return;

    const container = containerRef?.current ?? null;
    const target: HTMLElement | Window = container ?? window;
    const readOffset = () => (container ? container.scrollTop : window.scrollY);

    let lastOffset = readOffset();
    let frame = 0;

    const evaluate = () => {
      frame = 0;
      const offset = readOffset();
      if (offset < 0) return;
      const delta = offset - lastOffset;
      if (Math.abs(delta) < minimumDelta && offset > topRevealOffset) return;
      const update = computeScrollHideUpdate({ offset, lastOffset, currentlyHidden: false });
      lastOffset = update.lastOffset;
      setHidden(update.hidden);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      // Leaving the phone breakpoint (or unmounting) always restores the chrome.
      setHidden(false);
    };
  }, [active, containerRef]);

  return active && hidden;
}
