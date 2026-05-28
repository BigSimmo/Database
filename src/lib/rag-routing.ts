import type { ConflictOrGap, RagAnswer, SearchResult } from "@/lib/types";

export type AnswerRouteMode = "unsupported" | "extractive" | "fast" | "strong";

export type AnswerRoute = {
  mode: AnswerRouteMode;
  model: string | null;
  reason: string;
  strongestScore: number;
  documentCount: number;
};

const unsupportedSimilarityThreshold = 0.32;
const strongRetrievalThreshold = 0.64;
const extractiveRetrievalThreshold = 0.76;
const complexClinicalQueryPattern =
  /\b(compare|compared|versus|vs|conflict|gap|contraindicat\w*|interaction\w*|side effect\w*|adverse|suicid\w*|toxicity|myocarditis|neutropenia|anc|fbc|urgent|escalat\w*|withhold|cease|stop|dose|dosing|prescrib\w*)\b/i;
const comparisonQueryPattern = /\b(compare|compared|versus|vs|between|across|difference\w*|conflict\w*)\b/i;
const extractiveQuestionPattern =
  /\b(what|when|where|which|who|list|include|includes|required|requirements|process|procedure|steps|monitoring|summary|summarise|summarize|show|tell)\b/i;
const extractiveBlockPattern =
  /\b(compare|compared|versus|vs|conflict|gap|contraindicat\w*|interaction\w*|side effect\w*|adverse|risk\w*|suicid\w*|toxicity|myocarditis|neutropenia|urgent|escalat\w*|withhold|cease|stop|dose|dosing|prescrib\w*|recommend\w*|decide|decision)\b/i;
const queryStopWords = new Set([
  "what",
  "when",
  "where",
  "which",
  "should",
  "does",
  "include",
  "require",
  "requires",
  "required",
  "requirement",
  "requirements",
  "procedure",
  "process",
  "document",
  "managed",
  "management",
  "guideline",
]);

export function strongestRetrievalScore(results: SearchResult[]) {
  return results.reduce((max, result) => Math.max(max, result.hybrid_score ?? result.similarity), 0);
}

function documentCount(results: SearchResult[]) {
  return new Set(results.map((result) => result.document_id)).size;
}

function hasTextSupport(results: SearchResult[]) {
  return results.some((result) => (result.text_rank ?? 0) > 0.05 || (result.hybrid_score ?? 0) >= 0.32);
}

function hasActionableConflictOrGap(conflictsOrGaps: ConflictOrGap[] = []) {
  return conflictsOrGaps.some(
    (item) =>
      item.type === "conflict" ||
      /limited-strength|not enough|no indexed|weak support|unsupported/i.test(item.message),
  );
}

function normalizeLookupText(text: string) {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function queryTopicTokens(query: string) {
  return normalizeLookupText(query)
    .split(/\s+/)
    .map((token) => token.replace(/s$/, ""))
    .filter((token) => token.length > 2 && !queryStopWords.has(token));
}

export function hasDirectTitleSupport(query: string, results: SearchResult[]) {
  const tokens = queryTopicTokens(query);
  if (tokens.length === 0) return false;

  return results.slice(0, 4).some((result) => {
    const title = normalizeLookupText(`${result.title} ${result.file_name}`).replace(/s\b/g, "");
    return tokens.some((token) => title.includes(token));
  });
}

export function isComplexClinicalQuery(query: string) {
  return complexClinicalQueryPattern.test(query);
}

export function shouldUseExtractiveAnswer(args: {
  query: string;
  results: SearchResult[];
  conflictsOrGaps?: ConflictOrGap[];
}) {
  if (args.results.length === 0) return false;
  const directTitleSupport = hasDirectTitleSupport(args.query, args.results);
  const strongestScore = strongestRetrievalScore(args.results);
  const topTextRank = Math.max(...args.results.map((result) => result.text_rank ?? 0));
  const documents = documentCount(args.results);

  if (documents > 1 && comparisonQueryPattern.test(args.query)) return false;
  if (extractiveBlockPattern.test(args.query) && !directTitleSupport) return false;
  if (!extractiveQuestionPattern.test(args.query) && !directTitleSupport) return false;

  if (hasActionableConflictOrGap(args.conflictsOrGaps) && !directTitleSupport && strongestScore < 0.82) return false;

  return strongestScore >= extractiveRetrievalThreshold || topTextRank >= 0.12 || (directTitleSupport && strongestScore >= 0.4);
}

export function chooseAnswerRoute(args: {
  query: string;
  results: SearchResult[];
  conflictsOrGaps?: ConflictOrGap[];
  fastModel: string;
  strongModel: string;
}): AnswerRoute {
  const strongestScore = strongestRetrievalScore(args.results);
  const documents = documentCount(args.results);
  const directTitleSupport = hasDirectTitleSupport(args.query, args.results);

  if (args.results.length === 0) {
    return {
      mode: "unsupported",
      model: null,
      reason: "no_retrieved_sources",
      strongestScore,
      documentCount: documents,
    };
  }

  if (strongestScore < unsupportedSimilarityThreshold && !hasTextSupport(args.results) && !directTitleSupport) {
    return {
      mode: "unsupported",
      model: null,
      reason: "no_plausible_source_support",
      strongestScore,
      documentCount: documents,
    };
  }

  if (shouldUseExtractiveAnswer(args)) {
    return {
      mode: "extractive",
      model: null,
      reason: "strong_source_match_extract",
      strongestScore,
      documentCount: documents,
    };
  }

  if (isComplexClinicalQuery(args.query)) {
    return {
      mode: "strong",
      model: args.strongModel,
      reason: "clinical_risk_or_complex_query",
      strongestScore,
      documentCount: documents,
    };
  }

  if (strongestScore < strongRetrievalThreshold && !directTitleSupport) {
    return {
      mode: "strong",
      model: args.strongModel,
      reason: "limited_retrieval_strength",
      strongestScore,
      documentCount: documents,
    };
  }

  if (documents > 3 && comparisonQueryPattern.test(args.query) && !directTitleSupport) {
    return {
      mode: "strong",
      model: args.strongModel,
      reason: "multi_document_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (hasActionableConflictOrGap(args.conflictsOrGaps) && !directTitleSupport) {
    return {
      mode: "strong",
      model: args.strongModel,
      reason: "retrieval_gap_or_conflict",
      strongestScore,
      documentCount: documents,
    };
  }

  return {
    mode: "fast",
    model: args.fastModel,
    reason: "strong_routine_retrieval",
    strongestScore,
    documentCount: documents,
  };
}

export function shouldRetryWithStrongAfterFast(args: {
  route: AnswerRoute;
  answer: Pick<RagAnswer, "grounded" | "confidence" | "citations">;
  results: SearchResult[];
}) {
  if (args.route.mode !== "fast") return false;
  if (args.answer.grounded && args.answer.confidence !== "unsupported" && args.answer.citations.length > 0) {
    return false;
  }

  return strongestRetrievalScore(args.results) >= strongRetrievalThreshold && args.results.length >= 2;
}
