"use client";

import { type RefObject } from "react";

import { useStickyChromeMetrics } from "@/components/sticky-chrome-metrics";

const collapseSelector = '[data-testid="universal-header-collapse"]';
const documentStickyHeaderSelector = "[data-document-sticky-header]";
const phoneMediaQuery = "(max-width: 639px)";

/**
 * Reads the two things the document viewer needs from the universal header
 * without touching it.
 *
 * The measurement itself lives in `useStickyChromeMetrics`, shared with the
 * information pages. This module stays the document viewer's binding of it: the
 * selectors and custom-property names below are contract-pinned by
 * `tests/header-scroll-hide-contract.test.ts` and must not move.
 *
 * - `headerHidden` lets the sticky rail drop its universal-bar offset while the
 *   top bar is away, while still clearing the page-owned sticky document header
 *   on sm+ via `--document-sticky-header-height`.
 * - `--document-anchor-offset` replaces a fixed `scroll-mt`, so a jump taken
 *   while chrome is hidden still lands with the heading below the sticky
 *   document header instead of underneath it.
 * - `--document-collapse-height` is the live height of the universal collapse
 *   row, for page-owned sticky chrome that needs to clear it.
 */
export function useDocumentChromeMetrics(rootRef: RefObject<HTMLElement | null>) {
  return useStickyChromeMetrics({
    collapseSelector,
    stickyHeaderSelector: documentStickyHeaderSelector,
    phoneMediaQuery,
    anchorOffsetProperty: "--document-anchor-offset",
    stickyHeaderHeightProperty: "--document-sticky-header-height",
    collapseHeightProperty: "--document-collapse-height",
    scope: rootRef,
  });
}
