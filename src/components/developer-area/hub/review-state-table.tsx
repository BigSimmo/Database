"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { CARD_CLASS, META_CLASS, MONO_CLASS, ROW_CLASS } from "@/components/developer-area/hub/panel-primitives";
import type { ReviewRecord } from "@/lib/developer-area/repo-awareness-types";

export const REVIEW_STATE_PAGE_SIZE = 50;

const DISCLOSURE_CLASS =
  "min-h-12 cursor-pointer text-xs font-bold text-[color:var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const BUTTON_CLASS =
  "inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const DISABLED_BUTTON_CLASS =
  "inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-heading)] opacity-40";

/**
 * `records` here is already the current page's slice (~50 rows), sliced
 * server-side by `ReviewStatePageContent` — never the full committed
 * snapshot. Prev/Next are real `?page=N` navigation, not client state, so a
 * page load only ever pulls the one page of records across the RSC
 * boundary. See the PR #2449 review thread this replaced client-side
 * `.slice()`-after-the-fact pagination for.
 */
export function ReviewStateTable({
  records,
  page,
  totalPages,
  totalRecords,
  startIndex,
}: {
  records: readonly ReviewRecord[];
  page: number;
  totalPages: number;
  totalRecords: number;
  startIndex: number;
}) {
  if (totalRecords === 0) {
    return (
      <p data-testid="developer-review-state-empty" className={META_CLASS}>
        No immutable review records are committed.
      </p>
    );
  }

  const endIndex = startIndex + records.length;
  const previousHref = page > 1 ? `?page=${page - 1}` : null;
  const nextHref = page < totalPages ? `?page=${page + 1}` : null;

  const pager = (ariaLabel: string) => (
    <div className="flex items-center gap-2" role="navigation" aria-label={ariaLabel}>
      {previousHref ? (
        <Link href={previousHref} aria-label="Previous page" className={BUTTON_CLASS}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Previous
        </Link>
      ) : (
        <span aria-label="Previous page" aria-disabled="true" className={DISABLED_BUTTON_CLASS}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Previous
        </span>
      )}
      <span className="px-2 text-xs font-bold text-[color:var(--text-heading)]">
        {page} / {totalPages}
      </span>
      {nextHref ? (
        <Link href={nextHref} aria-label="Next page" className={BUTTON_CLASS}>
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <span aria-label="Next page" aria-disabled="true" className={DISABLED_BUTTON_CLASS}>
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </span>
      )}
    </div>
  );

  return (
    <div className="grid gap-4" data-testid="developer-review-state-paginated">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[color:var(--text-muted)]">
        <p data-testid="developer-review-state-pagination-summary">
          Showing {startIndex + 1}–{endIndex} of {totalRecords} records (Page {page} of {totalPages})
        </p>

        {totalPages > 1 && pager("Review records pagination")}
      </div>

      <ol data-testid="developer-review-state-records" className="grid gap-3">
        {records.map((record, index) => {
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

      {totalPages > 1 && <div className="flex justify-end pt-2">{pager("Review records pagination bottom")}</div>}
    </div>
  );
}
