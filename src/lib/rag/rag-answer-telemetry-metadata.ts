import { env } from "@/lib/env";
import type { RagAnswer } from "@/lib/types";

type AnswerLatencyTimings = NonNullable<RagAnswer["latencyTimings"]>;

/**
 * Packet B1 (docs/rag-improvement/README.md §B1): the tail latency fields every
 * answer-path `rag_queries.metadata` block persists, plus the extended fields added
 * behind `RAG_TELEMETRY_EXTENDED` (default false — that flag is the whole-surface
 * rollback for B1).
 *
 * The extended projection is fail-closed by construction: only keys named in
 * `EXTENDED_ANSWER_TELEMETRY_ALLOWLIST` are read from the timings object, and only
 * finite numbers are emitted, so free text — including the adversarial-fixture canary
 * tokens — can never reach the telemetry sink through this path even from a
 * contaminated input. `tests/rag-telemetry-canary-absence.test.ts` pins both
 * properties against the registered canary tokens, and pins that the flag-off shape
 * is byte-identical to the legacy three-field output.
 */
export const EXTENDED_ANSWER_TELEMETRY_ALLOWLIST = ["verification_latency_ms"] as const;

type ExtendedAnswerTelemetryKey = (typeof EXTENDED_ANSWER_TELEMETRY_ALLOWLIST)[number];

export function extendedAnswerTelemetryFields(
  timings: AnswerLatencyTimings | null | undefined,
): Partial<Record<ExtendedAnswerTelemetryKey, number>> {
  if (!env.RAG_TELEMETRY_EXTENDED) return {};
  const source: Record<string, unknown> = timings ?? {};
  const fields: Partial<Record<ExtendedAnswerTelemetryKey, number>> = {};
  for (const key of EXTENDED_ANSWER_TELEMETRY_ALLOWLIST) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) fields[key] = value;
  }
  return fields;
}

export function answerLatencyMetadata(
  searchLatencyMs: number,
  generationLatencyMs: number,
  timings: AnswerLatencyTimings | null | undefined,
  startedAt: number,
): Record<string, unknown> {
  return {
    search_latency_ms: searchLatencyMs,
    generation_latency_ms: generationLatencyMs,
    total_latency_ms: timings?.total_latency_ms ?? Date.now() - startedAt,
    ...extendedAnswerTelemetryFields(timings),
  };
}

export function scoreExplanationLogMetadata(scoreExplanations: NonNullable<RagAnswer["scoreExplanations"]>) {
  return {
    score_explanation_count: scoreExplanations.length,
    top_cited_score_explanations: scoreExplanations.slice(0, 8).map((entry) => ({
      chunk_id: entry.chunk_id,
      document_id: entry.document_id,
      final_score: entry.finalScore,
      vector_score: entry.score_explanation?.vectorScore ?? null,
      text_rank: entry.score_explanation?.textRank ?? null,
      weighted_hybrid_score: entry.score_explanation?.weightedHybridScore ?? null,
      rrf_score: entry.score_explanation?.rrfScore ?? null,
      memory_boost: entry.score_explanation?.memoryBoost ?? null,
      title_boost: entry.score_explanation?.titleBoost ?? null,
      metadata_boost: entry.score_explanation?.metadataBoost ?? null,
      lexical_coverage_score: entry.score_explanation?.lexicalCoverageScore ?? null,
      metadata_match_score: entry.score_explanation?.metadataMatchScore ?? null,
      section_title_match_boost: entry.score_explanation?.sectionTitleMatchBoost ?? null,
      freshness_recency_boost: entry.score_explanation?.freshnessRecencyBoost ?? null,
      clinical_signal_boost: entry.score_explanation?.clinicalSignalBoost ?? null,
      penalty: entry.score_explanation?.penalty ?? null,
      final_rank: entry.score_explanation?.finalRank ?? null,
    })),
  };
}
