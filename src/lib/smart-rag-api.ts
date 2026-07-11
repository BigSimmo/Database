import { citationFromResult, documentCitationHref, formatCompactCitationLabel } from "@/lib/citations";
import { sourceStrengthForSimilarity } from "@/lib/evidence";
import { buildRetrievalIntent, summarizeRetrievalSelection } from "@/lib/retrieval-selection";
import { normalizeInlineBulletGlyphs, sourceTextForDisplay } from "@/lib/source-text-sanitizer";
import type {
  AnswerResponseMode,
  ConflictOrGap,
  RagAnswer,
  RagQueryClass,
  RetrievalSelectionSummary,
  SearchResult,
  SmartRagApiPlan,
  SmartRagSourceLink,
} from "@/lib/types";

type RetrievalStrategy = SmartRagApiPlan["retrievalStrategy"];
type SmartRagAnswerPlan = SmartRagApiPlan["answerPlan"];

type BuildSmartRagApiPlanArgs = {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  routeMode?: RagAnswer["routingMode"];
  routeReason?: string;
  conflictsOrGaps?: ConflictOrGap[];
  retrievalStrategy?: RetrievalStrategy;
  maxLinks?: number;
  preferredResponseMode?: SmartRagApiPlan["responseMode"];
};

const crossDocumentPattern =
  /\b(?:across|combine|combined|synthesi[sz]e|together|overall|all documents|these documents|different documents|multiple documents|compare|versus|vs|between)\b/i;

const queryClassIntent: Record<RagQueryClass, SmartRagApiPlan["intent"]> = {
  document_lookup: "find_document",
  table_threshold: "find_threshold_or_table",
  medication_dose_risk: "medication_or_risk_answer",
  comparison: "compare_sources",
  broad_summary: "summarize_sources",
  unsupported_or_general: "general_or_unsupported",
};

function compact(value: string, limit: number) {
  const normalized = normalizeInlineBulletGlyphs(sourceTextForDisplay(value)).replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3).trim()}...`;
}

function uniqueDocumentCount(results: SearchResult[]) {
  return new Set(results.map((result) => result.document_id)).size;
}

function resultScore(result: SearchResult) {
  return result.hybrid_score ?? result.similarity ?? 0;
}

function strongestResultScore(results: SearchResult[]) {
  return results.reduce((max, result) => Math.max(max, resultScore(result)), 0);
}

function retrievalQuality(
  results: SearchResult[],
  conflictsOrGaps: ConflictOrGap[] = [],
  selection?: RetrievalSelectionSummary,
): SmartRagAnswerPlan["retrievalQuality"] {
  if (conflictsOrGaps.some((item) => item.type === "conflict")) return "conflicting";
  if (results.length === 0) return "weak";
  if (selection && !selection.requiredSignalsSatisfied) {
    return selection.matchedSignals.length ? "partial" : "weak";
  }
  const strongestScore = strongestResultScore(results);
  if (selection?.requiredSignalsSatisfied && selection.matchedSignals.length >= 2 && strongestScore >= 0.5)
    return "strong";
  if (strongestScore >= 0.76) return "strong";
  if (strongestScore >= 0.5) return "partial";
  return "weak";
}

function routeModeFromPlanMode(
  mode: SmartRagApiPlan["responseMode"],
  routeMode?: RagAnswer["routingMode"],
): SmartRagAnswerPlan["routeMode"] {
  if (routeMode) return routeMode;
  if (mode === "unsupported") return "unsupported";
  if (mode === "strong_synthesis") return "strong";
  if (mode === "extractive_answer" || mode === "document_lookup") return "extractive";
  return "fast";
}

function linkReason(result: SearchResult, queryClass: RagQueryClass) {
  if (queryClass === "document_lookup") return "Best document/title match";
  if (queryClass === "table_threshold") return "Relevant table, threshold, or monitoring evidence";
  if (queryClass === "medication_dose_risk") return "Medication, dose, monitoring, or risk evidence";
  if (queryClass === "comparison") return "Comparison source";
  if (queryClass === "broad_summary") return "Summary source";
  if (result.memory_cards?.length) return "Structured source memory match";
  return "Relevant indexed source";
}

function buildCoreSourceLinks(
  results: SearchResult[],
  queryClass: RagQueryClass,
  maxLinks: number,
): SmartRagSourceLink[] {
  const seen = new Set<string>();
  const links: SmartRagSourceLink[] = [];
  const ranked = [...results].sort((a, b) => resultScore(b) - resultScore(a) || a.chunk_index - b.chunk_index);

  for (const result of ranked) {
    const citation = citationFromResult(result);
    const key = `${citation.document_id}:${citation.page_number}:${citation.chunk_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    links.push({
      id: key,
      label: formatCompactCitationLabel(citation),
      href: documentCitationHref(citation),
      document_id: citation.document_id,
      chunk_id: citation.chunk_id,
      title: citation.title,
      file_name: citation.file_name,
      page_number: citation.page_number,
      source_strength: result.source_strength ?? sourceStrengthForSimilarity(result.similarity),
      reason: linkReason(result, queryClass),
      snippet: compact(`${result.section_heading ? `${result.section_heading}: ` : ""}${result.content}`, 220),
    });

    if (links.length >= maxLinks) break;
  }

  return links;
}

