"use client";

import {
  MobileResultFilterControl,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";

import { useTcBindings } from "../bindings";
import { outlineControl, softControl } from "../controls";
import { SearchIcon, SearchXIcon, XIcon } from "../icons";
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

  return (
    <section data-screen-label="Search" className="tc-screens-search-screen-001">
      <h1 className="tc-screens-search-screen-002">Therapy</h1>
      <p className="tc-screens-search-screen-003">
        Find source-grounded therapy records by problem, symptom, skill or population.
      </p>

      <div className="tc-screens-search-screen-004">
        <label className="tc-screens-search-screen-005">
          <SearchIcon size={19} strokeWidth={1.8} className="tc-screens-search-screen-006" />
          <input
            value={q}
            onChange={(e) => b.setQuery(e.target.value)}
            placeholder="Search anxiety, trauma, CBT, relapse prevention…"
            aria-label="Search therapies"
            className="tc-screens-search-screen-007"
          />
        </label>
      </div>

      <SearchResultsHeaderBand
        modeId="therapy-compass"
        query={q}
        matchCount={results.length}
        loading={b.loading}
        filterLabel="Filter therapy results"
        mobileControls={
          <div className="grid min-w-0 grid-cols-2 gap-1.5">
            <MobileResultFilterControl
              label="Topics"
              ariaLabel="Add or remove a therapy topic filter"
              testId="therapy-topic-filter-select"
              value=""
              options={[
                {
                  value: "",
                  label: b.search.tags.length ? `${b.search.tags.length} topics selected` : "All topics",
                  disabled: true,
                },
                ...QUICK_TAGS.map((tag) => ({
                  value: tag,
                  label: `${b.search.tags.includes(tag) ? "✓ " : ""}${tag}`,
                })),
              ]}
              onChange={(tag) => {
                if (tag) b.toggleTag(tag);
              }}
            />
            <MobileResultFilterControl
              label="More"
              ariaLabel="Change therapy availability filters"
              testId="therapy-availability-filter-select"
              value=""
              options={[
                {
                  value: "",
                  label: availabilityFilterCount ? `${availabilityFilterCount} more selected` : "Any availability",
                  disabled: true,
                },
                { value: "reviewed", label: `${b.search.reviewedOnly ? "✓ " : ""}Reviewed only` },
                { value: "brief", label: `${b.search.briefOnly ? "✓ " : ""}Brief available` },
                {
                  value: "clear",
                  label: "Clear filters",
                  disabled: b.search.tags.length === 0 && availabilityFilterCount === 0 && !q,
                },
              ]}
              onChange={(filter) => {
                if (filter === "reviewed") b.toggleReviewedOnly();
                if (filter === "brief") b.toggleBriefOnly();
                if (filter === "clear") b.clearSearch();
              }}
            />
          </div>
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

      {b.loading ? (
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
