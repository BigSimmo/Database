"use client";

import { useId, useState } from "react";

import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";
import { pageContainer } from "@/components/ui-primitives";

import { useTcBindings } from "../bindings";
import { TherapyFilterSheet, TherapyFilterTrigger } from "../filter-sheet";
import { softControl, therapyBtn } from "../controls";
import { XIcon } from "../icons";
import { LoadingState } from "../ui";
import { ResultCard } from "../therapy-card";

// Curated quick-filter tags surfaced as chips (all exist in the tag set).
const QUICK_TAGS = ["CBT", "Anxiety", "Mood", "Trauma", "DBT", "Crisis/risk"];
const MAX_CARDS = 24;

export function SearchScreen() {
  const b = useTcBindings();
  const q = b.search.query;
  const results = b.searchResults;
  const shown = results.slice(0, MAX_CARDS);
  const availabilityFilterCount = Number(b.search.reviewedOnly) + Number(b.search.briefOnly);
  // Match the sheet: a non-empty query is an active narrowing control on phone,
  // where Clear only lives inside the filter sheet (wide keeps a ribbon Clear).
  // Filters only — the query is deliberately excluded. It counts toward the
  // sheet's Clear all (see `filter-sheet.tsx`), because `clearSearch` resets it,
  // but the trigger badge is labelled "N filters active" and a search term is
  // not a filter. Counting it there makes the control announce a state the page
  // is not in, which is the exact defect this screen's sheet was built to fix.
  const activeFilterCount = b.search.tags.length + availabilityFilterCount;
  // Topics and availability both narrow the same list, so both belong on the
  // shelf. The query is deliberately absent: it is stated in the composer and
  // removing it is not a filter operation. The shelf's trailing Clear therefore
  // uses `clearSearchFilters`, not `clearSearch` — a row labelled "Filtered by"
  // must not delete the search term the user is reading.
  const appliedFilters = [
    ...b.search.tags.map((tag) => ({ id: `topic-${tag}`, label: tag, onRemove: () => b.toggleTag(tag) })),
    ...(b.search.reviewedOnly ? [{ id: "reviewed", label: "Reviewed only", onRemove: b.toggleReviewedOnly }] : []),
    ...(b.search.briefOnly ? [{ id: "brief", label: "Brief available", onRemove: b.toggleBriefOnly }] : []),
  ];
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <section data-screen-label="Search" className={pageContainer}>
      <SearchResultsHeaderBand
        modeId="therapy-compass"
        query={q}
        matchCount={results.length}
        status={b.error ? "error" : b.loading ? "loading" : "ready"}
        faultBody={b.error ?? undefined}
        onRetry={b.retryData}
        headingLevel={1}
        appliedFilters={appliedFilters}
        onClearFilters={b.clearSearchFilters}
        filterLabel="Filter therapy results"
        // A compact badged trigger, so it shares the count line.
        mobileControlsPlacement="inline"
        mobileControls={
          <TherapyFilterTrigger
            panelId={filterPanelId}
            open={filterOpen}
            activeCount={activeFilterCount}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
        filterControls={
          <div className="flex flex-wrap gap-2.5 mb-6">
            {QUICK_TAGS.map((tag) => {
              const on = b.search.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`${therapyBtn} ${softControl}`}
                  onClick={() => b.toggleTag(tag)}
                  aria-pressed={on}
                >
                  {tag}
                </button>
              );
            })}
            <button
              type="button"
              className={`${therapyBtn} ${softControl}`}
              onClick={b.toggleReviewedOnly}
              aria-pressed={b.search.reviewedOnly}
            >
              Reviewed only
            </button>
            <button
              type="button"
              className={`${therapyBtn} ${softControl}`}
              onClick={b.toggleBriefOnly}
              aria-pressed={b.search.briefOnly}
            >
              Brief available
            </button>
            {/* Rendered only when there is something to clear. Rewiring this to
                `clearSearchFilters` fixed the label/handler mismatch but created
                a second one: with no topics and neither availability toggle on —
                the ordinary "typed a query, got results" case — clicking `Clear`
                produced no observable change at all. A control that advertises an
                action must perform one; the sheet's `Clear all` is already gated
                on `clearableCount > 0` for the same reason. */}
            {activeFilterCount > 0 ? (
              <button
                type="button"
                className={`${therapyBtn} inline-flex items-center gap-2 min-h-tap py-0 px-4 border border-dashed border-[color:var(--border-strong)] rounded-lg bg-transparent text-[color:var(--text-muted)] text-sm-minus font-medium cursor-pointer`}
                // `clearSearchFilters`, not `clearSearch`. This control sits at the
                // end of the quick-filter chip row and is labelled `Clear`, so it
                // reads as "clear these filters" — but `clearSearch` also wipes the
                // query, deleting the search the reader is looking at. Same defect
                // #1611 fixed on the shelf's Clear; the binding it introduced
                // (`bindings.tsx:441`) is reused rather than duplicated.
                // The sheet's `Clear all` is deliberately different and stays on
                // `clearSearch` — it is labelled for what it does.
                //
                // Both sides of the v2 merge agreed on `--text-muted`, so this
                // hunk reduced to the handler alone; `main` still carries the
                // query-wiping version because #1616 branched before the fix.
                onClick={b.clearSearchFilters}
              >
                <XIcon size={15} strokeWidth={1.8} className="text-[color:var(--decoration-soft)]" />
                Clear
              </button>
            ) : null}
          </div>
        }
      />

      <TherapyFilterSheet
        open={filterOpen}
        panelId={filterPanelId}
        onClose={() => setFilterOpen(false)}
        query={q}
        topics={QUICK_TAGS}
        activeTopics={b.search.tags}
        onToggleTopic={b.toggleTag}
        reviewedOnly={b.search.reviewedOnly}
        onToggleReviewed={b.toggleReviewedOnly}
        briefOnly={b.search.briefOnly}
        onToggleBrief={b.toggleBriefOnly}
        onClear={b.clearSearch}
        resultCount={results.length}
      />

      {/* The band's fault panel owns the failure. Without this guard an error
          also renders the empty state, so the page says both "we couldn't
          search" and "nothing matched" at once. */}
      {b.error ? null : b.loading ? (
        <LoadingState />
      ) : (
        <>
          {results.length === 0 ? (
            // The shared surface, so the filtered-to-zero reader gets the same
            // route out here as in documents. What it replaces was a single
            // button labelled `Clear filters` wired to `clearSearch`, which also
            // deleted the query — the label promised one thing and the handler
            // did another. `Remove "X"` and `Clear all filters` are now separate
            // controls, so each label matches its own action.
            <SearchResultsEmptyState
              modeId="therapy-compass"
              query={q}
              appliedFilters={appliedFilters}
              onClearFilters={b.clearSearchFilters}
              // Query-only zero results otherwise have no filter chip, example,
              // or cross-mode action. Restore a one-tap escape without relabeling
              // a query reset as a filter operation.
              onClearSearch={b.clearSearch}
            />
          ) : (
            <div className="flex flex-col gap-3.5">
              {shown.map((t) => (
                <ResultCard key={t.slug} therapy={t} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
