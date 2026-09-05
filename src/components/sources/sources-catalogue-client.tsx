"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useId, useMemo, useState } from "react";

import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
  resultFilterGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { SearchResultsLayout } from "@/components/clinical-dashboard/search-results-layout";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
  type AppliedFilterChip,
} from "@/components/clinical-dashboard/search-results-header-band";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/components/ui-primitives";
import { appModeDefinition, appModeHomeHref, type AppModeId } from "@/lib/app-modes";
import type {
  ClinicalSourceCatalogueEntry,
  SourceCatalogueFilters,
  SourceQualityBand,
} from "@/lib/sources/catalogue-types";
import {
  filterAndSortSourceCatalogue,
  formatCatalogueMonth,
  parseSourceCatalogueFilters,
} from "@/lib/sources/catalogue-view";
import { sourceAttentionFlags } from "@/lib/sources/source-status-presentation";
import { groupSourceUsagesByMode } from "@/lib/sources/source-usage-presentation";

/**
 * The clinical source catalogue.
 *
 * The page used to open with a title, a paragraph, four count tiles and a panel
 * of nine native `<select>`s before the first source appeared. None of that is
 * what the page is for. The filters now live where every other mode keeps them —
 * behind the ribbon's badged trigger — and the reader lands directly on the
 * sources, each one leading with the only signal that decides whether to open it:
 * its quality band, then where in PsychSift it is actually used.
 *
 * Filter dimensions are deliberately four, not nine. Band, jurisdiction, topic
 * and application usage are the questions a clinician asks of a source list;
 * validation state, content mode and lifecycle are governance bookkeeping and
 * belong on the record, not in the narrowing control. Their URL parameters still
 * parse, so a deep link from Publishers or a saved catalogue link keeps working
 * and shows up as a removable applied chip.
 */

const bandLabels: Record<SourceQualityBand, string> = {
  A: "A · Preferred",
  B: "B · Strong",
  C: "C · Supplementary",
  D: "D · Review required",
  excluded: "Excluded",
};

const bandTone = {
  A: "success",
  B: "info",
  C: "neutral",
  D: "warning",
  excluded: "danger",
} as const satisfies Record<SourceQualityBand, "success" | "info" | "neutral" | "warning" | "danger">;