function responseMode(
  args: Pick<BuildSmartRagApiPlanArgs, "query" | "queryClass" | "results" | "routeMode" | "preferredResponseMode">,
) {
  if (args.results.length === 0 || args.routeMode === "unsupported") return "unsupported";
  if (args.preferredResponseMode) return args.preferredResponseMode;
  if (args.queryClass === "document_lookup" && args.routeMode === "extractive") return "document_lookup";
  if (args.routeMode === "extractive") return "extractive_answer";
  if (args.routeMode === "strong") return "strong_synthesis";
  if (
    args.queryClass === "comparison" ||
    (uniqueDocumentCount(args.results) > 1 &&
      (args.queryClass === "broad_summary" || crossDocumentPattern.test(args.query)))
  ) {
    return "multi_document_synthesis";
  }
  return "fast_grounded_answer";
}

function latencyPlan(
  mode: SmartRagApiPlan["responseMode"],
  retrievalStrategy: SmartRagApiPlan["retrievalStrategy"],
): SmartRagApiPlan["latencyPlan"] {
  if (mode === "unsupported") return "no_supported_answer";
  if (mode === "strong_synthesis") return "strong_generation";
  if (
    retrievalStrategy === "search_cache" ||
    retrievalStrategy === "text_fast_path" ||
    retrievalStrategy === "document_lookup_fast_path"
  ) {
    return "cache_or_text_first";
  }
  return "balanced_hybrid";
}

function displayMode(args: {
  mode: SmartRagApiPlan["responseMode"];
  queryClass: RagQueryClass;
  routeMode?: RagAnswer["routingMode"];
}): AnswerResponseMode {
  if (args.mode === "unsupported") return "evidence_gap";
  if (args.mode === "document_lookup") return "document_lookup";
  if (args.queryClass === "comparison" || args.mode === "multi_document_synthesis") return "comparison_matrix";
  if (args.queryClass === "table_threshold") return "threshold_table";
  if (args.queryClass === "medication_dose_risk") return "clinical_pathway";
  if (args.routeMode === "extractive") return "checklist";
  return "checklist";
}

function answerFocus(args: {
  queryClass: RagQueryClass;
  mode: SmartRagApiPlan["responseMode"];
  documentCount: number;
  linkCount: number;
}) {
  if (args.mode === "unsupported" || args.linkCount === 0)
    return "Report that the indexed sources do not support a reliable answer.";
  if (args.mode === "document_lookup")
    return "Open with the best matching document and page, then show the strongest source link.";
  if (args.mode === "multi_document_synthesis") {
    return `Merge overlapping guidance across ${args.documentCount} documents, cite the strongest links, and call out conflicts or gaps only when supported.`;
  }
  if (args.queryClass === "table_threshold")
    return "Lead with the exact threshold, table row, or monitoring rule and cite the source section.";
  if (args.queryClass === "medication_dose_risk")
    return "Lead with medication, dose, monitoring, escalation, and risk details that directly answer the question.";
  if (args.queryClass === "broad_summary")
    return "Give a concise source-backed summary and avoid tangential background.";
  return "Answer directly using the highest-ranked source links.";
}

function answerPlanIntent(args: {
  mode: SmartRagApiPlan["responseMode"];
  routeMode: SmartRagAnswerPlan["routeMode"];
}): SmartRagAnswerPlan["intent"] {
  if (args.routeMode === "unsupported" || args.mode === "unsupported") return "unsupported";
  if (args.mode === "document_lookup") return "document_lookup";
  if (args.routeMode === "extractive") return "source_lookup";
  return "clinical_synthesis";
}

function modelStrategy(routeMode: SmartRagAnswerPlan["routeMode"]): SmartRagAnswerPlan["modelStrategy"] {
  if (routeMode === "unsupported") return "source_gap";
  if (routeMode === "extractive") return "extractive_lookup";
  if (routeMode === "strong") return "strong_model_then_quality_gate";
  return "fast_model_then_quality_gate";
}

