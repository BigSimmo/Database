"use client";

import { useTcBindings } from "../bindings";
import { outlineControl, softControl } from "../controls";
import { SearchIcon, SearchXIcon, SlidersIcon, XIcon } from "../icons";
import { s } from "../style-utils";
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
    <section data-screen-label="Search" style={s(`max-width:1180px;margin:0 auto;`)}>
      <h1 style={s(`margin:0 0 6px;font-size:27px;font-weight:680;color:var(--text-heading);letter-spacing:-0.02em;`)}>
        Therapy Search
      </h1>
      <p style={s(`margin:0 0 22px;font-size:14.5px;color:var(--text-muted);`)}>
        Find source-grounded therapy records by problem, symptom, skill or population.
      </p>

      <div style={s(`display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;`)}>
        <label style={s(`flex:1;min-width:260px;position:relative;display:flex;align-items:center;`)}>
          <SearchIcon size={19} strokeWidth={1.8} style={s(`position:absolute;left:16px;color:var(--text-soft);`)} />
          <input
            value={q}
            onChange={(e) => b.setQuery(e.target.value)}
            placeholder="Search anxiety, trauma, CBT, relapse prevention…"
            aria-label="Search therapies"
            style={s(
              `width:100%;height:52px;padding:0 16px 0 46px;border:1px solid var(--border-strong);border-radius:13px;background:var(--surface);color:var(--text);font-size:16px;font-family:inherit;outline:none;box-shadow:var(--shadow-tight);`,
            )}
          />
        </label>
        <button type="button" className="tc-btn" style={s(outlineControl + "height:52px;padding:0 18px;")}>
          <SlidersIcon size={17} />
          Filters
        </button>
      </div>

      <div style={s(`display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;`)}>
        {QUICK_TAGS.map((tag) => {
          const on = b.search.tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              className="tc-btn"
              onClick={() => b.toggleTag(tag)}
              style={s(
                softControl +
                  (on
                    ? "border:1px solid var(--clinical-accent-border);background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);font-weight:600;"
                    : ""),
              )}
            >
              {tag}
            </button>
          );
        })}
        <button
          type="button"
          className="tc-btn"
          onClick={b.toggleReviewedOnly}
          style={s(
            softControl +
              (b.search.reviewedOnly
                ? "border:1px solid var(--success-border);background:var(--success-bg);color:var(--success-text);font-weight:600;"
                : ""),
          )}
        >
          Reviewed only
        </button>
        <button
          type="button"
          className="tc-btn"
          onClick={b.toggleBriefOnly}
          style={s(
            softControl +
              (b.search.briefOnly
                ? "border:1px solid var(--clinical-accent-border);background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);font-weight:600;"
                : ""),
          )}
        >
          Brief available
        </button>
        <button
          type="button"
          className="tc-btn"
          onClick={b.clearSearch}
          style={s(
            `display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 16px;border:1px dashed var(--border-strong);border-radius:11px;background:transparent;color:var(--text-soft);font-size:13.5px;font-weight:500;cursor:pointer;font-family:inherit;`,
          )}
        >
          <XIcon size={15} strokeWidth={1.8} />
          Clear
        </button>
      </div>

      {b.loading ? (
        <LoadingState />
      ) : (
        <>
          <div style={s(`display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;`)}>
            <div style={s(`display:flex;align-items:baseline;gap:10px;`)}>
              <span style={s(`font-size:15px;font-weight:650;color:var(--text-heading);`)}>Top results</span>
              <span style={s(`font-size:13px;color:var(--text-soft);`)}>
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
                <button type="button" className="tc-btn" onClick={b.clearSearch} style={s(outlineControl)}>
                  Clear filters
                </button>
              }
            />
          ) : (
            <div style={s(`display:flex;flex-direction:column;gap:14px;`)}>
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
