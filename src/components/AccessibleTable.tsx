"use client";

import { Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn, textMuted } from "@/components/ui-primitives";
import { normalizeAccessibleTable } from "@/lib/accessible-table-normalization";

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
  return value
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

function clinicalOnlyTable(table: { header: string[]; body: string[][] }) {
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
  return { header, body };
}

function useMobileTableExpansion(enabled: boolean) {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!enabled || typeof window === "undefined") return () => undefined;
      const media = window.matchMedia(tableExpandMediaQuery);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    [enabled],
  );

  const getSnapshot = useCallback(() => {
    return enabled && typeof window !== "undefined" && window.matchMedia(tableExpandMediaQuery).matches;
  }, [enabled]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function AccessibleTableMarkup({
  caption,
  header,
  body,
  compact,
  expanded = false,
}: {
  caption?: string | null;
  header: string[];
  body: string[][];
  compact: boolean;
  expanded?: boolean;
}) {
  const visibleBody = expanded ? body : body.slice(0, compact ? 6 : 20);

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]",
        expanded && "max-h-[calc(100dvh-8.5rem)] rounded-none border-0 sm:rounded-lg sm:border",
      )}
    >
      <table className={cn("min-w-full border-collapse text-left", expanded ? "text-[15px]" : "text-sm")}>
        {caption ? (
          <caption
            className={cn(
              "caption-top px-3 py-2 text-left font-semibold",
              expanded ? "text-sm text-[color:var(--text-heading)]" : `text-xs ${textMuted}`,
            )}
          >
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr className="bg-[color:var(--surface-subtle)]">
            {header.map((cell, index) => (
              <th
                key={`${cell}:${index}`}
                scope="col"
                className={cn(
                  "border-b border-[color:var(--border)] align-top font-semibold text-[color:var(--text)]",
                  expanded ? "px-4 py-3 text-sm" : "px-3 py-2 text-xs",
                )}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleBody.map((row, rowIndex) => {
            return (
              <tr key={`${rowIndex}:${row.join("|")}`} className="border-t border-[color:var(--border)]/70">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}:${cellIndex}`}
                    className={cn(
                      "align-top text-[color:var(--text)]",
                      expanded ? "px-4 py-3 leading-6" : "px-3 py-2 leading-5",
                    )}
                  >
                    {cell || <span className={textMuted}>-</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {body.length > visibleBody.length ? (
        <p className={cn("border-t border-[color:var(--border)] px-3 py-2 text-xs", textMuted)}>
          Showing {visibleBody.length} of {body.length} rows.
        </p>
      ) : null}
    </div>
  );
}

export function AccessibleTable({
  caption,
  markdown,
  rows,
  columns,
  compact = false,
  expandOnMobile = false,
  dialogTitle,
  clinicalOnly = false,
}: {
  caption?: string | null;
  markdown?: string | null;
  rows?: string[][] | null;
  columns?: string[] | null;
  compact?: boolean;
  expandOnMobile?: boolean;
  dialogTitle?: string | null;
  clinicalOnly?: boolean;
}) {
  const dialogId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const canExpand = useMobileTableExpansion(expandOnMobile);
  const parsed = rows?.length ? rows : parseMarkdownTable(markdown);
  const normalized = useMemo(() => {
    if (!parsed?.length) return null;
    const table = normalizeAccessibleTable(parsed, columns);
    if (!table) return null;
    return clinicalOnly ? clinicalOnlyTable(table) : table;
  }, [clinicalOnly, columns, parsed]);

  const dialogOpen = open && canExpand;

  useEffect(() => {
    if (!dialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
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
  const table = (
    <AccessibleTableMarkup caption={displayCaption} header={header} body={body} compact={compact} />
  );

  function openDialog(trigger: HTMLElement) {
    if (!canExpand) return;
    restoreFocusRef.current = trigger;
    setOpen(true);
  }

  return (
    <>
      <div className="relative min-w-0">
        <div
          data-testid="accessible-table-surface"
          onClick={(event) => openDialog(event.currentTarget)}
          className={cn(
            "min-w-0",
            canExpand &&
              "cursor-zoom-in rounded-lg outline-none ring-offset-2 ring-offset-[color:var(--surface)] transition focus-within:ring-4 focus-within:ring-teal-300/20",
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
            className="absolute right-2 top-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-tight)] transition hover:border-[color:var(--border-strong)] focus:outline-none focus:ring-4 focus:ring-teal-300/25"
          >
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
                <h2 id={`${dialogId}-title`} className="truncate text-base font-semibold text-[color:var(--text-heading)]">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                aria-label="Close full-screen table"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] focus:outline-none focus:ring-4 focus:ring-teal-300/25"
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
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
