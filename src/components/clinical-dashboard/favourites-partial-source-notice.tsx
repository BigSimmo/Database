"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";

import type { SavedFavouritesPartialStatus } from "@/components/clinical-dashboard/saved-registry-favourites-status";

export function FavouritesPartialSourceNotice({
  status,
  onRetry,
}: {
  status: SavedFavouritesPartialStatus | null;
  onRetry: () => void;
}) {
  if (!status) return null;

  const loading = status === "loading";
  const message = loading
    ? "Some saved sources are still loading. Shown counts include only favourites loaded so far."
    : status === "unauthorized"
      ? "Some saved sources require you to sign in again. Shown counts include only favourites loaded so far."
      : "Some saved sources could not be loaded. Shown counts include only favourites loaded so far.";

  return (
    <div
      role={loading ? "status" : "alert"}
      data-testid="favourites-partial-source-notice"
      className="flex flex-col gap-3 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--text)] sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex min-w-0 items-start gap-2">
        {loading ? (
          <LoaderCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)] motion-safe:animate-spin"
            aria-hidden
          />
        ) : (
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" aria-hidden />
        )}
        <span>{message}</span>
      </span>
      {status === "error" ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-12 shrink-0 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--surface)] px-3 font-bold text-[color:var(--text-heading)] transition hover:bg-[color:var(--surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          Retry unavailable sources
        </button>
      ) : null}
    </div>
  );
}
