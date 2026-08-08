"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

import { cn, floatingControl } from "@/components/ui-primitives";
import { resolveCanvasRasterPlan } from "@/components/document-viewer/canvas-raster-budget";
import { announce } from "@/components/ui/live-announcer";
import { useViewerGestures } from "@/components/document-viewer/use-viewer-gestures";
import {
  resolveViewerZoomUpdate,
  VIEWER_DEFAULT_ZOOM,
  VIEWER_MAX_ZOOM,
  VIEWER_MIN_ZOOM,
  VIEWER_ZOOM_STEP,
} from "@/components/document-viewer/viewer-zoom";

const secondaryButton = floatingControl;

const MAX_FIT_SCALE = 2.8;

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
//
// This component renders source pixels and nothing else. Every viewing control —
// page navigation, zoom, fit, rotation, viewing aid, fullscreen — belongs to
// DocumentFrame, so the viewer has exactly one toolbar and one page readout.
export const PdfCanvasViewer = memo(function PdfCanvasViewer({
  url,
  title,
  initialPage,
  onUrlExpired,
  onLoadSuccess,
  onPageChange,
  fitWidth,
  zoom,
  rotation = 0,
  fullscreen = false,
  onFitWidthChange,
  onZoomChange,
}: {
  url: string;
  title: string;
  initialPage: number;
  /** Called when a load/render fails in a way consistent with an expired signed URL. */
  onUrlExpired?: () => void;
  /** Called with the document's page count when pdf.js opens it successfully. */
  onLoadSuccess?: (pageCount: number) => void;
  /** Keeps the document route in sync when the reader changes pages. */
  onPageChange?: (page: number) => void;
  /** Controlled viewing state owned by DocumentFrame via DocumentViewer. */
  fitWidth: boolean;
  zoom: number;
  rotation?: number;
  fullscreen?: boolean;
  onFitWidthChange: (fitWidth: boolean) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  // Debounced mirror of `zoom`. Zoom steps update `zoom` immediately (an interim
  // CSS transform gives instant visual feedback) but only `renderZoom` drives the
  // pdf.js raster, so rapid +/-, wheel, and pinch input re-rasterise once on
  // settle instead of queueing a RenderTask per delta.
  const [renderZoom, setRenderZoom] = useState(VIEWER_DEFAULT_ZOOM);
  // Eager refs so rapid functional updates (wheel/pinch) compose before React
  // re-renders — the zoom lives in a parent, so a closed-over prop would drop
  // every delta but the last (Sentry 15778840).
  const fitWidthRef = useRef(fitWidth);
  const zoomRef = useRef(zoom);
  useLayoutEffect(() => {
    fitWidthRef.current = fitWidth;
    zoomRef.current = zoom;
  }, [fitWidth, zoom]);
  const setFitWidth = useCallback(
    (next: boolean) => {
      fitWidthRef.current = next;
      onFitWidthChange(next);
    },
    [onFitWidthChange],
  );
  const setZoom = useCallback(
    (next: number | ((current: number) => number)) => {
      const clamped = resolveViewerZoomUpdate(zoomRef.current, next);
      zoomRef.current = clamped;
      onZoomChange(clamped);
    },
    [onZoomChange],
  );
  const [holderWidth, setHolderWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const onUrlExpiredRef = useRef(onUrlExpired);
  const onLoadSuccessRef = useRef(onLoadSuccess);
  const onPageChangeRef = useRef(onPageChange);
  const urlRef = useRef(url);
  const reportedExpiredUrlRef = useRef<string | null>(null);
  useEffect(() => {
    onUrlExpiredRef.current = onUrlExpired;
  }, [onUrlExpired]);
  useEffect(() => {
    onLoadSuccessRef.current = onLoadSuccess;
  }, [onLoadSuccess]);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  // Announce canvas-level failures that happen while DocumentFrame is already
  // "ready" (signed URL issued) — otherwise a post-load render failure is silent
  // for screen-reader users (#219).
  useEffect(() => {
    if (!error) return;
    announce(error, {
      priority: "assertive",
      eventId: `pdf-canvas-preview:${url}:${error}`,
    });
  }, [error, url]);

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
        // Range-fetch on demand instead of pulling the whole file down. pdf.js
        // otherwise keeps fetching the rest of the document in the background
        // even when the reader only ever looks at one page — the wrong default
        // for a long guideline opened on a phone, on cellular. `disableAutoFetch`
        // does not take effect without `disableStream`; the installed types say
        // so explicitly.
        //
        // The trade is that later bytes are requested later, so a signed URL can
        // expire mid-read. That path already exists and recovers: a range failure
        // is an auth/HTTP error, `isLikelyExpiredUrl` catches it, and the parent
        // re-issues the URL. Its refresh budget resets on every successful load,
        // so a long reading session is not capped at two recoveries.
        loadTask = pdfjs.getDocument({ url, disableAutoFetch: true, disableStream: true });
        const loadedPdf = await loadTask.promise;
        if (!active) return;
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setPage((current) => Math.min(Math.max(current, 1), loadedPdf?.numPages ?? current));
        // A valid load means any prior expiry was genuinely recovered — let the
        // parent restore the refresh budget so a long session isn't dead-ended.
        onLoadSuccessRef.current?.(loadedPdf.numPages);
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
      // pdf.js is authoritative for page count. A deep link or stale indexed
      // page_count can leave the frame toolbar on an out-of-range route value
      // while the canvas shows the clamped page — reconcile the parent route.
      if (totalPages > 0 && boundedPage !== nextPage) {
        onPageChangeRef.current?.(boundedPage);
      }
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
    // Local to this effect run so a rapid page change cannot clean up the next
    // page via a shared ref (Sentry 15801413).
    let pageToCleanup: PDFPageProxy | null = null;

    async function renderPage() {
      setRendering(true);
      try {
        const pdfPage = await activePdf.getPage(page);
        if (cancelled) {
          // getPage resolved after we left this page — release it here so the
          // next effect's page is never touched by this run's cleanup.
          pdfPage.cleanup();
          return;
        }
        pageToCleanup = pdfPage;
        if (!canvasRef.current || !holderRef.current) return;
        // Rotation is applied in the viewport so width/height already reflect the
        // 90°/270° swap — the fit calculation and canvas sizing follow for free.
        const baseViewport = pdfPage.getViewport({ scale: 1, rotation });
        const availableWidth = Math.max(220, holderRef.current.clientWidth - 16);
        const requestedScale = fitWidth
          ? Math.min(MAX_FIT_SCALE, Math.max(VIEWER_MIN_ZOOM, availableWidth / baseViewport.width))
          : renderZoom;
        const viewportScale = Math.min(VIEWER_MAX_ZOOM, Math.max(VIEWER_MIN_ZOOM, requestedScale));
        // WebKit paints nothing at all above ~2^24 canvas pixels, and this page
        // at full device density can ask for three times that. Give up raster
        // density before layout size — a soft page reads, a blank one does not.
        const { outputScale } = resolveCanvasRasterPlan({
          baseWidth: baseViewport.width,
          baseHeight: baseViewport.height,
          viewportScale,
          devicePixelRatio: window.devicePixelRatio,
        });
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
      // Release this run's page only. pdf.js declines while a render is still
      // live, so cancel above cannot be cut short by cleanup.
      pageToCleanup?.cleanup();
    };
  }, [fitWidth, holderWidth, page, pdf, renderZoom, reportUrlExpired, rotation]);

  // A canvas keeps its backing store until the element is collected, which on a
  // phone is memory held for a document the reader has already left. Zeroing the
  // dimensions releases it at unmount instead.
  useEffect(
    () => () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = 0;
      canvas.height = 0;
    },
    [],
  );

  const jumpToPage = useCallback(
    (nextPage: number) => {
      const bounded = Math.min(Math.max(nextPage, 1), totalPages || nextPage);
      if (bounded === page) return;
      setPage(bounded);
      onPageChange?.(bounded);
    },
    [onPageChange, page, totalPages],
  );

  const zoomBy = useCallback(
    (delta: number) => {
      setFitWidth(false);
      setZoom((current) => Number((current + delta).toFixed(2)));
    },
    [setFitWidth, setZoom],
  );

  const pagesReady = Boolean(pdf && totalPages > 0 && !loading);
  // While a zoom step waits for its debounced raster, scale the last raster with
  // a CSS transform so the view tracks the target zoom instantly. It resets to 1
  // the moment `renderZoom` catches up and the crisp raster paints. Fit mode is
  // sized by the container, so it never carries an interim scale.
  const interimZoomScale = !fitWidth && renderZoom > 0 && zoom !== renderZoom ? zoom / renderZoom : 1;

  const handleZoomByFactor = useCallback(
    (factor: number) => {
      setFitWidth(false);
      setZoom((current) => Number((current * factor).toFixed(3)));
    },
    [setFitWidth, setZoom],
  );

  const handlePanByDelta = useCallback((dx: number, dy: number) => {
    const holder = holderRef.current;
    if (!holder) return;
    holder.scrollLeft -= dx;
    holder.scrollTop -= dy;
  }, []);

  // Pinch is live in fit mode too, which is the viewer's default state. It used
  // to be gated on `!fitWidth`, so a two-finger pinch on a freshly opened
  // document did nothing at all: the holder's `touch-action: pan-y` suppressed
  // the browser's own pinch-zoom, and this hook declined to handle it. That left
  // no way to magnify a page by gesture without first finding a zoom button, and
  // it contradicted the blocking phone clause in docs/design-system/COMPONENTS.md.
  //
  // The first pinch delta drops fit mode (see `handleZoomByFactor`), which
  // switches the holder to `touch-action: none` — so the browser can only
  // contend for the opening moment of the gesture, never the rest of it.
  //
  // Drag-to-pan stays gated on `!fitWidth`: in fit mode the holder is a scroll
  // container and must keep native momentum scrolling.
  const { handlers: gestureHandlers } = useViewerGestures({
    targetRef: holderRef,
    wheelZoom: pagesReady,
    pinchZoom: pagesReady,
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
        zoomBy(VIEWER_ZOOM_STEP);
        break;
      case "-":
        event.preventDefault();
        zoomBy(-VIEWER_ZOOM_STEP);
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
      data-testid="pdf-canvas-owner"
      className={cn("bg-[color:var(--surface-inset)]", fullscreen && "flex min-h-0 flex-1 flex-col")}
    >
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
          !pagesReady && !fullscreen && "min-h-[46vh] sm:min-h-[62vh]",
          fullscreen && "min-h-0 flex-1 sm:min-h-0",
          fitWidth
            ? "overflow-x-hidden overflow-y-auto [touch-action:pan-y]"
            : // Zoomed: we own touch, so pinch-zoom and single-finger drag-pan work.
              "cursor-grab select-none overflow-auto [touch-action:none] active:cursor-grabbing",
        )}
      >
        {(loading || rendering) && (
          <div className="absolute left-3 right-3 top-3 z-10 flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-tight)] sm:left-4 sm:right-auto sm:top-4">
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
          <div
            data-preview-error="true"
            className="grid min-h-72 place-items-center text-center text-sm text-[color:var(--text-muted)]"
          >
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
