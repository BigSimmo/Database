import formulationConceptsJson from "@/data/formulation-concepts.json";
import { expandedSmartSearchQuery } from "@/lib/smart-search-intent";

/**
 * The contextual half of the Formulation library, imported from the
 * 2026-09-16 clinical handover.
 *
 * The 12 mechanisms in `formulation.ts` are one record shape with a strict
 * contract. The 46 concepts and six guide modules here are not mechanisms:
 * housing insecurity, delirium and a cultural explanatory model have no
 * maintaining loop of their own, and forcing them into the mechanism schema
 * would manufacture one. They keep their own typed shape, their own search,
 * and their own release gate, and they carry the three domains the mechanism
 * set leaves permanently empty — Biological, Social and Cultural.
 */
export type FormulationEvidenceRelationship = "direct_block_citation" | "record_context";

/**
 * `url` is populated only when the canonical location is on a host
 * `source-url-policy.ts` governs. A source on an ungoverned host keeps its
 * identity and its identifier and loses only the outbound link: adding the host
 * would change what the whole repository trusts, which is not this content
 * task's to decide.
 */
export type FormulationEvidenceUrlStatus = "governed" | "host_not_governed" | "none";

export type FormulationEvidenceRef = {
  label: string;
  sourceId: string;
  nativeSourceId: string | null;
  title: string;
  issuer: string | null;
  url: string | null;
  urlStatus: FormulationEvidenceUrlStatus;
  identifier: string | null;
  evidenceType: string | null;
  locator: string | null;
  relationship: FormulationEvidenceRelationship;
  limitations: string[];
  admission: string;
  claimIds: string[];
};

export type FormulationRecordReview = {
  status: string;
  reviewer: string | null;
  preparedAt: string;
};

/** `held` records stay out of every clinician-facing surface until the named
 * governance in `releaseNote` signs them off. */
export type FormulationRelease = "published" | "held";

type FormulationRecordBase = {
  id: string;
  title: string;
  kind: string;
  group: string;
  domains: string[];
  summary: string;
  qualification: string | null;
  whenApplies: string | null;
  whenDoesNotApply: string | null;
  population: string | null;
  intendedUsers: string[];
  warnings: string[];
  nextSteps: string | null;
  searchTerms: string[];
  evidence: FormulationEvidenceRef[];
  claimIds: string[];
  packageContentId: string;
  review: FormulationRecordReview;
  release: FormulationRelease;
  releaseNote: string | null;
};

export type FormulationConcept = FormulationRecordBase & {
  clinicalQuestion: string | null;
  candidateLoop: string | null;
  alternatives: string | null;
  actions: string | null;
};

export type FormulationGuideSpan = {
  text: string;
  strong?: boolean;
  code?: boolean;
  citation?: string;
};

export type FormulationGuideBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; spans: FormulationGuideSpan[] }
  | { kind: "list"; items: FormulationGuideSpan[][] };

export type FormulationGuide = FormulationRecordBase & {
  blocks: FormulationGuideBlock[];
};

export type FormulationConceptGroup = {
  id: string;
  label: string;
  description: string;
};

type FormulationConceptBundle = {
  metadata: {
    packageVersion: string;
    contentVersion: string;
    releaseStatus: string;
    confirmationNote: string;
    firstNationsGovernanceNote: string;
  };
  groups: FormulationConceptGroup[];
  concepts: FormulationConcept[];
  guides: FormulationGuide[];
};

const bundle = formulationConceptsJson as unknown as FormulationConceptBundle;

export const formulationConceptMetadata = bundle.metadata;
export const formulationConceptGroups = bundle.groups;
export const formulationConcepts = bundle.concepts;
export const formulationGuides = bundle.guides;

export const publishedFormulationConcepts = formulationConcepts.filter((concept) => concept.release === "published");
export const heldFormulationConcepts = formulationConcepts.filter((concept) => concept.release === "held");
export const publishedFormulationGuides = formulationGuides.filter((guide) => guide.release === "published");

const conceptsById = new Map<string, FormulationConcept>(formulationConcepts.map((concept) => [concept.id, concept]));
const guidesById = new Map<string, FormulationGuide>(formulationGuides.map((guide) => [guide.id, guide]));

export function findFormulationConcept(id: string) {
  return conceptsById.get(id);
}

export function findFormulationGuide(id: string) {
  return guidesById.get(id);
}

/** Every record a route may render. A held record is deliberately absent. */
export function publishedFormulationRecord(id: string): FormulationConcept | FormulationGuide | undefined {
  const concept = conceptsById.get(id);
  if (concept) return concept.release === "published" ? concept : undefined;
  const guide = guidesById.get(id);
  return guide?.release === "published" ? guide : undefined;
}

export function formulationConceptGroup(id: string) {
  return formulationConceptGroups.find((group) => group.id === id);
}

export function formulationConceptsInGroup(groupId: string) {
  return publishedFormulationConcepts.filter((concept) => concept.group === groupId);
}

export const formulationConceptDomainsInUse = Array.from(
  new Set(publishedFormulationConcepts.flatMap((concept) => concept.domains)),
);

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchText(concept: FormulationConcept) {
  return normalize(
    [
      concept.title,
      concept.kind,
      concept.summary,
      concept.qualification ?? "",
      concept.whenApplies ?? "",
      concept.alternatives ?? "",
      concept.candidateLoop ?? "",
      concept.clinicalQuestion ?? "",
      ...concept.domains,
      ...concept.searchTerms,
    ].join(" "),
  );
}

export type FormulationConceptResult = { concept: FormulationConcept; score: number };

/**
 * Deliberately a second, separate ranking rather than an extra branch inside
 * `searchFormulationMechanisms`: the mechanism weights are pinned by
 * `tests/formulation.test.ts` and a concept must never displace a mechanism
 * from the top of the mechanism list. Held records are filtered before scoring,
 * so nothing awaiting governance can be reached by guessing its title.
 */
export function searchFormulationConcepts(
  query: string,
  options: { domains?: ReadonlySet<string>; group?: string; interpretNaturalLanguage?: boolean } = {},
): FormulationConceptResult[] {
  const normalizedQuery = normalize(
    options.interpretNaturalLanguage ? expandedSmartSearchQuery("formulation", query) : query,
  );
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const domainFacets = options.domains;

  return publishedFormulationConcepts
    .map((concept, index) => {
      if (options.group && concept.group !== options.group) return null;
      if (domainFacets?.size && !concept.domains.some((domain) => domainFacets.has(domain))) return null;

      const haystack = searchText(concept);
      const title = normalize(concept.title);
      const terms = normalize(concept.searchTerms.join(" "));
      let score = normalizedQuery ? 0 : publishedFormulationConcepts.length - index;

      if (normalizedQuery) {
        if (title === normalizedQuery) score += 80;
        else if (title.includes(normalizedQuery)) score += 48;
        if (terms.includes(normalizedQuery)) score += 30;
        for (const token of queryTokens) {
          if (title.includes(token)) score += 14;
          if (terms.includes(token)) score += 8;
          if (haystack.includes(token)) score += 3;
        }
      }

      return score > 0 ? { concept, score } : null;
    })
    .filter((result): result is FormulationConceptResult => Boolean(result))
    .sort((left, right) => right.score - left.score || left.concept.title.localeCompare(right.concept.title, "en-AU"));
}

/** Citations that can be rendered as an outbound link, in reading order. */
export function linkableEvidence(evidence: readonly FormulationEvidenceRef[]) {
  return evidence.filter((entry) => entry.urlStatus === "governed" && entry.url);
}
