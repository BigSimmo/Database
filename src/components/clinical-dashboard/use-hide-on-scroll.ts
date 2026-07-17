"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

// Matches phoneSearchLayoutMediaQuery in master-search-header.tsx — the repo's
// phone/tablet seam. Hide-on-scroll runs below the sm breakpoint unless the
// host opts into all breakpoints (the ClinicalDashboard glass-header overlay).
const phoneMediaQuery = "(max-width: 639px)";

// Scroll offset (px) that must be passed before the chrome may hide; the
// header's own height (72px borderless bar; <main> reserves the same strip)
// so it never vanishes while its reserve is still in view.
const hideActivationOffset = 72;
// Offset (px) at or below which the chrome is always shown.
const topRevealOffset = 8;
// Minimum per-event delta (px) before we treat movement as intentional, to
// avoid jitter from momentum settling and fractional scroll positions.
const minimumDelta = 4;
// Require sustained motion before changing chrome state. This filters
// fractional momentum reversals without making a deliberate reveal feel slow.
const hideIntentDistance = 24;
const revealIntentDistance = 12;

type ScrollDirection = "down" | "up" | null;

export interface ScrollMetrics {
  offset: number;
  maxOffset?: number;
}

/** Pure scroll-direction evaluation used by the hook; exported for unit tests. */
export function computeScrollHideUpdate(params: {
  offset: number;
  lastOffset: number;
  maxOffset?: number;
  currentlyHidden: boolean;
  direction?: ScrollDirection;
  directionTravel?: number;
}): {
  hidden: boolean;
  lastOffset: number;
  direction: ScrollDirection;
  directionTravel: number;
} {
  const { offset, lastOffset, maxOffset, currentlyHidden, direction = null, directionTravel = 0 } = params;
  // Ignore iOS rubber-band overscroll at the top.
  if (offset < 0) return { hidden: currentlyHidden, lastOffset, direction, directionTravel };
  if (offset <= topRevealOffset) {
    return { hidden: false, lastOffset: offset, direction: null, directionTravel: 0 };
  }

  // Collapsing in-flow chrome grows the scroll viewport. At the bottom the
  // browser clamps scrollTop to the new maximum and emits an apparent upward
  // scroll even though the user is still moving down. Keep the chrome hidden
  // and rebase intent so that layout feedback cannot start a hide/show loop.
  if (
    currentlyHidden &&
    maxOffset !== undefined &&
    lastOffset > maxOffset + minimumDelta &&
    Math.abs(offset - maxOffset) <= 1
  ) {
    return { hidden: true, lastOffset: offset, direction: null, directionTravel: 0 };
  }

  const delta = offset - lastOffset;
  if (Math.abs(delta) < minimumDelta) {
    return { hidden: currentlyHidden, lastOffset, direction, directionTravel };
  }

  const nextDirection: Exclude<ScrollDirection, null> = delta > 0 ? "down" : "up";
  const nextDirectionTravel = nextDirection === direction ? directionTravel + Math.abs(delta) : Math.abs(delta);
  let hidden = currentlyHidden;

  if (!currentlyHidden && nextDirection === "down" && offset > hideActivationOffset) {
    const travelPastActivation = Math.min(nextDirectionTravel, offset - hideActivationOffset);
    hidden = travelPastActivation >= hideIntentDistance;
  } else if (currentlyHidden && nextDirection === "up" && nextDirectionTravel >= revealIntentDistance) {
    hidden = false;
  }

  return {
    hidden,
    lastOffset: offset,
    direction: nextDirection,
    directionTravel: nextDirectionTravel,
  };
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

function usePhoneScrollHideActive(disabled = false, allowAllBreakpoints = false) {
  const isPhone = useSyncExternalStore(subscribeToPhoneMedia, readPhoneMedia, readPhoneMediaServer);
  return (allowAllBreakpoints || isPhone) && !disabled;
}

/**
 * Imperative scroll-offset reporter for hosts that already own a React `onScroll`
 * handler on the scrolling element (for example ClinicalDashboard `<main>`).
 * Pass `allowAllBreakpoints` when the consumer hides chrome at every width
 * (the all-breakpoints glass-header overlay) instead of phones only.
 */
export function useScrollHideReporter(disabled = false, allowAllBreakpoints = false) {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  const lastOffsetRef = useRef(0);
  const directionRef = useRef<ScrollDirection>(null);
  const directionTravelRef = useRef(0);
  const active = usePhoneScrollHideActive(disabled, allowAllBreakpoints);

  const reportScroll = useCallback(
    (report: number | ScrollMetrics) => {
      const { offset, maxOffset } = typeof report === "number" ? { offset: report, maxOffset: undefined } : report;
      if (!active || offset < 0) return;
      const lastOffset = lastOffsetRef.current;
      const delta = offset - lastOffset;
      if (Math.abs(delta) < minimumDelta && offset > topRevealOffset) return;
      const update = computeScrollHideUpdate({
        offset,
        lastOffset,
        maxOffset,
        currentlyHidden: hiddenRef.current,
        direction: directionRef.current,
        directionTravel: directionTravelRef.current,
      });
      lastOffsetRef.current = update.lastOffset;
      hiddenRef.current = update.hidden;
      directionRef.current = update.direction;
      directionTravelRef.current = update.directionTravel;
      setHidden(update.hidden);
    },
    [active],
  );

  useEffect(() => {
    if (active) return undefined;
    hiddenRef.current = false;
    lastOffsetRef.current = 0;
    directionRef.current = null;
    directionTravelRef.current = 0;
    const frame = window.requestAnimationFrame(() => setHidden(false));
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  // The gate widening/narrowing (e.g. ClinicalDashboard toggling answer mode)
  // changes the scroll geometry underneath us (<main> gains/loses its header
  // reserve), so a carried-over hidden flag or last offset would produce one
  // spurious hide/reveal on the first post-switch scroll. Reset on the change
  // itself — `active` can stay true across it on phones, so the effect above
  // never fires there.
  useEffect(() => {
    hiddenRef.current = false;
    lastOffsetRef.current = 0;
    directionRef.current = null;
    directionTravelRef.current = 0;
    const frame = window.requestAnimationFrame(() => setHidden(false));
    return () => window.cancelAnimationFrame(frame);
  }, [allowAllBreakpoints]);

  return { hidden: active && hidden, reportScroll };
}

interface UseHideOnScrollOptions {
  /**
   * Element that owns the scrolling. When omitted the window/document scroll
   * position is observed instead.
   */
  containerRef?: RefObject<HTMLElement | null>;
  /** Resolved scroll container; preferred over containerRef when the host sets it via callback ref. */
  scrollContainer?: HTMLElement | null;
  /** Disables the behavior entirely (state resets to visible). */
  disabled?: boolean;
  /** Resets hidden state when the host changes navigation context without remounting. */
  resetKey?: unknown;
}

/**
 * Tracks scroll direction on phones and reports when top chrome (the
 * universal header) and the bottom search dock should hide to maximise
 * content space. Hidden while scrolling down past the header, shown again
 * on any deliberate scroll up or when near the top. Inert (always visible)
 * above the phone breakpoint.
 */
export function useHideOnScroll({
  containerRef,
  scrollContainer = null,
  disabled = false,
  resetKey,
}: UseHideOnScrollOptions): boolean {
  const { hidden, reportScroll } = useScrollHideReporter(disabled);
  const active = usePhoneScrollHideActive(disabled);

  useEffect(() => {
    reportScroll(0);
  }, [reportScroll, resetKey]);

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    let attachedTarget: HTMLElement | Window | null = null;
    let attachFrame = 0;
    let disposed = false;

    const resolveContainer = () => scrollContainer ?? containerRef?.current ?? null;

    const readMetrics = (): ScrollMetrics => {
      const container = resolveContainer();
      if (container) {
        return {
          offset: container.scrollTop,
          maxOffset: Math.max(0, container.scrollHeight - container.clientHeight),
        };
      }
      const scrollingElement = document.scrollingElement ?? document.documentElement;
      return {
        offset: window.scrollY,
        maxOffset: Math.max(0, scrollingElement.scrollHeight - window.innerHeight),
      };
    };

    const evaluate = () => {
      frame = 0;
      reportScroll(readMetrics());
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    };

    const attach = () => {
      const container = resolveContainer();
      if (containerRef && !container) return false;

      const target: HTMLElement | Window = container ?? window;
      if (target === attachedTarget) return true;

      attachedTarget?.removeEventListener("scroll", onScroll);
      attachedTarget = target;
      target.addEventListener("scroll", onScroll, { passive: true });
      reportScroll(readMetrics());
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
}
