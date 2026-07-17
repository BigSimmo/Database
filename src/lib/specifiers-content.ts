// Full DSM-5-TR specifier catalog (server side).
//
// This module imports the complete nested dataset (data/specifiers-content.json).
// It is only imported by server components (the /specifiers/[slug] detail route and
// its reference page) so the full ~632KB payload never reaches the client bundle —
// client-side search uses the compact index in specifiers-search-index.ts instead.
//
// The dataset is a portable clinical-content export; its README states that missing
// definitions must NOT be invented and that the review/scope status must stay visible
// downstream. The rendering layers honour both.

import specifiersContent from "../../data/specifiers-content.json";

import { findSpecifier, specifierRecords, type SpecifierRecord } from "@/lib/specifiers";

export type SpecifierSourceStatus = "source-verified" | "source-needs-formal-review" | "source-not-applicable";
export type SpecifierDefinitionStatus = "defined" | "obvious-no-definition" | "needs-manual-or-clinician-verification";

export type SpecifierReview = {
  rowKey: string;
  contentHash: string;
  sourceFamily?: string;
  sourceVerificationStatus: SpecifierSourceStatus;
  clinicianReviewStatus: string;
  changedSinceReview: boolean;
};

export type SpecifierDefinition = {
  meaning: string;
  clinicalNote: string;
  sourceFamily: string;
  status: string;
};

export type SpecifierItem = {
  label: string;
  definition: SpecifierDefinition | null;
  definitionStatus: SpecifierDefinitionStatus;
  review: SpecifierReview;
};

export type SpecifierGroup = { label: string; items: SpecifierItem[] };
export type SpecifierDisorder = { name: string; icd11Context: string; groups: SpecifierGroup[] };
export type SpecifierCategory = { id: string; name: string; colorToken: string; disorders: SpecifierDisorder[] };

export type UniversalSpecifier = { title: string; description: string; review: SpecifierReview };

export type SpecifierProject = {
  appName: string;
  version: string;
  contentVersion: string;
  lastUpdated: string;
  reviewStatus: string;
  reviewOwner: string;
  reviewCadence: string;
  scope: string;
  disclaimer: string;
};

export type SpecifierStats = {
  categories: number;
  disorders: number;
  groups: number;
  specifierItems: number;
  universalSpecifiers: number;
  itemsWithDefinitions: number;
  itemsPendingClinicianReview: number;
};

export type AuthoritativeSource = { label: string; url: string; note?: string };

export type SpecifiersContent = {
  exportFormatVersion: string;
  exportedAt: string;
  project: SpecifierProject;
  scopeWarning: string;
  stats: SpecifierStats;
  authoritativeSources: AuthoritativeSource[];
  universalSpecifiers: UniversalSpecifier[];
  categories: SpecifierCategory[];
};

/** A single specifier item flattened together with its parent context and a stable slug. */
export type SpecifierCatalogItem = {
  slug: string;
  label: string;
  groupLabel: string;
  disorderName: string;
  icd11Context: string;
  categoryId: string;
  categoryName: string;
  definition: SpecifierDefinition | null;
  definitionStatus: SpecifierDefinitionStatus;
  review: SpecifierReview;
};

let cached: SpecifiersContent | null = null;

function assertUsableSpecifiersContent(content: SpecifiersContent) {
  if (!content.categories.length || !content.stats.specifierItems) {
    throw new Error(
      `Specifiers content is empty or incomplete: ${content.categories.length} categories, ${content.stats.specifierItems} items.`,
    );
  }
}

export function loadSpecifiersContent(): SpecifiersContent {
  if (!cached) {
    cached = specifiersContent as SpecifiersContent;
    assertUsableSpecifiersContent(cached);
  }
  return cached;
}

