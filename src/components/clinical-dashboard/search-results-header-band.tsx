"use client";

import { Bookmark, ChevronsUpDown, CircleAlert, LayoutList, LoaderCircle, Search, Table2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { searchCommandSurfaceConfig } from "@/lib/search-command-surface";
import { AsyncButton, cn } from "@/components/ui-primitives";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { appModeSearchConfig, type AppModeId } from "@/lib/app-modes";
import { readResultSort, type ResultSortValue } from "@/lib/result-sort";

/**
 * How far the count can be trusted. This is a union rather than a pair of
 * booleans because `loading && error` is otherwise representable and undefined,
 * and because the clinical invariant — a faulted search must never assert a
 * number — is then one guard instead of a boolean-precedence puzzle repeated at
 * every call site. It mirrors `RegistryRequestStatus` so most callers can pass a
 * near-identity map of the status they already hold.
 */
export type SearchResultsBandStatus =
  /** The count is trustworthy. `0` is a real answer. */
  | "ready"
  /** First load. There is no trustworthy prior count to show. */
  | "loading"
  /** Background refresh. The prior count is still trustworthy. */
  | "refetching"
  /** The search failed. The count is NOT trustworthy and must not be rendered. */
  | "error"
  /** Sign-in required. The count is NOT trustworthy and must not be rendered. */
  | "unauthorized";

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
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(node);
    for (const child of Array.from(node.children)) resizeObserver.observe(child);
    // Child add/remove (scope chips, utility controls) can change scrollWidth without
    // resizing the rail box; keep the fade mask honest when the child list mutates.
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            measure();
            for (const child of Array.from(node.children)) resizeObserver.observe(child);
          });
    mutationObserver?.observe(node, { childList: true });
    return () => {
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
    };
  }, [measure]);

  return { ref, overflowing } as const;
}

