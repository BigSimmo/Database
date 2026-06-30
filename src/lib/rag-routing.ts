import { classifyRagQuery } from "@/lib/clinical-search";
import type { ConflictOrGap, RagAnswer, RagQueryClass, SearchResult } from "@/lib/types";

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
const strongClinicalEscalationPattern =
  /\b(compare|compared|versus|vs|conflict|gap|contraindicat\w*|interaction\w*|side effect\w*|adverse|suicid\w*|toxicity|myocarditis|neutropenia|anc|fbc|red range|amber range|urgent|escalat\w*|withhold|cease|stop|discontinue|recommend\w*|decide|decision|pregnan\w*|renal impairment)\b/i;
const comparisonQueryPattern = /\b(compare|compared|versus|vs|between|difference\w*|conflict\w*)\b/i;
const routineCrossDocumentPattern =
  /\b(?:across|combine|combined|synthesi[sz]e|together|overall|all documents|these documents|different documents|multiple documents|several documents|from the documents)\b/i;
const extractiveQuestionPattern =
  /\b(what|when|where|which|who|list|include|includes|required|requirements|process|procedure|steps|monitoring|summary|summarise|summarize|show|tell)\b/i;
const extractiveBlockPattern =
  /\b(compare|compared|versus|vs|conflict|gap|contraindicat\w*|interaction\w*|side effect\w*|adverse|risk\w*|suicid\w*|toxicity|myocarditis|neutropenia|urgent|escalat\w*|withhold|cease|stop|dose|dosing|prescrib\w*|recommend\w*|decide|decision)\b/i;
const broadManagementSynthesisPattern =
  /\b(?:management|manage|managed|treatment|treat|therapy|care|approach|pathway)\s+(?:of|for|in)\b|\bhow\s+(?:is|are|should)\b.{0,80}\b(?:managed|treated)\b/i;
const clinicalPathwaySynthesisPattern = /\b(?:referral criteria|referral pathway|refer\b|pathway|what to do)\b/i;
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
      item.type === "conflict" || /limited-strength|not enough|no indexed|weak support|unsupported/i.test(item.message),
  );
}

function hasConflictIntent(query: string) {
  return /\b(?:conflict|gap|contradict|disagree|inconsisten|versus|vs)\b/i.test(query);
}

function hasExplicitDocumentLookupIntent(query: string) {
  return (
    /\b(?:find|search|lookup|open|show)\b.{0,80}\b(?:document|file|pdf|protocol|guideline|procedure)\b/i.test(query) ||
    /\bnewly uploaded\b/i.test(query)
  );
}

function hasSourceSupportLookupIntent(query: string) {
  return (
    /\b(?:what|which)\s+(?:documents?|sources?|files?|guidelines?)\b.{0,120}\b(?:support|supports|supporting|cover|covers|contain|contains|mention|mentions)\b/i.test(
      query,
    ) || /\b(?:documents?|sources?|files?|guidelines?)\s+(?:supporting|for)\b/i.test(query)
  );
}

function hasQuoteOrSourceLocationIntent(query: string) {
  return /\b(?:quote|quotes|quoted|exact wording|source location|where in|which page|page number|open source|show source|source link|citation|citations)\b/i.test(
    query,
  );
}

