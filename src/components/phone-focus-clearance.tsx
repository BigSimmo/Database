"use client";

import { useEffect } from "react";

import { phoneMediaQuery } from "@/components/clinical-dashboard/use-hide-on-scroll";

function visibleDockTop() {
  const viewportBottom = window.visualViewport?.height ?? window.innerHeight;
  for (const layer of document.querySelectorAll<HTMLElement>(".phone-footer-layer")) {
    const style = getComputedStyle(layer);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
    const top = layer.getBoundingClientRect().top;
    if (top < viewportBottom - 1) return top;
  }
  return null;
}

/**
 * Phone focus targets inside `.phone-scroll-surface` carry a `scroll-margin-block-end` equal to
 * the fixed bottom dock (globals.css), so a Tab stop is revealed above the dock rather than under
 * it. Chromium and WebKit honour that margin when focus scrolls. Firefox skips the focus scroll
 * whenever the control already sits inside the viewport, even when it is inside the margin band,
 * which leaves it partly under the dock. After focus settles, re-reveal a control that a visible
 * dock actually covers: `scrollIntoView` honours scroll-margin in every engine, and the engines that
 * already cleared the dock never reach it.
 */
export function PhoneFocusClearance() {
  useEffect(() => {
    const phone = window.matchMedia(phoneMediaQuery);
    const onFocusIn = (event: FocusEvent) => {
      if (!phone.matches) return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.closest(".phone-scroll-surface")) return;
      window.requestAnimationFrame(() => {
        if (document.activeElement !== target) return;
        // Act only on a dock that is on screen and actually covers the control. Measuring the
        // margin band instead nudged WebKit, which had already revealed the control and let the
        // dock scroll-hide; the nudge scrolled back up and brought the dock over it again.
        const dockTop = visibleDockTop();
        if (dockTop === null) return;
        if (target.getBoundingClientRect().bottom > dockTop + 1) {
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      });
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  return null;
}
