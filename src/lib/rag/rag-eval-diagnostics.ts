import {
  australianSourceClassification,
  australianSourceTier,
  isAustralianSourceTier,
  type AustralianSourceTier,
} from "@/lib/australian-source-priority";
import type { RagAnswer, SearchResult } from "@/lib/types";

export type RagEvalProgressDiagnosticEvent = {
  stage: string;
  mode?: RagAnswer["routingMode"];
  selectedContextCount?: number;
  australianSourceCount?: number;
  waSourceCount?: number;
  usedSupplementaryFallback?: boolean;
  timingMs?: number;
};

function emptyTierCounts(): Record<AustralianSourceTier, number> {
  return {
    wa_validated: 0,
    australian_national: 0,
    australian_state: 0,
    supplementary: 0,
  };
}

function sourceTierCounts(sources: Array<Pick<SearchResult, "source_metadata">>) {
  return sources.reduce<Record<AustralianSourceTier, number>>((counts, source) => {
    counts[australianSourceTier(source)] += 1;
    return counts;
  }, emptyTierCounts());
}

function sourceForCitation(answer: RagAnswer, chunkId: string) {
  return answer.sources.find((source) => source.id === chunkId) ?? null;
}

function genericFinalizationFailure(answer: string) {
  return /(?:could not|unable to) generate (?:a )?finali[sz]ed answer|review the source snippets below/i.test(answer);
}

export function buildRagEvaluationDiagnostics(answer: RagAnswer, progress: RagEvalProgressDiagnosticEvent[] = []) {
  const sourceClassifications = answer.sources.map((source) => ({
    source,
    classification: australianSourceClassification(source),
  }));
  const australianSources = sourceClassifications.filter(({ classification }) =>
    isAustralianSourceTier(classification.tier),
  );
  const citationIsValid = (citation: RagAnswer["citations"][number]) => {
    const source = sourceForCitation(answer, citation.chunk_id);
    return Boolean(source && source.document_id === citation.document_id);
  };
  const validCitations = answer.citations.filter(citationIsValid);
  const validCitationSources = validCitations
    .map((citation) => sourceForCitation(answer, citation.chunk_id))
    .filter((source): source is SearchResult => Boolean(source));
  const invalidCitations = answer.citations.filter((citation) => !citationIsValid(citation));
  const validAustralianCitations = validCitationSources.filter((source) =>
    isAustralianSourceTier(australianSourceTier(source)),
  );
  const australianDocumentCount = new Set(australianSources.map(({ source }) => source.document_id)).size;
  const sufficientAustralianCandidates = australianSources.length >= 4 && australianDocumentCount >= 2;
  const supplementaryContextSelected = progress.some(
    (event) => (event.stage === "ranking" || event.stage === "fallback") && event.usedSupplementaryFallback === true,
  );
  const supplementaryCitationCount = validCitationSources.filter(
    (source) => australianSourceTier(source) === "supplementary",
  ).length;
  const authorityConflicts = sourceClassifications
    .filter(({ classification }) => classification.conflict)
    .map(({ source, classification }) => ({
      chunk_id: source.id,
      document_id: source.document_id,
      file_name: source.file_name,
      conflicts: classification.conflicts,
    }));
  const generationRoutes = [
    ...progress
      .filter((event) => event.stage === "generating" || event.stage === "retrying" || event.stage === "fallback")
      .map((event) => event.mode)
      .filter((mode): mode is NonNullable<RagAnswer["routingMode"]> => Boolean(mode)),
    ...(answer.routingMode ? [answer.routingMode] : []),
  ];

  return {
    grounded: answer.grounded,
    source_tier_counts: sourceTierCounts(answer.sources),
    citation_tier_counts: sourceTierCounts(validCitationSources),
    australian_candidate_passage_count: australianSources.length,
    australian_candidate_document_count: australianDocumentCount,
    authority_conflict_count: authorityConflicts.length,
    authority_conflicts: authorityConflicts,
    citation_count: answer.citations.length,
    valid_citation_count: validCitations.length,
    invalid_citation_count: invalidCitations.length,
    invalid_citation_chunk_ids: invalidCitations.map((citation) => citation.chunk_id),
    valid_australian_citation_count: validAustralianCitations.length,
    unverified_numeric_token_count: answer.unverifiedNumericTokens?.length ?? 0,
    unverified_numeric_tokens: answer.unverifiedNumericTokens ?? [],
    supplementary_context_selected: supplementaryContextSelected,
    supplementary_citation_count: supplementaryCitationCount,
    sufficient_australian_candidates: sufficientAustralianCandidates,
    supplementary_selected_despite_sufficient_australian:
      sufficientAustralianCandidates && (supplementaryContextSelected || supplementaryCitationCount > 0),
    generic_finalization_failure: genericFinalizationFailure(answer.answer),
    route: answer.routingMode ?? "none",
    generation_routes: [...new Set(generationRoutes)],
    provider_mode: answer.providerMode ?? null,
    response_mode: answer.responseMode ?? null,
    answer_quality_tier: answer.answerQualityTier ?? null,
    fallback_reason: answer.fallbackReason ?? null,
    degraded_mode: answer.degradedMode ?? null,
    latency_timings: answer.latencyTimings ?? null,
    progress_sequence: progress.map((event) => event.stage),
    progress_events: progress.map((event) => ({
      stage: event.stage,
      mode: event.mode ?? null,
      selected_context_count: event.selectedContextCount ?? null,
      australian_source_count: event.australianSourceCount ?? null,
      wa_source_count: event.waSourceCount ?? null,
      used_supplementary_fallback: event.usedSupplementaryFallback ?? null,
      timing_ms: event.timingMs ?? null,
    })),
  };
}

export function evaluateAustralianRagExpectation(diagnostics: ReturnType<typeof buildRagEvaluationDiagnostics>) {
  const failures: string[] = [];
  const warnings: string[] = [];

  if (!diagnostics.grounded) failures.push("answer was not grounded");
  if (diagnostics.valid_australian_citation_count < 1) failures.push("no valid Australian citation");
  if (diagnostics.invalid_citation_count > 0) {
    failures.push(`invalid citations ${diagnostics.invalid_citation_count}`);
  }
  if (diagnostics.authority_conflict_count > 0) {
    failures.push(`source authority conflicts ${diagnostics.authority_conflict_count}`);
  }
  if (diagnostics.unverified_numeric_token_count > 0) {
    failures.push(`unverified numeric tokens ${diagnostics.unverified_numeric_token_count}`);
  }
  if (diagnostics.generic_finalization_failure) failures.push("generic finalization failure returned");
  if (diagnostics.supplementary_selected_despite_sufficient_australian) {
    failures.push("supplementary evidence selected despite sufficient Australian evidence");
  }
  if (diagnostics.australian_candidate_passage_count < 4) {
    warnings.push(`Australian candidate passages ${diagnostics.australian_candidate_passage_count}/4`);
  }
  if (diagnostics.australian_candidate_document_count < 2) {
    warnings.push(`Australian candidate documents ${diagnostics.australian_candidate_document_count}/2`);
  }

  return { passed: failures.length === 0, failures, warnings };
}
