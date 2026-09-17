export const keywordStopWords = new Set([
  "a",
  "about",
  "all",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "both",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "get",
  "had",
  "has",
  "have",
  "her",
  "his",
  "how",
  "if",
  "in",
  "is",
  "it",
  "its",
  "into",
  "me",
  "may",
  "more",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "out",
  "should",
  "so",
  "such",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "would",
  "you",
]);

export function extractKeywordTerms(query: string, options: { maxTerms?: number } = {}): string[] {
  const maxTerms = options.maxTerms ?? 12;
  const normalized = query
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\w\s]+/g, " ")
    .replace(/_/g, " ")
    .trim();
  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 3 && !keywordStopWords.has(token));
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    terms.push(token);
  }

  return terms.slice(0, maxTerms);
}

export function keywordQueryFromNaturalLanguage(query: string) {
  return extractKeywordTerms(query, { maxTerms: 7 }).join(" ");
}

// A query term only counts against a name/title when it aligns with a word
// boundary — exact word, or word prefix to keep search-as-you-type working —
// so terms cannot hide inside words ("renal" inside "adrenaline"). Words are
// split on every non-alphanumeric so tokens like "im/po" or "co-codamol"
// match on their parts.
export function matchesTermAtWordBoundary(text: string, term: string) {
  if (!term) return false;
  return matchesTermInWords(wordBoundaryWords(text), term);
}

/**
 * The haystack half of a word-boundary match, split out so a caller testing
 * several terms against the same text splits it once instead of once per term.
 * Callers that score a document chunk or a catalogue field were re-lowercasing
 * and re-splitting multi-kilobyte strings for every query term.
 */
export function wordBoundaryWords(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/);
}

/** `matchesTermAtWordBoundary` against an already-split haystack. */
export function matchesTermInWords(words: readonly string[], term: string) {
  if (!term) return false;
  return words.some((word) => word === term || word.startsWith(term));
}
