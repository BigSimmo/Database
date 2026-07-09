"use client";

<<<<<<< HEAD
import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
=======
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
>>>>>>> origin/main

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

<<<<<<< HEAD
=======
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

>>>>>>> origin/main
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

<<<<<<< HEAD
=======
function usePhoneScrollHideActive(disabled = false) {
  const isPhone = useSyncExternalStore(subscribeToPhoneMedia, readPhoneMedia, readPhoneMediaServer);
  return isPhone && !disabled;
}

/**
 * Imperative scroll-offset reporter for hosts that already own a React `onScroll`
 * handler on the scrolling element (for example ClinicalDashboard `<main>`).
 */
export function useScrollHideReporter(disabled = false) {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  const lastOffsetRef = useRef(0);
  const active = usePhoneScrollHideActive(disabled);

  const reportScroll = useCallback(
    (offset: number) => {
      if (!active || offset < 0) return;
      const lastOffset = lastOffsetRef.current;
      const delta = offset - lastOffset;
      if (Math.abs(delta) < minimumDelta && offset > topRevealOffset) return;
      const update = computeScrollHideUpdate({
        offset,
        lastOffset,
        currentlyHidden: hiddenRef.current,
      });
      lastOffsetRef.current = update.lastOffset;
      hiddenRef.current = update.hidden;
      setHidden(update.hidden);
    },
    [active],
  );

  useEffect(() => {
    if (active) return undefined;
    hiddenRef.current = false;
    lastOffsetRef.current = 0;
    const frame = window.requestAnimationFrame(() => setHidden(false));
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  return { hidden: active && hidden, reportScroll };
}

>>>>>>> origin/main
interface UseHideOnScrollOptions {
  /**
   * Element that owns the scrolling. When omitted the window/document scroll
   * position is observed instead.
   */
  containerRef?: RefObject<HTMLElement | null>;
<<<<<<< HEAD
=======
  /** Resolved scroll container; preferred over containerRef when the host sets it via callback ref. */
  scrollContainer?: HTMLElement | null;
>>>>>>> origin/main
  /** Disables the behavior entirely (state resets to visible). */
  disabled?: boolean;
}

/**
 * Tracks scroll direction on phones and reports when top chrome (the
<<<<<<< HEAD
 * universal header) should hide to maximise content space. Hidden while
 * scrolling down past the header, shown again on any deliberate scroll up or
 * when near the top. Inert (always visible) above the phone breakpoint.
 */
export function useHideOnScroll({ containerRef, disabled = false }: UseHideOnScrollOptions): boolean {
  const [hidden, setHidden] = useState(false);
  const isPhone = useSyncExternalStore(subscribeToPhoneMedia, readPhoneMedia, readPhoneMediaServer);
  const active = isPhone && !disabled;
=======
 * universal header) and the bottom search dock should hide to maximise
 * content space. Hidden while scrolling down past the header, shown again
 * on any deliberate scroll up or when near the top. Inert (always visible)
 * above the phone breakpoint.
 */
export function useHideOnScroll({
  containerRef,
  scrollContainer = null,
  disabled = false,
}: UseHideOnScrollOptions): boolean {
  const { hidden, reportScroll } = useScrollHideReporter(disabled);
  const active = usePhoneScrollHideActive(disabled);
>>>>>>> origin/main

  useEffect(() => {
    if (!active) return;

<<<<<<< HEAD
    const container = containerRef?.current ?? null;
    const target: HTMLElement | Window = container ?? window;
    const readOffset = () => (container ? container.scrollTop : window.scrollY);

    let lastOffset = readOffset();
    let frame = 0;

    const evaluate = () => {
      frame = 0;
      const offset = readOffset();
      // Ignore iOS rubber-band overscroll at the top.
      if (offset < 0) return;
      const delta = offset - lastOffset;
      if (offset <= topRevealOffset) {
        lastOffset = offset;
        setHidden(false);
        return;
      }
      if (Math.abs(delta) < minimumDelta) return;
      lastOffset = offset;
      if (delta > 0) {
        if (offset > hideActivationOffset) setHidden(true);
      } else {
        setHidden(false);
      }
=======
    let frame = 0;
    let attachedTarget: HTMLElement | Window | null = null;
    let attachFrame = 0;
    let disposed = false;

    const resolveContainer = () => scrollContainer ?? containerRef?.current ?? null;

    const readOffset = () => {
      const container = resolveContainer();
      return container ? container.scrollTop : window.scrollY;
    };

    const evaluate = () => {
      frame = 0;
      reportScroll(readOffset());
>>>>>>> origin/main
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    };

<<<<<<< HEAD
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      // Leaving the phone breakpoint (or unmounting) always restores the chrome.
      setHidden(false);
    };
  }, [active, containerRef]);

  return active && hidden;
=======
    const attach = () => {
      const container = resolveContainer();
      if (containerRef && !container) return false;

      const target: HTMLElement | Window = container ?? window;
      if (target === attachedTarget) return true;

      attachedTarget?.removeEventListener("scroll", onScroll);
      attachedTarget = target;
      target.addEventListener("scroll", onScroll, { passive: true });
      reportScroll(readOffset());
      return true;
    };

    const waitForContainer = () => {
      if (disposed) return;
      if (attach()) return;
      attachFrame = window.requestAnimationFrame(waitForContainer);
    };

    if (containerRef) {
      waitForContainer();
    } else {
      attach();
    }

    return () => {
      disposed = true;
      attachedTarget?.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      if (attachFrame) window.cancelAnimationFrame(attachFrame);
    };
  }, [active, containerRef, scrollContainer, reportScroll]);

  return hidden;
>>>>>>> origin/main
}
