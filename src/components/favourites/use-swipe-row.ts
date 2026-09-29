"use client";

import { useRef, useState, type MouseEvent, type PointerEvent } from "react";

/**
 * Swipe a list row left to reveal its quick actions, iOS style. Pointer events
 * cover touch, pen and mouse, so the gesture also works with a trackpad drag.
 *
 * A swipe is never the only way to reach an action: every revealed button is
 * also in the row's actions sheet. This hook only moves the row.
 *
 * - The row claims the gesture only once horizontal intent is clear (8px and
 *   more horizontal than vertical), so vertical scrolling is never stolen.
 * - `touch-action: pan-y` on the row lets the browser keep vertical panning.
 * - A click that ends a drag, or any tap on an open row, is swallowed so the
 *   gesture cannot also navigate.
 */
export function useSwipeRow({
  enabled,
  open,
  onOpenChange,
  revealWidth,
}: {
  enabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Width of the revealed action tray in px. */
  revealWidth: number;
}) {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const gesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    base: number;
    claimed: boolean;
  } | null>(null);
  const swallowNextClick = useRef(false);

  const restingOffset = open ? -revealWidth : 0;
  const offset = dragOffset ?? restingOffset;

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    swallowNextClick.current = false;
    if (!enabled || event.button > 0 || !event.isPrimary) return;
    if ((event.target as HTMLElement).closest("[data-no-swipe]")) return;
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      base: restingOffset,
      claimed: false,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.claimed) {
      if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      if (Math.abs(dx) <= 8 || Math.abs(dx) <= Math.abs(dy)) return;
      current.claimed = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture is an enhancement; the gesture still works without it.
      }
    }
    let next = Math.min(0, current.base + dx);
    // Past the tray the row resists, so it cannot be flung off the screen.
    if (next < -revealWidth) next = -revealWidth + (next + revealWidth) * 0.3;
    setDragOffset(next);
  }

  function finish(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    gesture.current = null;
    if (!current || current.pointerId !== event.pointerId || !current.claimed) return;
    // Only a pointerup is followed by a click. A cancelled gesture has none, so
    // it must not leave a flag that eats the next real tap.
    if (event.type === "pointerup") {
      swallowNextClick.current = true;
      window.setTimeout(() => {
        swallowNextClick.current = false;
      }, 0);
    }
    const shouldOpen = (dragOffset ?? restingOffset) < -revealWidth * 0.4;
    setDragOffset(null);
    if (shouldOpen !== open) onOpenChange(shouldOpen);
  }

  function onClickCapture(event: MouseEvent<HTMLElement>) {
    if (swallowNextClick.current) {
      swallowNextClick.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (open && !(event.target as HTMLElement).closest("[data-no-swipe]")) {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    }
  }

  return {
    offset,
    dragging: dragOffset !== null,
    rowHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onClickCapture,
    },
  };
}
