"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";

import { mobileComposerHiddenReserveRem } from "@/components/clinical-dashboard/mobile-composer-reserve";

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
// Once the header's activation band has passed, require a little more
// continuous downward travel before hiding. Reappearing should be easier, but
// still deliberate enough that trackpad/touch momentum cannot flicker the
// chrome at a direction change.
const hideIntentDistance = 24;
const revealIntentDistance = 12;
// How close to the bottom edge (px) counts as "pinned to the bottom". When the
// offset is this near the maximum, an upward reading is the viewport growing
// under a collapsing header rather than a real scroll, so it must not reveal.
const bottomClampTolerance = 1;
// Hiding the chrome releases its layout space back to the scroller (header
// grid collapse + dock reserve-pad shrink), shrinking maxOffset by the same
// amount. When the runway left below the current offset is smaller than that
// release, the position clamps straight onto the new bottom edge and any
// upward drag past revealIntentDistance snaps the geometry back under the
// finger — a hide/reveal oscillation that reads as "scroll locks to the
// bottom" on short pages (phone mode homes after #964). The slack keeps a
// margin past the reveal threshold so the post-collapse position cannot sit
// within one deliberate micro-drag of a reveal.
const collapseRunwaySlack = 16;

type ScrollDirection = "down" | "up" | null;
export interface ScrollMetrics {
  offset: number;
  maxOffset?: number;
  /**
   * Layout px the chrome would release if it hid right now (see
   * readChromeCollapseBudget). When provided together with maxOffset, hiding
   * is refused unless enough runway remains below the offset to absorb the
   * release. Omitted by consumers whose chrome does not change scroll
   * geometry when hiding.
   */
  collapseBudget?: number;
  source?: EventTarget;
}

