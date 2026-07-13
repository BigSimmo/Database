import { classifySourceAuthority, type AustralianSourceTier } from "@/lib/source-authority-registry";
import type { SearchResult } from "@/lib/types";

export type { AustralianSourceTier, SourceAuthorityClassification } from "@/lib/source-authority-registry";

export type AustralianSourceSelectionSummary = {
  candidateCount: number;
  selectedCount: number;
  australianCandidateCount: number;
  australianSelectedCount: number;
  waCandidateCount: number;
  waSelectedCount: number;
  authoritativeAustralianDocumentCount: number;
  authorityConflictCount: number;
  usedSupplementaryFallback: boolean;
};

const tierRank: Record<AustralianSourceTier, number> = {
  wa_validated: 0,
  australian_national: 1,
  australian_state: 2,
  supplementary: 3,
};

const relevanceRank = {
  direct: 0,
  partial: 1,
  nearby: 2,
  none: 3,
} as const;

export function australianSourceClassification(result: Pick<SearchResult, "source_metadata">) {
  return classifySourceAuthority(result.source_metadata);
}

export function australianSourceTier(result: Pick<SearchResult, "source_metadata">): AustralianSourceTier {
  return australianSourceClassification(result).tier;
}

export function isAustralianSourceTier(tier: AustralianSourceTier) {
  return tier !== "supplementary";
}

function capClinicalContextPerDocument(results: SearchResult[], maxPerDocument: number) {
  if (new Set(results.map((result) => result.document_id)).size < 2) return results;

  const documentCounts = new Map<string, number>();
  return results.filter((result) => {
    const count = documentCounts.get(result.document_id) ?? 0;
    if (count >= maxPerDocument) return false;
    documentCounts.set(result.document_id, count + 1);
    return true;
  });
}

/**
 * Select a bounded clinical context while preferring authoritative Australian
 * evidence inside the same relevance band. Supplementary material remains
 * available until Australian evidence is sufficient on its own.
 */
export function selectAustralianClinicalContext(
  results: SearchResult[],
  options: { limit?: number; maxPerDocument?: number; sufficientAustralianChunks?: number } = {},
) {
  const limit = options.limit ?? 6;
  const maxPerDocument = options.maxPerDocument ?? 2;
  const sufficientAustralianChunks = options.sufficientAustralianChunks ?? 4;
  const ranked = results
    .map((result, index) => ({ result, index, tier: australianSourceTier(result) }))
    .filter(({ result }) => result.relevance?.verdict !== "none")
    .sort((left, right) => {
      const leftRelevance = left.result.relevance?.verdict
        ? relevanceRank[left.result.relevance.verdict]
        : relevanceRank.direct;
      const rightRelevance = right.result.relevance?.verdict
        ? relevanceRank[right.result.relevance.verdict]
        : relevanceRank.direct;
      return leftRelevance - rightRelevance || tierRank[left.tier] - tierRank[right.tier] || left.index - right.index;
    });
  const capped = capClinicalContextPerDocument(
    ranked.map(({ result }) => result),
    maxPerDocument,
  );
  const australian = capped.filter((result) => isAustralianSourceTier(australianSourceTier(result)));
  const australianDocumentCount = new Set(australian.map((result) => result.document_id)).size;

  if (australian.length >= sufficientAustralianChunks && australianDocumentCount >= 2) {
    return australian.slice(0, limit);
  }

  return capped.slice(0, limit);
}

export function summarizeAustralianSourceSelection(
  candidates: SearchResult[],
  selected: SearchResult[],
): AustralianSourceSelectionSummary {
  const candidateClassifications = candidates.map(australianSourceClassification);
  const selectedTiers = selected.map(australianSourceTier);
  const authoritativeDocuments = new Set(
    selected
      .filter((result) => isAustralianSourceTier(australianSourceTier(result)))
      .map((result) => result.document_id),
  );

  return {
    candidateCount: candidates.length,
    selectedCount: selected.length,
    australianCandidateCount: candidateClassifications.filter((item) => isAustralianSourceTier(item.tier)).length,
    australianSelectedCount: selectedTiers.filter(isAustralianSourceTier).length,
    waCandidateCount: candidateClassifications.filter((item) => item.tier === "wa_validated").length,
    waSelectedCount: selectedTiers.filter((tier) => tier === "wa_validated").length,
    authoritativeAustralianDocumentCount: authoritativeDocuments.size,
    authorityConflictCount: candidateClassifications.filter((item) => item.conflict).length,
    usedSupplementaryFallback: selectedTiers.some((tier) => tier === "supplementary"),
  };
}
