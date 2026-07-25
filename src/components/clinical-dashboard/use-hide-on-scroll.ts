"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";

import { mobileComposerHiddenReserveRem } from "@/components/clinical-dashboard/mobile-composer-reserve";

// Matches phoneSearchLayoutMediaQuery in master-search-header.tsx — the repo's
// phone/tablet seam. Hide-on-scroll runs below the sm breakpoint unless the
// host opts into all breakpoints (both app shells do this for the header; the
// bottom search dock stays phone-only).
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
// How close to the stable bottom edge (px) counts as "pinned to the bottom".
// Keep this strict for iOS rubber-band readings; animated layout clamps are
// identified from the changing scroll range instead of pixel proximity.
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
   * readChromeCollapseMetrics). In-flow collapse requires enough runway below
   * the current offset to absorb the release; reserve-only overlays require
   * the resulting range to retain top reveal plus deliberate hide intent.
   * Omitted by consumers whose chrome does not change scroll geometry.
   */
  collapseBudget?: number;
  /**
   * A fixed-viewport overlay only removes tail clearance; it does not collapse
   * an in-flow header or resize the scrollport. That path can safely hide when
   * the post-collapse range retains the top reveal band plus deliberate intent.
   */
  collapseKind?: "in-flow" | "reserve-only";
  source?: EventTarget;
}

