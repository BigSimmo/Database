"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

type Point = { x: number; y: number };

/**
 * Shared pointer/wheel gesture handling for zoomable viewer surfaces.
 *
 * Consumers own the zoom/pan *state* and how it is applied — the PDF canvas
 * pans by adjusting scroll offsets and zooms by re-rastering, while the image
 * lightbox pans/zooms with a CSS transform. This hook only interprets input:
 *
 * - Ctrl/⌘ + wheel (and trackpad pinch, which surfaces as ctrl+wheel) → `onZoomBy`.
 *   When a modifier is required (PDF), the default listener is **passive** so
 *   plain scrolling stays on the compositor (#214). A non-passive listener is
 *   attached only while unmodified wheel-zoom is active (lightbox) or while a
 *   modifier/pinch zoom gesture is in progress, so `preventDefault` can stop
 *   browser page-zoom without blocking ordinary scroll INP.
 * - Two-pointer pinch → `onZoomBy` with the live distance ratio.
 * - One-pointer drag → `onPanBy` with frame deltas.
 *
 * Touch panning is opt-in (`touchPan`) because a scroll-backed surface (the PDF
 * canvas in fit mode) wants native momentum scrolling instead.
 */
export function useViewerGestures({
  targetRef,
  wheelZoom = true,
  wheelNeedsModifier = true,
  pinchZoom = true,
  pan = true,
  touchPan = false,
  onZoomBy,
  onPanBy,
}: {
  targetRef: RefObject<HTMLElement | null>;
  wheelZoom?: boolean;
  /** When true (default) only Ctrl/⌘ + wheel zooms; a scroll-backed surface keeps
   *  plain wheel for native scrolling. A lightbox sets this false to zoom on any wheel. */
  wheelNeedsModifier?: boolean;
  pinchZoom?: boolean;
  pan?: boolean;
  touchPan?: boolean;
  onZoomBy: (factor: number) => void;
  onPanBy?: (dx: number, dy: number) => void;
}) {
  const pointers = useRef(new Map<number, Point>());
  const pinchDistance = useRef(0);
  const panLast = useRef<Point | null>(null);
  const [pinching, setPinching] = useState(false);

  // Keep the latest callbacks in refs so the native wheel listener doesn't have
  // to detach/reattach when the consumer re-renders with new closures.
  const onZoomByRef = useRef(onZoomBy);
  const onPanByRef = useRef(onPanBy);
  useEffect(() => {
    onZoomByRef.current = onZoomBy;
    onPanByRef.current = onPanBy;
  }, [onZoomBy, onPanBy]);

  useEffect(() => {
    const element = targetRef.current;
    if (!element || !wheelZoom) return () => undefined;

    const zoomFromWheel = (event: WheelEvent) => {
      // deltaY is negative when zooming in. exp() keeps the step proportional so
      // fast scrolls zoom more without overshooting on a trackpad pinch.
      onZoomByRef.current(Math.exp(-event.deltaY / 300));
    };

    // Lightbox / unmodified wheel-zoom: every wheel must preventDefault so the
    // page underneath does not scroll while the image zooms.
    if (!wheelNeedsModifier) {
      function onWheel(event: WheelEvent) {
        event.preventDefault();
        zoomFromWheel(event);
      }
      element.addEventListener("wheel", onWheel, { passive: false });
      return () => element.removeEventListener("wheel", onWheel);
    }

    // PDF / modifier-required: keep compositor scroll (passive) by default.
    // Promote to non-passive only while Ctrl/⌘ is held or a trackpad pinch
    // (ctrlKey wheel without a prior keydown) is in flight.
    let blockingHandler: ((event: WheelEvent) => void) | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const clearIdle = () => {
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const detachBlocking = () => {
      clearIdle();
      if (!blockingHandler) return;
      element.removeEventListener("wheel", blockingHandler);
      blockingHandler = null;
    };

    const scheduleDetach = (delayMs: number) => {
      clearIdle();
      idleTimer = setTimeout(detachBlocking, delayMs);
    };

    const attachBlocking = () => {
      if (blockingHandler) return;
      blockingHandler = (event: WheelEvent) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        zoomFromWheel(event);
        // Drop the blocking listener shortly after the last pinch/ctrl tick so
        // plain scroll returns to the passive compositor path.
        scheduleDetach(180);
      };
      element.addEventListener("wheel", blockingHandler, { passive: false });
    };

    function onWheelPassive(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      // When the blocking listener is already attached it owns zoom + preventDefault.
      // Newly added listeners do not receive the current event, so the first
      // trackpad-pinch tick zooms here and promotes for the rest of the gesture.
      if (blockingHandler) return;
      attachBlocking();
      zoomFromWheel(event);
      scheduleDetach(180);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Control" || event.key === "Meta") attachBlocking();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key === "Control" || event.key === "Meta") {
        // Brief delay so a wheel that arrives with the keyup can still preventDefault.
        scheduleDetach(50);
      }
    }

    function onBlur() {
      detachBlocking();
    }

    element.addEventListener("wheel", onWheelPassive, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      element.removeEventListener("wheel", onWheelPassive);
      detachBlocking();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [targetRef, wheelZoom, wheelNeedsModifier]);

  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try {
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      } catch {
        // setPointerCapture can throw if the pointer is already released; ignore.
      }

      if (pinchZoom && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinchDistance.current = distance(a, b);
        panLast.current = null;
        setPinching(true);
        return;
      }

      if (pan && pointers.current.size === 1 && event.isPrimary) {
        if (touchPan || event.pointerType !== "touch") {
          panLast.current = { x: event.clientX, y: event.clientY };
        }
      }
    },
    [pan, pinchZoom, touchPan],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pinchZoom && pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        const next = distance(a, b);
        if (pinchDistance.current > 0 && next > 0) {
          const factor = next / pinchDistance.current;
          if (Math.abs(factor - 1) > 0.01) {
            onZoomByRef.current(factor);
            pinchDistance.current = next;
          }
        }
        return;
      }

      if (panLast.current && onPanByRef.current) {
        const dx = event.clientX - panLast.current.x;
        const dy = event.clientY - panLast.current.y;
        panLast.current = { x: event.clientX, y: event.clientY };
        if (dx !== 0 || dy !== 0) onPanByRef.current(dx, dy);
      }
    },
    [pinchZoom],
  );

  const endPointer = useCallback((event: ReactPointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinchDistance.current = 0;
      setPinching(false);
    }
    if (pointers.current.size === 0) {
      panLast.current = null;
    }
  }, []);

  return {
    /** True while a two-pointer pinch is in progress (e.g. to suppress transitions). */
    pinching,
    /** Spread onto the gesture target element. */
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    },
  };
}
