"use client";

import { useEffect, useState, type RefObject } from "react";

const collapseSelector = '[data-testid="universal-header-collapse"]';

/**
 * Reads the two things the document viewer needs from the universal header
 * without touching it.
 *
 * `master-search-header` already publishes its hide state as
 * `data-scroll-hidden` on the collapse wrapper, and the wrapper's height is the
 * real anchor offset. Both are observed here so the viewer can react locally —
 * shared chrome stays exactly as it is.
 *
 * - `headerHidden` lets the sticky rail drop its offset to 0 while the top bar
 *   is away, instead of leaving a dead band the height of the hidden bar.
 * - `--document-anchor-offset` replaces a fixed `scroll-mt`, so a jump taken
 *   while chrome is hidden still lands with the heading at the top.
 */
export function useDocumentChromeMetrics(rootRef: RefObject<HTMLElement | null>) {
  const [headerHidden, setHeaderHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const collapse = window.document.querySelector<HTMLElement>(collapseSelector);
    const root = rootRef.current;

    const syncOffset = () => {
      if (!root) return;
      // No collapse row (wide layouts, or the shell absent) means no chrome to
      // clear beyond the section's own breathing room.
      const height = collapse && collapse.getAttribute("data-scroll-hidden") !== "true" ? collapse.offsetHeight : 0;
      root.style.setProperty("--document-anchor-offset", `${Math.round(height) + 16}px`);
    };

    const syncHidden = () => {
      setHeaderHidden(collapse?.getAttribute("data-scroll-hidden") === "true");
      syncOffset();
    };

    syncHidden();

    if (!collapse) return;

    const attributes = new MutationObserver(syncHidden);
    attributes.observe(collapse, { attributes: true, attributeFilter: ["data-scroll-hidden"] });

    const resize =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => window.requestAnimationFrame(syncOffset));
    resize?.observe(collapse);

    return () => {
      attributes.disconnect();
      resize?.disconnect();
    };
  }, [rootRef]);

  return { headerHidden };
}
