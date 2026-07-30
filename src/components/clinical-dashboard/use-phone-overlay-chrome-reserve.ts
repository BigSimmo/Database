"use client";

import { useLayoutEffect } from "react";

import { phoneMediaQuery } from "./use-hide-on-scroll";

const headerStackSelector = ".phone-sticky-header-stack";
const collapseSelector = '[data-testid="universal-header-collapse"]';
const reserveProperty = "--phone-overlay-chrome-h";

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
 */
export function usePhoneOverlayChromeReserve(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia(phoneMediaQuery);

    const sync = () => {
      if (!media.matches) {
        root.style.setProperty(reserveProperty, "0px");
        return;
      }
      const collapse = document.querySelector<HTMLElement>(collapseSelector);
      const stack = collapse?.closest<HTMLElement>(headerStackSelector) ?? null;
      // Fall back to the collapse row alone when the overlay stack is absent
      // (non-overlay hosts), rather than publishing a stale height.
      const measured = stack?.offsetHeight ?? collapse?.offsetHeight ?? 0;
      root.style.setProperty(reserveProperty, `${Math.round(measured)}px`);
    };

    sync();

    // The collapse row grows and shrinks with portaled page navigation
    // (`header-collapse-addon`), so observe size rather than sampling once.
    const observed = document.querySelector<HTMLElement>(collapseSelector);
    const stack = observed?.closest<HTMLElement>(headerStackSelector) ?? observed ?? null;
    const resizeObserver = stack ? new ResizeObserver(sync) : null;
    if (stack && resizeObserver) resizeObserver.observe(stack);

    media.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      resizeObserver?.disconnect();
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      root.style.removeProperty(reserveProperty);
    };
  }, []);
}
