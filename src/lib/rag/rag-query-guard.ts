import type { ClinicalQueryAnalysis } from "@/lib/types";

const clearlyNonClinicalConsumerPattern =
  /\b(coffee\s*machine|espresso|kitchen|recipe|holiday|hotel|restaurant|car|mortgage|insurance|gaming|laptop|phone|television|tv|washing\s*machine|air\s*fryer|vacuum|flight|airline)\b/i;

export const clearlyOutsideCorpusMedicalPattern =
  /\b(?:diabetic ketoacidosis|dka|community acquired pneumonia|pneumonia|antibiotic|ssri|adolescent depression|hyperkalaemia|hyperkalemia)\b/i;

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
