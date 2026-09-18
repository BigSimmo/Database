import formulationMechanismIndexJson from "@/data/formulation-mechanism-index.json";
import {
  buildFormulationDraft,
  formulationSectionSuggestions,
  normalizeFormulationText,
  rankFormulationMechanisms,
  uniqueFormulationValues,
  type FormulationMechanismRankOptions,
} from "@/lib/formulation-mechanism-ranking";
import { expandedSmartSearchQuery } from "@/lib/smart-search-intent";

/**
 * The client-side half of the mechanism library.
 *
 * `formulation.ts` holds the full records — structured evidence citations,
 * caveats, case examples, source confidence and review state — and the
 * Formulation home, builder, map and compare pages are all client components,
 * so importing it there downloaded the whole 108,724-byte bundle to every
 * visitor. `evidence` alone was 20,467 bytes of it, and nothing on the client
 * reads it: the one consumer is the server-rendered mechanism page.
 *
 * This module reads a trimmed index carrying only what a result card, a
 * comparison column, a builder suggestion and a search haystack need, and
 * `tests/formulation-mechanism-index.test.ts` pins the index against the full
 * records so the two cannot drift. Like `formulation-concept-index.json`, the
 * index is hand-maintained: a field added to a mechanism belongs here too only
 * if the browser renders it, and that test is what says so.
 */
export type FormulationMechanismSummary = {
  id: string;
  name: string;
  definition: string;
  summary: string;
  coreProcess: string;
  formulationUse: string;
  symptoms: string[];
  diagnosticContexts: string[];
  domains: string[];
  tags: string[];
  clinicalClues: string[];
  patientPhrases: string[];
  fitIndicators: string[];
  poorFitIndicators: string[];
  maintainingCycles: string[];
  predisposing: string[];
  precipitating: string[];
  perpetuating: string[];
  protective: string[];
  treatmentImplications: string[];
  treatmentLeverage: string;
  exampleSentence: string;
};

export type FormulationTemplate = { id: string; label: string };

export type FormulationSection = {
  id: string;
  label: string;
  prompt: string;
  group: string[];
};

export type FormulationQualityPrompt = {
  id: string;
  label: string;
  prompt: string;
};

export type MechanismComparisonGuide = {
  mostUsefulDistinction: string;
  commonConfusion: string;
  treatmentImplicationDifference: string;
  assessmentQuestion: string;
};

const index = formulationMechanismIndexJson as unknown as {
  domains: string[];
  mechanisms: FormulationMechanismSummary[];
  formulationTemplates: FormulationTemplate[];
  formulationSections: FormulationSection[];
  formulationQualityPrompts: FormulationQualityPrompt[];
  comparisonGuidance: Record<string, MechanismComparisonGuide>;
};

export const formulationMechanismIndex = index.mechanisms;
export const formulationDomains = index.domains;
export const formulationTemplates = index.formulationTemplates;
export const formulationSections = index.formulationSections;
export const formulationQualityPrompts = index.formulationQualityPrompts;

/**
 * The domains at least one mechanism actually carries — 9 of the 12 declared.
 *
 * `formulationDomains` is the taxonomy. Offering it as a filter meant three
 * controls (Biological, Social, Cultural) that can never return anything: they
 * are declared in the bundle but carried by 0 of the 12 mechanisms. Under the
 * union counting rule a permanently empty option reports the unchanged total
 * rather than zero, so it looks identical to a full one — which is why
 * `docs/filter-contract.md` says derive the option list from the data and never
 * declare it. Taxonomy order is preserved so the filter reads in the same order
 * as the rest of the mode.
 */
export const formulationDomainsInUse = formulationDomains.filter((domain) =>
  formulationMechanismIndex.some((mechanism) => mechanism.domains.includes(domain)),
);

export const formulationSearchPresets = [
  { label: "I keep going over it", query: "I keep going over it" },
  { label: "What if something goes wrong?", query: "What if something goes wrong?" },
  { label: "Zero to one hundred", query: "It goes from zero to one hundred" },
  { label: "I do not need anyone", query: "I do not need anyone" },
  { label: "If it is not perfect", query: "If it is not perfect, it is a failure" },
] as const;

export const formulationDomainGroups = [
  {
    id: "meaning",
    label: "Meaning and belief",
    description: "How experience is interpreted and organised.",
    domains: ["Cognition", "Developmental", "Cultural"],
  },
  {
    id: "emotion",
    label: "Emotion and threat",
    description: "Affect, trauma responses, and risk-relevant escalation.",
    domains: ["Affect", "Trauma", "Risk", "Biological"],
  },
  {
    id: "response",
    label: "Coping and action",
    description: "What the person does to manage distress or uncertainty.",
    domains: ["Behaviour", "Social"],
  },
  {
    id: "relationship",
    label: "Relationship and protection",
    description: "Attachment strategies, interpersonal patterns, and defences.",
    domains: ["Attachment", "Interpersonal", "Defence"],
  },
] as const;

/** The trimmed record for an id. The full record is server-side only. */
export function findFormulationMechanismSummary(id: string) {
  return formulationMechanismIndex.find((mechanism) => mechanism.id === id);
}

export function normalizeMechanismSelection(ids: string[]) {
  const knownIds = new Set(formulationMechanismIndex.map((mechanism) => mechanism.id));
  return uniqueFormulationValues(ids).filter((id) => knownIds.has(id));
}

export function formulationSectionsForTemplate(templateId: string) {
  return formulationSections.filter((section) => section.group.includes(templateId));
}

export function comparisonGuideFor(leftId: string, rightId: string) {
  const direct = index.comparisonGuidance[`${leftId}__${rightId}`];
  if (direct) return direct;
  const reverse = index.comparisonGuidance[`${rightId}__${leftId}`];
  if (!reverse) return undefined;
  return reverse;
}

export function searchFormulationMechanismIndex(
  query: string,
  options: FormulationMechanismRankOptions & { interpretNaturalLanguage?: boolean } = {},
) {
  return rankFormulationMechanisms(
    formulationMechanismIndex,
    normalizeFormulationText(options.interpretNaturalLanguage ? expandedSmartSearchQuery("formulation", query) : query),
    options,
  );
}

export function suggestionsForFormulationSection(
  mechanisms: readonly FormulationMechanismSummary[],
  sectionId: string,
) {
  return formulationSectionSuggestions(mechanisms, sectionId);
}

export function formulationDraftFor({
  mechanisms,
  templateId,
  notes,
  qualityNotes,
}: {
  mechanisms: readonly FormulationMechanismSummary[];
  templateId: string;
  notes: Record<string, string>;
  qualityNotes: Record<string, string>;
}) {
  return buildFormulationDraft({
    mechanisms,
    sections: formulationSectionsForTemplate(templateId),
    qualityPrompts: formulationQualityPrompts,
    templateId,
    notes,
    qualityNotes,
  });
}
