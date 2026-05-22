import type { SearchResult } from "@/lib/types";

const synonymGroups = [
  ["monitor", "monitoring", "baseline", "review", "follow-up", "blood test", "level"],
  ["contraindication", "avoid", "do not use", "caution", "exclusion"],
  ["escalation", "urgent", "senior review", "specialist review", "red flag"],
  ["adverse effect", "side effect", "toxicity", "safety-net", "warning"],
  ["dose", "dose limit", "maximum dose", "frequency", "route"],
];

function tokens(text: string) {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 2);
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
