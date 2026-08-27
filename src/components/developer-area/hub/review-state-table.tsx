"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { CARD_CLASS, META_CLASS, MONO_CLASS, ROW_CLASS } from "@/components/developer-area/hub/panel-primitives";
import type { ReviewRecord } from "@/lib/developer-area/repo-awareness-types";

const DISCLOSURE_CLASS =
  "min-h-12 cursor-pointer text-xs font-bold text-[color:var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const BUTTON_CLASS =
  "inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export function ReviewStateTable({
  records,
  defaultPageSize = 50,
}: {
  records: readonly ReviewRecord[];
  defaultPageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const pageSize = defaultPageSize;

  if (records.length === 0) {
    return (
      <p data-testid="developer-review-state-empty" className={META_CLASS}>
        No immutable review records are committed.
      </p>
    );
  }

  const totalRecords = records.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);
  const currentRecords = records.slice(startIndex, endIndex);

  return (
    <div className="grid gap-4" data-testid="developer-review-state-paginated">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[color:var(--text-muted)]">
        <p data-testid="developer-review-state-pagination-summary">
          Showing {startIndex + 1}–{endIndex} of {totalRecords} records (Page {currentPage} of {totalPages})
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-2" role="navigation" aria-label="Review records pagination">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className={BUTTON_CLASS}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </button>
            <span className="px-2 text-xs font-bold text-[color:var(--text-heading)]">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className={BUTTON_CLASS}
            >
              Next
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        )}
      </div>

      <ol data-testid="developer-review-state-records" className="grid gap-3">
        {currentRecords.map((record, index) => {
          const globalIndex = startIndex + index;
          return (
            <li
              key={`${record.date}-${record.ref}-${record.head}-${record.scope}-${globalIndex}`}
              className={CARD_CLASS}
            >
              <div className={ROW_CLASS}>
                <span className={META_CLASS}>{record.date}</span>
                <span className="text-sm font-bold text-[color:var(--text-heading)]">{record.ref}</span>
                <span className={MONO_CLASS}>{record.head}</span>
              </div>
              <p className={META_CLASS}>{record.scope}</p>
              <p className="text-sm leading-6 text-[color:var(--text-heading)]">{record.outcome}</p>
              <details>
                <summary className={DISCLOSURE_CLASS}>Checks run</summary>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{record.checks}</p>
              </details>
            </li>
          );
        })}
      </ol>

      {totalPages > 1 && (
        <div className="flex justify-end pt-2">
          <div className="flex items-center gap-2" role="navigation" aria-label="Review records pagination bottom">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className={BUTTON_CLASS}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </button>
            <span className="px-2 text-xs font-bold text-[color:var(--text-heading)]">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className={BUTTON_CLASS}
            >
              Next
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
