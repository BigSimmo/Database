import evidence from "../../../data/calculators/evidence.json";

export type CalculatorEvidenceSource = {
  id: string;
  issuer: string;
  title: string;
  type: string;
  version: string;
  url: string;
  jurisdiction: string;
  status: string;
  claimsSupported: string[];
  limitations: string[];
  /** Date (YYYY-MM-DD) this source's URL/content was last checked as reachable and current. */
  accessedAt: string;
  /** Date (YYYY-MM-DD) a reviewer last confirmed this source still supports its claims. */
  lastReviewed: string;
  /** Date (YYYY-MM-DD) this source is next due for review. */
  nextReview: string;
  /** id of an older source this one replaces, or null when it supersedes nothing. */
  supersedes: string | null;
};

export type CalculatorEvidenceClaim = {
  id: string;
  sourceIds: string[];
};

export type CalculatorEvidenceRegistry = {
  sources: CalculatorEvidenceSource[];
  claims: CalculatorEvidenceClaim[];
};

export const calculatorEvidence = evidence as CalculatorEvidenceRegistry;

export function evidenceSourcesFor(sourceIds: string[]): CalculatorEvidenceSource[] {
  const sourcesById = new Map(calculatorEvidence.sources.map((source) => [source.id, source]));
  return sourceIds.flatMap((sourceId) => {
    const source = sourcesById.get(sourceId);
    return source ? [source] : [];
  });
}

/**
 * The registry carries one `internal_governance_record` (the calculator
 * clinical-safety release decision) attached to every instrument's
 * `sourceIds`. It records provenance, not clinical evidence, so a clinical
 * surface must not present it in the same "Sources:" line as a validation
 * study. Callers render `clinical` as sources and `governance` under its own
 * label, keeping the link.
 */
export function partitionEvidenceSources(sourceIds: string[]): {
  clinical: CalculatorEvidenceSource[];
  governance: CalculatorEvidenceSource[];
} {
  const sources = evidenceSourcesFor(sourceIds);
  return {
    clinical: sources.filter((source) => source.type !== "internal_governance_record"),
    governance: sources.filter((source) => source.type === "internal_governance_record"),
  };
}
