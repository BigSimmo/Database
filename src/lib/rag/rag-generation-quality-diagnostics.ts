/**
 * Provider-safe diagnostics for structured generation-quality failures (#231).
 *
 * When a generated answer fails a deterministic quality gate, the specific gate verdict
 * used to be discarded: the throw sites embedded it in an English Error message, and
 * `summarizeGenerationFailureReason` flattened every quality-gate message to the single
 * token `generation_quality_failed`, so live logs could not say WHICH gate rejected the
 * answer or what shape the rejected answer had. This module carries that verdict as
 * structured data alongside the unchanged Error message.
 *
 * Everything here is metadata-only: counts, lengths and booleans. No answer prose, no
 * source text, and no clinical content may ever be added to the shape — it is written
 * verbatim into `rag_queries` metadata and eval diagnostics.
 */

/** Where in the generation pipeline the quality gate rejected the answer. */
export type GenerationQualityFailureStage =
  /** The model returned a cited refusal / provider source gap. */
  | "cited_refusal"
  /** The strong-model answer failed `generatedAnswerQualityFailureReason`. */
  | "strong_gate"
  /** The finalized answer failed a post-finalize claim/governance/numeric gate. */
  | "post_finalize";

/** Provider-safe summary of a rejected generated answer. Counts and booleans only. */
export type GenerationQualityAnswerShape = {
  answer_chars: number;
  answer_words: number;
  first_sentence_chars: number;
  first_sentence_terminated: boolean;
  section_count: number;
  citation_count: number;
  distinct_cited_document_count: number;
  quote_card_count: number;
  conflict_or_gap_count: number;
  unverified_numeric_token_count: number;
  grounded: boolean;
  confidence: string | null;
};

/** The structural fields the shape summary reads. Kept minimal to avoid import cycles. */
type AnswerLike = {
  answer: string;
  grounded?: boolean;
  confidence?: string;
  answerSections?: Array<{ body: string }>;
  citations: Array<{ chunk_id: string; document_id?: string }>;
  quoteCards?: Array<unknown>;
  conflictsOrGaps?: Array<unknown>;
  unverifiedNumericTokens?: Array<string>;
};

/** Summarize a rejected generated answer as provider-safe metadata. Never includes prose. */
export function summarizeGenerationQualityAnswerShape(answer: AnswerLike): GenerationQualityAnswerShape {
  const text = answer.answer ?? "";
  const trimmed = text.trim();
  const sentenceEnd = trimmed.search(/[.!?](?:\s|$)/);
  const firstSentence = sentenceEnd === -1 ? trimmed : trimmed.slice(0, sentenceEnd + 1);
  return {
    answer_chars: trimmed.length,
    answer_words: trimmed ? trimmed.split(/\s+/).length : 0,
    first_sentence_chars: firstSentence.length,
    first_sentence_terminated: sentenceEnd !== -1,
    section_count: answer.answerSections?.length ?? 0,
    citation_count: answer.citations?.length ?? 0,
    distinct_cited_document_count: new Set(
      (answer.citations ?? []).map((citation) => citation.document_id ?? citation.chunk_id),
    ).size,
    quote_card_count: answer.quoteCards?.length ?? 0,
    conflict_or_gap_count: answer.conflictsOrGaps?.length ?? 0,
    unverified_numeric_token_count: answer.unverifiedNumericTokens?.length ?? 0,
    grounded: answer.grounded ?? false,
    confidence: answer.confidence ?? null,
  };
}

/**
 * A quality-gate rejection carrying its structured verdict. The message is kept
 * byte-identical to the previous plain `Error` (`OpenAI generation quality gate
 * failed: <reason>`) so `summarizeGenerationFailureReason` classification, routing
 * reasons, degraded-mode tokens, caching exclusions, and every existing assertion
 * on the flattened `generation_quality_failed` token are unchanged.
 */
export class GenerationQualityError extends Error {
  readonly stage: GenerationQualityFailureStage;
  readonly gateReason: string;
  readonly answerShape: GenerationQualityAnswerShape;

  constructor(stage: GenerationQualityFailureStage, gateReason: string, answerShape: GenerationQualityAnswerShape) {
    super(`OpenAI generation quality gate failed: ${gateReason}`);
    this.name = "GenerationQualityError";
    this.stage = stage;
    this.gateReason = gateReason;
    this.answerShape = answerShape;
  }
}

/** Extract structured quality-failure diagnostics from a generation error, if present. */
export function generationQualityFailureDiagnostics(error: unknown) {
  if (!(error instanceof GenerationQualityError)) return null;
  return { stage: error.stage, gateReason: error.gateReason, answerShape: error.answerShape };
}
