import type { SearchResult } from "@/lib/types";

const textSearchStopWords = new Set([
  "what",
  "when",
  "where",
  "which",
  "how",
  "the",
  "and",
  "with",
  "from",
  "into",
  "for",
  "that",
  "this",
  "are",
  "was",
  "were",
  "been",
  "being",
  "managed",
  "management",
  "process",
  "procedure",
  "should",
  "does",
  "include",
  "includes",
  "identified",
  "identify",
  "identifies",
  "required",
  "require",
  "requires",
  "requirement",
  "requirements",
  "guideline",
  "document",
  "documents",
  "information",
  "patient",
  "patients",
  "pts",
  "clinical",
]);

const synonymGroups = [
  ["monitor", "monitoring", "baseline", "review", "follow-up", "blood test", "level"],
  ["contraindication", "avoid", "do not use", "caution", "exclusion"],
  ["escalation", "urgent", "senior review", "specialist review", "red flag"],
  ["adverse effect", "side effect", "toxicity", "safety-net", "warning"],
  ["dose", "dose limit", "maximum dose", "frequency", "route"],
];

function tokens(text: string) {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 2);
}

export function normalizedClinicalSearchTokens(query: string) {
  return tokens(query)
    .filter((token) => token.length > 2 && !textSearchStopWords.has(token))
    .map((token) => (token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token))
    .filter((token) => token.length > 2 && !textSearchStopWords.has(token));
}

export function buildClinicalTextSearchQuery(query: string) {
  const normalizedTokens = normalizedClinicalSearchTokens(query);

  if (/\bactive community patients?\b/i.test(query) && /\bed\b/i.test(query) && normalizedTokens.includes("active")) {
    normalizedTokens.push("pt", "ed");
  } else if (/\bcommunity patients?\b/i.test(query) && normalizedTokens.includes("community")) {
    normalizedTokens.push("pts");
  }

  const uniqueTokens = Array.from(new Set(normalizedTokens)).slice(0, 10);
  return uniqueTokens.length >= 1 ? uniqueTokens.join(" ") : query;
}

export function expandClinicalQuery(query: string) {
  const lowered = query.toLowerCase();
  const additions = new Set<string>();

  for (const group of synonymGroups) {
    if (group.some((term) => lowered.includes(term))) {
      group.forEach((term) => additions.add(term));
    }
  }

  if (additions.size === 0) return query;
  return `${query} ${Array.from(additions).join(" ")}`;
}

export function clinicalRankScore(query: string, result: SearchResult) {
  const queryTokens = tokens(query);
  const haystack =
    `${result.title} ${result.file_name} ${result.section_heading ?? ""} ${result.content}`.toLowerCase();
  const base = result.hybrid_score ?? result.similarity;
  const title = `${result.title} ${result.file_name}`.toLowerCase();
  const exactTitleBoost = queryTokens.some((token) => title.includes(token)) ? 0.08 : 0;
  const safetyQuery = /\b(urgent|red flag|contraindicat|avoid|escalat|toxicity|dose|monitor)\b/i.test(query);
  const safetyContentBoost =
    safetyQuery && /\b(urgent|red flag|contraindicat|avoid|escalat|toxicity|maximum|monitor)\b/i.test(haystack)
      ? 0.08
      : 0;
  const status = result.source_metadata?.document_status;
  const validation = result.source_metadata?.clinical_validation_status;
  const statusBoost = status === "current" ? 0.04 : status === "outdated" ? -0.08 : 0;
  const validationBoost = validation === "approved" ? 0.04 : validation === "locally_reviewed" ? 0.025 : 0;

  return base + exactTitleBoost + safetyContentBoost + statusBoost + validationBoost;
}

export function rankClinicalResults(query: string, results: SearchResult[]) {
  return [...results].sort((a, b) => clinicalRankScore(query, b) - clinicalRankScore(query, a));
}
