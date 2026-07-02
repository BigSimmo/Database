"use client";

import { Maximize2, X } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn, textMuted } from "@/components/ui-primitives";
import { normalizeAccessibleTable, type NormalizedAccessibleTable } from "@/lib/accessible-table-normalization";
import { normalizeExtractedGlyphs } from "@/lib/source-text-sanitizer";

const tableExpandMediaQuery = "(max-width: 768px), ((max-width: 1023px) and (hover: none) and (pointer: coarse))";
const metadataHeaderPattern = /^(?:source|sources|support|pages?|chunk|file|document|citation|citations|provenance)$/i;
const metadataCellPattern =
  /\b(?:page|pages|p\.|chunk|source|citation|citations)\s*[:#-]?\s*(?:n\/a|\d+(?:\s*[-,]\s*\d+)*)\b/gi;
const fileNamePattern = /\b[\w .()[\]-]+\.(?:pdf|docx?|pptx?|xlsx?|png|jpe?g|tiff?)\b/gi;

function parseMarkdownTable(markdown?: string | null) {
  if (!markdown) return null;
  const rows = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|") && !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line))
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.replace(/\\\|/g, "|").trim()),
    )
    .filter((row) => row.some(Boolean));
  return rows.length ? rows : null;
}

function cleanClinicalTableText(value: string) {
  return normalizeExtractedGlyphs(value)
    .replace(metadataCellPattern, "")
    .replace(fileNamePattern, "")
    .replace(/\b(?:direct|partial|nearby|unsupported|source-linked)\s+support\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function isMetadataHeader(value: string) {
  return metadataHeaderPattern.test(value.trim());
}

function clinicalOnlyTable(table: NormalizedAccessibleTable) {
  const keptIndexes = table.header
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => !isMetadataHeader(header))
    .map(({ index }) => index);

  const indexes = keptIndexes.length ? keptIndexes : table.header.map((_, index) => index);
  const header = indexes.map((index) => cleanClinicalTableText(table.header[index])).filter(Boolean);
  const body = table.body
    .map((row) => indexes.map((index) => cleanClinicalTableText(row[index] ?? "")))
    .filter((row) => row.some(Boolean));

  if (!header.length || !body.length) return null;
  // GEN-H3: carry the low-confidence flag through so an ambiguously-normalized
  // clinical table is rendered with a "verify against source" caveat.
  return { header, body, lowConfidence: table.lowConfidence, lowConfidenceReason: table.lowConfidenceReason };
}

function AccessibleTableMarkup({
  caption,
  header,
  body,
  compact,
  expanded = false,
  previewRows,
  hidePreviewCaption = false,
  hidePreviewRowCount = false,
  densePreview = false,
  rowActions,
  actionsHeader = "Actions",
}: {
  caption?: string | null;
  header: string[];
  body: string[][];
  compact: boolean;
  expanded?: boolean;
  previewRows?: number;
  hidePreviewCaption?: boolean;
  hidePreviewRowCount?: boolean;
  densePreview?: boolean;
  rowActions?: Array<ReactNode | null>;
  actionsHeader?: string;
}) {
  const defaultPreviewRows = compact ? 6 : 20;
  const visibleBody = expanded ? body : body.slice(0, previewRows ?? defaultPreviewRows);
  const hasActions = Boolean(rowActions?.some(Boolean));
  const columnCount = Math.max(header.length + (hasActions ? 1 : 0), 1);
  const displayRows = visibleBody.map((row) => header.map((_, index) => row[index] ?? ""));
  const displayActions = visibleBody.map((_, index) => rowActions?.[index] ?? null);
  const renderDensePreview = densePreview && !expanded;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]",
        expanded && "max-h-[calc(100dvh-8.5rem)] rounded-none border-0 sm:rounded-lg sm:border",
      )}
    >
      {caption && !(hidePreviewCaption && !expanded) ? (
        <div
          className={cn(
            "border-b border-[color:var(--border)] px-3 py-2 text-left font-semibold",
            expanded ? "text-sm text-[color:var(--text-heading)]" : `text-xs ${textMuted}`,
          )}
        >
          {caption}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table
          aria-label={caption ?? undefined}
          className={cn(
            "w-full border-separate border-spacing-0 text-left md:table-fixed",
            renderDensePreview ? "min-w-full table-fixed text-[11px]" : expanded ? "text-[15px]" : "text-sm",
          )}
        >
          <colgroup className="hidden md:table-column-group">
            {header.map((cell, index) => (
              <col key={`${cell}:col:${index}`} style={{ width: `${100 / columnCount}%` }} />
            ))}
            {hasActions ? <col style={{ width: `${100 / columnCount}%` }} /> : null}
          </colgroup>
          <thead className={renderDensePreview ? "table-header-group" : "sr-only md:not-sr-only md:table-header-group"}>
            <tr className="bg-[color:var(--surface-subtle)]">
              {header.map((cell, index) => (
                <th
                  key={`${cell}:${index}`}
                  scope="col"
                  className={cn(
                    "nums border-b border-[color:var(--border)] align-top font-semibold leading-5 text-[color:var(--text)]",
                    renderDensePreview
                      ? "overflow-hidden text-ellipsis whitespace-nowrap"
                      : "whitespace-normal break-words [overflow-wrap:anywhere]",
                    index > 0 && "border-l border-[color:var(--border)]/70",
                    renderDensePreview
                      ? "px-2 py-1.5 text-[10px] uppercase tracking-[0.06em]"
                      : expanded
                        ? "px-4 py-3 text-sm"
                        : "px-3 py-2 text-xs",
                  )}
                >
                  {cell}
                </th>
              ))}
              {hasActions ? (
                <th
                  scope="col"
                  className={cn(
                    "nums border-b border-l border-[color:var(--border)]/70 align-top font-semibold leading-5 text-[color:var(--text)]",
                    "whitespace-normal break-words [overflow-wrap:anywhere]",
                    renderDensePreview
                      ? "px-2 py-1.5 text-[10px] uppercase tracking-[0.06em]"
                      : expanded
                        ? "px-4 py-3 text-sm"
                        : "px-3 py-2 text-xs",
                  )}
                >
                  {actionsHeader}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody
            className={
              renderDensePreview ? "table-row-group" : "block space-y-2 p-2 md:table-row-group md:space-y-0 md:p-0"
            }
          >
            {displayRows.map((row, rowIndex) => {
              return (
                <tr
                  key={`${rowIndex}:${row.join("|")}`}
                  className={cn(
                    renderDensePreview
                      ? "table-row even:bg-[color:var(--surface-subtle)]/35"
                      : "block rounded-md border border-[color:var(--border)]/75 bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]",
                    !renderDensePreview &&
                      "md:table-row md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:even:bg-[color:var(--surface-subtle)]/35",
                  )}
                >
                  {header.map((_, cellIndex) => {
                    const cell = row[cellIndex] ?? "";
                    return (
                      <td
                        key={`${rowIndex}:${cellIndex}`}
                        className={cn(
                          "nums align-top text-[color:var(--text)]",
                          renderDensePreview ? "table-cell" : "block md:table-cell",
                          renderDensePreview
                            ? "overflow-hidden whitespace-nowrap"
                            : "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                          renderDensePreview
                            ? "border-t border-[color:var(--border)]/70 px-2 py-1.5 leading-4"
                            : "border-b border-[color:var(--border)]/60 pb-2 last:border-b-0 md:border-b-0 md:border-t md:border-[color:var(--border)]/70 md:last:border-b-0",
                          cellIndex > 0 &&
                            (renderDensePreview
                              ? "border-l border-[color:var(--border)]/60"
                              : "md:border-l md:border-[color:var(--border)]/60"),
                          !renderDensePreview &&
                            (expanded ? "md:px-4 md:py-3 md:leading-6" : "md:px-3 md:py-2 md:leading-5"),
                          !renderDensePreview && cellIndex > 0 && "pt-2 md:pt-0",
                        )}
                      >
                        <span
                          className={cn(
                            renderDensePreview
                              ? "sr-only"
                              : "mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] md:hidden",
                            textMuted,
                          )}
                        >
                          {header[cellIndex] || `Column ${cellIndex + 1}`}
                        </span>
                        <span
                          className={cn(
                            "block min-w-0",
                            renderDensePreview
                              ? "truncate text-[11px] leading-4"
                              : "text-sm leading-6 md:text-inherit md:leading-inherit",
                          )}
                        >
                          {cell || <span className={textMuted}>-</span>}
                        </span>
                      </td>
                    );
                  })}
                  {hasActions ? (
                    <td
                      className={cn(
                        "align-top",
                        renderDensePreview
                          ? "table-cell border-l border-t border-[color:var(--border)]/60 px-2 py-1.5"
                          : "block pt-2 md:table-cell md:border-l md:border-t md:border-[color:var(--border)]/60",
                        !renderDensePreview && (expanded ? "md:px-4 md:py-3" : "md:px-3 md:py-2"),
                      )}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span
                        className={cn(
                          renderDensePreview
                            ? "sr-only"
                            : "mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] md:hidden",
                          textMuted,
                        )}
                      >
                        {actionsHeader}
                      </span>
                      {displayActions[rowIndex] || <span className={textMuted}>-</span>}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {body.length > visibleBody.length && !(hidePreviewRowCount && !expanded) ? (
        <p className={cn("nums border-t border-[color:var(--border)] px-3 py-2 text-xs", textMuted)}>
          Showing {visibleBody.length} of {body.length} rows.
        </p>
      ) : null}
    </div>
  );
}

function useMobileTableExpansion(enabledByDefault: boolean) {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!enabledByDefault || typeof window === "undefined" || typeof window.matchMedia !== "function")
        return () => {};
      const media = window.matchMedia(tableExpandMediaQuery);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    [enabledByDefault],
  );

  const getSnapshot = useCallback(() => {
    if (!enabledByDefault || typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(tableExpandMediaQuery).matches;
  }, [enabledByDefault]);

  const isMobile = useSyncExternalStore(subscribe, getSnapshot, () => false);
  return enabledByDefault && isMobile;
}

export function AccessibleTable({
  caption,
  markdown,
  rows,
  columns,
  compact = false,
  expandOnMobile = false,
  previewRows,
  hidePreviewCaption = false,
  hidePreviewRowCount = false,
  densePreview = false,
  dialogTitle,
  clinicalOnly = false,
  rowActions,
  actionsHeader,
}: {
  caption?: string | null;
  markdown?: string | null;
  rows?: string[][] | null;
  columns?: string[] | null;
  compact?: boolean;
  expandOnMobile?: boolean;
  previewRows?: number;
  hidePreviewCaption?: boolean;
  hidePreviewRowCount?: boolean;
  densePreview?: boolean;
  dialogTitle?: string | null;
  clinicalOnly?: boolean;
  rowActions?: Array<ReactNode | null>;
  actionsHeader?: string;
}) {
  const dialogId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const canExpand = useMobileTableExpansion(expandOnMobile);
  const hasExplicitRows = Boolean(rows?.length);
  const parsed = useMemo(() => {
    return hasExplicitRows ? rows : parseMarkdownTable(markdown);
  }, [hasExplicitRows, rows, markdown]);
  const normalized = useMemo(() => {
    if (!parsed?.length) return null;
    // Audit M8/H4 parity (diff review): markdown-parsed rows include their
    // own header line as row 0 — passing explicit columns alongside them made
    // the markdown header render as the first DATA row on screen, and let the
    // on-screen and copied-ward-note normalizations disagree (different
    // headers, potentially different lowConfidence caveats). Columns are the
    // header only for explicit row arrays, matching clinicalTableToTextRows
    // in ward-output.ts.
    const table = normalizeAccessibleTable(parsed, hasExplicitRows ? columns : null);
    if (!table) return null;
    return clinicalOnly ? clinicalOnlyTable(table) : table;
  }, [clinicalOnly, columns, hasExplicitRows, parsed]);

  const dialogOpen = open && canExpand;

  useEffect(() => {
    if (!dialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [dialogOpen]);

  if (!normalized) return null;

  const { header, body } = normalized;
  const displayCaption = clinicalOnly && caption ? cleanClinicalTableText(caption) : caption;
  const title = dialogTitle || displayCaption || "Clinical table";
  const lowConfidence = Boolean(normalized.lowConfidence);
  const table = (
    <>
      {lowConfidence ? (
        <p data-testid="table-low-confidence-note" className={cn("mb-1 text-xs", textMuted)}>
          Table structure could not be confidently reconstructed — verify values against the source document.
        </p>
      ) : null}
      <AccessibleTableMarkup
        caption={displayCaption}
        header={header}
        body={body}
        compact={compact}
        previewRows={previewRows}
        hidePreviewCaption={hidePreviewCaption}
        hidePreviewRowCount={hidePreviewRowCount}
        densePreview={densePreview}
        rowActions={rowActions}
        actionsHeader={actionsHeader}
      />
    </>
  );

  function openDialog(trigger: HTMLElement) {
    if (!canExpand) return;
    restoreFocusRef.current = trigger;
    setOpen(true);
  }

  function handleSurfaceKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!canExpand) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDialog(event.currentTarget);
  }

  return (
    <>
      <div className="relative min-w-0">
        <div
          data-testid="accessible-table-surface"
          onClick={(event) => openDialog(event.currentTarget)}
          onKeyDown={handleSurfaceKeyDown}
          role={canExpand ? "button" : undefined}
          tabIndex={canExpand ? 0 : -1}
          aria-label={canExpand ? `Open ${title} full table` : undefined}
          aria-haspopup={canExpand ? "dialog" : undefined}
          aria-expanded={canExpand ? dialogOpen : undefined}
          aria-controls={dialogOpen ? dialogId : undefined}
          className={cn(
            "min-w-0",
            canExpand &&
              "cursor-zoom-in rounded-lg outline-none ring-offset-2 ring-offset-[color:var(--surface)] transition focus-within:ring-4 focus-within:ring-[color:var(--focus)]/25",
          )}
        >
          {table}
        </div>
        {canExpand ? (
          <button
            type="button"
            data-testid="table-expand-button"
            aria-label={`Open ${title} full screen`}
            aria-haspopup="dialog"
            aria-controls={dialogOpen ? dialogId : undefined}
            onClick={(event) => {
              event.stopPropagation();
              openDialog(event.currentTarget);
            }}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-tight)] transition hover:border-[color:var(--border-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--focus)]/25"
          >
            <span>Expand table</span>
            <Maximize2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {dialogOpen ? (
        <div
          data-testid="table-fullscreen-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${dialogId}-title`}
          className="fixed inset-0 z-[85] bg-[color:var(--background)] text-[color:var(--text)]"
          onClick={() => setOpen(false)}
        >
          <div className="flex h-full min-w-0 flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="flex min-h-[64px] shrink-0 items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[var(--shadow-tight)]">
              <div className="min-w-0">
                <p className={cn("text-[11px] font-bold uppercase tracking-[0.08em]", textMuted)}>Clinical table</p>
                <h2
                  id={`${dialogId}-title`}
                  className="truncate text-base font-semibold text-[color:var(--text-heading)]"
                >
                  {title}
                </h2>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                aria-label="Close full-screen table"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--focus)]/25"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <AccessibleTableMarkup
                caption={displayCaption}
                header={header}
                body={body}
                compact={false}
                expanded
                rowActions={rowActions}
                actionsHeader={actionsHeader}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
