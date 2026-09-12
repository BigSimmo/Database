import { projectGenerationDegradation } from "@/lib/rag/rag-generation-degradation";
import { normalizeRagFallbackReasonCode } from "@/lib/rag/rag-fallback-reason";
import {
  australianSourceClassification,
  australianSourceTier,
  isAustralianSourceTier,
  type AustralianSourceTier,
} from "@/lib/australian-source-priority";
import type { RagAnswer, SearchResult } from "@/lib/types";

const domains = [
  "services",
  "forms",
  "medications",
  "differentials",
  "specifiers",
  "dsm",
  "formulation",
  "therapies",
  "dictionary",
  "factsheets",
  "calculators",
  "tools",
] as const;
const boundedCount = (value: unknown, max = 96): number | null =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max ? Number(value) : null;
const boundedEnum = <T extends string>(value: unknown, values: readonly T[]): T | null =>
  values.includes(value as T) ? (value as T) : null;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export type RagEvalDiagnosticsInput = Record<string, unknown>;
/** An explicit field allowlist, including when input came from a cache or fixture. */
export function sanitizeRagEvalDiagnostics(input: RagEvalDiagnosticsInput) {
  const coverage = record(input.coverage_counts);
  const required = boundedCount(input.required_part_count, 4);
  const represented = boundedCount(input.represented_part_count, 4);
  const consistentParts = required !== null && represented !== null && represented <= required;
  return {
    version: "rag-eval-content-free-v1" as const,
    query_plan_kind: boundedEnum(input.query_plan_kind, ["single", "decomposed", "clarification_required"] as const),
    subquestion_count: boundedCount(input.subquestion_count, 4),
    coverage_counts: {
      direct: boundedCount(coverage.direct, 4),
      partial: boundedCount(coverage.partial, 4),
      conflicting: boundedCount(coverage.conflicting, 4),
      absent: boundedCount(coverage.absent, 4),
    },
    required_part_count: consistentParts ? required : null,
    represented_part_count: consistentParts ? represented : null,
    // Coverage-part loss, not a claim that every clinical fact/numeric qualifier survived.
    required_part_loss_count: consistentParts ? required - represented : null,
    site_candidate_count: boundedCount(input.site_candidate_count),
    site_selected_count: boundedCount(input.site_selected_count),
    australian_candidate_count: boundedCount(
      input.australian_candidate_count ?? record(input.candidate_counts).australian_public,
    ),
    australian_selected_count: boundedCount(
      input.australian_selected_count ?? record(input.selected_counts).australian_public,
    ),
    selected_site_domains: Array.isArray(input.selected_site_domains)
      ? [
          ...new Set(
            input.selected_site_domains.filter((value): value is (typeof domains)[number] => domains.includes(value)),
          ),
        ].slice(0, domains.length)
      : [],
    public_site_content_state: boundedEnum(input.public_site_content_state, [
      "current",
      "updating",
      "stale",
      "unavailable",
      "disabled",
    ] as const),
    site_static_manifest_match:
      typeof input.site_static_manifest_match === "boolean" ? input.site_static_manifest_match : null,
    site_pending_count_bucket: boundedEnum(input.site_pending_count_bucket, ["0", "1", "2_to_5", "6_plus"] as const),
    augmentation_outcome: boundedEnum(input.augmentation_outcome, [
      "not_needed",
      "used",
      "no_eligible_evidence",
      "unavailable",
      "disabled",
    ] as const),
    role_exclusion_count: boundedCount(input.role_exclusion_count),
    fallback_reason_code: normalizeRagFallbackReasonCode(input.fallback_reason_code),
    generation_outcome: boundedEnum(input.generation_outcome, [
      "generated",
      "extractive",
      "source_only",
      "failed",
    ] as const),
    recovery_eligible: typeof input.recovery_eligible === "boolean" ? input.recovery_eligible : null,
    reviewed_input_state: boundedEnum(input.reviewed_input_state, ["not_assessed", "unavailable", "reviewed"] as const),
  };
}
export type ContentFreeRagDiagnostics = ReturnType<typeof sanitizeRagEvalDiagnostics>;

const routes = ["fast", "strong", "extractive", "unsupported"] as const;
const stages = [
  "scoping",
  "retrieving",
  "retrieved",
  "ranking",
  "generating",
  "retrying",
  "verifying",
  "fallback",
  "cached",
  "complete",
] as const;
function contentFreeTimings(input: RagAnswer["latencyTimings"]) {
  const timings: Record<string, number> = {};
  for (const key of [
    "total_latency_ms",
    "search_latency_ms",
    "generation_latency_ms",
    "embedding_latency_ms",
    "supabase_rpc_latency_ms",
    "rerank_latency_ms",
    "answer_retry_count",
    "context_pack_latency_ms",
    "verification_latency_ms",
  ] as const) {
    const value = input?.[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) timings[key] = value;
  }
  return timings;
}

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
    rag_diagnostics: sanitizeRagEvalDiagnostics(answer.ragDiagnostics ?? {}),
    generation_degradation: projectGenerationDegradation(answer.generationDegradation),
    grounded: answer.grounded,
    source_tier_counts: sourceTierCounts(answer.sources),
    citation_tier_counts: sourceTierCounts(validCitationSources),
    australian_candidate_passage_count: australianSources.length,
    australian_candidate_document_count: australianDocumentCount,
    authority_conflict_count: authorityConflicts.length,
    authority_conflicts: authorityConflicts.map(({ conflicts }) => ({ conflicts })),
    citation_count: answer.citations.length,
    valid_citation_count: validCitations.length,
    invalid_citation_count: invalidCitations.length,
    valid_australian_citation_count: validAustralianCitations.length,
    unverified_numeric_token_count: answer.unverifiedNumericTokens?.length ?? 0,
    supplementary_context_selected: supplementaryContextSelected,
    supplementary_citation_count: supplementaryCitationCount,
    sufficient_australian_candidates: sufficientAustralianCandidates,
    supplementary_selected_despite_sufficient_australian:
      sufficientAustralianCandidates && (supplementaryContextSelected || supplementaryCitationCount > 0),
    generic_finalization_failure: genericFinalizationFailure(answer.answer),
    // #231: the specific quality-gate verdict(s) recorded when generation fell back;
    // empty when generation succeeded or failed for a non-quality reason.
    generation_quality_gate_failure_count: (answer.latencyTimings?.answer_retry_reasons ?? []).filter((reason) =>
      reason.startsWith("generation_quality_gate:"),
    ).length,
    route: boundedEnum(answer.routingMode, routes) ?? "none",
    generation_routes: [...new Set(generationRoutes.flatMap((route) => boundedEnum(route, routes) ?? []))],
    provider_mode: boundedEnum(answer.providerMode, ["openai", "source_only"] as const),
    fallback_reason: normalizeRagFallbackReasonCode(answer.fallbackReasonCode),
    degraded_mode: answer.degradedMode?.active === true,
    latency_timings: contentFreeTimings(answer.latencyTimings),
    progress_sequence: progress.map((event) => boundedEnum(event.stage, stages) ?? "unknown"),
    progress_events: progress.map((event) => ({
      stage: boundedEnum(event.stage, stages) ?? "unknown",
      mode: boundedEnum(event.mode, routes),
      selected_context_count: boundedCount(event.selectedContextCount),
      australian_source_count: boundedCount(event.australianSourceCount),
      wa_source_count: boundedCount(event.waSourceCount),
      used_supplementary_fallback:
        typeof event.usedSupplementaryFallback === "boolean" ? event.usedSupplementaryFallback : null,
      timing_ms: boundedCount(event.timingMs, 300000),
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
