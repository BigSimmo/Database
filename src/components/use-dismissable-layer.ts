"use client";

import { useEffect, type RefObject } from "react";

type DismissableLayerRef = RefObject<HTMLElement | null>;

function eventHitsRef(event: Event, ref: DismissableLayerRef) {
  const element = ref.current;
  if (!element) return false;

  const path = typeof event.composedPath === "function" ? event.composedPath() : null;
  if (path?.includes(element)) return true;

  const target = event.target;
  return target instanceof Node && element.contains(target);
}

/**
 * Restore focus after a dismissable surface closes, but do not steal focus if the
 * user/test already moved it (e.g. opened the app-mode menu in the same frame
 * window as Escape's deferred restore).
 */
export function restoreFocusUnlessMoved(target: HTMLElement | null | undefined) {
  if (!target) return false;
  // Matching global-search-shell's focus=1 guard: an open mode menu means focus
  // was intentionally moved off the prior surface.
  if (document.getElementById("app-mode-menu")) return false;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && active !== target) {
    return false;
  }
  target.focus({ preventScroll: true });
  return true;
}

export function useDismissableLayer({
  enabled,
  refs,
  onDismiss,
  restoreFocusRef,
}: {
  enabled: boolean;
  refs: DismissableLayerRef[];
  onDismiss: (reason: "outside" | "escape") => void;
  restoreFocusRef?: DismissableLayerRef;
}) {
  useEffect(() => {
    if (!enabled) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (refs.some((ref) => eventHitsRef(event, ref))) return;
      onDismiss("outside");
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDismiss("escape");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          restoreFocusUnlessMoved(restoreFocusRef?.current);
        });
      });
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onDismiss, refs, restoreFocusRef]);
}