function hasExplicitTableOrVisualLookupIntent(query: string) {
  return (
    /\b(?:which|what|show|find|open|where)\b.{0,120}\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b/i.test(
      query,
    ) ||
    /\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b.{0,80}\b(?:cover|covers|contain|contains|list|lists|show|shows|guidance)\b/i.test(
      query,
    )
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

function hasTableOrVisualSourceSupport(results: SearchResult[]) {
  return results.slice(0, 8).some((result) => {
    const reasonText = (result.match_explanation?.reasons ?? []).join(" ");
    const sourceText = [
      result.title,
      result.file_name,
      result.section_heading,
      result.content.slice(0, 300),
      reasonText,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      Boolean(result.table_facts?.length) ||
      Boolean(result.images?.length) ||
      /\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|image|visual|medication_chart)\b/i.test(sourceText)
    );
  });
}

function shouldPreferModelSynthesis(query: string, queryClass: RagQueryClass) {
  return (
    queryClass === "medication_dose_risk" ||
    queryClass === "table_threshold" ||
    queryClass === "comparison" ||
    /\b(?:dose|dosing|monitoring|threshold|risk|compare|comparison|pathway|referral|refer|managed|management|treatment|escalat\w*)\b/i.test(
      query,
    ) ||
    clinicalPathwaySynthesisPattern.test(query)
  );
}

function shouldUseStrongClinicalRoute(args: {
  query: string;
  queryClass: RagQueryClass;
  strongestScore: number;
  topTextRank: number;
  directTitleSupport: boolean;
  actionableConflictOrGap: boolean;
}) {
  if (args.actionableConflictOrGap && !args.directTitleSupport) return true;
  if (strongClinicalEscalationPattern.test(args.query)) return true;
  if (args.strongestScore < strongRetrievalThreshold && !args.directTitleSupport) return true;
  if (args.queryClass === "table_threshold" && args.topTextRank < 0.035 && !args.directTitleSupport) return true;
  return false;
}

export function shouldUseExtractiveAnswer(args: {
  query: string;
  results: SearchResult[];
  queryClass?: RagQueryClass;
  conflictsOrGaps?: ConflictOrGap[];
}) {
  if (args.results.length === 0) return false;
  const directTitleSupport = hasDirectTitleSupport(args.query, args.results);
  const strongestScore = strongestRetrievalScore(args.results);
  const topTextRank = Math.max(...args.results.map((result) => result.text_rank ?? 0));
  const documents = documentCount(args.results);
  const queryClass = args.queryClass ?? classifyRagQuery(args.query).queryClass;

  if (shouldPreferModelSynthesis(args.query, queryClass)) return false;
  if (queryClass === "broad_summary" || broadManagementSynthesisPattern.test(args.query)) return false;
  if (documents > 1 && comparisonQueryPattern.test(args.query)) return false;
  if (queryClass === "comparison") return false;
  if (extractiveBlockPattern.test(args.query) && !directTitleSupport) return false;
  if (!extractiveQuestionPattern.test(args.query) && !directTitleSupport) return false;

  if (hasActionableConflictOrGap(args.conflictsOrGaps) && !directTitleSupport && strongestScore < 0.82) return false;

  if (
    queryClass === "document_lookup" &&
    (hasExplicitDocumentLookupIntent(args.query) ||
      hasSourceSupportLookupIntent(args.query) ||
      hasQuoteOrSourceLocationIntent(args.query)) &&
    (directTitleSupport || strongestScore >= 0.72)
  ) {
    return true;
  }

  if (hasSourceSupportLookupIntent(args.query) || hasQuoteOrSourceLocationIntent(args.query)) {
    return directTitleSupport || strongestScore >= 0.4 || topTextRank >= 0.04;
  }

  if (
    hasExplicitTableOrVisualLookupIntent(args.query) &&
    hasTableOrVisualSourceSupport(args.results) &&
    (directTitleSupport || strongestScore >= extractiveRetrievalThreshold || topTextRank >= 0.08)
  ) {
    return true;
  }

  return false;
}

export function chooseAnswerRoute(args: {
  query: string;
  results: SearchResult[];
  queryClass?: RagQueryClass;
  conflictsOrGaps?: ConflictOrGap[];
  fastModel: string;
  strongModel: string;
}): AnswerRoute {
  const strongestScore = strongestRetrievalScore(args.results);
  const documents = documentCount(args.results);
  const directTitleSupport = hasDirectTitleSupport(args.query, args.results);
  const queryClass = args.queryClass ?? classifyRagQuery(args.query).queryClass;
  const topTextRank = Math.max(0, ...args.results.map((result) => result.text_rank ?? 0));

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

  if (
    queryClass === "document_lookup" &&
    hasExplicitDocumentLookupIntent(args.query) &&
    !directTitleSupport &&
    topTextRank < 0.08
  ) {
    return {
      mode: "unsupported",
      model: null,
      reason: "document_lookup_without_title_support",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    (queryClass === "medication_dose_risk" || queryClass === "table_threshold") &&
    strongestScore < 0.46 &&
    topTextRank < 0.02 &&
    !directTitleSupport
  ) {
    return {
      mode: "unsupported",
      model: null,
      reason: "weak_complex_query_support",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    queryClass === "unsupported_or_general" &&
    isComplexClinicalQuery(args.query) &&
    strongestScore < 0.46 &&
    topTextRank < 0.02 &&
    !directTitleSupport
  ) {
    return {
      mode: "unsupported",
      model: null,
      reason: "weak_complex_query_support",
      strongestScore,
      documentCount: documents,
    };
  }

  const crossDocumentIntent = routineCrossDocumentPattern.test(args.query) || queryClass === "broad_summary";
  const actionableConflictOrGap = hasActionableConflictOrGap(args.conflictsOrGaps);

  if (
    hasSourceSupportLookupIntent(args.query) &&
    (directTitleSupport || strongestScore >= 0.4 || topTextRank >= 0.04)
  ) {
    return {
      mode: "extractive",
      model: null,
      reason: "source_support_document_lookup",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    hasExplicitTableOrVisualLookupIntent(args.query) &&
    hasTableOrVisualSourceSupport(args.results) &&
    (directTitleSupport || strongestScore >= extractiveRetrievalThreshold || topTextRank >= 0.08)
  ) {
    return {
      mode: "extractive",
      model: null,
      reason: "explicit_table_or_source_lookup",
      strongestScore,
      documentCount: documents,
    };
  }

  if (queryClass === "broad_summary" && broadManagementSynthesisPattern.test(args.query)) {
    return {
      mode: "strong",
      model: args.strongModel,
      reason: "broad_clinical_management_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    documents > 1 &&
    crossDocumentIntent &&
    strongestScore >= strongRetrievalThreshold &&
    !hasConflictIntent(args.query) &&
    !actionableConflictOrGap
  ) {
    return {
      mode: "fast",
      model: args.fastModel,
      reason: "balanced_multi_document_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    queryClass === "comparison" ||
    (documents > 1 && comparisonQueryPattern.test(args.query) && !directTitleSupport)
  ) {
    return {
      mode: "strong",
      model: args.strongModel,
      reason: "multi_document_comparison_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (queryClass === "medication_dose_risk" || queryClass === "table_threshold") {
    if (
      shouldUseStrongClinicalRoute({
        query: args.query,
        queryClass,
        strongestScore,
        topTextRank,
        directTitleSupport,
        actionableConflictOrGap,
      })
    ) {
      return {
        mode: "strong",
        model: args.strongModel,
        reason:
          actionableConflictOrGap && !directTitleSupport
            ? "retrieval_gap_or_conflict"
            : "clinical_risk_or_complex_query",
        strongestScore,
        documentCount: documents,
      };
    }

    return {
      mode: "fast",
      model: args.fastModel,
      reason: "clinical_fast_grounded_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (clinicalPathwaySynthesisPattern.test(args.query) && queryClass !== "document_lookup") {
    if (
      shouldUseStrongClinicalRoute({
        query: args.query,
        queryClass,
        strongestScore,
        topTextRank,
        directTitleSupport,
        actionableConflictOrGap,
      })
    ) {
      return {
        mode: "strong",
        model: args.strongModel,
        reason:
          actionableConflictOrGap && !directTitleSupport
            ? "retrieval_gap_or_conflict"
            : "clinical_risk_or_complex_query",
        strongestScore,
        documentCount: documents,
      };
    }

    return {
      mode: "fast",
      model: args.fastModel,
      reason: "clinical_fast_grounded_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    shouldUseExtractiveAnswer({
      query: args.query,
      results: args.results,
      queryClass,
      conflictsOrGaps: args.conflictsOrGaps,
    })
  ) {
    return {
      mode: "extractive",
      model: null,
      reason: "high_confidence_extractive_retrieval",
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

  if (actionableConflictOrGap && !directTitleSupport) {
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
  answer: Pick<RagAnswer, "grounded" | "confidence" | "citations" | "routingReason">;
  results: SearchResult[];
}) {
  if (args.route.mode !== "fast") return false;
  if (args.answer.grounded && args.answer.confidence !== "unsupported" && args.answer.citations.length > 0) {
    return false;
  }

  const solidSourceSupport =
    strongestRetrievalScore(args.results) >= strongRetrievalThreshold && args.results.length > 0;
  if (args.answer.routingReason === "structured_parse_fallback") return solidSourceSupport;
  if (args.route.reason === "clinical_fast_grounded_synthesis") return solidSourceSupport;
  return solidSourceSupport && args.results.length >= 2;
}
