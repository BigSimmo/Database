import { normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";
import { loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import type {
  DifferentialComparisonCandidate,
  DifferentialComparisonCriterion,
  DifferentialMapNode,
  DifferentialPresentationWorkflow,
  DifferentialRecord,
  DifferentialRedFlagFlow,
  DifferentialScenarioPreset,
  DifferentialSection,
} from "@/lib/differential-snapshot";

export type DifferentialStreamType = "presentations" | "diagnoses";

export type DifferentialLikelihood = "most-likely" | "possible" | "less-likely" | "must-not-miss";

export type DifferentialStreamCard = {
  id: string;
  title: string;
  description: string;
  examples: string[];
  href: string;
};

export type {
  DifferentialComparisonCandidate,
  DifferentialComparisonCriterion,
  DifferentialMapNode,
  DifferentialPresentationWorkflow,
  DifferentialRecord,
  DifferentialRedFlagFlow,
  DifferentialScenarioPreset,
  DifferentialSection,
};

function catalog() {
  return loadDifferentialSnapshot();
}

export { loadDifferentialSnapshot } from "@/lib/differential-fixtures";

export const differentialRecords: DifferentialRecord[] = catalog().diagnoses;

export function differentialPresentations(): DifferentialPresentationWorkflow[] {
  return catalog().presentations;
}

export function differentialScenarioPresets(): DifferentialScenarioPreset[] {
  // The generated snapshot can carry markdown-header artifacts (e.g. "# Scenario
  // Presets") as synthetic first rows; they are not searchable presets.
  return catalog().presets.filter((preset) => !preset.query.trimStart().startsWith("#"));
}

export function differentialRedFlagFlows(): DifferentialRedFlagFlow[] {
  return catalog().redFlagFlows;
}

export function differentialSearchAliases(): Record<string, string[]> {
  // The generated snapshot can leak template metadata (field name → numeric
  // weight, e.g. "tags" → ["1.1"]) into the alias map; bare-number aliases
  // would match unrelated records by substring, so drop them.
  return Object.fromEntries(
    Object.entries(catalog().searchAliases)
      .map(([token, aliases]) => [token, aliases.filter((alias) => !/^\d+(\.\d+)?$/.test(alias.trim()))] as const)
      .filter(([, aliases]) => aliases.length > 0),
  );
}

export function getPresentationWorkflow(slug: string | null | undefined) {
  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) return null;
  return differentialPresentations().find((presentation) => presentation.id === normalizedSlug) ?? null;
}

export const acuteConfusionPresentationWorkflow: DifferentialPresentationWorkflow =
  getPresentationWorkflow("acute-confusion-encephalopathy") ?? differentialPresentations()[0]!;

export const differentialPresentationsCards: DifferentialStreamCard[] = differentialPresentations().map(
  (presentation) => ({
    id: `presentation-${presentation.id}`,
    title: presentation.title,
    description: presentation.subtitle,
    examples: presentation.safetySnapshot.tags.slice(0, 3),
    href: `/differentials/presentations/${presentation.id}`,
  }),
);

export const differentialDiagnosesCards: DifferentialStreamCard[] = differentialRecords.map((record) => ({
  id: `diagnosis-${record.slug}`,
  title: record.title,
  description: record.clinicalHinge,
  examples: record.related.slice(0, 3).map((node) => node.label),
  href: `/differentials/diagnoses/${record.slug}`,
}));

export function getDifferentialRecord(slug: string | null | undefined) {
  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) return null;
  return differentialRecords.find((record) => record.slug === normalizedSlug) ?? null;
}

export function presentationStaticParams() {
  return differentialPresentations().map((presentation) => ({ slug: presentation.id }));
}

export function differentialStaticParams() {
  return differentialRecords.map((record) => ({ slug: record.slug }));
}

function expandQueryTerms(terms: string[]) {
  const aliases = differentialSearchAliases();
  const expanded = new Set(terms);
  for (const term of terms) {
    for (const alias of aliases[term] ?? []) {
      for (const aliasToken of normalizeSearchText(alias).split(/\s+/).filter(Boolean)) expanded.add(aliasToken);
      expanded.add(normalizeSearchText(alias));
    }
  }
  return [...expanded];
}

function recordSearchText(record: DifferentialRecord) {
  return normalizeSearchText(
    [
      record.subtitle,
      record.clinicalHinge,
      record.safetySnapshot.summary,
      ...record.sections.flatMap((section) => [section.title, section.summary, ...section.items]),
      ...record.related.flatMap((node) => [node.label, node.note]),
    ].join(" "),
  );
}

export type DifferentialSearchMatch = { record: DifferentialRecord; score: number; reasons: string[] };

export function rankDifferentialRecords(query: string, limit?: number): DifferentialSearchMatch[] {
  return rankCatalogRecords(differentialRecords, query, {
    fields: [{ id: "title", weight: 6, text: (record) => normalizeSearchText(`${record.title} ${record.slug}`) }],
    fullText: recordSearchText,
    contentWeight: 2,
    phraseBonus: 4,
    exactValues: (record) => [normalizeSearchText(record.title), normalizeSearchText(record.slug)],
    exactBonus: 10,
    expandTokens: expandQueryTerms,
    limit,
    tieBreak: (left, right) => left.title.localeCompare(right.title),
  }).map(({ record, score, signals }) => ({
    record,
    score,
    reasons: [
      signals.fields.title ? "title" : "",
      signals.exact ? "exact title" : "",
      signals.content ? "clinical content" : "",
    ].filter(Boolean),
  }));
}

export function searchDifferentialRecords(query: string) {
  // Empty query keeps the full-catalogue browse behaviour; otherwise results are now
  // relevance-ranked (previously an unranked alias OR-filter in snapshot order).
  if (!normalizeSearchText(query)) return differentialRecords;
  return rankDifferentialRecords(query).map((match) => match.record);
}

export function searchPresentationWorkflows(query: string) {
  if (!normalizeSearchText(query)) return differentialPresentations();
  return rankCatalogRecords(differentialPresentations(), query, {
    fields: [{ id: "title", weight: 6, text: (presentation) => normalizeSearchText(presentation.title) }],
    fullText: (presentation) =>
      normalizeSearchText(
        [
          presentation.subtitle,
          presentation.safetySnapshot.summary,
          ...presentation.safetySnapshot.tags,
          ...presentation.candidates.map((candidate) => candidate.slug),
        ].join(" "),
      ),
    contentWeight: 2,
    phraseBonus: 4,
    expandTokens: expandQueryTerms,
    tieBreak: (left, right) => left.title.localeCompare(right.title),
  }).map((match) => match.record);
}
