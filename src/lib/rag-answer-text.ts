import {
  clinicalProseUsefulness,
  isLowYieldClinicalText,
  sourceTextForClinicalProse,
} from "@/lib/source-text-sanitizer";

const likelyFragmentPhrases =
  /\b(?:answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|conflictsOrGaps|quoteCards?|source_chunk_ids|chunk_id)\b/i;
const answerSectionArtifactPattern =
  /"?(answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|conflictsOrGaps|quoteCards?|source_chunk_ids|chunk_id)"?\s*:\s*/i;
// Mid-text truncation must only fire on a genuine leaked JSON key — i.e. a
// double-quoted key followed by a colon ("confidence":). A bare English word +
// colon ("...document the confidence: high...") is legitimate clinical prose and
// must NOT cause the rest of the answer/section to be sliced away.
const leakedJsonKeyPattern =
  /"(answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|conflictsOrGaps|quoteCards?|source_chunk_ids|chunk_id)"\s*:/i;

export function normalizeSectionText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function splitBalancedWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function looksLikeJsonArtifact(value: string) {
  const normalized = normalizeSectionText(value);
  if (!normalized) return true;
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasJsonStructure = /[{}\[\]]/.test(normalized);
  const quoteCount = (normalized.match(/"/g) ?? []).length;
  const colonCount = (normalized.match(/:/g) ?? []).length;
  const keyValuePairs = (normalized.match(/"[^"]+"\s*:\s*/g) ?? []).length;
  const keyPairDensity = tokenCount > 0 ? keyValuePairs / tokenCount : 0;
  const hasKnownKeys = likelyFragmentPhrases.test(normalized);
  const hasBalancedBraces = (normalized.match(/[{}\[\]]/g) ?? []).length >= 2;
  const hasBalancedBrackets = (normalized.match(/[\[\]]/g) ?? []).length >= 2;
  const tokenDensity = splitBalancedWords(normalized);
  const isMostlyPunctuationNoise = tokenDensity.length >= 6 && tokenDensity.every((word) => word.length <= 2);
  const hasBracketKeyPairs =
    /"\s*(?:answer|heading|body|grounded|confidence|citation_chunk_ids|conflictsOrGaps|quoteCards?|source_chunk_ids|chunk_id)\s*"/i.test(
      normalized,
    );

  if (normalized.startsWith("{") && normalized.endsWith("}") && (hasKnownKeys || quoteCount >= 4)) {
    return true;
  }

  if (
    hasJsonStructure &&
    hasBalancedBraces &&
    keyValuePairs >= 2 &&
    quoteCount >= 4 &&
    colonCount >= 2 &&
    hasKnownKeys &&
    (tokenCount <= 70 || keyPairDensity > 0.2)
  ) {
    return true;
  }

  if (
    normalized.includes("}") &&
    normalized.includes("{") &&
    hasKnownKeys &&
    /"[^"]+":\s*"/.test(normalized) &&
    tokenCount <= 40
  ) {
    return true;
  }

  if (isMostlyPunctuationNoise) return true;
  if (
    hasBracketKeyPairs &&
    hasJsonStructure &&
    (quoteCount >= 2 || colonCount >= 2 || hasBalancedBrackets) &&
    tokenCount <= 70
  ) {
    return true;
  }

  return false;
}

export function sanitizeStructuredText(
  value: string,
  options: { minLength?: number; minTokens?: number; keepLeading?: boolean } = {},
) {
  const { minLength = 2, minTokens = 1, keepLeading = false } = options;
  const normalized = normalizeSectionText(sourceTextForClinicalProse(value));
  if (!normalized) return "";

  // A leaked key at the very start is stripped (lenient: it is clearly an
  // artifact prefix). Mid-text, only truncate at a genuine quoted JSON key so we
  // never cut real prose at an ordinary word like "confidence:" or "body:".
  const leakedKeyIndex = normalized.search(leakedJsonKeyPattern);
  const trimmed =
    normalized.search(answerSectionArtifactPattern) === 0
      ? normalized.replace(answerSectionArtifactPattern, "").trim()
      : leakedKeyIndex > 0
        ? normalized.slice(0, leakedKeyIndex).trim()
        : normalized;

  const finalText = keepLeading ? trimmed : trimmed.trim();
  if (!finalText) return "";
  if (finalText.length < minLength) return "";
  if (looksLikeJsonArtifact(finalText)) return "";
  const tokenCount = finalText.split(/\s+/).filter(Boolean).length;
  if (tokenCount < minTokens) return "";
  if (!/[A-Za-z]{2,}/.test(finalText)) return "";
  const usefulness = clinicalProseUsefulness(finalText);
  if (!usefulness.useful && isLowYieldClinicalText(finalText)) return "";
  return usefulness.text || finalText;
}

export function sanitizeAnswerText(value: string) {
  return sanitizeStructuredText(value, { minLength: 8, minTokens: 2, keepLeading: true });
}

export function isUsableAnswerSectionText(value: string, options: { minTokens?: number; minLength?: number } = {}) {
  return Boolean(sanitizeStructuredText(value, options));
}
