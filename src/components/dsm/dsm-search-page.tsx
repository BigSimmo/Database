"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { BookOpenCheck, Check, ChevronRight, CircleAlert, GitCompareArrows, SearchX } from "lucide-react";

import {
  SearchResultsHeaderBand,
  type AppliedFilterChip,
} from "@/components/clinical-dashboard/search-results-header-band";
import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { mobileComposerVisibleReserve } from "@/components/clinical-dashboard/mobile-composer-reserve";
import { cardPadding, cardSurface, focusRing } from "@/components/card-recipes";
import { cn, codeText, EmptyState, metadataPill, pageContainer } from "@/components/ui-primitives";
import type { DsmCategory, DsmDiagnosisSummary } from "@/lib/dsm";
import { readResultFilterValues, replaceResultFilterUrl, writeResultFilterValues } from "@/lib/result-filter-url";

/** cardSelected encoding with clinical accent — DSM forbids per-category colour tokens. */
const dsmCardSelected =
  "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] shadow-[var(--e2)]";

function compareHref(slugs: string[]) {
  const params = new URLSearchParams({ ids: slugs.join(",") });
  return `/dsm/compare?${params.toString()}`;
}

function DsmSearchResultCard({
  result,
  isSelected,
  onToggle,
}: {
  result: DsmDiagnosisSummary;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      data-testid="dsm-search-result"
      className={cn(
        cardSurface,
        cardPadding.compact,
        "relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2.5 overflow-hidden transition motion-reduce:transition-none sm:items-start",
        "hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--e2)]",
        isSelected && dsmCardSelected,
      )}
    >
      {isSelected ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[color:var(--clinical-accent)]"
        />
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isSelected}
        aria-label={`${isSelected ? "Remove" : "Add"} ${result.title} ${isSelected ? "from" : "to"} comparison`}
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          isSelected
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
            : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--decoration-soft)] hover:border-[color:var(--clinical-accent)]",
        )}
      >
        {isSelected ? <Check className="h-4 w-4" aria-hidden /> : <GitCompareArrows className="h-4 w-4" aria-hidden />}
      </button>
      <Link
        href={`/dsm/diagnoses/${result.slug}`}
        aria-label={`Open ${result.title}`}
        className={cn("group min-w-0 rounded-md", focusRing)}
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-extrabold leading-5 text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)] sm:text-base-minus">
              {result.title}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
              {result.summary}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={metadataPill}>{result.category.label}</span>
              <span className={cn(metadataPill, codeText)}>{result.icd_code}</span>
            </div>
          </div>
          <ChevronRight
            className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--decoration-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--clinical-accent)] motion-reduce:transform-none"
            aria-hidden
          />
        </div>
      </Link>
    </article>
  );
}

function DsmMobileCompareStrip({ selected }: { selected: string[] }) {
  if (!selected.length) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[var(--z-chrome)] px-4 lg:hidden"
      style={{ bottom: mobileComposerVisibleReserve.shellDock }}
    >
      <Link
        href={compareHref(selected)}
        data-testid="dsm-search-compare-mobile"
        className="pointer-events-auto inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--e1)] transition hover:bg-[color:var(--command-hover)]"
      >
        <GitCompareArrows className="h-4 w-4 shrink-0" aria-hidden />
        Compare
        <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[color:var(--command-contrast)]/20 px-1.5 text-xs font-extrabold tabular-nums">
          {selected.length}
        </span>
      </Link>
    </div>
  );
}

