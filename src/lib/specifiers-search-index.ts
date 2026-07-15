// Client-safe search layer for the full DSM-5-TR specifier catalog.
//
// The full nested dataset (data/specifiers-content.json, ~632KB) is only ever
// imported by server components (detail pages, see specifiers-content.ts). For
// the client-side instant search on /specifiers we ship a compact, pre-flattened
// index (data/specifiers-search-index.json, ~240KB) so the browser bundle stays
// lean. The index is regenerated from the source JSON by scripts/build-specifiers
// -index (kept in sync with data/specifiers-content.json).

import searchIndex from "../../data/specifiers-search-index.json";

import { normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";

export type SpecifierSourceStatus = "source-verified" | "source-needs-formal-review" | "source-not-applicable";
export type SpecifierDefinitionStatus = "defined" | "obvious-no-definition" | "needs-manual-or-clinician-verification";

export type SpecifierIndexItem = {
  slug: string;
  label: string;
  disorder: string;
  categoryId: string;
  category: string;
  group: string;
  /** sourceVerificationStatus */
  src: SpecifierSourceStatus;
  /** definitionStatus */
  def: SpecifierDefinitionStatus;
  /** definition.meaning ("" when the item has no generated definition) */
  meaning: string;
};

export type SpecifierIndexCategory = { id: string; name: string };

export type SpecifierIndexMeta = {
  appName: string;
  version: string;
  contentVersion: string;
  lastUpdated: string;
  reviewStatus: string;
  scope: string;
  disclaimer: string;
  scopeWarning: string;
  stats: {
    categories: number;
    disorders: number;
    groups: number;
    specifierItems: number;
    universalSpecifiers: number;
    itemsWithDefinitions: number;
    itemsPendingClinicianReview: number;
  };
  sourceVerified: number;
};

type SpecifierSearchIndex = {
  meta: SpecifierIndexMeta;
  categories: SpecifierIndexCategory[];
  items: SpecifierIndexItem[];
};

const index = searchIndex as SpecifierSearchIndex;

export const specifierIndexMeta: SpecifierIndexMeta = index.meta;
export const specifierIndexCategories: SpecifierIndexCategory[] = index.categories;
export const specifierIndexItems: SpecifierIndexItem[] = index.items;

/** Items whose source has been formally verified (the meaningful "reviewed" cut). */
export const specifierVerifiedCount = specifierIndexMeta.sourceVerified;
/** All catalog items are pending qualified clinician review in this dataset. */
export const specifierPendingReviewCount = specifierIndexMeta.stats.itemsPendingClinicianReview;

/** Short, catalog-tuned starting queries for the home hero chips. */
export const specifierCatalogPresets: Array<{ label: string; query: string }> = [
  { label: "Anxious distress", query: "anxious distress" },
  { label: "Melancholic features", query: "melancholic" },
  { label: "Rapid cycling", query: "rapid cycling" },
  { label: "Seasonal pattern", query: "seasonal" },
  { label: "Peripartum onset", query: "peripartum" },
  { label: "In remission", query: "remission" },
];

export type SpecifierCatalogFilters = {
  categoryId?: string;
  /** Restrict to source-verified items only. */
  reviewedOnly?: boolean;
};

export type SpecifierCatalogMatch = { item: SpecifierIndexItem; score: number };

function applyFilters(items: SpecifierIndexItem[], filters: SpecifierCatalogFilters) {
  let next = items;
  if (filters.categoryId) next = next.filter((item) => item.categoryId === filters.categoryId);
  if (filters.reviewedOnly) next = next.filter((item) => item.src === "source-verified");
  return next;
}

/**
 * Rank the catalog for a free-text query, reusing the shared registry ranker
 * (src/lib/catalog-search.ts) so tokenization/weighting matches the other modes.
 * With an empty query it returns the filtered catalog in stable (label) order.
 */
export function searchSpecifierCatalog(query: string, filters: SpecifierCatalogFilters = {}): SpecifierCatalogMatch[] {
  const items = applyFilters(specifierIndexItems, filters);
  const trimmed = query.trim();

  if (!trimmed) {
    return [...items]
      .sort((left, right) => left.label.localeCompare(right.label) || left.disorder.localeCompare(right.disorder))
      .map((item) => ({ item, score: 0 }));
  }

  // The ranker compares its bonuses against a lowercased/normalized query, so the
  // field, full-text, exact, and prefix haystacks must be normalized the same way
  // (mirroring the other catalog callers) — otherwise a lowercase query like "mild"
  // misses the exact/prefix/phrase bonuses on a capitalized "Mild" label.
  return rankCatalogRecords(items, trimmed, {
    fields: [
      { id: "label", weight: 9, text: (item) => normalizeSearchText(item.label) },
      { id: "disorder", weight: 5, text: (item) => normalizeSearchText(item.disorder) },
      { id: "category", weight: 2, text: (item) => normalizeSearchText(item.category) },
      { id: "group", weight: 2, text: (item) => normalizeSearchText(item.group) },
    ],
    fullText: (item) =>
      normalizeSearchText(`${item.label} ${item.disorder} ${item.category} ${item.group} ${item.meaning}`),
    exactValues: (item) => [normalizeSearchText(item.label)],
    prefixValues: (item) => [normalizeSearchText(item.label)],
    prefixBonus: 3,
    phraseBonus: 5,
  }).map(({ record, score }) => ({ item: record, score }));
}
