"use client";

import { Bookmark, CheckCircle2, ChevronsUpDown, LayoutList, LoaderCircle, Search, Table2, X } from "lucide-react";
import type { ReactNode } from "react";

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
  utilityControls,
  filterControls,
  filterLabel = "Filter search results",
  headingLevel = 2,
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
  /** Page-specific actions that belong beside sort/view controls. */
  utilityControls?: ReactNode;
  /** Page-specific filters rendered as a full-width row within the shared ribbon. */
  filterControls?: ReactNode;
  filterLabel?: string;
  /** Use level 1 when the ribbon is the route's primary page heading. */
  headingLevel?: 1 | 2;
  className?: string;
}) {
  const command = useSearchCommand();
  const config = searchCommandSurfaceConfig(modeId);
  const activeScopes = command?.commandScopes ?? [];
  const visibleScopes = activeScopes.flatMap((scopeId) => {
    const scope = config?.scopes.find((entry) => entry.id === scopeId);
    return scope ? [scope] : [];
  });
  const displayQuery = query.trim() || "All";
  const statusLabel = loading ? "Searching…" : `${matchCount} ${matchCount === 1 ? "match" : "matches"}`;
  const hasUtilities =
    visibleScopes.length > 0 || Boolean(onSortChange || onViewChange || onSaveSearch || utilityControls);
  const QueryHeading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section
      aria-label={`Search results for ${displayQuery}`}
      aria-busy={loading}
      data-testid="search-query-ribbon"
      className={cn(
        "relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 bg-[color:var(--clinical-accent)] lg:inset-y-0 lg:left-0 lg:right-auto lg:h-auto lg:w-1",
          loading && "motion-safe:animate-pulse",
        )}
        aria-hidden
      />
      <div className="flex min-w-0 flex-col lg:min-h-[4.5rem] lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-start gap-2.5 p-3 pt-3.5 lg:flex-1 lg:items-center lg:gap-3 lg:px-4 lg:py-2.5 lg:pl-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] lg:h-10 lg:w-10">
            <Search className="h-4 w-4 lg:h-[1.125rem] lg:w-[1.125rem]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              <span className="lg:hidden">Query</span>
              <span className="hidden lg:inline">{loading ? "Searching for" : "Results for"}</span>
            </span>
            <QueryHeading
              className="mt-0.5 truncate text-base font-extrabold text-[color:var(--text-heading)] lg:max-w-[32rem] lg:text-lg"
              title={displayQuery}
            >
              {displayQuery}
            </QueryHeading>
          </span>
          <span
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold",
              loading
                ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "bg-[color:var(--success-bg)] text-[color:var(--success-text)]",
            )}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {loading ? (
              <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="max-[359px]:sr-only">{statusLabel}</span>
          </span>
        </div>

        {hasUtilities ? (
          <div
            data-testid="search-query-ribbon-utilities"
            className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2 lg:ml-auto lg:flex-nowrap lg:border-l lg:border-t-0 lg:bg-transparent lg:pl-3 lg:pr-3"
          >
            {visibleScopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => command?.onRemoveScope(scope.id)}
                aria-label={`Remove ${scope.label} filter`}
                className={cn(
                  "inline-flex min-h-tap max-w-full items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs font-bold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-10",
                  focusRing,
                )}
              >
                <span className="truncate">{scope.label}</span>
                <X className="h-3 w-3 shrink-0" aria-hidden />
              </button>
            ))}
            {onSortChange ? (
              <ResultSortControl
                value={sortValue}
                onChange={onSortChange}
                compact
                className="min-w-[8.5rem] flex-1 sm:flex-none"
              />
            ) : null}
            {utilityControls}
            {onViewChange ? (
              <div
                className="inline-flex min-h-tap overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)] sm:min-h-10"
                role="group"
                aria-label="Results view"
              >
                <button
                  type="button"
                  aria-pressed={view === "table"}
                  onClick={() => onViewChange("table")}
                  className={cn(
                    "grid min-h-tap min-w-tap place-items-center sm:min-h-10 sm:min-w-10",
                    focusRing,
                    view === "table"
                      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
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
                    "grid min-h-tap min-w-tap place-items-center border-l border-[color:var(--border)] sm:min-h-10 sm:min-w-10",
                    focusRing,
                    view === "list"
                      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
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
                  "inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs font-extrabold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-10",
                  focusRing,
                )}
              >
                <Bookmark className="h-3.5 w-3.5" aria-hidden />
                <span className="max-[389px]:sr-only">Save search</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {filterControls ? (
        <div
          data-testid="search-query-ribbon-filters"
          role="group"
          aria-label={filterLabel}
          className="min-w-0 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-2 sm:px-3"
        >
          {filterControls}
        </div>
      ) : null}
    </section>
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
        "relative inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1 pl-2.5 pr-7 text-xs font-bold shadow-[var(--shadow-inset)] sm:min-h-10",
        "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]",
        className,
      )}
    >
      <span className={cn("text-[color:var(--text-soft)]", compact && "max-[359px]:sr-only")}>Sort</span>
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
