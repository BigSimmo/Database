import formulationConceptsJson from "@/data/formulation-concepts.json";

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
  /** Written with `reviewer` by `npm run clinical:review`; absent until then. */
  reviewedAt?: string | null;
  /** The content pin: see scripts/lib/clinical-record-review-contract.mjs. */
  reviewedContentSha256?: string | null;
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

export type { FormulationConceptIndexGroup as FormulationConceptGroup } from "@/lib/formulation-concept-search";

type FormulationConceptGroupRecord = { id: string; label: string; description: string };

type FormulationConceptBundle = {
  metadata: {
    packageVersion: string;
    contentVersion: string;
    releaseStatus: string;
    confirmationNote: string;
    firstNationsGovernanceNote: string;
  };
  groups: FormulationConceptGroupRecord[];
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

/**
 * Citations that can be rendered as an outbound link or registered as catalogue
 * usage, in reading order. Held admissions stay metadata-only: they keep their
 * citation text on the record but never become an outbound link or a source
 * catalogue usage row (handover / #2824 review).
 */
export function linkableEvidence(evidence: readonly FormulationEvidenceRef[]) {
  return evidence.filter((entry) => entry.admission !== "held" && entry.urlStatus === "governed" && entry.url);
}
