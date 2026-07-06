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
