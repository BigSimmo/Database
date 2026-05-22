"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  FileImage,
  FileText,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Quote,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import {
  extractionQualityLabel,
  formatClinicalDate,
  normalizeSourceMetadata,
  sourceStatusLabel,
  validationStatusLabel,
} from "@/lib/source-metadata";
import { useAuthSession } from "@/lib/supabase/client";
import type { ClinicalDocument, RagAnswer } from "@/lib/types";

type PageRow = {
  id: string;
  page_number: number;
  text: string;
  ocr_used: boolean;
};

type ImageRow = {
  id: string;
  page_number: number | null;
  caption: string;
};

type ChunkRow = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  content: string;
  image_ids: string[];
};

const textMuted = "text-[color:var(--text-muted)]";
const panel = "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-tight)]";
const panelSubtle = "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)]";
const iconButton =
  "grid h-[44px] w-[44px] shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:shadow-[var(--shadow-tight)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:shadow-none";
const primaryButton =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-contrast)] transition hover:bg-[color:var(--primary-strong)] hover:shadow-[var(--shadow-tight)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:shadow-none";
const secondaryButton =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:shadow-[var(--shadow-tight)]";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function PanelHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-[color:var(--text)]">{title}</h2>
        {description && <p className={cn("mt-1 text-sm leading-6", textMuted)}>{description}</p>}
      </div>
    </div>
  );
}

function SourceStatusBadge({ metadata }: { metadata?: unknown }) {
  const source = normalizeSourceMetadata(metadata);
  const className =
    source.document_status === "current"
      ? "border-[color:var(--success)]/30 bg-[color:var(--success-soft)] text-[color:var(--success)]"
      : source.document_status === "outdated"
        ? "border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
        : source.document_status === "review_due"
          ? "border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
          : "border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)]/45 text-[color:var(--warning)]";

  return (
    <span className={cn("inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold", className)}>
      {sourceStatusLabel(source)}
    </span>
  );
}

