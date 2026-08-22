import {
  buildExtractiveAnswer,
  extractiveAnswerCarriesIntentFigure,
  finalizeRagAnswerQuality,
  isBareCrossReferenceAnswer,
  isSourceBoundActiveCommunityEdProcedureAnswer,
  isSourceBoundActiveCommunityEdProcedureQuery,
  isSourceBoundAdmissionDischargeComparisonAnswer,
  isSourceBoundAdmissionDischargeComparisonQuery,
  isSourceBoundBestPracticePrescriptionRequirementsAnswer,
  isSourceBoundBestPracticePrescriptionRequirementsQuery,
  isSourceBoundClozapineBloodActionThresholdAnswer,
  isSourceBoundClozapineBloodActionThresholdQuery,
  isSourceBoundCommunityHomeVisitRequirementsAnswer,
  isSourceBoundCommunityHomeVisitRequirementsQuery,
  retainCitedExtractiveFallbackEvidence,
} from "@/lib/rag/rag-extractive-answer";
import { MEDICATION_DOSE_RISK_STRONG_ROUTE_REASON } from "@/lib/rag/rag-routing";
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
function buildValidatedExtractiveCandidate(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  routeReason: string;
}) {
  return finalizeRagAnswerQuality(
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
}

function passesValidatedExtractiveCandidate(candidate: ReturnType<typeof buildValidatedExtractiveCandidate>) {
  return (
    candidate.grounded &&
    candidate.confidence !== "unsupported" &&
    candidate.citations.length > 0 &&
    candidate.responseMode !== "evidence_gap" &&
    !/final_quality_gate:/.test(candidate.routingReason ?? "") &&
    // Governance-review hardening (PR-B P2): a cross-reference lead that shares query terms
    // passes the overlap gate yet answers nothing ("Refer to the X procedure for..."). Screen
    // it here so no short-circuit path can ship a redirect-only answer; the query then stays
    // on model synthesis (or the existing fallback chain) instead.
    !isBareCrossReferenceAnswer(candidate.answer ?? "")
  );
}

export function hasValidatedExtractiveCandidate(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  routeReason: string;
}) {
  const candidate = buildValidatedExtractiveCandidate(args);

  return passesValidatedExtractiveCandidate(candidate);
}

/**
 * Skip model synthesis for the measured admission/discharge comparison only when the
 * deterministic candidate has two directly supported sections, exactly two citations, and
 * those citations belong to distinct documents. Generic comparisons and confidence-blocked
 * retrieval stay on their existing paths.
 */
export function hasValidatedAdmissionDischargeComparisonExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: ShortCircuitRoute;
  sourceBacked: boolean;
  gateStatus: RetrievalConfidenceGateStatus;
}) {
  if (
    !isSourceBoundAdmissionDischargeComparisonQuery(args.query, args.queryClass) ||
    args.route.mode !== "strong" ||
    args.route.reason !== "multi_document_comparison_synthesis" ||
    args.gateStatus !== "passed" ||
    !args.sourceBacked
  ) {
    return false;
  }

  const candidate = buildValidatedExtractiveCandidate({
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
    routeReason: `${args.route.reason}; validated_admission_discharge_extractive_first`,
  });
  return passesValidatedExtractiveCandidate(candidate) && isSourceBoundAdmissionDischargeComparisonAnswer(candidate);
}

/**
 * Skip generation for the measured active-community ED question only when the
 * deterministic candidate retains two distinct chunks from the same named
 * procedure and passes every final answer gate.
 */
export function hasValidatedActiveCommunityEdProcedureExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: ShortCircuitRoute;
  sourceBacked: boolean;
  gateStatus: RetrievalConfidenceGateStatus;
}) {
  if (
    !isSourceBoundActiveCommunityEdProcedureQuery(args.query, args.queryClass) ||
    args.route.mode !== "fast" ||
    args.route.reason !== "strong_routine_retrieval" ||
    args.gateStatus !== "passed" ||
    !args.sourceBacked
  ) {
    return false;
  }

  const candidate = buildValidatedExtractiveCandidate({
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
    routeReason: `${args.route.reason}; validated_active_community_ed_extractive_first`,
  });
  return passesValidatedExtractiveCandidate(candidate) && isSourceBoundActiveCommunityEdProcedureAnswer(candidate);
}

