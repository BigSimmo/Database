"use client";

import { Bookmark, ChevronsUpDown, LayoutList, Search, Table2, X } from "lucide-react";

import { searchCommandSurfaceConfig } from "@/lib/search-command-surface";
import { cn } from "@/components/ui-primitives";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import type { AppModeId } from "@/lib/app-modes";
import { readResultSort, type ResultSortValue } from "@/lib/result-sort";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export function SearchResultsHeaderBand({
  modeId,
  query,
  matchCount,
  loading = false,
  view = "table",
  onViewChange,
  sortValue = "relevance",
  onSortChange,
  onSaveSearch,
  className,
}: {
  modeId: AppModeId;
  query: string;
  matchCount: number;
  loading?: boolean;
  view?: "table" | "list";
  onViewChange?: (view: "table" | "list") => void;
  sortValue?: ResultSortValue;
  onSortChange?: (value: ResultSortValue) => void;
  onSaveSearch?: () => void;
  className?: string;
}) {
  const command = useSearchCommand();
  const config = searchCommandSurfaceConfig(modeId);
  const activeScopes = command?.commandScopes ?? [];
  const displayQuery = query.trim() || "All";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 shadow-[var(--shadow-inset)]",
        className,
      )}
    >
      <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-bold text-[color:var(--clinical-accent)]">
        <Search className="h-3 w-3" aria-hidden />
        {displayQuery}
      </span>
      <span className="text-sm font-extrabold text-[color:var(--text-heading)]">
        {loading ? "Searching…" : `${matchCount} ${matchCount === 1 ? "match" : "matches"}`}
      </span>
      {activeScopes.map((scopeId) => {
        const scope = config?.scopes.find((entry) => entry.id === scopeId);
        if (!scope) return null;
        return (
          <button
            key={scope.id}
            type="button"
            onClick={() => command?.onRemoveScope(scope.id)}
            className={cn(
              "inline-flex min-h-8 items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 text-xs font-bold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]",
              focusRing,
            )}
          >
            {scope.label}
            <X className="h-3 w-3" aria-hidden />
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-1.5">
        {onSortChange ? <ResultSortControl value={sortValue} onChange={onSortChange} /> : null}
        {onViewChange ? (
          <div
            className="inline-flex overflow-hidden rounded-lg border border-[color:var(--border)]"
            role="group"
            aria-label="Results view"
          >
            <button
              type="button"
              aria-pressed={view === "table"}
              onClick={() => onViewChange("table")}
              className={cn(
                "grid h-9 w-9 place-items-center",
                focusRing,
                view === "table"
                  ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "text-[color:var(--text-muted)]",
              )}
            >
              <Table2 className="h-4 w-4" aria-hidden />
              <span className="sr-only">Table view</span>
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => onViewChange("list")}
              className={cn(
                "grid h-9 w-9 place-items-center border-l border-[color:var(--border)]",
                focusRing,
                view === "list"
                  ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "text-[color:var(--text-muted)]",
              )}
            >
              <LayoutList className="h-4 w-4" aria-hidden />
              <span className="sr-only">List view</span>
            </button>
          </div>
        ) : null}
        {onSaveSearch ? (
          <button
            type="button"
            onClick={onSaveSearch}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-2.5 text-xs font-extrabold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
              focusRing,
            )}
          >
            <Bookmark className="h-3.5 w-3.5" aria-hidden />
            Save search
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ResultSortControl({
  value,
  onChange,
  className,
  compact = false,
}: {
  value: ResultSortValue;
  onChange: (value: ResultSortValue) => void;
  className?: string;
  /** Hide the visual "Sort" label on narrow viewports; the select keeps its accessible name. */
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1 pl-2.5 pr-7 text-xs font-bold",
        "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]",
        className,
      )}
    >
      <span className={cn("text-[color:var(--text-soft)]", compact && "sr-only sm:not-sr-only sm:inline")}>Sort</span>
      {/* appearance-none strips the native control chrome so "Relevance" renders at the
          same size/weight as the rest of the band and the caret sits in a fixed slot. */}
      <select
        value={value}
        onChange={(event) => onChange(readResultSort(event.target.value))}
        className="cursor-pointer appearance-none bg-transparent text-xs font-bold text-[color:var(--text)] outline-none [-webkit-appearance:none]"
        aria-label="Sort results"
      >
        <option value="relevance">Relevance</option>
        <option value="alpha">A–Z</option>
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-2 size-icon-sm text-[color:var(--text-soft)]"
        aria-hidden
      />
    </label>
  );
}

export function SearchResultsEmptyState({
  modeId,
  query,
  onClearScopes,
  onTryExample,
  onCrossMode,
  canAccessFavourites = false,
}: {
  modeId: AppModeId;
  query: string;
  onClearScopes?: () => void;
  onTryExample?: (example: string) => void;
  onCrossMode?: (modeId: AppModeId) => void;
  canAccessFavourites?: boolean;
}) {
  const command = useSearchCommand();
  const config = searchCommandSurfaceConfig(modeId);
  const crossModes = (config?.crossModes ?? []).filter((target) => canAccessFavourites || target !== "favourites");
  const activeScopes = command?.commandScopes ?? [];

  return (
    <div className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-5 text-center shadow-[var(--shadow-inset)]">
      <span className="mx-auto grid h-tap w-tap place-items-center rounded-full bg-[color:var(--surface)] text-[color:var(--text-muted)]">
        <Search className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-extrabold text-[color:var(--text-heading)]">
        No matches for &ldquo;{query.trim() || "your search"}&rdquo;
      </p>
      <p className="mt-1 text-xs font-medium text-[color:var(--text-muted)]">
        Relax the scope, try an example, or jump to another mode.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {activeScopes.length > 0 && onClearScopes ? (
          <button
            type="button"
            onClick={onClearScopes}
            className={cn(
              "inline-flex min-h-9 items-center gap-1 rounded-lg border border-[color:var(--clinical-accent-border)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent)]",
              focusRing,
            )}
          >
            Clear scope filters ({activeScopes.length})
          </button>
        ) : null}
        {config?.examples[0] && onTryExample ? (
          <button
            type="button"
            onClick={() => onTryExample(config.examples[0])}
            className={cn(
              "inline-flex min-h-9 items-center rounded-lg border border-[color:var(--border)] px-3 text-xs font-extrabold text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
              focusRing,
            )}
          >
            Try: {config.examples[0]}
          </button>
        ) : null}
        {crossModes.slice(0, 2).map((target) =>
          onCrossMode ? (
            <button
              key={target}
              type="button"
              onClick={() => onCrossMode(target)}
              className={cn(
                "inline-flex min-h-9 items-center rounded-lg border border-[color:var(--border)] px-3 text-xs font-extrabold text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                focusRing,
              )}
            >
              Search in {target}
            </button>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function SearchResultsSkeleton() {
  return (
    <div
      className="divide-y divide-[color:var(--border)] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
      role="status"
      aria-label="Loading results"
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3" aria-hidden>
          <span className="h-9 w-9 rounded-lg bg-[color:var(--surface-subtle)]" />
          <span className="space-y-1.5">
            <span className="block h-3.5 w-2/3 rounded-md bg-[color:var(--surface-subtle)]" />
            <span className="block h-3 w-1/3 rounded-md bg-[color:var(--surface-subtle)]" />
          </span>
          <span className="h-6 w-14 rounded-md bg-[color:var(--surface-subtle)]" />
        </div>
      ))}
      <span className="sr-only">Loading results</span>
    </div>
  );
}
