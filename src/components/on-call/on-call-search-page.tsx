"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";
import { cardInteractive, cardPadding } from "@/components/card-recipes";
import { ON_CALL_SECTION_ICONS, ON_CALL_SECTION_TITLES } from "@/components/on-call/on-call-nav-header";
import { cn, iconTilePremium, metadataPillDensity, pageContainer, searchPageCanvas } from "@/components/ui-primitives";
import { useResultSort } from "@/components/use-result-sort";
import { ON_CALL_SECTIONS, type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";
import { useOnCallEntries } from "@/lib/on-call/entry-store";
import { onCallEntryDetailChips, onCallSearchStatus, rankOnCallEntries } from "@/lib/on-call/search";
import { sortResultItems } from "@/lib/result-sort";

type SectionFilterValue = "all" | OnCallSection;

const SECTION_FILTER_OPTIONS: ReadonlyArray<{ value: SectionFilterValue; label: string }> = [
  { value: "all", label: "All sections" },
  ...ON_CALL_SECTIONS.map((section) => ({
    value: section as SectionFilterValue,
    label: ON_CALL_SECTION_TITLES[section],
  })),
];

/**
 * One search result: the entry's own title/subtitle, which section it lives
 * in (never implicit — a "clozapine" query can return a clinic phone number
 * from Referrals and a haematology contact from Contacts in the same list,
 * and neither reads without its section named), and the section-specific
 * detail that made it legible at a glance.
 *
 * There is no per-entry detail route yet (`OnCallSectionPage` renders every
 * entry inline on its own section page), so the whole row is internal
 * navigation to that section — `<Link>`, never a raw `<a href="/…">`.
 */
function OnCallSearchResultRow({ entry }: { entry: OnCallEntry }) {
  const Icon = ON_CALL_SECTION_ICONS[entry.section];
  const chips = onCallEntryDetailChips(entry);

  return (
    <Link
      href={`/on-call/${entry.section}`}
      data-testid={`on-call-search-result-${entry.id}`}
      className={cn(cardInteractive, cardPadding.standard, "flex min-h-tap w-full items-start gap-3 text-left")}
    >
      <span aria-hidden className={cn(iconTilePremium, "mt-0.5")}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[color:var(--text)]">{entry.title}</span>
        {entry.subtitle ? (
          <span className="mt-0.5 block truncate text-xs text-[color:var(--text-muted)]">{entry.subtitle}</span>
        ) : null}
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {/* The section is never implicit — always the first pill, and always
              present, even for a section with no other detail to show
              (Orientation). */}
          <span
            data-testid="on-call-search-result-section"
            className={cn(metadataPillDensity.standard, "rounded-full text-[color:var(--clinical-accent)]")}
          >
            {ON_CALL_SECTION_TITLES[entry.section]}
          </span>
          {chips.map((chip) => (
            <span key={chip.label} className={cn(metadataPillDensity.standard, "rounded-full")}>
              {`${chip.label}: ${chip.value}`}
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}

/**
 * Search across every On Call section at once, offline. `entries` is
 * whatever `useOnCallEntries()` already has in the browser — this page adds
 * no fetch of its own and no server search endpoint; it filters the client
 * cache with `rankOnCallEntries` (`src/lib/on-call/search.ts`).
 *
 * Mounts `SearchResultsHeaderBand` (`resultsSurface: "results-band"` in the
 * mode registry) so a faulted search — offline with nothing cached to search
 * over — renders no count at all rather than a false "0 matches"
 * (`onCallSearchStatus`). Sort is the band's own `aria-pressed` group,
 * `sm`-and-up only; section is the phone-idiom badged trigger opening a
 * sheet, never a native `<select>`.
 */
export function OnCallSearchPage({ initialQuery = "" }: { initialQuery?: string }) {
  const { entries, loading, isOffline, signedOut } = useOnCallEntries();
  const [sortValue, setSortValue] = useResultSort();
  const [sectionFilter, setSectionFilter] = useState<SectionFilterValue>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterPanelId = useId();

  const status = onCallSearchStatus({ loading, isOffline, signedOut, entryCount: entries.length });
  const faulted = status === "error" || status === "unauthorized";

  const ranked = useMemo(() => rankOnCallEntries(entries, initialQuery), [entries, initialQuery]);
  const sectionFiltered = useMemo(
    () => (sectionFilter === "all" ? ranked : ranked.filter((match) => match.entry.section === sectionFilter)),
    [ranked, sectionFilter],
  );
  const displayed = useMemo(
    () => sortResultItems(sectionFiltered, sortValue, (match) => match.entry.title),
    [sectionFiltered, sortValue],
  );

  const filterOptions = useMemo(
    () =>
      SECTION_FILTER_OPTIONS.map((option) => {
        const count =
          option.value === "all"
            ? ranked.length
            : ranked.filter((match) => match.entry.section === option.value).length;
        return {
          value: option.value,
          label: option.label,
          hint: String(count),
          disabled: count === 0 && sectionFilter !== option.value,
        };
      }),
    [ranked, sectionFilter],
  );
  const activeFilterCount = sectionFilter === "all" ? 0 : 1;
  const clearSectionFilter = () => setSectionFilter("all");

  const renderFilterTrigger = (testId: string) => (
    <ResultFilterTrigger
      panelId={filterPanelId}
      testId={testId}
      title="Filter On Call results"
      open={filterOpen}
      activeCount={activeFilterCount}
      onToggle={() => setFilterOpen((current) => !current)}
    />
  );

  return (
    <div className={cn("overflow-x-hidden", searchPageCanvas)}>
      <main
        data-testid="on-call-search-main"
        className={cn(pageContainer, "grid gap-3 px-4 pt-3 sm:px-6 lg:gap-5 lg:px-8 lg:pb-8 lg:pt-6")}
      >
        {/* Mounted in every status, faulted included: the fault panel is part of
            the band, not a separately-owned notice, so the page never loses its
            header entirely. */}
        <SearchResultsHeaderBand
          modeId="on-call"
          query={initialQuery}
          matchCount={displayed.length}
          status={status}
          headingLevel={1}
          faultTitle={status === "unauthorized" ? "Sign in to search" : "On Call could not be loaded"}
          faultBody={
            status === "unauthorized"
              ? "Your session has expired. Sign in again to search your on-call information."
              : "This device has no offline copy of your on-call entries to search. Reconnect and try again."
          }
          sortValue={sortValue}
          onSortChange={setSortValue}
          mobileControlsPlacement="inline"
          mobileControls={renderFilterTrigger("on-call-search-filter-trigger-phone")}
          filterControls={renderFilterTrigger("on-call-search-filter-trigger-wide")}
        />
        <ResultFilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          panelId={filterPanelId}
          testId="on-call-search-filter-sheet"
          title="Filter On Call results"
          description="Narrow to one section."
          groups={[
            resultFilterGroup({
              id: "section",
              label: "Section",
              value: sectionFilter,
              options: filterOptions,
              onChange: setSectionFilter,
            }),
          ]}
          onClearAll={activeFilterCount > 0 ? clearSectionFilter : undefined}
          summary={{ count: displayed.length, noun: displayed.length === 1 ? "result" : "results" }}
        />
        {!faulted ? (
          displayed.length > 0 ? (
            <section aria-label="On Call search results" className="grid gap-2.5">
              {displayed.map((match) => (
                <OnCallSearchResultRow key={match.entry.id} entry={match.entry} />
              ))}
            </section>
          ) : (
            <SearchResultsEmptyState
              modeId="on-call"
              query={initialQuery}
              onClearFilters={activeFilterCount > 0 ? clearSectionFilter : undefined}
              appliedFilters={
                activeFilterCount > 0
                  ? [
                      {
                        id: `section-${sectionFilter}`,
                        groupLabel: "Section",
                        valueLabel:
                          SECTION_FILTER_OPTIONS.find((option) => option.value === sectionFilter)?.label ?? "",
                        onRemove: clearSectionFilter,
                      },
                    ]
                  : []
              }
            />
          )
        ) : null}
      </main>
    </div>
  );
}
