import type { AppModeId } from "@/lib/app-modes";
import type {
  ClinicalSourceCatalogueEntry,
  ClinicalSourceReferenceInput,
  ClinicalSourceType,
  SourceCatalogueFilters,
  SourceGeographyScope,
  SourceLifecycleStatus,
  SourceQualityBand,
} from "@/lib/sources/catalogue-types";

type ReadableSearchParams = Pick<URLSearchParams, "get" | "getAll">;
const BAND_ORDER = { A: 0, B: 1, C: 2, D: 3, excluded: 4 } as const;

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en-AU", { sensitivity: "base" }) || left.localeCompare(right, "en-AU");
}

function compareQuality(left: ClinicalSourceCatalogueEntry, right: ClinicalSourceCatalogueEntry) {
  return (
    BAND_ORDER[left.rating.band] - BAND_ORDER[right.rating.band] ||
    right.rating.score - left.rating.score ||
    right.rating.dimensions.australianApplicability - left.rating.dimensions.australianApplicability ||
    right.rating.dimensions.currency - left.rating.dimensions.currency ||
    compareText(left.title, right.title) ||
    compareText(left.id, right.id)
  );
}

function valuesFrom(params: ReadableSearchParams, key: string) {
  return params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueKnown<T extends string>(values: readonly string[], known: ReadonlySet<T>): T[] {
  return [...new Set(values.filter((value): value is T => known.has(value as T)))];
}

function presentValues<T extends string>(values: readonly (T | null)[]) {
  return new Set(values.filter((value): value is T => Boolean(value)));
}

export function parseSourceCatalogueFilters(
  params: ReadableSearchParams,
  entries: readonly ClinicalSourceCatalogueEntry[],
): SourceCatalogueFilters {
  const sortValue = params.get("sort");
  return {
    q: (params.get("q") ?? "").trim(),
    bands: uniqueKnown<SourceQualityBand>(
      valuesFrom(params, "band"),
      presentValues(entries.map((entry) => entry.rating.band)),
    ),
    jurisdictions: uniqueKnown<SourceGeographyScope>(
      valuesFrom(params, "jurisdiction"),
      presentValues(entries.map((entry) => entry.geography.scope)),
    ),
    sourceTypes: uniqueKnown<ClinicalSourceType>(
      valuesFrom(params, "type"),
      presentValues(entries.map((entry) => entry.sourceType)),
    ),
    publishers: uniqueKnown(valuesFrom(params, "publisher"), presentValues(entries.map((entry) => entry.publisher))),
    topics: uniqueKnown(valuesFrom(params, "topic"), presentValues(entries.flatMap((entry) => entry.topics))),
    lifecycleStatuses: uniqueKnown<SourceLifecycleStatus>(
      valuesFrom(params, "lifecycle"),
      presentValues(entries.map((entry) => entry.lifecycleStatus)),
    ),
    documentStatuses: uniqueKnown<ClinicalSourceReferenceInput["documentStatus"]>(
      valuesFrom(params, "status"),
      presentValues(entries.map((entry) => entry.documentStatus)),
    ),
    validationStatuses: uniqueKnown<ClinicalSourceReferenceInput["validationStatus"]>(
      valuesFrom(params, "validation"),
      presentValues(entries.map((entry) => entry.validationStatus)),
    ),
    usedBy: uniqueKnown<AppModeId>(
      valuesFrom(params, "usedBy"),
      presentValues(entries.flatMap((entry) => entry.usedBy.map((usage) => usage.modeId))),
    ),
    sort: sortValue === "title" || sortValue === "currency" ? sortValue : "quality",
  };
}

function normalizeSearchValue(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-AU").replace(/\s+/g, " ");
}

function matchesAny<T>(selection: readonly T[], values: readonly T[]) {
  return selection.length === 0 || values.some((value) => selection.includes(value));
}

function matchesFilters(entry: ClinicalSourceCatalogueEntry, filters: SourceCatalogueFilters) {
  const query = normalizeSearchValue(filters.q);
  if (
    query &&
    ![entry.title, ...entry.aliases, entry.publisher ?? "", ...entry.topics]
      .map(normalizeSearchValue)
      .some((value) => value.includes(query))
  ) {
    return false;
  }
  if (!matchesAny(filters.bands, [entry.rating.band])) return false;
  if (!matchesAny(filters.jurisdictions, [entry.geography.scope])) return false;
  if (!matchesAny(filters.sourceTypes, [entry.sourceType])) return false;
  if (!matchesAny(filters.publishers, entry.publisher ? [entry.publisher] : [])) return false;
  if (!matchesAny(filters.topics, entry.topics)) return false;
  if (!matchesAny(filters.lifecycleStatuses, [entry.lifecycleStatus])) return false;
  if (!matchesAny(filters.documentStatuses, [entry.documentStatus])) return false;
  if (!matchesAny(filters.validationStatuses, [entry.validationStatus])) return false;
  if (
    !matchesAny(
      filters.usedBy,
      entry.usedBy.map((usage) => usage.modeId),
    )
  )
    return false;
  return true;
}

function dateValue(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function mostRecentDate(entry: ClinicalSourceCatalogueEntry) {
  return Math.max(dateValue(entry.publicationDate), dateValue(entry.reviewDate), dateValue(entry.expiryDate));
}

export function filterAndSortSourceCatalogue(
  entries: readonly ClinicalSourceCatalogueEntry[],
  filters: SourceCatalogueFilters,
) {
  const filtered = entries.filter((entry) => matchesFilters(entry, filters));
  return filtered.sort((left, right) => {
    if (filters.sort === "title") {
      return compareText(left.title, right.title) || compareText(left.id, right.id);
    }
    if (filters.sort === "currency") {
      return (
        right.rating.dimensions.currency - left.rating.dimensions.currency ||
        mostRecentDate(right) - mostRecentDate(left) ||
        compareQuality(left, right)
      );
    }
    return compareQuality(left, right);
  });
}

function countValues(values: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => compareText(left.value, right.value));
}

export function deriveSourceCatalogueFacets(entries: readonly ClinicalSourceCatalogueEntry[]) {
  return {
    total: entries.length,
    australian: entries.filter(
      (entry) => entry.geography.scope !== "international" && entry.geography.scope !== "unknown",
    ).length,
    reviewRequired: entries.filter((entry) => entry.rating.band === "D").length,
    inactiveOrExcluded: entries.filter((entry) => entry.lifecycleStatus !== "active").length,
    topics: countValues(entries.flatMap((entry) => entry.topics)),
    publishers: countValues(entries.map((entry) => entry.publisher).filter((value): value is string => Boolean(value))),
  };
}
