// Base-diagnosis catalogue for the guided specifier builder.
//
// The builder shipped with five hardcoded mood presets while the rest of the
// Specifiers mode already searched the full DSM-5-TR dataset (131 disorders and
// 585 specifier items in data/specifiers-search-index.json). That mismatch is what
// left "Build" offering only recurrent/single MDD and three bipolar episodes.
//
// This module joins the two surfaces:
//   * the seven curated mood presets keep their hand-authored fit/exclusion guidance
//     (specifierRecords) and the original three-family wizard, and
//   * every other catalogued disorder becomes selectable and carries its own
//     specifier groups straight from the dataset.
//
// It imports the compact client-safe index only, so the builder stays a client
// component without pulling the ~632KB nested export into the browser bundle.

import { specifierIndexItems, type SpecifierIndexItem } from "@/lib/specifiers-search-index";
import type { SpecifierBuilderDiagnosis } from "@/lib/specifiers";

export type GuidedBuilderDiagnosis = {
  kind: "guided";
  id: SpecifierBuilderDiagnosis;
  label: string;
  categoryId: string;
  categoryName: string;
};

export type CatalogBuilderDiagnosis = {
  kind: "catalog";
  id: string;
  label: string;
  categoryId: string;
  categoryName: string;
};

export type BuilderDiagnosis = GuidedBuilderDiagnosis | CatalogBuilderDiagnosis;

/** How a specifier group behaves when more than one of its items is picked. */
export type BuilderGroupSelection = "single" | "multiple";

export type BuilderCatalogGroup = {
  id: string;
  label: string;
  selection: BuilderGroupSelection;
  items: SpecifierIndexItem[];
};

// Curated mood presets. These are Major Depressive Disorder and Bipolar I/II with the
// dataset's own "Pattern" / "Current Episode" value already resolved into the phrase,
// which is why the matching catalogue disorders are suppressed below. Order matters:
// a deep-linked specifier set resolves to the FIRST preset every seeded specifier is
// valid for, so depressed episodes stay ahead of the hypomanic ones.
export const guidedBuilderDiagnoses: GuidedBuilderDiagnosis[] = [
  { kind: "guided", id: "mdd-recurrent", label: "Major depressive disorder, recurrent", ...depressive() },
  { kind: "guided", id: "mdd-single", label: "Major depressive disorder, single episode", ...depressive() },
  { kind: "guided", id: "bipolar-i-depressed", label: "Bipolar I disorder, current episode depressed", ...bipolar() },
  { kind: "guided", id: "bipolar-i-manic", label: "Bipolar I disorder, current episode manic", ...bipolar() },
  { kind: "guided", id: "bipolar-i-hypomanic", label: "Bipolar I disorder, current episode hypomanic", ...bipolar() },
  { kind: "guided", id: "bipolar-ii-depressed", label: "Bipolar II disorder, current episode depressed", ...bipolar() },
  { kind: "guided", id: "bipolar-ii-hypomanic", label: "Bipolar II disorder, current episode hypomanic", ...bipolar() },
];

function depressive() {
  return { categoryId: "dep", categoryName: "4. Depressive Disorders" };
}

function bipolar() {
  return { categoryId: "bip", categoryName: "3. Bipolar & Related" };
}

// Catalogue disorders already represented by a curated preset above.
const guidedCatalogDisorders = new Set([
  "dep::Major Depressive Disorder",
  "bip::Bipolar I Disorder",
  "bip::Bipolar II Disorder",
]);

/**
 * Groups whose items are one mutually exclusive axis, so the builder offers them as
 * radios. Everything else is a checkbox list: picking two is only wrong where the
 * options contradict each other, and blocking a valid combination (for example
 * "in sustained remission, on maintenance therapy, in a controlled environment")
 * is the worse failure for a documentation aid.
 */
export const singleSelectGroupLabels: ReadonlySet<string> = new Set([
  "Aetiology",
  "Attraction",
  "Classes",
  "Clusters",
  "Course",
  "Course & Status",
  "Current Episode",
  "Insight",
  "Pattern",
  "Presentation",
  "Prognosis",
  "Remission",
  "Severity",
  "Severity (Major NCD)",
  "Severity/Course",
  "Subtype",
  "Subtypes",
  "Type",
  "Types & Severity",
]);

