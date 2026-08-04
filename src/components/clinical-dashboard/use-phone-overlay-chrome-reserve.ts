"use client";

import { useLayoutEffect } from "react";

import { phoneMediaQuery } from "./use-hide-on-scroll";

const headerStackSelector = ".phone-sticky-header-stack";
const collapseSelector = '[data-testid="universal-header-collapse"]';
const reserveProperty = "--phone-overlay-chrome-h";

/**
 * #147 recorded the provisional 200px stack correcting to 72px 15–60ms later.
 * Require 80ms of unchanged frame-sampled geometry: strictly beyond that
 * observed window, with one nominal 60Hz frame of margin. This is elapsed
 * rendering time, not a timer sleep; every geometry signal restarts the window.
 */
export const phoneOverlayReserveGeometryQuietWindowMs = 80;

/**
 * Reads the phone overlay header stack height that `--phone-overlay-chrome-h`
 * should publish. Returns 0 when the stack is temporarily unmeasurable
 * (`display: contents`, mid-unmount) so callers can keep the previous value
 * instead of publishing `0px` over the CSS seed.
 */
export function readPhoneOverlayChromeReservePx(root: ParentNode = document): number {
  const collapse = root.querySelector<HTMLElement>(collapseSelector);
  const stack = collapse?.closest<HTMLElement>(headerStackSelector) ?? null;
  // Prefer `||` over `??`: a present stack with offsetHeight 0 (display:contents
  // / empty mid-unmount) must fall through to the collapse row, and a 0 from
  // both must stay 0 so the publisher can refuse to clobber the CSS seed.
  return Math.round(stack?.offsetHeight || collapse?.offsetHeight || 0);
}

/**
 * Publishes the phone overlay header's stable height as `--phone-overlay-chrome-h`
 * so content can reserve a *constant* top clearance beneath it.
 *
 * Why this exists: `phoneMotion: "overlay"` takes the header out of flow
 * (`.phone-overlay-header` is fixed in browser tabs, absolute in standalone), so
 * without a reserve the first content would sit underneath the chrome at scroll
 * top. The reserve must not change when the header hides — that is the whole
 * point of overlay over collapse. Because it never changes, hiding costs the
 * scroller no layout and content does not shift.
 *
 * The measurement is safe to take in either state: hiding translates the stack
 * (`-translate-y-full`) and `offsetHeight` ignores transforms, so the value is
 * the revealed height whether or not the chrome is currently away. That is why
 * this hook deliberately does *not* read `data-scroll-hidden` — unlike
 * `use-document-chrome-metrics`, which zeroes its anchor offset while hidden
 * because an anchor target must clear only chrome that is actually painting.
 *
 * Publishes `0px` above the phone breakpoint, where the sticky
 * [top bar | search] stack stays in flow and owns its own offsets.
 *
 * On phone, a synchronous layout read is only provisional. Responsive layout
 * can briefly report the wide stack (observed as 200px) before settling to the
 * 72px phone stack 15–60ms later. Keep the server-stable CSS seed until an
 * observer candidate remains unchanged across the evidence-calibrated geometry
 * quiet window; otherwise hydration can publish the transient value and then
 * correct it, creating avoidable CLS. A transient `0` observer measurement
 * likewise keeps the seed or last positive reserve (Production UI #147; same
 * failure class as PR #1562 / #146).
 */
export function usePhoneOverlayChromeReserve(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia(phoneMediaQuery);
    let pendingHeight: number | null = null;
    let quietSinceFrameMs: number | null = null;
    let confirmationFrame: number | null = null;
    let confirmationGeneration = 0;

    const invalidatePendingConfirmation = () => {
      confirmationGeneration += 1;
      pendingHeight = null;
      quietSinceFrameMs = null;
      if (confirmationFrame === null) return;
      window.cancelAnimationFrame(confirmationFrame);
      confirmationFrame = null;
    };

    const scheduleConfirmation = (expectedGeneration: number) => {
      const frameId = window.requestAnimationFrame((frameTimestamp) => {
        if (expectedGeneration !== confirmationGeneration) return;
        if (confirmationFrame === frameId) confirmationFrame = null;
        confirmPendingReserve(frameTimestamp, expectedGeneration);
      });
      confirmationFrame = frameId;
    };

    const stageCandidate = (height: number) => {
      invalidatePendingConfirmation();
      pendingHeight = height;
      scheduleConfirmation(confirmationGeneration);
    };

    function confirmPendingReserve(frameTimestamp: DOMHighResTimeStamp, expectedGeneration: number) {
      if (expectedGeneration !== confirmationGeneration || !media.matches || pendingHeight === null) {
        return;
      }

      const confirmed = readPhoneOverlayChromeReservePx();
      if (confirmed <= 0) {
        invalidatePendingConfirmation();
        return;
      }
      if (confirmed !== pendingHeight) {
        // A frame read can see new geometry before its observer delivery. Give
        // that value a fresh full quiet window rather than inheriting time.
        stageCandidate(confirmed);
        return;
      }

      if (quietSinceFrameMs === null) {
        quietSinceFrameMs = frameTimestamp;
        scheduleConfirmation(expectedGeneration);
        return;
      }
      if (frameTimestamp - quietSinceFrameMs < phoneOverlayReserveGeometryQuietWindowMs) {
        scheduleConfirmation(expectedGeneration);
        return;
      }

      const stableHeight = confirmed;
      invalidatePendingConfirmation();
      root.style.setProperty(reserveProperty, `${stableHeight}px`);
    }

    const syncBreakpoint = () => {
      invalidatePendingConfirmation();
      if (media.matches) {
        // A previous desktop match owns an inline `0px`. Remove it when
        // entering phone layout so the CSS seed remains authoritative until
        // the observer reports the settled phone stack.
        if (root.style.getPropertyValue(reserveProperty) === "0px") {
          root.style.removeProperty(reserveProperty);
        }
        return;
      }
      root.style.setProperty(reserveProperty, "0px");
    };

    const publishObservedReserve = () => {
      if (!media.matches) {
        invalidatePendingConfirmation();
        return;
      }
      const measured = readPhoneOverlayChromeReservePx();
      if (measured <= 0) {
        // Keep the CSS seed (or the last positive inline value) rather than
        // publishing 0px on a one-frame miss during resize / remount.
        invalidatePendingConfirmation();
        return;
      }
      // Observer delivery proves that layout changed, not that it has settled.
      // Every delivery restarts the measured quiet window, while a generation
      // guard makes an already-cancelled callback harmless if it still runs.
      stageCandidate(measured);
    };

    // Do not publish the synchronous layout read. During hydration or a
    // breakpoint transition it can still describe the outgoing wide layout.
    syncBreakpoint();

    // The collapse row grows and shrinks with portaled page navigation
    // (`header-collapse-addon`), so observe size rather than sampling once.
    const observed = document.querySelector<HTMLElement>(collapseSelector);
    const stack = observed?.closest<HTMLElement>(headerStackSelector) ?? observed ?? null;
    const resizeObserver = stack ? new ResizeObserver(publishObservedReserve) : null;
    if (stack && resizeObserver) resizeObserver.observe(stack);

    // Stack geometry changes caused by viewport resize and orientation are
    // deliberately published only through ResizeObserver. The raw window
    // events fire before responsive layout has necessarily settled.
    media.addEventListener("change", syncBreakpoint);

    return () => {
      invalidatePendingConfirmation();
      resizeObserver?.disconnect();
      media.removeEventListener("change", syncBreakpoint);
      root.style.removeProperty(reserveProperty);
    };
  }, []);
}
