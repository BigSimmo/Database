"use client";

import { useStickyChromeMetrics } from "@/components/sticky-chrome-metrics";

const collapseSelector = '[data-testid="universal-header-collapse"]';
const inPageStickyHeaderSelector = "[data-inpage-sticky-header]";
const phoneMediaQuery = "(max-width: 639px)";

/**
 * The information-page binding of `useStickyChromeMetrics`, called by
 * `InPageNavHeader` itself so every converted route gets anchor offsets without
 * per-page wiring.
 *
 * Publishes `--inpage-anchor-offset` on `documentElement` rather than on a page
 * root, for two reasons: there is exactly one information page per route, and on
 * phones `PhoneHeaderCollapsePortal` moves the header out of the page subtree
 * entirely, so no single element contains both the header and the anchors it has
 * to clear. Anchored sections consume it as
 * `scroll-mt-[var(--inpage-anchor-offset,6rem)]`.
 */
export function useInPageChromeMetrics() {
  return useStickyChromeMetrics({
    collapseSelector,
    stickyHeaderSelector: inPageStickyHeaderSelector,
    phoneMediaQuery,
    anchorOffsetProperty: "--inpage-anchor-offset",
    stickyHeaderHeightProperty: "--inpage-sticky-header-height",
    scope: "document",
  });
}