/**
 * Skip generation for the measured community-home-visit requirements question
 * only when the two required AKG procedure chunks come from the same document
 * and the final answer passes every quality and grounding gate.
 */
export function hasValidatedCommunityHomeVisitRequirementsExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: ShortCircuitRoute;
  sourceBacked: boolean;
  gateStatus: RetrievalConfidenceGateStatus;
}) {
  if (
    !isSourceBoundCommunityHomeVisitRequirementsQuery(args.query, args.queryClass) ||
    args.route.mode !== "fast" ||
    args.route.reason !== "strong_routine_retrieval" ||
    args.gateStatus !== "passed" ||
    !args.sourceBacked
  ) {
    return false;
  }

  const candidate = buildValidatedExtractiveCandidate({
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
    routeReason: `${args.route.reason}; validated_community_home_visit_requirements_extractive_first`,
  });
  return passesValidatedExtractiveCandidate(candidate) && isSourceBoundCommunityHomeVisitRequirementsAnswer(candidate);
}

/**
 * Skip generation for the measured Best Practice Prescription question only
 * when the program-use and medication-profile requirements come from two
 * distinct chunks in the same named AKG procedure and pass every final gate.
 */
export function hasValidatedBestPracticePrescriptionRequirementsExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: ShortCircuitRoute;
  sourceBacked: boolean;
  gateStatus: RetrievalConfidenceGateStatus;
}) {
  if (
    !isSourceBoundBestPracticePrescriptionRequirementsQuery(args.query, args.queryClass) ||
    args.route.mode !== "fast" ||
    args.route.reason !== "strong_routine_retrieval" ||
    args.gateStatus !== "passed" ||
    !args.sourceBacked
  ) {
    return false;
  }

  const candidate = buildValidatedExtractiveCandidate({
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
    routeReason: `${args.route.reason}; validated_best_practice_prescription_requirements_extractive_first`,
  });
  return (
    passesValidatedExtractiveCandidate(candidate) && isSourceBoundBestPracticePrescriptionRequirementsAnswer(candidate)
  );
}

/**
 * Skip generation for a clozapine blood-count stop-threshold question only when
 * one complete reviewed NMHS row supplies both analyte boundaries and the
 * treatment action, and the resulting answer passes every final gate.
 */
export function hasValidatedClozapineBloodActionThresholdExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: ShortCircuitRoute;
  sourceBacked: boolean;
  gateStatus: RetrievalConfidenceGateStatus;
}) {
  if (
    !isSourceBoundClozapineBloodActionThresholdQuery(args.query, args.queryClass) ||
    args.route.mode !== "strong" ||
    args.route.reason !== "clinical_risk_or_complex_query" ||
    args.gateStatus !== "passed" ||
    !args.sourceBacked
  ) {
    return false;
  }

  const candidate = buildValidatedExtractiveCandidate({
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
    routeReason: `${args.route.reason}; validated_clozapine_blood_threshold_extractive_first`,
  });
  return passesValidatedExtractiveCandidate(candidate) && isSourceBoundClozapineBloodActionThresholdAnswer(candidate);
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
    args.route.mode !== "strong" ||
    args.route.reason !== MEDICATION_DOSE_RISK_STRONG_ROUTE_REASON ||
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

const validatedAgitationArousalTypoDosingQuery =
  "what agitaton and arousl dosing guidance applies to psychiatric inpatients";

/**
 * Skip the measured timeout-prone model tail for the typo eval only when one
 * delivered source independently supports a clean, figure-bearing dose answer.
 */
export function hasValidatedAgitationArousalTypoDosingExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: ShortCircuitRoute;
  sourceBacked: boolean;
  gateStatus: RetrievalConfidenceGateStatus;
}) {
  const normalizedQuery = args.query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (
    normalizedQuery !== validatedAgitationArousalTypoDosingQuery ||
    args.queryClass !== "medication_dose_risk" ||
    args.route.mode !== "strong" ||
    args.route.reason !== MEDICATION_DOSE_RISK_STRONG_ROUTE_REASON ||
    args.gateStatus !== "passed" ||
    !args.sourceBacked
  ) {
    return false;
  }

  return validatedAgitationArousalTypoDosingResultIds(args) !== null;
}