/** Pure scroll-direction evaluation used by the hook; exported for unit tests. */
export function computeScrollHideUpdate(params: {
  offset: number;
  lastOffset: number;
  maxOffset?: number;
  previousMaxOffset?: number;
  collapseBudget?: number;
  collapseKind?: "in-flow" | "reserve-only";
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
    previousMaxOffset,
    collapseBudget,
    collapseKind,
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

  // When hidden chrome releases layout, the scroll range shrinks and a previous
  // offset beyond the new maximum becomes impossible. The browser clamps both
  // values downward; that apparent upward movement is geometry feedback, not
  // reveal intent. Hold hidden and rebase until the range stabilizes.
  //
  // Guard: only suppress when the net offset is within revealIntentDistance of
  // the new bottom edge. RAF debouncing coalesces a layout-clamp event with any
  // immediately-following user scroll into one evaluation. If the combined
  // offset is more than revealIntentDistance below the new maximum the user has
  // already supplied enough upward intent to reveal; treat it as user gesture,
  // not geometry feedback.
  if (
    currentlyHidden &&
    maxOffset !== undefined &&
    previousMaxOffset !== undefined &&
    maxOffset < previousMaxOffset &&
    offset < lastOffset &&
    lastOffset > maxOffset &&
    offset >= maxOffset - revealIntentDistance
  ) {
    return { hidden: true, lastOffset: offset, direction: null, directionTravel: 0 };
  }

  // The stable-bottom test is deliberately one-sided
  // (`offset >= maxOffset - tol`, not
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

  const effectiveHideActivationOffset = collapseKind === "reserve-only" ? topRevealOffset : hideActivationOffset;
  if (!currentlyHidden && nextDirection === "down" && offset > effectiveHideActivationOffset) {
    // In-flow chrome waits beyond its header-height band; fixed overlays begin
    // counting deliberate intent after the small top reveal band.
    const travelPastActivation = Math.min(nextDirectionTravel, offset - effectiveHideActivationOffset);
    // In-flow chrome must have enough remaining runway to absorb its release
    // (see collapseRunwaySlack above). Reserve-only overlays use the separate
    // post-collapse range test below.
    const runwayAfterCollapse =
      maxOffset === undefined || collapseBudget === undefined
        ? Number.POSITIVE_INFINITY
        : maxOffset - offset - collapseBudget;
    const postCollapseMaxOffset =
      maxOffset === undefined || collapseBudget === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(0, maxOffset - collapseBudget);
    // Reserve-only overlays keep the viewport geometry stable; requiring their
    // resulting range to retain top-reveal + hide-intent distance prevents a
    // material clamp while allowing genuinely compact results to hide. Also
    // refuse when the current offset would not fit the post-collapse range —
    // otherwise a near-bottom hide clamps the page under the finger even when
    // the resulting range itself is long enough for deliberate intent.
    const collapseHasSafeRunway =
      collapseKind === "reserve-only"
        ? postCollapseMaxOffset >= effectiveHideActivationOffset + hideIntentDistance &&
          offset <= postCollapseMaxOffset + bottomClampTolerance
        : runwayAfterCollapse > revealIntentDistance + collapseRunwaySlack;
    hidden = travelPastActivation >= hideIntentDistance && collapseHasSafeRunway;
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
 * inside a scroll handler, where layout is already flushed. The returned kind
 * distinguishes in-flow collapse from a fixed overlay that only sheds reserve.
 */
export function readChromeCollapseMetrics(
  scroller: HTMLElement,
): Pick<ScrollMetrics, "collapseBudget" | "collapseKind"> {
  const collapse = document.querySelector('[data-testid="universal-header-collapse"]');
  // The 1fr -> 0fr grid IS the collapse mechanism, so the wrapper only hands
  // layout back while it is a grid at the current width. Where it sticks and
  // translates instead (GlobalSearchShell above the phone breakpoint, which
  // hands scrolling back to the document), hiding costs the scroller nothing.
  const headerRelease =
    collapse instanceof HTMLElement && window.getComputedStyle(collapse).display === "grid"
      ? collapse.getBoundingClientRect().height
      : 0;
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
  return {
    collapseBudget: headerRelease + reserveRelease,
    collapseKind: collapse instanceof HTMLElement ? "in-flow" : reserveRelease > 0 ? "reserve-only" : undefined,
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

const usePhoneMediaStore = createBrowserStore(subscribeToPhoneMedia, readPhoneMedia, false);

function useScrollHideActive(disabled = false, allowAllBreakpoints = false) {
  const isPhone = usePhoneMediaStore();
  return (allowAllBreakpoints || isPhone) && !disabled;
}

/**
 * Imperative scroll-offset reporter for hosts that already own a React `onScroll`
 * handler on the scrolling element (for example ClinicalDashboard `<main>`).
 * Pass `allowAllBreakpoints` when the consumer hides chrome at every width
 * (both app shells do this for the header) instead of phones only, and
 * `resetKey` when the host changes the scroll geometry under the reporter
 * without remounting.
 */
export function useScrollHideReporter(disabled = false, allowAllBreakpoints = false, resetKey?: unknown) {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  const lastOffsetRef = useRef(0);
  const lastMaxOffsetRef = useRef<number | undefined>(undefined);
  const directionRef = useRef<ScrollDirection>(null);
  const directionTravelRef = useRef(0);
  const scrollSourceRef = useRef<EventTarget | null>(null);
  const hasScrollSourceRef = useRef(false);
  const active = useScrollHideActive(disabled, allowAllBreakpoints);

  const reportScroll = useCallback(
    (report: number | ScrollMetrics) => {
      const { offset, maxOffset, collapseBudget, collapseKind, source } =
        typeof report === "number"
          ? {
              offset: report,
              maxOffset: undefined,
              collapseBudget: undefined,
              collapseKind: undefined,
              source: undefined,
            }
          : report;
      if (!active) return;
      const lastOffset = lastOffsetRef.current;
      const delta = offset - lastOffset;
      const sourceChanged = source !== undefined && hasScrollSourceRef.current && scrollSourceRef.current !== source;
      const previousMaxOffset = sourceChanged ? undefined : lastMaxOffsetRef.current;
      const comparableRangeChanged =
        previousMaxOffset !== undefined && maxOffset !== undefined && previousMaxOffset !== maxOffset;
      if (source !== undefined) {
        scrollSourceRef.current = source;
        hasScrollSourceRef.current = true;
      }
      // Baseline each metrics report, even when movement itself is too small to
      // evaluate. Undefined explicitly clears stale geometry for numeric reports.
      lastMaxOffsetRef.current = maxOffset;
      if (offset < 0) return;
      if (!sourceChanged && !comparableRangeChanged && Math.abs(delta) < minimumDelta && offset > topRevealOffset)
        return;
      const update = computeScrollHideUpdate({
        offset,
        lastOffset,
        maxOffset,
        previousMaxOffset,
        collapseBudget,
        collapseKind,
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
    lastMaxOffsetRef.current = undefined;
    directionRef.current = null;
    directionTravelRef.current = 0;
    scrollSourceRef.current = null;
    hasScrollSourceRef.current = false;
    const frame = window.requestAnimationFrame(() => setHidden(false));
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  // A geometry switch under the reporter (e.g. ClinicalDashboard toggling answer
  // mode, where <main> gains/loses its header reserve) would otherwise carry a
  // stale hidden flag or last offset into the first post-switch scroll and
  // produce one spurious hide/reveal. Reset on the change itself — `active` can
  // stay true across it, so the effect above never fires there.
  useEffect(() => {
    hiddenRef.current = false;
    lastOffsetRef.current = 0;
    lastMaxOffsetRef.current = undefined;
    directionRef.current = null;
    directionTravelRef.current = 0;
    scrollSourceRef.current = null;
    hasScrollSourceRef.current = false;
    const frame = window.requestAnimationFrame(() => setHidden(false));
    return () => window.cancelAnimationFrame(frame);
  }, [allowAllBreakpoints, resetKey]);

  return { hidden: active && hidden, reportScroll };
}

/**
 * Feeds document scroll into a {@link useScrollHideReporter} for hosts whose
 * page scrolls the document above the phone breakpoint — GlobalSearchShell,
 * where `#main-content` is the scrollport only on phones and its `onScroll`
 * therefore never fires on tablet/desktop. Self-gating: while the document
 * cannot scroll (the phone shell is `fixed inset-0`) no scroll event arrives,
 * so the internal scroller stays the single source at that width.
 */
export function useDocumentScrollHideReporter(reportScroll: (metrics: ScrollMetrics) => void) {
  useEffect(() => {
    let frame = 0;

    const evaluate = () => {
      frame = 0;
      const scrollingElement = document.scrollingElement ?? document.documentElement;
      const maxOffset = Math.max(0, scrollingElement.scrollHeight - window.innerHeight);
      if (maxOffset <= 0) return;
      reportScroll({
        offset: window.scrollY,
        maxOffset,
        // Chrome that sticks to the viewport and translates away releases no
        // document layout, so there is no runway to protect here.
        collapseBudget: 0,
        source: window,
      });
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reportScroll]);
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
  const active = useScrollHideActive(disabled);

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
          ...readChromeCollapseMetrics(container),
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
