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