function qualityCriteria(args: { queryClass: RagQueryClass; mode: SmartRagApiPlan["responseMode"] }): string[] {
  const criteria = [
    "first_sentence_answers_query",
    "natural_clinical_synthesis",
    "no_source_headings_or_fragments",
    "citations_match_retrieved_chunks",
    "no_unsupported_numbers_or_doses",
    "query_intent_covered",
  ];
  if (args.mode === "document_lookup" || args.mode === "extractive_answer") {
    return ["return_source_identity_or_location", "do_not_generate_clinical_advice", "preserve_exact_source_links"];
  }
  if (args.queryClass === "medication_dose_risk" || args.queryClass === "table_threshold") {
    criteria.push("no_cross_medication_leakage");
  }
  if (args.queryClass === "comparison" || args.mode === "multi_document_synthesis") {
    criteria.push("conflicts_or_gaps_handled_when_supported");
  }
  if (args.mode === "unsupported") {
    return ["no_answer_without_source_support", "nearby_sources_are_not_promoted_to_answer"];
  }
  return criteria;
}

function fallbackBehavior(routeMode: SmartRagAnswerPlan["routeMode"]): SmartRagAnswerPlan["fallbackBehavior"] {
  if (routeMode === "unsupported") return "source_gap";
  if (routeMode === "extractive") return "extractive_lookup_only";
  return "retry_strong_then_source_gap";
}

function sourcePolicy(args: {
  intent: SmartRagAnswerPlan["intent"];
  results: SearchResult[];
}): SmartRagAnswerPlan["sourcePolicy"] {
  if (args.intent === "unsupported") return args.results.length ? "nearby_sources_allowed" : "required_citations";
  if (args.intent === "source_lookup" || args.intent === "document_lookup") return "exact_source_links";
  return "required_citations";
}

function answerPlan(args: {
  queryClass: RagQueryClass;
  mode: SmartRagApiPlan["responseMode"];
  routeMode?: RagAnswer["routingMode"];
  query: string;
  results: SearchResult[];
  conflictsOrGaps?: ConflictOrGap[];
}): SmartRagAnswerPlan {
  const plannedRouteMode = routeModeFromPlanMode(args.mode, args.routeMode);
  const intent = answerPlanIntent({ mode: args.mode, routeMode: plannedRouteMode });
  const retrievalIntent = buildRetrievalIntent(args.query, args.queryClass);
  const sourceSelection = summarizeRetrievalSelection({
    query: args.query,
    queryClass: args.queryClass,
    results: args.results,
  }).summary;
  return {
    intent,
    queryClass: args.queryClass,
    routeMode: plannedRouteMode,
    modelStrategy: modelStrategy(plannedRouteMode),
    retrievalQuality: retrievalQuality(args.results, args.conflictsOrGaps, sourceSelection),
    retrievalIntent,
    sourceSelection,
    qualityCriteria: qualityCriteria({ queryClass: args.queryClass, mode: args.mode }),
    fallbackBehavior: fallbackBehavior(plannedRouteMode),
    sourcePolicy: sourcePolicy({ intent, results: args.results }),
  };
}

function streamPlan(mode: SmartRagApiPlan["responseMode"], retrievalStrategy: SmartRagApiPlan["retrievalStrategy"]) {
  if (mode === "unsupported")
    return ["Search indexed sources", "Report unsupported evidence", "Show nearby source links if available"];
  if (mode === "document_lookup") return ["Match document metadata", "Rank matching pages", "Return document links"];
  if (mode === "multi_document_synthesis") {
    return [
      "Classify query intent",
      "Balance sources across documents",
      "Fuse strongest points",
      "Generate cited answer",
    ];
  }
  if (retrievalStrategy === "text_fast_path" || retrievalStrategy === "search_cache") {
    return ["Use fast retrieval", "Rank source evidence", "Return cited answer"];
  }
  return ["Run hybrid retrieval", "Rank source evidence", "Generate cited answer"];
}

export function buildSmartRagApiPlan(args: BuildSmartRagApiPlanArgs): SmartRagApiPlan {
  const retrievalStrategy = args.retrievalStrategy ?? "unknown";
  const mode = responseMode(args);
  const coreSourceLinks = buildCoreSourceLinks(args.results, args.queryClass, args.maxLinks ?? 5);
  const documentCount = uniqueDocumentCount(args.results);
  const planDisplayMode = displayMode({ mode, queryClass: args.queryClass, routeMode: args.routeMode });

  return {
    query: args.query,
    queryClass: args.queryClass,
    intent: queryClassIntent[args.queryClass],
    responseMode: mode,
    retrievalStrategy,
    latencyPlan: latencyPlan(mode, retrievalStrategy),
    displayMode: planDisplayMode,
    answerFocus: answerFocus({
      queryClass: args.queryClass,
      mode,
      documentCount,
      linkCount: coreSourceLinks.length,
    }),
    answerPlan: answerPlan({
      queryClass: args.queryClass,
      mode,
      routeMode: args.routeMode,
      query: args.query,
      results: args.results,
      conflictsOrGaps: args.conflictsOrGaps,
    }),
    sourceLinkCount: coreSourceLinks.length,
    coreSourceLinks,
    streamPlan: streamPlan(mode, retrievalStrategy),
  };
}