/** Must match the transform used when building data/specifiers-search-index.json. */
export function specifierSlug(rowKey: string) {
  return rowKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let cachedItems: SpecifierCatalogItem[] | null = null;
let cachedBySlug: Map<string, SpecifierCatalogItem> | null = null;

function buildCatalog() {
  if (cachedItems && cachedBySlug) return;
  const content = loadSpecifiersContent();
  const items: SpecifierCatalogItem[] = [];
  for (const category of content.categories) {
    for (const disorder of category.disorders) {
      for (const group of disorder.groups) {
        for (const item of group.items) {
          items.push({
            slug: specifierSlug(item.review.rowKey),
            label: item.label,
            groupLabel: group.label,
            disorderName: disorder.name,
            icd11Context: disorder.icd11Context,
            categoryId: category.id,
            categoryName: category.name,
            definition: item.definition,
            definitionStatus: item.definitionStatus,
            review: item.review,
          });
        }
      }
    }
  }
  cachedItems = items;
  cachedBySlug = new Map(items.map((item) => [item.slug, item]));
}

export function specifierCatalogItems(): SpecifierCatalogItem[] {
  buildCatalog();
  return cachedItems!;
}

export function getSpecifierCatalogItem(slug: string): SpecifierCatalogItem | undefined {
  buildCatalog();
  return cachedBySlug!.get(slug);
}

/** Sibling specifiers in the same disorder (other groups included), for "related" rails. */
export function relatedCatalogItems(item: SpecifierCatalogItem, limit = 6): SpecifierCatalogItem[] {
  return specifierCatalogItems()
    .filter(
      (candidate) =>
        candidate.slug !== item.slug &&
        candidate.disorderName === item.disorderName &&
        candidate.categoryId === item.categoryId,
    )
    .slice(0, limit);
}

function normalizeLabel(value: string) {
  return (
    value
      .toLowerCase()
      // Catalog labels carry parenthetical severity qualifiers, e.g.
      // "With anxious distress (mild, moderate, severe)" — drop them so the core
      // label still matches its curated record.
      .replace(/\([^)]*\)/g, " ")
      .replace(/^with\s+/, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

// The curated records are all mood-episode specifiers (depressive / bipolar).
// Enrichment must be confined to those diagnostic categories: a label-only match
// otherwise attaches mood-specific fit/exclusion guidance to unrelated diagnoses
// (e.g. an Intellectual Developmental Disorder "Mild" severity row picking up the
// mood "Mild severity" record).
const enrichableCategoryIds = new Set(["bip", "dep"]);

let curatedByLabel: Map<string, SpecifierRecord> | null = null;
export function curatedEnrichmentFor(item: SpecifierCatalogItem): SpecifierRecord | undefined {
  if (!enrichableCategoryIds.has(item.categoryId)) return undefined;
  if (!curatedByLabel) {
    // specifierRecords is a small hand-authored set; index it once by normalized
    // full name. Short-name matching is intentionally omitted — generic short
    // names like "Mild" collide with unrelated severity rows.
    curatedByLabel = new Map<string, SpecifierRecord>();
    for (const record of specifierRecords) {
      curatedByLabel.set(normalizeLabel(record.name), record);
    }
  }
  return curatedByLabel.get(normalizeLabel(item.label));
}

/** Whether a catalog slug also resolves to a curated record (so it renders richly). */
export function curatedRecordForSlug(slug: string): SpecifierRecord | undefined {
  return findSpecifier(slug);
}

/**
 * A bounded set of slugs to pre-render at build time. Pre-rendering all 586 detail
 * pages would bloat the build, so we statically generate the source-verified items
 * (the highest-signal cut) and let the rest render on demand via dynamicParams.
 */
export function popularCatalogSlugs(limit = 96): string[] {
  return specifierCatalogItems()
    .filter((item) => item.review.sourceVerificationStatus === "source-verified")
    .slice(0, limit)
    .map((item) => item.slug);
}

export function specifiersProject(): SpecifierProject {
  return loadSpecifiersContent().project;
}
export function specifiersStats(): SpecifierStats {
  return loadSpecifiersContent().stats;
}
export function specifiersScopeWarning(): string {
  return loadSpecifiersContent().scopeWarning;
}
export function universalSpecifiers(): UniversalSpecifier[] {
  return loadSpecifiersContent().universalSpecifiers;
}
export function specifierCategories(): SpecifierCategory[] {
  return loadSpecifiersContent().categories;
}
export function authoritativeSources(): AuthoritativeSource[] {
  return loadSpecifiersContent().authoritativeSources;
}
