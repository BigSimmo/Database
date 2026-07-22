"use client";

import { type KeyboardEvent as ReactKeyboardEvent, memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import { cn, floatingControl, toolbarButton } from "@/components/ui-primitives";
import { useViewerGestures } from "@/components/document-viewer/use-viewer-gestures";

const iconButton = toolbarButton;
const secondaryButton = floatingControl;

const MAX_FIT_SCALE = 2.8;
const MAX_ZOOM_SCALE = 4;
const MIN_ZOOM_SCALE = 0.55;
const MAX_RENDER_SCALE = 2.5;
const ZOOM_STEP = 0.15;

const clampZoom = (value: number) => Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, value));

// A signed URL that has passed its (10-min) TTL fails pdf.js with an auth/HTTP
// error rather than a parse error. Detect those so the parent can re-issue a
// fresh URL, without mistaking a genuinely corrupt PDF for an expiry.
function isLikelyExpiredUrl(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { status?: number }).status;
  if (status === 400 || status === 401 || status === 403) return true;
  return (
    error.name === "UnexpectedResponseException" ||
    /\b(400|401|403)\b/.test(error.message) ||
    /unexpected server response|forbidden|expired/i.test(error.message)
  );
}

// Memoised: this is the heaviest subtree in the document view (it holds the
// pdf.js document and re-rasters the canvas). With stable props from the parent
// it skips re-render when unrelated parent state (search, composer, connectivity)
// changes, so a keystroke elsewhere never re-rasterises the page.
export const PdfCanvasViewer = memo(function PdfCanvasViewer({
  url,
  title,
  initialPage,
  onUrlExpired,
  onLoadSuccess,
  onPageChange,
}: {
  url: string;
  title: string;
  initialPage: number;
  /** Called when a load/render fails in a way consistent with an expired signed URL. */
  onUrlExpired?: () => void;
  /** Called when the PDF document loads successfully (a genuine URL is valid). */
  onLoadSuccess?: () => void;
  /** Keeps the document route in sync when the reader changes pages. */
  onPageChange?: (page: number) => void;
}) {
  const fullscreenRootRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.1);
  // Debounced mirror of `zoom`. Zoom steps update `zoom` immediately (an interim
  // CSS transform gives instant visual feedback) but only `renderZoom` drives the
  // pdf.js raster, so rapid +/-, wheel, and pinch input re-rasterise once on
  // settle instead of queueing a RenderTask per delta.
  const [renderZoom, setRenderZoom] = useState(1.1);
  const [rotation, setRotation] = useState(0);
  const [fitWidth, setFitWidth] = useState(true);
  const [holderWidth, setHolderWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);

  const onUrlExpiredRef = useRef(onUrlExpired);
  const onLoadSuccessRef = useRef(onLoadSuccess);
  const urlRef = useRef(url);
  const reportedExpiredUrlRef = useRef<string | null>(null);
  useEffect(() => {
    onUrlExpiredRef.current = onUrlExpired;
  }, [onUrlExpired]);
  useEffect(() => {
    onLoadSuccessRef.current = onLoadSuccess;
  }, [onLoadSuccess]);
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  // Report an expired URL at most once per URL, so a load failure and a
  // subsequent render failure don't both fire a refresh for the same URL.
  const reportUrlExpired = useCallback(() => {
    const current = urlRef.current;
    if (reportedExpiredUrlRef.current === current) return;
    reportedExpiredUrlRef.current = current;
    onUrlExpiredRef.current?.();
  }, []);

  useEffect(() => {
    let active = true;
    let loadTask: PDFDocumentLoadingTask | null = null;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      setPdf(null);
      setTotalPages(0);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        loadTask = pdfjs.getDocument({ url });
        const loadedPdf = await loadTask.promise;
        if (!active) return;
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setPage((current) => Math.min(Math.max(current, 1), loadedPdf?.numPages ?? current));
        // A valid load means any prior expiry was genuinely recovered — let the
        // parent restore the refresh budget so a long session isn't dead-ended.
        onLoadSuccessRef.current?.();
      } catch (loadError) {
        if (active) {
          if (isLikelyExpiredUrl(loadError)) reportUrlExpired();
          setError(loadError instanceof Error ? loadError.message : "Could not load PDF preview.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      active = false;
      setPdf(null);
      void loadTask?.destroy();
    };
  }, [loadAttempt, reportUrlExpired, url]);

  useEffect(() => {
    const nextPage = Math.max(1, initialPage || 1);
    const boundedPage = totalPages > 0 ? Math.min(nextPage, totalPages) : nextPage;
    const frame = window.requestAnimationFrame(() => {
      setPage((current) => (current === boundedPage ? current : boundedPage));
      setPageInput(String(boundedPage));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialPage, totalPages]);

  useEffect(() => {
    if (!holderRef.current) return;
    let timeout: number | undefined;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setHolderWidth(width), 120);
    });

    observer.observe(holderRef.current);
    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    function updateFullscreenState() {
      const active = document.fullscreenElement === fullscreenRootRef.current;
      setIsFullscreen(active);
      if (active) setFullscreenFallback(false);
    }

    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  // Escape exits whichever fullscreen mode is active. Native fullscreen usually
  // exits via the browser, but handling it here too keeps the in-app state in
  // sync (and covers the in-app fallback overlay, which the browser doesn't own).
  useEffect(() => {
    if (!isFullscreen && !fullscreenFallback) return;

    function exitOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setFullscreenFallback(false);
      if (document.fullscreenElement === fullscreenRootRef.current && document.exitFullscreen) {
        void document.exitFullscreen();
      }
    }

    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [isFullscreen, fullscreenFallback]);

  // Settle rapid zoom deltas into a single raster. The interim CSS transform on
  // the canvas keeps the view visually correct during this window.
  useEffect(() => {
    if (renderZoom === zoom) return () => undefined;
    const timeout = window.setTimeout(() => setRenderZoom(zoom), 140);
    return () => window.clearTimeout(timeout);
  }, [renderZoom, zoom]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || !holderRef.current) return;
    const activePdf = pdf;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    async function renderPage() {
      setRendering(true);
      try {
        const pdfPage = await activePdf.getPage(page);
        if (cancelled || !canvasRef.current || !holderRef.current) return;
        // Rotation is applied in the viewport so width/height already reflect the
        // 90°/270° swap — the fit calculation and canvas sizing follow for free.
        const baseViewport = pdfPage.getViewport({ scale: 1, rotation });
        const availableWidth = Math.max(220, holderRef.current.clientWidth - 16);
        const requestedScale = fitWidth
          ? Math.min(MAX_FIT_SCALE, Math.max(MIN_ZOOM_SCALE, availableWidth / baseViewport.width))
          : renderZoom;
        const viewportScale = Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, requestedScale));
        const outputScale = Math.min(MAX_RENDER_SCALE, window.devicePixelRatio || 1);
        const viewport = pdfPage.getViewport({ scale: viewportScale * outputScale, rotation });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) {
          setError("Could not initialize the PDF canvas.");
          return;
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.imageSmoothingEnabled = true;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(baseViewport.width * viewportScale)}px`;
        canvas.style.height = `${Math.floor(baseViewport.height * viewportScale)}px`;
        canvas.style.maxWidth = fitWidth ? "100%" : "none";

        renderTask = pdfPage.render({
          canvasContext: context,
          canvas,
          viewport,
        });
        await renderTask.promise;
      } catch (renderError) {
        if (!cancelled && renderError instanceof Error && renderError.name !== "RenderingCancelledException") {
          if (isLikelyExpiredUrl(renderError)) reportUrlExpired();
          setError(renderError.message);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [fitWidth, holderWidth, page, pdf, renderZoom, reportUrlExpired, rotation]);

  function jumpToPage(nextPage: number) {
    const bounded = Math.min(Math.max(nextPage, 1), totalPages || nextPage);
    setPage(bounded);
    setPageInput(String(bounded));
    if (bounded !== page) onPageChange?.(bounded);
  }

  function zoomBy(delta: number) {
    setFitWidth(false);
    setZoom((current) => Number(clampZoom(current + delta).toFixed(2)));
  }

  async function enterFullscreenFitView() {
    setFitWidth(true);
    const element = fullscreenRootRef.current;
    if (!element) return;

    try {
      if (document.fullscreenElement === element) {
        setIsFullscreen(true);
        return;
      }
      if (element.requestFullscreen) {
        await element.requestFullscreen();
        setIsFullscreen(true);
        return;
      }
    } catch {
      // Fall back to a fixed in-app fullscreen surface when native fullscreen is unavailable.
    }

    setFullscreenFallback(true);
    setIsFullscreen(true);
  }

  async function exitFullscreenView() {
    if (document.fullscreenElement === fullscreenRootRef.current && document.exitFullscreen) {
      await document.exitFullscreen();
    }
    setFullscreenFallback(false);
    setIsFullscreen(false);
  }

  const pagesReady = Boolean(pdf && totalPages > 0 && !loading);
  const fullscreenActive = isFullscreen || fullscreenFallback;
  // While a zoom step waits for its debounced raster, scale the last raster with
  // a CSS transform so the view tracks the target zoom instantly. It resets to 1
  // the moment `renderZoom` catches up and the crisp raster paints. Fit mode is
  // sized by the container, so it never carries an interim scale.
  const interimZoomScale = !fitWidth && renderZoom > 0 && zoom !== renderZoom ? zoom / renderZoom : 1;

  const handleZoomByFactor = useCallback((factor: number) => {
    setFitWidth(false);
    setZoom((current) => Number(clampZoom(current * factor).toFixed(3)));
  }, []);

  const handlePanByDelta = useCallback((dx: number, dy: number) => {
    const holder = holderRef.current;
    if (!holder) return;
    holder.scrollLeft -= dx;
    holder.scrollTop -= dy;
  }, []);

  // Wheel/pinch zoom and drag-to-pan. Pointer gestures (pinch + drag) only take
  // over when zoomed; in fit mode the holder keeps native momentum scrolling.
  const { handlers: gestureHandlers } = useViewerGestures({
    targetRef: holderRef,
    wheelZoom: pagesReady,
    pinchZoom: pagesReady && !fitWidth,
    pan: pagesReady && !fitWidth,
    touchPan: true,
    onZoomBy: handleZoomByFactor,
    onPanBy: handlePanByDelta,
  });

  function handleHolderKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!pagesReady) return;
    // Only act on keystrokes aimed at the holder itself, so Enter/typing inside
    // child controls (retry button, source links) is never hijacked.
    if (event.target !== event.currentTarget) return;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        jumpToPage(page - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        jumpToPage(page + 1);
        break;
      case "+":
      case "=":
        event.preventDefault();
        zoomBy(ZOOM_STEP);
        break;
      case "-":
        event.preventDefault();
        zoomBy(-ZOOM_STEP);
        break;
      case "0":
        event.preventDefault();
        setFitWidth(true);
        break;
      default:
        break;
    }
  }

  return (
    <div
      ref={fullscreenRootRef}
      data-testid="pdf-fullscreen-root"
      className={cn(
        "bg-[color:var(--surface-inset)]",
        fullscreenActive &&
          "fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[color:var(--surface)] supports-[selector(:fullscreen)]:fixed",
      )}
    >
      <div
        data-testid="pdf-toolbar"
        className="z-10 flex flex-nowrap items-center gap-1 border-b border-[color:var(--border-lux)] bg-[linear-gradient(180deg,var(--surface-highlight),transparent_78%),var(--surface-glass)] p-2 shadow-[var(--shadow-tight)] backdrop-blur-xl sm:sticky sm:top-[69px] sm:flex-wrap sm:gap-2 sm:p-3"
      >
        <button
          onClick={() => jumpToPage(page - 1)}
          disabled={!pagesReady || page <= 1}
          className={cn(iconButton, "shrink-0")}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        {pagesReady ? (
          <label className="flex min-h-tap min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-1.5 text-sm font-medium text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] backdrop-blur-md sm:flex-none sm:gap-2 sm:px-3">
            <span className="hidden sm:inline">Page</span>
            <input
              aria-label="PDF page number"
              value={pageInput}
              disabled={!pagesReady}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={() => jumpToPage(Number(pageInput) || page)}
              onKeyDown={(event) => {
                if (event.key === "Enter") jumpToPage(Number(pageInput) || page);
              }}
              inputMode="numeric"
              className="nums h-tap w-full min-w-0 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-center text-sm font-semibold text-[color:var(--text)] outline-none transition focus:border-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-14 sm:flex-none"
            />
            <span className="nums shrink-0 whitespace-nowrap text-sm-minus font-semibold sm:text-sm">
              of {totalPages}
            </span>
          </label>
        ) : (
          <div className="flex min-h-tap min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-glass)] px-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] backdrop-blur-md sm:flex-none sm:px-3">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[color:var(--clinical-accent)]" />
            <span className="hidden sm:inline">{error ? "Page unavailable" : "Loading pages"}</span>
            <span className="sm:hidden">{error ? "Unavailable" : "Loading"}</span>
          </div>
        )}
        <button
          onClick={() => jumpToPage(page + 1)}
          disabled={!pagesReady || page >= totalPages}
          className={cn(iconButton, "shrink-0")}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-1 shadow-[var(--shadow-inset)] sm:ml-auto">
          <button
            onClick={() => zoomBy(-ZOOM_STEP)}
            disabled={!pagesReady}
            className={iconButton}
            aria-label="Zoom out"
          >
            <Minus aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            onClick={enterFullscreenFitView}
            disabled={!pagesReady}
            aria-label="Fit page width and enter fullscreen"
            className={cn(
              "inline-flex min-h-tap min-w-tap items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition",
              "disabled:cursor-not-allowed disabled:opacity-45",
              fitWidth || fullscreenActive
                ? "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
            )}
          >
            <Maximize2 aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Fit</span>
          </button>
          <button onClick={() => zoomBy(ZOOM_STEP)} disabled={!pagesReady} className={iconButton} aria-label="Zoom in">
            <Plus aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRotation((current) => (current + 90) % 360)}
            disabled={!pagesReady}
            className={iconButton}
            aria-label="Rotate page 90 degrees"
          >
            <RotateCw aria-hidden="true" className="h-4 w-4" />
          </button>
          {fullscreenActive ? (
            <button
              onClick={exitFullscreenView}
              className={iconButton}
              aria-label="Exit fullscreen document view"
              type="button"
            >
              <Minimize2 aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          ) : null}
        </div>
      </div>

      <div
        data-testid="pdf-canvas-scroll"
        ref={holderRef}
        tabIndex={0}
        role="group"
        aria-label={`${title} — page view. Use arrow keys to change pages, plus and minus to zoom.`}
        onKeyDown={handleHolderKeyDown}
        {...gestureHandlers}
        className={cn(
          "polished-scroll relative flex w-full min-w-0 max-w-full justify-center overscroll-contain p-2 [-webkit-overflow-scrolling:touch] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)] sm:p-4",
          // Reserve height only before a page has rendered; once it paints, the
          // holder fits the page so short pages don't float in a tall void.
          !pagesReady && !fullscreenActive && "min-h-[46vh] sm:min-h-[62vh]",
          fullscreenActive && "min-h-0 flex-1 sm:min-h-0",
          fitWidth
            ? "overflow-x-hidden overflow-y-auto [touch-action:pan-y]"
            : // Zoomed: we own touch, so pinch-zoom and single-finger drag-pan work.
              "cursor-grab select-none overflow-auto [touch-action:none] active:cursor-grabbing",
        )}
      >
        {(loading || rendering) && (
          <div className="absolute left-3 right-3 top-3 z-[1] flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-tight)] sm:left-4 sm:right-auto sm:top-4">
            <span className="inline-flex min-h-8 items-center gap-2">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[color:var(--clinical-accent)]" />
              {loading ? "Loading PDF" : "Rendering page"}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-tap items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-[color:var(--clinical-accent)]"
            >
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              Source PDF
            </a>
          </div>
        )}
        {error ? (
          <div className="grid min-h-72 place-items-center text-center text-sm text-[color:var(--text-muted)]">
            <div>
              <FileText aria-hidden="true" className="mx-auto mb-2 h-8 w-8" />
              <p>{error}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setLoadAttempt((current) => current + 1)}
                  className={secondaryButton}
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Retry preview
                </button>
                <a href={url} target="_blank" rel="noreferrer" className={secondaryButton}>
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Source PDF
                </a>
              </div>
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            aria-label={`${title} page ${page}`}
            className="mx-auto max-w-full rounded-lg bg-[color:var(--surface)] shadow-[var(--shadow-tight)]"
            style={
              interimZoomScale === 1
                ? undefined
                : { transform: `scale(${interimZoomScale})`, transformOrigin: "top center" }
            }
          />
        )}
      </div>
    </div>
  );
});

function nativePdfEmbedUrl(url: string, initialPage: number) {
  const page = Math.max(1, Math.trunc(initialPage || 1));
  return `${url.split("#")[0]}#page=${page}`;
}

export const NativePdfEmbed = memo(function NativePdfEmbed({
  url,
  title,
  initialPage,
}: {
  url: string;
  title: string;
  initialPage: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-tight)]">
      <iframe
        title={title}
        src={nativePdfEmbedUrl(url, initialPage)}
        className="h-[min(76vh,64rem)] w-full border-0 bg-[color:var(--surface-raised)]"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
