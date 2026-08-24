"use client";

import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";

import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import {
  ResultFilterFacetChips,
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { Button } from "@/components/ui/button";
import { pageContainer } from "@/components/ui-primitives";

import { useTcBindings } from "../bindings";
import { matchesAvailability, matchesTopics } from "../data/select";
import { LoadingState } from "../ui";
import { ResultCard } from "../therapy-card";
import { TherapyReviewNotice } from "../therapy-review-notice";

// Curated quick-filter tags surfaced as chips (all exist in the tag set).
// None of the six is ever zero across the whole 205-therapy catalogue, so the
// "derive the option list from the data" rule (docs/filter-contract.md
// section 3) — aimed at a permanently empty option — does not apply here; a
// deliberately curated subset of a larger tag vocabulary is a different thing.
const QUICK_TAGS = ["CBT", "Anxiety", "Mood", "Trauma", "DBT", "Crisis/risk"];
const MAX_CARDS = 24;

export function SearchScreen() {
  const b = useTcBindings();
  const q = b.search.query;
  const results = b.searchResults;
  const shown = results.slice(0, MAX_CARDS);
  const topics = useMemo(() => new Set(b.search.tags), [b.search.tags]);
  // Filters only — the query is deliberately excluded. It counts toward the
  // sheet's Clear all (see below), because `clearSearch` resets it, but the
  // trigger badge is labelled "N filters active" and a search term is not a
  // filter. Counting it there makes the control announce a state the page is
  // not in, which is the exact defect this screen's sheet was built to fix.
  const activeFilterCount = b.search.tags.length + Number(b.search.reviewedOnly) + Number(b.search.briefOnly);
  // Topics and availability both narrow the same list, so both belong on the
  // shelf. The query is deliberately absent: it is stated in the composer and
  // removing it is not a filter operation.
  const appliedFilters = [
    ...b.search.tags.map((tag) => ({
      id: `topic-${tag}`,
      groupLabel: "Topic",
      valueLabel: tag,
      onRemove: () => b.toggleTag(tag),
    })),
    ...(b.search.reviewedOnly
      ? [{ id: "reviewed", groupLabel: "Evidence", valueLabel: "Reviewed", onRemove: b.toggleReviewedOnly }]
      : []),
    ...(b.search.briefOnly
      ? [{ id: "brief", groupLabel: "Availability", valueLabel: "Brief available", onRemove: b.toggleBriefOnly }]
      : []),
  ];
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);

  // "How many would I have if I ticked this as well" — the same predicate as
  // the filter, run against the query-only match set with the candidate
  // added, so a count is never derived by narrowing the already-filtered
  // subset. See docs/filter-contract.md section 3 and the two shared
  // predicates in `data/select.ts` that both this and `searchTherapies` run
  // through, so the count and the filter cannot drift apart.
  const topicsGroup = useMemo(
    () =>
      resultFilterFacetGroup({
        id: "topics",
        label: "Topics",
        selected: topics,
        options: QUICK_TAGS.map((tag) => {
          const withCandidate = topics.has(tag) ? topics : new Set([...topics, tag]);
          const count = b.queryMatches.filter(
            (t) => matchesTopics(t, withCandidate) && matchesAvailability(t, b.search.reviewedOnly, b.search.briefOnly),
          ).length;
          return { value: tag, label: tag, hint: String(count), disabled: count === 0 && !topics.has(tag) };
        }),
        onToggle: b.toggleTag,
      }),
    [topics, b.queryMatches, b.search.reviewedOnly, b.search.briefOnly, b.toggleTag],
  );
  // Reviewed-only and brief-available are independent AND constraints, not
  // alternatives — see `matchesAvailability`. Modelled as two separate
  // one-option facet groups rather than options inside one group, because a
  // shared group would OR them together (docs/filter-contract.md section 1),
  // which `searchTherapies` does not: selecting both narrows to therapies
  // that are both reviewed and have a brief, not either.
  const reviewedGroup = useMemo(
    () =>
      resultFilterFacetGroup({
        id: "review-status",
        label: "Review status",
        selected: b.search.reviewedOnly ? new Set(["reviewed"]) : new Set<string>(),
        options: [
          {
            value: "reviewed",
            label: "Reviewed only",
            hint: String(
              b.queryMatches.filter((t) => matchesTopics(t, topics) && matchesAvailability(t, true, b.search.briefOnly))
                .length,
            ),
            disabled:
              b.queryMatches.filter((t) => matchesTopics(t, topics) && matchesAvailability(t, true, b.search.briefOnly))
                .length === 0 && !b.search.reviewedOnly,
          },
        ],
        onToggle: b.toggleReviewedOnly,
      }),
    [b.search.reviewedOnly, b.search.briefOnly, b.queryMatches, topics, b.toggleReviewedOnly],
  );
  const handoutGroup = useMemo(
    () =>
      resultFilterFacetGroup({
        id: "handout",
        label: "Handout",
        selected: b.search.briefOnly ? new Set(["brief"]) : new Set<string>(),
        options: [
          {
            value: "brief",
            label: "Brief available",
            hint: String(
              b.queryMatches.filter(
                (t) => matchesTopics(t, topics) && matchesAvailability(t, b.search.reviewedOnly, true),
              ).length,
            ),
            disabled:
              b.queryMatches.filter(
                (t) => matchesTopics(t, topics) && matchesAvailability(t, b.search.reviewedOnly, true),
              ).length === 0 && !b.search.briefOnly,
          },
        ],
        onToggle: b.toggleBriefOnly,
      }),
    [b.search.briefOnly, b.search.reviewedOnly, b.queryMatches, topics, b.toggleBriefOnly],
  );
  const filterGroups = [topicsGroup, reviewedGroup, handoutGroup];

  return (
    <section data-screen-label="Search" className={`${pageContainer} space-y-2.5 sm:space-y-3`}>
      <TherapyReviewNotice className="mb-2.5 sm:mb-3" />
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
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="therapy-filter-trigger-phone"
            title="Filter therapy results"
            open={filterOpen}
            activeCount={activeFilterCount}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
        filterControls={
          // `ResultFilterFacetChips` carries a `border-t` meant for groups
          // stacked vertically inside the sheet (`first:border-t-0` zeroes
          // only the very first one). Side by side here, that put a hairline
          // above the second and third group only — a floating tick mark, not
          // a real divider. Neutralised per-child rather than touching the
          // shared component, which formulation's single-group desktop rail
          // still needs unmodified.
          <div className="mb-1 flex flex-wrap items-start gap-x-5 gap-y-1.5 sm:mb-2 [&>section]:border-t-0 [&>section]:pt-0">
            {filterGroups.map((group) => (
              <ResultFilterFacetChips key={group.id} group={group} idPrefix={`${filterPanelId}-desktop`} />
            ))}
            {/* Rendered only when there is something to clear. Rewiring this to
                `clearSearchFilters` fixed the label/handler mismatch but created
                a second one: with no topics and neither availability toggle on —
                the ordinary "typed a query, got results" case — clicking `Clear`
                produced no observable change at all. A control that advertises an
                action must perform one. */}
            {activeFilterCount > 0 ? (
              <Button
                variant="toolbar"
                size="sm"
                icon={X}
                onClick={b.clearSearchFilters}
                className="border-dashed border-[color:var(--border-strong)] bg-transparent font-medium"
              >
                Clear
              </Button>
            ) : null}
          </div>
        }
      />

      <ResultFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        panelId={filterPanelId}
        testId="therapy-filter-panel"
        title="Filter therapies"
        groups={filterGroups}
        // Never `clearSearch` — the shared sheet's Clear all must not touch
        // the query (docs/filter-contract.md section 6). The composer's own
        // "Clear search" control (every breakpoint) already covers wiping the
        // query; this sheet only ever clears what it itself narrows.
        onClearAll={activeFilterCount > 0 ? b.clearSearchFilters : undefined}
        summary={{ count: results.length, noun: results.length === 1 ? "therapy" : "therapies" }}
      />

      {/* The band's fault panel owns the failure. Without this guard an error
          also renders the empty state, so the page says both "we couldn't
          search" and "nothing matched" at once. */}
      {b.error ? null : b.loading ? (
        <LoadingState />
      ) : (
        <>
          {results.length === 0 ? (
            <SearchResultsEmptyState
              modeId="therapy-compass"
              query={q}
              appliedFilters={appliedFilters}
              onClearFilters={b.clearSearchFilters}
              // Query-only zero results otherwise have no filter chip or example.
              // Restore a one-tap escape without relabeling
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

      {!b.error && !b.loading ? (
        <UniversalSearchAlsoMatches modeId="therapy-compass" query={q} className="mt-4" />
      ) : null}
    </section>
  );
}
