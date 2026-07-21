import { buildExtractiveAnswer, finalizeRagAnswerQuality } from "@/lib/rag/rag-extractive-answer";
import type { RagQueryClass, RetrievalConfidenceGateStatus, SearchResult } from "@/lib/types";

/**
 * Pre-generation validated-extractive short-circuit.
 *
 * Each predicate here targets a measured wasted-generation shape: a query whose
 * deterministic extractive answer independently passes every final quality and
 * grounding gate, so the paid model call adds latency and cost without adding
 * trust. A predicate may flip the answer route to `extractive` only when its
 * validated candidate has already cleared those gates; retrieval, ranking, and
 * selection behaviour are never touched.
 */

type ShortCircuitRoute = { mode: "unsupported" | "extractive" | "fast" | "strong"; reason: string };

/**
 * Allow a score-blocked routine document-content query to use the deterministic
 * answer only when that answer independently passes the final safety gates.
 *
 * This is deliberately narrower than the normal extractive router: it cannot
 * recover medication, threshold, comparison, broad-summary, complex, or weakly
 * related queries. The retrieval diagnostic remains blocked so the UI still
 * presents the recovered answer with low-trust guidance.
 */
export function hasValidatedExtractiveCandidate(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  routeReason: string;
}) {
  const candidate = finalizeRagAnswerQuality(
    buildExtractiveAnswer({
      query: args.query,
      queryClass: args.queryClass,
      results: args.results,
      quoteCards: [],
      documentBreakdown: [],
      evidenceSummary: undefined,
      sourceCoverage: undefined,
      conflictsOrGaps: [],
      visualEvidence: [],
      bestSource: null,
      smartPanel: undefined,
      relatedDocuments: [],
      routeReason: args.routeReason,
      timings: undefined,
    }),
    args.query,
    args.queryClass,
  );

  return (
    candidate.grounded &&
    candidate.confidence !== "unsupported" &&
    candidate.citations.length > 0 &&
    candidate.responseMode !== "evidence_gap" &&
    !/final_quality_gate:/.test(candidate.routingReason ?? "")
  );
}

/** Recover only routine, source-backed document lookups whose deterministic answer passes every final gate. */
export function hasValidatedRoutineExtractiveRecovery(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: { mode: "unsupported" | "extractive" | "fast" | "strong"; reason: string };
  sourceBacked: boolean;
}) {
  if (
    args.queryClass !== "document_lookup" ||
    args.route.mode !== "fast" ||
    args.route.reason !== "strong_routine_retrieval" ||
    !args.sourceBacked
  ) {
    return false;
  }

  return hasValidatedExtractiveCandidate({
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
    routeReason: `${args.route.reason}; validated_routine_extractive_recovery`,
  });
}

/**
 * Generic LAI-management questions repeatedly time out in generation despite strong direct
 * source support. Skip that paid tail only when the question asks no specific clinical detail
 * and the deterministic answer independently passes the same final quality and grounding gates.
 */
export function hasValidatedGenericLaiManagementExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: { mode: "unsupported" | "extractive" | "fast" | "strong"; reason: string };
  sourceBacked: boolean;
}) {
  const genericLaiManagementQuery = /^\s*how (?:are|should) long[- ]acting injectables? (?:be )?managed\??\s*$/i.test(
    args.query,
  );

  if (
    !genericLaiManagementQuery ||
    args.queryClass !== "medication_dose_risk" ||
    args.route.mode !== "fast" ||
    args.route.reason !== "clinical_fast_grounded_synthesis" ||
    !args.sourceBacked
  ) {
    return false;
  }

  return hasValidatedExtractiveCandidate({
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
    routeReason: `${args.route.reason}; validated_generic_lai_management_extractive_answer`,
  });
}

const routineProceduralLeadPattern = /^\s*what\b/i;
const routineProceduralKeywordPattern =
  /\b(?:process|procedure|steps?|includes?|include|required?|requires?|requirements?|documentation)\b/i;

/**
 * Routine procedural document-content shape: a "What ..." question asking what a
 * process/procedure includes or requires. Deliberately EXCLUDES "How is X
 * handled/managed?" shapes — those stay on model synthesis (see the gate-passed
 * routine document-content contract in tests/rag-answer-fallback.test.ts).
 */
export const routineProceduralContentPattern = {
  test(query: string) {
    return routineProceduralLeadPattern.test(query) && routineProceduralKeywordPattern.test(query);
  },
};

/**
 * Gate-passed routine procedural document-content questions repeatedly pay for model
 * synthesis that the deterministic extractive answer already covers. Skip that paid tail
 * only for the strong routine fast route, only for routine lookup/general classes (never
 * dose, threshold, comparison, or broad-summary classes), and only when the deterministic
 * answer independently passes every final quality and grounding gate.
 */
export function hasValidatedRoutineProceduralExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: ShortCircuitRoute;
  sourceBacked: boolean;
  gateStatus: RetrievalConfidenceGateStatus;
}) {
  if (
    args.route.mode !== "fast" ||
    args.route.reason !== "strong_routine_retrieval" ||
    args.gateStatus !== "passed" ||
    !args.sourceBacked ||
    (args.queryClass !== "document_lookup" && args.queryClass !== "unsupported_or_general") ||
    args.results.length === 0 ||
    !routineProceduralContentPattern.test(args.query)
  ) {
    return false;
  }

  return hasValidatedExtractiveCandidate({
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
    routeReason: `${args.route.reason}; validated_routine_extractive_first`,
  });
}

/**
 * Choose the first applicable validated-extractive short-circuit for the current route.
 *
 * Precedence is fixed: the generic LAI-management skip (gate passed), then the
 * score-blocked routine recovery (gate blocked), then the gate-passed routine
 * procedural short-circuit. Returns the routing-reason marker to append, or null
 * when generation should proceed unchanged.
 */
export function chooseValidatedExtractiveShortCircuit(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: ShortCircuitRoute;
  sourceBacked: boolean;
  gateStatus: RetrievalConfidenceGateStatus;
}): { reasonMarker: string } | null {
  const predicateArgs = {
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
    route: args.route,
    sourceBacked: args.sourceBacked,
  };

  if (args.gateStatus === "passed" && hasValidatedGenericLaiManagementExtractiveAnswer(predicateArgs)) {
    return { reasonMarker: "validated_generic_lai_management_extractive_answer" };
  }

  if (args.gateStatus === "blocked" && hasValidatedRoutineExtractiveRecovery(predicateArgs)) {
    return { reasonMarker: "validated_routine_extractive_recovery" };
  }

  if (hasValidatedRoutineProceduralExtractiveAnswer(args)) {
    return { reasonMarker: "validated_routine_extractive_first" };
  }

  return null;
}