export function DsmSearchPage({
  query,
  categories,
  results: queryResults,
  initialIds = [],
}: {
  query: string;
  categories: DsmCategory[];
  results: DsmDiagnosisSummary[];
  initialIds?: string[];
  /** Retained for older server/test callers; filtering now uses the query-matched summaries. */
  totalCount?: number;
}) {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string[]>(initialIds.slice(0, 3));
  const [filterOpen, setFilterOpen] = useState(false);
  const filterPanelId = useId();
  const categoryKeys = useMemo(() => new Set(categories.map((item) => item.key)), [categories]);
  const selectedCategories = new Set(readResultFilterValues(searchParams, "category", categoryKeys));
  const supportValues = new Set(["specifiers", "differentials"] as const);
  const selectedSupport = new Set(readResultFilterValues(searchParams, "support", supportValues));
  const filterDiagnoses = (
    categorySelection: ReadonlySet<string>,
    supportSelection: ReadonlySet<"specifiers" | "differentials">,
  ) =>
    queryResults.filter((result) => {
      if (categorySelection.size > 0 && !categorySelection.has(result.category.key)) return false;
      if (supportSelection.has("specifiers") && result.specifierCount === 0) return false;
      if (supportSelection.has("differentials") && result.differentialCount === 0) return false;
      return true;
    });
  const results = filterDiagnoses(selectedCategories, selectedSupport);
  const activeFilterCount = selectedCategories.size + selectedSupport.size;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const canCompare = selected.length >= 2;

  function toggleCategory(value: string) {
    replaceResultFilterUrl((params) => {
      const current = new Set(readResultFilterValues(params, "category", categoryKeys));
      if (!current.delete(value)) current.add(value);
      writeResultFilterValues(params, "category", current, categoryKeys);
    });
  }

  function toggleSupport(value: "specifiers" | "differentials") {
    replaceResultFilterUrl((params) => {
      const current = new Set(readResultFilterValues(params, "support", supportValues));
      if (!current.delete(value)) current.add(value);
      writeResultFilterValues(params, "support", current, supportValues);
    });
  }

  function clearFilters() {
    replaceResultFilterUrl((params) => {
      params.delete("category");
      params.delete("support");
    });
  }

  const appliedFilters: AppliedFilterChip[] = [
    ...[...selectedCategories].map((key) => ({
      id: `category-${key}`,
      groupLabel: "Category",
      valueLabel: categories.find((item) => item.key === key)?.label ?? key,
      onRemove: () => toggleCategory(key),
    })),
    ...[...selectedSupport].map((support) => ({
      id: `support-${support}`,
      groupLabel: "Support",
      valueLabel: support === "specifiers" ? "Has specifiers" : "Has differential guidance",
      onRemove: () => toggleSupport(support),
    })),
  ];

  const filterGroups = [
    resultFilterFacetGroup({
      id: "category",
      label: "Category",
      description: "Select one or more query-matched diagnostic categories.",
      selected: selectedCategories,
      options: categories.map((category) => {
        const next = new Set(selectedCategories);
        if (!next.has(category.key)) next.add(category.key);
        const count = filterDiagnoses(next, selectedSupport).length;
        return {
          value: category.key,
          label: category.label,
          hint: String(count),
          disabled: count === 0 && !selectedCategories.has(category.key),
        };
      }),
      onToggle: toggleCategory,
    }),
    resultFilterFacetGroup({
      id: "has-specifiers",
      label: "Specifier support",
      selected: new Set(selectedSupport.has("specifiers") ? ["specifiers"] : []),
      options: [
        {
          value: "specifiers",
          label: "Has specifiers",
          hint: String(filterDiagnoses(selectedCategories, new Set([...selectedSupport, "specifiers"])).length),
        },
      ],
      onToggle: () => toggleSupport("specifiers"),
    }),
    resultFilterFacetGroup({
      id: "has-differentials",
      label: "Differential guidance",
      selected: new Set(selectedSupport.has("differentials") ? ["differentials"] : []),
      options: [
        {
          value: "differentials",
          label: "Has differential guidance",
          hint: String(filterDiagnoses(selectedCategories, new Set([...selectedSupport, "differentials"])).length),
        },
      ],
      onToggle: () => toggleSupport("differentials"),
    }),
  ];

  function toggleDiagnosis(slug: string) {
    setSelected((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      if (current.length >= 3) return [...current.slice(1), slug];
      return [...current, slug];
    });
  }

  return (
    <div data-testid="dsm-search-page" className="min-h-full bg-[color:var(--background)]">
      <div
        className={cn(
          pageContainer,
          "space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8",
          selected.length > 0 && "max-lg:pb-[calc(4rem+var(--safe-area-bottom))]",
        )}
      >
        <SearchResultsHeaderBand
          modeId="dsm"
          query={query}
          matchCount={results.length}
          headingLevel={1}
          filterLabel="Filter diagnoses by category"
          appliedFilters={appliedFilters}
          onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
          mobileControlsPlacement="inline"
          mobileControls={
            <ResultFilterTrigger
              panelId={filterPanelId}
              testId="dsm-category-filter-phone"
              title="Filter DSM diagnoses"
              open={filterOpen}
              activeCount={activeFilterCount}
              onToggle={() => setFilterOpen((current) => !current)}
            />
          }
          utilityControls={
            canCompare ? (
              <Link
                href={compareHref(selected)}
                data-testid="dsm-search-compare"
                className="inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg bg-[color:var(--command)] px-2.5 text-xs font-bold text-[color:var(--command-contrast)] shadow-[var(--e1)] transition hover:bg-[color:var(--command-hover)] sm:min-h-10"
              >
                <GitCompareArrows className="h-4 w-4" aria-hidden />
                Compare {selected.length}
              </Link>
            ) : null
          }
          filterControls={
            <ResultFilterTrigger
              panelId={filterPanelId}
              testId="dsm-category-filter-desktop"
              title="Filter DSM diagnoses"
              open={filterOpen}
              activeCount={activeFilterCount}
              onToggle={() => setFilterOpen((current) => !current)}
            />
          }
        />

        <ResultFilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          panelId={filterPanelId}
          testId="dsm-category-filter-panel"
          title="Filter DSM diagnoses"
          description="Narrow the query-matched summary set without changing diagnosis or comparison content."
          groups={filterGroups}
          onClearAll={activeFilterCount > 0 ? clearFilters : undefined}
          summary={{ count: results.length, noun: results.length === 1 ? "diagnosis" : "diagnoses" }}
        />

        {results.length ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
            <section aria-label="DSM diagnosis results" className="grid gap-3">
              {results.map((result) => (
                <DsmSearchResultCard
                  key={result.slug}
                  result={result}
                  isSelected={selectedSet.has(result.slug)}
                  onToggle={() => toggleDiagnosis(result.slug)}
                />
              ))}
            </section>

            <aside className="hidden gap-3 lg:sticky lg:top-20 lg:grid" aria-label="Comparison selection">
              <section className={cn(cardSurface, "rounded-xl p-4")}>
                <div className="flex items-center gap-2">
                  <GitCompareArrows className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden />
                  <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Compare diagnoses</h2>
                </div>
                <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                  Select two or three records. Selecting a fourth replaces the earliest selection.
                </p>
                {selected.length ? (
                  <ol className="mt-3 grid gap-2">
                    {selected.map((slug, index) => {
                      const item = queryResults.find((result) => result.slug === slug);
                      return (
                        <li
                          key={slug}
                          className="flex items-center gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-2.5 py-2 text-xs font-bold text-[color:var(--text-heading)]"
                        >
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-2xs text-[color:var(--clinical-accent)]">
                            {index + 1}
                          </span>
                          <span className="min-w-0 truncate">{item?.title ?? slug}</span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-[color:var(--border-strong)] px-3 py-2.5 text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    Choose diagnoses from the result list.
                  </p>
                )}
                {canCompare ? (
                  <Link
                    href={compareHref(selected)}
                    className="mt-3 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--e1)] transition hover:bg-[color:var(--command-hover)]"
                  >
                    Compare selected
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
              </section>
              <p className="flex items-start gap-2 px-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                Reference content only. Confirm criteria, exclusions, and clinical context before use.
              </p>
            </aside>
          </div>
        ) : (
          <EmptyState
            icon={SearchX}
            title="No diagnosis matches"
            headingLevel={2}
            body="Try a diagnosis name, ICD code, symptom phrase, or a broader category."
            live="polite"
            actions={
              <Link
                href="/dsm/search"
                className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
              >
                Browse all diagnoses
              </Link>
            }
          />
        )}
      </div>

      <DsmMobileCompareStrip selected={selected} />
    </div>
  );
}
