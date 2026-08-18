"use client";

import { cn, ignoreUnavailableActivation, textMuted } from "@/components/ui-primitives";
import type { ImageRow } from "@/components/document-viewer/types";

/**
 * Compact page-linked figure strip for the document rail.
 * Clicks call `onSelectPage` (wired to navigateToPage) — never remount the PDF viewer.
 * Does not fetch signed images; detailed SignedImage cards below keep deferred IO.
 */
export function DocumentImageFilmstrip({
  images,
  activePage,
  onSelectPage,
}: {
  images: ImageRow[];
  activePage: number;
  onSelectPage: (page: number) => void;
}) {
  if (images.length === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Jump PDF to figure page"
      data-testid="document-image-filmstrip"
      className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
    >
      {images.map((image, index) => {
        const page = typeof image.page_number === "number" && image.page_number >= 1 ? image.page_number : null;
        const isActive = page !== null && page === activePage;
        const labelSeed =
          [image.tableLabel, image.tableTitle, image.caption].find((value) => Boolean(value?.trim()))?.trim() ??
          image.image_type?.replaceAll("_", " ") ??
          `Figure ${index + 1}`;
        const shortLabel = labelSeed.length > 28 ? `${labelSeed.slice(0, 27)}…` : labelSeed;

        const pageUnavailableId = page === null ? `filmstrip-page-unknown-${image.id}` : undefined;

        return (
          <div key={image.id} className="contents">
            <button
              type="button"
              aria-disabled={page === null ? "true" : undefined}
              onClick={page === null ? ignoreUnavailableActivation : () => onSelectPage(page)}
              aria-current={isActive ? "page" : undefined}
              aria-label={page === null ? `${labelSeed} — page unknown` : `Show PDF page ${page} for ${labelSeed}`}
              aria-describedby={pageUnavailableId}
              title={page === null ? "Page unknown — this figure has no recorded page number" : `Go to page ${page}`}
              className={cn(
                "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                "aria-disabled:cursor-not-allowed aria-disabled:opacity-45 hover:not-aria-disabled:bg-[color:var(--surface-subtle)] hover:not-aria-disabled:text-[color:var(--text)]",
                isActive
                  ? "border-[color:var(--clinical-accent)]/40 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
              )}
            >
              <span className={cn("nums shrink-0", isActive ? undefined : textMuted)}>
                {page === null ? "—" : `p.${page}`}
              </span>
              <span className="max-w-[9rem] truncate">{shortLabel}</span>
            </button>
            {pageUnavailableId ? (
              <span id={pageUnavailableId} className="sr-only">
                This figure has no recorded page number, so it cannot be jumped to.
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
