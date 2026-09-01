"use client";

import Link from "next/link";
import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";
import { eyebrowText, fieldControlPlain } from "@/components/ui-primitives";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { ClinicalSourceCatalogueEntry, SourceQualityBand } from "@/lib/sources/catalogue-types";
import {
  deriveSourceCatalogueFacets,
  filterAndSortSourceCatalogue,
  parseSourceCatalogueFilters,
} from "@/lib/sources/catalogue-view";

type HostedDocumentsStatus = "available" | "unavailable";

const bandLabels: Record<SourceQualityBand, string> = {
  A: "A · Preferred",
  B: "B · Strong",
  C: "C · Supplementary",
  D: "D · Review required",
  excluded: "Excluded",
};

const filterClassName = fieldControlPlain;

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function canonicalLocationLabel(entry: ClinicalSourceCatalogueEntry) {
  if (entry.canonicalLocation.kind === "url") return entry.canonicalLocation.href;
  if (entry.canonicalLocation.kind === "document") return "Accessible hosted document";
  if (entry.canonicalLocation.kind === "dataset") return entry.canonicalLocation.label;
  return "Not provided";
}

function SourceSummary({ entry }: { entry: ClinicalSourceCatalogueEntry }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[color:var(--text)]">{bandLabels[entry.rating.band]}</span>
        <span className="text-xs text-[color:var(--text-muted)]">Score {entry.rating.score}/100</span>
      </div>
      <Link
        href={`/sources/${entry.id}`}
        aria-label={`View source details: ${entry.title}`}
        className="font-semibold text-[color:var(--primary)] underline-offset-4 hover:underline"
      >
        {entry.title}
      </Link>
      <p className="text-sm text-[color:var(--text-muted)]">
        {entry.publisher ?? "Publisher unknown"} · {entry.geography.label}
      </p>
      <p className="text-sm text-[color:var(--text-muted)]">
        {canonicalLocationLabel(entry)} · {titleCase(entry.documentStatus)} · reviewed {formatDate(entry.reviewDate)}
      </p>
      {entry.warnings.length > 0 ? (
        <p className="text-sm font-medium text-[color:var(--warning-text,var(--text))]">
          Review: {entry.warnings.map(titleCase).join(", ")}
        </p>
      ) : null}
      <p className="text-xs text-[color:var(--text-muted)]">
        Used by {entry.usedBy.map((usage) => usage.recordLabel).join(", ") || "no registered application records"}
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  selectedValues,
  options,
  onChange,
}: {
  label: string;
  selectedValues: readonly string[];
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const value = selectedValues.length === 1 ? selectedValues[0] : "";
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[color:var(--text)]">
      <span>{label}</span>
      <select
        className={filterClassName}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{selectedValues.length > 1 ? `${selectedValues.length} selected` : "All"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en-AU", { sensitivity: "base" }));
}

export function SourcesCatalogueClient({
  entries,
  hostedDocuments,
}: {
  entries: readonly ClinicalSourceCatalogueEntry[];
  hostedDocuments: HostedDocumentsStatus;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseSourceCatalogueFilters(searchParams, entries), [entries, searchParams]);
  const visibleEntries = useMemo(() => filterAndSortSourceCatalogue(entries, filters), [entries, filters]);
  const facets = useMemo(() => deriveSourceCatalogueFacets(entries), [entries]);

  const replaceFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(key);
    if (value) next.append(key, value);
    const suffix = next.toString();
    router.replace(`${pathname}${suffix ? `?${suffix}` : ""}`, { scroll: false });
  };

  const removeFilterValue = (key: string, value: string) => {
    const next = new URLSearchParams();
    for (const [candidateKey, candidateValue] of searchParams.entries()) {
      if (candidateKey !== key) {
        next.append(candidateKey, candidateValue);
        continue;
      }
      for (const sibling of candidateValue
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item && item !== value)) {
        next.append(candidateKey, sibling);
      }
    }
    const suffix = next.toString();
    router.replace(`${pathname}${suffix ? `?${suffix}` : ""}`, { scroll: false });
  };

  const hasActiveFilter =
    Boolean(filters.q) ||
    filters.bands.length > 0 ||
    filters.jurisdictions.length > 0 ||
    filters.sourceTypes.length > 0 ||
    filters.publishers.length > 0 ||
    filters.topics.length > 0 ||
    filters.lifecycleStatuses.length > 0 ||
    filters.documentStatuses.length > 0 ||
    filters.validationStatuses.length > 0 ||
    filters.usedBy.length > 0 ||
    filters.sort !== "quality";

  const options = {
    bands: uniqueSorted(entries.map((entry) => entry.rating.band)).map((value) => ({
      value,
      label: bandLabels[value as SourceQualityBand],
    })),
    jurisdictions: uniqueSorted(entries.map((entry) => entry.geography.scope)).map((value) => ({
      value,
      label: titleCase(value),
    })),
    types: uniqueSorted(entries.map((entry) => entry.sourceType)).map((value) => ({ value, label: titleCase(value) })),
    publishers: uniqueSorted(entries.flatMap((entry) => (entry.publisher ? [entry.publisher] : []))).map((value) => ({
      value,
      label: value,
    })),
    topics: uniqueSorted(entries.flatMap((entry) => entry.topics)).map((value) => ({ value, label: titleCase(value) })),
    lifecycle: uniqueSorted(entries.map((entry) => entry.lifecycleStatus)).map((value) => ({
      value,
      label: titleCase(value),
    })),
    statuses: uniqueSorted(entries.map((entry) => entry.documentStatus)).map((value) => ({
      value,
      label: titleCase(value),
    })),
    validation: uniqueSorted(entries.map((entry) => entry.validationStatus)).map((value) => ({
      value,
      label: titleCase(value),
    })),
    usages: uniqueSorted(entries.flatMap((entry) => entry.usedBy.map((usage) => usage.modeId))).map((value) => ({
      value,
      label: titleCase(value),
    })),
  };
  const activeFilterGroups = [
    { key: "band", label: "Quality band", values: filters.bands, options: options.bands },
    {
      key: "jurisdiction",
      label: "Jurisdiction",
      values: filters.jurisdictions,
      options: options.jurisdictions,
    },
    { key: "type", label: "Source type", values: filters.sourceTypes, options: options.types },
    { key: "publisher", label: "Publisher", values: filters.publishers, options: options.publishers },
    { key: "topic", label: "Topic", values: filters.topics, options: options.topics },
    { key: "lifecycle", label: "Lifecycle", values: filters.lifecycleStatuses, options: options.lifecycle },
    { key: "status", label: "Currentness", values: filters.documentStatuses, options: options.statuses },
    { key: "validation", label: "Validation", values: filters.validationStatuses, options: options.validation },
    { key: "usedBy", label: "Application usage", values: filters.usedBy, options: options.usages },
  ];

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <p className={eyebrowText}>Traceability</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--text)]">Sources</h1>
        <p className="max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
          Browse the clinical sources registered across the application. Ratings organise review work and do not measure
          factual truth.
        </p>
      </header>

      <SearchResultsHeaderBand
        modeId="sources"
        query={filters.q}
        matchCount={visibleEntries.length}
        status="ready"
        resultNoun={visibleEntries.length === 1 ? "source" : "sources"}
        hideEmptyQuery
        emptyQueryLabel="Sources catalogue filters"
      />

      {hostedDocuments === "unavailable" ? (
        <div
          role="note"
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm"
        >
          <p className="font-semibold">Hosted document sources are temporarily unavailable</p>
          <p className="mt-1 text-[color:var(--text-muted)]">
            Repository sources remain available; this catalogue is not a complete hosted-document count.
          </p>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Visible sources", `${visibleEntries.length} of ${facets.total}`],
          ["Australian", String(facets.australian)],
          ["Review required", String(facets.reviewRequired)],
          ["Inactive or excluded", String(facets.inactiveOrExcluded)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-[color:var(--text)]">{value}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="source-filters-heading"
        className="grid gap-4 rounded-2xl border border-[color:var(--border)] p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="source-filters-heading" className="text-lg font-semibold">
            Filter catalogue
          </h2>
          {hasActiveFilter ? (
            <button
              type="button"
              className="min-h-12 rounded-xl border border-[color:var(--border)] px-4 text-sm font-semibold hover:bg-[color:var(--surface)]"
              onClick={() => router.replace(pathname, { scroll: false })}
            >
              Reset filters
            </button>
          ) : null}
        </div>
        {activeFilterGroups.some((group) => group.values.length > 0) ? (
          <div className="grid gap-2" aria-label="Active source filters">
            <span className="text-sm font-medium text-[color:var(--text)]">Active filters</span>
            <ul className="flex flex-wrap gap-2">
              {activeFilterGroups.flatMap((group) =>
                group.values.map((value) => {
                  const valueLabel = group.options.find((option) => option.value === value)?.label ?? titleCase(value);
                  return (
                    <li key={`${group.key}:${value}`}>
                      <button
                        type="button"
                        className="min-h-12 rounded-full border border-[color:var(--border)] px-3 text-sm hover:bg-[color:var(--surface)]"
                        aria-label={`Remove ${group.label.toLowerCase()}: ${valueLabel}`}
                        onClick={() => removeFilterValue(group.key, value)}
                      >
                        {group.label}: {valueLabel} ×
                      </button>
                    </li>
                  );
                }),
              )}
            </ul>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            label="Filter by quality band"
            selectedValues={filters.bands}
            options={options.bands}
            onChange={(value) => replaceFilter("band", value)}
          />
          <FilterSelect
            label="Filter by jurisdiction"
            selectedValues={filters.jurisdictions}
            options={options.jurisdictions}
            onChange={(value) => replaceFilter("jurisdiction", value)}
          />
          <FilterSelect
            label="Filter by source type"
            selectedValues={filters.sourceTypes}
            options={options.types}
            onChange={(value) => replaceFilter("type", value)}
          />
          <FilterSelect
            label="Filter by publisher"
            selectedValues={filters.publishers}
            options={options.publishers}
            onChange={(value) => replaceFilter("publisher", value)}
          />
          <FilterSelect
            label="Filter by topic"
            selectedValues={filters.topics}
            options={options.topics}
            onChange={(value) => replaceFilter("topic", value)}
          />
          <FilterSelect
            label="Filter by lifecycle"
            selectedValues={filters.lifecycleStatuses}
            options={options.lifecycle}
            onChange={(value) => replaceFilter("lifecycle", value)}
          />
          <FilterSelect
            label="Filter by currentness"
            selectedValues={filters.documentStatuses}
            options={options.statuses}
            onChange={(value) => replaceFilter("status", value)}
          />
          <FilterSelect
            label="Filter by validation"
            selectedValues={filters.validationStatuses}
            options={options.validation}
            onChange={(value) => replaceFilter("validation", value)}
          />
          <FilterSelect
            label="Filter by application usage"
            selectedValues={filters.usedBy}
            options={options.usages}
            onChange={(value) => replaceFilter("usedBy", value)}
          />
          <label className="grid gap-1.5 text-sm font-medium text-[color:var(--text)]">
            <span>Sort sources</span>
            <select
              className={filterClassName}
              aria-label="Sort sources"
              value={filters.sort}
              onChange={(event) => replaceFilter("sort", event.target.value === "quality" ? "" : event.target.value)}
            >
              <option value="quality">Quality</option>
              <option value="title">Title</option>
              <option value="currency">Currency</option>
            </select>
          </label>
        </div>
      </section>

      {visibleEntries.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[color:var(--border)] p-8 text-center">
          <h2 className="text-lg font-semibold">No sources match these filters</h2>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Reset the catalogue filters or broaden the shared search query.
          </p>
        </section>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-[color:var(--border)] md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[color:var(--surface)] text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
                <tr>
                  <th className="p-4">Quality and source</th>
                  <th className="p-4">Publisher</th>
                  <th className="p-4">Location and currency</th>
                  <th className="p-4">Warnings and usage</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-[color:var(--border)] align-top">
                    <td className="p-4">
                      <SourceSummary entry={entry} />
                    </td>
                    <td className="p-4">{entry.publisher ?? "Unknown"}</td>
                    <td className="p-4">
                      {entry.geography.label}
                      <br />
                      <span className="text-[color:var(--text-muted)]">{titleCase(entry.documentStatus)}</span>
                    </td>
                    <td className="p-4">
                      {entry.warnings.length ? entry.warnings.map(titleCase).join(", ") : "No catalogue warnings"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {visibleEntries.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-[color:var(--border)] p-4">
                <SourceSummary entry={entry} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
