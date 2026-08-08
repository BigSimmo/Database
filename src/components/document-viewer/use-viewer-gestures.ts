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

/** Double-tap window and slop, matched to the platform conventions users expect. */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 24;

/**
 * Shared pointer/wheel gesture handling for zoomable viewer surfaces.
 *
 * Consumers own the zoom/pan *state* and how it is applied — the PDF canvas
 * pans by adjusting scroll offsets and zooms by re-rastering, while the image
 * lightbox pans/zooms with a CSS transform. This hook only interprets input:
 *
 * - Ctrl/⌘ + wheel (and trackpad pinch, which surfaces as ctrl+wheel) → `onZoomBy`.
 *   The native wheel listener is always non-passive while `wheelZoom` is on so
 *   `preventDefault` can suppress the browser's page zoom (Sentry 15760049). Plain
 *   wheel on modifier-gated surfaces early-returns without `preventDefault`, so
 *   native scrolling still works; the listener stays scoped to the viewer holder
 *   rather than `document` (#214 amended — fully-passive double-zooms).
 * - Two-pointer pinch → `onZoomBy` with the live distance ratio.
 * - One-pointer drag → `onPanBy` with frame deltas.
 * - Two completed taps in quick succession → `onDoubleTap` with the tap point.
 *   A tap is only recorded on pointer-up when that pointer stayed within the
 *   movement slop — otherwise two quick pan strokes would toggle zoom. Opt-in:
 *   a scroll-backed surface (the PDF canvas) has its own fit controls and should
 *   not repurpose a double tap.
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
  onDoubleTap,
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
  /** Two taps within DOUBLE_TAP_MS and DOUBLE_TAP_SLOP_PX of each other. */
  onDoubleTap?: (point: Point) => void;
}) {
  const pointers = useRef(new Map<number, Point>());
  const pinchDistance = useRef(0);
  const panLast = useRef<Point | null>(null);
  const lastTap = useRef<(Point & { at: number }) | null>(null);
  // Pending primary pointer that may become a tap on pointer-up if it never
  // wandered past the slop. Keyed by pointerId so a cancelled/second finger
  // cannot complete someone else's tap.
  const pendingTap = useRef<(Point & { pointerId: number }) | null>(null);
  const [pinching, setPinching] = useState(false);

  // Keep the latest callbacks in refs so the native wheel listener doesn't have
  // to detach/reattach when the consumer re-renders with new closures.
  const onZoomByRef = useRef(onZoomBy);
  const onPanByRef = useRef(onPanBy);
  const onDoubleTapRef = useRef(onDoubleTap);
  useEffect(() => {
    onZoomByRef.current = onZoomBy;
    onPanByRef.current = onPanBy;
    onDoubleTapRef.current = onDoubleTap;
  }, [onZoomBy, onPanBy, onDoubleTap]);

  useEffect(() => {
    const element = targetRef.current;
    if (!element || !wheelZoom) return () => undefined;

    function onWheel(event: WheelEvent) {
      // Modifier-gated surfaces (PDF): plain wheel is native scroll — bail without
      // preventDefault. Ctrl/⌘ + wheel (and trackpad pinch) must cancel the
      // browser zoom or the page zooms on top of the document (double-zoom).
      if (wheelNeedsModifier && !(event.ctrlKey || event.metaKey)) return;
      if (event.cancelable) event.preventDefault();
      // deltaY is negative when zooming in. exp() keeps the step proportional so
      // fast scrolls zoom more without overshooting on a trackpad pinch.
      onZoomByRef.current(Math.exp(-event.deltaY / 300));
    }

    // Non-passive while wheel zoom is enabled: preventDefault is required for
    // Ctrl/⌘ + wheel and trackpad pinch on both lightbox and PDF surfaces.
    // Scoped to this holder element (not document) so the cost stays local.
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [targetRef, wheelZoom, wheelNeedsModifier]);

  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      // Seed a candidate tap before pointer bookkeeping. Completion happens on
      // pointer-up only when this pointer stays inside the slop — that keeps two
      // quick pan strokes from toggling zoom. A real two-finger gesture (size 2)
      // is never a double tap.
      if (onDoubleTapRef.current && pointers.current.size === 0 && event.isPrimary) {
        pendingTap.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
      } else {
        pendingTap.current = null;
      }

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
        pendingTap.current = null;
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

      // A pointer that wanders past the tap slop is a drag, not a tap.
      if (
        pendingTap.current &&
        pendingTap.current.pointerId === event.pointerId &&
        distance(pendingTap.current, { x: event.clientX, y: event.clientY }) >= DOUBLE_TAP_SLOP_PX
      ) {
        pendingTap.current = null;
      }

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
    const isCancel = event.type === "pointercancel";
    const candidate = pendingTap.current;
    const completedTap =
      !isCancel &&
      onDoubleTapRef.current &&
      candidate &&
      candidate.pointerId === event.pointerId &&
      // Still within slop at release (covers the no-move path and small jitter).
      distance(candidate, { x: event.clientX, y: event.clientY }) < DOUBLE_TAP_SLOP_PX
        ? { x: event.clientX, y: event.clientY }
        : null;

    if (candidate?.pointerId === event.pointerId) {
      pendingTap.current = null;
    }

    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinchDistance.current = 0;
      setPinching(false);
    }
    if (pointers.current.size === 0) {
      panLast.current = null;
    }

    if (!completedTap || !onDoubleTapRef.current) return;

    // performance.now() rather than event.timeStamp: both share the time origin
    // and a pointerup handler runs microseconds after the event, so they are
    // equivalent here — but timeStamp is read-only and cannot be driven from a
    // test, which would leave the 300ms window unexercised.
    const now = performance.now();
    const previous = lastTap.current;
    if (previous && now - previous.at < DOUBLE_TAP_MS && distance(previous, completedTap) < DOUBLE_TAP_SLOP_PX) {
      lastTap.current = null;
      onDoubleTapRef.current(completedTap);
    } else {
      lastTap.current = { ...completedTap, at: now };
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
