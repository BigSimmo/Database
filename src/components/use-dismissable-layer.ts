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
          restoreFocusRef?.current?.focus({ preventScroll: true });
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
