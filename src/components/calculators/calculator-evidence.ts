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
