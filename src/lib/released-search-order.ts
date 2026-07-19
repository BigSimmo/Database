import type { SearchResult } from "@/lib/types";

/** Whether a release-rank score is safe to use for bounded release ordering. */
function isBoundedReleaseRankScore(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Whether the current result set carries bounded second-stage release scores. */
export function resultsHaveReleaseRankScore(results: SearchResult[]) {
  return results.some((result) => isBoundedReleaseRankScore(result.score_explanation?.releaseRankScore));
}

/**
 * Keep the released result order on the live-eval-proven hybrid and bounded second-stage signals.
 *
 * App-layer rank scores remain available to answer evidence ranking and telemetry, but the
 * live corpus gate has not validated using them as the final retrieval order. Resolve duplicate
 * chunks to their strongest released-hybrid copy. When second-stage ordering was requested but the
 * final set has no valid release scores, distinct results keep the clinical selection's existing
 * order. Otherwise they use the live-proven raw-hybrid or bounded second-stage order.
 */
export function stabilizeReleasedSearchOrder(
  results: SearchResult[],
  preferSecondStageScore = false,
  preserveIncomingOrder = false,
) {
  const useSecondStageReleaseOrder = preferSecondStageScore && resultsHaveReleaseRankScore(results);
  const preserveCurrentOrder = preserveIncomingOrder || (preferSecondStageScore && !useSecondStageReleaseOrder);
  const compareReleasedHybridStrength = (left: SearchResult, right: SearchResult) => {
    const leftHybrid = left.hybrid_score ?? left.similarity ?? 0;
    const rightHybrid = right.hybrid_score ?? right.similarity ?? 0;
    if (rightHybrid !== leftHybrid) return rightHybrid - leftHybrid;
    const leftSimilarity = left.similarity ?? 0;
    const rightSimilarity = right.similarity ?? 0;
    if (rightSimilarity !== leftSimilarity) return rightSimilarity - leftSimilarity;
    if (right.relevance?.score !== left.relevance?.score)
      return (right.relevance?.score ?? 0) - (left.relevance?.score ?? 0);
    return left.id.localeCompare(right.id);
  };
  const compareReleasedSearchOrder = (left: SearchResult, right: SearchResult) => {
    const leftReleaseRankScore = left.score_explanation?.releaseRankScore;
    const rightReleaseRankScore = right.score_explanation?.releaseRankScore;
    const leftReleaseScore =
      useSecondStageReleaseOrder && isBoundedReleaseRankScore(leftReleaseRankScore)
        ? leftReleaseRankScore
        : (left.hybrid_score ?? left.similarity ?? 0);
    const rightReleaseScore =
      useSecondStageReleaseOrder && isBoundedReleaseRankScore(rightReleaseRankScore)
        ? rightReleaseRankScore
        : (right.hybrid_score ?? right.similarity ?? 0);
    if (rightReleaseScore !== leftReleaseScore) return rightReleaseScore - leftReleaseScore;
    const leftSimilarity = left.similarity ?? 0;
    const rightSimilarity = right.similarity ?? 0;
    if (rightSimilarity !== leftSimilarity) return rightSimilarity - leftSimilarity;
    if (right.relevance?.score !== left.relevance?.score)
      return (right.relevance?.score ?? 0) - (left.relevance?.score ?? 0);
    return left.id.localeCompare(right.id);
  };
  const strongestById = new Map<string, SearchResult>();
  for (const result of results) {
    const current = strongestById.get(result.id);
    if (!current || compareReleasedHybridStrength(result, current) < 0) strongestById.set(result.id, result);
  }
  const distinctResults = [...strongestById.values()];
  const releasedResults = preserveCurrentOrder
    ? distinctResults
    : useSecondStageReleaseOrder
      ? distinctResults.sort(compareReleasedSearchOrder)
      : distinctResults.sort(compareReleasedHybridStrength);
  const deduped = releasedResults.map((result, index) =>
    result.score_explanation
      ? { ...result, score_explanation: { ...result.score_explanation, finalRank: index + 1 } }
      : result,
  );
  results.length = 0;
  results.push(...deduped);
  return results;
}