export function SearchResultsHeaderBand({
  modeId,
  query,
  matchCount,
  status,
  loading = false,
  faultTitle,
  faultBody,
  onRetry,
  faultAction,
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
  /** Result trustworthiness. Defaults to `ready`, or `loading` when the legacy
      `loading` prop is set. A faulted status never renders a number. */
  status?: SearchResultsBandStatus;
  /** @deprecated Pass `status="loading"`. Retained so the pages with no async
      source need no edit; ignored whenever `status` is supplied. */
  loading?: boolean;
  /** Fault panel heading. Defaults to mode-specific copy. */
  faultTitle?: string;
  /** Fault panel body. Defaults to mode-specific copy. */
  faultBody?: string;
  /** Renders an in-panel Retry through the shared busy contract. */
  onRetry?: () => void | Promise<void>;
  /** Replaces Retry when recovery is not a re-request (e.g. a sign-in link). */
  faultAction?: ReactNode;
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
  // `status` wins when both are passed; `loading` is the deprecated shim.
  const resolvedStatus: SearchResultsBandStatus = status ?? (loading ? "loading" : "ready");
  // The clinical invariant, expressed once: a search that failed has no count to
  // report, so no number may reach the DOM. "0 matches" on a failed services
  // search reads as "there are no crisis services" rather than "we could not check".
  const faulted = resolvedStatus === "error" || resolvedStatus === "unauthorized";
  const busy = resolvedStatus === "loading" || resolvedStatus === "refetching";
  // "Service matches" -> "Services", leaving already-plural headings ("Favourites",
  // "DSM diagnoses") untouched. Phrasing the title as "<noun> could not be loaded"
  // rather than "Could not load <noun>" avoids having to lower-case the leading
  // word, which would mangle the acronym in "DSM diagnoses".
  const searchConfig = appModeSearchConfig(modeId);
  const resultNoun = searchConfig?.resultHeading?.replace(/ matches$/i, "s") ?? "Results";
  const resolvedFaultTitle =
    faultTitle ?? (resolvedStatus === "unauthorized" ? "Sign in to continue" : `${resultNoun} could not be loaded`);
  const resolvedFaultBody =
    faultBody ??
    (resolvedStatus === "unauthorized"
      ? "Your session has expired. Sign in again to run this search."
      : "The search could not be completed. Try again shortly.");
  const [retrying, setRetrying] = useState(false);
  const hasUtilities =
    visibleScopes.length > 0 ||
    Boolean(onSortChange || onViewChange || onSaveSearch || utilityControls || mobileControls);
  const QueryHeading = headingLevel === 1 ? "h1" : "h2";
  const { ref: railRef, overflowing: railOverflowing } = useRailOverflow<HTMLDivElement>();

  return (
    <section
      aria-label={`Search results for ${displayQuery}`}
      aria-busy={busy}
      data-status={resolvedStatus}
      data-testid="search-query-ribbon"
      className={cn(
        // `search-band` carries the accent as a real border-top; there is no
        // overlay bar to be clipped by the corner arc any more.
        "search-band relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col sm:min-h-[3.75rem] sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2.5 p-3 sm:gap-3 sm:px-4 sm:py-2.5 sm:pl-5">
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10",
              faulted
                ? "bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
                : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
            )}
          >
            {faulted ? (
              <CircleAlert className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" aria-hidden />
            ) : (
              <Search className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" aria-hidden />
            )}
          </span>
          {/* No eyebrow: the icon already says "search", and the query is the only
              thing in this band set at heading weight. */}
          <QueryHeading
            className="search-band-query min-w-0 truncate text-[color:var(--text-heading)] lg:max-w-[32rem]"
            title={displayQuery}
          >
            {displayQuery}
          </QueryHeading>
          <span className="search-band-rule mx-0.5 h-[0.9375rem] w-px shrink-0" aria-hidden />
          {/* Neutral, not a success pill: a count is not a state that was achieved,
              and green has to keep meaning something where it does appear. */}
          {/* One unconditional `role="status"` in every state. Playwright asserts it
              is visible on every search route, so it must never be swapped out or
              wrapped in a state branch. While faulted the live region is silenced
              (`aria-live="off"`) and the freshly-mounted fault `role="alert"` below
              makes the single announcement, rather than both speaking. */}
          <span
            className={cn(
              "shrink-0 whitespace-nowrap",
              faulted ? "search-band-fault" : "search-band-count-word",
              busy && "text-[color:var(--clinical-accent)]",
              faulted && "text-[color:var(--warning)]",
              !busy && !faulted && "text-[color:var(--text-muted)]",
            )}
            role="status"
            aria-live={faulted ? "off" : "polite"}
            aria-atomic="true"
          >
            {resolvedStatus === "loading" ? (
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
                Searching…
              </span>
            ) : resolvedStatus === "error" ? (
              "Couldn’t search"
            ) : resolvedStatus === "unauthorized" ? (
              "Sign in to search"
            ) : (
              // `refetching` keeps text content identical to `ready` so the atomic
              // live region does not re-announce an unchanged count; the dot is
              // decorative and the dimming is CSS via `data-status`.
              <span className="inline-flex items-center gap-1.5">
                {resolvedStatus === "refetching" ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--clinical-accent)] motion-safe:animate-pulse"
                    aria-hidden
                  />
                ) : null}
                <span>
                  <span
                    className="search-band-count text-[color:var(--text-heading)]"
                    data-zero={matchCount === 0 ? "true" : undefined}
                  >
                    {matchCount}
                  </span>{" "}
                  {matchCount === 1 ? "match" : "matches"}
                </span>
              </span>
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
                data-selected="true"
                className={cn(
                  // Hover deepens the chip's own accent rather than swapping to the
                  // neutral border the surface controls use — an accent-soft chip
                  // going grey on hover reads as losing its active state.
                  "inline-flex min-h-tap shrink-0 max-w-[12rem] items-center gap-1 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-[color:var(--clinical-accent)] search-band-chip hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent-hover)] sm:min-h-10",
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
                  "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-[color:var(--text-muted)] search-band-ghost shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-10",
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
      {/* The fault panel carries the announcement and the recovery affordance.
          `role="alert"` is a distinct role from the spine's `role="status"`, so
          singular role queries in jsdom and Playwright still resolve to exactly
          one node each. */}
      {faulted ? (
        <div
          role="alert"
          data-testid="search-query-ribbon-fault"
          className="search-band-fault-panel border-t border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-3 text-center sm:px-4"
        >
          <p className="search-band-fault text-[color:var(--warning)]">{resolvedFaultTitle}</p>
          <p className="search-band-count-word mt-0.5 text-[color:var(--warning)]">{resolvedFaultBody}</p>
          {onRetry || faultAction ? (
            <div className="mt-2.5 flex justify-center gap-2">
              {onRetry ? (
                <AsyncButton
                  type="button"
                  busy={retrying}
                  busyLabel="Retrying…"
                  onClick={async () => {
                    setRetrying(true);
                    try {
                      await onRetry();
                    } finally {
                      setRetrying(false);
                    }
                  }}
                  className={cn(
                    "inline-flex min-h-tap shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-[color:var(--text-muted)] search-band-ghost hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-10",
                    focusRing,
                  )}
                >
                  Retry
                </AsyncButton>
              ) : null}
              {faultAction}
            </div>
          ) : null}
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
              "search-band-sort-option min-h-tap whitespace-nowrap px-3 sm:min-h-10",
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
