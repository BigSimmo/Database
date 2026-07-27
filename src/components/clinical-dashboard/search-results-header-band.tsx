"use client";

import { Bookmark, ChevronsUpDown, LayoutList, LoaderCircle, Search, Table2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { searchCommandSurfaceConfig } from "@/lib/search-command-surface";
import { cn } from "@/components/ui-primitives";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import type { AppModeId } from "@/lib/app-modes";
import { readResultSort, type ResultSortValue } from "@/lib/result-sort";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/** Sort is a two-state choice, so it reads as a segmented control rather than a
    select: a dropdown over two values makes you open a menu to learn nothing. */
const sortOptions: ReadonlyArray<{ value: ResultSortValue; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "alpha", label: "A–Z" },
];

/** Below `lg` the utility group is a swipe rail rather than a wrapping block, so a
    sixth control lands off the right edge instead of growing the band. Fade that
    edge only while it actually overflows — a permanent mask would dim the last
    control on the common case where everything fits. */
function useRailOverflow<Element extends HTMLElement>() {
  const ref = useRef<Element | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    setOverflowing(node.scrollWidth - node.clientWidth > 1);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of Array.from(node.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure]);

  return { ref, overflowing } as const;
}

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
  mobileControls,
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
  /** Compact page-specific controls shown in the utility row below `sm`. */
  mobileControls?: ReactNode;
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
  const hasUtilities =
    visibleScopes.length > 0 ||
    Boolean(onSortChange || onViewChange || onSaveSearch || utilityControls || mobileControls);
  const QueryHeading = headingLevel === 1 ? "h1" : "h2";
  const { ref: railRef, overflowing: railOverflowing } = useRailOverflow<HTMLDivElement>();

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
      <div className="flex min-w-0 flex-col lg:min-h-[3.75rem] lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-2.5 p-3 lg:gap-3 lg:px-4 lg:py-2.5 lg:pl-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] lg:h-10 lg:w-10">
            <Search className="h-4 w-4 lg:h-[1.125rem] lg:w-[1.125rem]" aria-hidden />
          </span>
          {/* No eyebrow: the icon already says "search", and the query is the only
              thing in this band set at heading weight. */}
          <QueryHeading
            className="min-w-0 truncate text-lg font-extrabold text-[color:var(--text-heading)] lg:max-w-[32rem]"
            title={displayQuery}
          >
            {displayQuery}
          </QueryHeading>
          <span className="h-4 w-px shrink-0 bg-[color:var(--border-strong)]" aria-hidden />
          {/* Neutral, not a success pill: a count is not a state that was achieved,
              and green has to keep meaning something where it does appear. */}
          <span
            className={cn(
              "shrink-0 whitespace-nowrap text-xs font-bold",
              loading ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-muted)]",
            )}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
                Searching…
              </span>
            ) : (
              <>
                <span className="font-extrabold tabular-nums text-[color:var(--text-heading)]">{matchCount}</span>{" "}
                {matchCount === 1 ? "match" : "matches"}
              </>
            )}
          </span>
        </div>

        {hasUtilities ? (
          <div
            ref={railRef}
            data-testid="search-query-ribbon-utilities"
            data-overflowing={railOverflowing ? "true" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-1.5 overflow-x-auto px-3 pb-3 lg:flex-1 lg:overflow-x-visible lg:px-0 lg:pb-0 lg:pr-3",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "data-[overflowing=true]:[mask-image:linear-gradient(to_right,#000_calc(100%-1.75rem),transparent)] lg:data-[overflowing=true]:[mask-image:none]",
            )}
          >
            {/* Scope reads as a removable chip beside the query — it is a constraint on
                the list, the same kind of thing the query is. */}
            {visibleScopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => command?.onRemoveScope(scope.id)}
                aria-label={`Remove ${scope.label} filter`}
                className={cn(
                  // Hover deepens the chip's own accent rather than swapping to the
                  // neutral border the surface controls use — an accent-soft chip
                  // going grey on hover reads as losing its active state.
                  "inline-flex min-h-tap shrink-0 max-w-[12rem] items-center gap-1 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-bold text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent-hover)] sm:min-h-10",
                  focusRing,
                )}
              >
                <span className="truncate">{scope.label}</span>
                <X className="h-3 w-3 shrink-0" aria-hidden />
              </button>
            ))}
            {/* Desktop only: pushes the controls to the trailing edge while the chips
                stay next to the query. On the phone rail this collapses away. */}
            <span className="hidden lg:block lg:flex-1" aria-hidden />
            {onSortChange && mobileControls ? (
              <div
                data-testid="search-query-ribbon-mobile-control-pair"
                className="flex min-w-0 shrink-0 items-center gap-1.5"
              >
                <ResultSortControl value={sortValue} onChange={onSortChange} />
                <div role="group" aria-label={filterLabel} className="min-w-0 sm:hidden">
                  {mobileControls}
                </div>
              </div>
            ) : (
              <>
                {onSortChange ? <ResultSortControl value={sortValue} onChange={onSortChange} /> : null}
                {mobileControls ? (
                  <div
                    data-testid="search-query-ribbon-mobile-controls"
                    role="group"
                    aria-label={filterLabel}
                    className="min-w-0 shrink-0 sm:hidden"
                  >
                    {mobileControls}
                  </div>
                ) : null}
              </>
            )}
            {utilityControls}
            {onViewChange ? (
              <div
                className="inline-flex min-h-tap shrink-0 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)] sm:min-h-10"
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
                  "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs font-extrabold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-10",
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
          className={cn(
            "min-w-0 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-2 sm:px-3",
            Boolean(mobileControls) && "hidden sm:block",
          )}
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
}: {
  value: ResultSortValue;
  onChange: (value: ResultSortValue) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Sort results"
      className={cn(
        "inline-flex min-h-tap shrink-0 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)] sm:min-h-10",
        className,
      )}
    >
      {sortOptions.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(readResultSort(option.value))}
            className={cn(
              "min-h-tap whitespace-nowrap px-3 text-xs font-bold sm:min-h-10",
              index > 0 && "border-l border-[color:var(--border)]",
              focusRing,
              selected
                ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function MobileResultFilterControl<Value extends string>({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  testId,
  className,
}: {
  label: string;
  ariaLabel: string;
  value: Value;
  options: ReadonlyArray<{ value: Value; label: string; disabled?: boolean }>;
  onChange: (value: Value) => void;
  testId?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex min-h-tap w-full min-w-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-2.5 pr-7 text-xs font-bold shadow-[var(--shadow-inset)]",
        "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]",
        className,
      )}
    >
      <span className="shrink-0 text-[color:var(--text-soft)] max-[359px]:sr-only">{label}</span>
      {/* Two things keep this readable. `truncate` ends a long option ("Current
          search", a service name) in an ellipsis instead of the mid-word cut it used
          to get. And the weight steps down to semibold because the size cannot: the
          unlayered iOS anti-zoom rule in globals.css pins every native select to 16px
          below `sm`, so weight and colour are the only hierarchy left against the
          18px query heading. */}
      <select
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
        aria-label={ariaLabel}
        className="h-tap min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent text-xs font-semibold text-[color:var(--text)] outline-none [-webkit-appearance:none]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
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
