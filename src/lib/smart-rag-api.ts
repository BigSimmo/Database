import { citationFromResult, documentCitationHref, formatCompactCitationLabel } from "@/lib/citations";
import { sourceStrengthForSimilarity } from "@/lib/evidence";
import { sourceTextForDisplay } from "@/lib/source-text-sanitizer";
import type { RagAnswer, RagQueryClass, SearchResult, SmartRagApiPlan, SmartRagSourceLink } from "@/lib/types";

type RetrievalStrategy = SmartRagApiPlan["retrievalStrategy"];

type BuildSmartRagApiPlanArgs = {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  routeMode?: RagAnswer["routingMode"];
  routeReason?: string;
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
  const normalized = sourceTextForDisplay(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3).trim()}...`;
}

function uniqueDocumentCount(results: SearchResult[]) {
  return new Set(results.map((result) => result.document_id)).size;
}

function resultScore(result: SearchResult) {
  return result.hybrid_score ?? result.similarity ?? 0;
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
  if (args.queryClass === "document_lookup") return "document_lookup";
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

  return {
    query: args.query,
    queryClass: args.queryClass,
    intent: queryClassIntent[args.queryClass],
    responseMode: mode,
    retrievalStrategy,
    latencyPlan: latencyPlan(mode, retrievalStrategy),
    answerFocus: answerFocus({
      queryClass: args.queryClass,
      mode,
      documentCount,
      linkCount: coreSourceLinks.length,
    }),
    sourceLinkCount: coreSourceLinks.length,
    coreSourceLinks,
    streamPlan: streamPlan(mode, retrievalStrategy),
  };
}