function SourceMetadataSummary({ metadata }: { metadata?: unknown }) {
  const source = normalizeSourceMetadata(metadata);
  const items = [
    validationStatusLabel(source),
    `Review ${formatClinicalDate(source.review_date)}`,
    source.jurisdiction ?? "Jurisdiction unknown",
    extractionQualityLabel(source),
  ];

  return (
    <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
      <SourceStatusBadge metadata={source} />
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[color:var(--text-muted)]">
        {items.map((item, index) => (
          <span key={`${item}:${index}`} className="inline-flex items-center gap-2">
            {index > 0 && <span className="h-1 w-1 rounded-full bg-[color:var(--border-strong)]" aria-hidden />}
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function DocumentImage({ image }: { image: ImageRow }) {
  const endpoint = `/api/images/${image.id}/signed-url`;
  const [url, setUrl] = useState(() => getCachedSignedUrl(endpoint)?.url ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { authorizationHeader, markSessionExpired } = useAuthSession();

  useEffect(() => {
    const cached = getCachedSignedUrl(endpoint);
    if (cached) return () => undefined;

    let active = true;
    fetch(endpoint, { headers: authorizationHeader })
      .then((response) => {
        if (response.status === 401) markSessionExpired();
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        if (active && data?.url) {
          setCachedSignedUrl(endpoint, data);
          setUrl(data.url);
          setFailed(false);
        } else if (active) {
          setFailed(true);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, authorizationHeader, endpoint, markSessionExpired]);

  function retryImage() {
    clearCachedSignedUrl(endpoint);
    setUrl(null);
    setFailed(false);
    setAttempt((current) => current + 1);
  }

  function handleImageError() {
    clearCachedSignedUrl(endpoint);
    setFailed(true);
  }

  return (
    <figure className={cn(panelSubtle, "overflow-hidden p-3")}>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.08em]", textMuted)}>
        page {image.page_number ?? "n/a"}
      </p>
      <div className="mt-2 rounded-lg bg-[color:var(--surface-inset)] p-3">
        {failed ? (
          <div className="grid h-32 place-items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] p-3 text-center text-xs font-semibold text-[color:var(--warning)]">
            <div>
              <AlertCircle className="mx-auto mb-2 h-4 w-4" />
              Image preview failed.
              <button
                type="button"
                onClick={retryImage}
                className="mt-2 inline-flex min-h-[44px] items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--surface)] px-3"
              >
                Retry
              </button>
            </div>
          </div>
        ) : url ? (
          <img
            src={url}
            alt={image.caption}
            loading="lazy"
            decoding="async"
            onError={handleImageError}
            className="max-h-52 w-full rounded-lg object-contain"
          />
        ) : (
          <div className="grid h-32 place-items-center rounded-lg text-xs font-semibold text-[color:var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading image
          </div>
        )}
      </div>
      <figcaption className="mt-3 text-[15px] leading-6 text-[color:var(--text)]">{image.caption}</figcaption>
    </figure>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="mt-3 grid min-h-28 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-4 text-center text-sm font-semibold text-[color:var(--text-muted)]">
      <div>
        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin text-[color:var(--primary)]" />
        {label}
      </div>
    </div>
  );
}

function PinnedSourceEvidence({ loading, chunk }: { loading: boolean; chunk: ChunkRow | undefined }) {
  return (
    <section
      data-testid="pinned-source-evidence"
      className="rounded-lg border border-[color:var(--primary)]/25 border-l-4 border-l-[color:var(--primary)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-tight)]"
    >
      <PanelHeading icon={Quote} title="Pinned source evidence" />
      {loading ? (
        <LoadingPanel label="Loading pinned source evidence" />
      ) : chunk ? (
        <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-[15px] leading-6 text-[color:var(--text-muted)]">
          {chunk.section_heading && (
            <p className="mb-2 font-semibold text-[color:var(--text)]">{chunk.section_heading}</p>
          )}
          <p className="whitespace-pre-wrap">{chunk.content}</p>
        </div>
      ) : (
        <p className="mt-3 text-[15px] leading-6 text-[color:var(--primary)]">
          Open a citation from an answer to see the exact indexed passage.
        </p>
      )}
    </section>
  );
}

function IndexedTextPanel({
  loading,
  selectedPage,
  chunks,
  search,
  onSearchChange,
}: {
  loading: boolean;
  selectedPage: PageRow | undefined;
  chunks: ChunkRow[];
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const normalizedSearch = search.trim().toLowerCase();
  const visibleChunks = normalizedSearch
    ? chunks.filter((chunk) =>
        `${chunk.section_heading ?? ""} ${chunk.content}`.toLowerCase().includes(normalizedSearch),
      )
    : chunks.slice(0, 8);

  return (
    <section className={cn(panel, "p-5 source-print")}>
      <PanelHeading
        icon={FileText}
        title="Indexed source text"
        description={
          loading
            ? "Loading extracted source text."
            : `Extracted text for page ${selectedPage?.page_number ?? "n/a"} with searchable source passages.`
        }
      />
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
          Search within indexed source text
        </span>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Find a term, warning, or monitoring item"
          className="h-[44px] w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--text)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-teal-300/20"
        />
      </label>
      {loading ? (
        <LoadingPanel label="Loading indexed source text" />
      ) : selectedPage ? (
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-[color:var(--text-muted)]">
          {selectedPage.text}
        </p>
      ) : (
        <p className={cn("mt-4 text-[15px]", textMuted)}>No extracted text has been indexed for this page yet.</p>
      )}
      <div className="mt-4 border-t border-[color:var(--border)] pt-4">
        <p className="text-sm font-semibold text-[color:var(--text)]">Source passages</p>
        <div className="mt-3 grid gap-3">
          {visibleChunks.length === 0 ? (
            <p className={cn("text-[15px] leading-6", textMuted)}>No indexed passage matched that search.</p>
          ) : (
            visibleChunks.map((chunk) => (
              <article
                id={`chunk-${chunk.id}`}
                key={chunk.id}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Page {chunk.page_number ?? "n/a"} · chunk {chunk.chunk_index}
                </p>
                {chunk.section_heading && (
                  <p className="mt-1 text-sm font-semibold text-[color:var(--text)]">{chunk.section_heading}</p>
                )}
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6 text-[color:var(--text-muted)]">
                  {chunk.content}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function PdfCanvasViewer({ url, title, initialPage }: { url: string; title: string; initialPage: number }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.1);
  const [fitWidth, setFitWidth] = useState(true);
  const [holderWidth, setHolderWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let loadedPdf: PDFDocumentProxy | null = null;

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
        const task = pdfjs.getDocument(url);
        loadedPdf = await task.promise;
        if (!active) return;
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setPage((current) => Math.min(Math.max(current, 1), loadedPdf?.numPages ?? current));
      } catch (loadError) {
        if (active) {
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
      loadedPdf?.destroy();
    };
  }, [loadAttempt, url]);

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
    if (!pdf || !canvasRef.current || !holderRef.current) return;
    const activePdf = pdf;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    async function renderPage() {
      setRendering(true);
      try {
        const pdfPage = await activePdf.getPage(page);
        if (cancelled || !canvasRef.current || !holderRef.current) return;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const availableWidth = Math.max(220, holderRef.current.clientWidth - 16);
        const scale = fitWidth ? Math.min(2.8, Math.max(0.55, availableWidth / baseViewport.width)) : zoom;
        const viewport = pdfPage.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        renderTask = pdfPage.render({
          canvas,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        await renderTask.promise;
      } catch (renderError) {
        if (!cancelled && renderError instanceof Error && renderError.name !== "RenderingCancelledException") {
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
  }, [fitWidth, holderWidth, page, pdf, zoom]);

  function jumpToPage(nextPage: number) {
    const bounded = Math.min(Math.max(nextPage, 1), totalPages || nextPage);
    setPage(bounded);
    setPageInput(String(bounded));
  }

  const pagesReady = Boolean(pdf && totalPages > 0 && !loading);

  return (
    <div className="bg-[color:var(--surface-inset)]">
      <div
        data-testid="pdf-toolbar"
        className="z-10 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)]/95 p-2 backdrop-blur sm:sticky sm:top-[69px] sm:flex sm:flex-wrap sm:p-3"
      >
        <button
          onClick={() => jumpToPage(page - 1)}
          disabled={!pagesReady || page <= 1}
          className={iconButton}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pagesReady ? (
          <label className="flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-sm font-medium text-[color:var(--text-muted)] sm:gap-2 sm:px-3">
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
              className="h-[44px] w-12 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-center text-sm font-semibold text-[color:var(--text)] outline-none transition focus:border-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-14"
            />
            <span className="text-[13px] font-semibold sm:text-sm">of {totalPages}</span>
          </label>
        ) : (
          <div className="flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text-muted)] sm:px-3">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--primary)]" />
            <span className="hidden sm:inline">{error ? "Page unavailable" : "Loading pages"}</span>
            <span className="sm:hidden">{error ? "Unavailable" : "Loading"}</span>
          </div>
        )}
        <button
          onClick={() => jumpToPage(page + 1)}
          disabled={!pagesReady || page >= totalPages}
          className={iconButton}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="col-span-3 grid grid-cols-3 gap-2 sm:col-span-1 sm:ml-auto sm:flex sm:items-center">
          <button
            onClick={() => {
              setFitWidth(false);
              setZoom((current) => Math.max(0.55, Number((current - 0.15).toFixed(2))));
            }}
            disabled={!pagesReady}
            className={iconButton}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setFitWidth(true)}
            disabled={!pagesReady}
            aria-label="Fit page width"
            className={cn(
              "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition",
              "disabled:cursor-not-allowed disabled:opacity-45",
              fitWidth
                ? "border-[color:var(--primary)]/35 bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
            )}
          >
            <Maximize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Fit</span>
          </button>
          <button
            onClick={() => {
              setFitWidth(false);
              setZoom((current) => Math.min(2.8, Number((current + 0.15).toFixed(2))));
            }}
            disabled={!pagesReady}
            className={iconButton}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        data-testid="pdf-canvas-scroll"
        ref={holderRef}
        className={cn(
          "polished-scroll relative flex min-h-[46vh] w-full min-w-0 max-w-full justify-center overscroll-contain p-2 [-webkit-overflow-scrolling:touch] sm:min-h-[62vh] sm:p-4",
          fitWidth
            ? "overflow-x-hidden overflow-y-auto [touch-action:pan-y]"
            : "overflow-auto [touch-action:pan-x_pan-y]",
        )}
      >
        {(loading || rendering) && (
          <div className="absolute left-3 right-3 top-3 z-[1] flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-tight)] sm:left-4 sm:right-auto sm:top-4">
            <span className="inline-flex min-h-8 items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--primary)]" />
              {loading ? "Loading PDF" : "Rendering page"}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-[color:var(--primary)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open source PDF
            </a>
          </div>
        )}
        {error ? (
          <div className="grid min-h-72 place-items-center text-center text-sm text-[color:var(--text-muted)]">
            <div>
              <FileText className="mx-auto mb-2 h-8 w-8" />
              <p>{error}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setLoadAttempt((current) => current + 1)}
                  className={secondaryButton}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry preview
                </button>
                <a href={url} target="_blank" rel="noreferrer" className={secondaryButton}>
                  <ExternalLink className="h-4 w-4" />
                  Open source PDF
                </a>
              </div>
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            aria-label={`${title} page ${page}`}
            className="mx-auto rounded-lg bg-white shadow-[var(--shadow-tight)] dark:bg-slate-900"
          />
        )}
      </div>
    </div>
  );
}

export function DocumentViewer({
  documentId,
  initialPage,
  chunkId,
}: {
  documentId: string;
  initialPage: number;
  chunkId?: string;
}) {
  const [document, setDocument] = useState<ClinicalDocument | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [chunks, setChunks] = useState<ChunkRow[]>([]);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState<RagAnswer | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [sourceSearch, setSourceSearch] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const { status: authStatus, isConfigured, authorizationHeader, markSessionExpired } = useAuthSession();
  const [serverDemoMode, setServerDemoMode] = useState(process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !isConfigured);
  const clientDemoMode = serverDemoMode;

  useEffect(() => {
    let active = true;
    fetch("/api/setup-status")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (active && typeof payload?.demoMode === "boolean") setServerDemoMode(payload.demoMode);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isConfigured]);

  useEffect(() => {
    if (!clientDemoMode && authStatus === "loading") {
      return () => undefined;
    }
    if (!clientDemoMode && authStatus !== "authenticated") {
      return () => undefined;
    }

    const controller = new AbortController();
    const reset = window.setTimeout(() => {
      if (!controller.signal.aborted) {
        setLoadingDocument(true);
        setViewerError(null);
      }
    }, 0);
    const detailUrl = `/api/documents/${documentId}${chunkId ? `?chunk=${chunkId}` : ""}`;
    Promise.all([
      fetch(detailUrl, {
        signal: controller.signal,
        headers: clientDemoMode ? undefined : authorizationHeader,
      }).then(async (response) => {
        const payload = await response.json();
        if (response.status === 401) markSessionExpired();
        if (!response.ok) throw new Error(payload.error || "Document details could not be loaded.");
        return payload;
      }),
      fetch(`/api/documents/${documentId}/signed-url`, {
        signal: controller.signal,
        headers: clientDemoMode ? undefined : authorizationHeader,
      }).then(async (response) => {
        const payload = await response.json();
        if (response.status === 401) markSessionExpired();
        if (!response.ok) throw new Error(payload.error || "Source preview could not be loaded.");
        return payload;
      }),
    ])
      .then(([detail, signed]) => {
        setDocument(detail.document ?? null);
        setPages(detail.pages ?? []);
        setImages(detail.images ?? []);
        setChunks(detail.chunks ?? []);
        setSignedUrl(signed.url ?? null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setViewerError(error instanceof Error ? error.message : "Document could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDocument(false);
      });

    return () => {
      window.clearTimeout(reset);
      controller.abort();
    };
  }, [
    authStatus,
    authorizationHeader,
    clientDemoMode,
    documentId,
    chunkId,
    isConfigured,
    markSessionExpired,
    previewAttempt,
  ]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  async function summarize() {
    if (!clientDemoMode && authStatus !== "authenticated") {
      setSummaryError("Sign in before summarising private documents.");
      return;
    }
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/summarize`, {
        method: "POST",
        headers: clientDemoMode ? undefined : authorizationHeader,
      });
      const payload = await response.json();
      if (response.status === 401) markSessionExpired();
      if (!response.ok) throw new Error(payload.error || "Summary could not be generated.");
      setSummary(payload);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Summary could not be generated.");
    } finally {
      setLoadingSummary(false);
    }
  }

  const authViewerError =
    !clientDemoMode && authStatus !== "authenticated" && authStatus !== "loading"
      ? isConfigured
        ? "Sign in to open private source documents."
        : "Supabase browser authentication is not configured for private source documents."
      : null;
  const effectiveLoadingDocument = !clientDemoMode && authStatus === "loading" ? true : loadingDocument;
  const effectiveViewerError = authViewerError ?? viewerError;
  const selectedPage = pages.find((page) => page.page_number === initialPage) ?? pages[0];
  const selectedChunk = chunks.find((chunk) => chunk.id === chunkId) ?? chunks[0];
  const retryPreview = () => {
    setViewerError(null);
    setLoadingDocument(true);
    setPreviewAttempt((current) => current + 1);
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-[color:var(--background)] text-[color:var(--text)]">
      <header
        className="sticky top-0 z-20 border-b border-white/10 bg-[color:var(--app-shell)] px-3 py-2 text-white shadow-[var(--shadow-soft)] sm:px-4 sm:py-3 lg:px-8"
        style={{ backgroundColor: "var(--app-shell)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-lg border border-white/15 bg-white/7 text-slate-100 transition hover:bg-white/12"
              aria-label="Back to search"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight sm:text-base">
                {document?.title ?? "Document"}
              </p>
              <p className="hidden truncate text-xs font-medium text-slate-300 sm:block">
                page {initialPage} · {document?.file_name ?? "loading source"}
              </p>
              <div className="hidden items-center gap-2 sm:flex">
                {document ? (
                  <>
                    <SourceStatusBadge metadata={document.metadata} />
                    <span className="truncate text-xs font-medium text-slate-300">
                      Review {formatClinicalDate(normalizeSourceMetadata(document.metadata).review_date)}
                    </span>
                  </>
                ) : (
                  <span className="truncate text-xs font-semibold text-slate-300">Loading source metadata</span>
                )}
                {!isOnline && <span className="text-xs font-semibold text-amber-100">Offline</span>}
              </div>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-amber-100 sm:hidden">
                p.{initialPage} ·{" "}
                {document ? sourceStatusLabel(normalizeSourceMetadata(document.metadata)) : "Loading source metadata"}
              </p>
            </div>
          </div>
          <button
            onClick={summarize}
            disabled={loadingSummary}
            className={cn(primaryButton, "w-[44px] px-0 sm:w-auto sm:px-5")}
            aria-label="Summarise document"
          >
            {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="hidden sm:inline">Summarise</span>
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-3 py-4 pb-24 sm:gap-5 sm:px-4 sm:py-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <div className="lg:hidden">
            <PinnedSourceEvidence loading={effectiveLoadingDocument} chunk={selectedChunk} />
          </div>

          <details className={cn("group lg:hidden", panel)}>
            <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="inline-flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-subtle)] text-[color:var(--primary)]">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[color:var(--text)]">Indexed page text</span>
                  <span className={cn("block truncate text-xs", textMuted)}>
                    {effectiveLoadingDocument
                      ? "Loading indexed page text"
                      : `Page ${selectedPage?.page_number ?? initialPage} extracted text`}
                  </span>
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-[color:var(--border)] p-4">
              <IndexedTextPanel
                loading={effectiveLoadingDocument}
                selectedPage={selectedPage}
                chunks={chunks}
                search={sourceSearch}
                onSearchChange={setSourceSearch}
              />
            </div>
          </details>

          <div className={cn(panel, "overflow-hidden")}>
            <div data-testid="pdf-preview">
              {effectiveLoadingDocument ? (
                <div className="grid min-h-64 place-items-center bg-[color:var(--surface-inset)] p-5 text-center text-sm font-semibold text-[color:var(--text-muted)] sm:min-h-72">
                  <div>
                    <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-[color:var(--primary)]" />
                    <p>Loading source document</p>
                    {signedUrl && (
                      <a href={signedUrl} target="_blank" rel="noreferrer" className={cn(secondaryButton, "mt-3")}>
                        <ExternalLink className="h-4 w-4" />
                        Open source PDF
                      </a>
                    )}
                  </div>
                </div>
              ) : effectiveViewerError ? (
                <div className="grid min-h-64 place-items-center bg-[color:var(--surface-inset)] p-5 text-center text-sm text-[color:var(--danger)] sm:min-h-72">
                  <div>
                    <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                    <p className="font-semibold">{effectiveViewerError}</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <button type="button" onClick={retryPreview} className={secondaryButton}>
                        <RefreshCw className="h-4 w-4" />
                        Retry preview
                      </button>
                      {signedUrl && (
                        <a href={signedUrl} target="_blank" rel="noreferrer" className={secondaryButton}>
                          <ExternalLink className="h-4 w-4" />
                          Open source PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : signedUrl && document?.file_type === "application/pdf" ? (
                <PdfCanvasViewer
                  key={`${signedUrl}:${initialPage}`}
                  url={signedUrl}
                  title={document.title}
                  initialPage={initialPage}
                />
              ) : (
                <div className="grid min-h-64 place-items-center bg-[color:var(--surface-inset)] p-5 text-center text-sm text-[color:var(--text-muted)] sm:min-h-72">
                  <div>
                    <FileText className="mx-auto mb-2 h-8 w-8" />
                    Source preview is available after a signed URL is generated.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:block">
            <IndexedTextPanel
              loading={effectiveLoadingDocument}
              selectedPage={selectedPage}
              chunks={chunks}
              search={sourceSearch}
              onSearchChange={setSourceSearch}
            />
          </div>
        </div>

        <aside className="min-w-0 space-y-4 sm:space-y-5">
          <div className="hidden lg:block">
            <PinnedSourceEvidence loading={effectiveLoadingDocument} chunk={selectedChunk} />
          </div>

          <section className={cn(panel, "p-4 source-print")}>
            <PanelHeading
              icon={FileText}
              title="Source status"
              description="Verify source provenance before using generated summaries or copied text."
            />
            <SourceMetadataSummary metadata={document?.metadata} />
          </section>

          <section className={cn(panel, "p-4")}>
            <PanelHeading
              icon={FileImage}
              title="Images and captions"
              description="Indexed diagrams extracted from the source document."
            />
            <div className="mt-3 space-y-3">
              {effectiveLoadingDocument ? (
                <LoadingPanel label="Loading indexed images" />
              ) : images.length === 0 ? (
                <p className={cn("text-[15px]", textMuted)}>No extracted images have been indexed for this document.</p>
              ) : (
                images.map((image) => <DocumentImage key={image.id} image={image} />)
              )}
            </div>
          </section>

          {summary && (
            <section className={cn(panel, "p-4")}>
              <PanelHeading icon={Sparkles} title="Clinical summary" />
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-[color:var(--text-muted)]">
                {summary.answer}
              </p>
            </section>
          )}
          {summaryError && (
            <section className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-4 text-sm font-medium text-[color:var(--danger)]">
              <AlertCircle className="mr-2 inline h-4 w-4" />
              {summaryError}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
