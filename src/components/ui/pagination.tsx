"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui-primitives";

export type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Accessible name for the nav landmark. */
  label?: string;
  /** Optional "1–20 of 340 sources" line, rendered with tabular figures. */
  summary?: string;
  className?: string;
};

// Truncated window: first, last, and a three-wide band around the current page.
// `null` marks an elision, which renders as a non-interactive ellipsis rather
// than a disabled button — there is nothing to activate.
function pageWindow(page: number, pageCount: number): Array<number | null> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) out.push(null);
    out.push(value);
  });
  return out;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  label = "Pagination",
  summary,
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const items = pageWindow(page, pageCount);

  const step =
    "grid size-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:bg-[color:var(--surface-subtle)] disabled:text-[color:var(--disabled)] disabled:shadow-none";

  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      {summary ? <p className="nums text-xs text-[color:var(--text-muted)]">{summary}</p> : <span />}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={step}
        >
          <ChevronLeft aria-hidden="true" className="size-icon-md" />
        </button>
        {items.map((item, index) =>
          item === null ? (
            <span key={`gap-${index}`} aria-hidden className="px-1 text-xs text-[color:var(--text-muted)]">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              // `aria-current="page"` is what tells assistive technology which page
              // is showing; the visual fill alone says nothing.
              aria-current={item === page ? "page" : undefined}
              aria-label={`Page ${item}`}
              className={cn(
                "nums grid size-tap shrink-0 place-items-center rounded-lg px-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                item === page
                  ? "bg-[color:var(--command)] text-[color:var(--command-contrast)]"
                  : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
              )}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className={step}
        >
          <ChevronRight aria-hidden="true" className="size-icon-md" />
        </button>
      </div>
    </nav>
  );
}
