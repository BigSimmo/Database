import type { ClinicalQueryAnalysis } from "@/lib/types";

const clearlyNonClinicalConsumerPattern =
  /\b(coffee\s*machine|espresso|kitchen|recipe|holiday|hotel|restaurant|car|mortgage|insurance|gaming|laptop|phone|television|tv|washing\s*machine|air\s*fryer|vacuum|flight|airline)\b/i;

/**
 * Topics genuinely outside a psychiatric corpus, used to hard-pin the four medical
 * false-positive controls in `rag-eval-cases.ts` at `unsupported_correct_rate` 1.0.
 * Removing the guard outright was measured at 0.79 on 2026-07-03
 * (`docs/process-hardening.md`), because three of those four controls contain the word
 * "dose" and so are not soft-tail eligible — deleting this does not hand the decision to
 * `classifyCorpusGrounding`, it hands it to the weak-support route gate.
 *
 * Every entry must be a DISEASE-SPECIFIC PHRASE, never a bare clinical token. The bare
 * tokens `ssri`, `antibiotic`, `pneumonia`, `dka` and `ketamine sedation` were transcribed
 * from the controls' own question text and refused in-corpus psychiatric queries with zero
 * retrieval: `ssri` is an `expectedContentTerms` entry of the golden case `vector-gad-worry`
 * (`scripts/fixtures/rag-retrieval-golden.json`), so "Which SSRI is first line for
 * generalised anxiety disorder?" was refused content-blind (#000GN4).
 *
 * No retrieval gate could catch that, and it is worth being precise about why: not one of
 * the 36 golden QUERIES matches this pattern in either its old or its narrowed form — `ssri`
 * appears only in a case's expected content terms, never in a question — so the guard never
 * fires during `eval:retrieval:quality` and that eval cannot move in either direction from a
 * change here. The eval that discriminates is `eval:quality --rag-only`'s
 * `unsupported_correct_rate`, which pins the four controls through `scripts/eval-utils.ts`.
 * `tests/corpus-grounding.test.ts` pins both directions offline; keep it in lockstep.
 *
 * Dropping bare `dka` is a deliberate, separate loss: "What is the DKA protocol?" no longer
 * refuses by pattern and falls to the weak-support route gate. The control spells the
 * disease out, so no eval gate depends on the abbreviation.
 *
 * Matched against BOTH the raw query (here) and `normalizeAnalysisText`'s output
 * (`clinical-search.ts`), which folds any non-alphanumeric run to a single space. The one
 * hyphenated phrase therefore uses a bounded character class rather than a literal hyphen,
 * so the raw path also catches an en dash, a non-breaking hyphen, or a double space.
 */
export const clearlyOutsideCorpusMedicalPattern =
  /\b(?:diabetic ketoacidosis|community[^a-z0-9]{1,3}acquired pneumonia|adolescent depression|hyperkalaemia|hyperkalemia)\b/i;

export const unavailableDocumentNoisePattern =
  /\b(?:newly uploaded|future synthetic|not been uploaded|not uploaded|2027 revised|airport travel policy|gardening equipment checklist)\b/i;

export const DEFAULT_SOFT_TAIL_CONFIDENCE_THRESHOLD = 0.42;

function unsupportedSoftTailEligible(analysis: ClinicalQueryAnalysis) {
  if (analysis.queryClass !== "unsupported_or_general") return false;
  if (analysis.documentTitleIntent || analysis.medications.length || analysis.thresholdTerms.length) return false;
  if (analysis.reasons.some((reason) => reason !== "no_specific_rag_class_terms")) return false;
  return true;
}

export function shouldShortCircuitUnsupportedSearch(query: string, analysis: ClinicalQueryAnalysis) {
  if (unavailableDocumentNoisePattern.test(query)) return true;
  if (clearlyOutsideCorpusMedicalPattern.test(query) && analysis.documentTitleTerms.length === 0) return true;
  if (!unsupportedSoftTailEligible(analysis)) return false;
  if (clearlyNonClinicalConsumerPattern.test(query)) return true;
  return analysis.confidence <= DEFAULT_SOFT_TAIL_CONFIDENCE_THRESHOLD && analysis.expandedTerms.length <= 5;
}

// True only for queries that would short-circuit via the soft tail itself, not a pattern guard.
export function isUnsupportedSoftTailAnalysis(query: string, analysis: ClinicalQueryAnalysis) {
  if (unavailableDocumentNoisePattern.test(query)) return false;
  if (clearlyOutsideCorpusMedicalPattern.test(query) && analysis.documentTitleTerms.length === 0) return false;
  if (!unsupportedSoftTailEligible(analysis)) return false;
  if (clearlyNonClinicalConsumerPattern.test(query)) return false;
  return analysis.confidence <= DEFAULT_SOFT_TAIL_CONFIDENCE_THRESHOLD && analysis.expandedTerms.length <= 5;
}

/**
 * Soft-tail zeros should skip search/answer cache writes only when a nondeterministic
 * classifier call could have produced them. Without an API key the classifier path is
 * unreachable (`analyzeQueryWithClassifierFallback` returns early), and an
 * `"out_of_corpus"` grounding verdict is a deterministic corpus-derived true negative —
 * both stay cacheable.
 */
export function shouldSkipUnsupportedSoftTailCacheWrite(
  query: string,
  analysis: ClinicalQueryAnalysis,
  options: {
    openAiApiKeyPresent: boolean;
    corpusGrounding?: ClinicalQueryAnalysis["corpusGrounding"];
  },
): boolean {
  if (!options.openAiApiKeyPresent) return false;
  const grounding = options.corpusGrounding ?? analysis.corpusGrounding;
  if (grounding === "out_of_corpus") return false;
  return isUnsupportedSoftTailAnalysis(query, analysis);
}

/** Answer-path counterpart: only skip when the empty unsupported refusal came from the soft-tail short circuit. */
export function shouldSkipUnsupportedSoftTailAnswerCacheWrite(args: {
  resultCount: number;
  retrievalStrategy: string | undefined;
  query: string;
  analysis: ClinicalQueryAnalysis;
  openAiApiKeyPresent: boolean;
  corpusGrounding?: ClinicalQueryAnalysis["corpusGrounding"];
}): boolean {
  if (args.resultCount > 0 || args.retrievalStrategy !== "unsupported_short_circuit") return false;
  return shouldSkipUnsupportedSoftTailCacheWrite(args.query, args.analysis, {
    openAiApiKeyPresent: args.openAiApiKeyPresent,
    corpusGrounding: args.corpusGrounding,
  });
}
