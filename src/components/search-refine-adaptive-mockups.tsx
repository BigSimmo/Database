"use client";

import { useCallback, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ListFilter, LoaderCircle, Plus, X } from "lucide-react";

import { cn } from "@/components/ui-primitives";

/**
 * Perfected "Adaptive" refine bar — the selected direction for the shared search
 * results header (`SearchResultsHeaderBand`).
 *
 * The idea in one line: split the band by STABILITY, not by kind. Row one holds
 * what is always present and must never move (the count, and the controls that
 * act on the result set). Row two holds only the active filter chips — and does
 * not exist when there are none, so the common unfiltered search is a single
 * line.
 *
 * Deliberate departures from the shipped band, all settled in design review:
 *   - No query echo. The composer already shows the query with its own clear
 *     button, so repeating it here spent a heading rank and ~90px of width on
 *     information already on screen. Removing it is also what lets row two
 *     disappear, since the row becomes purely filters.
 *   - No source-composition prose ("across 4 documents · 2 images") and no
 *     corpus size while searching. Both were the reason the summary row existed;
 *     without them the row had nothing to do, so it is gone.
 *   - No accent border, no magnifier tile, no gradient pipe rule, no
 *     display-weight query, no doubled count.
 *   - One control species at one height, and one label vocabulary
 *     (`label + value + count`) replacing Show / Filter / Pattern / Domain.
 *
 * Sizing note: this study renders a phone frame inside a wide page, so viewport
 * `sm:` variants would resolve against the page rather than the frame. Every
 * component here takes an explicit `compact` flag instead — `compact` mirrors
 * the band's `min-h-tap` (44px) phone floor, and the wide variant mirrors its
 * `sm:min-h-10` (40px).
 */

type BandState = "ready" | "searching" | "zero" | "error";
type FilterId = "type" | "relevance" | "revised";
type SortValue = "relevance" | "alpha";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const bandStates: ReadonlyArray<{ value: BandState; label: string }> = [
  { value: "ready", label: "Results" },
  { value: "searching", label: "Searching" },
  { value: "zero", label: "No matches" },
  { value: "error", label: "Failed" },
];

const availableFilters: ReadonlyArray<{ id: FilterId; label: string; value: string; count: number }> = [
  { id: "type", label: "Type", value: "PDF", count: 4 },
  { id: "relevance", label: "Relevance", value: "High", count: 3 },
  { id: "revised", label: "Revised", value: "2024–25", count: 2 },
];

/** Unfiltered total, then the narrowed total per applied-filter count. */
const narrowedCounts = [6, 4, 2, 1] as const;

const sortLabels: Record<SortValue, string> = {
  relevance: "Relevance",
  alpha: "A–Z",
};

function countFor(state: BandState, appliedCount: number): number {
  if (state === "zero") {
    return 0;
  }
  return narrowedCounts[Math.min(appliedCount, narrowedCounts.length - 1)];
}

/* ------------------------------------------------------------------------- */
/* Band primitives                                                            */
/* ------------------------------------------------------------------------- */

