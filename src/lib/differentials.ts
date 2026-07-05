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
  return catalog().presets;
}

export function differentialRedFlagFlows(): DifferentialRedFlagFlow[] {
  return catalog().redFlagFlows;
}

export function differentialSearchAliases(): Record<string, string[]> {
  return catalog().searchAliases;
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

function expandQueryTokens(query: string) {
  const aliases = differentialSearchAliases();
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const alias of aliases[token] ?? []) expanded.add(alias);
  }
  return [...expanded];
}

function recordSearchText(record: DifferentialRecord) {
  return [
    record.title,
    record.subtitle,
    record.clinicalHinge,
    record.safetySnapshot.summary,
    ...record.sections.flatMap((section) => [section.title, section.summary, ...section.items]),
    ...record.related.flatMap((node) => [node.label, node.note]),
  ]
    .join(" ")
    .toLowerCase();
}

export function searchDifferentialRecords(query: string) {
  const tokens = expandQueryTokens(query);
  if (!tokens.length) return differentialRecords;
  return differentialRecords.filter((record) => {
    const text = recordSearchText(record);
    return tokens.some((token) => text.includes(token));
  });
}

export function searchPresentationWorkflows(query: string) {
  const tokens = expandQueryTokens(query);
  if (!tokens.length) return differentialPresentations();
  return differentialPresentations().filter((presentation) => {
    const text = [
      presentation.title,
      presentation.subtitle,
      presentation.safetySnapshot.summary,
      ...presentation.safetySnapshot.tags,
      ...presentation.candidates.map((candidate) => candidate.slug),
    ]
      .join(" ")
      .toLowerCase();
    return tokens.some((token) => text.includes(token));
  });
}
