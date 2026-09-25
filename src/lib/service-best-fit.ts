// The services navigator's "Best fit" badge used to mean only "ranked in the top two" —
// so a record that scraped into second place through a loose partial-word or fuzzy match
// still wore the same "Best fit" pill as a record that actually matched every word the
// psychiatrist typed. That is misleading in a referral context: "Best fit" reads as a
// claim about the record, not about its rank. This module is the honesty gate — it is
// deliberately blind to ranking. It only answers "does every meaningful word in the
// query actually appear in this record's own searchable text?", and the caller (the
// services navigator page) ANDs that with the existing top-two rank check before
// showing the badge. See #CNCAFV.

import { normalizeSearchText } from "@/lib/catalog-search";
import { serviceRecordSearchText, type ServiceRecord } from "@/lib/service-ranker";

// Common connective words that carry no matching signal of their own — filtering them
// out means a query like "help for panic disorder" is judged on "help", "panic" and
// "disorder", not diluted by "for". Deliberately small and services-specific rather than
// a general-purpose stopword list: this module's only job is the best-fit token check.
const BEST_FIT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "at",
  "be",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "has",
  "have",
  "how",
  "i",
  "in",
  "into",
  "is",
  "it",
  "me",
  "my",
  "need",
  "needs",
  "of",
  "on",
  "or",
  "our",
  "she",
  "someone",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "what",
  "where",
  "who",
  "with",
  "you",
  "your",
]);

/**
 * The non-stopword tokens of a query, normalized the same way service search text is
 * (lowercased, accents stripped). Used both to judge best fit and, by tests, to see
 * exactly what a query reduces to.
 */
export function bestFitQueryTokens(query: string): string[] {
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter((token) => token.length > 0 && !BEST_FIT_STOP_WORDS.has(token));
}

/**
 * True when every non-stopword token of `query` appears somewhere in the service's own
 * searchable text (title, tags, catchments, contacts, criteria, etc — the same field
 * set `rankServiceRecords` searches). An empty/all-stopword query has nothing to
 * contradict, so it is treated as matching — that leaves browse-mode (no query) display
 * unchanged and only withholds the badge when the query names something the record
 * genuinely does not carry.
 */
export function serviceMatchesEveryQueryToken(service: ServiceRecord, query: string): boolean {
  const tokens = bestFitQueryTokens(query);
  if (tokens.length === 0) return true;
  const haystack = serviceRecordSearchText(service);
  return tokens.every((token) => haystack.includes(token));
}