export function builderGroupSelection(groupLabel: string): BuilderGroupSelection {
  return singleSelectGroupLabels.has(groupLabel) ? "single" : "multiple";
}

function diagnosisSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function catalogDiagnosisId(categoryId: string, disorder: string) {
  return `catalog:${categoryId}:${diagnosisSlug(disorder)}`;
}

type CatalogEntry = { diagnosis: CatalogBuilderDiagnosis; groups: BuilderCatalogGroup[] };

let cachedCatalog: Map<string, CatalogEntry> | null = null;

function buildCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const entries = new Map<string, CatalogEntry>();

  for (const item of specifierIndexItems) {
    if (guidedCatalogDisorders.has(`${item.categoryId}::${item.disorder}`)) continue;
    const id = catalogDiagnosisId(item.categoryId, item.disorder);
    let entry = entries.get(id);
    if (!entry) {
      entry = {
        diagnosis: {
          kind: "catalog",
          id,
          label: item.disorder,
          categoryId: item.categoryId,
          categoryName: item.category,
        },
        groups: [],
      };
      entries.set(id, entry);
    }

    let group = entry.groups.find((candidate) => candidate.label === item.group);
    if (!group) {
      group = {
        id: `${id}::${diagnosisSlug(item.group)}`,
        label: item.group,
        selection: builderGroupSelection(item.group),
        items: [],
      };
      entry.groups.push(group);
    }
    group.items.push(item);
  }

  cachedCatalog = entries;
  return entries;
}

/** Every base diagnosis the builder offers: curated presets first, then the catalogue. */
export function builderDiagnoses(): BuilderDiagnosis[] {
  return [...guidedBuilderDiagnoses, ...Array.from(buildCatalog().values(), (entry) => entry.diagnosis)];
}

export function findBuilderDiagnosis(id: string): BuilderDiagnosis | undefined {
  return guidedBuilderDiagnoses.find((preset) => preset.id === id) ?? buildCatalog().get(id)?.diagnosis;
}

/** The dataset's own specifier groups for a catalogued disorder; empty for curated presets. */
export function builderCatalogGroups(id: string): BuilderCatalogGroup[] {
  return buildCatalog().get(id)?.groups ?? [];
}

/** The catalogued disorder a specifier slug belongs to, for builder deep links. */
export function builderDiagnosisForSpecifierSlug(slug: string): CatalogBuilderDiagnosis | undefined {
  const item = specifierIndexItems.find((candidate) => candidate.slug === slug);
  if (!item) return undefined;
  return buildCatalog().get(catalogDiagnosisId(item.categoryId, item.disorder))?.diagnosis;
}

export function findBuilderCatalogItem(slug: string): SpecifierIndexItem | undefined {
  return specifierIndexItems.find((candidate) => candidate.slug === slug);
}

export type BuilderDiagnosisGroup = { categoryId: string; categoryName: string; options: BuilderDiagnosis[] };

/**
 * Select options grouped for `<optgroup>`. The curated presets lead under their own
 * heading so the mood wizard stays one keystroke away, then the DSM categories follow
 * in dataset order.
 */
export function builderDiagnosisGroups(): BuilderDiagnosisGroup[] {
  const groups: BuilderDiagnosisGroup[] = [
    { categoryId: "guided", categoryName: "Mood episodes with guidance", options: [...guidedBuilderDiagnoses] },
  ];

  for (const entry of buildCatalog().values()) {
    const { diagnosis } = entry;
    let group = groups.find((candidate) => candidate.categoryId === diagnosis.categoryId);
    if (!group) {
      group = { categoryId: diagnosis.categoryId, categoryName: diagnosis.categoryName, options: [] };
      groups.push(group);
    }
    group.options.push(diagnosis);
  }

  return groups;
}

/**
 * Apply each group's selection rule to a list of slugs, keeping the last pick inside
 * every single-select group.
 */
export function applyBuilderGroupRules(groups: BuilderCatalogGroup[], slugs: string[]): string[] {
  const groupBySlug = new Map<string, BuilderCatalogGroup>();
  for (const group of groups) {
    for (const item of group.items) groupBySlug.set(item.slug, group);
  }

  const selected: string[] = [];
  for (const slug of slugs) {
    const group = groupBySlug.get(slug);
    if (!group || selected.includes(slug)) continue;
    if (group.selection === "single") {
      const retained = selected.filter((candidate) => groupBySlug.get(candidate) !== group);
      selected.splice(0, selected.length, ...retained);
    }
    selected.push(slug);
  }
  return selected;
}

