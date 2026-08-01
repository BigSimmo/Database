"use client";

import { useId, useState } from "react";

import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";

import { useTcBindings } from "../bindings";
import { TherapyFilterSheet, TherapyFilterTrigger } from "../filter-sheet";
import { outlineControl, softControl } from "../controls";
import { SearchXIcon, XIcon } from "../icons";
import { EmptyState, LoadingState } from "../ui";
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
  // removing it is not a filter operation.
  const appliedFilters = [
    ...b.search.tags.map((tag) => ({ id: `topic-${tag}`, label: tag, onRemove: () => b.toggleTag(tag) })),
    ...(b.search.reviewedOnly ? [{ id: "reviewed", label: "Reviewed only", onRemove: b.toggleReviewedOnly }] : []),
    ...(b.search.briefOnly ? [{ id: "brief", label: "Brief available", onRemove: b.toggleBriefOnly }] : []),
  ];
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <section data-screen-label="Search" className="tc-screens-search-screen-001">
      <SearchResultsHeaderBand
        modeId="therapy-compass"
        query={q}
        matchCount={results.length}
        status={b.error ? "error" : b.loading ? "loading" : "ready"}
        faultBody={b.error ?? undefined}
        onRetry={b.retryData}
        headingLevel={1}
        appliedFilters={appliedFilters}
        onClearFilters={b.clearSearch}
        filterLabel="Filter therapy results"
        mobileControls={
          <TherapyFilterTrigger
            panelId={filterPanelId}
            open={filterOpen}
            activeCount={activeFilterCount}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
        filterControls={
          <div className="tc-screens-search-screen-008">
            {QUICK_TAGS.map((tag) => {
              const on = b.search.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`tc-btn ${softControl}${on ? " tc-is-selected" : ""}`}
                  onClick={() => b.toggleTag(tag)}
                  aria-pressed={on}
                >
                  {tag}
                </button>
              );
            })}
            <button
              type="button"
              className={`tc-btn ${softControl}${b.search.reviewedOnly ? " tc-is-success" : ""}`}
              onClick={b.toggleReviewedOnly}
              aria-pressed={b.search.reviewedOnly}
            >
              Reviewed only
            </button>
            <button
              type="button"
              className={`tc-btn ${softControl}${b.search.briefOnly ? " tc-is-selected" : ""}`}
              onClick={b.toggleBriefOnly}
              aria-pressed={b.search.briefOnly}
            >
              Brief available
            </button>
            <button type="button" className="tc-btn tc-screens-search-screen-009" onClick={b.clearSearch}>
              <XIcon size={15} strokeWidth={1.8} />
              Clear
            </button>
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
            <EmptyState
              icon={SearchXIcon}
              title="No therapies match those filters"
              body="Try a broader term, remove a tag, or clear the filters to browse the full library."
              action={
                <button type="button" className={`tc-btn ${outlineControl}`} onClick={b.clearSearch}>
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="tc-screens-search-screen-014">
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