/** Pure scroll-direction evaluation used by the hook; exported for unit tests. */
export function computeScrollHideUpdate(params: {
  offset: number;
  lastOffset: number;
  maxOffset?: number;
  collapseBudget?: number;
  sourceChanged?: boolean;
  currentlyHidden: boolean;
  direction?: ScrollDirection;
  directionTravel?: number;
}): {
  hidden: boolean;
  lastOffset: number;
  direction: ScrollDirection;
  directionTravel: number;
} {
  const {
    offset,
    lastOffset,
    maxOffset,
    collapseBudget,
    sourceChanged = false,
    currentlyHidden,
    direction = null,
    directionTravel = 0,
  } = params;
  // Ignore iOS rubber-band overscroll at the top.
  if (offset < 0) return { hidden: currentlyHidden, lastOffset, direction, directionTravel };
  // Offsets from different scroll containers are not comparable. Preserve the
  // current chrome state and establish a fresh intent baseline for this source.
  if (sourceChanged) {
    return { hidden: currentlyHidden, lastOffset: offset, direction: null, directionTravel: 0 };
  }
  if (offset <= topRevealOffset) {
    return { hidden: false, lastOffset: offset, direction: null, directionTravel: 0 };
  }

  // Collapsing in-flow chrome grows the scroll viewport: as the header hands its
  // height back to the content, the browser clamps scrollTop to the new, smaller
  // maximum and emits an apparent upward scroll even though the user is moving
  // down or holding at the bottom. A collapse animates over several frames, so
  // this clamp repeats frame after frame; if any frame's phantom "up" reveals
  // the chrome, the viewport shrinks again and a hide/reveal scroll-bounce
  // begins. While the chrome is hidden and the offset stays pinned to the bottom
  // edge, treat every upward reading as layout feedback — hold the hidden state
  // and rebase intent so only a genuine upward scroll (one that pulls the offset
  // clear of the bottom) can reveal. This intentionally does not depend on the
  // previous offset's relationship to the maximum, which the browser's per-frame
  // clamping makes unreliable during the collapse.
  //
  // The bottom test is deliberately one-sided (`offset >= maxOffset - tol`, not
  // `|offset - maxOffset| <= tol`): iOS rubber-band overscroll at the bottom can
  // report a scrollTop *past* the maximum, and while the content springs back
  // the reading moves up. That is still the bottom edge, not a scroll away from
  // it, so it must hold hidden too — mirroring the `offset < 0` guard that holds
  // state through top overscroll. A symmetric window would instead reveal the
  // chrome mid-rubber-band, reintroducing the flicker this guard removes.
  if (currentlyHidden && maxOffset !== undefined && offset < lastOffset && offset >= maxOffset - bottomClampTolerance) {
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
    // Only count travel beyond the activation band. This stops a single flick
    // from the top hiding the chrome the instant it clears the header height.
    const travelPastActivation = Math.min(nextDirectionTravel, offset - hideActivationOffset);
    // Refuse to hide when the geometry the chrome would release exceeds the
    // remaining runway (see collapseRunwaySlack above). Short pages then keep
    // their chrome and scroll plainly; long pages simply never start a hide
    // this close to the bottom edge.
    const runwayAfterCollapse =
      maxOffset === undefined || collapseBudget === undefined
        ? Number.POSITIVE_INFINITY
        : maxOffset - offset - collapseBudget;
    hidden =
      travelPastActivation >= hideIntentDistance && runwayAfterCollapse > revealIntentDistance + collapseRunwaySlack;
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

/**
 * Measures how much layout (px) the chrome would release into the given
 * scroller if hide-on-scroll fired right now: the in-flow collapsible header
 * strip plus every visible dock-clearance pad above its hidden size. Reads the
 * documented DOM contracts — `universal-header-collapse` for the header
 * (absent under the overlay strategy, which does not affect geometry and so
 * contributes 0), `mobile-composer-reserve-pad` for the shell reserve,
 * `document-viewer-content` for DocumentViewer's own clearance (its hidden
 * `pb-3` equals the shared 0.75rem hidden reserve), falling back to the
 * scroller's own padding exactly like tests/playwright-scroll.ts. Call from
 * inside a scroll handler, where layout is already flushed.
 */
export function readChromeCollapseBudget(scroller: HTMLElement): number {
  const collapse = document.querySelector('[data-testid="universal-header-collapse"]');
  const headerRelease = collapse instanceof HTMLElement ? collapse.getBoundingClientRect().height : 0;
  const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const hiddenPadPx = mobileComposerHiddenReserveRem * rootFontSize;
  const padRelease = (element: Element | null): number => {
    if (!(element instanceof HTMLElement)) return 0;
    const paddingBottom = Number.parseFloat(window.getComputedStyle(element).paddingBottom);
    return Number.isFinite(paddingBottom) ? Math.max(0, paddingBottom - hiddenPadPx) : 0;
  };
  const reservePad = scroller.querySelector('[data-testid="mobile-composer-reserve-pad"]');
  const viewerPad = scroller.querySelector('[data-testid="document-viewer-content"]');
  const reserveRelease =
    reservePad || viewerPad ? padRelease(reservePad) + padRelease(viewerPad) : padRelease(scroller);
  return headerRelease + reserveRelease;
}

function subscribeToPhoneMedia(onChange: () => void) {
  const media = window.matchMedia(phoneMediaQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readPhoneMedia() {
  return window.matchMedia(phoneMediaQuery).matches;
}

const usePhoneMediaStore = createBrowserStore(subscribeToPhoneMedia, readPhoneMedia, false);

function usePhoneScrollHideActive(disabled = false, allowAllBreakpoints = false) {
  const isPhone = usePhoneMediaStore();
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
  const scrollSourceRef = useRef<EventTarget | null>(null);
  const hasScrollSourceRef = useRef(false);
  const active = usePhoneScrollHideActive(disabled, allowAllBreakpoints);

  const reportScroll = useCallback(
    (report: number | ScrollMetrics) => {
      const { offset, maxOffset, collapseBudget, source } =
        typeof report === "number"
          ? { offset: report, maxOffset: undefined, collapseBudget: undefined, source: undefined }
          : report;
      if (!active || offset < 0) return;
      const lastOffset = lastOffsetRef.current;
      const delta = offset - lastOffset;
      const sourceChanged = source !== undefined && hasScrollSourceRef.current && scrollSourceRef.current !== source;
      if (source !== undefined) {
        scrollSourceRef.current = source;
        hasScrollSourceRef.current = true;
      }
      if (!sourceChanged && Math.abs(delta) < minimumDelta && offset > topRevealOffset) return;
      const update = computeScrollHideUpdate({
        offset,
        lastOffset,
        maxOffset,
        collapseBudget,
        sourceChanged,
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
    scrollSourceRef.current = null;
    hasScrollSourceRef.current = false;
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
    scrollSourceRef.current = null;
    hasScrollSourceRef.current = false;
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
          collapseBudget: readChromeCollapseBudget(container),
          source: container,
        };
      }
      const scrollingElement = document.scrollingElement ?? document.documentElement;
      return {
        offset: window.scrollY,
        maxOffset: Math.max(0, scrollingElement.scrollHeight - window.innerHeight),
        source: window,
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
