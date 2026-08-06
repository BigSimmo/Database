"use client";

import { CircleAlert, Eye, Loader2, Maximize2, Minus, Plus, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { cn, textMuted } from "@/components/ui-primitives";

export type DocumentFrameSource =
  | { kind: "pdf-page"; url?: string; page: number; pageCount?: number }
  | { kind: "image"; url?: string }
  | { kind: "document"; url?: string };

export type DocumentFrameControls = {
  fitWidth: boolean;
  onFitWidth: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  viewingAid: boolean;
  onViewingAidChange: (active: boolean) => void;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  disabled?: boolean;
};

type DocumentFrameBaseProps = {
  /** Required accessible name for the source page, figure, or document. */
  alt: string;
  /** The URL may be absent while the owning preview state machine obtains it. */
  src: DocumentFrameSource;
  controls?: DocumentFrameControls;
  statusDetail?: ReactNode;
  statusActions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

type DocumentFrameStateProps =
  | {
      state: "loading";
      loadingLabel: string;
      errorMessage?: never;
      onRetry?: never;
      retryLabel?: never;
    }
  | {
      state: "error";
      errorMessage: string;
      onRetry: () => void;
      retryLabel?: string;
      loadingLabel?: never;
    }
  | {
      state: "ready";
      loadingLabel?: never;
      errorMessage?: never;
      onRetry?: never;
      retryLabel?: never;
    };

export type DocumentFrameProps = DocumentFrameBaseProps & DocumentFrameStateProps;

const frameControl =
  "inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-45";

function boundedZoom(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function DocumentControls({ controls }: { controls: DocumentFrameControls }) {
  const minimum = controls.minZoom ?? 0.5;
  const maximum = controls.maxZoom ?? 4;
  const step = controls.zoomStep ?? 0.25;
  const zoom = boundedZoom(controls.zoom, minimum, maximum);
  const zoomed = !controls.fitWidth;
  const viewingAidActive = controls.viewingAid && !zoomed;
  const controlsDisabled = Boolean(controls.disabled);

  return (
    <div
      role="toolbar"
      aria-label="Document viewing controls"
      data-testid="document-frame-controls"
      data-print-hide
      className="flex min-w-0 flex-wrap items-center justify-end gap-1.5"
    >
      <button
        type="button"
        className={frameControl}
        aria-label="Zoom out"
        disabled={controlsDisabled || zoom <= minimum}
        onClick={() => controls.onZoomChange(Number(boundedZoom(zoom - step, minimum, maximum).toFixed(3)))}
      >
        <Minus aria-hidden="true" className="size-icon-sm" />
      </button>
      <button
        type="button"
        className={cn(
          frameControl,
          controls.fitWidth &&
            "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
        )}
        aria-label="Fit document to width"
        aria-pressed={controls.fitWidth}
        disabled={controlsDisabled}
        onClick={controls.onFitWidth}
      >
        <Maximize2 aria-hidden="true" className="size-icon-sm" />
        <span className="hidden sm:inline">Fit width</span>
      </button>
      <button
        type="button"
        className={frameControl}
        aria-label="Zoom in"
        disabled={controlsDisabled || zoom >= maximum}
        onClick={() => controls.onZoomChange(Number(boundedZoom(zoom + step, minimum, maximum).toFixed(3)))}
      >
        <Plus aria-hidden="true" className="size-icon-sm" />
      </button>
      <output aria-label="Document zoom" className={cn("nums min-w-14 text-center text-xs font-semibold", textMuted)}>
        {Math.round(zoom * 100)}%
      </output>
      <button
        type="button"
        className={cn(
          frameControl,
          viewingAidActive &&
            "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
        )}
        aria-label={zoomed ? "Viewing aid unavailable while zoomed" : "Reduce document surround glare"}
        aria-pressed={viewingAidActive}
        disabled={controlsDisabled || zoomed}
        onClick={() => controls.onViewingAidChange(!viewingAidActive)}
      >
        <Eye aria-hidden="true" className="size-icon-sm" />
        <span className="hidden sm:inline">Viewing aid</span>
      </button>
    </div>
  );
}

/**
 * A pixel-faithful frame for source documents. The component owns the semantic
 * loading/error/ready shell and, when supplied, a controlled viewing toolbar.
 * Source renderers keep their existing fetch, page, raster, and gesture logic.
 */
export function DocumentFrame({
  alt,
  src,
  state,
  controls,
  statusDetail,
  statusActions,
  children,
  className,
  ...stateProps
}: DocumentFrameProps) {
  const sourcePage = src.kind === "pdf-page" ? Math.max(1, Math.trunc(src.page)) : undefined;
  const sourcePageCount =
    src.kind === "pdf-page" && typeof src.pageCount === "number"
      ? Math.max(sourcePage ?? 1, Math.trunc(src.pageCount))
      : undefined;
  const viewingAidActive = Boolean(controls?.viewingAid && controls.fitWidth && !controls.disabled);

  return (
    <div
      role="group"
      aria-label={alt}
      aria-busy={state === "loading" || undefined}
      data-testid="document-frame"
      data-document-frame
      data-source-kind={src.kind}
      data-state={state}
      data-viewing-aid={viewingAidActive ? "on" : "off"}
      className={cn("min-w-0 overflow-hidden bg-[color:var(--surface-raised)]", className)}
    >
      {controls ? (
        <div
          data-print-hide
          className="flex min-w-0 flex-col gap-2 border-b border-[color:var(--border-lux)] bg-[color:var(--surface-glass)] p-2 shadow-[var(--shadow-tight)] sm:flex-row sm:items-center sm:justify-between sm:p-3"
        >
          {sourcePage ? (
            <p className={cn("nums shrink-0 text-xs font-semibold", textMuted)}>
              Page {sourcePage}
              {sourcePageCount ? ` of ${sourcePageCount}` : ""}
            </p>
          ) : (
            <span />
          )}
          <DocumentControls controls={controls} />
        </div>
      ) : null}

      <div
        data-testid="document-frame-surround"
        data-print-keep-together
        className={cn(
          "relative grid min-h-64 place-items-center break-inside-avoid bg-[color:var(--surface-inset)] p-3 shadow-[var(--shadow-inset)] sm:min-h-72 sm:p-4 print:min-h-0 print:break-inside-avoid print:bg-transparent print:p-0 print:shadow-none",
          viewingAidActive && "bg-[color:var(--background)]",
        )}
      >
        {state === "loading" ? (
          <div role="status" className="grid min-h-56 place-items-center p-5 text-center sm:min-h-64">
            <div>
              <Loader2
                aria-hidden="true"
                className="mx-auto mb-3 size-icon-md animate-spin text-[color:var(--clinical-accent)] motion-reduce:animate-none"
              />
              <p className="text-sm font-semibold text-[color:var(--text)]">{stateProps.loadingLabel}</p>
              {statusDetail}
              {statusActions ? <div className="mt-3 flex flex-wrap justify-center gap-2">{statusActions}</div> : null}
            </div>
          </div>
        ) : state === "error" ? (
          <div role="alert" className="grid min-h-56 place-items-center p-5 text-center sm:min-h-64">
            <div className="max-w-md">
              <CircleAlert aria-hidden="true" className="mx-auto mb-2 size-icon-lg text-[color:var(--danger)]" />
              <p className="font-semibold text-[color:var(--text)]">Preview unavailable</p>
              <p className="mt-1 text-sm text-[color:var(--danger)]">{stateProps.errorMessage}</p>
              {statusDetail}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={stateProps.onRetry} className={frameControl}>
                  <RefreshCw aria-hidden="true" className="size-icon-sm" />
                  {stateProps.retryLabel ?? "Retry preview"}
                </button>
                {statusActions}
              </div>
            </div>
          </div>
        ) : (
          <div
            data-testid="document-frame-content"
            className="relative w-full min-w-0 max-w-full break-inside-avoid print:break-inside-avoid"
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
