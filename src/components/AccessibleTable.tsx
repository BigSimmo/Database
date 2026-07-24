"use client";

import { Maximize2 } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn, textMuted } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import { normalizeAccessibleTable, type NormalizedAccessibleTable } from "@/lib/accessible-table-normalization";
import { normalizeExtractedGlyphs } from "@/lib/source-text-sanitizer";

const tableExpandMediaQuery = "(max-width: 784px), ((max-width: 1023px) and (hover: none) and (pointer: coarse))";
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
        expanded && "max-h-[calc(100dvh-8.5rem)] flex flex-col rounded-none border-0 sm:rounded-lg sm:border",
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
      <div className={cn("overflow-x-auto", expanded && "flex-1 min-h-0")}>
        <table
          aria-label={caption ?? undefined}
          className={cn(
            // Non-dense tables use auto layout so columns size to their content
            // (min-content = longest word) and wrap at word boundaries; a table
            // too wide for its container scrolls via the overflow-x-auto wrapper
            // above rather than squeezing columns until words break mid-character.
            // The dense preview keeps a fixed layout (re-added below) for its
            // ellipsised single-line cells.
            "w-full border-separate border-spacing-0 text-left",
            renderDensePreview ? "min-w-full table-fixed text-2xs" : expanded ? "text-base-minus" : "text-sm",
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
                      : "whitespace-normal break-words",
                    index > 0 && "border-l border-[color:var(--border)]/70",
                    renderDensePreview
                      ? "px-2 py-1.5 text-2xs uppercase tracking-[0.06em]"
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
                    renderDensePreview
                      ? "overflow-hidden text-ellipsis whitespace-nowrap"
                      : "whitespace-normal break-words",
                    renderDensePreview
                      ? "px-2 py-1.5 text-2xs uppercase tracking-[0.06em]"
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
                          renderDensePreview ? "overflow-hidden whitespace-nowrap" : "whitespace-pre-wrap break-words",
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
                              : "mb-1 block text-2xs font-bold uppercase tracking-[0.08em] md:hidden",
                            textMuted,
                          )}
                        >
                          {header[cellIndex] || `Column ${cellIndex + 1}`}
                        </span>
                        <span
                          className={cn(
                            "block min-w-0",
                            renderDensePreview
                              ? "truncate text-2xs leading-4"
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
                            : "mb-1 block text-2xs font-bold uppercase tracking-[0.08em] md:hidden",
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

// Mirrors the component's `normalized` computation so callers can decide layout
// (e.g. whether to collapse a source image) using the exact same parse/normalize
// rules AccessibleTable renders with. Returns false when the table would render
// nothing — columns-only input, unparseable markdown, or an all-metadata grid.
export function hasRenderableAccessibleTable({
  markdown,
  rows,
  columns,
  clinicalOnly = false,
}: {
  markdown?: string | null;
  rows?: string[][] | null;
  columns?: string[] | null;
  clinicalOnly?: boolean;
}): boolean {
  const hasExplicitRows = Boolean(rows?.length);
  const parsed = hasExplicitRows ? rows : parseMarkdownTable(markdown);
  if (!parsed?.length) return false;
  const table = normalizeAccessibleTable(parsed, hasExplicitRows ? columns : null);
  if (!table) return false;
  return Boolean(clinicalOnly ? clinicalOnlyTable(table) : table);
}

export function AccessibleTable({
  caption,
  markdown,
  rows,
  columns,
  normalizedTable,
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
  lowConfidenceFallback,
}: {
  caption?: string | null;
  markdown?: string | null;
  rows?: string[][] | null;
  columns?: string[] | null;
  normalizedTable?: NormalizedAccessibleTable | null;
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
  // GEN-H3: when the normalizer can't confidently reconstruct a clinical table,
  // the padded raw grid is misleading (mostly empty "-" cells, clipped headers).
  // Callers that have the cropped source image (e.g. the visual-evidence cards)
  // can pass it here to show the real table screenshot instead of that grid.
  lowConfidenceFallback?: ReactNode;
}) {
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const canExpand = useMobileTableExpansion(expandOnMobile);
  const hasExplicitRows = Boolean(rows?.length);
  const parsed = useMemo(() => {
    return hasExplicitRows ? rows : parseMarkdownTable(markdown);
  }, [hasExplicitRows, rows, markdown]);
  const normalized = useMemo(() => {
    if (normalizedTable) return normalizedTable;
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
  }, [clinicalOnly, columns, hasExplicitRows, normalizedTable, parsed]);

  const dialogOpen = open;

  if (!normalized) return null;

  const { header, body } = normalized;
  const displayCaption = clinicalOnly && caption ? cleanClinicalTableText(caption) : caption;
  const title = dialogTitle || displayCaption || "Clinical table";
  const lowConfidence = Boolean(normalized.lowConfidence);
  const showFallback = lowConfidence && Boolean(lowConfidenceFallback);
  const table = (
    <>
      {lowConfidence ? (
        <p data-testid="table-low-confidence-note" className={cn("mb-1 text-xs", textMuted)}>
          {showFallback
            ? "Table structure could not be confidently reconstructed — showing the source document image instead."
            : "Table structure could not be confidently reconstructed — verify values against the source document."}
        </p>
      ) : null}
      {showFallback ? (
        <div data-testid="table-source-image-fallback">{lowConfidenceFallback}</div>
      ) : (
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
      )}
    </>
  );

  function openDialog(trigger: HTMLElement) {
    if (!canExpand) return;
    trigger.scrollIntoView({ block: "nearest", inline: "nearest" });
    restoreFocusRef.current = trigger;
    setOpen(true);
  }

  return (
    <>
      <div className="relative min-w-0">
        <div data-testid="accessible-table-surface" className="min-w-0">
          {table}
        </div>
        {canExpand ? (
          <button
            type="button"
            data-testid="table-expand-button"
            aria-label={`Open ${title} full screen`}
            aria-haspopup="dialog"
            aria-expanded={dialogOpen}
            onClick={(event) => {
              event.stopPropagation();
              openDialog(event.currentTarget);
            }}
            className="relative z-50 mt-2 inline-flex min-h-tap w-full items-center justify-center gap-2 scroll-mb-[calc(18rem+env(safe-area-inset-bottom))] rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-tight)] transition hover:border-[color:var(--border-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--focus)]/25"
          >
            <span>Expand table</span>
            <Maximize2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <Sheet
        open={dialogOpen}
        onClose={() => setOpen(false)}
        title={title}
        description="Clinical table"
        closeLabel="Close full-screen table"
        returnFocusRef={restoreFocusRef}
        mobilePlacement="fullscreen"
        portal
        testId="table-fullscreen-dialog"
        contentClassName="sm:max-w-none"
        bodyClassName="p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-3"
      >
        <div className="flex flex-col h-full">
          {lowConfidence ? (
            <p data-testid="table-low-confidence-note" className={cn("mb-1 text-xs", textMuted)}>
              {showFallback
                ? "Table structure could not be confidently reconstructed — showing the source document image instead."
                : "Table structure could not be confidently reconstructed — verify values against the source document."}
            </p>
          ) : null}
          {showFallback ? (
            <div data-testid="table-source-image-fallback">{lowConfidenceFallback}</div>
          ) : (
            <AccessibleTableMarkup
              caption={displayCaption}
              header={header}
              body={body}
              compact={false}
              expanded
              rowActions={rowActions}
              actionsHeader={actionsHeader}
            />
          )}
        </div>
      </Sheet>
    </>
  );
}
