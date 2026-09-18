import formulationContentJson from "@/data/formulation-content.json";
import type { FormulationEvidenceRef } from "@/lib/formulation-concepts";
import { comparisonGuideFor } from "@/lib/formulation-mechanism-index";
import {
  normalizeFormulationText,
  rankFormulationMechanisms,
  type FormulationMechanismRankOptions,
} from "@/lib/formulation-mechanism-ranking";
import { expandedSmartSearchQuery } from "@/lib/smart-search-intent";

/**
 * The full mechanism records.
 *
 * Everything here is server-side. The browser reads the trimmed index in
 * `formulation-mechanism-index.ts` instead: this module statically imports the
 * whole 108,724-byte content bundle, of which `evidence` alone is 20,467 bytes
 * that only the server-rendered mechanism page ever reads.
 * `tests/formulation-mechanism-index.test.ts` pins the two in step and pins
 * that no client component reaches this module by any import path.
 *
 * Templates, sections, quality prompts, domains, domain groups, presets and the
 * comparison guidance are re-exported from that index rather than read twice, so
 * there is one copy of each and no way for the two halves to disagree.
 */
export type FormulationMechanism = {
  id: string;
  name: string;
  definition: string;
  summary: string;
  coreProcess: string;
  development: string;
  symptoms: string[];
  diagnosticContexts: string[];
  protective: string[];
  caveats: string[];
  fitIndicators: string[];
  poorFitIndicators: string[];
  caseExample: string;
  treatmentTargetExample: string;
  predisposing: string[];
  precipitating: string[];
  perpetuating: string[];
  clinicalClues: string[];
  patientPhrases: string[];
  domains: string[];
  tags: string[];
  maintainingCycles: string[];
  comparisonNotes: string[];
  formulationUse: string;
  exampleSentence: string;
  treatmentImplications: string[];
  treatmentLeverage: string;
  sources: string[];
  /**
   * Structured citations added by the 2026-09-16 content handover. The patch
   * set arrived with Markdown links inline in plain-text clinical fields;
   * those fields are rendered as text, so a raw `[S23](…)` would have been
   * shown to a clinician verbatim. The citation lives here instead, resolved
   * to a real source identity, and is rendered at the point of use.
   */
  evidence: FormulationEvidenceRef[];
  /** The handover record this mechanism was reconciled against. */
  conceptId: string;
  /** Native pending state. Never advanced without a named clinical reviewer. */
  reviewStatus: string;
  sourceStatus: string;
  sourceConfidence: string;
  version: string;
};

/**
 * The trimmed record the browser receives, re-exported so the full module still
 * owns the public name — the bridge `formulation-concepts.ts` uses for
 * `FormulationConceptGroup`.
 */
export type { FormulationMechanismSummary } from "@/lib/formulation-mechanism-index";
export type {
  FormulationQualityPrompt,
  FormulationSection,
  FormulationTemplate,
  MechanismComparisonGuide,
} from "@/lib/formulation-mechanism-index";

export {
  comparisonGuideFor,
  formulationDomainGroups,
  formulationDomains,
  formulationDomainsInUse,
  formulationDraftFor,
  formulationQualityPrompts,
  formulationSearchPresets,
  formulationSections,
  formulationSectionsForTemplate,
  formulationTemplates,
  normalizeMechanismSelection,
  suggestionsForFormulationSection,
} from "@/lib/formulation-mechanism-index";

export type FormulationSource = {
  id: string;
  title: string;
  url: string;
};

type FormulationContentBundle = {
  mechanisms: FormulationMechanism[];
  sourceLibrary: Record<string, FormulationSource>;
  sourceWarnings: {
    prototype: string;
    source: string;
    draft: string;
    clipboard: string;
    privacy: string;
    regulatory: string;
  };
};

const formulationContent = formulationContentJson as unknown as FormulationContentBundle;

export const formulationMechanisms = formulationContent.mechanisms;
export const formulationSourceLibrary = formulationContent.sourceLibrary;

export function findFormulationMechanism(id: string) {
  return formulationMechanisms.find((mechanism) => mechanism.id === id);
}

export function relatedFormulationMechanisms(mechanism: FormulationMechanism, limit = 4) {
  const sourceDomains = new Set(mechanism.domains);
  const sourceSymptoms = new Set(mechanism.symptoms.map(normalizeFormulationText));
  const sourceContexts = new Set(mechanism.diagnosticContexts.map(normalizeFormulationText));

  return formulationMechanisms
    .filter((candidate) => candidate.id !== mechanism.id)
    .map((candidate) => {
      const sharedDomains = candidate.domains.filter((domain) => sourceDomains.has(domain)).length;
      const sharedSymptoms = candidate.symptoms.filter((symptom) =>
        sourceSymptoms.has(normalizeFormulationText(symptom)),
      ).length;
      const sharedContexts = candidate.diagnosticContexts.filter((context) =>
        sourceContexts.has(normalizeFormulationText(context)),
      ).length;
      const hasComparisonGuide = Boolean(comparisonGuideFor(mechanism.id, candidate.id));
      return {
        candidate,
        score: sharedDomains * 5 + sharedSymptoms * 3 + sharedContexts * 2 + (hasComparisonGuide ? 20 : 0),
      };
    })
    .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

/**
 * The full records, ranked by the shared algorithm the client index also uses.
 *
 * Kept here rather than moved wholesale to the index module because a server
 * caller reads fields the browser never receives: `catalogue-evidence.ts` builds
 * its extract from `caveats` and its review state from `sourceStatus`.
 */
export function searchFormulationMechanisms(
  query: string,
  // `domains` is many-of-N, OR within the group: a mechanism carries 3.92 of
  // them on average, so asking for Affect OR Risk must widen rather than
  // intersect. Empty means no constraint. `domain` is the older one-of-N form,
  // still used by the builder page's own select.
  options: FormulationMechanismRankOptions & { interpretNaturalLanguage?: boolean } = {},
) {
  return rankFormulationMechanisms(
    formulationMechanisms,
    normalizeFormulationText(options.interpretNaturalLanguage ? expandedSmartSearchQuery("formulation", query) : query),
    options,
  );
}