/** Toggle one catalogue specifier, honouring its group's single/multiple rule. */
export function toggleBuilderCatalogSlug(groups: BuilderCatalogGroup[], selected: string[], slug: string): string[] {
  if (selected.includes(slug)) return selected.filter((candidate) => candidate !== slug);
  return applyBuilderGroupRules(groups, [...selected, slug]);
}

export type InitialBuilderState = { diagnosisId: string; selected: string[] };

/**
 * Resolve `?specifier=` deep links. Curated slugs keep the original behaviour — the
 * first mood preset every seeded specifier is valid for. Catalogue slugs now resolve
 * too: the first recognised item fixes its disorder as the base diagnosis.
 */
export function resolveInitialBuilderState(
  initialSpecifiers: string[],
  helpers: {
    normalizeSelection: (slugs: string[]) => string[];
    appliesToGuided: (slug: string, diagnosis: SpecifierBuilderDiagnosis) => boolean;
  },
): InitialBuilderState {
  const curated = helpers.normalizeSelection(initialSpecifiers);

  if (curated.length) {
    const preset = guidedBuilderDiagnoses.find((candidate) =>
      curated.every((slug) => helpers.appliesToGuided(slug, candidate.id)),
    );
    if (preset) return { diagnosisId: preset.id, selected: curated };
  }

  const seeded = initialSpecifiers
    .map((slug) => findBuilderCatalogItem(slug))
    .filter((item): item is SpecifierIndexItem => Boolean(item));
  const anchor = seeded[0];
  if (anchor) {
    const diagnosis = builderDiagnosisForSpecifierSlug(anchor.slug);
    if (diagnosis) {
      const groups = builderCatalogGroups(diagnosis.id);
      const sameDisorder = seeded
        .filter((item) => catalogDiagnosisId(item.categoryId, item.disorder) === diagnosis.id)
        .map((item) => item.slug);
      return { diagnosisId: diagnosis.id, selected: applyBuilderGroupRules(groups, sameDisorder) };
    }
  }

  return { diagnosisId: guidedBuilderDiagnoses[0].id, selected: curated };
}

// A trailing parenthetical that enumerates the sub-options of a specifier, or tells the
// clinician to fill something in. Those belong on the option row, where they show what
// is available, but not in the documented phrase: "with anxious distress (mild,
// moderate, moderate-severe, severe)" is a menu, not a diagnosis.
//
// The comma is what separates a menu from a qualifier across the whole dataset. Every
// comma-bearing parenthetical lists alternatives; every comma-free one defines the term
// it follows — a duration ("less than 6 months"), a threshold ("BMI 17 or above"), a
// count ("2+ criteria"), an age ("before age 21") or a constraint ("recurrent only") —
// and each of those changes the meaning of the phrase, so it stays.
//
// Two boundaries the pattern has to hold: the parenthetical must be trailing, so the
// mid-label "Other (or unknown) substance" survives, and it must be preceded by
// whitespace, so "With marked stressor(s)" does not lose its plural.
const trailingParenthetical = /\s+\(([^()]*)\)\s*$/;

export function stripSpecifierOptionList(label: string) {
  const match = label.match(trailingParenthetical);
  if (!match || match.index === undefined) return label;
  const inner = match[1];
  if (!inner.includes(",") && !/^specify\b/i.test(inner)) return label;
  return label.slice(0, match.index).trimEnd();
}

/**
 * Wording segment for a catalogue specifier. The dataset's own words are kept: the only
 * edits are dropping a trailing option list (above) and lowering the leading capital of
 * an ordinary word so the phrase reads as one sentence. Labels carrying a structured
 * prefix ("Level 1:", "Cluster B:") keep their capital, and acronyms are left alone.
 */
export function catalogWordingSegment(label: string) {
  const trimmed = stripSpecifierOptionList(label);
  if (trimmed.includes(":")) return trimmed;
  const [firstWord] = trimmed.split(/\s+/);
  if (!firstWord || !/^[A-Z][a-z']*$/.test(firstWord)) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}
