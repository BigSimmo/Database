"use client";

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

  return (
    <section data-screen-label="Search" className="tc-screens-search-screen-001">
      <h1 className="tc-screens-search-screen-002">Therapy Search</h1>
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

      {b.loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="tc-screens-search-screen-010">
            <div className="tc-screens-search-screen-011">
              <span className="tc-screens-search-screen-012">Top results</span>
              <span className="tc-screens-search-screen-013">
                {results.length === 0
                  ? "No matches"
                  : `${Math.min(shown.length, results.length)} of ${results.length} record${results.length === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>

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
