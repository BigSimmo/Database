import type {
  AnswerCoveragePlan,
  RagAnswer,
  RagQueryClass,
  RagQueryPlan,
  SearchResult,
  SiteContentPartitionState,
  SourcePolicyConflict,
} from "@/lib/types";
import type { RetrievalAccessScope } from "@/lib/owner-scope";
import type { RagContextSnapshot } from "@/lib/site-content/site-content-contracts";
import { selectAustralianClinicalContext } from "@/lib/australian-source-priority";
import {
  answerCoverageFromSelections,
  mergeEvidenceByCoverageAndSourceRole,
  selectConflictAwareCoverageEvidence,
  type CoverageEvidenceSelection,
} from "@/lib/rag/rag-coverage";

export { summarizeAustralianSourceSelection } from "@/lib/australian-source-priority";

const fastRoutineModelContextLimit = 4;

const maxContextChunksPerDocument = 3;

// P9: keep one verbose document from dominating the sources the model sees. Cap each document to at
// most `maxContextChunksPerDocument` chunks (order-preserving, no reranking/dedup), but only when the
// result set spans multiple documents — a genuinely single-document answer must not be starved.
export function capPerDocumentCrowding(results: SearchResult[], maxPerDocument = maxContextChunksPerDocument) {
  if (results.length <= maxPerDocument) return results;
  const distinctDocuments = new Set(results.map((result) => result.document_id)).size;
  if (distinctDocuments < 2) return results;
  const documentCounts = new Map<string, number>();
  const capped: SearchResult[] = [];
  for (const result of results) {
    const count = documentCounts.get(result.document_id) ?? 0;
    if (count >= maxPerDocument) continue;
    documentCounts.set(result.document_id, count + 1);
    capped.push(result);
  }
  return capped;
}

type ModelContextSelectionArgs = {
  routeMode: RagAnswer["routingMode"];
  queryClass: RagQueryClass;
  crossDocument: boolean;
  results: SearchResult[];
  queryPlan?: RagQueryPlan;
  siteContentState?: SiteContentPartitionState;
  sourcePolicyConflicts?: readonly SourcePolicyConflict[];
  accessScope?: RetrievalAccessScope;
  snapshot?: RagContextSnapshot;
};

export type ModelContextEvidenceSelection = {
  results: SearchResult[];
  coverageSelections: CoverageEvidenceSelection[];
  coverage: AnswerCoveragePlan | null;
  queryPlan?: RagQueryPlan | null;
};

function selectLegacyModelContextResults(args: ModelContextSelectionArgs) {
  const highRiskNumericQuery = args.queryClass === "medication_dose_risk" || args.queryClass === "table_threshold";
  if (highRiskNumericQuery) {
    return selectAustralianClinicalContext(args.results);
  }

  const fastRoutineQuery =
    args.routeMode === "fast" &&
    !args.crossDocument &&
    args.queryClass !== "comparison" &&
    args.queryClass !== "broad_summary";
  // Preserve the retrieval-ranked fast budget before applying the order-only
  // Australian preference. This keeps a stronger/unique supplementary result
  // inside the four-chunk budget while still moving equally relevant local
  // guidance ahead within that retained set. Apply the existing crowding cap
  // first so a fourth chunk from one document cannot hide another document.
  const preferenceCandidates = fastRoutineQuery
    ? capPerDocumentCrowding(
        args.results.filter((result) => result.relevance?.verdict !== "none"),
        maxContextChunksPerDocument,
      ).slice(0, fastRoutineModelContextLimit)
    : args.results;

  // All answer classes should prefer authoritative Australian guidance when it
  // is equally relevant. For non-numeric questions this is an order-only
  // preference: retain supplementary evidence so a local source cannot hide a
  // stronger or uniquely relevant international passage. Numeric/high-risk
  // queries keep the stricter bounded Australian-first policy above.
  const results = selectAustralianClinicalContext(preferenceCandidates, {
    limit: preferenceCandidates.length,
    maxPerDocument: maxContextChunksPerDocument,
    omitSupplementaryPadding: false,
  });
  return results;
}

function flattenCoverageSelections(selections: CoverageEvidenceSelection[], limit: number) {
  return selectConflictAwareCoverageEvidence(selections, {
    limit,
    maxPerDocument: maxContextChunksPerDocument,
  });
}

export function selectModelContextEvidence(args: ModelContextSelectionArgs): ModelContextEvidenceSelection {
  const legacyResults = selectLegacyModelContextResults(args);
  if (!args.queryPlan || !args.results.some((result) => result.corpus_scope)) {
    return { results: legacyResults, coverageSelections: [], coverage: null, queryPlan: null };
  }
  const coverageSelections = mergeEvidenceByCoverageAndSourceRole({
    plan: args.queryPlan,
    candidates: args.results,
    siteContentState: args.siteContentState,
    sourcePolicyConflicts: args.sourcePolicyConflicts,
    maxPerDocument: maxContextChunksPerDocument,
  });
  const fastRoutineQuery =
    args.routeMode === "fast" &&
    !args.crossDocument &&
    args.queryClass !== "comparison" &&
    args.queryClass !== "broad_summary";
  const highRiskNumericQuery = args.queryClass === "medication_dose_risk" || args.queryClass === "table_threshold";
  const limit = fastRoutineQuery ? fastRoutineModelContextLimit : highRiskNumericQuery ? 6 : args.results.length;
  const flattened = flattenCoverageSelections(coverageSelections, limit);
  const results = flattened.results;
  const retainedIds = new Set(results.map((result) => result.id));
  const reconciledSelections = coverageSelections.map((selection) => {
    const orderedEvidence = selection.orderedEvidence.filter((result) => retainedIds.has(result.id));
    const conflicts = selection.conflicts.filter(
      (conflict) =>
        conflict.local.supportingChunkIds.some((id) => retainedIds.has(id)) &&
        conflict.australian.supportingChunkIds.some((id) => retainedIds.has(id)),
    );
    const hasDirectLocal = orderedEvidence.some(
      (result) => result.corpus_scope === "uploaded_local" && result.relevance?.verdict === "direct",
    );
    const hasDirectAustralian = orderedEvidence.some(
      (result) => result.corpus_scope === "australian_public" && result.relevance?.verdict === "direct",
    );
    return {
      ...selection,
      orderedEvidence,
      conflicts,
      sourcePolicyConflictOmitted:
        selection.sourcePolicyConflictOmitted || flattened.omittedConflictSubquestionIds.has(selection.subquestionId),
      sourcePolicyReview: conflicts.length
        ? ("verified_conflict" as const)
        : flattened.omittedConflictSubquestionIds.has(selection.subquestionId) ||
            (selection.sourcePolicyReview === "not_evaluated" && hasDirectLocal && hasDirectAustralian)
          ? ("not_evaluated" as const)
          : ("not_applicable" as const),
    };
  });
  return {
    results,
    coverageSelections: reconciledSelections,
    coverage: answerCoverageFromSelections({
      plan: args.queryPlan,
      selectedEvidence: results,
      selections: reconciledSelections,
    }),
    queryPlan: args.queryPlan,
  };
}

export function selectModelContextResults(args: ModelContextSelectionArgs) {
  return selectModelContextEvidence(args).results;
}

/** Resolve the served and bounded strong-retry packs against one immutable request-local policy input. */
export function selectModelContextEvidencePair(args: ModelContextSelectionArgs) {
  return {
    served: selectModelContextEvidence(args),
    strongRetry: selectModelContextEvidence({ ...args, routeMode: "strong" }),
  };
}
