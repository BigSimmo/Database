import type { SearchScopeFilters } from "@/lib/search-scope";

/**
 * Describe the *server-side* scope filters as removable chips.
 *
 * These are not the smart-tag facets in `document-tags.ts`. Those narrow a match
 * set the client already holds, so they can only ever be derived from documents
 * that came back. Scope filters are applied by `resolveSearchScope` *before*
 * retrieval runs: when they match nothing the API returns `documentIds: []` and
 * an empty result set, so there is no match set left to derive anything from —
 * which is exactly how a scoped-to-zero search used to render as "No matches …
 * check the spelling" with no filter in sight and no control to clear it.
 *
 * Everything here is a pure transform over the filter object so the zero-result
 * state can name the constraint and hand back a relaxed filter set.
 */

type ListFilterKey = {
  [K in keyof SearchScopeFilters]-?: NonNullable<SearchScopeFilters[K]> extends readonly string[] ? K : never;
}[keyof SearchScopeFilters];

/** Group label per filter key. Mirrors the scope fields in `master-search-header.tsx`. */
const listFilterLabels: Record<ListFilterKey, string> = {
  medications: "Medication",
  topics: "Topic",
  documentTypes: "Type",
  sites: "Site",
  services: "Service",
  settings: "Setting",
  populations: "Population",
  risks: "Risk",
  workflows: "Workflow",
  clinicalActions: "Action",
  carePhases: "Phase",
  documentIntents: "Intent",
  contentFeatures: "Feature",
  sourceStatuses: "Status",
  validationStatuses: "Validation",
  extractionQualities: "Extraction",
  importBatchIds: "Import",
  collections: "Collection",
  labelTypesAny: "Has label",
};

const listFilterKeys = Object.keys(listFilterLabels) as ListFilterKey[];

export type ScopeFilterChip = {
  /** Stable identity, also the token `removeScopeFilterValue` resolves. */
  id: string;
  groupLabel: string;
  valueLabel: string;
};

function chipId(key: string, value: string) {
  return `scope:${key}:${value}`;
}

/**
 * Every active scope filter value, in the fixed key order above.
 *
 * `locality` is a single enum rather than a list, so it is described last and
 * removed by clearing the field.
 */
export function scopeFilterChips(filters: SearchScopeFilters | null | undefined): ScopeFilterChip[] {
  if (!filters) return [];
  const chips: ScopeFilterChip[] = [];
  for (const key of listFilterKeys) {
    for (const value of filters[key] ?? []) {
      chips.push({ id: chipId(key, value), groupLabel: listFilterLabels[key], valueLabel: value });
    }
  }
  if (filters.locality) {
    chips.push({
      id: chipId("locality", filters.locality),
      groupLabel: "Locality",
      valueLabel: filters.locality === "local" ? "Local" : "Non-local",
    });
  }
  return chips;
}

/**
 * The filter set with one chip's value removed.
 *
 * Returns a new object and drops a key that empties out, so the result compares
 * equal to `{}` once the last constraint is gone — `activeScopeFilterCount`
 * counts non-empty arrays, and a lingering `topics: []` would keep the search
 * reporting itself as scoped.
 */
export function removeScopeFilterValue(filters: SearchScopeFilters, chipId: string): SearchScopeFilters {
  const next: SearchScopeFilters = { ...filters };
  for (const key of listFilterKeys) {
    const values = next[key];
    if (!values?.length) continue;
    const remaining = values.filter((value) => `scope:${key}:${value}` !== chipId);
    if (remaining.length === values.length) continue;
    if (remaining.length) next[key] = remaining as never;
    else delete next[key];
    return next;
  }
  if (next.locality && `scope:locality:${next.locality}` === chipId) delete next.locality;
  return next;
}