function ControlChip({
  compact,
  ghost,
  selected,
  className,
  children,
  ...rest
}: {
  compact?: boolean;
  ghost?: boolean;
  selected?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-2xs font-semibold whitespace-nowrap",
        compact ? "min-h-tap" : "min-h-10",
        focusRing,
        selected
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] font-bold text-[color:var(--clinical-accent)]"
          : ghost
            ? "border-dashed border-[color:var(--border-strong)] bg-transparent text-[color:var(--text-soft)] hover:border-solid hover:text-[color:var(--text)]"
            : "border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--text-soft)] hover:text-[color:var(--text)]",
        "disabled:pointer-events-none disabled:opacity-55",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function ToolButton({
  compact,
  className,
  children,
  ...rest
}: {
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 text-2xs font-semibold whitespace-nowrap text-[color:var(--text-muted)]",
        compact ? "min-h-tap" : "min-h-10",
        focusRing,
        "hover:bg-[color:var(--surface-inset)] hover:text-[color:var(--text)]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Metadata count inside a chip or tool — mono so it never reflows. */
function Tally({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-3xs font-bold tabular-nums opacity-75 [font-feature-settings:'tnum'_1]">
      {children}
    </span>
  );
}

function ResultCount({
  state,
  compact,
  matchCount,
  total,
  showDelta,
}: {
  state: BandState;
  compact?: boolean;
  matchCount: number;
  total: number;
  showDelta: boolean;
}) {
  const quiet = state === "searching" || state === "zero";

  return (
    <span className="flex min-w-0 shrink-0 items-baseline gap-1.5">
      {/* The live region is the count alone. Wrapping the controls too would let
          a screen reader re-announce chrome on every refetch.

          A failure escalates the same region to an assertive alert rather than
          silencing it. The shipped band sets aria-live="off" when faulted, which
          means a search that fails while focus is elsewhere is never announced —
          the user is left waiting on a result that is not coming, and never
          learns Retry appeared. Failure is the one transition that must always
          reach the user, so it is the one that must not be muted. */}
      <span
        role={state === "error" ? "alert" : "status"}
        aria-live={state === "error" ? "assertive" : "polite"}
        aria-atomic="true"
        className={cn(
          "whitespace-nowrap tracking-[-0.02em]",
          compact ? "text-base-minus" : "text-lg-minus",
          state === "error"
            ? "font-semibold text-[color:var(--warning)]"
            : quiet
              ? "font-medium text-[color:var(--text-muted)]"
              : "font-semibold text-[color:var(--text-heading)]",
        )}
      >
        {state === "searching" ? (
          <span className="inline-flex items-center gap-1.5">
            <LoaderCircle className="size-icon-sm motion-safe:animate-spin" aria-hidden />
            Searching…
          </span>
        ) : state === "error" ? (
          "Couldn’t search"
        ) : matchCount === 0 ? (
          "No matches"
        ) : (
          <>
            <span className="font-mono font-bold tracking-[-0.03em] tabular-nums [font-feature-settings:'tnum'_1]">
              {matchCount}
            </span>{" "}
            matches
          </>
        )}
      </span>
      {/* An applied filter shows what it cost you, without naming any sources. */}
      {showDelta ? (
        <span className="font-mono text-2xs font-semibold whitespace-nowrap tabular-nums text-[color:var(--text-soft)]">
          of {total}
        </span>
      ) : null}
    </span>
  );
}

function AdaptiveRefineBar({
  state,
  compact = false,
  applied,
  sort,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
  onToggleSort,
  onOpenSources,
  onRetry,
}: {
  state: BandState;
  compact?: boolean;
  applied: ReadonlyArray<FilterId>;
  sort: SortValue;
  onAddFilter: () => void;
  onRemoveFilter: (id: FilterId) => void;
  onClearFilters: () => void;
  onToggleSort: () => void;
  onOpenSources: () => void;
  onRetry: () => void;
}) {
  const appliedFilters = useMemo(() => availableFilters.filter((filter) => applied.includes(filter.id)), [applied]);
  const total = narrowedCounts[0];
  const matchCount = countFor(state, applied.length);
  const interactive = state === "ready" || state === "zero";
  const showFilterRow = interactive && appliedFilters.length > 0;
  const allFiltersApplied = applied.length === availableFilters.length;

  return (
    <div className="flex flex-col border-b border-[color:var(--border-strong)]">
      {/* Row one — always present, never scrolls, never changes shape. */}
      <div className={cn("flex min-w-0 items-center gap-2", compact ? "min-h-tap" : "min-h-10")}>
        <ResultCount
          state={state}
          compact={compact}
          matchCount={matchCount}
          total={total}
          showDelta={interactive && appliedFilters.length > 0}
        />

        <span className="flex-1" aria-hidden />

        {interactive ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {/* Wide: sort and filtering are separate, both labelled.
                Compact: they fuse into one Refine control that opens the sheet
                already used on phones, because three labelled controls do not
                fit beside the count at 390px. Sources stays reachable at both
                widths — dropping it on phone would be a regression against the
                shipped band, which shows it there today. */}
            {compact ? (
              <ControlChip compact={compact} onClick={onAddFilter} selected={appliedFilters.length > 0}>
                <ListFilter className="size-icon-md" aria-hidden />
                Refine
                {appliedFilters.length > 0 ? <Tally>{appliedFilters.length}</Tally> : null}
              </ControlChip>
            ) : (
              <>
                <ControlChip
                  compact={compact}
                  ghost
                  onClick={onAddFilter}
                  disabled={allFiltersApplied}
                  title={allFiltersApplied ? "Every filter in this study is applied — coming soon" : undefined}
                >
                  <Plus className="size-icon-sm" aria-hidden />
                  Add filter
                </ControlChip>
                <span className="mx-1 h-5 w-px shrink-0 bg-[color:var(--border-strong)]" aria-hidden />
                <ToolButton
                  compact={compact}
                  onClick={onToggleSort}
                  aria-label={`Sort: ${sortLabels[sort]}. Change sort`}
                >
                  <span className="font-medium text-[color:var(--text-soft)]">Sort</span>
                  {sortLabels[sort]}
                  <ChevronDown className="size-icon-sm" aria-hidden />
                </ToolButton>
              </>
            )}
            <ToolButton
              compact={compact}
              onClick={onOpenSources}
              aria-label={compact ? "Sources, 12 available" : undefined}
            >
              <BookOpen className="size-icon-md" aria-hidden />
              {compact ? null : "Sources"} <Tally>12</Tally>
            </ToolButton>
          </div>
        ) : null}

        {state === "searching" ? (
          <span
            className={cn("shrink-0 rounded-md bg-[color:var(--surface-inset)]", compact ? "min-h-tap" : "min-h-10")}
            style={{ width: compact ? "5rem" : "11rem" }}
            aria-hidden
          />
        ) : null}

        {state === "error" ? (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "inline-flex shrink-0 items-center rounded-md border border-[color:var(--warning-border)] bg-[color:var(--surface)] px-3 text-2xs font-bold text-[color:var(--warning)]",
              compact ? "min-h-tap" : "min-h-10",
              focusRing,
            )}
          >
            Retry
          </button>
        ) : null}
      </div>

      {/* A filtered-to-nothing search must never look like an empty index, and
          must offer the one-tap way out. */}
      {state === "zero" && appliedFilters.length > 0 ? (
        <p className="pb-1.5 text-2xs text-[color:var(--text-muted)]">
          <button
            type="button"
            onClick={onClearFilters}
            className={cn(
              "font-bold text-[color:var(--clinical-accent)] underline underline-offset-2",
              focusRing,
              "rounded-xs",
            )}
          >
            {appliedFilters.length === 1 ? "Clear the filter" : `Clear all ${appliedFilters.length} filters`}
          </button>{" "}
          to see {total}.
        </p>
      ) : null}

      {/* Row two — exists only when the user has actually narrowed something. */}
      {showFilterRow ? (
        <div className="min-w-0 pb-1 motion-safe:animate-fade-up">
          <div
            className={cn(
              "flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              compact && "[mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)]",
            )}
          >
            {appliedFilters.map((filter) => (
              <span
                key={filter.id}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] pr-1 pl-2.5 text-2xs font-bold text-[color:var(--clinical-accent)]",
                  compact ? "min-h-tap" : "min-h-10",
                )}
              >
                <span className="font-medium opacity-75">{filter.label}</span>
                {filter.value}
                <Tally>{filter.count}</Tally>
                <button
                  type="button"
                  onClick={() => onRemoveFilter(filter.id)}
                  aria-label={`Remove ${filter.label} filter`}
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-xs opacity-70 hover:bg-[color:var(--clinical-accent)]/15 hover:opacity-100",
                    focusRing,
                  )}
                >
                  <X className="size-icon-sm" aria-hidden />
                </button>
              </span>
            ))}
            {appliedFilters.length > 1 ? (
              <button
                type="button"
                onClick={onClearFilters}
                className={cn(
                  "shrink-0 px-1.5 text-2xs font-semibold text-[color:var(--text-soft)] underline underline-offset-2 hover:text-[color:var(--text)]",
                  compact ? "min-h-tap" : "min-h-10",
                  focusRing,
                  "rounded-xs",
                )}
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Study frame                                                                */
/* ------------------------------------------------------------------------- */

function PreviewFrame({
  label,
  phone = false,
  action,
  children,
}: {
  label: string;
  phone?: boolean;
  action: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", phone && "mx-auto w-full max-w-[23.75rem]")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold tracking-[0.12em] uppercase text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{phone ? "390 px" : "1440 px"}</span>
      </div>
      <div
        className={cn(
          "overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-inset)]",
          phone ? "p-2.5" : "p-4",
        )}
      >
        <div className={cn(!phone && "min-w-[44rem]")}>
          {children}
          <div className={cn("mt-3 grid gap-2", phone ? "grid-cols-1" : "grid-cols-[1.35fr_1fr]")}>
            <span className="h-16 rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/55" />
            {!phone ? (
              <span className="h-16 rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/55" />
            ) : null}
          </div>
        </div>
      </div>
      <p className="mt-2 min-h-5 font-mono text-3xs text-[color:var(--text-soft)]">{action ? `→ ${action}` : " "}</p>
    </div>
  );
}

const anatomy: ReadonlyArray<{ term: string; detail: string }> = [
  {
    term: "Row one is fixed",
    detail:
      "Count on the left, controls on the right, one 44px (phone) / 40px (desktop) height, never inside a scroll container. Chips cannot push Sort or Sources off screen — the defect that ruled out the original stacked layout.",
  },
  {
    term: "Row two is conditional",
    detail:
      "Rendered only when at least one filter is applied. Unfiltered — most searches — the band is a single line. Remove the last chip and the row unmounts.",
  },
  {
    term: "The count is one size, in mono",
    detail:
      "No 19.5px/13px jump mid-phrase. Tabular figures mean the row does not reflow as the number moves between 6, 12 and 1,204, so nothing shifts under a thumb while results settle.",
  },
  {
    term: "“of 6” is the filter’s receipt",
    detail:
      "Four characters that turn a bare number into a comparison, and make an over-narrow filter self-evident without naming a single source.",
  },
  {
    term: "Zero names the constraint",
    detail:
      "A filtered-to-nothing search offers “Clear the filter to see 6” rather than looking identical to an empty index. Failure is distinct again from emptiness.",
  },
  {
    term: "Phone fuses sort into Refine",
    detail:
      "Three labelled controls do not fit beside the count at 390px, so sort and filtering become one Refine control opening the sheet phones already use. Sources keeps its place at both widths — dropping it on phone would regress against the shipped band. The cost: the current sort value is not visible at rest on phone.",
  },
  {
    term: "One live region",
    detail:
      "aria-live wraps the count only, not the whole status span, so a refetch does not re-announce the controls.",
  },
];

export function SearchRefineAdaptiveMockupsPage() {
  const [state, setState] = useState<BandState>("ready");
  const [applied, setApplied] = useState<ReadonlyArray<FilterId>>([]);
  const [sort, setSort] = useState<SortValue>("relevance");
  const [action, setAction] = useState<string | null>(null);

  const addFilter = useCallback(() => {
    setApplied((current) => {
      const next = availableFilters.find((filter) => !current.includes(filter.id));
      if (!next) {
        return current;
      }
      setAction(`Applied ${next.label} · ${next.value}`);
      return [...current, next.id];
    });
  }, []);

  const removeFilter = useCallback((id: FilterId) => {
    setApplied((current) => current.filter((filterId) => filterId !== id));
    const removed = availableFilters.find((filter) => filter.id === id);
    setAction(removed ? `Removed ${removed.label} filter` : "Removed filter");
  }, []);

  const clearFilters = useCallback(() => {
    setApplied([]);
    setAction("Cleared all filters");
  }, []);

  const toggleSort = useCallback(() => {
    setSort((current) => {
      const next: SortValue = current === "relevance" ? "alpha" : "relevance";
      setAction(`Sorted by ${sortLabels[next]}`);
      return next;
    });
  }, []);

  const openSources = useCallback(() => {
    setAction("Opened the source library");
  }, []);

  const retry = useCallback(() => {
    setState("ready");
    setAction("Retried the search");
  }, []);

  const bandProps = {
    state,
    applied,
    sort,
    onAddFilter: addFilter,
    onRemoveFilter: removeFilter,
    onClearFilters: clearFilters,
    onToggleSort: toggleSort,
    onOpenSources: openSources,
    onRetry: retry,
  } as const;

  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold tracking-[0.14em] uppercase text-[color:var(--clinical-accent)]">
                Global search · results header
              </p>
              <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
                Adaptive refine bar
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 font-medium text-[color:var(--text-muted)] sm:text-base">
                One row when nothing is filtered, two when something is. The filter row is not hidden — it does not
                exist until you narrow something. Add and remove filters below and watch the band change height; every
                control is live.
              </p>
            </div>
            <div
              className="inline-flex w-fit rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1"
              role="group"
              aria-label="Preview result state"
            >
              {bandStates.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={state === option.value}
                  onClick={() => {
                    setState(option.value);
                    setAction(null);
                  }}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold transition-colors",
                    focusRing,
                    state === option.value
                      ? "bg-[color:var(--surface)] text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
                      : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="adaptive-specimen"
          className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
        >
          <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <h2 id="adaptive-specimen" className="text-lg font-extrabold text-[color:var(--text-heading)]">
                Live specimen
              </h2>
              <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
                Both frames share one state, so a filter added on desktop appears on the phone too.{" "}
                {applied.length === 0
                  ? "No filters applied — the band is a single row."
                  : `${applied.length} ${applied.length === 1 ? "filter" : "filters"} applied — the second row is present.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 lg:justify-end">
              {["Single row unfiltered", "Actions outside the scroll", "No query echo"].map((strength) => (
                <span
                  key={strength}
                  className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-bold text-[color:var(--text-muted)]"
                >
                  {strength}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)]">
            <PreviewFrame label="Desktop" action={action}>
              <AdaptiveRefineBar {...bandProps} />
            </PreviewFrame>
            <PreviewFrame label="Phone" phone action={action}>
              <AdaptiveRefineBar {...bandProps} compact />
            </PreviewFrame>
          </div>
        </section>

        <section
          aria-labelledby="adaptive-anatomy"
          className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
        >
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5">
            <h2 id="adaptive-anatomy" className="text-lg font-extrabold text-[color:var(--text-heading)]">
              Anatomy
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              What each decision is for, so the reasoning survives into the production pass.
            </p>
          </div>
          <dl className="grid gap-0 sm:grid-cols-2">
            {anatomy.map((entry, index) => (
              <div
                key={entry.term}
                className={cn(
                  "border-[color:var(--border)] px-4 py-3.5 sm:px-5",
                  index > 0 && "border-t",
                  index % 2 === 1 && "sm:border-l",
                  index === 1 && "sm:border-t-0",
                )}
              >
                <dt className="text-sm-minus font-bold text-[color:var(--text-heading)]">{entry.term}</dt>
                <dd className="mt-1 text-xs leading-5 font-medium text-[color:var(--text-muted)]">{entry.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="adaptive-notes"
          className="rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-4 sm:px-5"
        >
          <h2 id="adaptive-notes" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            Before this becomes production
          </h2>
          <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-sm font-medium text-[color:var(--text-muted)]">
            <li>
              The per-filter counts here assume facet counts the band is not passed today. That is a real prop change
              across all twelve call sites, not styling.
            </li>
            <li>
              Removing the query echo depends on the composer staying persistently visible with a working clear
              affordance. Confirm that on every mode before relying on it.
            </li>
            <li>
              Fusing sort into Refine on phone hides the active sort value at rest. Either surface it inside the sheet
              trigger or accept it — but decide deliberately rather than by omission.
            </li>
            <li>
              The height change wants a transition, and needs checking against{" "}
              <code className="font-mono text-xs">docs/search-chrome-behaviour.md</code> if the band ever becomes
              sticky.
            </li>
            <li>
              Mockups are exempt from the token, type-scale and button-wiring gates. Promoting this to production means
              re-checking every control against them, and raising anything that lands deep in a sheet to 48px per the{" "}
              <code className="font-mono text-xs">ui-smoke</code> rule.
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