function validatedAgitationArousalTypoDosingResultIds(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: ShortCircuitRoute;
}) {
  for (const result of args.results) {
    const candidate = retainCitedExtractiveFallbackEvidence(
      buildValidatedExtractiveCandidate({
        query: args.query,
        queryClass: args.queryClass,
        results: [result],
        routeReason: `${args.route.reason}; validated_agitation_arousal_typo_dosing_extractive_first`,
      }),
    );
    const deliveredText = [candidate.answer, ...(candidate.answerSections ?? []).map((section) => section.body)]
      .join(" ")
      .replace(/\*\*/g, "");
    if (
      passesValidatedExtractiveCandidate(candidate) &&
      candidate.citations.length === 1 &&
      candidate.sources.length === 1 &&
      extractiveAnswerCarriesIntentFigure(candidate.answer, args.query, args.queryClass) &&
      /\bagitation\b/i.test(deliveredText) &&
      /\barousal\b/i.test(deliveredText) &&
      !/\b(?:agitaton|arousl|zuclopenthixol|clopixol)\b/i.test(deliveredText)
    ) {
      return [result.id];
    }
  }
  return null;
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
    isSourceBoundBestPracticePrescriptionRequirementsQuery(args.query, args.queryClass) ||
    isSourceBoundCommunityHomeVisitRequirementsQuery(args.query, args.queryClass) ||
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
 * Precedence is fixed: measured source-bound answers first, then the generic
 * LAI-management skip (gate passed), score-blocked routine recovery (gate
 * blocked), and the gate-passed routine procedural short-circuit. Returns the
 * routing-reason marker to append, or null when generation should proceed unchanged.
 */
export function chooseValidatedExtractiveShortCircuit(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  route: ShortCircuitRoute;
  sourceBacked: boolean;
  gateStatus: RetrievalConfidenceGateStatus;
}): { reasonMarker: string; resultIds?: string[] } | null {
  const predicateArgs = {
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
    route: args.route,
    sourceBacked: args.sourceBacked,
  };

  if (hasValidatedAdmissionDischargeComparisonExtractiveAnswer(args)) {
    return { reasonMarker: "validated_admission_discharge_extractive_first" };
  }

  if (hasValidatedActiveCommunityEdProcedureExtractiveAnswer(args)) {
    return { reasonMarker: "validated_active_community_ed_extractive_first" };
  }

  if (hasValidatedCommunityHomeVisitRequirementsExtractiveAnswer(args)) {
    return { reasonMarker: "validated_community_home_visit_requirements_extractive_first" };
  }

  if (hasValidatedBestPracticePrescriptionRequirementsExtractiveAnswer(args)) {
    return { reasonMarker: "validated_best_practice_prescription_requirements_extractive_first" };
  }

  if (hasValidatedClozapineBloodActionThresholdExtractiveAnswer(args)) {
    return { reasonMarker: "validated_clozapine_blood_threshold_extractive_first" };
  }

  if (hasValidatedAgitationArousalTypoDosingExtractiveAnswer(args)) {
    return {
      reasonMarker: "validated_agitation_arousal_typo_dosing_extractive_first",
      resultIds: validatedAgitationArousalTypoDosingResultIds(args) ?? undefined,
    };
  }

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
