"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { CircleAlert, Loader2, Minus, Plus, RefreshCw, RotateCw } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { cn, toolbarButton } from "@/components/ui-primitives";
import { useViewerGestures } from "@/components/document-viewer/use-viewer-gestures";
import { useSignedImageUrl } from "@/components/clinical-dashboard/use-signed-image-url";

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

/**
 * Fullscreen, zoomable viewer for a single private image (diagram / table crop).
 *
 * Built on the shared Sheet (focus trap, Escape, scroll-lock, focus return) and
 * the shared useViewerGestures hook, so wheel/pinch zoom and drag-to-pan match
 * the PDF canvas. Zoom/pan/rotate are pure CSS transforms on the <img>.
 */
export function ImageLightbox({
  open,
  onClose,
  endpoint,
  alt,
  caption,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  alt: string;
  caption?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { url, failed, retry, markFailed } = useSignedImageUrl(endpoint, open);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Reset the view on close so the next open never inherits a prior image's zoom.
  const handleClose = useCallback(() => {
    setScale(1);
    setRotation(0);
    setTranslate({ x: 0, y: 0 });
    onClose();
  }, [onClose]);

  const zoomByFactor = useCallback((factor: number) => {
    setScale((current) => clampScale(current * factor));
    // Reset pan when zooming back to fit. Kept out of the setScale updater (which
    // React may double-invoke) and out of an effect (the repo bans
    // set-state-in-effect); scaleRef mirrors the live scale.
    if (clampScale(scaleRef.current * factor) <= 1) setTranslate({ x: 0, y: 0 });
  }, []);

  const panByDelta = useCallback((dx: number, dy: number) => {
    if (scaleRef.current <= 1) return; // nothing to pan when the image fits
    setTranslate((current) => ({ x: current.x + dx, y: current.y + dy }));
  }, []);

  const { handlers } = useViewerGestures({
    targetRef: stageRef,
    wheelZoom: open,
    wheelNeedsModifier: false,
    pinchZoom: open,
    pan: open,
    touchPan: true,
    onZoomBy: zoomByFactor,
    onPanBy: panByDelta,
  });

  const zoomed = scale > 1;

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={caption?.trim() || alt}
      mobilePlacement="fullscreen"
      mobileSize="viewport"
      portal
      returnFocusRef={returnFocusRef}
      bodyClassName="p-0 sm:p-0"
      testId="image-lightbox"
    >
      <div
        ref={stageRef}
        {...handlers}
        className={cn(
          "relative flex h-full min-h-[62vh] w-full select-none items-center justify-center overflow-hidden bg-[color:var(--surface-inset)] [touch-action:none] lg:min-h-[70vh]",
          zoomed && "cursor-grab active:cursor-grabbing",
        )}
      >
        {url ? (
          <img
            src={url}
            alt={alt}
            draggable={false}
            onError={markFailed}
            className="max-h-full max-w-full object-contain"
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: "center",
            }}
          />
        ) : failed ? (
          <div className="grid place-items-center gap-2 p-6 text-center text-sm font-semibold text-[color:var(--warning)]">
            <CircleAlert aria-hidden="true" className="h-6 w-6" />
            Image could not load.
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--surface)] px-3 text-[color:var(--warning)]"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : (
          <div className="grid place-items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)]">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            Loading image
          </div>
        )}

        {/* Control bar. stopPropagation keeps button taps from starting a pan/pinch on the stage. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-3 z-[1] flex justify-center"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-glass)] p-1 shadow-[var(--shadow-tight)] backdrop-blur-md">
            <button
              type="button"
              onClick={() => zoomByFactor(1 / 1.25)}
              disabled={!url}
              className={toolbarButton}
              aria-label="Zoom out"
            >
              <Minus aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setScale(1);
                setTranslate({ x: 0, y: 0 });
              }}
              disabled={!url}
              className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-md px-2 text-xs font-semibold tabular-nums text-[color:var(--text)] transition hover:bg-[color:var(--surface-subtle)] disabled:opacity-45"
              aria-label="Reset zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={() => zoomByFactor(1.25)}
              disabled={!url}
              className={toolbarButton}
              aria-label="Zoom in"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setRotation((current) => (current + 90) % 360)}
              disabled={!url}
              className={toolbarButton}
              aria-label="Rotate image 90 degrees"
            >
              <RotateCw aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
