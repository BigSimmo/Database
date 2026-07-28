"use client";

import { useEffect, useState } from "react";
import { ownsVerticalScroll } from "@/components/clinical-dashboard/scroll-surface";

export type ActiveScrollOwner = "pending" | "main" | "document";

export function resolveActiveScrollOwner(element: HTMLElement | null): ActiveScrollOwner {
  if (!element) return "pending";
  return ownsVerticalScroll(element) && element.scrollHeight > element.clientHeight + 1 ? "main" : "document";
}

/**
 * Exposes the current phone scroll owner for deterministic browser diagnostics.
 * Resize/content observers are frame-coalesced so streaming content and the
 * browser/standalone media switch cannot leave a stale debug attribute.
 */
export function useActiveScrollOwner(element: HTMLElement | null, resetKey: unknown): ActiveScrollOwner {
  const [owner, setOwner] = useState<ActiveScrollOwner>("pending");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const next = resolveActiveScrollOwner(element);
        setOwner((current) => (current === next ? current : next));
      });
    };

    if (!element) {
      update();
      return () => {
        if (frame) window.cancelAnimationFrame(frame);
      };
    }

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(update);
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");

    resizeObserver?.observe(element);
    mutationObserver?.observe(element, { childList: true, subtree: true });
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    standaloneQuery.addEventListener?.("change", update);
    update();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      element.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      standaloneQuery.removeEventListener?.("change", update);
    };
  }, [element, resetKey]);

  return owner;
}
