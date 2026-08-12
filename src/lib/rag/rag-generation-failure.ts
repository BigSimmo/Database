const PROVIDER_SAFE_GENERATION_QUALITY_FAILURE_REASONS = new Set([
  "empty_after_sanitize",
  "provider_source_gap",
  "incomplete_opening_sentence",
  "bad_final_answer_quality",
  "clinical_answer_quality_issue",
  "low_yield_answer",
  "fragment_like_answer",
  "missing_query_intent",
  "missing_query_overlap",
  "invalid_model_evidence_ids",
  "insufficient_broad_citation_coverage",
  "unusable_generated_answer",
  "template_like_answer",
  "overexpanded_simple_answer",
  "claim_support_high_risk_gap",
  "material_source_governance_gap",
  "numeric_band_coherence_gap",
  "numeric_faithfulness_gap",
]);

/** Reduce generation errors to bounded, provider-safe diagnostic metadata. */
export function summarizeGenerationFailureReason(error: unknown) {
  const message = (error instanceof Error ? error.message : typeof error === "string" ? error : "").trim();
  const normalized = message.toLowerCase();
  const sourceBackedRecovery = normalized.match(/\bsource_backed_extractive_recovery:([a-z0-9_]+)/);

  if (sourceBackedRecovery) return `source_backed_extractive_recovery_${sourceBackedRecovery[1]}`;
  if (!normalized) return "generation_failed";
  if (/\bprovider_source_gap\b/.test(normalized)) return "provider_source_gap";

  const qualityFailure = normalized.match(/^openai generation quality gate failed:\s*([a-z0-9_]+)$/);
  if (qualityFailure && PROVIDER_SAFE_GENERATION_QUALITY_FAILURE_REASONS.has(qualityFailure[1])) {
    return `generation_quality_failed_${qualityFailure[1]}`;
  }
  if (normalized.startsWith("openai generation quality gate failed:")) return "generation_quality_failed";

  if (/\bmax_output_tokens\b/.test(normalized)) return "provider_incomplete_max_output_tokens";
  if (/\bincomplete\b/.test(normalized)) return "provider_incomplete";
  if (/\brate limit|rate_limited|429\b/.test(normalized)) return "provider_rate_limited";
  if (/\btimeout|timed out|deadline|aborted|etimedout\b/.test(normalized)) return "provider_timeout";
  if (/\bauthentication|api key|unauthori[sz]ed|401|403\b/.test(normalized)) return "provider_auth_failed";

  if (/\bvalidation|quality gate|schema|parse|json\b/.test(normalized)) return "generation_quality_failed";
  if (/\bopenai|provider|model\b/.test(normalized)) return "provider_generation_failed";
  return "generation_failed";
}

/** Build the bounded repair instruction for an existing strong-model retry. */
export function generationQualityRetryInstruction(failureReason: string) {
  const numericFaithfulnessInstruction =
    failureReason === "numeric_faithfulness_gap"
      ? " The previous answer included a numeric token that deterministic verification could not match to its cited retrieved evidence. Include a number, dose, frequency, threshold, or timing only when its exact digits and unit appear in the cited source excerpt; otherwise omit it. Do not infer, convert, calculate, round, or combine figures."
      : "";
  return `The previous answer failed deterministic validation (${failureReason}).${numericFaithfulnessInstruction} Return schema-valid output only, with a complete natural clinical synthesis in the answer field. The first sentence must directly answer the question as a full sentence. Every clinical claim must be supported by valid retrieved citation_chunk_id values; do not invent citation IDs. Within one named scale and source, if differently labelled intervals overlap or a range is reversed, omit the entire affected band set; do not quote, repair, or infer any label or value. If a separate sentence or clause states a nonnumeric condition and action independent of the score, answer only with that independently supported condition and action, cite the smallest sufficient directly supporting chunk set, and add a conflict entry; otherwise return a source gap. Avoid template/source-inventory wording and do not include JSON fragments inside text fields. If the evidence cannot support the requested clinical answer, return a concise source-gap answer instead. If the question is a simple definition or direct fact question, answer only that question and return answerSections as an empty array unless a source-gap or safety caveat is essential.`;
}
