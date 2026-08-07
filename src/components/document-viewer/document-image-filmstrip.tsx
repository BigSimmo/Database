"use client";

import { cn, textMuted } from "@/components/ui-primitives";
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

        return (
          <button
            key={image.id}
            type="button"
            disabled={page === null}
aria-current={isActive ? "page" : undefined}
aria-label={page === null ? `${labelSeed} — page unknown` : `Show PDF page ${page} for ${labelSeed}`}
title={page === null ? "Page unknown" : `Go to page ${page}`}
            onClick={() => {
              if (page !== null) onSelectPage(page);
            }}
            className={cn(
              "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              "disabled:cursor-not-allowed disabled:opacity-45",
              isActive
                ? "border-[color:var(--clinical-accent)]/40 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <span className={cn("nums shrink-0", isActive ? undefined : textMuted)}>
              {page === null ? "—" : `p.${page}`}
            </span>
            <span className="max-w-[9rem] truncate">{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