const jurisdictionLabels: Record<string, string> = {
  wa: "Western Australia",
  australian_national: "Australian national",
  australian_state: "Another Australian state",
  international: "International",
  unknown: "Unknown jurisdiction",
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function jurisdictionLabel(scope: string) {
  return jurisdictionLabels[scope] ?? titleCase(scope);
}

function modeLabel(modeId: AppModeId) {
  return appModeDefinition(modeId).label;
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en-AU", { sensitivity: "base" });
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort(compareText);
}

/**
 * The most recent date the entry can stand behind.
 *
 * Expiry is not a candidate: a source that expires in 2027 is not thereby
 * current, and reading a future expiry as recency is the inference the Method
 * page forbids. Absent dates return null and the tile says nothing rather than
 * inventing a currency claim.
 *
 * The comparison still uses `Date.parse`, which reads a bare `YYYY-MM-DD` as UTC
 * midnight — every candidate shifts by the same amount, so the ordering is
 * unaffected. Rendering is not: `formatCatalogueMonth` parses the winner as a
 * local calendar date, because a UTC instant formatted west of UTC shows the
 * previous month.
 */
function latestKnownDate(entry: ClinicalSourceCatalogueEntry) {
  const candidates = [entry.reviewDate, entry.publicationDate].filter((value): value is string => Boolean(value));
  const parsed = candidates
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((candidate) => !Number.isNaN(candidate.time))
    .sort((left, right) => right.time - left.time);
  const text = formatCatalogueMonth(parsed[0]?.value ?? null);
  if (!parsed[0] || !text) return null;
  return { label: entry.reviewDate === parsed[0].value ? "reviewed" : "published", text };
}

function SourceTile({ entry }: { entry: ClinicalSourceCatalogueEntry }) {
  const flags = sourceAttentionFlags(entry);
  const usageGroups = groupSourceUsagesByMode(entry.usedBy);
  const recordTotal = usageGroups.reduce((total, group) => total + group.recordCount, 0);
  // "Used in Dictionary" says a mode cites this; it does not say whether one
  // record leans on it or forty. The record count is what tells a reader how
  // much of the app moves if this source turns out to be wrong.
  const usageSummary = usageGroups.length
    ? `Used in ${usageGroups.map((group) => group.modeLabel).join(", ")} · ${recordTotal} ${recordTotal === 1 ? "record" : "records"}`
    : "Not used by any record yet";
  const currency = latestKnownDate(entry);

  return (
    <Link
      href={`/sources/${entry.id}`}
      aria-label={`View source details: ${entry.title}`}
      className={cn(
        "group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-[color:var(--border)]",
        "bg-[color:var(--surface)] p-4 shadow-[var(--e2)] transition",
        "hover:-translate-y-0.5 hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)]",
        "hover:shadow-[var(--e3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5">
          <Chip size="compact" appearance={{ kind: "status", tone: bandTone[entry.rating.band] }} dot>
            {bandLabels[entry.rating.band]}
          </Chip>
          {flags.map((flag) => (
            <Chip key={flag.label} size="compact" appearance={{ kind: "status", tone: flag.tone }}>
              {flag.label}
            </Chip>
          ))}
        </span>
        <span className="mt-2 block text-sm-minus font-extrabold leading-5 text-[color:var(--text-heading)]">
          {entry.title}
        </span>
        <span className="mt-1 block truncate text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
          {entry.publisher ?? "Publisher unknown"} · {entry.geography.label} · {titleCase(entry.sourceType)}
        </span>
        <span className="mt-2 block text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
          {usageSummary}
          {/* Currency, on the card rather than one navigation away. Whether a
              guideline was reviewed last year or in 2016 changes whether you
              open it, and the band letter alone does not say. */}
          {currency ? ` · ${currency.label} ${currency.text}` : null}
        </span>
      </span>
      <ArrowRight
        className={cn(
          "size-icon-md shrink-0 self-center text-[color:var(--decoration-soft)] transition",
          "group-hover:translate-x-0.5 group-hover:text-[color:var(--clinical-accent)]",
          "motion-reduce:transition-none motion-reduce:group-hover:translate-x-0",
        )}
        aria-hidden="true"
      />
    </Link>
  );
}

type FacetKey = "band" | "jurisdiction" | "topic" | "usedBy";

/** Every filter group that can be active, including the ones only a deep link sets. */
const chipGroups = [
  {
    key: "band",
    label: "Quality band",
    field: "bands",
    format: (value: string) => bandLabels[value as SourceQualityBand],
  },
  { key: "jurisdiction", label: "Jurisdiction", field: "jurisdictions", format: jurisdictionLabel },
  { key: "topic", label: "Topic", field: "topics", format: titleCase },
  { key: "usedBy", label: "Used in", field: "usedBy", format: (value: string) => modeLabel(value as AppModeId) },
  { key: "type", label: "Source type", field: "sourceTypes", format: titleCase },
  { key: "publisher", label: "Publisher", field: "publishers", format: (value: string) => value },
  { key: "lifecycle", label: "Lifecycle", field: "lifecycleStatuses", format: titleCase },
  { key: "status", label: "Currency", field: "documentStatuses", format: titleCase },
  { key: "validation", label: "Validation", field: "validationStatuses", format: titleCase },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  field: keyof SourceCatalogueFilters;
  format: (value: string) => string;
}>;

export function SourcesCatalogueClient({
  entries,
  hostedDocuments,
}: {
  entries: readonly ClinicalSourceCatalogueEntry[];
  hostedDocuments: "available" | "unavailable";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);

  const filters = useMemo(() => parseSourceCatalogueFilters(searchParams, entries), [entries, searchParams]);
  const visibleEntries = useMemo(() => filterAndSortSourceCatalogue(entries, filters), [entries, filters]);

  const setParamValues = (key: string, values: readonly string[]) => {
    const next = new URLSearchParams();
    for (const [candidateKey, candidateValue] of searchParams.entries()) {
      if (candidateKey !== key) next.append(candidateKey, candidateValue);
    }
    for (const value of values) next.append(key, value);
    const suffix = next.toString();
    router.replace(`${pathname}${suffix ? `?${suffix}` : ""}`, { scroll: false });
  };

  const selectedValues = (key: FacetKey): readonly string[] => {
    if (key === "band") return filters.bands;
    if (key === "jurisdiction") return filters.jurisdictions;
    if (key === "topic") return filters.topics;
    return filters.usedBy;
  };

  const toggleFacet = (key: FacetKey, value: string) => {
    const current = selectedValues(key);
    setParamValues(key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const removeFilterValue = (key: string, value: string) => {
    const current = searchParams
      .getAll(key)
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter((entry) => entry && entry !== value);
    setParamValues(key, current);
  };

  /** How many sources this option would leave visible if it were ticked as well. */
  const optionCount = (key: FacetKey, value: string) => {
    const current = selectedValues(key);
    const widened = current.includes(value) ? current : [...current, value];
    const candidate: SourceCatalogueFilters = {
      ...filters,
      ...(key === "band"
        ? { bands: widened as SourceCatalogueFilters["bands"] }
        : key === "jurisdiction"
          ? { jurisdictions: widened as SourceCatalogueFilters["jurisdictions"] }
          : key === "topic"
            ? { topics: [...widened] }
            : { usedBy: widened as SourceCatalogueFilters["usedBy"] }),
    };
    return filterAndSortSourceCatalogue(entries, candidate).length;
  };

  const facetOptions = (key: FacetKey, values: readonly string[], format: (value: string) => string) =>
    values.map((value) => {
      const count = optionCount(key, value);
      return {
        value,
        label: format(value),
        hint: `${count} ${count === 1 ? "source" : "sources"}`,
        hintLabel: String(count),
        disabled: count === 0 && !selectedValues(key).includes(value),
      };
    });

  const bandGroup = resultFilterFacetGroup({
    id: "source-band",
    label: "Quality band",
    description: "Organisational review rating. It is not a clinical endorsement.",
    selected: new Set(filters.bands),
    options: facetOptions(
      "band",
      uniqueSorted(entries.map((entry) => entry.rating.band)),
      (value) => bandLabels[value as SourceQualityBand] ?? titleCase(value),
    ),
    onToggle: (value) => toggleFacet("band", value),
  });
  const jurisdictionGroup = resultFilterFacetGroup({
    id: "source-jurisdiction",
    label: "Jurisdiction",
    selected: new Set(filters.jurisdictions),
    options: facetOptions(
      "jurisdiction",
      uniqueSorted(entries.map((entry) => entry.geography.scope)),
      jurisdictionLabel,
    ),
    onToggle: (value) => toggleFacet("jurisdiction", value),
  });
  const topicGroup = resultFilterFacetGroup({
    id: "source-topic",
    label: "Topic",
    selected: new Set(filters.topics),
    options: facetOptions("topic", uniqueSorted(entries.flatMap((entry) => entry.topics)), titleCase),
    onToggle: (value) => toggleFacet("topic", value),
  });
  const usedByGroup = resultFilterFacetGroup({
    id: "source-used-by",
    label: "Used in",
    description: "The part of PsychSift whose records cite the source.",
    selected: new Set(filters.usedBy),
    options: facetOptions(
      "usedBy",
      uniqueSorted(entries.flatMap((entry) => entry.usedBy.map((usage) => usage.modeId))),
      (value) => modeLabel(value as AppModeId),
    ),
    onToggle: (value) => toggleFacet("usedBy", value),
  });
  const sortGroup = resultFilterGroup({
    id: "source-order",
    label: "Order",
    note: "one only",
    value: filters.sort,
    options: [
      { value: "quality", label: "Quality band" },
      { value: "title", label: "Title" },
      { value: "currency", label: "Most recently current" },
    ],
    onChange: (value) => setParamValues("sort", value === "quality" ? [] : [value]),
  });

  const appliedFilters: AppliedFilterChip[] = chipGroups.flatMap((group) => {
    const values = filters[group.field];
    if (!Array.isArray(values)) return [];
    return values.map((value: string) => ({
      id: `${group.key}-${value}`,
      groupLabel: group.label,
      valueLabel: group.format(value),
      onRemove: () => removeFilterValue(group.key, value),
    }));
  });

  const activeFilterCount = appliedFilters.length;
  const clearFilters = () => {
    const next = new URLSearchParams();
    const query = searchParams.get("q");
    if (query) next.set("q", query);
    const suffix = next.toString();
    router.replace(`${pathname}${suffix ? `?${suffix}` : ""}`, { scroll: false });
  };

  const filterTrigger = (testId: string) => (
    <ResultFilterTrigger
      panelId={filterPanelId}
      testId={testId}
      title="Filter sources"
      open={filterOpen}
      activeCount={activeFilterCount}
      onToggle={() => setFilterOpen((current) => !current)}
    />
  );

  return (
    <SearchResultsLayout
      testId="sources-catalogue-main"
      resultsLabel="Source results"
      footer={<UniversalSearchAlsoMatches modeId="sources" query={filters.q ?? ""} />}
      header={
        <>
          {/* The band's own heading is the query, which a browse visit does not
              have. The page still needs a name in the outline. */}
          <h1 className="sr-only">Source catalogue</h1>
          <SearchResultsHeaderBand
            modeId="sources"
            query={filters.q}
            matchCount={visibleEntries.length}
            status="ready"
            resultNoun={visibleEntries.length === 1 ? "source" : "sources"}
            hideEmptyQuery
            emptyQueryLabel="Source catalogue"
            filterLabel="Filter sources"
            appliedFilters={appliedFilters}
            onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
            mobileControlsPlacement="inline"
            mobileControls={filterTrigger("sources-filter-trigger-phone")}
            utilityControls={
              <span className="hidden items-center gap-2 sm:inline-flex">
                {filterTrigger("sources-filter-trigger-desktop")}
              </span>
            }
          />
          <ResultFilterSheet
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            panelId={filterPanelId}
            testId="sources-filter-sheet"
            title="Filter sources"
            description="Narrow the catalogue by rating, jurisdiction, topic, or the part of PsychSift that uses the source."
            groups={[bandGroup, jurisdictionGroup, topicGroup, usedByGroup, sortGroup]}
            onClearAll={activeFilterCount > 0 ? clearFilters : undefined}
            summary={{ count: visibleEntries.length, noun: visibleEntries.length === 1 ? "source" : "sources" }}
            chromeResetKey={filters.q}
          />
          {/* One quiet line, not the bordered banner this replaced. The count
              above it is wrong while the hosted-document loader is unreachable,
              and a count a reader cannot tell is partial is worse than no count. */}
          {hostedDocuments === "unavailable" ? (
            <p
              role="note"
              data-testid="sources-partial-catalogue-note"
              className="pt-2 text-2xs font-semibold text-[color:var(--warning-text,var(--text-muted))]"
            >
              Uploaded document sources cannot be reached, so this list and its count are incomplete.
            </p>
          ) : null}
        </>
      }
    >
      {visibleEntries.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleEntries.map((entry) => (
            <SourceTile key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <SearchResultsEmptyState
          modeId="sources"
          query={filters.q}
          appliedFilters={appliedFilters}
          onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
          onClearSearch={() => router.push(appModeHomeHref("sources", { focus: true }))}
          onTryExample={(example) => router.push(appModeHomeHref("sources", { query: example, run: true }))}
        />
      )}
    </SearchResultsLayout>
  );
}
