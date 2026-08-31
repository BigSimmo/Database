import type {
  RagAnswer,
  RagQueryClass,
  RagQueryPlan,
  SearchResult,
  SiteContentPartitionState,
  SourcePolicyConflict,
} from "@/lib/types";
import { selectAustralianClinicalContext } from "@/lib/australian-source-priority";
import { mergeEvidenceByCoverageAndSourceRole, type CoverageEvidenceSelection } from "@/lib/rag/rag-coverage";

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

type ContextSelectionUnit = { results: SearchResult[]; conflict: boolean };

function firstConflictPair(selection: CoverageEvidenceSelection, resultId: string) {
  const conflict = selection.conflicts.find((candidate) =>
    [...candidate.local.supportingChunkIds, ...candidate.australian.supportingChunkIds].includes(resultId),
  );
  if (!conflict) return null;
  const local = selection.orderedEvidence.find((result) => conflict.local.supportingChunkIds.includes(result.id));
  const australian = selection.orderedEvidence.find((result) =>
    conflict.australian.supportingChunkIds.includes(result.id),
  );
  return local && australian ? [local, australian] : null;
}

function flattenCoverageSelections(selections: CoverageEvidenceSelection[], limit: number) {
  let units: ContextSelectionUnit[] = [];
  const omittedConflictSubquestionIds = new Set<string>();
  const selectedIds = () => new Set(units.flatMap((unit) => unit.results.map((result) => result.id)));
  const selectedCount = () => units.reduce((count, unit) => count + unit.results.length, 0);
  const documentCount = (documentId: string) =>
    units.flatMap((unit) => unit.results).filter((result) => result.document_id === documentId).length;
  const removeLastSingleton = (documentId?: string) => {
    const index = units.findLastIndex(
      (unit) =>
        !unit.conflict && unit.results.length === 1 && (!documentId || unit.results[0]?.document_id === documentId),
    );
    if (index < 0) return false;
    units = units.filter((_, unitIndex) => unitIndex !== index);
    return true;
  };
  const addConflictPair = (pair: SearchResult[], subquestionId: string) => {
    const workingUnits = units;
    const pairIds = new Set(pair.map((result) => result.id));
    units = units.map((unit) =>
      unit.results.some((result) => pairIds.has(result.id)) ? { ...unit, conflict: true } : unit,
    );
    const existingIds = selectedIds();
    const missingPair = pair.filter(
      (result, index) => !existingIds.has(result.id) && pair.findIndex((item) => item.id === result.id) === index,
    );
    for (const result of missingPair) {
      while (
        documentCount(result.document_id) +
          missingPair.filter((item) => item.document_id === result.document_id).length >
        maxContextChunksPerDocument
      ) {
        if (!removeLastSingleton(result.document_id)) {
          units = workingUnits;
          omittedConflictSubquestionIds.add(subquestionId);
          return;
        }
      }
    }
    while (selectedCount() + missingPair.length > limit) {
      if (!removeLastSingleton()) {
        units = workingUnits;
        omittedConflictSubquestionIds.add(subquestionId);
        return;
      }
    }
    if (missingPair.length) units.push({ results: missingPair, conflict: true });
  };
  const maxDepth = Math.max(0, ...selections.map((selection) => selection.orderedEvidence.length));
  for (let depth = 0; depth < maxDepth; depth += 1) {
    for (const selection of selections) {
      const result = selection.orderedEvidence[depth];
      if (!result || selectedIds().has(result.id)) continue;
      const conflictPair = firstConflictPair(selection, result.id);
      if (conflictPair) {
        addConflictPair(conflictPair, selection.subquestionId);
        continue;
      }
      if (selectedCount() >= limit || documentCount(result.document_id) >= maxContextChunksPerDocument) continue;
      units.push({ results: [result], conflict: false });
    }
  }
  return { results: units.flatMap((unit) => unit.results), omittedConflictSubquestionIds };
}

export function selectModelContextEvidence(args: ModelContextSelectionArgs): {
  results: SearchResult[];
  coverageSelections: CoverageEvidenceSelection[];
} {
  const legacyResults = selectLegacyModelContextResults(args);
  if (!args.queryPlan || !args.results.some((result) => result.corpus_scope)) {
    return { results: legacyResults, coverageSelections: [] };
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
      sourcePolicyReview: conflicts.length
        ? ("verified_conflict" as const)
        : flattened.omittedConflictSubquestionIds.has(selection.subquestionId) ||
            (selection.sourcePolicyReview === "not_evaluated" && hasDirectLocal && hasDirectAustralian)
          ? ("not_evaluated" as const)
          : ("not_applicable" as const),
    };
  });
  return { results, coverageSelections: reconciledSelections };
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
