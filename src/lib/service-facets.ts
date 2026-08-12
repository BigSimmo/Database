import { entryMatchesSelection, partitionSelectionByGroup } from "@/lib/facet-selection";
import type { ServiceRecord } from "@/lib/service-ranker";

/**
 * The services facet engine — `docs/filter-contract.md` PR C.
 *
 * Five of `CatalogServiceTags`' six dimensions are facets here. `substance_flags` is
 * deliberately excluded: every one of the 219 catalogue services carries exactly one of
 * `general`/`aod` (measured 2026-08-12 against `loadServicesSnapshot()`), so it is an exact
 * partition and ships as a `lens` in `services-navigator-page.tsx`, not a facet — rendering it
 * here would claim a service could be both, which the data says it cannot.
 *
 * Built on `ServiceRecord.facets` (the typed carrier), never on the flattened `ServiceRecord.tags`
 * array: `flattenTags` in `service-catalog-mapper.ts` merges five dimensions plus sections,
 * aliases and the id into one deduped array, so a token like `"general"` — which appears in
 * `setting_flags`, `substance_flags` and `housing_flags` with three different meanings —
 * collapses to one indistinguishable entry. A facet filter built on `tags` would be wrong by
 * construction.
 */

export type ServiceFacetGroupId = "catchments" | "age_groups" | "setting_flags" | "acuity_flags" | "housing_flags";

export const serviceFacetGroupIds: ServiceFacetGroupId[] = [
  "catchments",
  "age_groups",
  "setting_flags",
  "acuity_flags",
  "housing_flags",
];

export const serviceFacetGroupLabels: Record<ServiceFacetGroupId, string> = {
  catchments: "Catchment",
  age_groups: "Age group",
  setting_flags: "Setting",
  acuity_flags: "Acuity",
  housing_flags: "Housing",
};

export type ServiceFacetOption = {
  /** `${group}:${value}` — stable, used as the URL round-trip token and the selection key. */
  key: string;
  value: string;
  label: string;
  group: ServiceFacetGroupId;
  count: number;
};

export type ServiceFacetGroup = {
  group: ServiceFacetGroupId;
  options: ServiceFacetOption[];
};

export type ServiceFacetIndex = {
  entries: Array<{ service: ServiceRecord; facetKeys: Set<string> }>;
  groups: ServiceFacetGroup[];
};

export function serviceFacetKey(group: ServiceFacetGroupId, value: string) {
  return `${group}:${value}`;
}

function formatServiceFacetValueLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

/**
 * Derives the option list from the data — never declares it. A dimension with no members in
 * `services` simply contributes no group, which is what keeps the "near-partition"
 * `housing_flags` case (215/219 singleton, 4/219 carry two) and any sparse dimension honest,
 * and is what stops a permanently-empty option from ever reaching the sheet. See
 * `docs/filter-contract.md` §3.
 */
export function buildServiceFacetIndex(services: ServiceRecord[]): ServiceFacetIndex {
  const counts = new Map<string, { group: ServiceFacetGroupId; value: string; count: number }>();
  const entries: ServiceFacetIndex["entries"] = [];

  for (const service of services) {
    const facetKeys = new Set<string>();
    const tags = service.facets;
    if (tags) {
      for (const group of serviceFacetGroupIds) {
        for (const value of tags[group]) {
          if (!value) continue;
          const key = serviceFacetKey(group, value);
          facetKeys.add(key);
          const existing = counts.get(key);
          if (existing) existing.count += 1;
          else counts.set(key, { group, value, count: 1 });
        }
      }
    }
    entries.push({ service, facetKeys });
  }

  const groups: ServiceFacetGroup[] = serviceFacetGroupIds
    .map((group) => ({
      group,
      options: [...counts.values()]
        .filter((entry) => entry.group === group)
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
        .map((entry) => ({
          key: serviceFacetKey(group, entry.value),
          value: entry.value,
          label: formatServiceFacetValueLabel(entry.value),
          group,
          count: entry.count,
        })),
    }))
    .filter((group) => group.options.length > 0);

  return { entries, groups };
}

function serviceFacetKeyGroups(index: ServiceFacetIndex): Map<string, string> {
  const groups = new Map<string, string>();
  for (const group of index.groups) {
    for (const option of group.options) groups.set(option.key, option.group);
  }
  return groups;
}

export function filterServicesByFacetIndex(index: ServiceFacetIndex, selectedKeys: string[]): ServiceRecord[] {
  if (selectedKeys.length === 0) return index.entries.map((entry) => entry.service);
  const byGroup = partitionSelectionByGroup(selectedKeys, serviceFacetKeyGroups(index));
  return index.entries.filter((entry) => entryMatchesSelection(entry.facetKeys, byGroup)).map((entry) => entry.service);
}

/**
 * Re-counts an already-built index against the facets currently selected — the same "how many
 * would I have if I ticked this as well" predicate as the filter itself, because under
 * OR-within-group, adding a key to an already-selected group *widens*, so a count derived by
 * narrowing the current subset would disagree with what the click actually does. Membership and
 * order are left alone: a facet whose count falls to zero as a consequence of the current
 * selection stays in place at zero (rendered as a dead end by the caller) rather than
 * disappearing, so the reader can see which choice narrowed them to nothing. Mirrors
 * `projectSmartTagFacetGroups` in `src/lib/document-tags.ts` — the reference implementation.
 */
export function projectServiceFacetCounts(index: ServiceFacetIndex, selectedKeys: string[]): ServiceFacetGroup[] {
  const selected = [...new Set(selectedKeys)];
  if (selected.length === 0) return index.groups;

  const selectedSet = new Set(selected);
  const keyGroups = serviceFacetKeyGroups(index);
  const byGroup = partitionSelectionByGroup(selected, keyGroups);
  const selectionCount = index.entries.filter((entry) => entryMatchesSelection(entry.facetKeys, byGroup)).length;

  const countWith = (key: string) => {
    if (selectedSet.has(key)) return selectionCount;
    const probe = partitionSelectionByGroup([...selected, key], keyGroups);
    return index.entries.filter((entry) => entryMatchesSelection(entry.facetKeys, probe)).length;
  };

  return index.groups.map((group) => ({
    group: group.group,
    options: group.options.map((option) => ({ ...option, count: countWith(option.key) })),
  }));
}
