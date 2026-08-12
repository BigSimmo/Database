"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import {
  ResultFilterFacetChips,
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";
import { pageContainer } from "@/components/ui-primitives";

import { useTcBindings } from "../bindings";
import { searchTherapies } from "../data/select";
import { LoadingState } from "../ui";
import { ResultCard } from "../therapy-card";

// Curated quick-filter tags surfaced as chips (all exist in the tag set).
const QUICK_TAGS = ["CBT", "Anxiety", "Mood", "Trauma", "DBT", "Crisis/risk"];
const AVAILABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: "reviewed", label: "Reviewed only" },
  { value: "brief", label: "Brief available" },
];
const MAX_CARDS = 24;

export function SearchScreen() {
  const b = useTcBindings();
  const router = useRouter();
  const q = b.search.query;
  const results = b.searchResults;
  const shown = results.slice(0, MAX_CARDS);
  const availabilityFilterCount = Number(b.search.reviewedOnly) + Number(b.search.briefOnly);
  // Match the sheet: a non-empty query is an active narrowing control on phone,
  // where Clear only lives inside the filter sheet (wide keeps a ribbon Clear).
  // Filters only — the query is deliberately excluded. The trigger badge is
  // labelled "N filters active" and a search term is not a filter.
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
  const clearSearch = () => {
    b.clearSearch();
    // Therapy owns this route family. Clearing a deep-linked query must update
    // the address bar as well as local state, otherwise the provider can reseed
    // the stale `q` value on navigation or remount.
    router.replace("/therapy-compass/search");
  };

  // "How many would I have if I ticked this as well" — the same predicate as
  // the filter, run with the candidate added, exactly like formulation's
  // domain facet (formulation-home-page.tsx). Note this narrows rather than
  // widens: therapy's tags are deliberately AND-within-group (a therapy must
  // carry every selected tag, select.ts's `wantTags.every`), not the
  // OR-within-group the contract describes as the default for facets. The
  // re-run technique stays honest either way — it always answers what the
  // next click actually does.
  const activeTopics = b.search.tags;
  const topicsGroup = useMemo(
    () =>
      resultFilterFacetGroup({
        id: "topics",
        label: "Topics",
        selected: new Set(activeTopics),
        options: QUICK_TAGS.map((tag) => {
          const on = activeTopics.includes(tag);
          const candidateTags = on ? activeTopics.filter((t) => t !== tag) : [...activeTopics, tag];
          const count = searchTherapies(b.therapies, { ...b.search, tags: candidateTags }).length;
          return { value: tag, label: tag, hint: String(count) };
        }),
        onToggle: b.toggleTag,
      }),
    [activeTopics, b.search, b.therapies, b.toggleTag],
  );
  const availabilityGroup = useMemo(() => {
    const selected = new Set<string>([
      ...(b.search.reviewedOnly ? ["reviewed"] : []),
      ...(b.search.briefOnly ? ["brief"] : []),
    ]);
    return resultFilterFacetGroup({
      id: "availability",
      label: "Availability",
      selected,
      options: AVAILABILITY_OPTIONS.map(({ value, label }) => {
        const candidate =
          value === "reviewed"
            ? { ...b.search, reviewedOnly: !b.search.reviewedOnly }
            : { ...b.search, briefOnly: !b.search.briefOnly };
        // Only re-run when this toggle would turn the option on; a currently-on
        // option being turned off still needs its own honest count.
        const count = searchTherapies(b.therapies, candidate).length;
        return { value, label, hint: String(count) };
      }),
      onToggle: (value) => (value === "reviewed" ? b.toggleReviewedOnly() : b.toggleBriefOnly()),
    });
  }, [b]);

  return (
    <section data-screen-label="Search" className={`${pageContainer} space-y-2.5 sm:space-y-3`}>
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
        utilityControls={
          q ? (
            <button
              type="button"
              onClick={clearSearch}
              data-testid="therapy-clear-search"
              className="search-band-ghost inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-2xs font-bold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="max-[389px]:sr-only">Clear search</span>
            </button>
          ) : undefined
        }
        // A compact badged trigger, so it shares the count line.
        mobileControlsPlacement="inline"
        mobileControls={
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="therapy-filter-trigger"
            title="Filter therapies"
            open={filterOpen}
            activeCount={activeFilterCount}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
        // The same groups the sheet renders, so the two breakpoints cannot
        // drift (formulation-home-page.tsx is the reference for this shape).
        filterControls={
          <div className="grid min-w-0 gap-1">
            <ResultFilterFacetChips group={topicsGroup} idPrefix="therapy-filter-desktop" />
            <ResultFilterFacetChips group={availabilityGroup} idPrefix="therapy-filter-desktop" />
          </div>
        }
      />

      {/* Phone-only by construction: the trigger that opens it lives in the
          ribbon's `mobileControls` slot, which the band hides from `sm` up.
          `onClearAll` clears filters only — never the query. The query has its
          own Therapy-owned clear action in the ribbon, so filter clearing never
          needs to double as a query reset. */}
      <ResultFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        panelId={filterPanelId}
        testId="therapy-filter"
        title="Filter therapies"
        groups={[topicsGroup, availabilityGroup]}
        onClearAll={activeFilterCount === 0 ? undefined : b.clearSearchFilters}
        footerNote={`${results.length} therap${results.length === 1 ? "y" : "ies"}`}
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
              onClearSearch={clearSearch}
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
