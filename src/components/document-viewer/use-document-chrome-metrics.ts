"use client";

import { useEffect, useState, type RefObject } from "react";

const collapseSelector = '[data-testid="universal-header-collapse"]';
const documentStickyHeaderSelector = "[data-document-sticky-header]";
const phoneMediaQuery = "(max-width: 639px)";

/**
 * Reads the two things the document viewer needs from the universal header
 * without touching it.
 *
 * `master-search-header` already publishes its hide state as
 * `data-scroll-hidden` on the collapse wrapper, and the wrapper's height is the
 * real anchor offset. Both are observed here so the viewer can react locally —
 * shared chrome stays exactly as it is.
 *
 * - `headerHidden` lets the sticky rail drop its universal-bar offset while the
 *   top bar is away, while still clearing the page-owned sticky document header
 *   on sm+ via `--document-sticky-header-height`.
 * - `--document-anchor-offset` replaces a fixed `scroll-mt`, so a jump taken
 *   while chrome is hidden still lands with the heading below the sticky
 *   document header instead of underneath it.
 */
export function useDocumentChromeMetrics(rootRef: RefObject<HTMLElement | null>) {
  const [headerHidden, setHeaderHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const collapse = window.document.querySelector<HTMLElement>(collapseSelector);
    const root = rootRef.current;
    const isPhone = () => window.matchMedia(phoneMediaQuery).matches;

    const stickyHeader = () => root?.querySelector<HTMLElement>(documentStickyHeaderSelector) ?? null;

    const measureStickyHeader = () => stickyHeader()?.offsetHeight ?? 0;

    const syncOffset = () => {
      if (!root) return;
      const collapseHidden = collapse?.getAttribute("data-scroll-hidden") === "true";
      const collapseHeight = collapse && !collapseHidden ? collapse.offsetHeight : 0;
      // On phones the document header is portaled into the collapse row, so its
      // height is already folded into `collapseHeight` and must not be added
      // again. On sm+ both sticky bands pin at top:0 and overlap while the
      // universal bar is visible; only when that bar hides must the page-owned
      // sticky document header be added so jumps do not land underneath it.
      const stickyHeaderHeight = isPhone() ? 0 : measureStickyHeader();
      const anchorClearance = collapseHeight + (collapseHidden ? stickyHeaderHeight : 0);
      root.style.setProperty("--document-anchor-offset", `${Math.round(anchorClearance) + 16}px`);
      root.style.setProperty("--document-sticky-header-height", `${Math.round(stickyHeaderHeight)}px`);
    };

    const syncHidden = () => {
      setHeaderHidden(collapse?.getAttribute("data-scroll-hidden") === "true");
      syncOffset();
    };

    syncHidden();

    const cleanup: Array<() => void> = [];

    if (collapse) {
      const attributes = new MutationObserver(syncHidden);
      attributes.observe(collapse, { attributes: true, attributeFilter: ["data-scroll-hidden"] });
      cleanup.push(() => attributes.disconnect());

      if (typeof ResizeObserver !== "undefined") {
        const resize = new ResizeObserver(() => window.requestAnimationFrame(syncOffset));
        resize.observe(collapse);
        cleanup.push(() => resize.disconnect());
      }
    }

    const headerEl = stickyHeader();
    if (headerEl && typeof ResizeObserver !== "undefined") {
      const headerResize = new ResizeObserver(() => window.requestAnimationFrame(syncOffset));
      headerResize.observe(headerEl);
      cleanup.push(() => headerResize.disconnect());
    }

    const phoneMedia = window.matchMedia(phoneMediaQuery);
    const onPhoneChange = () => syncOffset();
    phoneMedia.addEventListener("change", onPhoneChange);
    cleanup.push(() => phoneMedia.removeEventListener("change", onPhoneChange));

    return () => cleanup.forEach((dispose) => dispose());
  }, [rootRef]);

  return { headerHidden };
}
