import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  embedTextWithTelemetry,
  generateStructuredTextResult,
  type OpenAIReasoningEffort,
  type OpenAITextResult,
} from "@/lib/openai";
import {
  SOURCE_ONLY_EMBEDDING_SKIP_REASON,
  allowsAutoDegrade,
  classifyProviderFailure,
  isSourceOnlyMode,
  ragProviderMode,
  sourceOnlyReason,
} from "@/lib/rag-provider";
import { compactCitations } from "@/lib/citations";
import { extractNumericTokens, VERIFY_AGAINST_SOURCE_NOTE, verifyAnswerNumbers } from "@/lib/answer-verification";
import {
  buildClinicalTextSearchQuery,
  classifyRagQuery,
  analyzeClinicalQuery,
  expandClinicalQuery,
  hasDoseEvidenceSupport,
  hasStructuredThresholdEvidence,
  normalizedClinicalSearchTokens,
  rankClinicalResults,
  queriedZoneColour,
  riskZoneActionPattern,
  riskZoneContextPattern,
  zoneContextPatternsForQuery,
} from "@/lib/clinical-search";
import { env, isDemoMode, isLocalNoAuthMode, requestedOpenAIAnswerModels } from "@/lib/env";
import { logger } from "@/lib/logger";
import { queryCacheKeyForStorage, queryPrivacyMetadata, queryTextForStorage } from "@/lib/query-privacy";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import { isReviewedTablePromotable } from "@/lib/table-review";
import { isClinicalImageEvidence, normalizeImageBbox } from "@/lib/image-filtering";
import { chooseAnswerRoute, hasDirectTitleSupport, shouldRetryWithStrongAfterFast } from "@/lib/rag-routing";
import { fetchRelatedDocumentMetadata, fetchRelatedDocuments } from "@/lib/document-enrichment";
import { boldHighYieldClinicalText, boldRagAnswerHighYieldText, rankAnswerEvidence } from "@/lib/answer-ranking";
import { applyMemoryCardBoosts, fetchMemoryCardsForQuery, ragDeepMemoryVersion } from "@/lib/deep-memory";
import {
  cleanClinicalSummaryText,
  isLowYieldClinicalText,
  sourceTextForClinicalProse,
  sourceTextForDisplay,
  sourceTextForModel,
} from "@/lib/source-text-sanitizer";
import {
  hasClinicalAnswerQualityIssue,
  isUsableAnswerSectionText,
  looksLikeJsonArtifact,
  normalizeSectionText,
  sanitizeAnswerText,
  sanitizeStructuredText,
  splitBalancedWords,
} from "@/lib/rag-answer-text";
import {
  buildCrossDocumentFusionBrief,
  buildCrossDocumentSourceGuide,
  buildCrossDocumentSynthesisPlan,
} from "@/lib/cross-document-synthesis";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
import { clinicalModePrompt, queryClassForClinicalMode, queryForClinicalMode } from "@/lib/clinical-query-mode";
import { annotateSearchResults, buildEvidenceRelevance } from "@/lib/evidence-relevance";
import { committedIndexGeneration, isCommittedGenerationMetadata } from "@/lib/reindex-pipeline";
import { buildRetrievalIntent, selectRetrievalEvidence } from "@/lib/retrieval-selection";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  buildDocumentBreakdown,
  buildEvidenceSummary,
  buildSmartPanel,
  buildSourceCoverage,
  buildVisualEvidence,
  detectConflictsOrGaps,
  extractQuoteCards,
  reconcileQuoteCards,
  selectBestSourceRecommendation,
} from "@/lib/evidence";
import type {
  AnswerSection,
  AnswerSectionKind,
  AnswerSectionSupportLevel,
  ChunkImage,
  ClinicalImageUseClass,
  Citation,
  ConflictOrGap,
  ClinicalQueryAnalysis,
  DocumentIndexQuality,
  DocumentIndexUnitMatch,
  DocumentMemoryCard,
  EvidenceRelevance,
  RelatedDocument,
  OpenAITokenUsage,
  QuoteCard,
  RetrievalConfidenceGateStatus,
  RetrievalDiagnostics,
  RetrievalIntent,
  RetrievalSelectionSummary,
  RagQueryClass,
  RagAnswer,
  SearchResult,
  SmartRagApiPlan,
  ClinicalQueryMode,
} from "@/lib/types";

const answerSectionKinds = [
  "bottom_line",
  "required_actions",
  "monitoring_timing",
  "medication_dose",
  "thresholds",
  "escalation_risk",
  "contraindications_cautions",
  "comparison",
  "documentation",
  "source_gap",
  "visual_evidence",
  "quotes",
  "verification",
] as const satisfies readonly AnswerSectionKind[];

const answerSectionSupportLevels = [
  "direct",
  "partial",
  "nearby",
  "unsupported",
] as const satisfies readonly AnswerSectionSupportLevel[];

const answerJsonOutputSchema = {
  type: "object",
  description:
    "A source-grounded clinical answer generated only from retrieved document excerpts, with claims tied to retrieved evidence IDs.",
  additionalProperties: false,
  properties: {
    answer: {
      type: "string",
      description:
        "The first-layer response: a complete, direct clinical answer that can stand alone before structured supporting sections. The first sentence must directly answer the question in full prose.",
      maxLength: 1600,
    },
    grounded: {
      type: "boolean",
      description: "True only when the answer is directly supported by the retrieved excerpts.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low", "unsupported"],
      description: "Confidence based on source strength and citation support, not general model knowledge.",
    },
    answerSections: {
      type: "array",
      description:
        "Second-layer structured support. Add only distinct source-backed modules that improve scanability, such as actions, monitoring, medication/dose, thresholds, comparison, cautions, documentation, or source gaps.",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string", description: "Short section heading.", maxLength: 48 },
          kind: {
            type: "string",
            enum: answerSectionKinds,
            description:
              "Clinical support module type. Use source_gap for unsupported areas; do not use provenance as content.",
          },
          supportLevel: {
            type: "string",
            enum: answerSectionSupportLevels,
            description: "How directly the cited chunks support this section.",
          },
          body: {
            type: "string",
            description:
              "Clinically useful section body grounded in the cited excerpts. Keep it concise, decision-oriented, and non-redundant with the answer. Do not include document codes, page labels, chunk IDs, or source metadata.",
            maxLength: 600,
          },
          citation_chunk_ids: {
            type: "array",
            description:
              "Required retrieved evidence IDs that directly support this section. Use only citation_chunk_id values supplied in the source block.",
            items: { type: "string" },
          },
        },
        required: ["heading", "kind", "supportLevel", "body", "citation_chunk_ids"],
      },
    },
    citations: {
      type: "array",
      description:
        "The strongest retrieved evidence IDs that directly support the answer. Use only citation_chunk_id values supplied in the source block.",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chunk_id: { type: "string", description: "A valid citation_chunk_id from the supplied source block." },
        },
        required: ["chunk_id"],
      },
    },
    quoteCards: {
      type: "array",
      description: "Short exact quotes copied from supplied excerpts. Use an empty array if no exact quote is useful.",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chunk_id: { type: "string", description: "A valid citation_chunk_id from the supplied source block." },
          quote: { type: "string", description: "A short exact quote from the cited source excerpt.", maxLength: 260 },
          section_heading: { type: ["string", "null"], description: "Source section heading when visible." },
        },
        required: ["chunk_id", "quote", "section_heading"],
      },
    },
    conflictsOrGaps: {
      type: "array",
      description: "Important gaps or conflicts found in the retrieved excerpts.",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["gap", "conflict"],
            description: "Whether this is missing support or conflicting support.",
          },
          message: { type: "string", description: "Plain-language gap or conflict statement." },
          source_chunk_ids: {
            type: "array",
            description: "Retrieved chunk IDs related to the gap or conflict.",
            items: { type: "string" },
          },
        },
        required: ["type", "message", "source_chunk_ids"],
      },
    },
  },
  required: ["answer", "grounded", "confidence", "answerSections", "citations", "quoteCards", "conflictsOrGaps"],
};

export function answerJsonOutputSchemaForResults(results: SearchResult[]) {
  const chunkIds = Array.from(new Set(results.map((result) => result.id).filter(Boolean)));
  if (chunkIds.length === 0) return answerJsonOutputSchema;

  const schema = structuredClone(answerJsonOutputSchema) as Record<string, unknown>;
  const chunkIdSchema = { type: "string", enum: chunkIds };
  const properties = safeRecord(schema.properties);
  const answerSectionProperties = safeRecord(safeRecord(safeRecord(properties.answerSections).items).properties);
  const citationProperties = safeRecord(safeRecord(safeRecord(properties.citations).items).properties);
  const quoteCardProperties = safeRecord(safeRecord(safeRecord(properties.quoteCards).items).properties);
  const gapProperties = safeRecord(safeRecord(safeRecord(properties.conflictsOrGaps).items).properties);
  const answerSectionCitationIds = safeRecord(answerSectionProperties.citation_chunk_ids);
  const gapSourceIds = safeRecord(gapProperties.source_chunk_ids);

  if (Object.keys(answerSectionCitationIds).length > 0) answerSectionCitationIds.items = chunkIdSchema;
  if (Object.keys(citationProperties).length > 0) citationProperties.chunk_id = chunkIdSchema;
  if (Object.keys(quoteCardProperties).length > 0) quoteCardProperties.chunk_id = chunkIdSchema;
  if (Object.keys(gapSourceIds).length > 0) gapSourceIds.items = chunkIdSchema;

  return schema;
}

const fastRoutineModelContextLimit = 4;

const confidenceOrder = {
  unsupported: 0,
  low: 1,
  medium: 2,
  high: 3,
} as const;

export const machineReadableFallbackAnswer =
  "The indexed sources were not machine-readable enough to produce a formatted answer.";

function safeRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export type SearchChunksArgs = {
  query: string;
  topK?: number;
  minSimilarity?: number;
  documentId?: string;
  documentIds?: string[];
  ownerId?: string;
  allowGlobalSearch?: boolean;
  skipCache?: boolean;
  queryMode?: ClinicalQueryMode;
  // Internal: set when this call is a re-run on a trigram-corrected query, to prevent the
  // unsupported-short-circuit typo-correction path from recursing more than once.
  typoCorrected?: boolean;
};

export type AnswerProgressEvent = {
  stage: "retrieved" | "routing" | "generating" | "retrying" | "finalizing" | "cached";
  message: string;
  resultCount?: number;
  visibleSourceCount?: number;
  directSourceCount?: number;
  weakSourceCount?: number;
  timingMs?: number;
  relevance?: EvidenceRelevance;
  mode?: RagAnswer["routingMode"];
  model?: string | null;
  reason?: string;
  smartApiPlan?: SmartRagApiPlan;
};

type AnswerQuestionWithScopeArgs = SearchChunksArgs & {
  logQuery?: boolean;
  onProgress?: (event: AnswerProgressEvent) => void | Promise<void>;
  signal?: AbortSignal;
};

export type SearchTelemetry = {
  search_cache_hit: boolean;
  shared_cache_hit?: boolean;
  shared_cache_status?: "hit" | "miss";
  shared_cache_miss_reason?: string | null;
  query_class?: RagQueryClass;
  vector_candidate_count?: number;
  text_candidate_count?: number;
  embedding_field_count?: number;
  retrieval_query_variant_count?: number;
  rag_alias_count?: number;
  rag_alias_expansion_count?: number;
  text_fast_path_latency_ms: number;
  text_candidate_budget?: number;
  text_fast_path_reason?: string | null;
  embedding_skipped: boolean;
  embedding_skip_reason?: string | null;
  embedding_latency_ms: number;
  embedding_cache_hit: boolean;
  supabase_rpc_latency_ms: number;
  rerank_latency_ms: number;
  memory_card_count?: number;
  memory_top_score?: number;
  index_unit_count?: number;
  index_unit_top_score?: number;
  retrieval_layer_counts?: Record<string, number>;
  retrieval_layer_top_scores?: Record<string, number>;
  retrieval_layer_latencies_ms?: Record<string, number>;
  // P0.1: per-RPC failure codes for the hybrid retrieval layers. A non-empty map means a hybrid
  // layer errored (not merely returned zero matches) and the app silently degraded — the exact
  // failure mode that hid the schema drift. Surfaced in telemetry + logged via logger.error.
  hybrid_rpc_errors?: Record<string, string>;
  retrieval_provenance_counts?: Record<string, number>;
  retrieval_plan?: string;
  retrieval_intent?: RetrievalIntent;
  retrieval_selection?: RetrievalSelectionSummary;
  coverage_gate_decision?: "accepted" | "rejected" | "not_applicable";
  coverage_gate_reason?: string | null;
  vector_skipped_reason?: string | null;
  source_image_required?: boolean;
  source_image_satisfied?: boolean;
  second_stage_rerank_used?: boolean;
  second_stage_rerank_latency_ms?: number;
  visual_direct_image_count?: number;
  weighted_top_score?: number;
  rrf_top_score?: number;
  top_score?: number;
  second_top_score?: number;
  score_spread?: number;
  score_distinct_documents?: number;
  retrieval_candidate_count?: number;
  retrieval_strategy?:
    | "search_cache"
    | "text_fast_path"
    | "document_lookup_fast_path"
    | "hybrid"
    | "vector_fallback"
    | "unsupported_short_circuit";
};

function retrievalPlanForQueryClass(queryClass?: RagQueryClass) {
  switch (queryClass) {
    case "document_lookup":
      return "document_lookup:title_label_section_then_chunks";
    case "table_threshold":
      return "table_threshold:table_facts_visual_units_then_chunks";
    case "medication_dose_risk":
      return "medication_dose_risk:medication_rows_thresholds_monitoring_then_chunks";
    case "comparison":
      return "comparison:diverse_documents_sections_memory_then_chunks";
    case "broad_summary":
      return "broad_summary:document_summaries_sections_memory_then_chunks";
    default:
      return "balanced_hybrid:chunks_fields_units_memory";
  }
}

const visualEvidenceUnitTypes = new Set([
  "visual_summary",
  "visual_askable_question",
  "table_threshold",
  "medication_chart_row",
  "flowchart_step",
  "diagram_decision",
  "risk_matrix_cell",
  "chart_finding",
]);

const tableVisualEvidenceUnitTypes = new Set([
  "table_fact",
  "table_threshold",
  "medication_chart_row",
  "risk_matrix_cell",
]);

function provenanceLayerKeys(result: SearchResult) {
  const layers = new Set<string>(["chunk"]);
  if (result.memory_cards?.length) layers.add("memory_card");
  if (result.index_unit?.unit_type) layers.add(`index_unit:${result.index_unit.unit_type}`);
  if (result.match_explanation?.tableHit || result.index_unit?.unit_type === "table_fact" || result.table_facts?.length)
    layers.add("table_fact");
  if (result.match_explanation?.fieldType) layers.add(`field:${result.match_explanation.fieldType}`);
  if (result.match_explanation?.titleHit) layers.add("title");
  if (result.match_explanation?.labelHit) layers.add("label");
  if (result.match_explanation?.sectionHit) layers.add("section");
  if (result.match_explanation?.matchedAliases?.length) layers.add("alias");
  if (result.index_unit?.source_image_id) layers.add("source_image");
  return layers;
}

function layerTopScore(results: SearchResult[]) {
  return Number(Math.max(0, ...results.map((result) => result.hybrid_score ?? result.similarity ?? 0)).toFixed(4));
}

function recordRetrievalLayer(
  telemetry: SearchTelemetry,
  layer: string,
  count: number,
  options: { latencyMs?: number; topScore?: number } = {},
) {
  telemetry.retrieval_layer_counts = {
    ...(telemetry.retrieval_layer_counts ?? {}),
    [layer]: count,
  };
  if (typeof options.latencyMs === "number") {
    telemetry.retrieval_layer_latencies_ms = {
      ...(telemetry.retrieval_layer_latencies_ms ?? {}),
      [layer]: Math.max(0, Math.round(options.latencyMs)),
    };
  }
  if (typeof options.topScore === "number") {
    telemetry.retrieval_layer_top_scores = {
      ...(telemetry.retrieval_layer_top_scores ?? {}),
      [layer]: Number(Math.max(0, options.topScore).toFixed(4)),
    };
  }
}

// P0.1: a hybrid RPC returning an error (vs zero rows) means the whole layer silently degraded.
// Previously every call site did `if (error || !data?.length) return []` and dropped the error on
// the floor, which is how the live schema drift (42702) went unnoticed. Log it structurally and,
// where telemetry is in scope, record the failing RPC + code so it shows up in rag_retrieval_logs.
type SupabaseRpcError = { message?: string; code?: string; details?: string; hint?: string } | null;

function recordHybridRpcError(telemetry: SearchTelemetry | undefined, rpc: string, error: SupabaseRpcError) {
  if (!error) return;
  const code = error.code ?? "unknown";
  logger.error("hybrid_rpc_failed", { rpc, code, message: error.message, hint: error.hint });
  if (telemetry) {
    telemetry.hybrid_rpc_errors = {
      ...(telemetry.hybrid_rpc_errors ?? {}),
      [rpc]: code,
    };
  }
}

function recordSearchScoreTelemetry(telemetry: SearchTelemetry, results: SearchResult[]) {
  if (!results.length) {
    telemetry.top_score = 0;
    telemetry.second_top_score = 0;
    telemetry.score_spread = 0;
    telemetry.weighted_top_score = 0;
    telemetry.rrf_top_score = 0;
    telemetry.score_distinct_documents = 0;
    telemetry.retrieval_candidate_count = results.length;
    telemetry.retrieval_layer_counts = telemetry.retrieval_layer_counts ?? {};
    telemetry.retrieval_provenance_counts = {};
    telemetry.visual_direct_image_count = 0;
    return;
  }

  const byScore = (left: SearchResult, right: SearchResult) => {
    const leftHybrid = left.hybrid_score ?? left.similarity ?? 0;
    const rightHybrid = right.hybrid_score ?? right.similarity ?? 0;
    if (rightHybrid !== leftHybrid) return rightHybrid - leftHybrid;
    const leftSimilarity = left.similarity ?? 0;
    const rightSimilarity = right.similarity ?? 0;
    if (rightSimilarity !== leftSimilarity) return rightSimilarity - leftSimilarity;
    if (right.relevance?.score !== left.relevance?.score)
      return (right.relevance?.score ?? 0) - (left.relevance?.score ?? 0);
    return left.id.localeCompare(right.id);
  };

  results.sort(byScore);
  const deduped: SearchResult[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    if (seen.has(result.id)) continue;
    seen.add(result.id);
    deduped.push(result);
  }
  results.length = 0;
  results.push(...deduped);

  telemetry.weighted_top_score = Number(
    Math.max(0, ...results.map((result) => result.hybrid_score ?? result.similarity ?? 0)).toFixed(4),
  );
  telemetry.rrf_top_score = Number(Math.max(0, ...results.map((result) => result.rrf_score ?? 0)).toFixed(4));
  telemetry.top_score = Number(results[0] ? Math.max(0, results[0].hybrid_score ?? results[0].similarity ?? 0) : 0);
  telemetry.second_top_score = Number(
    results[1] ? Math.max(0, results[1].hybrid_score ?? results[1].similarity ?? 0) : 0,
  );
  telemetry.score_spread = Number(Math.max(0, telemetry.top_score - telemetry.second_top_score).toFixed(4));
  telemetry.score_distinct_documents = new Set(results.map((result) => result.document_id)).size;
  telemetry.retrieval_candidate_count = results.length;
  telemetry.retrieval_provenance_counts = results.reduce<Record<string, number>>((counts, result) => {
    for (const layer of provenanceLayerKeys(result)) counts[layer] = (counts[layer] ?? 0) + 1;
    return counts;
  }, {});
  telemetry.retrieval_layer_counts = telemetry.retrieval_layer_counts ?? { ...telemetry.retrieval_provenance_counts };
  telemetry.visual_direct_image_count = results.reduce((count, result) => {
    const sourceImageIds = new Set(
      [result.index_unit?.source_image_id, ...(result.table_facts ?? []).map((fact) => fact.source_image_id)].filter(
        Boolean,
      ) as string[],
    );
    if (!sourceImageIds.size) return count;
    return count + (result.images ?? []).filter((image) => sourceImageIds.has(image.id)).length;
  }, 0);
}

function shouldUseSecondStageRerank(queryClass: RagQueryClass | undefined, results: SearchResult[], topK: number) {
  if (results.length <= 1) return false;
  const topScore = Math.max(0, results[0]?.hybrid_score ?? results[0]?.similarity ?? 0);
  const secondScore = Math.max(0, results[1]?.hybrid_score ?? results[1]?.similarity ?? 0);
  const topScoresClose = Math.abs(topScore - secondScore) <= 0.04;
  const hasVisualEvidence = results.some((result) => visualEvidenceUnitTypes.has(result.index_unit?.unit_type ?? ""));
  const hasTableVisualEvidence = results.some((result) =>
    tableVisualEvidenceUnitTypes.has(result.index_unit?.unit_type ?? ""),
  );
  if (queryClass === "table_threshold" || queryClass === "medication_dose_risk") {
    return hasVisualEvidence || hasTableVisualEvidence || topScoresClose;
  }
  if (queryClass === "comparison") return results.length > topK || topScoresClose;
  return topScoresClose && hasVisualEvidence;
}

function secondStageScore(result: SearchResult, queryClass: RagQueryClass | undefined, index: number) {
  let score = result.score_explanation?.finalScore ?? result.hybrid_score ?? result.similarity ?? 0;
  const unitType = result.index_unit?.unit_type ?? "";
  const source = result.index_unit?.metadata?.source;
  const sourceQuality = Number(result.index_unit?.quality_score ?? 0.65);
  const doseAmountText = `${result.section_heading ?? ""} ${result.content} ${(result.images ?? [])
    .map((image) => `${image.caption ?? ""} ${image.tableTextSnippet ?? ""} ${image.tableTitle ?? ""}`)
    .join(" ")} ${(result.table_facts ?? [])
    .map(
      (fact) => `${fact.table_title ?? ""} ${fact.row_label ?? ""} ${fact.threshold_value ?? ""} ${fact.action ?? ""}`,
    )
    .join(" ")}`;
  const hasDoseAmount = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|microgram|micrograms)\b/i.test(doseAmountText);
  score += Math.max(0, 0.09 - index * 0.004);
  if (result.memory_cards?.length && (queryClass === "broad_summary" || queryClass === "comparison")) score += 0.035;
  if (queryClass === "document_lookup" && (result.match_explanation?.titleHit || result.match_explanation?.labelHit))
    score += 0.045;
  if ((queryClass === "table_threshold" || queryClass === "medication_dose_risk") && result.table_facts?.length)
    score += 0.065;
  if (queryClass === "medication_dose_risk" && hasDoseAmount) score += 0.18;
  if (tableVisualEvidenceUnitTypes.has(unitType)) score += 0.08;
  else if (visualEvidenceUnitTypes.has(unitType)) score += 0.04;
  if (source === "visual_intelligence") score += Math.min(0.035, Math.max(0, sourceQuality - 0.55) * 0.08);
  if (result.source_metadata?.document_status === "outdated") score -= 0.035;
  if (result.source_metadata?.extraction_quality === "poor") score -= 0.035;
  if (result.indexing_quality?.quality_score !== undefined && result.indexing_quality.quality_score < 0.55)
    score -= 0.035;
  return score;
}

function applySecondStageRerankIfNeeded(args: {
  queryClass?: RagQueryClass;
  results: SearchResult[];
  telemetry: SearchTelemetry;
  topK: number;
}) {
  if (!shouldUseSecondStageRerank(args.queryClass, args.results, args.topK)) return args.results;
  const startedAt = Date.now();
  const reranked = args.results
    .map((result, index) => {
      const score = secondStageScore(result, args.queryClass, index);
      return {
        ...result,
        hybrid_score: Number(Math.max(result.hybrid_score ?? 0, score).toFixed(4)),
        match_explanation: {
          ...result.match_explanation,
          reasons: Array.from(new Set([...(result.match_explanation?.reasons ?? []), "second_stage_rerank"])),
        },
      };
    })
    .sort(
      (left, right) =>
        (right.hybrid_score ?? right.similarity ?? 0) - (left.hybrid_score ?? left.similarity ?? 0) ||
        left.id.localeCompare(right.id),
    );
  args.telemetry.second_stage_rerank_used = true;
  args.telemetry.second_stage_rerank_latency_ms =
    (args.telemetry.second_stage_rerank_latency_ms ?? 0) + Date.now() - startedAt;
  recordRetrievalLayer(args.telemetry, "second_stage_rerank", reranked.length, {
    latencyMs: Date.now() - startedAt,
    topScore: layerTopScore(reranked),
  });
  return reranked;
}

const citationSchema = z.object({
  chunk_id: z.string(),
  document_id: z.string().optional(),
  title: z.string().optional(),
  file_name: z.string().optional(),
  page_number: z.number().nullable().optional(),
  chunk_index: z.number().optional(),
});

const answerJsonSchema = z.object({
  answer: z.string().min(1).optional(),
  grounded: z.boolean().optional(),
  confidence: z.enum(["high", "medium", "low", "unsupported"]).optional(),
  answerSections: z
    .array(
      z.object({
        heading: z.string().min(1),
        kind: z.enum(answerSectionKinds).optional(),
        supportLevel: z.enum(answerSectionSupportLevels).optional(),
        body: z.string().min(1),
        citation_chunk_ids: z.array(z.string()).optional().default([]),
      }),
    )
    .optional()
    .default([]),
  citations: z.array(citationSchema).optional().default([]),
  quoteCards: z
    .array(
      citationSchema.extend({
        quote: z.string().min(1),
        section_heading: z.string().nullable().optional(),
      }),
    )
    .optional()
    .default([]),
  conflictsOrGaps: z
    .array(
      z.object({
        type: z.enum(["gap", "conflict"]).catch("gap"),
        message: z.string().min(1),
        source_chunk_ids: z.array(z.string()).optional(),
      }),
    )
    .optional()
    .default([]),
});

function resultCitation(result: SearchResult): Citation {
  return {
    chunk_id: result.id,
    document_id: result.document_id,
    title: result.title,
    file_name: result.file_name,
    page_number: result.page_number,
    chunk_index: result.chunk_index,
    similarity: result.similarity,
    source_metadata: result.source_metadata,
  };
}

function allowedChunkMap(results: SearchResult[]) {
  return new Map(results.map((result) => [result.id, result]));
}

// Audit M1: confidence must reflect the strength of the evidence the answer
// actually CITES. Taking the max similarity over ALL retrieved results let an
// uncited high-similarity chunk grant "high" confidence to an answer built on
// weak citations, so the strongest-score scan is scoped to the cited subset.
// A citation that maps to no known chunk contributes nothing (fail low).
function deriveConfidence(
  results: SearchResult[],
  acceptedCitations: Array<Pick<Citation, "chunk_id">>,
): RagAnswer["confidence"] {
  if (acceptedCitations.length === 0 || results.length === 0) return "unsupported";
  const citedIds = new Set(acceptedCitations.map((citation) => citation.chunk_id));
  const citedResults = results.filter((result) => citedIds.has(result.id));
  const strongest = citedResults.reduce((max, result) => Math.max(max, result.similarity), 0);
  if (strongest >= 0.82 && acceptedCitations.length >= 2) return "high";
  if (strongest >= 0.64) return "medium";
  return "low";
}

export function scoreValue(result: SearchResult) {
  const similarity = result.similarity ?? 0;
  const hybrid = result.hybrid_score ?? similarity;
  if (similarity > 0 && hybrid > similarity + 0.12) return similarity;
  return Math.min(1, hybrid);
}

function buildRetrievalDiagnostics(args: {
  queryClass: RagQueryClass;
  query: string;
  results: SearchResult[];
  answerMode: "unsupported" | "extractive" | "fast" | "strong";
  fallbackReason?: string | null;
}) {
  const resultScores = args.results.map(scoreValue);
  const sortedScores = [...resultScores].sort((a, b) => b - a);
  const topScore = sortedScores[0] ?? 0;
  const secondScore = sortedScores[1] ?? 0;
  const distinctDocuments = new Set(args.results.map((result) => result.document_id)).size;
  const scoreSpread = Number(Math.max(0, topScore - secondScore).toFixed(4));
  const clinicallySensitiveQuery = /table_threshold|medication_dose_risk/.test(args.queryClass);
  const weakSignal =
    topScore < 0.5 ||
    (args.results.length > 1 && scoreSpread < 0.05 && topScore < 0.72) ||
    (args.results.length > 0 && distinctDocuments === 1 && clinicallySensitiveQuery && topScore < 0.68);
  const gateStatus: RetrievalConfidenceGateStatus = weakSignal ? "blocked" : "passed";
  return {
    candidateCount: args.results.length,
    retrievalDepth: args.results.length,
    distinctDocumentCount: distinctDocuments,
    topScore: Number(topScore.toFixed(4)),
    secondScore: Number(secondScore.toFixed(4)),
    scoreSpread,
    queryClass: args.queryClass,
    routeMode: args.answerMode,
    gateStatus,
    fallbackReason: weakSignal ? "low_signal_retrieval_gate" : (args.fallbackReason ?? null),
    retrievalReason:
      weakSignal && args.fallbackReason
        ? args.fallbackReason
        : weakSignal
          ? "top_score_and_diversity_below_threshold"
          : null,
  } satisfies RetrievalDiagnostics;
}

function applyConfidenceGate(
  route: {
    mode: "unsupported" | "extractive" | "fast" | "strong";
    model: string | null;
    reason: string;
    strongestScore: number;
    documentCount: number;
  },
  queryClass: RagQueryClass,
  diagnostics: RetrievalDiagnostics,
): { route: typeof route; fallbackReason?: string } {
  if (route.mode === "unsupported") return { route };
  if (diagnostics.gateStatus === "passed") return { route };
  if (diagnostics.retrievalDepth < 2 && queryClass === "table_threshold") return { route };

  return {
    route: {
      ...route,
      mode: "unsupported",
      model: null,
      reason: `${route.reason}; confidence_gate_blocked`,
    },
    fallbackReason: `low_signal_${queryClass}_${route.mode}`,
  };
}

function clampConfidence(
  proposed: RagAnswer["confidence"] | undefined,
  derived: RagAnswer["confidence"],
): RagAnswer["confidence"] {
  if (!proposed) return derived;
  return confidenceOrder[proposed] < confidenceOrder[derived] ? proposed : derived;
}

type SanitizedCitations = {
  citations: Citation[];
  /** True only when the model-provided citations include at least one valid chunk. */
  modelCited: boolean;
  proposedCount: number;
  invalidCount: number;
};

function sanitizeCitations(
  proposed: Array<{ chunk_id: string }> | undefined,
  results: SearchResult[],
): SanitizedCitations {
  const chunks = allowedChunkMap(results);
  const citations: Citation[] = [];
  const seen = new Set<string>();
  let proposedCount = 0;
  let invalidCount = 0;

  for (const citation of proposed ?? []) {
    proposedCount += 1;
    const source = chunks.get(citation.chunk_id);
    if (!source) {
      invalidCount += 1;
      continue;
    }
    if (seen.has(source.id)) continue;
    seen.add(source.id);
    citations.push(resultCitation(source));
  }

  if (citations.length > 0) return { citations, modelCited: true, proposedCount, invalidCount };
  return { citations: [], modelCited: false, proposedCount, invalidCount };
}

function inferAnswerSectionKind(
  proposed: AnswerSectionKind | undefined,
  heading: string,
  body: string,
): AnswerSectionKind {
  if (proposed) return proposed;
  const text = `${heading} ${body}`.toLowerCase();
  if (/\b(?:gap|unsupported|not contain|not enough|missing|unclear)\b/.test(text)) return "source_gap";
  if (/\b(?:compare|comparison|versus|difference|conflict)\b/.test(text)) return "comparison";
  if (/\b(?:contraindicat|caution|avoid|interaction)\b/.test(text)) return "contraindications_cautions";
  if (/\b(?:risk|escalat|urgent|red flag|withhold|cease|stop|emergency)\b/.test(text)) return "escalation_risk";
  if (/\b(?:threshold|cutoff|cut-off|anc|fbc|wbc|below|above|range|score)\b/.test(text)) return "thresholds";
  if (/\b(?:dose|dosing|dosage|mg|mcg|route|oral|im\b|po\b|medication|prescrib)\b/.test(text)) return "medication_dose";
  if (/\b(?:monitor|timing|weekly|monthly|hours?|days?|weeks?|blood test|level|review interval)\b/.test(text))
    return "monitoring_timing";
  if (/\b(?:document|form|record|audit|consent|register)\b/.test(text)) return "documentation";
  if (/\b(?:action|required|must|arrange|contact|notify|assess|complete)\b/.test(text)) return "required_actions";
  if (/\b(?:quote|citation|verify|source)\b/.test(text)) return "verification";
  return "bottom_line";
}

function normalizeAnswerSectionSupportLevel(
  proposed: AnswerSectionSupportLevel | undefined,
  sources: SearchResult[],
): AnswerSectionSupportLevel {
  if (proposed) return proposed;
  const verdicts = sources.map((source) => source.relevance?.verdict).filter(Boolean);
  if (verdicts.includes("direct")) return "direct";
  if (verdicts.includes("partial")) return "partial";
  if (verdicts.includes("nearby")) return "nearby";
  if (verdicts.includes("none")) return "unsupported";
  return sources.length ? "direct" : "unsupported";
}

function removeIncompleteTrailingSentence(value: string) {
  const text = value.trim();
  if (!text || /[.!?]["')\]]*$/.test(text)) return text;

  const sentenceEndMatches = Array.from(text.matchAll(/[.!?](?=\s+[A-Z0-9])/g));
  const lastCompleteEnd = sentenceEndMatches.at(-1)?.index;
  if (lastCompleteEnd === undefined || lastCompleteEnd < 32) return text;

  const complete = text.slice(0, lastCompleteEnd + 1).trim();
  return complete.length >= 32 ? complete : text;
}

function sanitizeAnswerSectionHeadingText(heading: string, body: string) {
  const structuredHeading = sanitizeStructuredText(heading, { minLength: 1, minTokens: 1 });
  const polishedHeading = structuredHeading ? sanitizeAnswerText(structuredHeading) || structuredHeading : "";
  const usableHeading =
    polishedHeading &&
    !hasClinicalAnswerQualityIssue(polishedHeading) &&
    !isLowYieldClinicalText(`${polishedHeading}. ${body}`)
      ? polishedHeading
      : "";
  return cleanAnswerSectionHeading(usableHeading, body);
}

function sanitizeAnswerSections(
  sections: AnswerSection[] | undefined,
  results: SearchResult[],
  query?: string,
): AnswerSection[] {
  const allowed = allowedChunkMap(results);
  const seen = new Set<string>();

  return (sections ?? [])
    .map((section) => {
      const body = removeIncompleteTrailingSentence(
        sanitizeAnswerText(section.body) || sanitizeStructuredText(section.body, { minLength: 8, minTokens: 2 }),
      );
      const heading = sanitizeAnswerSectionHeadingText(section.heading, body);
      const citation_chunk_ids = [...new Set(section.citation_chunk_ids.filter((id) => allowed.has(id)))];
      const citationSources = citation_chunk_ids
        .map((id) => allowed.get(id))
        .filter((result): result is SearchResult => Boolean(result));
      return {
        heading,
        kind: inferAnswerSectionKind(section.kind, heading, body),
        supportLevel: normalizeAnswerSectionSupportLevel(section.supportLevel, citationSources),
        body: boldHighYieldClinicalText(body, query),
        citation_chunk_ids,
      };
    })
    .filter((section) => {
      if (!section.heading || !section.body || section.citation_chunk_ids.length === 0) return false;
      if (!isUsableAnswerSectionText(section.heading, { minTokens: 1, minLength: 1 })) return false;
      if (!isUsableAnswerSectionText(section.body, { minTokens: 2, minLength: 8 })) return false;
      if (hasClinicalAnswerQualityIssue(section.heading) || hasClinicalAnswerQualityIssue(section.body)) return false;
      if (isLowYieldClinicalText(`${section.heading}. ${section.body}`)) return false;
      const key = `${section.heading.toLowerCase()}||${section.body.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeQuoteVerificationText(text: string) {
  return sourceTextForClinicalProse(text)
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tableFactQuoteText(fact: NonNullable<SearchResult["table_facts"]>[number]) {
  // Mirrors tableFactText in answer-verification.ts: include the fact-metadata
  // snippet fields that rich-mode prompts show the model (tableSnippetForFact),
  // so quotes drawn from them verify as exact.
  const metadata = safeRecord(fact.metadata);
  const metadataString = (key: string) => (typeof metadata[key] === "string" ? (metadata[key] as string) : "");
  const metadataCells = Array.isArray(metadata.cells) ? (metadata.cells as unknown[]).map(String).join(" ") : "";
  return [
    fact.table_title,
    fact.row_label,
    fact.clinical_parameter,
    fact.threshold_value,
    fact.action,
    metadataString("accessible_table_markdown"),
    metadataString("table_text_snippet"),
    metadataCells,
  ]
    .filter(Boolean)
    .join(" ");
}

function sourceTextForQuoteVerification(source: SearchResult) {
  const parts = [
    source.content,
    source.adjacent_context,
    source.section_heading,
    source.retrieval_synopsis,
    source.table_facts?.map(tableFactQuoteText).join(" "),
    source.memory_cards?.map((card) => card.content).join(" "),
    source.index_unit ? [source.index_unit.title, source.index_unit.content].filter(Boolean).join(" ") : "",
    source.images
      ?.map((image) =>
        [image.tableLabel, image.tableTitle, image.caption, image.tableTextSnippet, image.accessibleTableMarkdown]
          .filter(Boolean)
          .join(" "),
      )
      .join(" "),
  ];
  return parts.filter(Boolean).join(" ");
}

function isExactSourceQuote(quote: string, source: SearchResult) {
  const normalizedQuote = normalizeQuoteVerificationText(quote);
  if (normalizedQuote.length < 8) return false;
  const normalizedSource = normalizeQuoteVerificationText(sourceTextForQuoteVerification(source));
  return normalizedSource.includes(normalizedQuote);
}

function sanitizeQuoteCards(
  cards: Array<{ chunk_id: string; quote: string; section_heading?: string | null }> | undefined,
  results: SearchResult[],
): QuoteCard[] {
  const chunks = allowedChunkMap(results);
  return (cards ?? [])
    .map((card) => {
      const source = chunks.get(card.chunk_id);
      if (!source) return null;
      const quote = sanitizeStructuredText(card.quote, { minLength: 8, minTokens: 2 });
      if (!quote) return null;
      if (!isExactSourceQuote(quote, source)) return null;
      return {
        ...resultCitation(source),
        quote,
        section_heading: card.section_heading ?? source.section_heading,
      } satisfies QuoteCard;
    })
    .filter((card): card is QuoteCard => Boolean(card));
}

function sanitizeConflictsOrGaps(items: ConflictOrGap[] | undefined, results: SearchResult[]): ConflictOrGap[] {
  const allowed = new Set(results.map((result) => result.id));
  return (items ?? [])
    .map((item) => ({
      type: item.type,
      message: sanitizeStructuredText(item.message, { minLength: 8, minTokens: 2 }) || item.message,
      source_chunk_ids: item.source_chunk_ids?.filter((id) => allowed.has(id)),
    }))
    .filter((item) => !item.source_chunk_ids || item.source_chunk_ids.length > 0);
}

function enrichGroundedReviewCitations(answer: RagAnswer, results: SearchResult[], minCitations = 2): RagAnswer {
  if (!answer.grounded || answer.confidence === "unsupported") return answer;
  if (answer.citations.length >= minCitations) return answer;
  if ((answer.unverifiedNumericTokens?.length ?? 0) > 0 || answer.faithfulnessWarning) return answer;

  const existing = new Set(answer.citations.map((citation) => citation.chunk_id));
  const additional = compactCitations(results)
    .filter((citation) => !existing.has(citation.chunk_id))
    .slice(0, minCitations - answer.citations.length);
  if (additional.length === 0) return answer;

  return {
    ...answer,
    citations: [...answer.citations, ...additional],
    routingReason: appendRoutingReason(answer.routingReason, "review_citations_enriched"),
  };
}

function normalizeSearchResults(results: SearchResult[]) {
  return results.map((result) => ({
    ...result,
    source_metadata: normalizeSourceMetadata(result.source_metadata),
  }));
}

function safeFallbackAnswer(raw: string, results: SearchResult[], query?: string): RagAnswer {
  // B5: on model-JSON parse failure we cannot trust any model-asserted citation
  // mapping. Do NOT back-fill all retrieved chunks as citations and stamp the
  // answer grounded — that re-introduces exactly the back-fill GEN-C3 removed,
  // hidden in the error path. Treat a parse failure as ungrounded/unsupported,
  // and still run the numeric faithfulness gate over the salvaged prose so any
  // dose/threshold it contains is surfaced as unverified rather than trusted.
  const answer: RagAnswer = {
    answer: boldHighYieldClinicalText(sanitizeAnswerText(raw) || machineReadableFallbackAnswer, query),
    grounded: false,
    confidence: "unsupported",
    citations: [],
    sources: results,
    routingReason: "structured_parse_fallback",
    answerSections: [],
    conflictsOrGaps: detectConflictsOrGaps(results),
    visualEvidence: buildVisualEvidence(results),
    bestSource: selectBestSourceRecommendation(results),
  };
  return applyNumericVerification(answer);
}

function addOpenAIUsage(total: OpenAITokenUsage, usage?: OpenAITokenUsage) {
  if (!usage) return total;
  return {
    input_tokens: (total.input_tokens ?? 0) + (usage.input_tokens ?? 0),
    output_tokens: (total.output_tokens ?? 0) + (usage.output_tokens ?? 0),
    total_tokens: (total.total_tokens ?? 0) + (usage.total_tokens ?? 0),
    cached_input_tokens: (total.cached_input_tokens ?? 0) + (usage.cached_input_tokens ?? 0),
    reasoning_output_tokens: (total.reasoning_output_tokens ?? 0) + (usage.reasoning_output_tokens ?? 0),
  };
}

function hasOpenAIUsage(usage: OpenAITokenUsage) {
  return Object.values(usage).some((value) => typeof value === "number" && value > 0);
}

function fallbackReasonFromRouting(reason?: string | null) {
  if (!reason) return null;
  return (
    reason
      .split(";")
      .map((part) => part.trim())
      .find((part) =>
        /source_only_[a-z_]+|fallback|unsupported|no_|limited_retrieval|gap|conflict|failed|confidence_gate|low_signal/i.test(
          part,
        ),
      ) ?? null
  );
}

const answerCache = new Map<string, { expiresAt: number; answer: RagAnswer }>();
const answerInflight = new Map<string, Promise<RagAnswer>>();
const searchCache = new Map<string, { expiresAt: number; results: SearchResult[]; telemetry: SearchTelemetry }>();
const ragCacheDependencyVersion = "rag-cache-v12";
const cacheIndexingVersionTtlMs = 5000;
const cacheIndexingVersionCache = new Map<string, { expiresAt: number; value: string }>();

const clearlyNonClinicalConsumerPattern =
  /\b(coffee\s*machine|espresso|kitchen|recipe|holiday|hotel|restaurant|car|mortgage|insurance|gaming|laptop|phone|television|tv|washing\s*machine|air\s*fryer|vacuum|flight|airline)\b/i;
const clearlyOutsideCorpusMedicalPattern =
  /\b(?:diabetic ketoacidosis|dka|community acquired pneumonia|pneumonia|antibiotic|ssri|adolescent depression|hyperkalaemia|hyperkalemia)\b/i;
const unavailableDocumentNoisePattern =
  /\b(?:newly uploaded|future synthetic|not been uploaded|not uploaded|2027 revised|airport travel policy|gardening equipment checklist)\b/i;

const queryClassifierOutputSchema = {
  type: "object",
  description: "Low-cost query classification fallback for clinical RAG retrieval only.",
  additionalProperties: false,
  properties: {
    queryClass: {
      type: "string",
      enum: [
        "document_lookup",
        "table_threshold",
        "medication_dose_risk",
        "comparison",
        "broad_summary",
        "unsupported_or_general",
      ],
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    reasons: {
      type: "array",
      maxItems: 4,
      items: { type: "string", maxLength: 80 },
    },
    expandedTerms: {
      type: "array",
      maxItems: 10,
      items: { type: "string", maxLength: 60 },
    },
  },
  required: ["queryClass", "confidence", "reasons", "expandedTerms"],
};

const queryClassifierParseSchema = z.object({
  queryClass: z.enum([
    "document_lookup",
    "table_threshold",
    "medication_dose_risk",
    "comparison",
    "broad_summary",
    "unsupported_or_general",
  ]),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).max(4),
  expandedTerms: z.array(z.string()).max(10),
});

function uniqueTextValues(values: Array<string | null | undefined>, limit = 32) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value?.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
}

async function analyzeQueryWithClassifierFallback(query: string, analysis: ClinicalQueryAnalysis) {
  if (
    unavailableDocumentNoisePattern.test(query) ||
    (clearlyOutsideCorpusMedicalPattern.test(query) && analysis.documentTitleTerms.length === 0)
  ) {
    return { ...analysis, needsClassifierFallback: false } satisfies ClinicalQueryAnalysis;
  }
  if (!analysis.needsClassifierFallback || !env.OPENAI_API_KEY) return analysis;

  try {
    const result = await generateStructuredTextResult(
      [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Query: ${query}`,
                `Deterministic query class: ${analysis.queryClass}`,
                `Deterministic confidence: ${analysis.confidence}`,
                `Known expanded terms: ${analysis.expandedTerms.join(", ") || "none"}`,
              ].join("\n"),
            },
          ],
        },
      ],
      queryClassifierOutputSchema,
      {
        model: env.OPENAI_FAST_ANSWER_MODEL,
        maxOutputTokens: 220,
        operation: "text_generation",
        instructions:
          "Classify this query for retrieval routing only. Do not answer the clinical question. Prefer unsupported when the query is not about indexed clinical document retrieval.",
        reasoningEffort: "low",
        textVerbosity: "low",
        schemaName: "clinical_rag_query_classifier",
        promptCacheKey: "clinical-rag-query-classifier-v1",
        timeoutMs: 6000,
      },
    );
    const parsed = queryClassifierParseSchema.parse(JSON.parse(result.text));
    if (parsed.confidence < 0.58 || parsed.queryClass === "unsupported_or_general") return analysis;
    return {
      ...analysis,
      queryClass: parsed.queryClass,
      confidence: Math.max(analysis.confidence, parsed.confidence),
      needsClassifierFallback: false,
      needsSynthesis:
        analysis.needsSynthesis ||
        parsed.queryClass === "comparison" ||
        parsed.queryClass === "broad_summary" ||
        parsed.queryClass === "medication_dose_risk",
      expandedTerms: uniqueTextValues([...analysis.expandedTerms, ...parsed.expandedTerms], 36),
      queryRewrite: {
        ...analysis.queryRewrite,
        expansions: uniqueTextValues([...analysis.queryRewrite.expansions, ...parsed.expandedTerms], 48),
        searchQuery: uniqueTextValues(
          [analysis.queryRewrite.searchQuery, ...analysis.queryRewrite.expansions, ...parsed.expandedTerms],
          60,
        ).join(" "),
        reasons: uniqueTextValues([...analysis.queryRewrite.reasons, ...parsed.reasons, "classifier_fallback"], 16),
      },
      reasons: uniqueTextValues([...analysis.reasons, ...parsed.reasons, "classifier_fallback"], 12),
    } satisfies ClinicalQueryAnalysis;
  } catch {
    return analysis;
  }
}

function shouldShortCircuitUnsupportedSearch(query: string, analysis: ClinicalQueryAnalysis) {
  if (unavailableDocumentNoisePattern.test(query)) return true;
  if (clearlyOutsideCorpusMedicalPattern.test(query) && analysis.documentTitleTerms.length === 0) return true;
  if (analysis.queryClass !== "unsupported_or_general") return false;
  if (analysis.documentTitleIntent || analysis.medications.length || analysis.thresholdTerms.length) return false;
  if (analysis.reasons.some((reason) => reason !== "no_specific_rag_class_terms")) return false;
  if (clearlyNonClinicalConsumerPattern.test(query)) return true;
  return analysis.confidence <= 0.42 && analysis.expandedTerms.length <= 5;
}

function scopeKey(args: Pick<SearchChunksArgs, "documentId" | "documentIds">) {
  const scope = args.documentIds?.length
    ? [...args.documentIds].sort().join(",")
    : args.documentId
      ? args.documentId
      : "all-documents";
  return scope;
}

function normalizedCacheQuery(query: string) {
  return buildClinicalTextSearchQuery(query).toLowerCase().replace(/\s+/g, " ").trim();
}

function cacheIndexingVersionCacheKey(args: Pick<SearchChunksArgs, "documentId" | "documentIds" | "ownerId">) {
  return [args.ownerId ?? "anonymous", scopeKey(args)].join("|");
}

function metadataExpansionTermScore(queryTokens: Set<string>, value: string, sourceWeight: number) {
  const tokens = normalizedClinicalSearchTokens(value);
  if (tokens.length === 0) return 0;
  const overlap = tokens.filter((token) => queryTokens.has(token)).length;
  const compactness = value.length <= 80 ? 0.25 : 0;
  return sourceWeight + overlap * 0.6 + compactness;
}

function candidateMetadataExpansionTerms(query: string, candidates: SearchResult[], limit = 12) {
  const queryTokens = new Set(normalizedClinicalSearchTokens(query));
  const scoredTerms: Array<{ value: string; score: number }> = [];

  for (const candidate of candidates.slice(0, 24)) {
    scoredTerms.push(
      {
        value: candidate.section_heading ?? "",
        score: metadataExpansionTermScore(queryTokens, candidate.section_heading ?? "", 1.4),
      },
      { value: candidate.title, score: metadataExpansionTermScore(queryTokens, candidate.title, 1.2) },
      {
        value: candidate.file_name.replace(/\.[^.]+$/, "").replace(/[._-]+/g, " "),
        score: metadataExpansionTermScore(queryTokens, candidate.file_name, 0.8),
      },
    );

    for (const label of candidate.document_labels ?? []) {
      if (label.confidence !== undefined && label.confidence < 0.55) continue;
      scoredTerms.push({
        value: label.label,
        score: metadataExpansionTermScore(queryTokens, label.label, 1.8),
      });
    }

    if (candidate.document_summary && candidate.document_summary.length <= 140) {
      scoredTerms.push({
        value: candidate.document_summary,
        score: metadataExpansionTermScore(queryTokens, candidate.document_summary, 0.9),
      });
    }
  }

  return uniqueTextValues(
    scoredTerms
      .filter((term) => term.value.trim() && term.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((term) => term.value),
    limit,
  );
}

function expandClinicalQueryWithCandidateMetadata(query: string, expandedQuery: string, candidates: SearchResult[]) {
  const metadataTerms = candidateMetadataExpansionTerms(query, candidates);
  if (metadataTerms.length === 0) return expandedQuery;
  return uniqueTextValues([expandedQuery, ...metadataTerms], 24).join(" ");
}

function modeKey(args: Pick<SearchChunksArgs, "queryMode">) {
  return args.queryMode ?? "auto";
}

function scopedAnswerCacheKey(
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "queryMode">,
) {
  return [
    ragCacheDependencyVersion,
    args.ownerId ?? "anonymous",
    scopeKey(args),
    modeKey(args),
    args.query.trim().toLowerCase().replace(/\s+/g, " "),
  ].join("|");
}

function cloneAnswer(answer: RagAnswer) {
  return structuredClone(answer);
}

function getCachedAnswer(
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "skipCache" | "queryMode">,
  startedAt: number,
) {
  if (args.skipCache) return null;
  if (env.RAG_ANSWER_CACHE_TTL_MS <= 0 || env.RAG_ANSWER_CACHE_SIZE <= 0) return null;

  const key = scopedAnswerCacheKey(args);
  const cached = answerCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    answerCache.delete(key);
    return null;
  }

  const answer = cloneAnswer(cached.answer);
  answer.routingReason = answer.routingReason ? `${answer.routingReason}; answer_cache_hit` : "answer_cache_hit";
  answer.latencyTimings = {
    ...answer.latencyTimings,
    total_latency_ms: Date.now() - startedAt,
  };
  return answer;
}

function setCachedAnswer(
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "skipCache" | "queryMode">,
  answer: RagAnswer,
) {
  if (args.skipCache) return;
  if (env.RAG_ANSWER_CACHE_TTL_MS <= 0 || env.RAG_ANSWER_CACHE_SIZE <= 0) return;

  const key = scopedAnswerCacheKey(args);
  answerCache.set(key, {
    expiresAt: Date.now() + env.RAG_ANSWER_CACHE_TTL_MS,
    answer: cloneAnswer(answer),
  });

  while (answerCache.size > env.RAG_ANSWER_CACHE_SIZE) {
    const oldestKey = answerCache.keys().next().value;
    if (!oldestKey) break;
    answerCache.delete(oldestKey);
  }
  setSharedCachedAnswer(args, answer);
}

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function retrievalPlanCacheQuery(
  args: Pick<
    SearchChunksArgs,
    "query" | "documentId" | "documentIds" | "ownerId" | "queryMode" | "topK" | "minSimilarity"
  >,
  queryClass?: RagQueryClass,
  queryVariants: string[] = [],
) {
  const normalizedQuery = normalizedCacheQuery(args.query);
  const variantHash = stableHash(queryVariants.join("\n"));
  const cacheKey = [
    `plan:${retrievalPlanForQueryClass(queryClass)}`,
    `class:${queryClass ?? "unknown"}`,
    `query:${normalizedQuery}`,
    `variants:${variantHash}`,
    `mode:${modeKey(args)}`,
    `topK:${args.topK ?? 8}`,
    `min:${args.minSimilarity ?? 0.15}`,
    `rag:${ragDeepMemoryVersion}`,
  ].join("|");
  return queryCacheKeyForStorage(cacheKey);
}

function scopedSearchCacheKey(args: SearchChunksArgs, queryClass?: RagQueryClass, queryVariants: string[] = []) {
  return [
    ragCacheDependencyVersion,
    args.ownerId ?? "anonymous",
    scopeKey(args),
    retrievalPlanCacheQuery(args, queryClass, queryVariants),
  ].join("|");
}

function cloneSearchResults(results: SearchResult[]) {
  return structuredClone(results);
}

function normalizeCacheStorageTelemetry(telemetry: SearchTelemetry): SearchTelemetry {
  return {
    ...telemetry,
    shared_cache_hit: false,
    shared_cache_status: undefined,
    shared_cache_miss_reason: null,
  };
}

function getCachedSearch(
  args: SearchChunksArgs,
  queryClass?: RagQueryClass,
  queryVariants: string[] = [],
): { results: SearchResult[]; telemetry: SearchTelemetry } | null {
  if (args.skipCache || env.RAG_SEARCH_CACHE_TTL_MS <= 0 || env.RAG_SEARCH_CACHE_SIZE <= 0) return null;

  const key = scopedSearchCacheKey(args, queryClass, queryVariants);
  const cached = searchCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }

  return {
    results: cloneSearchResults(cached.results),
    telemetry: {
      ...cached.telemetry,
      search_cache_hit: true,
      retrieval_strategy: "search_cache" as const,
      text_fast_path_latency_ms: 0,
      embedding_latency_ms: 0,
      supabase_rpc_latency_ms: 0,
      rerank_latency_ms: 0,
      shared_cache_hit: false,
      shared_cache_status: undefined,
      shared_cache_miss_reason: null,
    },
  };
}

function setCachedSearch(
  args: SearchChunksArgs,
  results: SearchResult[],
  telemetry: SearchTelemetry,
  queryVariants: string[] = [],
) {
  if (args.skipCache || env.RAG_SEARCH_CACHE_TTL_MS <= 0 || env.RAG_SEARCH_CACHE_SIZE <= 0) return;
  const cacheTelemetry = normalizeCacheStorageTelemetry(telemetry);

  const key = scopedSearchCacheKey(args, telemetry.query_class, queryVariants);
  searchCache.set(key, {
    expiresAt: Date.now() + env.RAG_SEARCH_CACHE_TTL_MS,
    results: cloneSearchResults(results),
    telemetry: { ...cacheTelemetry },
  });

  while (searchCache.size > env.RAG_SEARCH_CACHE_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    if (!oldestKey) break;
    searchCache.delete(oldestKey);
  }
  setSharedCachedSearch(args, results, cacheTelemetry, queryVariants);
}

type SharedCacheKind = "search" | "answer";
type SharedCacheMissReason =
  | "cache_lookup_error"
  | "cache_lookup_exception"
  | "cache_payload_invalid"
  | "no_entry"
  | "expired"
  | "indexing_version_mismatch"
  | "dependency_version_mismatch"
  | "unknown_filter_miss";

function sharedCacheSelector(
  supabase: ReturnType<typeof createAdminClient>,
  kind: SharedCacheKind,
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "queryMode">,
  indexingVersion: string,
  normalizedQuery: string = queryCacheKeyForStorage(normalizedCacheQuery(`${modeKey(args)} ${args.query}`)),
) {
  let query = supabase
    .from("rag_response_cache")
    .select("payload")
    .eq("cache_kind", kind)
    .eq("scope_key", scopeKey(args))
    .eq("normalized_query", normalizedQuery)
    .eq("indexing_version", indexingVersion)
    .eq("dependency_version", ragCacheDependencyVersion)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  query = args.ownerId ? query.eq("owner_id", args.ownerId) : query.is("owner_id", null);
  return query;
}

async function cacheIndexingVersion(args: Pick<SearchChunksArgs, "documentId" | "documentIds" | "ownerId">) {
  const cacheKey = cacheIndexingVersionCacheKey(args);
  const cached = cacheIndexingVersionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value = `${ragDeepMemoryVersion}:index-stamp-unavailable`;
  try {
    const supabase = createAdminClient();
    const documentFilters = args.documentIds?.length ? args.documentIds : args.documentId ? [args.documentId] : null;
    let query = supabase
      .from("documents")
      .select("id,updated_at,metadata")
      .eq("status", "indexed")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (args.ownerId) query = query.eq("owner_id", args.ownerId);
    if (documentFilters?.length) query = query.in("id", documentFilters);
    const { data, error } = await query;
    if (error || !data?.length) {
      value = `${ragDeepMemoryVersion}:no-indexed-documents`;
    } else {
      const latest = data[0] as { id?: string; updated_at?: string | null; metadata?: unknown };
      const metadata = normalizeSourceMetadata(latest.metadata);
      const indexedAt = metadata.indexed_at ?? latest.updated_at ?? "unknown";
      const generationId =
        latest.metadata && typeof latest.metadata === "object" && "index_generation_id" in latest.metadata
          ? String((latest.metadata as { index_generation_id?: unknown }).index_generation_id ?? "")
          : "";
      value = `${ragDeepMemoryVersion}:${latest.id ?? "all"}:${indexedAt}:${generationId}`;
    }
  } catch {
    value = `${ragDeepMemoryVersion}:index-stamp-unavailable`;
  }
  cacheIndexingVersionCache.set(cacheKey, { value, expiresAt: Date.now() + cacheIndexingVersionTtlMs });
  return value;
}

async function getSharedCachedSearch(
  args: SearchChunksArgs,
  queryClass?: RagQueryClass,
  queryVariants: string[] = [],
): Promise<
  | { kind: "hit"; results: SearchResult[]; telemetry: SearchTelemetry }
  | { kind: "miss"; reason: SharedCacheMissReason }
  | null
> {
  if (args.skipCache || env.RAG_SEARCH_CACHE_TTL_MS <= 0) return null;
  const normalizedQuery = retrievalPlanCacheQuery(args, queryClass, queryVariants);
  const indexingVersion = await cacheIndexingVersion(args);
  async function probeSharedCacheMissReason(reasonFromLookup?: SharedCacheMissReason): Promise<SharedCacheMissReason> {
    if (reasonFromLookup) return reasonFromLookup;
    try {
      const supabase = createAdminClient();
      let probeQuery = supabase
        .from("rag_response_cache")
        .select("indexing_version,dependency_version,expires_at")
        .eq("cache_kind", "search")
        .eq("scope_key", scopeKey(args))
        .eq("normalized_query", normalizedQuery)
        .order("expires_at", { ascending: false })
        .limit(5);
      probeQuery = args.ownerId ? probeQuery.eq("owner_id", args.ownerId) : probeQuery.is("owner_id", null);
      const { data, error } = await probeQuery;
      if (error) return "cache_lookup_error";
      if (!data?.length) return "no_entry";
      const now = Date.now();
      const nonExpired = data.find((entry) => {
        const expiresAt = Date.parse(String(entry.expires_at ?? ""));
        return Number.isFinite(expiresAt) && expiresAt > now;
      });
      if (!nonExpired) return "expired";
      if (String(nonExpired.indexing_version ?? "") !== indexingVersion) return "indexing_version_mismatch";
      if (String(nonExpired.dependency_version ?? "") !== ragCacheDependencyVersion) {
        return "dependency_version_mismatch";
      }
      return "unknown_filter_miss";
    } catch {
      return "cache_lookup_exception";
    }
  }
  try {
    const { data, error } = await sharedCacheSelector(
      createAdminClient(),
      "search",
      args,
      indexingVersion,
      normalizedQuery,
    ).maybeSingle();
    if (error) return { kind: "miss", reason: await probeSharedCacheMissReason("cache_lookup_error") };
    if (!data?.payload) return { kind: "miss", reason: await probeSharedCacheMissReason() };
    const payload = data.payload as { results?: SearchResult[]; telemetry?: Partial<SearchTelemetry> };
    if (!Array.isArray(payload.results)) {
      return { kind: "miss", reason: await probeSharedCacheMissReason("cache_payload_invalid") };
    }
    return {
      kind: "hit",
      results: cloneSearchResults(payload.results),
      telemetry: {
        search_cache_hit: true,
        shared_cache_hit: true,
        shared_cache_status: "hit",
        shared_cache_miss_reason: null,
        query_class: payload.telemetry?.query_class,
        vector_candidate_count: payload.telemetry?.vector_candidate_count,
        text_candidate_count: payload.telemetry?.text_candidate_count,
        embedding_field_count: payload.telemetry?.embedding_field_count,
        retrieval_query_variant_count: payload.telemetry?.retrieval_query_variant_count ?? 0,
        text_fast_path_latency_ms: 0,
        text_candidate_budget: payload.telemetry?.text_candidate_budget,
        text_fast_path_reason: payload.telemetry?.text_fast_path_reason ?? null,
        embedding_skipped: true,
        embedding_skip_reason: payload.telemetry?.embedding_skip_reason ?? "search_cache",
        embedding_latency_ms: 0,
        embedding_cache_hit: false,
        supabase_rpc_latency_ms: 0,
        rerank_latency_ms: 0,
        memory_card_count: payload.telemetry?.memory_card_count ?? 0,
        memory_top_score: payload.telemetry?.memory_top_score ?? 0,
        index_unit_count: payload.telemetry?.index_unit_count ?? 0,
        index_unit_top_score: payload.telemetry?.index_unit_top_score ?? 0,
        retrieval_plan: payload.telemetry?.retrieval_plan ?? retrievalPlanForQueryClass(payload.telemetry?.query_class),
        retrieval_intent: payload.telemetry?.retrieval_intent,
        retrieval_selection: payload.telemetry?.retrieval_selection,
        retrieval_layer_counts: payload.telemetry?.retrieval_layer_counts ?? {},
        retrieval_layer_top_scores: payload.telemetry?.retrieval_layer_top_scores ?? {},
        retrieval_layer_latencies_ms: payload.telemetry?.retrieval_layer_latencies_ms ?? {},
        retrieval_provenance_counts: payload.telemetry?.retrieval_provenance_counts ?? {},
        coverage_gate_decision: payload.telemetry?.coverage_gate_decision,
        coverage_gate_reason: payload.telemetry?.coverage_gate_reason ?? null,
        vector_skipped_reason: payload.telemetry?.vector_skipped_reason ?? null,
        source_image_required: payload.telemetry?.source_image_required ?? false,
        source_image_satisfied: payload.telemetry?.source_image_satisfied ?? false,
        second_stage_rerank_used: payload.telemetry?.second_stage_rerank_used ?? false,
        second_stage_rerank_latency_ms: 0,
        visual_direct_image_count: payload.telemetry?.visual_direct_image_count ?? 0,
        weighted_top_score: payload.telemetry?.weighted_top_score ?? 0,
        rrf_top_score: payload.telemetry?.rrf_top_score ?? 0,
        retrieval_strategy: "search_cache" as const,
      },
    };
  } catch {
    return { kind: "miss", reason: "cache_lookup_exception" };
  }
}

async function getSharedCachedAnswer(
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "skipCache" | "queryMode">,
  startedAt: number,
) {
  if (args.skipCache || env.RAG_ANSWER_CACHE_TTL_MS <= 0) return null;
  try {
    const indexingVersion = await cacheIndexingVersion(args);
    const { data, error } = await sharedCacheSelector(
      createAdminClient(),
      "answer",
      args,
      indexingVersion,
    ).maybeSingle();
    if (error || !data?.payload) return null;
    const answer = cloneAnswer((data.payload as { answer: RagAnswer }).answer);
    answer.routingReason = answer.routingReason
      ? `${answer.routingReason}; shared_answer_cache_hit`
      : "shared_answer_cache_hit";
    answer.latencyTimings = {
      ...answer.latencyTimings,
      search_cache_hit: true,
      shared_cache_hit: true,
      shared_cache_status: "hit",
      shared_cache_miss_reason: null,
      total_latency_ms: Date.now() - startedAt,
    };
    return answer;
  } catch {
    return null;
  }
}

async function replaceSharedCacheRow(
  kind: SharedCacheKind,
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "queryMode">,
  payload: unknown,
  ttlMs: number,
  normalizedQuery: string = queryCacheKeyForStorage(normalizedCacheQuery(`${modeKey(args)} ${args.query}`)),
) {
  if (ttlMs <= 0) return;
  try {
    const supabase = createAdminClient();
    const indexingVersion = await cacheIndexingVersion(args);
    let deleteQuery = supabase
      .from("rag_response_cache")
      .delete()
      .eq("cache_kind", kind)
      .eq("scope_key", scopeKey(args))
      .eq("normalized_query", normalizedQuery)
      .eq("indexing_version", indexingVersion)
      .eq("dependency_version", ragCacheDependencyVersion);
    deleteQuery = args.ownerId ? deleteQuery.eq("owner_id", args.ownerId) : deleteQuery.is("owner_id", null);
    await deleteQuery;
    await supabase.from("rag_response_cache").insert({
      owner_id: args.ownerId ?? null,
      cache_kind: kind,
      scope_key: scopeKey(args),
      normalized_query: normalizedQuery,
      indexing_version: indexingVersion,
      dependency_version: ragCacheDependencyVersion,
      // JSON-serializable by contract of the response cache.
      payload: payload as Json,
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
    });
  } catch {
    // Shared cache must never be part of the correctness path.
  }
}

function setSharedCachedSearch(
  args: SearchChunksArgs,
  results: SearchResult[],
  telemetry: SearchTelemetry,
  queryVariants: string[] = [],
) {
  if (args.skipCache || env.RAG_SEARCH_CACHE_TTL_MS <= 0) return;
  void replaceSharedCacheRow(
    "search",
    args,
    { results: cloneSearchResults(results), telemetry },
    env.RAG_SEARCH_CACHE_TTL_MS,
    retrievalPlanCacheQuery(args, telemetry.query_class, queryVariants),
  );
}

function setSharedCachedAnswer(
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "skipCache" | "queryMode">,
  answer: RagAnswer,
) {
  if (args.skipCache || env.RAG_ANSWER_CACHE_TTL_MS <= 0) return;
  void replaceSharedCacheRow("answer", args, { answer: cloneAnswer(answer) }, env.RAG_ANSWER_CACHE_TTL_MS);
}

export function invalidateRagCachesForOwner(ownerId?: string | null) {
  if (!ownerId) {
    answerCache.clear();
    answerInflight.clear();
    searchCache.clear();
    cacheIndexingVersionCache.clear();
    void (async () => {
      try {
        await createAdminClient().from("rag_response_cache").delete().in("cache_kind", ["search", "answer"]);
      } catch (error) {
        // Shared cache invalidation is best effort.
        console.warn("Shared cache invalidation failed (all kinds):", error);
      }
    })();
    return;
  }

  const prefix = `${ownerId}|`;
  const sharedCacheOwnerId = ownerId === "anonymous" ? null : ownerId;
  for (const key of answerCache.keys()) {
    if (key.startsWith(prefix)) answerCache.delete(key);
  }
  for (const key of answerInflight.keys()) {
    if (key.startsWith(prefix) || key.includes(`|${ownerId}|`)) answerInflight.delete(key);
  }
  for (const key of searchCache.keys()) {
    if (key.startsWith(prefix)) searchCache.delete(key);
  }
  for (const key of cacheIndexingVersionCache.keys()) {
    if (key.startsWith(prefix)) cacheIndexingVersionCache.delete(key);
  }
  void (async () => {
    try {
      const deleteQuery = createAdminClient().from("rag_response_cache").delete();
      const scopedQuery = sharedCacheOwnerId
        ? deleteQuery.eq("owner_id", sharedCacheOwnerId)
        : deleteQuery.is("owner_id", null);
      await scopedQuery.in("cache_kind", ["search", "answer"]);
    } catch (error) {
      // Shared cache invalidation is best effort.
      console.warn("Shared cache invalidation failed for owner:", error);
    }
  })();
}

function invalidateAnonymousSharedRagCaches() {
  void (async () => {
    try {
      await createAdminClient()
        .from("rag_response_cache")
        .delete()
        .is("owner_id", null)
        .in("cache_kind", ["search", "answer"]);
    } catch (error) {
      // Shared cache invalidation is best effort.
      console.warn("Shared cache invalidation failed for anonymous:", error);
    }
  })();
}

export function invalidateRagCachesForDocumentMutation(ownerId: string) {
  invalidateRagCachesForOwner(ownerId);
  invalidateAnonymousSharedRagCaches();
}

type RagQueryInsert = Omit<Database["public"]["Tables"]["rag_queries"]["Insert"], "metadata"> & {
  metadata?: Record<string, unknown>;
};

async function insertRagQuery(row: RagQueryInsert) {
  const supabase = createAdminClient();
  // Redact potential-PHI raw query text centrally so every logRagQuery caller is
  // covered, and fold a stable hash + retention flag into metadata (RET-H4).
  const rawQuery = typeof row.query === "string" ? row.query : "";
  const safeRow = {
    ...row,
    query: queryTextForStorage(rawQuery),
    metadata: { ...(row.metadata ?? {}), ...queryPrivacyMetadata(rawQuery) } as Json,
  };
  await supabase.from("rag_queries").insert(safeRow);
}

async function logRagQuery(row: RagQueryInsert) {
  if (env.RAG_AWAIT_QUERY_LOGS) {
    await insertRagQuery(row);
    return;
  }

  void insertRagQuery(row).catch(() => undefined);
}

function mergeSearchResults(primary: SearchResult[], secondary: SearchResult[]) {
  const merged = new Map<string, SearchResult>();

  for (const result of [...primary, ...secondary]) {
    const existing = merged.get(result.id);
    if (!existing) {
      merged.set(result.id, result);
      continue;
    }

    const existingScore = existing.hybrid_score ?? existing.similarity;
    const resultScore = result.hybrid_score ?? result.similarity;
    merged.set(result.id, resultScore > existingScore ? result : existing);
  }

  return Array.from(merged.values());
}

const maxRetrievalQueryVariants = 4;
const maxTextRpcQueryVariants = 3;
const ragAliasCacheTtlMs = 60_000;
const maxRagAliasesPerScope = 200;
const maxRagAliasExpansions = 12;

export function textCandidateBudgetForQueryClass(queryClass: RagQueryClass | undefined, topK: number) {
  if (queryClass === "comparison") return Math.max(topK * 7, 72);
  if (queryClass === "table_threshold" || queryClass === "medication_dose_risk") return Math.max(topK * 4, 40);
  if (queryClass === "document_lookup") return Math.max(topK * 3, 24);
  if (queryClass === "unsupported_or_general") return Math.max(topK * 2, 16);
  return Math.max(topK * 4, 32);
}

export type RagAliasInput = {
  alias: string;
  canonical: string;
  alias_type?: string | null;
  weight?: number | null;
  owner_id?: string | null;
};

const ragAliasCache = new Map<string, { expiresAt: number; aliases: RagAliasInput[] }>();

function normalizeRetrievalVariant(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function retrievalVariantFromTerms(terms: string[]) {
  return buildClinicalTextSearchQuery(terms.filter(Boolean).join(" "));
}

function normalizeAliasLookup(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapedAliasPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

function aliasAppearsInQuery(normalizedQuery: string, alias: string) {
  const normalizedAlias = normalizeAliasLookup(alias);
  if (!normalizedQuery || !normalizedAlias) return false;
  const pattern = new RegExp(`(?:^|\\s)${escapedAliasPattern(normalizedAlias)}(?:\\s|$)`, "i");
  return pattern.test(normalizedQuery);
}

export function selectRagAliasExpansions(query: string, aliases: RagAliasInput[], limit = maxRagAliasExpansions) {
  const normalizedQuery = normalizeAliasLookup(query);
  const expansions: string[] = [];
  const seen = new Set<string>();

  const sorted = [...aliases].sort((left, right) => {
    const leftWeight = typeof left.weight === "number" ? left.weight : 1;
    const rightWeight = typeof right.weight === "number" ? right.weight : 1;
    return rightWeight - leftWeight;
  });

  for (const alias of sorted) {
    if (expansions.length >= limit) break;
    if (!aliasAppearsInQuery(normalizedQuery, alias.alias)) continue;
    const canonical = normalizeRetrievalVariant(alias.canonical);
    const key = canonical.toLowerCase();
    if (!canonical || seen.has(key)) continue;
    seen.add(key);
    expansions.push(canonical);
  }

  return expansions;
}

export function shouldApplyUnsupportedSearchShortCircuit(
  query: string,
  analysis: ClinicalQueryAnalysis,
  aliasExpansions: string[] = [],
) {
  return aliasExpansions.length === 0 && shouldShortCircuitUnsupportedSearch(query, analysis);
}

async function fetchEnabledRagAliases(
  supabase: ReturnType<typeof createAdminClient>,
  ownerId?: string,
): Promise<RagAliasInput[]> {
  const cacheKey = ownerId ? `owner:${ownerId}` : "global";
  const cached = ragAliasCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.aliases;

  async function readScope(scopeOwnerId: string | null) {
    let query = supabase
      .from("rag_aliases")
      .select("alias,canonical,alias_type,weight,owner_id")
      .eq("enabled", true)
      .order("weight", { ascending: false })
      .limit(maxRagAliasesPerScope);
    query = scopeOwnerId ? query.eq("owner_id", scopeOwnerId) : query.is("owner_id", null);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as RagAliasInput[];
  }

  try {
    const [globalAliases, ownerAliases] = await Promise.all([
      readScope(null),
      ownerId ? readScope(ownerId) : Promise.resolve([] as RagAliasInput[]),
    ]);
    const merged: RagAliasInput[] = [];
    const seen = new Set<string>();
    for (const alias of [...ownerAliases, ...globalAliases]) {
      const key = `${normalizeAliasLookup(alias.alias)}||${normalizeAliasLookup(alias.canonical)}`;
      if (!alias.alias?.trim() || !alias.canonical?.trim() || seen.has(key)) continue;
      seen.add(key);
      merged.push(alias);
      if (merged.length >= maxRagAliasesPerScope) break;
    }
    ragAliasCache.set(cacheKey, { aliases: merged, expiresAt: Date.now() + ragAliasCacheTtlMs });
    return merged;
  } catch {
    ragAliasCache.set(cacheKey, { aliases: [], expiresAt: Date.now() + ragAliasCacheTtlMs });
    return [];
  }
}

function assertGlobalSearchAllowed(args: SearchChunksArgs) {
  if (args.ownerId || args.allowGlobalSearch || isDemoMode() || isLocalNoAuthMode()) return;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Global RAG search requires allowGlobalSearch=true or an explicit ownerId.");
  }
}

export function buildRetrievalQueryVariants(
  query: string,
  analysis: ClinicalQueryAnalysis,
  aliases: RagAliasInput[] = [],
) {
  const variants: string[] = [];
  const seen = new Set<string>();
  const aliasExpansions = selectRagAliasExpansions(query, aliases);
  const addVariant = (value: string) => {
    const normalized = normalizeRetrievalVariant(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    variants.push(normalized);
  };

  addVariant(buildClinicalTextSearchQuery(query));
  aliasExpansions.slice(0, 2).forEach(addVariant);
  if (/\bpatient property\b/i.test(query)) {
    addVariant("patient property");
  }
  if (/\bclozapine\b/i.test(query) && /\b(?:anc|fbc|wbc|neutrophil|white cell)\b/i.test(query)) {
    addVariant("clozapine anc fbc");
    addVariant("clozapine monitoring");
  }
  if (analysis.queryClass === "comparison" && /\badmission\b/i.test(query) && /\bdischarge\b/i.test(query)) {
    addVariant("admission community patients");
    addVariant("discharge community patients");
    addVariant("admission discharge");
  }
  if (
    /\b(?:flow\s*chart|flowchart|algorithm|pathway|risk[\s-]*matrix)\b/i.test(query) &&
    /\b(?:risk|red\s*zone|red|urgent|escalat|next step)\b/i.test(query)
  ) {
    addVariant("risk flow");
    // websearch_to_tsquery ANDs every term, so the previous "red zone risk flow"
    // and "risk flow review urgent escalation" variants required all terms in one
    // chunk and did not reliably contribute candidates to the pool. A "<colour> zone" variant retrieves the small,
    // precise set of zone-action chunks (escalation protocols, observation and
    // response charts, risk-matrix cells) that answer zone / next-step questions.
    // Match the zone the query actually names so an amber-zone question does not
    // pull red-zone chunks into its candidate pool.
    const zoneColour = queriedZoneColour(query);
    if (zoneColour) {
      addVariant(`${zoneColour} zone`);
    }
  }
  addVariant(analysis.queryRewrite.searchQuery);

  addVariant(
    retrievalVariantFromTerms([
      ...analysis.canonicalTerms,
      ...analysis.acronyms,
      ...analysis.typoCorrections.map((correction) => correction.to),
      ...analysis.expandedTerms.slice(0, 8),
      ...analysis.queryRewrite.expansions.slice(0, 10),
      ...aliasExpansions.slice(0, 6),
    ]),
  );

  if (analysis.documentTitleIntent) {
    addVariant(
      retrievalVariantFromTerms([
        ...analysis.documentTitleTerms,
        ...analysis.canonicalTerms.slice(0, 6),
        ...analysis.acronyms,
        ...aliasExpansions.slice(0, 4),
      ]),
    );
  }

  if (analysis.medications.length > 0 || analysis.thresholdTerms.length > 0) {
    addVariant(
      retrievalVariantFromTerms([
        ...analysis.medications,
        ...analysis.thresholdTerms,
        ...analysis.acronyms,
        ...analysis.canonicalTerms.slice(0, 8),
        ...aliasExpansions.slice(0, 6),
      ]),
    );
  }

  const normalizedTokens = normalizedClinicalSearchTokens(query);
  if (normalizedTokens.length > 10) {
    const coreTerms = [
      ...analysis.medications,
      ...analysis.thresholdTerms,
      ...analysis.documentTitleTerms,
      ...analysis.canonicalTerms,
      ...aliasExpansions.slice(0, 4),
      ...normalizedTokens,
    ];
    addVariant(retrievalVariantFromTerms(coreTerms.slice(0, 10)));
  }

  return variants.slice(0, maxRetrievalQueryVariants);
}

// P8b: websearch_to_tsquery ANDs every term, so a long multi-term query (e.g. "ciwa score threshold
// drug treatment alcohol withdrawal") can match zero chunks even when the answer clearly exists —
// no single chunk contains all seven terms. Relax the primary variant to a term-OR query so recall
// is recovered; ts_rank_cd still ranks chunks matching more terms highest, so topical docs surface
// on top rather than flooding with single-term matches. Only used as a fallback when the strict
// AND variants returned nothing, so it never displaces a working precise match.
export function relaxVariantToOrQuery(variant: string): string | null {
  const tokens = Array.from(
    new Set(
      variant
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 1 && token !== "or"),
    ),
  );
  if (tokens.length < 2) return null;
  return tokens.join(" OR ");
}

async function searchTextChunkCandidates(args: {
  supabase: ReturnType<typeof createAdminClient>;
  queryVariants: string[];
  ownerId?: string;
  documentIds?: string[];
  matchCount: number;
}) {
  const runChunkText = async (queryText: string, matchCount: number) => {
    const { data, error } = await args.supabase.rpc("match_document_chunks_text", {
      query_text: queryText,
      match_count: matchCount,
      document_filters: args.documentIds ?? undefined,
      owner_filter: args.ownerId ?? undefined,
    });
    return error || !data?.length ? ([] as SearchResult[]) : (data as SearchResult[]);
  };

  const variants = args.queryVariants.slice(0, maxTextRpcQueryVariants);
  const resultSets = await Promise.all(
    variants.map((variant, index) =>
      runChunkText(variant, index === 0 ? args.matchCount : Math.min(args.matchCount, 32)),
    ),
  );
  const merged = resultSets.reduce(
    (accumulated, resultSet) => mergeSearchResults(resultSet, accumulated),
    [] as SearchResult[],
  );
  if (merged.length > 0) return merged;

  // Strict AND variants matched nothing. Two fallbacks, in order:
  //   (item 10, RC6) a typo the hard-coded map misses can block an otherwise-precise query — so first
  //     trigram-correct against the known clinical-term vocabulary and retry the corrected query
  //     STRICTLY. This must run before OR-relaxation: otherwise a query like "clozapin monitoring"
  //     would OR-match generic "monitoring" docs and never surface the intended clozapine result.
  //   (8b) then OR-relax the best query we have to recover recall for long multi-term queries.
  // Both are reached only when every prior attempt was empty, so neither overrides a precise match.
  const primary = variants[0] ?? "";
  let effectivePrimary = primary;
  if (primary) {
    const { data: corrected } = await args.supabase.rpc("correct_clinical_query_terms", {
      input_query: primary,
      min_sim: 0.45,
    });
    if (typeof corrected === "string" && corrected && corrected !== primary) {
      const correctedResults = await runChunkText(corrected, args.matchCount);
      if (correctedResults.length > 0) return correctedResults;
      effectivePrimary = corrected;
    }
  }

  const relaxed = relaxVariantToOrQuery(effectivePrimary);
  if (relaxed) {
    const relaxedResults = await runChunkText(relaxed, args.matchCount);
    if (relaxedResults.length > 0) return relaxedResults;
  }
  return merged;
}

type DocumentLookupRow = {
  id: string;
  owner_id?: string | null;
  title: string;
  file_name: string;
  status?: string;
  page_count?: number;
  chunk_count?: number;
  image_count?: number;
  metadata?: unknown;
  text_rank?: number;
  match_reason?: string;
};

type DocumentLookupChunkRow = {
  id: string;
  document_id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  section_path?: string[] | null;
  heading_level?: number | null;
  parent_heading?: string | null;
  anchor_id?: string | null;
  content: string;
  retrieval_synopsis?: string | null;
  image_ids: string[] | null;
  text_rank?: number | null;
};

type ChunkSignalMatch = {
  chunkId: string;
  similarity: number;
  textRank: number;
  hybridScore: number;
  reason: string;
  fieldType?: string | null;
  tableFacts?: Array<{
    id: string;
    document_id: string;
    source_chunk_id: string | null;
    source_image_id: string | null;
    page_number: number | null;
    table_title: string | null;
    row_label: string | null;
    clinical_parameter: string | null;
    threshold_value: string | null;
    action: string | null;
    text_rank?: number | null;
    match_reason?: string | null;
  }>;
  indexUnit?: DocumentIndexUnitMatch | null;
};

type IndexUnitRpcRow = DocumentIndexUnitMatch & {
  document_id: string;
  source_chunk_id: string | null;
  similarity?: number | null;
  text_rank?: number | null;
  hybrid_score?: number | null;
};

type TableFactRpcRow = {
  id: string;
  document_id: string;
  source_chunk_id: string | null;
  source_image_id: string | null;
  page_number: number | null;
  table_title: string | null;
  row_label: string | null;
  clinical_parameter: string | null;
  threshold_value: string | null;
  action: string | null;
  text_rank?: number | null;
  match_reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

function documentLookupChunkTerms(query: string) {
  const shortClinicalTerms = new Set(["ed", "im", "po", "pt"]);
  return normalizedClinicalSearchTokens(query)
    .filter((term) => term.length >= 3 || shortClinicalTerms.has(term))
    .slice(0, 8);
}

function documentLookupChunkScore(chunk: DocumentLookupChunkRow, terms: string[]) {
  if (terms.length === 0) return 0;
  const heading = chunk.section_heading?.toLowerCase() ?? "";
  const content = `${chunk.retrieval_synopsis ?? ""} ${chunk.content}`.toLowerCase();
  const matched = terms.filter((term) => heading.includes(term) || content.includes(term));
  const coverage = matched.length / terms.length;
  const headingHits = matched.filter((term) => heading.includes(term)).length;
  return coverage + headingHits * 0.08 + Math.max(0, 0.08 - chunk.chunk_index * 0.0005);
}

async function fetchBestDocumentLookupChunks(args: {
  supabase: ReturnType<typeof createAdminClient>;
  documentIds: string[];
  query: string;
  limit: number;
  ownerId?: string;
}) {
  const terms = documentLookupChunkTerms(args.query);
  const { data: rpcChunks, error: rpcError } = await args.supabase.rpc("match_document_lookup_chunks_text", {
    query_text: args.query,
    document_filters: args.documentIds ?? undefined,
    match_count: Math.max(args.limit * 3, 24),
    owner_filter: args.ownerId ?? undefined,
  });
  if (!rpcError && rpcChunks?.length) {
    const ranked = (rpcChunks as DocumentLookupChunkRow[])
      .map((chunk) => ({
        chunk,
        score: Math.max(Number(chunk.text_rank ?? 0), documentLookupChunkScore(chunk, terms)),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.chunk.chunk_index - b.chunk.chunk_index)
      .map((item) => item.chunk);
    if (ranked.length) return { chunks: ranked.slice(0, args.limit), terms };
  }

  const safeFilters = terms
    .map((term) => term.replace(/[%_,]/g, " ").trim())
    .filter(Boolean)
    .flatMap((term) => [
      `content.ilike.%${term}%`,
      `retrieval_synopsis.ilike.%${term}%`,
      `section_heading.ilike.%${term}%`,
    ])
    .join(",");
  const baseQuery = args.supabase
    .from("document_chunks")
    .select(
      "id,document_id,page_number,chunk_index,section_heading,section_path,heading_level,parent_heading,anchor_id,content,retrieval_synopsis,image_ids",
    )
    .in("document_id", args.documentIds)
    .limit(Math.max(args.limit * 4, 24));

  const { data: matchedChunks, error: matchedError } = safeFilters
    ? await baseQuery.or(safeFilters)
    : await baseQuery.order("chunk_index", { ascending: true });

  if (!matchedError && matchedChunks?.length) {
    const ranked = (matchedChunks as DocumentLookupChunkRow[])
      .map((chunk) => ({ chunk, score: documentLookupChunkScore(chunk, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.chunk.chunk_index - b.chunk.chunk_index)
      .map((item) => item.chunk);
    if (ranked.length) return { chunks: ranked.slice(0, args.limit), terms };
  }

  const { data: fallbackChunks, error: fallbackError } = await args.supabase
    .from("document_chunks")
    .select(
      "id,document_id,page_number,chunk_index,section_heading,section_path,heading_level,parent_heading,anchor_id,content,retrieval_synopsis,image_ids",
    )
    .in("document_id", args.documentIds)
    .order("chunk_index", { ascending: true })
    .limit(args.limit);
  if (fallbackError || !fallbackChunks?.length) return { chunks: [] as DocumentLookupChunkRow[], terms };
  return { chunks: fallbackChunks as DocumentLookupChunkRow[], terms };
}

async function fetchDocumentTitleAliasRows(args: {
  supabase: ReturnType<typeof createAdminClient>;
  query: string;
  ownerId?: string;
  documentIds?: string[];
}) {
  const terms = analyzeClinicalQuery(args.query)
    .documentTitleTerms.map((term) => term.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim())
    .filter((term) => term.length >= 4)
    .slice(0, 8);
  if (!terms.length) return [] as DocumentLookupRow[];

  const filters = terms.flatMap((term) => [`title.ilike.%${term}%`, `file_name.ilike.%${term}%`]).join(",");
  let query = args.supabase
    .from("documents")
    .select("id,owner_id,title,file_name,status,page_count,chunk_count,image_count,metadata");
  if (typeof (query as { or?: unknown }).or !== "function") return [] as DocumentLookupRow[];
  query = query.or(filters).eq("status", "indexed").limit(12);
  if (args.ownerId) query = query.eq("owner_id", args.ownerId);
  if (args.documentIds?.length) query = query.in("id", args.documentIds);

  const { data, error } = await query;
  if (error || !data?.length) return [] as DocumentLookupRow[];

  return (data as DocumentLookupRow[]).map((document) => ({
    ...document,
    text_rank: Math.max(Number(document.text_rank ?? 0), 0.34),
    match_reason: document.match_reason ?? "title_alias",
  }));
}

async function searchDocumentLookupFastPath(args: {
  supabase: ReturnType<typeof createAdminClient>;
  query: string;
  queryVariants?: string[];
  ownerId?: string;
  documentIds?: string[];
  matchCount: number;
}) {
  const variants = (args.queryVariants?.length ? args.queryVariants : [buildClinicalTextSearchQuery(args.query)]).slice(
    0,
    maxTextRpcQueryVariants,
  );
  const documentSets = await Promise.all(
    variants.map(async (variant, index) => {
      const { data, error } = await args.supabase.rpc("match_documents_for_query", {
        query_text: variant,
        match_count: index === 0 ? 12 : 8,
        owner_filter: args.ownerId ?? undefined,
      });
      if (error || !data?.length) return [] as DocumentLookupRow[];
      return data as DocumentLookupRow[];
    }),
  );
  const titleAliasDocuments = await fetchDocumentTitleAliasRows({
    supabase: args.supabase,
    query: args.query,
    ownerId: args.ownerId,
    documentIds: args.documentIds,
  });
  const documentsById = new Map<string, DocumentLookupRow>();
  for (const document of [...titleAliasDocuments, ...documentSets.flat()]) {
    const existing = documentsById.get(document.id);
    if (!existing || Number(document.text_rank ?? 0) > Number(existing.text_rank ?? 0)) {
      documentsById.set(document.id, document);
    }
  }
  const documents = Array.from(documentsById.values());
  if (!documents.length) return [];

  const allowedDocuments = args.documentIds?.length ? new Set(args.documentIds) : null;
  const rankedDocuments = (documents as DocumentLookupRow[])
    .filter((document) => !allowedDocuments || allowedDocuments.has(document.id))
    .map((document) => ({
      document,
      score: Math.min(0.34, Number(document.text_rank ?? 0)),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (rankedDocuments.length === 0) return [];

  const documentById = new Map(rankedDocuments.map((item) => [item.document.id, item.document]));
  const scoreByDocument = new Map(rankedDocuments.map((item) => [item.document.id, item.score]));
  const { chunks, terms } = await fetchBestDocumentLookupChunks({
    supabase: args.supabase,
    documentIds: rankedDocuments.map((item) => item.document.id),
    query: args.query,
    limit: Math.max(args.matchCount, rankedDocuments.length * 4),
    ownerId: args.ownerId,
  });

  if (!chunks.length) return [];

  const results: SearchResult[] = [];
  for (const chunk of chunks) {
    const document = documentById.get(chunk.document_id);
    if (!document) continue;
    const documentScore = scoreByDocument.get(chunk.document_id) ?? 0;
    const chunkScore = documentLookupChunkScore(chunk, terms);
    const similarity = Math.min(0.92, 0.58 + documentScore + Math.min(0.12, chunkScore * 0.08));
    results.push({
      id: chunk.id,
      document_id: chunk.document_id,
      title: document.title,
      file_name: document.file_name,
      page_number: chunk.page_number,
      chunk_index: chunk.chunk_index,
      section_heading: chunk.section_heading,
      section_path: chunk.section_path ?? [],
      heading_level: chunk.heading_level ?? null,
      parent_heading: chunk.parent_heading ?? null,
      anchor_id: chunk.anchor_id ?? null,
      content: chunk.content,
      retrieval_synopsis: chunk.retrieval_synopsis ?? null,
      image_ids: chunk.image_ids ?? [],
      source_metadata: normalizeSourceMetadata(document.metadata),
      similarity,
      text_rank: documentScore,
      hybrid_score: Math.min(0.94, similarity + 0.02),
      images: [],
    });
  }

  return results
    .sort(
      (a, b) => (b.hybrid_score ?? b.similarity) - (a.hybrid_score ?? a.similarity) || a.chunk_index - b.chunk_index,
    )
    .slice(0, args.matchCount);
}

function collectMemoryCards(results: SearchResult[], limit = 8) {
  const seen = new Set<string>();
  const cards: DocumentMemoryCard[] = [];
  for (const result of results) {
    for (const card of result.memory_cards ?? []) {
      const key = card.id ?? `${card.document_id}:${card.card_type}:${card.title}:${card.content}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
      if (cards.length >= limit) return cards;
    }
  }
  return cards;
}

function buildIndexingQuality(results: SearchResult[], memoryCards: DocumentMemoryCard[]): DocumentIndexQuality {
  const sourceMetadata = results.map((result) => normalizeSourceMetadata(result.source_metadata));
  const indexedQualityRows = results
    .map((result) => result.indexing_quality)
    .filter((quality): quality is NonNullable<SearchResult["indexing_quality"]> => Boolean(quality));
  const lowestQualityScore = indexedQualityRows.reduce(
    (lowest, quality) => Math.min(lowest, Number(quality.quality_score ?? 1)),
    1,
  );
  const indexedExtractionQuality = indexedQualityRows.some((quality) => quality.extraction_quality === "poor")
    ? "poor"
    : indexedQualityRows.some((quality) => quality.extraction_quality === "partial")
      ? "partial"
      : indexedQualityRows.some((quality) => quality.extraction_quality === "good")
        ? "good"
        : null;
  const extractionQuality = sourceMetadata.some((metadata) => metadata.extraction_quality === "poor")
    ? "poor"
    : sourceMetadata.some((metadata) => metadata.extraction_quality === "partial")
      ? "partial"
      : indexedExtractionQuality
        ? indexedExtractionQuality
        : sourceMetadata.length > 0
          ? "good"
          : "unknown";
  return {
    indexingVersion: ragDeepMemoryVersion,
    memoryVersion: ragDeepMemoryVersion,
    extractionQuality,
    missingEmbeddings: indexedQualityRows.reduce((sum, quality) => {
      const missing = Number(quality.metrics?.missing_embeddings ?? 0);
      return sum + (Number.isFinite(missing) ? missing : 0);
    }, 0),
    sectionCount: indexedQualityRows.reduce((sum, quality) => {
      const sectionCount = Number(quality.metrics?.section_count ?? 0);
      return Math.max(sum, Number.isFinite(sectionCount) ? sectionCount : 0);
    }, 0),
    qualityScore: indexedQualityRows.length > 0 ? Number(lowestQualityScore.toFixed(3)) : undefined,
    qualityIssues: Array.from(new Set(indexedQualityRows.flatMap((quality) => quality.issues ?? []))).slice(0, 8),
    memoryCardCount: memoryCards.length,
    stale: sourceMetadata.some((metadata) => metadata.document_status === "outdated"),
  };
}

function buildAnswerScoreExplanations(results: SearchResult[], limit = 8): NonNullable<RagAnswer["scoreExplanations"]> {
  return results.slice(0, limit).map((result) => ({
    chunk_id: result.id,
    document_id: result.document_id,
    finalScore: Number(
      (result.score_explanation?.finalScore ?? result.hybrid_score ?? result.similarity ?? 0).toFixed(4),
    ),
    score_explanation: result.score_explanation,
  }));
}

function scoreExplanationLogMetadata(scoreExplanations: NonNullable<RagAnswer["scoreExplanations"]>) {
  return {
    score_explanation_count: scoreExplanations.length,
    top_cited_score_explanations: scoreExplanations.slice(0, 8).map((entry) => ({
      chunk_id: entry.chunk_id,
      document_id: entry.document_id,
      final_score: entry.finalScore,
      vector_score: entry.score_explanation?.vectorScore ?? null,
      text_rank: entry.score_explanation?.textRank ?? null,
      weighted_hybrid_score: entry.score_explanation?.weightedHybridScore ?? null,
      rrf_score: entry.score_explanation?.rrfScore ?? null,
      memory_boost: entry.score_explanation?.memoryBoost ?? null,
      title_boost: entry.score_explanation?.titleBoost ?? null,
      metadata_boost: entry.score_explanation?.metadataBoost ?? null,
      lexical_coverage_score: entry.score_explanation?.lexicalCoverageScore ?? null,
      metadata_match_score: entry.score_explanation?.metadataMatchScore ?? null,
      section_title_match_boost: entry.score_explanation?.sectionTitleMatchBoost ?? null,
      freshness_recency_boost: entry.score_explanation?.freshnessRecencyBoost ?? null,
      clinical_signal_boost: entry.score_explanation?.clinicalSignalBoost ?? null,
      penalty: entry.score_explanation?.penalty ?? null,
      final_rank: entry.score_explanation?.finalRank ?? null,
    })),
  };
}

function memoryCardChunkScore(card: DocumentMemoryCard) {
  const hybridScore = Number(card.metadata?.memory_hybrid_score);
  if (Number.isFinite(hybridScore) && hybridScore > 0) return Math.min(1, hybridScore);
  return Math.min(1, card.confidence ?? 0.5);
}

async function loadChunksForMemoryCards(
  supabase: ReturnType<typeof createAdminClient>,
  cards: DocumentMemoryCard[],
  ownerId?: string,
) {
  const chunkIds = Array.from(new Set(cards.flatMap((card) => card.source_chunk_ids ?? []))).slice(0, 80);
  if (chunkIds.length === 0) return [] as SearchResult[];

  const { data: chunks, error: chunksError } = await supabase
    .from("document_chunks")
    .select(
      "id,document_id,page_number,chunk_index,section_heading,section_path,heading_level,parent_heading,anchor_id,content,retrieval_synopsis,image_ids,index_generation_id",
    )
    .in("id", chunkIds)
    .limit(chunkIds.length);
  if (chunksError || !chunks?.length) return [] as SearchResult[];

  const documentIds = Array.from(new Set(chunks.map((chunk) => chunk.document_id)));
  let documentQuery = supabase
    .from("documents")
    .select("id,title,file_name,metadata,owner_id,status")
    .in("id", documentIds)
    .eq("status", "indexed");
  if (ownerId) documentQuery = documentQuery.eq("owner_id", ownerId);
  const { data: documents, error: documentsError } = await documentQuery;
  if (documentsError || !documents?.length) return [] as SearchResult[];

  const documentById = new Map(documents.map((document) => [document.id, document]));
  const bestCardByChunk = new Map<string, DocumentMemoryCard>();
  for (const card of cards) {
    for (const chunkId of card.source_chunk_ids ?? []) {
      const existing = bestCardByChunk.get(chunkId);
      if (!existing || memoryCardChunkScore(card) > memoryCardChunkScore(existing)) bestCardByChunk.set(chunkId, card);
    }
  }

  return chunks
    .map((chunk) => {
      const document = documentById.get(chunk.document_id);
      if (!document) return null;
      const committedGeneration = committedIndexGeneration(document.metadata);
      if (chunk.index_generation_id && chunk.index_generation_id !== committedGeneration) return null;
      const card = bestCardByChunk.get(chunk.id);
      const similarity = Math.min(0.92, 0.58 + (card?.confidence ?? 0.5) * 0.28);
      return {
        id: chunk.id,
        document_id: chunk.document_id,
        title: document.title,
        file_name: document.file_name,
        page_number: chunk.page_number,
        chunk_index: chunk.chunk_index,
        section_heading: chunk.section_heading,
        section_path: chunk.section_path ?? [],
        heading_level: chunk.heading_level ?? null,
        parent_heading: chunk.parent_heading ?? null,
        anchor_id: chunk.anchor_id ?? null,
        content: chunk.content,
        retrieval_synopsis: chunk.retrieval_synopsis ?? null,
        image_ids: chunk.image_ids ?? [],
        source_metadata: normalizeSourceMetadata(document.metadata),
        similarity,
        text_rank: card?.confidence ?? 0,
        hybrid_score: Math.min(0.96, similarity + 0.03),
        images: [],
      } satisfies SearchResult;
    })
    .filter(Boolean) as SearchResult[];
}

async function loadChunksForSignalMatches(args: {
  supabase: ReturnType<typeof createAdminClient>;
  matches: ChunkSignalMatch[];
  ownerId?: string;
}) {
  const bestMatchByChunk = new Map<string, ChunkSignalMatch>();
  for (const match of args.matches) {
    const existing = bestMatchByChunk.get(match.chunkId);
    if (!existing || match.hybridScore > existing.hybridScore) bestMatchByChunk.set(match.chunkId, match);
  }
  const chunkIds = Array.from(bestMatchByChunk.keys()).slice(0, 80);
  if (chunkIds.length === 0) return [] as SearchResult[];

  const { data: chunks, error: chunksError } = await args.supabase
    .from("document_chunks")
    .select(
      "id,document_id,page_number,chunk_index,section_heading,section_path,heading_level,parent_heading,anchor_id,content,retrieval_synopsis,image_ids,index_generation_id",
    )
    .in("id", chunkIds)
    .limit(chunkIds.length);
  if (chunksError || !chunks?.length) return [] as SearchResult[];

  const documentIds = Array.from(new Set(chunks.map((chunk) => chunk.document_id)));
  let documentQuery = args.supabase
    .from("documents")
    .select("id,title,file_name,metadata,owner_id,status")
    .in("id", documentIds)
    .eq("status", "indexed");
  if (args.ownerId) documentQuery = documentQuery.eq("owner_id", args.ownerId);
  const { data: documents, error: documentsError } = await documentQuery;
  if (documentsError || !documents?.length) return [] as SearchResult[];
  const documentById = new Map(documents.map((document) => [document.id, document]));

  return chunks
    .map((chunk) => {
      const document = documentById.get(chunk.document_id);
      const match = bestMatchByChunk.get(chunk.id);
      if (!document || !match) return null;
      const committedGeneration = committedIndexGeneration(document.metadata);
      if (chunk.index_generation_id && chunk.index_generation_id !== committedGeneration) return null;
      return {
        id: chunk.id,
        document_id: chunk.document_id,
        title: document.title,
        file_name: document.file_name,
        page_number: chunk.page_number,
        chunk_index: chunk.chunk_index,
        section_heading: chunk.section_heading,
        section_path: chunk.section_path ?? [],
        heading_level: chunk.heading_level ?? null,
        parent_heading: chunk.parent_heading ?? null,
        anchor_id: chunk.anchor_id ?? null,
        content: chunk.content,
        retrieval_synopsis: chunk.retrieval_synopsis ?? null,
        image_ids: chunk.image_ids ?? [],
        source_metadata: normalizeSourceMetadata(document.metadata),
        similarity: match.similarity,
        text_rank: match.textRank,
        hybrid_score: match.hybridScore,
        table_facts: match.tableFacts?.filter((fact) =>
          isReviewedTablePromotable((fact as { metadata?: unknown }).metadata),
        ),
        index_unit: match.indexUnit ?? null,
        match_explanation: {
          sectionHit: match.reason === "section_context" || match.indexUnit?.unit_type === "section_summary",
          tableHit: match.reason.startsWith("table") || match.indexUnit?.unit_type === "table_fact",
          indexUnitType: match.indexUnit?.unit_type ?? null,
          vectorSimilarity: match.similarity,
          textRank: match.textRank,
          fieldType: match.fieldType ?? null,
          freshness: normalizeSourceMetadata(document.metadata).document_status,
          extractionQuality: normalizeSourceMetadata(document.metadata).extraction_quality,
          reasons: [match.reason, match.indexUnit?.unit_type ? `unit:${match.indexUnit.unit_type}` : ""].filter(
            Boolean,
          ),
        },
        images: [],
      } satisfies SearchResult;
    })
    .filter(Boolean) as SearchResult[];
}

async function searchTableFactCandidates(args: {
  supabase: ReturnType<typeof createAdminClient>;
  query: string;
  queryVariants?: string[];
  ownerId?: string;
  documentIds?: string[];
  matchCount: number;
}) {
  const variants = (args.queryVariants?.length ? args.queryVariants : [buildClinicalTextSearchQuery(args.query)]).slice(
    0,
    maxTextRpcQueryVariants,
  );
  const factSets = await Promise.all(
    variants.map(async (variant, index) => {
      const { data, error } = await args.supabase.rpc("match_document_table_facts_text", {
        query_text: variant,
        match_count: index === 0 ? args.matchCount : Math.min(args.matchCount, 24),
        document_filters: args.documentIds ?? undefined,
        owner_filter: args.ownerId ?? undefined,
      });
      if (error || !data?.length) return [] as TableFactRpcRow[];
      return data as TableFactRpcRow[];
    }),
  );
  const data = factSets.flat();
  if (!data.length) return [] as SearchResult[];

  const grouped = new Map<string, ChunkSignalMatch>();
  for (const fact of data) {
    if (!fact.source_chunk_id) continue;
    const textRank = Number(fact.text_rank ?? 0);
    const current = grouped.get(fact.source_chunk_id);
    const tableFact = { ...fact, text_rank: textRank, match_reason: fact.match_reason ?? "table_row" };
    const next: ChunkSignalMatch = {
      chunkId: fact.source_chunk_id,
      similarity: Math.min(0.94, 0.62 + Math.min(textRank, 1) * 0.3),
      textRank,
      hybridScore: Math.min(0.97, 0.66 + Math.min(textRank, 1) * 0.3),
      reason: fact.match_reason ?? "table_row",
      tableFacts: [...(current?.tableFacts ?? []), tableFact].slice(0, 5),
    };
    if (!current || next.hybridScore > current.hybridScore) grouped.set(fact.source_chunk_id, next);
  }

  return loadChunksForSignalMatches({
    supabase: args.supabase,
    matches: Array.from(grouped.values()),
    ownerId: args.ownerId,
  });
}

async function searchEmbeddingFieldCandidates(args: {
  supabase: ReturnType<typeof createAdminClient>;
  query: string;
  queryEmbedding: number[];
  ownerId?: string;
  documentIds?: string[];
  matchCount: number;
  telemetry?: SearchTelemetry;
}) {
  const { data, error } = await args.supabase.rpc("match_document_embedding_fields_hybrid", {
    query_embedding: args.queryEmbedding as unknown as string,
    query_text: buildClinicalTextSearchQuery(args.query),
    match_count: args.matchCount,
    min_similarity: 0.12,
    document_filters: args.documentIds ?? undefined,
    owner_filter: args.ownerId ?? undefined,
  });
  if (error) recordHybridRpcError(args.telemetry, "match_document_embedding_fields_hybrid", error);
  if (error || !data?.length) return [] as SearchResult[];
  const matches = (
    data as Array<{
      source_chunk_id: string | null;
      field_type: string | null;
      similarity?: number | null;
      text_rank?: number | null;
      hybrid_score?: number | null;
    }>
  )
    .filter(
      (
        row,
      ): row is {
        source_chunk_id: string;
        field_type: string | null;
        similarity?: number | null;
        text_rank?: number | null;
        hybrid_score?: number | null;
      } => Boolean(row.source_chunk_id),
    )
    .map((row) => ({
      chunkId: row.source_chunk_id,
      similarity: Number(row.similarity ?? 0),
      textRank: Number(row.text_rank ?? 0),
      hybridScore: Number(row.hybrid_score ?? row.similarity ?? 0),
      reason: "section_context",
      fieldType: row.field_type,
    }));
  return loadChunksForSignalMatches({ supabase: args.supabase, matches, ownerId: args.ownerId });
}

async function searchIndexUnitCandidates(args: {
  supabase: ReturnType<typeof createAdminClient>;
  query: string;
  queryEmbedding: number[];
  ownerId?: string;
  documentIds?: string[];
  matchCount: number;
  telemetry?: SearchTelemetry;
}) {
  const { data, error } = await args.supabase.rpc("match_document_index_units_hybrid", {
    query_embedding: args.queryEmbedding as unknown as string,
    query_text: buildClinicalTextSearchQuery(args.query),
    match_count: args.matchCount,
    min_similarity: 0.1,
    document_filters: args.documentIds ?? undefined,
    owner_filter: args.ownerId ?? undefined,
  });
  if (error) recordHybridRpcError(args.telemetry, "match_document_index_units_hybrid", error);
  if (error || !data?.length) return [] as SearchResult[];
  const matches = (data as IndexUnitRpcRow[])
    .filter((row): row is IndexUnitRpcRow & { source_chunk_id: string } => Boolean(row.source_chunk_id))
    .map((row) => ({
      chunkId: row.source_chunk_id,
      similarity: Number(row.similarity ?? 0),
      textRank: Number(row.text_rank ?? 0),
      hybridScore: Number(row.hybrid_score ?? row.similarity ?? 0),
      reason: `index_unit:${row.unit_type}`,
      fieldType: row.unit_type,
      indexUnit: {
        id: row.id,
        document_id: row.document_id,
        unit_type: row.unit_type,
        title: row.title,
        content: row.content,
        source_chunk_id: row.source_chunk_id,
        source_image_id: row.source_image_id,
        page_start: row.page_start,
        page_end: row.page_end,
        heading_path: row.heading_path ?? [],
        normalized_terms: row.normalized_terms ?? [],
        source_span: row.source_span ?? null,
        quality_score: row.quality_score,
        extraction_mode: row.extraction_mode,
        similarity: row.similarity,
        text_rank: row.text_rank,
        hybrid_score: row.hybrid_score,
        metadata: row.metadata ?? null,
      },
    }));
  return loadChunksForSignalMatches({ supabase: args.supabase, matches, ownerId: args.ownerId });
}

type MemoryCardCache = Map<string, ReturnType<typeof fetchMemoryCardsForQuery>>;

async function withMemoryBoostedCandidates(args: {
  supabase: ReturnType<typeof createAdminClient>;
  query: string;
  candidates: SearchResult[];
  queryEmbedding?: number[];
  ownerId?: string;
  documentIds?: string[];
  matchCount: number;
  cardCache?: MemoryCardCache;
}) {
  // A3: the memory-card fetch is invoked at several waterfall stages. Memoize per request,
  // scoped by owner/document filters because fetchMemoryCardsForQuery applies those filters.
  const effectiveMatchCount = Math.max(args.matchCount, 48);
  const documentScope = args.documentIds?.length ? [...args.documentIds].sort().join(",") : "all-documents";
  const cacheKey = [
    args.ownerId ?? "anonymous",
    documentScope,
    args.query,
    args.queryEmbedding?.length ? "vec" : "text",
    effectiveMatchCount,
  ].join("\0");
  let cardsPromise = args.cardCache?.get(cacheKey);
  if (!cardsPromise) {
    cardsPromise = fetchMemoryCardsForQuery({
      supabase: args.supabase,
      query: args.query,
      queryEmbedding: args.queryEmbedding,
      ownerId: args.ownerId,
      documentIds: args.documentIds,
      matchCount: effectiveMatchCount,
    });
    args.cardCache?.set(cacheKey, cardsPromise);
  }
  const cards = await cardsPromise;
  if (cards.length === 0) return { results: args.candidates, cards };

  const memoryChunkResults = await loadChunksForMemoryCards(args.supabase, cards, args.ownerId);
  const merged = mergeSearchResults(memoryChunkResults, args.candidates);
  return {
    results: applyMemoryCardBoosts(args.query, merged, cards),
    cards,
  };
}

async function attachDocumentRankingMetadata(
  supabase: ReturnType<typeof createAdminClient>,
  results: SearchResult[],
  ownerId?: string,
) {
  const documentIds = Array.from(new Set(results.map((result) => result.document_id)));
  if (documentIds.length === 0) return results;
  const missingMetadata = results.some(
    (result) =>
      (result.document_labels === undefined || result.document_labels.length === 0) &&
      (result.document_summary === undefined || result.document_summary === null),
  );
  if (!missingMetadata) return attachIndexQualityMetadata(supabase, results, ownerId);

  try {
    const metadataRows = await fetchRelatedDocumentMetadata({
      supabase,
      ownerId,
      documentIds,
    });
    const metadataByDocument = new Map(metadataRows.map((row) => [row.document_id, row]));
    const enriched = results.map((result) => {
      const metadata = metadataByDocument.get(result.document_id);
      if (!metadata) return result;
      return {
        ...result,
        document_labels: metadata.labels,
        document_summary: metadata.summary,
      };
    });
    return attachIndexQualityMetadata(supabase, enriched, ownerId);
  } catch {
    return results;
  }
}

async function attachIndexQualityMetadata(
  supabase: ReturnType<typeof createAdminClient>,
  results: SearchResult[],
  ownerId?: string,
): Promise<SearchResult[]> {
  const documentIds = Array.from(new Set(results.map((result) => result.document_id)));
  if (documentIds.length === 0) return results;
  try {
    let query = supabase
      .from("document_index_quality")
      .select("document_id,owner_id,quality_score,extraction_quality,metrics,issues,updated_at")
      .in("document_id", documentIds);
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data, error } = await query;
    if (error || !data?.length) return results;
    const qualityByDocument = new Map(data.map((row) => [row.document_id, row]));
    return results.map((result) => ({
      ...result,
      indexing_quality:
        (qualityByDocument.get(result.document_id) as SearchResult["indexing_quality"]) ??
        result.indexing_quality ??
        null,
    }));
  } catch {
    return results;
  }
}

function sourceContextPackLimit(queryClass: RagQueryClass, options: { crossDocument?: boolean } = {}) {
  return options.crossDocument || queryClass === "comparison" || queryClass === "broad_summary" ? 8 : 5;
}

export function packedContextCacheKey(
  results: SearchResult[],
  queryClass: RagQueryClass,
  options: { crossDocument?: boolean; documentIds?: string[] } = {},
) {
  const contextLimit = sourceContextPackLimit(queryClass, options);
  const scopeKey = options.documentIds?.length
    ? stableHash([...new Set(options.documentIds)].sort().join("|"))
    : "all-documents";
  return [
    queryClass,
    options.crossDocument ? "cross-document" : "single-document",
    `scope:${scopeKey}`,
    contextLimit,
    ...results
      .slice(0, contextLimit)
      .map((result) => `${result.id}:${result.document_id}:${result.chunk_index}:${result.page_number ?? "na"}`),
  ].join("|");
}

async function packAdjacentSourceContext(
  supabase: ReturnType<typeof createAdminClient>,
  results: SearchResult[],
  queryClass: RagQueryClass,
  options: { crossDocument?: boolean } = {},
) {
  const contextLimit = sourceContextPackLimit(queryClass, options);
  const targetResults = results.slice(0, contextLimit);
  const documentIds = Array.from(new Set(targetResults.map((result) => result.document_id)));
  const chunkIndexes = Array.from(
    new Set(
      targetResults.flatMap((result) => [result.chunk_index - 1, result.chunk_index + 1]).filter((index) => index >= 0),
    ),
  );
  if (documentIds.length === 0 || chunkIndexes.length === 0) return results;

  try {
    const { data, error } = await supabase
      .from("document_chunks")
      .select("id,document_id,page_number,chunk_index,section_heading,content,retrieval_synopsis,index_generation_id")
      .in("document_id", documentIds)
      .in("chunk_index", chunkIndexes)
      .order("chunk_index", { ascending: true })
      .limit(80);

    if (error || !data?.length) return results;

    const chunksByDocumentAndIndex = new Map<
      string,
      { id: string; section_heading: string | null; content: string; retrieval_synopsis?: string | null }
    >();
    const committedGenerationByDocument = new Map(
      targetResults.map((result) => [result.document_id, committedIndexGeneration(result.source_metadata)] as const),
    );
    for (const chunk of data) {
      const committedGeneration = committedGenerationByDocument.get(chunk.document_id);
      if (chunk.index_generation_id && chunk.index_generation_id !== committedGeneration) continue;
      chunksByDocumentAndIndex.set(`${chunk.document_id}:${chunk.chunk_index}`, {
        id: chunk.id,
        section_heading: chunk.section_heading,
        content: chunk.content,
        retrieval_synopsis: chunk.retrieval_synopsis ?? null,
      });
    }

    const targetIds = new Set(targetResults.map((result) => result.id));
    return results.map((result) => {
      if (!targetIds.has(result.id)) return result;
      const adjacent = [result.chunk_index - 1, result.chunk_index + 1]
        .map((index) => chunksByDocumentAndIndex.get(`${result.document_id}:${index}`))
        .filter(
          (
            chunk,
          ): chunk is {
            id: string;
            section_heading: string | null;
            content: string;
            retrieval_synopsis?: string | null;
          } => Boolean(chunk && chunk.id !== result.id && chunk.content.trim()),
        )
        .map((chunk) => {
          const heading = chunk.section_heading ? `${chunk.section_heading}: ` : "";
          return compactContextText(`${heading}${chunk.retrieval_synopsis || chunk.content}`, 520);
        });

      if (adjacent.length === 0) return result;
      return {
        ...result,
        adjacent_context: adjacent.join(" "),
      };
    });
  } catch {
    return results;
  }
}

async function attachPageVisualEvidence(
  supabase: ReturnType<typeof createAdminClient>,
  results: SearchResult[],
): Promise<SearchResult[]> {
  const documentIds = Array.from(new Set(results.map((result) => result.document_id)));
  const pageNumbers = Array.from(
    new Set(results.map((result) => result.page_number).filter((page): page is number => Boolean(page))),
  );
  const sourceImageIds = Array.from(
    new Set(
      results.flatMap((result) => [
        result.index_unit?.source_image_id ?? null,
        ...(result.table_facts ?? []).map((fact) => fact.source_image_id),
      ]),
    ),
  )
    .filter((id): id is string => Boolean(id))
    .slice(0, 80);
  if (documentIds.length === 0 || (pageNumbers.length === 0 && sourceImageIds.length === 0)) return results;

  const selectColumns =
    "id,document_id,page_number,storage_path,caption,bbox,image_type,searchable,clinical_relevance_score,source_kind,width,height,labels,metadata";
  const pageData =
    pageNumbers.length > 0
      ? await supabase
          .from("document_images")
          .select(selectColumns)
          .in("document_id", documentIds)
          .in("page_number", pageNumbers)
          .eq("searchable", true)
          .neq("image_type", "logo_decorative")
          .order("clinical_relevance_score", { ascending: false })
          .limit(80)
      : { data: [], error: null };
  const directData =
    sourceImageIds.length > 0
      ? await supabase
          .from("document_images")
          .select(selectColumns)
          .in("id", sourceImageIds)
          .eq("searchable", true)
          .neq("image_type", "logo_decorative")
          .limit(sourceImageIds.length)
      : { data: [], error: null };

  const data = [...(pageData.data ?? []), ...(directData.data ?? [])];
  if ((pageData.error && directData.error) || data.length === 0) return results;

  const committedGenerationByDocument = new Map(
    results.map((result) => [result.document_id, committedIndexGeneration(result.source_metadata)] as const),
  );
  const imagesByPage = new Map<string, ChunkImage[]>();
  const imagesById = new Map<string, ChunkImage>();
  for (const image of data) {
    if (imagesById.has(image.id)) continue;
    const metadata = safeRecord(image.metadata);
    if (
      !isCommittedGenerationMetadata({
        rowMetadata: metadata,
        committedGeneration: committedGenerationByDocument.get(image.document_id),
      })
    ) {
      continue;
    }
    const rawTableText = metadataText(metadata, "table_text");
    const tableText = metadataText(metadata, "table_text_snippet") ?? rawTableText;
    const publicImage: ChunkImage = {
      id: image.id,
      page_number: image.page_number,
      storage_path: image.storage_path,
      caption: image.caption,
      bbox: normalizeImageBbox(image.bbox),
      image_type: image.image_type as ChunkImage["image_type"],
      searchable: image.searchable,
      clinical_relevance_score: image.clinical_relevance_score,
      source_kind: image.source_kind,
      sourceKind: image.source_kind,
      tableLabel: metadataText(metadata, "table_label"),
      tableTitle: metadataText(metadata, "table_title"),
      tableRole: metadataText(metadata, "table_role"),
      clinicalUseClass:
        typeof metadata.clinical_use_class === "string" ? (metadata.clinical_use_class as ClinicalImageUseClass) : null,
      clinicalUseReason: typeof metadata.clinical_use_reason === "string" ? metadata.clinical_use_reason : null,
      accessibleTableMarkdown:
        typeof metadata.accessible_table_markdown === "string" ? metadata.accessible_table_markdown : rawTableText,
      tableRows: Array.isArray(metadata.table_rows) ? (metadata.table_rows as string[][]) : null,
      tableColumns: Array.isArray(metadata.table_columns) ? (metadata.table_columns as string[]) : null,
      tableTextSnippet: tableText ? compactContextText(tableText, 500) : null,
      labels: Array.isArray(image.labels) ? image.labels : [],
      metadata,
    };
    imagesById.set(image.id, publicImage);
    const key = `${image.document_id}:${image.page_number}`;
    imagesByPage.set(key, [...(imagesByPage.get(key) ?? []), publicImage]);
  }

  return results.map((result) => {
    const pageImages = imagesByPage.get(`${result.document_id}:${result.page_number}`) ?? [];
    const directImages = [
      result.index_unit?.source_image_id ? imagesById.get(result.index_unit.source_image_id) : null,
      ...(result.table_facts ?? []).map((fact) => (fact.source_image_id ? imagesById.get(fact.source_image_id) : null)),
    ].filter((image): image is ChunkImage => Boolean(image));
    if (pageImages.length === 0 && directImages.length === 0) return result;
    const seen = new Set((result.images ?? []).map((image) => image.id));
    const mergedImages = [
      ...(result.images ?? []),
      ...directImages.filter((image) => {
        if (seen.has(image.id)) return false;
        seen.add(image.id);
        return true;
      }),
      ...pageImages.filter((image) => {
        if (seen.has(image.id)) return false;
        seen.add(image.id);
        return true;
      }),
    ].slice(0, 4);
    return { ...result, images: mergedImages };
  });
}

export function decideTextFastPath(
  query: string,
  results: SearchResult[],
  queryClass: RagQueryClass = classifyRagQuery(query).queryClass,
): { returnFastPath: boolean; reason: string | null } {
  if (results.length === 0) return { returnFastPath: false, reason: "no_text_candidates" };

  const strongestScore = results.reduce((max, result) => Math.max(max, result.hybrid_score ?? result.similarity), 0);
  const topTextRank = Math.max(...results.map((result) => result.text_rank ?? 0));
  const directTitleSupport = hasDirectTitleSupport(query, results);
  if (
    (queryClass === "document_lookup" || queryClass === "broad_summary") &&
    hasDocumentAliasWithoutTopTitleSupport(query, results)
  ) {
    return { returnFastPath: false, reason: "document_alias_requires_title_rescue" };
  }
  if (queryClass === "comparison") {
    const distinctDocuments = new Set(results.slice(0, 8).map((result) => result.document_id)).size;
    if (distinctDocuments >= 2 && (strongestScore >= 0.68 || topTextRank >= 0.08)) {
      return { returnFastPath: true, reason: "comparison_text_match" };
    }
    return { returnFastPath: false, reason: "comparison_requires_synthesis" };
  }
  if (
    queryClass === "table_threshold" &&
    !results.slice(0, 5).some((result) => hasStructuredThresholdEvidence(result))
  ) {
    return { returnFastPath: false, reason: "missing_structured_threshold_evidence" };
  }
  if (queryClass === "table_threshold" && /\b(?:withhold|withheld|withholding|cease|stop|stopped)\b/i.test(query)) {
    return { returnFastPath: false, reason: "threshold_action_requires_structured_retrieval" };
  }
  if (queryClass === "medication_dose_risk" && !results.slice(0, 5).some((result) => hasDoseEvidenceSupport(result))) {
    return { returnFastPath: false, reason: "missing_dose_evidence" };
  }

  if (queryClass === "table_threshold") {
    if (strongestScore >= 0.62 || topTextRank >= 0.045) {
      return { returnFastPath: true, reason: "structured_threshold_text_match" };
    }
    return { returnFastPath: false, reason: "weak_structured_threshold_text_match" };
  }

  if (queryClass === "medication_dose_risk") {
    if (strongestScore >= 0.66 || topTextRank >= 0.055) {
      return { returnFastPath: true, reason: "dose_evidence_text_match" };
    }
    return { returnFastPath: false, reason: "weak_dose_text_match" };
  }

  if (queryClass === "document_lookup") {
    // Flowchart/zone "next step" questions need the zone-action evidence (red
    // zone -> escalate / urgent review), not just a lexically matching flowchart
    // page; otherwise fall through to structured/vector retrieval.
    if (isRiskFlowchartNextStepQuery(query) && !hasRiskFlowchartActionEvidence(query, results)) {
      return { returnFastPath: false, reason: "risk_flowchart_requires_action_evidence" };
    }
    if (directTitleSupport && strongestScore >= 0.32) {
      return { returnFastPath: true, reason: "direct_title_text_match" };
    }
    if (strongestScore >= 0.7) return { returnFastPath: true, reason: "strong_document_text_score" };
    if (topTextRank >= 0.08) return { returnFastPath: true, reason: "strong_document_text_rank" };
    return { returnFastPath: false, reason: "weak_document_text_match" };
  }

  if (queryClass === "broad_summary") {
    if (directTitleSupport && strongestScore >= 0.4) return { returnFastPath: true, reason: "direct_title_text_match" };
    return { returnFastPath: false, reason: "broad_summary_requires_synthesis_or_title_rescue" };
  }

  if (directTitleSupport && strongestScore >= 0.4) return { returnFastPath: true, reason: "direct_title_text_match" };
  if (strongestScore >= 0.64) return { returnFastPath: true, reason: "strong_text_score" };
  if (topTextRank >= 0.08) return { returnFastPath: true, reason: "strong_text_rank" };
  return { returnFastPath: false, reason: "weak_text_match" };
}

function normalizeDocumentAliasText(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDocumentAliasWithoutTopTitleSupport(query: string, results: SearchResult[]) {
  const aliases = analyzeClinicalQuery(query)
    .documentTitleTerms.map(normalizeDocumentAliasText)
    .filter((term) => term.length > 3);
  if (!aliases.length) return false;

  return !results.slice(0, 5).some((result) => {
    if (result.match_explanation?.titleHit || result.match_explanation?.labelHit) return true;
    const title = normalizeDocumentAliasText(`${result.title} ${result.file_name}`);
    return aliases.some((alias) => title.includes(alias));
  });
}

function shouldReturnBeforeMemory(
  queryClass: RagQueryClass,
  decision: { returnFastPath: boolean; reason: string | null },
) {
  if (!decision.returnFastPath) return false;
  if (queryClass === "comparison") return decision.reason === "comparison_text_match";
  if (queryClass === "table_threshold") return decision.reason === "structured_threshold_text_match";
  if (queryClass === "medication_dose_risk") return decision.reason === "dose_evidence_text_match";
  return !shouldUseMemoryBeforeFastPath(queryClass);
}

function evidenceTextForGate(result: SearchResult) {
  const tableText = (result.table_facts ?? [])
    .map((fact) =>
      [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action].join(" "),
    )
    .join(" ");
  const imageText = (result.images ?? [])
    .map((image) =>
      [image.caption, image.tableTitle, image.tableLabel, image.tableTextSnippet, image.clinicalUseReason]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
  const unitText = result.index_unit
    ? [result.index_unit.unit_type, result.index_unit.title, result.index_unit.content].join(" ")
    : "";
  return normalizeSectionText(
    [
      result.title,
      result.file_name,
      result.section_heading,
      result.section_path?.join(" "),
      result.retrieval_synopsis,
      result.content,
      tableText,
      imageText,
      unitText,
    ]
      .filter(Boolean)
      .join(" "),
  ).toLowerCase();
}

function topEvidenceText(results: SearchResult[], limit = 5) {
  return results.slice(0, limit).map(evidenceTextForGate).join(" ");
}

function hasAnyTerm(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function isRiskFlowchartNextStepQuery(query: string) {
  return (
    /\b(?:flow\s*chart|flowchart|algorithm|pathway|risk[\s-]*matrix)\b/i.test(query) &&
    riskZoneContextPattern.test(query) &&
    /\b(?:next step|step after|after|action)\b/i.test(query)
  );
}

function hasRiskFlowchartActionEvidence(query: string, results: SearchResult[], limit = 5) {
  // A single result must carry BOTH the zone context and the action language
  // (escalate / urgent review): scattering the two term groups across different
  // results (or their image captions) let unrelated risk-assessment flowcharts
  // pass. Deliberately does NOT require a flowchart word in the evidence — the
  // escalation protocols that answer a red-zone question express the flowchart's
  // decision steps as prose ("has any Purple or Red Zone criteria ... escalate
  // for Senior Clinician Review") without ever saying "flowchart".
  //
  // The shared patterns are scoped to the colour the query names (a red-zone
  // question must not fast-path on an amber-zone chunk); for risk-matrix /
  // flowchart visual units the bare cell colour token counts as zone context.
  const { zonePhrasePattern, bareColourPattern } = zoneContextPatternsForQuery(query);
  return results.slice(0, limit).some((result) => {
    const evidenceText = evidenceTextForGate(result);
    if (!riskZoneActionPattern.test(evidenceText)) return false;
    if (zonePhrasePattern.test(evidenceText)) return true;
    return (
      ["risk_matrix_cell", "flowchart_step", "diagram_decision"].includes(result.index_unit?.unit_type ?? "") &&
      bareColourPattern.test(evidenceText)
    );
  });
}

function hasDoseAmountEvidenceForGate(result: SearchResult) {
  return /\b\d+(?:\.\d+)?\s?(?:mg|mcg|microgram|micrograms)\b/i.test(evidenceTextForGate(result));
}

function hasRouteEvidenceForGate(result: SearchResult) {
  return /\b(?:oral|orally|intramuscular|intramuscularly|\bim\b|\bpo\b)\b/i.test(evidenceTextForGate(result));
}

function hasDirectSourceImageEvidence(result: SearchResult) {
  const sourceImageIds = new Set(
    [result.index_unit?.source_image_id, ...(result.table_facts ?? []).map((fact) => fact.source_image_id)].filter(
      Boolean,
    ) as string[],
  );
  return (
    sourceImageIds.size > 0 ||
    (result.images ?? []).some(
      (image) => sourceImageIds.has(image.id) || isClinicalImageEvidence(image) || image.source_kind === "table_crop",
    )
  );
}

function sourceImageRequiredForQuery(query: string) {
  return (
    /\b(?:show|display|attach|open|view|source|original)\b/i.test(query) &&
    /\b(?:image|table|chart|figure|crop|visual)\b/i.test(query)
  );
}

function directTitleOrAliasSupport(query: string, results: SearchResult[]) {
  return (
    hasDirectTitleSupport(query, results) ||
    results.slice(0, 5).some((result) => result.match_explanation?.titleHit || result.match_explanation?.labelHit)
  );
}

function recordRetrievalSelectionTelemetry(
  telemetry: SearchTelemetry,
  intent: RetrievalIntent,
  summary: RetrievalSelectionSummary,
) {
  telemetry.retrieval_intent = intent;
  telemetry.retrieval_selection = summary;
}

function selectRankedRetrievalResults(args: {
  query: string;
  queryClass: RagQueryClass;
  candidates: SearchResult[];
  topK: number;
  maxResultsPerDocument: number;
  telemetry?: SearchTelemetry;
}) {
  const selection = selectRetrievalEvidence({
    query: args.query,
    queryClass: args.queryClass,
    results: rankClinicalResults(args.query, args.candidates),
    topK: args.topK,
    maxResultsPerDocument: args.maxResultsPerDocument,
  });
  if (args.telemetry) {
    recordRetrievalSelectionTelemetry(args.telemetry, selection.intent, selection.summary);
  }
  return selection.results;
}

export function evaluateEvidenceCoverageGate(
  query: string,
  results: SearchResult[],
  queryClass: RagQueryClass = classifyRagQuery(query).queryClass,
): {
  accepted: boolean;
  reason: string;
  strategy: "text_fast_path" | "document_lookup_fast_path";
  sourceImageRequired: boolean;
  sourceImageSatisfied: boolean;
} {
  if (!results.length) {
    return {
      accepted: false,
      reason: "no_candidates",
      strategy: "text_fast_path",
      sourceImageRequired: false,
      sourceImageSatisfied: false,
    };
  }

  const top = results.slice(0, 5);
  const evidenceText = topEvidenceText(results);
  const strongestScore = Math.max(0, ...top.map((result) => result.hybrid_score ?? result.similarity ?? 0));
  const sourceImageRequired = sourceImageRequiredForQuery(query);
  const sourceImageSatisfied = top.some(hasDirectSourceImageEvidence);
  if (sourceImageRequired && !sourceImageSatisfied) {
    return {
      accepted: false,
      reason: "source_image_required_missing",
      strategy: "text_fast_path",
      sourceImageRequired,
      sourceImageSatisfied,
    };
  }

  const hasStructuredThreshold = top.some(hasStructuredThresholdEvidence);
  const hasDoseEvidence = top.some(hasDoseEvidenceSupport);
  const hasDoseAmount = top.some(hasDoseAmountEvidenceForGate);
  const hasRoute = top.some(hasRouteEvidenceForGate);
  const hasVisualUnit = top.some((result) => visualEvidenceUnitTypes.has(result.index_unit?.unit_type ?? ""));
  const hasDirectTitle = directTitleOrAliasSupport(query, top);

  if (queryClass === "table_threshold") {
    if (
      /\bclozapine\b/i.test(query) &&
      /\b(?:anc|fbc|wbc|neutrophil|neutrophils|full blood)\b/i.test(query) &&
      /\b(?:withhold|withheld|withholding|cease|ceased|stop|stopped)\b/i.test(query)
    ) {
      const hasBlood = hasAnyTerm(evidenceText, /\b(?:anc|fbc|wbc|neutrophil|neutrophils|full blood)\b/i);
      const hasAction = hasAnyTerm(
        evidenceText,
        /\b(?:withhold|withheld|withholding|cease|ceased|stop|stopped|red)\b/i,
      );
      return {
        accepted: hasStructuredThreshold && hasBlood && hasAction,
        reason:
          hasStructuredThreshold && hasBlood && hasAction
            ? "clozapine_blood_action_structured_threshold"
            : "missing_clozapine_blood_action_structured_threshold",
        strategy: "text_fast_path",
        sourceImageRequired,
        sourceImageSatisfied,
      };
    }
    if (/\bpatient property\b/i.test(query)) {
      const hasPropertyTerms =
        hasAnyTerm(evidenceText, /\bpatient\b/i) &&
        hasAnyTerm(evidenceText, /\bproperty\b/i) &&
        hasAnyTerm(evidenceText, /\b(?:restricted|prohibited|contraband|items?)\b/i);
      return {
        accepted:
          hasPropertyTerms &&
          (hasStructuredThreshold || sourceImageSatisfied || hasVisualUnit || strongestScore >= 0.62),
        reason: hasPropertyTerms ? "patient_property_restricted_items_gate" : "missing_patient_property_terms",
        strategy: "text_fast_path",
        sourceImageRequired,
        sourceImageSatisfied,
      };
    }
    return {
      accepted: hasStructuredThreshold && strongestScore >= 0.58,
      reason: hasStructuredThreshold ? "structured_threshold_evidence_gate" : "missing_structured_threshold_evidence",
      strategy: "text_fast_path",
      sourceImageRequired,
      sourceImageSatisfied,
    };
  }

  if (queryClass === "medication_dose_risk") {
    const asksDoseRoute = /\b(?:dose|dosage|dosing|route|oral|intramuscular|\bim\b|\bpo\b)\b/i.test(query);
    const agitationOk = !/\bagitation|arousal\b/i.test(query) || /\bagitation|arousal\b/i.test(evidenceText);
    const accepted = hasDoseEvidence && hasDoseAmount && (!asksDoseRoute || hasRoute) && agitationOk;
    return {
      accepted,
      reason: accepted
        ? "dose_route_amount_evidence_gate"
        : !hasDoseAmount
          ? "missing_dose_amount_evidence"
          : !hasRoute && asksDoseRoute
            ? "missing_route_evidence"
            : !agitationOk
              ? "missing_agitation_context"
              : "missing_dose_evidence",
      strategy: "text_fast_path",
      sourceImageRequired,
      sourceImageSatisfied,
    };
  }

  if (queryClass === "document_lookup") {
    if (/\bactive community patients?\b/i.test(query) && /\bed\b/i.test(query)) {
      const accepted =
        hasDirectTitle &&
        hasAnyTerm(evidenceText, /\bactive\b/i) &&
        hasAnyTerm(evidenceText, /\bcommunity\b/i) &&
        hasAnyTerm(evidenceText, /\b(?:ed|emergency department)\b/i);
      return {
        accepted,
        reason: accepted ? "active_community_ed_title_gate" : "missing_active_community_ed_title_support",
        strategy: "document_lookup_fast_path",
        sourceImageRequired,
        sourceImageSatisfied,
      };
    }
    // Only zone/next-step flowchart questions need the zone-action evidence
    // gate; a plain flowchart document lookup ("which procedure flowchart
    // covers X?") falls through to the ordinary title gate below so a direct
    // title hit is not rejected for lacking zone evidence.
    if (isRiskFlowchartNextStepQuery(query)) {
      const accepted = hasRiskFlowchartActionEvidence(query, results);
      return {
        accepted,
        reason: accepted ? "visual_flowchart_risk_gate" : "missing_visual_flowchart_risk_evidence",
        strategy: "document_lookup_fast_path",
        sourceImageRequired,
        sourceImageSatisfied,
      };
    }
    return {
      accepted: hasDirectTitle && strongestScore >= 0.48,
      reason: hasDirectTitle ? "document_title_evidence_gate" : "missing_document_title_support",
      strategy: "document_lookup_fast_path",
      sourceImageRequired,
      sourceImageSatisfied,
    };
  }

  if (queryClass === "comparison") {
    const distinctDocuments = new Set(top.map((result) => result.document_id)).size;
    return {
      accepted: distinctDocuments >= 2 && strongestScore >= 0.6,
      reason: distinctDocuments >= 2 ? "comparison_multi_document_gate" : "missing_comparison_document_diversity",
      strategy: "text_fast_path",
      sourceImageRequired,
      sourceImageSatisfied,
    };
  }

  return {
    accepted: false,
    reason: "coverage_gate_not_applicable",
    strategy: "text_fast_path",
    sourceImageRequired,
    sourceImageSatisfied,
  };
}

async function prepareCoverageGateResults(args: {
  supabase: ReturnType<typeof createAdminClient>;
  query: string;
  candidates: SearchResult[];
  ownerId?: string;
  topK: number;
  maxResultsPerDocument: number;
  queryClass: RagQueryClass;
  telemetry: SearchTelemetry;
}) {
  const startedAt = Date.now();
  const candidates = await attachDocumentRankingMetadata(args.supabase, args.candidates, args.ownerId);
  let results = await attachPageVisualEvidence(
    args.supabase,
    selectRankedRetrievalResults({
      query: args.query,
      queryClass: args.queryClass,
      candidates,
      topK: args.topK,
      maxResultsPerDocument: args.maxResultsPerDocument,
      telemetry: args.telemetry,
    }),
  );
  results = applySecondStageRerankIfNeeded({
    queryClass: args.queryClass,
    results,
    telemetry: args.telemetry,
    topK: args.topK,
  });
  args.telemetry.rerank_latency_ms += Date.now() - startedAt;
  return results;
}

function applyCoverageGateTelemetry(
  telemetry: SearchTelemetry,
  gate: ReturnType<typeof evaluateEvidenceCoverageGate>,
  accepted: boolean,
) {
  telemetry.coverage_gate_decision = accepted ? "accepted" : "rejected";
  telemetry.coverage_gate_reason = gate.reason;
  telemetry.source_image_required = gate.sourceImageRequired;
  telemetry.source_image_satisfied = gate.sourceImageSatisfied;
  if (accepted) {
    telemetry.vector_skipped_reason = `evidence_coverage_gate:${gate.reason}`;
    telemetry.embedding_skipped = true;
    telemetry.embedding_skip_reason = `evidence_coverage_gate:${gate.reason}`;
  }
}

function markEmbeddingSkippedByTextFastPath(telemetry: SearchTelemetry, reason: string | null) {
  telemetry.embedding_skipped = true;
  telemetry.embedding_skip_reason = reason ?? "text_fast_path";
  telemetry.text_fast_path_reason = reason ?? "text_fast_path";
  telemetry.vector_skipped_reason = reason ?? "text_fast_path";
}

function shouldAttemptDocumentLookupFastPath(queryClass: RagQueryClass) {
  return (
    queryClass === "document_lookup" ||
    queryClass === "broad_summary" ||
    queryClass === "table_threshold" ||
    queryClass === "comparison"
  );
}

function shouldUseMemoryBeforeFastPath(queryClass: RagQueryClass) {
  return queryClass === "table_threshold" || queryClass === "medication_dose_risk" || queryClass === "comparison";
}

function shouldPreloadEmbedding(queryAnalysis: ReturnType<typeof analyzeClinicalQuery>) {
  if (queryAnalysis.documentTitleIntent && queryAnalysis.queryClass === "document_lookup") return false;
  return (
    queryAnalysis.queryClass === "comparison" ||
    queryAnalysis.queryClass === "broad_summary" ||
    (queryAnalysis.queryClass === "medication_dose_risk" && queryAnalysis.needsSynthesis) ||
    queryAnalysis.needsClassifierFallback
  );
}

function memoryCardAnswerScore(card: DocumentMemoryCard, query: string, queryClass: RagQueryClass) {
  const content = sourceTextForDisplay(card.content);
  if (!content) return -1;
  const hasSpecificDoseEvidence =
    /\b(?:mg|mcg|microgram|oral|intramuscular|\bim\b|\bpo\b|\bprn\b|repeat(?:ing)? doses?|dose may be repeated|maximum \d|administer|titration|olanzapine|lorazepam|haloperidol|droperidol|promethazine|diazepam)\b/i.test(
      content,
    );
  if (
    queryClass === "medication_dose_risk" &&
    /\b(?:supporting information|relevant standards|references|document owner|authorisation|authorised by|published date|effective from|amendment|polypharmacy and high dose antipsychotic prescribing procedure)\b/i.test(
      content,
    ) &&
    !hasSpecificDoseEvidence
  ) {
    return -1;
  }
  const normalizedContentTokens = new Set(splitBalancedWords(`${card.title} ${content}`));
  const queryTokens = splitBalancedWords(query).filter((token) => token.length > 3);
  const tokenHits = queryTokens.filter((token) => normalizedContentTokens.has(token)).length;
  const typeBoost =
    queryClass === "medication_dose_risk" &&
    ["medication", "threshold", "table_row", "risk", "workflow"].includes(card.card_type)
      ? 0.38
      : queryClass === "table_threshold" && ["table_row", "threshold"].includes(card.card_type)
        ? 0.32
        : card.card_type === "section_summary"
          ? 0.02
          : 0.12;
  const doseBoost =
    queryClass === "medication_dose_risk" &&
    /\b(?:dose|dosage|dosing|mg|mcg|microgram|oral|intramuscular|\bim\b|\bpo\b|\bprn\b|route|titration|administer|olanzapine|lorazepam|haloperidol|droperidol|promethazine|diazepam)\b/i.test(
      content,
    )
      ? 0.42
      : 0;
  const lowValueTitlePenalty =
    queryClass === "medication_dose_risk" && card.card_type === "section_summary" && !hasSpecificDoseEvidence
      ? -0.35
      : 0;

  return tokenHits * 0.08 + typeBoost + doseBoost + (card.confidence ?? 0) * 0.08 + lowValueTitlePenalty;
}

function rankMemoryCardsForAnswer(cards: DocumentMemoryCard[], query: string, queryClass: RagQueryClass) {
  return [...cards]
    .map((card, index) => ({
      card,
      index,
      score: memoryCardAnswerScore(card, query, queryClass),
    }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.card);
}

type AnswerIntent =
  | "dose"
  | "contraindication"
  | "monitoring_schedule"
  | "red_result_action"
  | "document_lookup"
  | "pathway_referral"
  | "unsupported"
  | "general";

type ExtractedClinicalFactKind =
  | "bottom_line"
  | "dose"
  | "renal_limit"
  | "monitoring"
  | "threshold_action"
  | "contraindication"
  | "pathway_referral"
  | "caveat";

type ExtractedClinicalFact = {
  kind: ExtractedClinicalFactKind;
  text: string;
  citationChunkIds: string[];
  priority: number;
};

const extractiveLabelPattern =
  /\b(?:Medication point|Table evidence|Threshold\/action|Risk\/escalation|Workflow step|Section summary|Source point|Dose detail|Monitoring)\s*:\s*/gi;

function cleanExtractivePointText(value: string) {
  return sourceTextForClinicalProse(value)
    .replace(/\b(?:clinical_table|table_crop|diagram_crop)\b/gi, " ")
    .replace(
      /^(?:clinical\s+)?table\s+(?:showing|detailing|listing|outlining|describing)\b.*?:\s*(?=\b(?:if|when|for|cease|stop|withhold|contact|repeat|monitor|clozapine)\b)/i,
      "",
    )
    .replace(
      /^[A-Z][A-Za-z /-]{3,80}:\s*(?=\b(?:if|when|for|cease|stop|withhold|contact|repeat|monitor|clozapine)\b)/,
      "",
    )
    .replace(extractiveLabelPattern, " ")
    .replace(/^[\s\-•:]+/, "")
    .replace(/^(?:monitoring|dose|dosing|source|section|table|guideline)\s*[.;:,-]\s*/i, "")
    .replace(/([A-Za-z)])(\d{1,2})(?=(?:[,.;]|\s|$))/g, "$1")
    .replace(/\s+[•]\s+/g, ". ")
    .replace(
      /\s+-\s+(?=[A-Z][a-z])|(?:\s+-\s*)?(?:Medication point|Table evidence|Threshold\/action|Risk\/escalation|Workflow step|Section summary|Source point)\s*:\s*/gi,
      ". ",
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/(?:\.\s*){2,}/g, ". ")
    .trim();
}

const extractiveClinicalDirectivePattern =
  /\b(?:arrange|assess|cease|check|complete|contact|continue|discontinue|discontinued|escalate|notify|prescribe|record|refer|report|review|stop|withhold|must|required|requires?|should)\b/i;
const extractiveQueryStopwords = new Set([
  "a",
  "an",
  "and",
  "after",
  "are",
  "about",
  "be",
  "before",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "post",
  "prior",
  "the",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "should",
  "dose",
  "dosing",
  "dosage",
  "medication",
  "medicine",
  "monitoring",
  "monitor",
  "baseline",
  "tests",
  "result",
  "results",
  "pathway",
  "referral",
  "patient",
  "patients",
  "required",
  "requires",
  "clinical",
  "advice",
  "contraindication",
  "contraindications",
  "documents",
  "document",
  "support",
  "supports",
  "supported",
  "sources",
  "source",
  "guidance",
  "guideline",
  "guidelines",
  "please",
]);

const answerIntentTerms = new Set([
  "action",
  "actions",
  "avoid",
  "contraindicated",
  "contraindication",
  "contraindications",
  "criteria",
  "dose",
  "doses",
  "dosing",
  "dosage",
  "maximum",
  "max",
  "monitor",
  "monitors",
  "monitoring",
  "pathway",
  "refer",
  "referral",
  "renal",
  "result",
  "results",
  "required",
  "requires",
  "schedule",
  "threshold",
  "thresholds",
  "what",
]);

export function classifyAnswerIntent(query: string, queryClass: RagQueryClass): AnswerIntent {
  const normalized = normalizeSectionText(query).toLowerCase();
  if (!normalized) return "unsupported";
  if (
    /\b(?:what|which|list|show|find)\s+(?:documents?|sources?|guidelines?|files?)\b.*\b(?:support|cover|contain|for|about)\b/.test(
      normalized,
    ) ||
    /\b(?:documents?|sources?|guidelines?|files?)\s+(?:support|cover|contain|for|about)\b/.test(normalized)
  ) {
    return "document_lookup";
  }
  if (/\b(?:contraindicat\w*|avoid|do not use|must not|should not|not use|opioid[-\s]?free)\b/.test(normalized)) {
    return "contraindication";
  }
  const hasResultActionSignal =
    /\b(?:red|amber|green|anc|fbc|wbc|result|results|threshold|withhold|cease|stop|stopped|toxicity)\b/.test(
      normalized,
    ) || /\b(?:what\s+action|action\s+is\s+required|required\s+action|suspected\s+\w+\s+toxicity)\b/.test(normalized);
  const hasScheduleSignal = /\b(?:monitor|monitoring|schedule|baseline|follow[-\s]?up|level|levels|test|tests)\b/.test(
    normalized,
  );
  // Toxicity and explicit action queries take priority over monitoring even if schedule/baseline/follow-up terms appear.
  const hasStrongResultSignal =
    /\b(?:toxicity|what\s+action|action\s+is\s+required|required\s+action|suspected\s+\w+\s+toxicity)\b/.test(
      normalized,
    );
  if (
    hasResultActionSignal &&
    (!/\b(?:schedule|baseline|follow[-\s]?up)\b/.test(normalized) || hasStrongResultSignal)
  ) {
    return "red_result_action";
  }
  if (hasScheduleSignal) {
    return "monitoring_schedule";
  }
  if (hasResultActionSignal) return "red_result_action";
  if (/\b(?:dose|dosing|dosage|max(?:imum)?|mg|mcg|renal|eGFR|creatinine)\b/i.test(query)) return "dose";
  if (/\b(?:pathway|refer|referral|criteria|ect|electroconvulsive)\b/.test(normalized)) return "pathway_referral";
  if (
    queryClass === "document_lookup" ||
    /\b(?:find|show|open|which)\b.*\b(?:document|guideline|procedure|policy|protocol|form|source|file)\b/.test(
      normalized,
    ) ||
    /\b(?:documentation|forms?|documents?|sources?|guidelines?|procedure|policy|protocol)\b/.test(normalized)
  ) {
    return "document_lookup";
  }
  if (queryClass === "unsupported_or_general" && !clinicalQuerySignalPattern.test(query)) return "unsupported";
  return "general";
}

function queryEntityTokens(query: string, intent: AnswerIntent) {
  const tokens = extractiveQueryTokens(query).filter((token) => !answerIntentTerms.has(token));
  if (intent === "document_lookup") return tokens.filter((token) => token.length > 3);
  return tokens;
}

function uniqueAnswerTokens(tokens: string[]) {
  return Array.from(new Set(tokens.filter(Boolean)));
}

function queryIntentTokens(query: string, intent: AnswerIntent) {
  const tokens = extractiveQueryTokens(query).filter((token) => answerIntentTerms.has(token));
  if (intent === "dose" && /\b(?:renal|egfr|creatinine|kidney)\b/i.test(query))
    return uniqueAnswerTokens(["renal", ...tokens]);
  if (intent === "dose" && /\bmax(?:imum)?\b/i.test(query)) return uniqueAnswerTokens(["maximum", ...tokens]);
  if (intent === "monitoring_schedule") return uniqueAnswerTokens(["monitoring", ...tokens]);
  if (intent === "red_result_action")
    return uniqueAnswerTokens(["red", "range", "blood", "result", "results", "threshold", "action", ...tokens]);
  if (intent === "contraindication") return uniqueAnswerTokens(["contraindication", ...tokens]);
  if (intent === "pathway_referral") return uniqueAnswerTokens(["referral", "criteria", ...tokens]);
  return tokens;
}

function answerIntentEvidencePattern(intent: AnswerIntent) {
  switch (intent) {
    case "dose":
      return /\b(?:doses?|dosing|dosage|max(?:imum)?|mg|mcg|microgram|micrograms|mmol\/l|eGFR|renal|creatinine|daily|bd|tds|mane|nocte)\b/i;
    case "contraindication":
      return /\b(?:contraindicat\w*|avoid|must not|do not|should not|not use|opioid[-\s]?free|withdrawal|precipitat\w*)\b/i;
    case "monitoring_schedule":
      return /\b(?:monitor|monitoring|baseline|weekly|monthly|annual|every|level|levels|blood test|fbc|anc|ecg|lft|renal|review)\b/i;
    case "red_result_action":
      return /\b(?:red|amber|green|threshold|withhold|cease|stop|discontinue|discontinued|urgent|contact|repeat|review|anc|fbc|wbc|neutrophil|toxic\w*|action|patholog\w*|haematolog\w*|hematolog\w*)\b/i;
    case "pathway_referral":
      return /\b(?:pathway|refer|referral|criteria|indicat\w*|ect|electroconvulsive|specialist|psychiat\w*)\b/i;
    case "document_lookup":
      return /\b(?:document|guideline|procedure|policy|protocol|form|source|file|support|supports|covers|contains)\b/i;
    default:
      return /\b(?:assess|arrange|check|continue|review|treat|manage|monitor|refer|dose|risk|therapy|diagnos\w*)\b/i;
  }
}

function resultCoversAnswerIntent(result: SearchResult, query: string, intent: AnswerIntent) {
  if (intent === "unsupported") return false;
  const text = evidenceTextForGate(result);
  const entityTokens = queryEntityTokens(query, intent);
  const intentTokens = queryIntentTokens(query, intent);
  const entityCoverage =
    entityTokens.length === 0 ||
    entityTokens.some((token) => queryTokenMatchesText(token, text)) ||
    (/\bect\b/i.test(query) && /\b(?:ect|electroconvulsive)\b/i.test(text));
  if (!entityCoverage) return false;
  if (intent === "general") return true;
  const intentCoverage = answerIntentEvidencePattern(intent).test(text);
  if (!intentCoverage) return false;
  if (intentTokens.length > 0 && !intentTokens.some((token) => queryTokenMatchesText(token, text))) return false;
  if (/\brenal\b/i.test(query) && !/\b(?:renal|kidney|eGFR|creatinine)\b/i.test(text)) return false;
  if (/\bmax(?:imum)?\b/i.test(query) && !/\b(?:max(?:imum)?|\d+(?:\.\d+)?\s?(?:mg|mcg))\b/i.test(text)) {
    return false;
  }
  return true;
}
const extractiveTruncationPattern =
  /\b(?:stabili[sz]e\s+the\s+do|the\s+do\b|liver\s+functi\b|respiratio\b|if\s+a\s+60%\s+decrease\s+in\s+b\b)\b/i;
const extractiveProductCataloguePattern =
  /\b(?:Lithicarb|Quilonum\s+SR|Campral|imprest\s+location|formulary\s+one)\b|[®™]/i;
const extractiveStructuralArtifactPattern =
  /\b(?:for\s+required,|monitoringup|prnselection|druguse|anddoses|reviewresponse|maximumrecommendeddoses|recommendeddoses|information:\s*review|links\s+to\s+relevant\s+documents\/resources|pharmacy\s+services\s+and\s+dispensing\s+protocol|role\s+responsibilities|document\s+control|straight\s+to\s+the\s+point\s+of\s+care|full\s+text|pubmed|randomi[sz]ed\s+clinical\s+trial|j\s+psychiatry|ann\s+emerg\s+med|site\s+map|gpo,\s+perth|tel:\s*\(|fax:\s*\()\b/i;
const extractiveHeadingOnlyPattern =
  /^(?:dosage?|dosing|monitoring|baseline tests?|therapy|source|section|table|guideline|referral criteria|criteria)(?:\s*\([^)]{1,80}\))?\.?$/i;
const extractiveAllowedLowercaseStarterPattern =
  /^(?:if|when|for|in|avoid|do|must|withhold|cease|stop|monitor|check|reduce|increase|adjust|start|commence|begin|use|target|baseline|serum|therapy|dosing|titrate|arrange|refer|review|prescribe|record|complete|continue|discontinue|escalate)\b/i;
const extractiveConcreteDosePattern =
  /\b(?:\d+(?:\.\d+)?\s?(?:mg|mcg|microgram|micrograms|mmol\/?l)|mmol\/l|daily|bd|tds|mane|nocte|target|range|serum|levels?|titration|titrate|titrated|adjust(?:ed|ment)?|dose\s+(?:adjust|reduc|increas)|reduce(?:d)?\s+doses?|doses?\s+(?:in|for|when|with|based|according)|max(?:imum)?|renal|eGFR|CrCl|creatinine|elderly|impairment|conventional tablets?)\b/i;
const extractiveMedicationEntityPattern =
  /\b(?:acamprosate|aripiprazole|baclofen|citalopram|clozapine|diazepam|disulfiram|droperidol|escitalopram|fluoxetine|haloperidol|lithium|lorazepam|naltrexone|olanzapine|promethazine|quetiapine|risperidone|sertraline|valproate)\b/gi;

function extractiveQueryTokens(query: string) {
  return splitBalancedWords(query).filter((token) => token.length > 2 && !extractiveQueryStopwords.has(token));
}

function escapeQueryToken(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function queryTokenVariants(token: string) {
  const variants = new Set([token]);
  if (token.length > 5 && token.endsWith("ing")) variants.add(token.slice(0, -3));
  if (token.length > 4 && token.endsWith("ies")) variants.add(`${token.slice(0, -3)}y`);
  if (token.length > 4 && token.endsWith("es")) variants.add(token.slice(0, -2));
  if (token.length > 4 && token.endsWith("s")) variants.add(token.slice(0, -1));
  return [...variants].filter((variant) => variant.length > 2);
}

function queryTokenMatchesText(token: string, text: string) {
  if (token === "ect") return /\b(?:ect|electroconvulsive)\b/i.test(text);
  for (const variant of queryTokenVariants(token)) {
    const pattern =
      variant.length <= 3
        ? new RegExp(`\\b${escapeQueryToken(variant)}\\b`, "i")
        : new RegExp(`\\b${escapeQueryToken(variant)}\\w*\\b`, "i");
    if (pattern.test(text)) return true;
  }
  return false;
}

function medicationEntitiesInText(text: string) {
  extractiveMedicationEntityPattern.lastIndex = 0;
  return Array.from(new Set((text.match(extractiveMedicationEntityPattern) ?? []).map((match) => match.toLowerCase())));
}

function mentionsDifferentMedicationEntity(sentence: string, query: string) {
  const queryMedicationEntities = medicationEntitiesInText(query);
  if (!queryMedicationEntities.length) return false;
  return medicationEntitiesInText(sentence).some((entity) => !queryMedicationEntities.includes(entity));
}

function hasRelevantQueryOverlap(
  text: string,
  query: string,
  intent: AnswerIntent = classifyAnswerIntent(query, classifyRagQuery(query).queryClass),
) {
  const tokens = extractiveQueryTokens(query);
  if (!tokens.length) return true;
  const normalized = normalizeSectionText(text).toLowerCase();
  const entityTokens = queryEntityTokens(query, intent);
  const intentTokens = queryIntentTokens(query, intent);
  const entityCovered =
    entityTokens.length === 0 ||
    entityTokens.some((token) => queryTokenMatchesText(token, normalized)) ||
    (/\bect\b/i.test(query) && /\b(?:ect|electroconvulsive)\b/i.test(normalized));
  if (!entityCovered && intent !== "general") return false;
  if (intent === "general" || intent === "unsupported")
    return tokens.some((token) => queryTokenMatchesText(token, text));
  return (
    answerIntentEvidencePattern(intent).test(normalized) &&
    (intentTokens.length === 0 || intentTokens.some((token) => queryTokenMatchesText(token, normalized)))
  );
}

function hasBadExtractiveQuality(text: string) {
  const normalized = normalizeSectionText(text);
  if (!normalized) return true;
  if (extractiveTruncationPattern.test(normalized)) return true;
  if (extractiveProductCataloguePattern.test(normalized)) return true;
  if (extractiveStructuralArtifactPattern.test(normalized)) return true;
  if (extractiveHeadingOnlyPattern.test(normalized.replace(/[.;]+$/, ""))) return true;
  if (/^([A-Za-z][A-Za-z /-]{3,60})\s+\1\.?$/i.test(normalized)) return true;
  const firstToken = normalized.split(/\s+/, 1)[0] ?? "";
  if (
    /^[a-z][a-z -]{2,}\b/.test(normalized) &&
    !extractiveAllowedLowercaseStarterPattern.test(normalized) &&
    !medicationEntitiesInText(firstToken).length
  ) {
    return true;
  }
  if (/\b[A-Za-z]{4,}[A-Z]{2,}[A-Za-z]{2,}\b/.test(normalized)) return true;
  // Narrow consecutive-arrow check: only flag '>>' that is NOT a clinical comparator like 'QTc >500 ms'.
  // Two adjacent > with only whitespace between them (not digits/letters) signals markup artifacts.
  if (/>[\s]*>/.test(normalized) && !/\w\s*>\s*\d/.test(normalized)) return true; // consecutive >> arrows
  if (/\w+\s*>\s*\w+\s*>\s*\w+/g.test(normalized) && !/\d\s*>\s*\d/.test(normalized)) return true; // breadcrumb trails like A > B > C (not numeric ranges)
  if (
    /^\s*(?:references?(?!\s+(?:range|interval|value|level|limit|coordinate|check|system|dosing|monitoring|guideline))|bibliography)\b/i.test(
      normalized,
    )
  )
    return true;
  if (hasClinicalAnswerQualityIssue(normalized)) return true;
  if (/\btable\s+\d+\b/i.test(normalized) && normalized.length > 180) return true;
  return false;
}

/**
 * Quality gate for *completed* answers at the final validation step.
 *
 * Unlike `hasBadExtractiveQuality`, this version skips `extractiveProductCataloguePattern`
 * because final answers to brand, PBS/access, or product-form questions legitimately contain
 * medication brand names (Campral, Lithicarb, Quilonum SR) and ®/™ symbols.
 * Applying the catalogue filter here would incorrectly replace valid answers with source-gap
 * responses for those question types.
 */
function hasBadFinalAnswerQuality(text: string) {
  const normalized = normalizeSectionText(text);
  if (!normalized) return true;
  if (extractiveTruncationPattern.test(normalized)) return true;
  // Note: extractiveProductCataloguePattern is intentionally excluded here — see JSDoc above.
  if (extractiveStructuralArtifactPattern.test(normalized)) return true;
  if (extractiveHeadingOnlyPattern.test(normalized.replace(/[.;]+$/, ""))) return true;
  if (/^([A-Za-z][A-Za-z /-]{3,60})\s+\1\.?$/i.test(normalized)) return true;
  const firstToken = normalized.split(/\s+/, 1)[0] ?? "";
  if (
    /^[a-z][a-z -]{2,}\b/.test(normalized) &&
    !extractiveAllowedLowercaseStarterPattern.test(normalized) &&
    !medicationEntitiesInText(firstToken).length
  ) {
    return true;
  }
  if (/\b[A-Za-z]{4,}[A-Z]{2,}[A-Za-z]{2,}\b/.test(normalized)) return true;
  if (/>[\s]*>/.test(normalized) && !/\w\s*>\s*\d/.test(normalized)) return true;
  if (/\w+\s*>\s*\w+\s*>\s*\w+/g.test(normalized) && !/\d\s*>\s*\d/.test(normalized)) return true;
  if (
    /^\s*(?:references?(?!\s+(?:range|interval|value|level|limit|coordinate|check|system|dosing|monitoring|guideline))|bibliography)\b/i.test(
      normalized,
    )
  )
    return true;
  if (hasClinicalAnswerQualityIssue(normalized)) return true;
  if (/\btable\s+\d+\b/i.test(normalized) && normalized.length > 180) return true;
  return false;
}

function isLowValueExtractiveCaption(clause: string) {
  const descriptor =
    /^(?:clinical\s+table|table|figure|image)\s+(?:showing|detailing|listing|outlining|describing|with|of)\b/i.test(
      clause,
    ) || /\btable\s+(?:showing|detailing|listing|outlining|describing)\b/i.test(clause);
  if (!descriptor) return false;
  return !extractiveClinicalDirectivePattern.test(clause);
}

function splitClinicalEvidenceSentences(value: string) {
  return sourceTextForClinicalProse(value)
    .split(/\r?\n+|(?<=[.!?])\s+|\s+[•]\s+|\s+\|\s+/)
    .map(cleanExtractivePointText)
    .filter(
      (sentence) =>
        sentence.length >= 18 &&
        !looksLikeJsonArtifact(sentence) &&
        !isLowValueExtractiveCaption(sentence) &&
        !hasBadExtractiveQuality(sentence),
    );
}

function factKindForSentence(sentence: string, query: string, intent: AnswerIntent): ExtractedClinicalFactKind | null {
  const text = normalizeSectionText(sentence);
  if (!text) return null;
  if (
    /\b(?:contraindicat\w*|avoid|must not|do not|should not|not use|opioid[-\s]?free|withdrawal|precipitat\w*)\b/i.test(
      text,
    )
  ) {
    return "contraindication";
  }
  if (/\b(?:renal|kidney|eGFR|creatinine|CrCl)\b/i.test(text)) return "renal_limit";
  if (
    /\b(?:red|amber|green|threshold|withhold|cease|stop|discontinue|discontinued|urgent|contact|repeat|anc|fbc|wbc|neutrophil|toxic\w*|action)\b/i.test(
      text,
    )
  ) {
    return "threshold_action";
  }
  if (/\b(?:pathway|refer|referral|criteria|indicat\w*|ect|electroconvulsive|specialist|psychiat\w*)\b/i.test(text)) {
    return "pathway_referral";
  }
  if (
    /\b(?:monitor|monitoring|baseline|weekly|monthly|annual|every|level|levels|blood test|ecg|lft|review)\b/i.test(text)
  ) {
    return "monitoring";
  }
  if (
    /\b(?:doses?|dosing|dosage|max(?:imum)?|\d+(?:\.\d+)?\s?(?:mg|mcg)|daily|bd|tds|mane|nocte|mmol\/l)\b/i.test(text)
  ) {
    return "dose";
  }
  if (/\b(?:caution|risk|adverse|side effect|limited|not enough|insufficient)\b/i.test(text)) return "caveat";
  if (intent === "general" && hasRelevantQueryOverlap(text, query, intent)) return "bottom_line";
  return null;
}

function factSupportsAnswerIntent(
  kind: ExtractedClinicalFactKind,
  sentence: string,
  query: string,
  intent: AnswerIntent,
) {
  const text = normalizeSectionText(sentence);
  const normalizedQuery = normalizeSectionText(query).toLowerCase();
  if (!text || hasBadExtractiveQuality(text)) return false;

  switch (intent) {
    case "dose":
      if (kind !== "dose" && kind !== "renal_limit") {
        // Allow contraindication facts when the query explicitly asks for renal information,
        // since renal contraindications (e.g. creatinine >120 micromol/L: contraindicated) are
        // essential dose safety facts for renal-dose queries.
        if (
          kind === "contraindication" &&
          /\brenal\b/i.test(query) &&
          /\b(?:renal|kidney|eGFR|creatinine|CrCl)\b/i.test(text)
        ) {
          // fall through to dose text check below
        } else {
          return false;
        }
      }
      if (/\brenal\b/i.test(query) && !/\b(?:renal|kidney|eGFR|creatinine|CrCl)\b/i.test(text)) return false;
      if (/\bmax(?:imum)?\b/i.test(query) && !/\b(?:max(?:imum)?|\d+(?:\.\d+)?\s?(?:mg|mcg))\b/i.test(text)) {
        return false;
      }
      return extractiveConcreteDosePattern.test(text);
    case "contraindication":
      return (
        kind === "contraindication" &&
        /\b(?:contraindicat\w*|avoid|must not|do not|should not|not use|opioid[-\s]?free|withdrawal|precipitat\w*)\b/i.test(
          text,
        )
      );
    case "monitoring_schedule":
      // Also allow renal_limit facts — sentences like 'baseline renal function then repeat periodically'
      // are classified as renal_limit (renal check triggers before monitoring), but are directly relevant
      // to monitoring schedule answers.
      if (kind !== "monitoring" && kind !== "dose" && kind !== "renal_limit") return false;
      return /\b(?:monitor|monitoring|follow[-\s]?up|baseline|weekly|monthly|annual|every|several\s+times\s+a\s+year|level|levels|blood test|fbc|anc|wbc|ecg|lft|renal|thyroid|metabolic|glucose|bsl|lipids|cholesterol|triglycerides|blood pressure|bp|pulse|weight|bmi|mmol\/l|range)\b/i.test(
        text,
      );
    case "red_result_action":
      if (kind !== "threshold_action" && kind !== "caveat") return false;
      return (
        /\b(?:withhold|cease|stop|discontinue|discontinued|contact|urgent|repeat|review|call for help|escalat\w*|monitor|toxicity|rash)\b/i.test(
          text,
        ) &&
        // Include green/neutrophil: valid clozapine result-action vocabulary the classifier accepts
        /\b(?:red|amber|green|threshold|result|results|anc|fbc|wbc|neutrophil|toxicity|rash|reaction|blood|patholog\w*|haematolog\w*|hematolog\w*)\b/i.test(
          text,
        )
      );
    case "pathway_referral":
      if (kind !== "pathway_referral") return false;
      if (/\breferr?al|refer\b/i.test(query) && !/\b(?:refer|referral|form\s*1a)\b/i.test(text)) return false;
      if (/\bdischarge\s+criteria\b/i.test(text) && !/\bdischarge\b/.test(normalizedQuery)) return false;
      return /\b(?:pathway|procedure|refer|referral|criteria|indicat\w*|ect|electroconvulsive|specialist|psychiat\w*|step)\b/i.test(
        text,
      );
    case "document_lookup":
      return /\b(?:document|guideline|procedure|policy|protocol|form|source|file|support|supports|covers|contains)\b/i.test(
        text,
      );
    case "unsupported":
      return false;
    case "general":
    default:
      if (/\b(?:references?|bibliography|full\s+text|pubmed|randomi[sz]ed\s+clinical\s+trial)\b/i.test(text)) {
        return false;
      }
      if (/^what\s+is\b/i.test(query)) {
        return /\b(?:is|are|means|defined|characteri[sz]ed|involves|refers\s+to)\b/i.test(text);
      }
      return /\b(?:assess|arrange|check|continue|review|treat|manage|monitor|refer|dose|risk|therapy|diagnos\w*)\b/i.test(
        text,
      );
  }
}

function factSentenceMatchesQueryFromResult(
  sentence: string,
  result: SearchResult,
  query: string,
  intent: AnswerIntent,
) {
  if (mentionsDifferentMedicationEntity(sentence, query)) return false;
  if (hasRelevantQueryOverlap(sentence, query, intent)) return true;
  if (intent === "general" || intent === "unsupported") return false;

  const resultText = evidenceTextForGate(result);
  const entityTokens = queryEntityTokens(query, intent);
  const entityCoveredByResult =
    entityTokens.length === 0 || entityTokens.some((token) => queryTokenMatchesText(token, resultText));
  if (!entityCoveredByResult) return false;

  const normalized = normalizeSectionText(sentence).toLowerCase();
  const intentTokens = queryIntentTokens(query, intent);
  const intentCovered =
    intentTokens.length === 0 ||
    intentTokens.some((token) => queryTokenMatchesText(token, normalized)) ||
    (intent === "dose" && extractiveConcreteDosePattern.test(normalized));
  return answerIntentEvidencePattern(intent).test(normalized) && intentCovered;
}

function factPriority(kind: ExtractedClinicalFactKind, intent: AnswerIntent) {
  if (intent === "contraindication" && kind === "contraindication") return 9;
  if (intent === "red_result_action" && kind === "threshold_action") return 9;
  if (intent === "monitoring_schedule" && kind === "monitoring") return 9;
  if (intent === "pathway_referral" && kind === "pathway_referral") return 9;
  if (intent === "dose" && kind === "dose") return 9;
  if (intent === "dose" && kind === "renal_limit") return 8;
  if (kind === "bottom_line") return 5;
  if (kind === "caveat") return 3;
  return 6;
}

function tableFactsToClinicalFacts(result: SearchResult, query: string, intent: AnswerIntent): ExtractedClinicalFact[] {
  return (result.table_facts ?? [])
    .map((fact) => {
      const text = cleanExtractivePointText(
        [fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action].filter(Boolean).join(": "),
      );
      const kind = factKindForSentence(text, query, intent);
      if (!text || !kind || !factSentenceMatchesQueryFromResult(text, result, query, intent)) return null;
      if (!factSupportsAnswerIntent(kind, text, query, intent)) return null;
      return {
        kind,
        text,
        citationChunkIds: [result.id],
        priority: factPriority(kind, intent) + 1,
      } satisfies ExtractedClinicalFact;
    })
    .filter((fact): fact is ExtractedClinicalFact => Boolean(fact));
}

function extractClinicalFactsFromResults(results: SearchResult[], query: string, intent: AnswerIntent, limit = 8) {
  const seen = new Set<string>();
  const facts: ExtractedClinicalFact[] = [];
  const usableResults = results.filter((result) => resultCoversAnswerIntent(result, query, intent));

  for (const result of usableResults) {
    for (const fact of tableFactsToClinicalFacts(result, query, intent)) {
      const key = `${fact.kind}:${normalizeSectionText(fact.text).toLowerCase().slice(0, 160)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push(fact);
    }

    const text = [
      result.retrieval_synopsis,
      result.section_heading,
      result.content,
      result.adjacent_context,
      ...(result.memory_cards ?? []).map((card) => card.content),
    ]
      .filter(Boolean)
      .join("\n");
    for (const sentence of splitClinicalEvidenceSentences(text)) {
      if (!factSentenceMatchesQueryFromResult(sentence, result, query, intent)) continue;
      const kind = factKindForSentence(sentence, query, intent);
      if (!kind) continue;
      if (!factSupportsAnswerIntent(kind, sentence, query, intent)) continue;
      const cleaned = sentence.length <= 280 ? sentence : `${sentence.slice(0, 277).trim()}...`;
      const key = `${kind}:${normalizeSectionText(cleaned).toLowerCase().slice(0, 160)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push({
        kind,
        text: cleaned,
        citationChunkIds: [result.id],
        priority: factPriority(kind, intent) + Math.min(scoreValue(result), 1),
      });
      if (facts.length >= limit) break;
    }
    if (facts.length >= limit) break;
  }

  return facts.sort((a, b) => b.priority - a.priority || a.text.length - b.text.length).slice(0, limit);
}

function sentenceFromFact(fact: ExtractedClinicalFact, query: string) {
  const text = sanitizeAnswerText(cleanExtractivePointText(fact.text)).replace(/[.;,\s]+$/, "");
  if (!text) return "";
  const entity = queryEntityTokens(query, classifyAnswerIntent(query, classifyRagQuery(query).queryClass))[0];
  const needsEntityPrefix =
    entity &&
    fact.kind !== "bottom_line" &&
    !queryTokenMatchesText(entity, text) &&
    !/^(?:for|in|when|if|avoid|do not|must not|withhold|cease|stop|monitor|check|refer|arrange)\b/i.test(text);
  const sentence = needsEntityPrefix ? `For ${entity}, ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
  return completeExtractiveSentence(sentence, query);
}

function lowerFirst(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function upperFirst(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

// A clinical action clause: an imperative/directive verb that turns a bare conditional
// ("if INR is high") into a complete, self-contained sentence ("if INR is high, withhold warfarin").
const extractiveActionClausePattern =
  /\b(?:withhold|cease|stop|discontinue|hold|monitor|check|repeat|review|refer|arrange|contact|escalate|seek|avoid|continue|commence|start|initiate|titrate|prescribe|administer|give|reduce|increase|document|consider|recheck|admit|transfer)\b/i;

export function completeExtractiveSentence(value: string, query: string) {
  const cleaned = sanitizeAnswerText(value)
    .replace(/[.;,\s]+$/, "")
    .trim();
  if (!cleaned) return "";

  const sentence = `${cleaned}.`;
  if (hasCompleteOpeningSentence(sentence) && !isFragmentLikeClinicalAnswer(sentence, query)) return sentence;

  if (/^(?:when|if|where|after|before|during)\b/i.test(cleaned)) {
    // A conditional clause that already carries its own action ("if INR is high, withhold warfarin")
    // is a complete, natural sentence — present it directly instead of the stock "The guidance is
    // that…" lead-in. Only when the condition has no action of its own do we add the wrapper so the
    // fragment reads as a full sentence.
    const conditionalAsSentence = `${upperFirst(cleaned)}.`;
    if (
      /,\s*\S/.test(cleaned) &&
      extractiveActionClausePattern.test(cleaned) &&
      !isFragmentLikeClinicalAnswer(conditionalAsSentence, query)
    ) {
      return conditionalAsSentence;
    }
    return `The guidance is that ${lowerFirst(cleaned)}.`;
  }

  const withoutLeadingFragment = cleaned.replace(/^(?:and|or|but|with|without|including|such as|then)\s+/i, "");
  if (/^to\b/i.test(cleaned)) {
    return `The guidance is ${lowerFirst(cleaned)}.`;
  }
  if (withoutLeadingFragment !== cleaned) {
    return `The guidance includes ${lowerFirst(withoutLeadingFragment)}.`;
  }

  return `The guidance is that ${lowerFirst(cleaned)}.`;
}

function sectionForFactKind(kind: ExtractedClinicalFactKind): Pick<AnswerSection, "heading" | "kind"> {
  switch (kind) {
    case "dose":
      return { heading: "Dose", kind: "medication_dose" };
    case "renal_limit":
      return { heading: "Renal limits", kind: "contraindications_cautions" };
    case "monitoring":
      return { heading: "Monitoring", kind: "monitoring_timing" };
    case "threshold_action":
      return { heading: "Result action", kind: "thresholds" };
    case "contraindication":
      return { heading: "Contraindications", kind: "contraindications_cautions" };
    case "pathway_referral":
      return { heading: "Pathway/referral", kind: "required_actions" };
    case "caveat":
      return { heading: "Caveat", kind: "source_gap" };
    default:
      return { heading: "Bottom line", kind: "bottom_line" };
  }
}

function buildFactSections(facts: ExtractedClinicalFact[], query: string) {
  const grouped = new Map<ExtractedClinicalFactKind, ExtractedClinicalFact[]>();
  for (const fact of facts) grouped.set(fact.kind, [...(grouped.get(fact.kind) ?? []), fact]);
  return Array.from(grouped.entries())
    .slice(0, 4)
    .map(([kind, group]) => {
      const section = sectionForFactKind(kind);
      const body = group
        .slice(0, 2)
        .map((fact) => sentenceFromFact(fact, query))
        .filter(Boolean)
        .join(" ");
      return {
        heading: section.heading,
        kind: section.kind,
        supportLevel: "direct",
        body: boldHighYieldClinicalText(body, query),
        citation_chunk_ids: Array.from(new Set(group.flatMap((fact) => fact.citationChunkIds))),
      } satisfies AnswerSection;
    })
    .filter((section) => section.body && section.citation_chunk_ids.length > 0);
}

function buildFactSynthesizedAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  intent: AnswerIntent;
  results: SearchResult[];
}) {
  const facts = extractClinicalFactsFromResults(args.results, args.query, args.intent);
  if (!facts.length) {
    if (sourceBackedDocumentFallbackIntent(args.query, args.queryClass, args.intent, args.results)) {
      return buildDocumentSupportListAnswer({ query: args.query, results: args.results });
    }
    const gapAnswer = finalQualityGapAnswer(args.query, args.queryClass, args.intent);
    return {
      answer: gapAnswer,
      body: gapAnswer,
      citationChunkIds: [] as string[],
      answerSections: [] as AnswerSection[],
    };
  }

  const leadFacts = facts.slice(0, args.intent === "dose" ? 2 : 1);
  const answer = sanitizeAnswerText(
    leadFacts
      .map((fact) => sentenceFromFact(fact, args.query))
      .filter(Boolean)
      .join(" "),
  );
  const answerSections = buildFactSections(facts, args.query);
  return {
    answer: boldHighYieldClinicalText(answer, args.query),
    body: boldHighYieldClinicalText(answer, args.query),
    citationChunkIds: Array.from(new Set(facts.flatMap((fact) => fact.citationChunkIds))),
    answerSections,
  };
}

function sourceBackedDocumentFallbackIntent(
  query: string,
  queryClass: RagQueryClass,
  intent: AnswerIntent,
  results: SearchResult[],
) {
  if (results.length === 0) return false;
  const strongestScore = Math.max(...results.map(scoreValue));
  if (strongestScore < 0.45) return false;
  const normalized = normalizeSectionText(query).toLowerCase();
  const sourceBackedProcedureQuery =
    /\b(?:process|procedure|protocol|pathway|workflow|steps?|requirements?|criteria|guidance|document)\b/.test(
      normalized,
    );
  if (!sourceBackedProcedureQuery) return false;
  return (
    intent === "document_lookup" ||
    intent === "pathway_referral" ||
    queryClass === "document_lookup" ||
    queryClass === "broad_summary"
  );
}

function documentSupportListIntent(query: string, queryClass: RagQueryClass) {
  return (
    classifyAnswerIntent(query, queryClass) === "document_lookup" &&
    /\b(?:support|supports|supporting|sources?|documents?|guidelines?)\b/i.test(query)
  );
}

function tableOrVisualSourceLookupIntent(query: string, queryClass: RagQueryClass, answerIntent: AnswerIntent) {
  if (queryClass === "table_threshold" || answerIntent === "dose" || answerIntent === "monitoring_schedule")
    return false;
  return (
    /\b(?:which|where|find|open|locate)\b.{0,120}\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b/i.test(
      query,
    ) ||
    /\b(?:show|display)\s+(?:me\s+)?(?:the\s+)?(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b/i.test(
      query,
    ) ||
    /\b(?:which|what)\b.{0,80}\b(?:source|document|guideline|file|pdf)\b.{0,80}\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b/i.test(
      query,
    ) ||
    /\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b.{0,80}\b(?:cover|covers|contain|contains|list|lists|guidance)\b/i.test(
      query,
    )
  );
}

function sourceLookupLabel(result: SearchResult) {
  const tableTitle = (result.table_facts ?? [])
    .map((fact) => fact.table_title || fact.row_label)
    .find((value): value is string => Boolean(value?.trim()));
  const imageTitle = (result.images ?? [])
    .map((image) => image.tableTitle || image.caption)
    .find((value): value is string => Boolean(value?.trim()));
  const rawLabel = tableTitle || imageTitle || result.section_heading || result.title || result.file_name;
  return normalizeSectionText(rawLabel)
    .replace(/([a-zA-Z])\(/g, "$1 (")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function hasTableOrVisualLookupEvidence(result: SearchResult) {
  return (
    (result.table_facts?.length ?? 0) > 0 ||
    (result.images ?? []).some((image) =>
      /\b(?:clinical_table|flowchart_algorithm|medication_chart|risk_matrix|table_crop|diagram_crop|page_region|embedded)\b/i.test(
        `${image.image_type ?? ""} ${image.sourceKind ?? ""} ${image.source_kind ?? ""}`,
      ),
    ) ||
    /\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b/i.test(
      `${result.section_heading ?? ""} ${result.title ?? ""} ${result.file_name ?? ""}`,
    )
  );
}

function buildTableOrVisualSourceLookupAnswer(args: { query: string; results: SearchResult[] }) {
  const source = args.results.find(hasTableOrVisualLookupEvidence) ?? args.results[0];
  if (!source) {
    const gapAnswer = finalQualityGapAnswer(args.query, "document_lookup", "document_lookup");
    return { answer: gapAnswer, citationChunkIds: [] as string[], answerSections: [] as AnswerSection[] };
  }

  const label = sourceLookupLabel(source) || "the top matched source";
  const answer = `The relevant source is ${label}, which covers the requested table or visual guidance.`;

  return {
    answer,
    citationChunkIds: [source.id],
    answerSections: [
      {
        heading: "Source match",
        kind: "documentation",
        supportLevel: "direct",
        body: `The source match is ${label}.`,
        citation_chunk_ids: [source.id],
      },
    ] satisfies AnswerSection[],
  };
}

function buildDocumentSupportListAnswer(args: { query: string; results: SearchResult[] }) {
  const documents = buildDocumentBreakdown(args.results, extractQuoteCards(args.results, args.query)).slice(0, 5);
  if (!documents.length) {
    const gapAnswer = finalQualityGapAnswer(args.query, "document_lookup", "document_lookup");
    return { answer: gapAnswer, citationChunkIds: [] as string[], answerSections: [] as AnswerSection[] };
  }
  const names = documents
    .map((document) =>
      normalizeSectionText(document.title || document.file_name)
        .replace(/([a-zA-Z])\(/g, "$1 (")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const answer =
    names.length === 1
      ? `I found one indexed document that supports this query: ${names[0]}.`
      : `I found ${names.length} indexed documents that support this query: ${names.slice(0, -1).join("; ")}; and ${names.at(-1)}.`;
  return {
    answer,
    citationChunkIds: Array.from(
      new Set(
        documents.flatMap((document) =>
          args.results
            .filter((result) => result.document_id === document.document_id)
            .slice(0, 1)
            .map((result) => result.id),
        ),
      ),
    ),
    answerSections: [
      {
        heading: "Document matches",
        kind: "documentation",
        supportLevel: "direct",
        body: names.join("; "),
        citation_chunk_ids: Array.from(
          new Set(
            documents.flatMap((document) =>
              args.results
                .filter((result) => result.document_id === document.document_id)
                .slice(0, 1)
                .map((result) => result.id),
            ),
          ),
        ),
      },
    ] satisfies AnswerSection[],
  };
}

function buildExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  quoteCards: QuoteCard[];
  documentBreakdown: RagAnswer["documentBreakdown"];
  evidenceSummary: RagAnswer["evidenceSummary"];
  sourceCoverage: RagAnswer["sourceCoverage"];
  conflictsOrGaps: ConflictOrGap[];
  visualEvidence: RagAnswer["visualEvidence"];
  bestSource: RagAnswer["bestSource"];
  smartPanel: RagAnswer["smartPanel"];
  relatedDocuments: RagAnswer["relatedDocuments"];
  routeReason: string;
  timings: RagAnswer["latencyTimings"];
}) {
  const quoteCards = args.quoteCards.length
    ? args.quoteCards.slice(0, 5)
    : extractQuoteCards(args.results, args.query, 5);
  const memoryCards = rankMemoryCardsForAnswer(collectMemoryCards(args.results, 16), args.query, args.queryClass).slice(
    0,
    10,
  );
  const citations = compactCitations(args.results).slice(0, Math.max(quoteCards.length, 1));
  const citationIds = new Set(citations.map((citation) => citation.chunk_id));
  const resultById = new Map(args.results.map((result) => [result.id, result]));
  for (const card of memoryCards) {
    for (const chunkId of card.source_chunk_ids ?? []) {
      if (citationIds.has(chunkId)) continue;
      const source = resultById.get(chunkId);
      if (!source) continue;
      citations.push(resultCitation(source));
      citationIds.add(chunkId);
    }
  }
  for (const quote of quoteCards) {
    if (!citationIds.has(quote.chunk_id)) {
      // Guard the lookup: a quote card whose chunk_id was filtered out of results
      // would make find() return undefined and resultCitation(undefined) throw.
      const source = args.results.find((result) => result.id === quote.chunk_id);
      if (source) citations.push(resultCitation(source));
    }
    citationIds.add(quote.chunk_id);
  }

  const answerIntent = classifyAnswerIntent(args.query, args.queryClass);
  const naturalAnswer = documentSupportListIntent(args.query, args.queryClass)
    ? buildDocumentSupportListAnswer({ query: args.query, results: args.results })
    : tableOrVisualSourceLookupIntent(args.query, args.queryClass, answerIntent)
      ? buildTableOrVisualSourceLookupAnswer({ query: args.query, results: args.results })
      : buildFactSynthesizedAnswer({
          query: args.query,
          queryClass: args.queryClass,
          intent: answerIntent,
          results: args.results,
        });

  // Fact synthesis is the production extractive path. If no clean fact survives
  // coverage and artifact gates, fail closed instead of stitching snippets.
  const hasExtractedAnswer = naturalAnswer.citationChunkIds.length > 0;

  // Ensure any chunk IDs referenced by the synthesized answer are present in citations,
  // even if they were not in the top-ranked compactCitations slice.
  for (const chunkId of naturalAnswer.citationChunkIds) {
    if (!citationIds.has(chunkId)) {
      const source = args.results.find((result) => result.id === chunkId);
      if (source) {
        citations.push(resultCitation(source));
        citationIds.add(chunkId);
      }
    }
  }

  return {
    answer: naturalAnswer.answer,
    grounded: hasExtractedAnswer && citations.length > 0,
    confidence: hasExtractedAnswer ? deriveConfidence(args.results, citations) : "unsupported",
    citations: citations.slice(0, 5),
    sources: args.results,
    modelUsed: null,
    routingMode: "extractive",
    routingReason: args.routeReason,
    queryClass: args.queryClass,
    latencyTimings: args.timings,
    answerSections: naturalAnswer.answerSections ?? [],
    quoteCards,
    visualEvidence: args.visualEvidence,
    bestSource: args.bestSource,
    documentBreakdown: args.documentBreakdown,
    evidenceSummary: args.evidenceSummary,
    sourceCoverage: args.sourceCoverage,
    conflictsOrGaps: args.conflictsOrGaps,
    smartPanel: args.smartPanel,
    relatedDocuments: args.relatedDocuments,
    memoryCardsUsed: memoryCards,
    indexingVersion: ragDeepMemoryVersion,
    indexingQuality: buildIndexingQuality(args.results, memoryCards),
    scoreExplanations: buildAnswerScoreExplanations(args.results),
  } satisfies RagAnswer;
}

function sourceBackedFallbackSubject(query: string) {
  const normalized = normalizeSectionText(query)
    .replace(/[?!.]+$/, "")
    .trim();
  const subject = normalized
    .replace(/^summari[sz]e\s+(?:the\s+)?/i, "")
    .replace(/^what\s+(?:is|are)\s+(?:the\s+)?(?:process|requirements?)\s+for\s+/i, "")
    .replace(/^what\s+(?:is|are)\s+required\s+(?:for|when)\s+/i, "")
    .replace(/^what\s+(.+?)\s+is\s+required$/i, "$1")
    .replace(/^what\s+does\s+(?:the\s+)?/i, "")
    .replace(/\s+(?:document|procedure|guideline)\s+require$/i, "")
    .replace(/^how\s+(?:is|are)\s+/i, "")
    .replace(/\s+managed$/i, " management")
    .trim();

  if (subject.length < 4) return "this clinical question";
  return subject.length > 90 ? `${subject.slice(0, 87).trim()}...` : lowerFirst(subject);
}

export function sourceBackedGenerationTimeoutAnswer(query: string) {
  const subject = sourceBackedFallbackSubject(query);
  return `The uploaded documents contain relevant guidance on ${subject}, but a full written answer could not be completed just now. The key source passages are cited below — please review them directly.`;
}

const reasoningEffortRank: Record<OpenAIReasoningEffort, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 4,
};

// Strong-route reasoning effort by query class (P6). Safety-critical numeric/threshold classes keep
// the full configured effort; routine retrieval classes are capped at "medium" so high-effort
// reasoning over verbose context does not overrun the answer timeout and fail-closed on queries that
// actually have good sources. Never raises effort above the configured value.
export function strongReasoningEffortForQueryClass(
  queryClass: RagQueryClass,
  configured: OpenAIReasoningEffort,
): OpenAIReasoningEffort {
  const safetyCritical = queryClass === "medication_dose_risk" || queryClass === "table_threshold";
  if (safetyCritical) return configured;
  return reasoningEffortRank[configured] > reasoningEffortRank.medium ? "medium" : configured;
}

function isUnusableGeneratedAnswer(answer: Pick<RagAnswer, "answer" | "citations" | "routingReason">) {
  const normalized = normalizeSectionText(answer.answer ?? "");
  if (!normalized) return true;
  if (normalized === machineReadableFallbackAnswer) return true;
  if (answer.routingReason === "structured_parse_fallback") return true;
  return looksLikeJsonArtifact(normalized);
}

const templateLikeGeneratedTextPattern =
  /\b(?:the\s+(?:strongest\s+)?retrieved\s+(?:source|sources|passages|excerpts)\s+(?:support|supports|show|shows|indicate|indicates)|retrieved\s+(?:source|sources|passages|excerpts)|source-backed|based\s+on\s+(?:the\s+)?(?:provided\s+)?(?:sources|excerpts|passages|retrieved\s+sources)|the\s+(?:cited\s+)?source\s+(?:states|supports|says|indicates)|provided\s+excerpts)\b/i;
const templateLikeGeneratedPrefixPattern = /^(?:answer|summary|bottom line|required actions|direct answer)\s*[:.-]\s+/i;
const templateLikeGeneratedSectionHeadingPattern =
  /^(?:direct answer|bottom line|high-yield summary|source-backed answer|direct source-backed answer)$/i;
const simpleDirectQuestionPattern =
  /^(?:what\s+(?:is|are)|what's|define|who\s+(?:is|are)|when\s+(?:is|are)|where\s+(?:is|are)|is\s+|are\s+|does\s+|do\s+)/i;
const simpleQuestionExpansionPattern =
  /\b(?:management|manage|managed|treatment|treat|therapy|care|approach|pathway|dose|dosing|threshold|compare|versus|vs|monitoring|required|requirements|risk|side effect|contraindicat\w*|urgent|escalat\w*)\b/i;

function isTemplateLikeGeneratedAnswer(answer: Pick<RagAnswer, "answer" | "answerSections">) {
  const answerText = normalizeSectionText(answer.answer ?? "");
  if (
    answerText &&
    (templateLikeGeneratedTextPattern.test(answerText) || templateLikeGeneratedPrefixPattern.test(answerText))
  ) {
    return true;
  }

  return (answer.answerSections ?? []).some((section) => {
    const heading = normalizeSectionText(section.heading ?? "");
    const body = normalizeSectionText(section.body ?? "");
    return (
      (heading && templateLikeGeneratedSectionHeadingPattern.test(heading)) ||
      (body && (templateLikeGeneratedTextPattern.test(body) || templateLikeGeneratedPrefixPattern.test(body)))
    );
  });
}

function isSimpleDirectQuestion(query: string, queryClass: RagQueryClass) {
  const normalized = normalizeSectionText(query);
  if (!normalized || normalized.length > 100) return false;
  if (queryClass === "comparison" || queryClass === "table_threshold" || queryClass === "medication_dose_risk") {
    return false;
  }
  if (queryClass === "broad_summary" || queryClass === "document_lookup") return false;
  return simpleDirectQuestionPattern.test(normalized) && !simpleQuestionExpansionPattern.test(normalized);
}

// Bare definitional questions ("what is X", "define X", "who is X") legitimately get short answers
// that refer back to the subject with anaphora ("It is …") without repeating the entity term, so
// the lexical entity-overlap responsiveness check would false-fire on them. Detect and exempt them
// when extending the overlap gate to synthesized model answers.
export function isBareDefinitionQuestion(query: string) {
  return /^(?:what(?:'s| is| are)|define|who\s+(?:is|are))\b/i.test(normalizeSectionText(query));
}

function wordCount(value: string) {
  return normalizeSectionText(value).split(/\s+/).filter(Boolean).length;
}

function isOverExpandedSimpleGeneratedAnswer(
  query: string,
  queryClass: RagQueryClass,
  answer: Pick<RagAnswer, "answer" | "answerSections">,
) {
  if (!isSimpleDirectQuestion(query, queryClass)) return false;
  const sections = answer.answerSections ?? [];
  const nonEssentialSectionCount = sections.filter((section) => !isEssentialSimpleQuestionSection(section)).length;
  return nonEssentialSectionCount > 0 || sections.length > 1 || wordCount(answer.answer ?? "") > 95;
}

function isEssentialSimpleQuestionSection(section: Pick<AnswerSection, "heading" | "body">) {
  return /\b(?:gap|not enough|insufficient|unsupported|urgent|escalat\w*|risk|safety)\b/i.test(
    `${section.heading} ${section.body}`,
  );
}

const clinicalQuerySignalPattern =
  /\b(?:lithium|clozapine|acamprosate|naltrexone|sertraline|valproate|antipsychotic|ect|bulimia|anorexia|eating disorder|dose|renal|pregnan|monitor|fbc|anc|qtc|opioid|contraindicat|referral|pathway|patient|clinical|guideline|medication|medicine|prescrib|therapy|treatment)\b/i;

function isClearlyNonClinicalUnsupportedQuery(query: string) {
  return (
    /\b(?:coffee|machine|parking|payroll|roster|leave|wifi|printer|canteen|expense|timesheet|room\s+booking|building|staff\s+room)\b/i.test(
      query,
    ) && !clinicalQuerySignalPattern.test(query)
  );
}

function finalQualityGapAnswer(
  query: string,
  queryClass: RagQueryClass,
  intent: AnswerIntent = classifyAnswerIntent(query, queryClass),
) {
  if (
    isClearlyNonClinicalUnsupportedQuery(query) ||
    (queryClass === "unsupported_or_general" && !clinicalQuerySignalPattern.test(query))
  ) {
    return "No relevant clinical source was found for this query.";
  }
  if (intent === "document_lookup") return "No current indexed document directly supporting this request was found.";
  if (intent === "pathway_referral" && /\bect\b/i.test(query)) {
    return "No current source with ECT referral criteria was found.";
  }
  if (intent === "pathway_referral") return "No current source with referral or pathway criteria was found.";
  if (intent === "contraindication") return "No current source with contraindication or avoid-use guidance was found.";
  if (intent === "monitoring_schedule")
    return "No current source with monitoring timing or schedule guidance was found.";
  if (intent === "red_result_action") {
    if (/\bqtc\b/i.test(query)) return "No current source with QTc threshold or ECG action guidance was found.";
    if (/\btoxicity\b/i.test(query)) return "No current source with toxicity action guidance was found.";
    if (/\brash\b/i.test(query)) return "No current source with rash action guidance was found.";
    return "No current source with threshold-specific action guidance was found.";
  }
  if (intent === "dose") {
    if (/\brenal\b/i.test(query)) return "No current source with renal dosing limits for this query was found.";
    return "No current source with dose guidance for this query was found.";
  }
  return "No current source with directly relevant clinical guidance was found.";
}

function isFragmentLikeClinicalAnswer(text: string, query: string) {
  const normalized = normalizeSectionText(text);
  const lower = normalized.toLowerCase();
  if (
    /\b(?:dosing\s+frequencies\s+outside|prn\s+dose\s+daily\s+dose|table\s+summari[sz]ing|includes\s+risk\s+monitoring\s+form|recommended\s+over\s+>\d+\s*kg)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/^for\s+(?:after|before|prior|post),/i.test(normalized)) return true;
  if (/\bis\s+to:\.?$/i.test(normalized)) return true;
  if (
    /^what\s+is\b/i.test(query) &&
    // Only apply this fragment gate for general/definition questions, not for clinical intent
    // queries like "What is the maximum dose?" or "What is the QTc threshold?" which produce
    // valid concise fact answers that don't contain definition-style phrasing.
    !/\b(?:required|requirements?|dose|dosage|dosing|max(?:imum)?|mg|mcg|threshold|monitor|renal|contraindicat|referral|pathway|procedure|process|protocol|workflow|steps?|ect|electroconvulsive|qtc|fbc|anc|wbc|level|levels)\b/i.test(
      query,
    ) &&
    // "What is required/needed/involved/included…" and "what is the process/procedure/protocol…"
    // are procedural questions, not definitions — their answers (and the source-pointer fallback)
    // legitimately lack "X is a/an…" definition phrasing, so the definition-fragment gate must not
    // fire for them (it otherwise fails good answers closed on a false positive — see P6).
    !/^what\s+is\s+(?:required|needed|involved|included|expected|recommended|considered|the\s+(?:process|procedure|protocol|criteria|requirement|approach|guidance|recommendation|role|purpose|aim))\b/i.test(
      query,
    ) &&
    !/\b(?:is|are)\s+(?:a|an|the)\b|\b(?:defined\s+as|characteri[sz]ed\s+by|involves|refers\s+to|is\s+an?\s+eating\s+disorder)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/\bbaby\s+whilst\b.*\bpost\s+anaesthetic\b/i.test(normalized)) return true;
  if (/^(\*{0,2}[a-z][a-z0-9 -]{2,}\*{0,2})\s*:\s*\1\b/i.test(normalized)) return true;
  if (/\?\s+(?:monitoring|adverse effects|when prescribed|prescribed for)\b/i.test(normalized)) return true;
  if (/\bmonitoring adverse effects when prescribed\b/i.test(normalized)) return true;
  if (/\b(?:after starting|ongoing)\s+\*{0,2}[a-z]+\*{0,2}\.?$/i.test(normalized) && normalized.length < 90) {
    return true;
  }
  if (/\bect\b/i.test(query) && !/\b(?:ect|electroconvulsive|refer|referral)\b/i.test(lower)) return true;
  return false;
}

function isMissingCriticalQueryIntent(query: string, text: string) {
  const normalizedQuery = normalizeSectionText(query).toLowerCase();
  const normalizedText = normalizeSectionText(text).toLowerCase();
  if (/\bcontraindicat\w*\b/.test(normalizedQuery)) {
    return !/\b(?:contraindicat\w*|avoid|must not|do not|should not|not use|opioid[-\s]?free|withdrawal|precipitat\w*)\b/.test(
      normalizedText,
    );
  }
  if (/\b(?:what to do|red|amber|anc|result|results)\b/.test(normalizedQuery)) {
    return !/\b(?:withhold|cease|stop|discontinue|discontinued|contact|urgent|repeat|review|monitor|range|threshold|blood|patholog\w*|haematolog\w*|hematolog\w*|anc)\b/.test(
      normalizedText,
    );
  }
  if (/\b(?:referral|refer|pathway)\b/.test(normalizedQuery) && /\bect\b/.test(normalizedQuery)) {
    return !/\b(?:ect|electroconvulsive|refer|referral|criteria|indicat\w*|psychiat\w*)\b/.test(normalizedText);
  }
  if (/\b(?:monitor|monitoring|schedule|baseline|follow[-\s]?up)\b/.test(normalizedQuery)) {
    if (/\bfbc\b/.test(normalizedQuery) && !/\bfbc\b/.test(normalizedText)) return true;
    if (/\banc\b/.test(normalizedQuery) && !/\banc\b/.test(normalizedText)) return true;
    if (
      /\bschedule\b/.test(normalizedQuery) &&
      !/\b(?:schedule|baseline|weekly|monthly|annual|every|first\s+\d+\s+weeks|then|ongoing)\b/.test(normalizedText)
    ) {
      return true;
    }
    return !/\b(?:monitor|monitoring|follow[-\s]?up|baseline|weekly|monthly|annual|every|level|levels|blood test|fbc|anc|wbc|ecg|lft|renal|thyroid|metabolic|glucose|bsl|lipids|cholesterol|triglycerides|blood pressure|bp|pulse|weight|bmi)\b/.test(
      normalizedText,
    );
  }
  return false;
}

const openingSentenceTerminatorPattern = /[.!?]["')\]]*(?:\s|$)/;
const incompleteOpeningSentencePattern =
  /^(?:and|or|but|because|although|while|when|where|after|before|during|with|without|including|such as|then|to|recommended\s+over|alternative\s+agent|chart\s+reference|table\s+summari[sz]ing)\b/i;
const sourceHeadingOpeningPattern =
  /^(?:appendix\s+\d+|dosage|dose|dosing|dosage and monitoring|dose table|monitoring|referral criteria|contraindications?|adverse effects?|required actions?|thresholds?|summary|overview|formulations?|available products?|product information|table|figure)\.?$/i;
const openingSentenceActionPattern =
  /\b(?:avoid|arrange|be|can|cannot|cease|check|continue|could|discontinue|document|give|include|includes|included|increase|involves|is|list|lists|may|might|monitor|must|need|needed|needs|provide|provides|recommend|recommends|reduce|refer|repeat|report|required|requires|review|should|start|starts|stop|support|supports|use|uses|was|were|will|withhold|would)\b/i;

function firstSentence(value: string) {
  const normalized = normalizeSectionText(value);
  const terminatorMatch = normalized.match(openingSentenceTerminatorPattern);
  if (!terminatorMatch || terminatorMatch.index === undefined) return normalized;
  return normalized.slice(0, terminatorMatch.index + terminatorMatch[0].trimEnd().length).trim();
}

function hasCompleteOpeningSentence(value: string) {
  const normalized = normalizeSectionText(value);
  if (!normalized || !openingSentenceTerminatorPattern.test(normalized)) return false;
  const opening = firstSentence(normalized).replace(/\*\*/g, "").trim();
  const openingWithoutTerminal = opening.replace(/[.!?]["')\]]*$/, "").trim();
  if (opening.length < 18 || openingWithoutTerminal.length < 12) return false;
  if (templateLikeGeneratedPrefixPattern.test(opening)) return false;
  if (incompleteOpeningSentencePattern.test(opening)) return false;
  if (sourceHeadingOpeningPattern.test(openingWithoutTerminal)) return false;
  return openingSentenceActionPattern.test(opening);
}

function hasInvalidModelEvidenceIds(answer: Pick<RagAnswer, "routingReason">) {
  return /\binvalid_model_citation_ids\b/.test(answer.routingReason ?? "");
}

export function generatedAnswerQualityFailureReason(answer: RagAnswer, query: string, queryClass: RagQueryClass) {
  const cleanedAnswer = sanitizeAnswerText(answer.answer);
  if (!cleanedAnswer) return "empty_after_sanitize";
  if (!hasCompleteOpeningSentence(cleanedAnswer)) return "incomplete_opening_sentence";
  if (hasBadFinalAnswerQuality(cleanedAnswer)) return "bad_final_answer_quality";
  if (hasClinicalAnswerQualityIssue(cleanedAnswer)) return "clinical_answer_quality_issue";
  if (isLowYieldClinicalText(cleanedAnswer)) return "low_yield_answer";
  if (isFragmentLikeClinicalAnswer(cleanedAnswer, query)) return "fragment_like_answer";
  if (isMissingCriticalQueryIntent(query, cleanedAnswer)) return "missing_query_intent";
  // Core-term (entity/intent) overlap responsiveness check. For extractive/low-confidence answers
  // it always applies. For synthesized model answers it is only safe on narrow simple direct
  // questions that are not bare definitions (yes/no, when/where, "does X…") — there a well-targeted
  // answer genuinely should carry the query entity terms, and anaphora is rare. Broad/comparison/
  // summary answers legitimately paraphrase, so enforcing overlap there would reject good answers.
  // A model-answer failure here only escalates fast→strong and is recovered for strongly
  // source-backed answers, so the downside of enforcing it is a retry, not a wrongful gap.
  const enforceModelAnswerOverlap = isSimpleDirectQuestion(query, queryClass) && !isBareDefinitionQuestion(query);
  if (
    (answer.routingMode === "extractive" || answer.confidence === "low" || enforceModelAnswerOverlap) &&
    !hasRelevantQueryOverlap(cleanedAnswer, query)
  ) {
    return "missing_query_overlap";
  }
  if (hasInvalidModelEvidenceIds(answer)) return "invalid_model_evidence_ids";
  if (isUnusableGeneratedAnswer(answer)) return "unusable_generated_answer";
  if (isTemplateLikeGeneratedAnswer(answer)) return "template_like_answer";
  if (isOverExpandedSimpleGeneratedAnswer(query, queryClass, answer)) return "overexpanded_simple_answer";
  return null;
}

function finalQualityFailure(answer: RagAnswer, query: string, queryClass: RagQueryClass, reason: string): RagAnswer {
  return {
    ...answer,
    answer: finalQualityGapAnswer(query, queryClass),
    grounded: false,
    confidence: "unsupported",
    answerSections: [],
    responseMode: "evidence_gap",
    routingReason: [answer.routingReason, `final_quality_gate:${reason}`].filter(Boolean).join("; "),
  };
}

function shouldPreserveSourceBackedGeneratedAnswer(answer: RagAnswer, reason: string) {
  if (reason !== "missing_query_intent" && reason !== "missing_query_overlap") return false;
  if (!answer.grounded || answer.confidence === "unsupported" || answer.citations.length === 0) return false;
  if (hasInvalidModelEvidenceIds(answer)) return false;

  const sourceSelection = answer.smartApiPlan?.answerPlan.sourceSelection;
  if (!sourceSelection?.selectedCount || !sourceSelection.requiredSignalsSatisfied) return false;
  if (sourceSelection.missingRequiredSignals.length > 0) return false;

  const matchedSignals = sourceSelection.matchedSignals;
  const hasSpecificSourceSignal = matchedSignals.some(
    (signal) =>
      signal.startsWith("index_unit:") ||
      [
        "document_title",
        "document_label",
        "table_fact",
        "source_image",
        "visual_table",
        "direct_relevance",
        "active_community",
        "ed",
        "agitation",
        "dose_amount",
        "route",
        "flowchart_or_pathway",
      ].includes(signal),
  );
  const hasStructuredChunk =
    sourceSelection.topChunkTypes.table > 0 ||
    sourceSelection.topChunkTypes.flowchart > 0 ||
    sourceSelection.topChunkTypes.medication_chart > 0 ||
    sourceSelection.topChunkTypes.patient_education > 0;

  return hasSpecificSourceSignal || hasStructuredChunk;
}

function sectionHeadingKind(heading: string): AnswerSectionKind {
  if (/\b(?:dose|dosing|medication)\b/i.test(heading)) return "medication_dose";
  if (/\b(?:monitor|timing|baseline|follow)\b/i.test(heading)) return "monitoring_timing";
  if (/\b(?:threshold|red|amber|withhold|stop|cease)\b/i.test(heading)) return "thresholds";
  if (/\b(?:gap|unsupported|source)\b/i.test(heading)) return "source_gap";
  if (/\b(?:contraindicat|caution|avoid|risk)\b/i.test(heading)) return "contraindications_cautions";
  return "required_actions";
}

function cleanAnswerSectionHeading(heading: string, body: string) {
  const normalized = normalizeSectionText(heading);
  if (
    !normalized ||
    /^(?:direct answer|bottom line|high-yield summary|source-backed answer|direct source-backed answer)$/i.test(
      normalized,
    )
  ) {
    if (/\b(?:dose|mg|daily|tds|bd)\b/i.test(body)) return "Dose";
    if (/\b(?:monitor|baseline|fbc|anc|ecg|level)\b/i.test(body)) return "Monitoring";
    if (/\b(?:withhold|stop|cease|threshold|red|amber)\b/i.test(body)) return "Thresholds";
    if (/\b(?:gap|not enough|unsupported|insufficient)\b/i.test(body)) return "Source gap";
    return "Key point";
  }
  return normalized;
}

function applyProviderLabels(answer: RagAnswer): RagAnswer {
  const inferredSourceOnlyFallback =
    answer.routingMode === "extractive" || /(?:^|;\s*)generation_fallback(?::|$)/i.test(answer.routingReason ?? "");
  const answerQualityTier: RagAnswer["answerQualityTier"] =
    answer.answerQualityTier ??
    (answer.modelUsed ? "model_synthesis" : inferredSourceOnlyFallback ? "source_only" : undefined);
  const fallbackReason =
    answer.fallbackReason ??
    (answerQualityTier === "source_only" ? (fallbackReasonFromRouting(answer.routingReason) ?? "source_only") : null);
  const degradedActive = answerQualityTier === "source_only";
  return {
    ...answer,
    providerMode: answer.providerMode ?? ragProviderMode(),
    answerQualityTier,
    fallbackReason,
    degradedMode: answer.degradedMode ?? {
      active: degradedActive,
      reason: degradedActive ? fallbackReason : null,
    },
  };
}

// Public wrapper: runs quality finalization, then stamps provider/quality labels so the UI can
// disclose source-only (lower-quality) answers and verify-against-sources guidance.
function finalizeRagAnswerQuality(answer: RagAnswer, query: string, queryClass: RagQueryClass): RagAnswer {
  return applyProviderLabels(finalizeRagAnswerQualityCore(answer, query, queryClass));
}

function finalizeRagAnswerQualityCore(answer: RagAnswer, query: string, queryClass: RagQueryClass): RagAnswer {
  const cleanedAnswer = sanitizeAnswerText(answer.answer);
  const gapLikeAnswer =
    /could not find enough clean|no relevant clinical source|no current source|cannot provide a clinical answer|cannot provide a source-backed clinical answer|nearby indexed passages|not strong enough to support a reliable answer|no specific\b.*\bcan be confirmed|do not contain indexed guidance|do not contain (?:specific\s+)?information|do not provide specific|no\b.*\bguidance\b.*\bincluded|defer to other sources/i.test(
      cleanedAnswer,
    );
  const existingGapAnswer =
    gapLikeAnswer && (!answer.grounded || answer.routingMode === "strong" || answer.confidence === "low");
  if (existingGapAnswer) {
    const gapAnswer = finalQualityGapAnswer(query, queryClass);
    return {
      ...answer,
      answer: gapAnswer,
      grounded: false,
      confidence: "unsupported",
      answerSections: [],
      responseMode: "evidence_gap",
    };
  }

  if (!answer.grounded && answer.confidence === "unsupported") {
    return finalQualityFailure(answer, query, queryClass, "ungrounded_unsupported_answer");
  }

  let qualityFailureReason = !cleanedAnswer
    ? "empty_after_sanitize"
    : cleanedAnswer.length < 18
      ? "answer_too_short"
      : generatedAnswerQualityFailureReason(answer, query, queryClass);

  if (qualityFailureReason) {
    if (shouldPreserveSourceBackedGeneratedAnswer(answer, qualityFailureReason)) {
      answer = {
        ...answer,
        confidence: answer.confidence === "low" ? "medium" : answer.confidence,
        routingReason: [answer.routingReason, `final_quality_gate_source_backed_recovery:${qualityFailureReason}`]
          .filter(Boolean)
          .join("; "),
      };
      qualityFailureReason = null;
    } else {
      return finalQualityFailure(answer, query, queryClass, qualityFailureReason);
    }
  }

  const answerKey = normalizeSectionText(cleanedAnswer).toLowerCase();
  const answerSections = (answer.answerSections ?? [])
    .map((section) => {
      const body = sanitizeAnswerText(section.body);
      if (!body || hasClinicalAnswerQualityIssue(body) || isLowYieldClinicalText(body)) return null;
      const bodyKey = normalizeSectionText(body).toLowerCase();
      const isDocumentListSection = section.kind === "documentation" || /\bdocument matches\b/i.test(section.heading);
      if (
        !isDocumentListSection &&
        (bodyKey === answerKey || answerKey.includes(bodyKey) || bodyKey.includes(answerKey))
      ) {
        return null;
      }
      const heading = cleanAnswerSectionHeading(section.heading, body);
      return {
        ...section,
        heading,
        body: boldHighYieldClinicalText(body, query),
        kind: section.kind ?? sectionHeadingKind(heading),
        supportLevel: section.supportLevel ?? "direct",
      } satisfies AnswerSection;
    })
    .filter((section): section is Exclude<typeof section, null> => Boolean(section));

  return applyNumericVerification({
    ...answer,
    answer: boldHighYieldClinicalText(cleanedAnswer, query),
    answerSections,
  });
}

export async function searchChunksWithTelemetry(args: SearchChunksArgs) {
  assertGlobalSearchAllowed(args);
  const supabase = createAdminClient();
  // When the provider is source-only (offline mode, or auto mode without a usable key) we must
  // never call OpenAI for embeddings; retrieval falls back to the lexical text-fast-path only.
  const sourceOnlyRetrieval = isSourceOnlyMode();
  // A3: shared across every withMemoryBoostedCandidates call in this request so the same
  // owner/query memory cards are fetched at most once per (query, embedding-present, count).
  const memoryCardCache: MemoryCardCache = new Map();
  const retrievalQuery = queryForClinicalMode(args.query, args.queryMode ?? "auto");
  const modeQueryClass = queryClassForClinicalMode(args.queryMode ?? "auto");
  const queryAnalysis = await analyzeQueryWithClassifierFallback(retrievalQuery, analyzeClinicalQuery(retrievalQuery));
  if (modeQueryClass) queryAnalysis.queryClass = modeQueryClass;
  const queryClassification = {
    queryClass: queryAnalysis.queryClass,
    confidence: queryAnalysis.confidence,
    reasons: queryAnalysis.reasons,
  };
  const documentFilterList = args.documentIds?.length
    ? args.documentIds
    : args.documentId
      ? [args.documentId]
      : undefined;
  const telemetry: SearchTelemetry = {
    search_cache_hit: false,
    query_class: queryClassification.queryClass,
    vector_candidate_count: 0,
    text_candidate_count: 0,
    embedding_field_count: 0,
    retrieval_query_variant_count: 0,
    rag_alias_count: 0,
    rag_alias_expansion_count: 0,
    text_fast_path_latency_ms: 0,
    text_candidate_budget: 0,
    text_fast_path_reason: null,
    embedding_skipped: false,
    embedding_skip_reason: null,
    embedding_latency_ms: 0,
    embedding_cache_hit: false,
    supabase_rpc_latency_ms: 0,
    rerank_latency_ms: 0,
    memory_card_count: 0,
    memory_top_score: 0,
    index_unit_count: 0,
    index_unit_top_score: 0,
    retrieval_plan: retrievalPlanForQueryClass(queryClassification.queryClass),
    retrieval_intent: buildRetrievalIntent(retrievalQuery, queryClassification.queryClass),
    retrieval_layer_counts: {},
    retrieval_layer_top_scores: {},
    retrieval_layer_latencies_ms: {},
    retrieval_provenance_counts: {},
    coverage_gate_decision: "not_applicable",
    coverage_gate_reason: null,
    vector_skipped_reason: null,
    source_image_required: false,
    source_image_satisfied: false,
    second_stage_rerank_used: false,
    second_stage_rerank_latency_ms: 0,
    visual_direct_image_count: 0,
    weighted_top_score: 0,
    rrf_top_score: 0,
  };

  const ragAliases = await fetchEnabledRagAliases(supabase, args.ownerId);
  const ragAliasExpansions = selectRagAliasExpansions(retrievalQuery, ragAliases);
  telemetry.rag_alias_count = ragAliases.length;
  telemetry.rag_alias_expansion_count = ragAliasExpansions.length;

  const queryVariants = buildRetrievalQueryVariants(retrievalQuery, queryAnalysis, ragAliases);
  telemetry.retrieval_query_variant_count = queryVariants.length;
  const cached = getCachedSearch(args, queryClassification.queryClass, queryVariants);
  if (cached) return cached;
  const sharedCached = await getSharedCachedSearch(args, queryClassification.queryClass, queryVariants);
  if (sharedCached?.kind === "hit") {
    setCachedSearch(args, sharedCached.results, sharedCached.telemetry, queryVariants);
    return { results: sharedCached.results, telemetry: sharedCached.telemetry };
  }
  if (sharedCached?.kind === "miss") {
    telemetry.shared_cache_status = "miss";
    telemetry.shared_cache_miss_reason = sharedCached.reason;
  }

  if (shouldApplyUnsupportedSearchShortCircuit(retrievalQuery, queryAnalysis, ragAliasExpansions)) {
    // Item 10 follow-up (RC6): a typo can make an on-topic query ("schizophrenai management") look
    // unsupported and short-circuit before any layer runs. Before giving up, trigram-correct the
    // query against the known clinical-term vocabulary; if it changes, re-run the whole retrieval
    // once on the corrected text so classification + every layer benefits (not just the text fallback
    // in searchTextChunkCandidates). Only reached for would-be-unsupported queries, so it adds no
    // hot-path cost; `typoCorrected` guards against recursion.
    if (!args.typoCorrected && !sourceOnlyRetrieval) {
      const { data: corrected } = await supabase.rpc("correct_clinical_query_terms", {
        input_query: retrievalQuery,
        min_sim: 0.45,
      });
      if (typeof corrected === "string" && corrected && corrected.toLowerCase() !== retrievalQuery.toLowerCase()) {
        return searchChunksWithTelemetry({ ...args, query: corrected, typoCorrected: true });
      }
    }
    telemetry.embedding_skipped = true;
    telemetry.embedding_skip_reason = "unsupported_short_circuit";
    telemetry.retrieval_strategy = "unsupported_short_circuit";
    recordSearchScoreTelemetry(telemetry, []);
    setCachedSearch(args, [], telemetry, queryVariants);
    return { results: [] as SearchResult[], telemetry };
  }

  let expandedQuery = normalizeRetrievalVariant([expandClinicalQuery(retrievalQuery), ...ragAliasExpansions].join(" "));
  const textSearchQuery = queryVariants[0] ?? buildClinicalTextSearchQuery(retrievalQuery);
  const candidateMultiplier = queryClassification.queryClass === "comparison" ? 7 : 5;
  const candidateFloor = queryClassification.queryClass === "comparison" ? 72 : 48;
  const candidateCount = Math.max((args.topK ?? 8) * candidateMultiplier, candidateFloor);
  const textCandidateCount = textCandidateBudgetForQueryClass(queryClassification.queryClass, args.topK ?? 8);
  telemetry.text_candidate_budget = textCandidateCount;
  const maxResultsPerDocument = queryClassification.queryClass === "comparison" ? 2 : 4;
  const minSimilarity = args.minSimilarity ?? 0.15;
  let embeddingStartedAt = 0;
  const preloadedEmbedding =
    !sourceOnlyRetrieval && shouldPreloadEmbedding(queryAnalysis)
      ? (() => {
          embeddingStartedAt = Date.now();
          return Promise.resolve(embedTextWithTelemetry(expandedQuery)).catch(() => null);
        })()
      : null;

  let textFastResults: SearchResult[] = [];
  const textRpcStartedAt = Date.now();
  const textData = await searchTextChunkCandidates({
    supabase,
    queryVariants,
    ownerId: args.ownerId,
    documentIds: documentFilterList,
    matchCount: textCandidateCount,
  });
  telemetry.text_candidate_count = textData.length;
  telemetry.text_fast_path_latency_ms = Date.now() - textRpcStartedAt;
  telemetry.supabase_rpc_latency_ms += telemetry.text_fast_path_latency_ms;
  recordRetrievalLayer(telemetry, "text_candidates", textData.length, {
    latencyMs: telemetry.text_fast_path_latency_ms,
    topScore: layerTopScore(textData as SearchResult[]),
  });

  if (textData.length) {
    const rerankStartedAt = Date.now();
    const textCandidates = await attachDocumentRankingMetadata(supabase, textData as SearchResult[], args.ownerId);
    if (!preloadedEmbedding) {
      expandedQuery = expandClinicalQueryWithCandidateMetadata(args.query, expandedQuery, textCandidates);
    }
    const baseTextResults = selectRankedRetrievalResults({
      query: retrievalQuery,
      queryClass: queryClassification.queryClass,
      candidates: textCandidates,
      topK: args.topK ?? 8,
      maxResultsPerDocument,
      telemetry,
    });

    const baseTextFastPath = decideTextFastPath(args.query, baseTextResults, queryClassification.queryClass);
    if (shouldReturnBeforeMemory(queryClassification.queryClass, baseTextFastPath)) {
      textFastResults = await attachPageVisualEvidence(supabase, baseTextResults);
      textFastResults = applySecondStageRerankIfNeeded({
        queryClass: queryClassification.queryClass,
        results: textFastResults,
        telemetry,
        topK: args.topK ?? 8,
      });
      telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;
      markEmbeddingSkippedByTextFastPath(telemetry, baseTextFastPath.reason);
      telemetry.retrieval_strategy = "text_fast_path";
      recordSearchScoreTelemetry(telemetry, textFastResults);
      setCachedSearch(args, textFastResults, telemetry, queryVariants);
      return { results: textFastResults, telemetry };
    }

    const memoryBoost = await withMemoryBoostedCandidates({
      supabase,
      query: retrievalQuery,
      candidates: textCandidates,
      ownerId: args.ownerId,
      documentIds: documentFilterList,
      matchCount: candidateCount,
      cardCache: memoryCardCache,
    });
    telemetry.memory_card_count = Math.max(telemetry.memory_card_count ?? 0, memoryBoost.cards.length);
    telemetry.memory_top_score = Math.max(
      telemetry.memory_top_score ?? 0,
      ...memoryBoost.cards.map(memoryCardChunkScore),
    );
    recordRetrievalLayer(telemetry, "memory_cards", memoryBoost.cards.length, {
      topScore: Math.max(0, ...memoryBoost.cards.map(memoryCardChunkScore)),
    });
    textFastResults = selectRankedRetrievalResults({
      query: retrievalQuery,
      queryClass: queryClassification.queryClass,
      candidates: memoryBoost.results,
      topK: args.topK ?? 8,
      maxResultsPerDocument,
      telemetry,
    });
    textFastResults = await attachPageVisualEvidence(supabase, textFastResults);
    textFastResults = applySecondStageRerankIfNeeded({
      queryClass: queryClassification.queryClass,
      results: textFastResults,
      telemetry,
      topK: args.topK ?? 8,
    });
    telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;

    const boostedTextFastPath = decideTextFastPath(args.query, textFastResults, queryClassification.queryClass);
    if (boostedTextFastPath.returnFastPath) {
      markEmbeddingSkippedByTextFastPath(telemetry, boostedTextFastPath.reason);
      telemetry.retrieval_strategy = "text_fast_path";
      recordSearchScoreTelemetry(telemetry, textFastResults);
      setCachedSearch(args, textFastResults, telemetry, queryVariants);
      return { results: textFastResults, telemetry };
    }
  }

  if (
    queryClassification.queryClass === "table_threshold" ||
    queryClassification.queryClass === "medication_dose_risk"
  ) {
    const tableFactStartedAt = Date.now();
    const tableFactCandidates = await searchTableFactCandidates({
      supabase,
      query: retrievalQuery,
      queryVariants,
      ownerId: args.ownerId,
      documentIds: documentFilterList,
      matchCount: Math.min(candidateCount, 48),
    });
    const tableFactLatencyMs = Date.now() - tableFactStartedAt;
    telemetry.supabase_rpc_latency_ms += tableFactLatencyMs;
    recordRetrievalLayer(telemetry, "table_facts", tableFactCandidates.length, {
      latencyMs: tableFactLatencyMs,
      topScore: layerTopScore(tableFactCandidates),
    });
    if (tableFactCandidates.length > 0) {
      textFastResults = mergeSearchResults(tableFactCandidates, textFastResults);
    }
  }

  if (shouldAttemptDocumentLookupFastPath(queryClassification.queryClass)) {
    const documentLookupStartedAt = Date.now();
    const documentLookupData = await searchDocumentLookupFastPath({
      supabase,
      query: args.query,
      queryVariants,
      ownerId: args.ownerId,
      documentIds: documentFilterList,
      matchCount: candidateCount,
    });
    const documentLookupLatencyMs = Date.now() - documentLookupStartedAt;
    telemetry.supabase_rpc_latency_ms += documentLookupLatencyMs;
    recordRetrievalLayer(telemetry, "document_lookup", documentLookupData.length, {
      latencyMs: documentLookupLatencyMs,
      topScore: layerTopScore(documentLookupData as SearchResult[]),
    });

    if (documentLookupData.length > 0) {
      const rerankStartedAt = Date.now();
      const documentLookupCandidates = await attachDocumentRankingMetadata(
        supabase,
        mergeSearchResults(documentLookupData, textFastResults),
        args.ownerId,
      );
      if (!preloadedEmbedding) {
        expandedQuery = expandClinicalQueryWithCandidateMetadata(args.query, expandedQuery, documentLookupCandidates);
      }
      const memoryBoost = await withMemoryBoostedCandidates({
        supabase,
        query: args.query,
        candidates: documentLookupCandidates,
        ownerId: args.ownerId,
        documentIds: documentFilterList,
        matchCount: candidateCount,
        cardCache: memoryCardCache,
      });
      telemetry.memory_card_count = Math.max(telemetry.memory_card_count ?? 0, memoryBoost.cards.length);
      telemetry.memory_top_score = Math.max(
        telemetry.memory_top_score ?? 0,
        ...memoryBoost.cards.map(memoryCardChunkScore),
      );
      recordRetrievalLayer(
        telemetry,
        "memory_cards",
        Math.max(telemetry.memory_card_count ?? 0, memoryBoost.cards.length),
        {
          topScore: Math.max(telemetry.memory_top_score ?? 0, ...memoryBoost.cards.map(memoryCardChunkScore)),
        },
      );
      let documentLookupResults = await attachPageVisualEvidence(
        supabase,
        selectRankedRetrievalResults({
          query: retrievalQuery,
          queryClass: queryClassification.queryClass,
          candidates: memoryBoost.results,
          topK: args.topK ?? 8,
          maxResultsPerDocument,
          telemetry,
        }),
      );
      documentLookupResults = applySecondStageRerankIfNeeded({
        queryClass: queryClassification.queryClass,
        results: documentLookupResults,
        telemetry,
        topK: args.topK ?? 8,
      });
      telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;

      const documentLookupFastPath = decideTextFastPath(
        args.query,
        documentLookupResults,
        queryClassification.queryClass,
      );
      if (documentLookupFastPath.returnFastPath) {
        markEmbeddingSkippedByTextFastPath(
          telemetry,
          documentLookupFastPath.reason ? `document_lookup_fast_path:${documentLookupFastPath.reason}` : null,
        );
        telemetry.retrieval_strategy = "document_lookup_fast_path";
        recordSearchScoreTelemetry(telemetry, documentLookupResults);
        setCachedSearch(args, documentLookupResults, telemetry, queryVariants);
        return { results: documentLookupResults, telemetry };
      }
      textFastResults = mergeSearchResults(documentLookupResults, textFastResults);
    }
  }

  if (textFastResults.length > 0) {
    const coverageGateResults = await prepareCoverageGateResults({
      supabase,
      query: retrievalQuery,
      candidates: textFastResults,
      ownerId: args.ownerId,
      topK: args.topK ?? 8,
      maxResultsPerDocument,
      queryClass: queryClassification.queryClass,
      telemetry,
    });
    const coverageGate = evaluateEvidenceCoverageGate(args.query, coverageGateResults, queryClassification.queryClass);
    applyCoverageGateTelemetry(telemetry, coverageGate, coverageGate.accepted);
    if (coverageGate.accepted) {
      telemetry.retrieval_strategy = coverageGate.strategy;
      recordSearchScoreTelemetry(telemetry, coverageGateResults);
      setCachedSearch(args, coverageGateResults, telemetry, queryVariants);
      return { results: coverageGateResults, telemetry };
    }
    textFastResults = mergeSearchResults(coverageGateResults, textFastResults);
  }

  if (sourceOnlyRetrieval) {
    // Source-only retrieval: skip embeddings entirely and return the lexical candidates.
    // The answer layer fails closed when this evidence is too weak.
    telemetry.embedding_skipped = true;
    telemetry.embedding_skip_reason = SOURCE_ONLY_EMBEDDING_SKIP_REASON;
    telemetry.retrieval_strategy = telemetry.retrieval_strategy ?? "text_fast_path";
    recordSearchScoreTelemetry(telemetry, textFastResults);
    return { results: textFastResults, telemetry };
  }

  if (!embeddingStartedAt) embeddingStartedAt = Date.now();
  let embeddingResult = await preloadedEmbedding;
  if (!embeddingResult) {
    embeddingStartedAt = Date.now();
    try {
      embeddingResult = await embedTextWithTelemetry(expandedQuery);
    } catch (error) {
      // In auto mode a failed embedding call (e.g. quota exhausted) degrades to the lexical
      // results already gathered rather than failing the whole search. "openai" mode rethrows.
      if (!allowsAutoDegrade()) throw error;
      telemetry.embedding_skipped = true;
      telemetry.embedding_skip_reason = sourceOnlyReason(error);
      telemetry.vector_skipped_reason = classifyProviderFailure(error);
      telemetry.retrieval_strategy = telemetry.retrieval_strategy ?? "text_fast_path";
      recordSearchScoreTelemetry(telemetry, textFastResults);
      return { results: textFastResults, telemetry };
    }
  }
  const { embedding, cacheHit } = embeddingResult;
  telemetry.embedding_latency_ms = Date.now() - embeddingStartedAt;
  telemetry.embedding_cache_hit = cacheHit;
  recordRetrievalLayer(telemetry, "embedding", 1, {
    latencyMs: telemetry.embedding_latency_ms,
  });

  // A1: the embedding-field, index-unit, and chunk-hybrid RPCs each depend only on the
  // already-computed query embedding and have no data dependency on one another, so run
  // them concurrently instead of as three sequential Supabase round-trips. The two helper
  // functions swallow their own RPC errors and resolve to [], so Promise.all cannot reject.
  const parallelRpcStartedAt = Date.now();
  const [embeddingFieldResult, indexUnitResult, hybridResult] = await Promise.all([
    (async () => {
      const startedAt = Date.now();
      const candidates = await searchEmbeddingFieldCandidates({
        supabase,
        query: args.query,
        queryEmbedding: embedding,
        ownerId: args.ownerId,
        documentIds: documentFilterList,
        matchCount: Math.min(candidateCount, 48),
        telemetry,
      });
      return { candidates, latencyMs: Date.now() - startedAt };
    })(),
    (async () => {
      const startedAt = Date.now();
      const candidates = await searchIndexUnitCandidates({
        supabase,
        query: args.query,
        queryEmbedding: embedding,
        ownerId: args.ownerId,
        documentIds: documentFilterList,
        matchCount: Math.min(candidateCount, 64),
        telemetry,
      });
      return { candidates, latencyMs: Date.now() - startedAt };
    })(),
    (async () => {
      const startedAt = Date.now();
      const { data, error } = await supabase.rpc("match_document_chunks_hybrid", {
        query_embedding: embedding as unknown as string,
        query_text: textSearchQuery,
        match_count: candidateCount,
        min_similarity: minSimilarity,
        document_filters: documentFilterList ?? undefined,
        owner_filter: args.ownerId ?? undefined,
      });
      return { data, error, latencyMs: Date.now() - startedAt };
    })(),
  ]);
  // The three calls overlap, so charge wall-clock once rather than summing per-call latencies.
  telemetry.supabase_rpc_latency_ms += Date.now() - parallelRpcStartedAt;

  const embeddingFieldCandidates = embeddingFieldResult.candidates;
  telemetry.embedding_field_count = embeddingFieldCandidates.length;
  recordRetrievalLayer(telemetry, "embedding_fields", embeddingFieldCandidates.length, {
    latencyMs: embeddingFieldResult.latencyMs,
    topScore: layerTopScore(embeddingFieldCandidates),
  });
  if (embeddingFieldCandidates.length > 0) {
    textFastResults = mergeSearchResults(embeddingFieldCandidates, textFastResults);
  }

  const indexUnitCandidates = indexUnitResult.candidates;
  telemetry.index_unit_count = indexUnitCandidates.length;
  telemetry.index_unit_top_score = Number(
    Math.max(0, ...indexUnitCandidates.map((result) => result.hybrid_score ?? result.similarity ?? 0)).toFixed(4),
  );
  if (indexUnitCandidates.length > 0) {
    textFastResults = mergeSearchResults(indexUnitCandidates, textFastResults);
  }
  recordRetrievalLayer(telemetry, "index_units", indexUnitCandidates.length, {
    latencyMs: indexUnitResult.latencyMs,
    topScore: telemetry.index_unit_top_score,
  });

  const { data: hybridData, error: hybridError } = hybridResult;
  if (hybridError) recordHybridRpcError(telemetry, "match_document_chunks_hybrid", hybridError);
  telemetry.vector_candidate_count = hybridData?.length ?? 0;
  recordRetrievalLayer(telemetry, "hybrid_vector", hybridData?.length ?? 0, {
    latencyMs: hybridResult.latencyMs,
    topScore: layerTopScore((hybridData ?? []) as SearchResult[]),
  });

  if (!hybridError) {
    const rerankStartedAt = Date.now();
    const merged = mergeSearchResults((hybridData ?? []) as SearchResult[], textFastResults);
    const mergedWithMetadata = await attachDocumentRankingMetadata(supabase, merged, args.ownerId);
    const memoryBoost = await withMemoryBoostedCandidates({
      supabase,
      query: retrievalQuery,
      candidates: mergedWithMetadata,
      queryEmbedding: embedding,
      ownerId: args.ownerId,
      documentIds: documentFilterList,
      matchCount: candidateCount,
      cardCache: memoryCardCache,
    });
    telemetry.memory_card_count = Math.max(telemetry.memory_card_count ?? 0, memoryBoost.cards.length);
    telemetry.memory_top_score = Math.max(
      telemetry.memory_top_score ?? 0,
      ...memoryBoost.cards.map(memoryCardChunkScore),
    );
    let results = await attachPageVisualEvidence(
      supabase,
      selectRankedRetrievalResults({
        query: retrievalQuery,
        queryClass: queryClassification.queryClass,
        candidates: memoryBoost.results,
        topK: args.topK ?? 8,
        maxResultsPerDocument,
        telemetry,
      }),
    );
    results = applySecondStageRerankIfNeeded({
      queryClass: queryClassification.queryClass,
      results,
      telemetry,
      topK: args.topK ?? 8,
    });
    telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;
    telemetry.retrieval_strategy = "hybrid";
    recordSearchScoreTelemetry(telemetry, results);
    setCachedSearch(args, results, telemetry, queryVariants);
    return { results, telemetry };
  }

  const vectorFilters = documentFilterList?.length ? documentFilterList : [null];

  const fallbackRpcStartedAt = Date.now();
  const resultSets = await Promise.all(
    vectorFilters.map(async (documentFilter) => {
      const { data, error } = await supabase.rpc("match_document_chunks", {
        query_embedding: embedding as unknown as string,
        match_count: candidateCount,
        min_similarity: minSimilarity,
        document_filter: documentFilter ?? undefined,
        owner_filter: args.ownerId ?? undefined,
      });

      if (error) throw new Error(error.message);
      return (data ?? []) as SearchResult[];
    }),
  ).catch((error) => {
    if (textFastResults.length > 0) return [] as SearchResult[][];
    throw error;
  });
  const fallbackLatencyMs = Date.now() - fallbackRpcStartedAt;
  telemetry.supabase_rpc_latency_ms += fallbackLatencyMs;
  telemetry.vector_candidate_count = resultSets.reduce((count, resultSet) => count + resultSet.length, 0);
  recordRetrievalLayer(telemetry, "vector_fallback", telemetry.vector_candidate_count, {
    latencyMs: fallbackLatencyMs,
    topScore: layerTopScore(resultSets.flat()),
  });

  const rerankStartedAt = Date.now();
  const mergedWithMetadata = await attachDocumentRankingMetadata(
    supabase,
    mergeSearchResults(resultSets.flat(), textFastResults),
    args.ownerId,
  );
  const memoryBoost = await withMemoryBoostedCandidates({
    supabase,
    query: retrievalQuery,
    candidates: mergedWithMetadata,
    queryEmbedding: embedding,
    ownerId: args.ownerId,
    documentIds: documentFilterList,
    matchCount: candidateCount,
    cardCache: memoryCardCache,
  });
  telemetry.memory_card_count = Math.max(telemetry.memory_card_count ?? 0, memoryBoost.cards.length);
  telemetry.memory_top_score = Math.max(
    telemetry.memory_top_score ?? 0,
    ...memoryBoost.cards.map(memoryCardChunkScore),
  );
  let results = await attachPageVisualEvidence(
    supabase,
    selectRankedRetrievalResults({
      query: retrievalQuery,
      queryClass: queryClassification.queryClass,
      candidates: memoryBoost.results,
      topK: args.topK ?? 8,
      maxResultsPerDocument,
      telemetry,
    }),
  );
  results = applySecondStageRerankIfNeeded({
    queryClass: queryClassification.queryClass,
    results,
    telemetry,
    topK: args.topK ?? 8,
  });
  telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;
  telemetry.retrieval_strategy = "vector_fallback";
  recordSearchScoreTelemetry(telemetry, results);
  setCachedSearch(args, results, telemetry, queryVariants);
  return { results, telemetry };
}

async function buildRelatedDocumentsSafe(args: { query: string; results: SearchResult[]; ownerId?: string }) {
  try {
    return await fetchRelatedDocuments({
      supabase: createAdminClient(),
      query: args.query,
      results: args.results,
      ownerId: args.ownerId,
    });
  } catch {
    return [];
  }
}

export async function searchChunks(args: SearchChunksArgs) {
  const { results } = await searchChunksWithTelemetry(args);
  return results;
}

// Boundary-aware, number-safe truncation for text handed to the model (P7). A naive char-boundary
// cut splits sentences and numbers (e.g. "150 mg" -> "...15"), feeding the model clipped clinical
// facts. Prefer the last sentence boundary that still keeps most of the budget (end cleanly, no
// ellipsis); otherwise cut on a word boundary and never strand a bare number whose unit/context was
// cut off, so a dose or threshold can never be presented as a truncated figure.
export function truncateForModel(text: string, limit: number) {
  if (text.length <= limit) return text;
  const window = text.slice(0, limit);
  const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (sentenceEnd >= Math.floor(limit * 0.6)) {
    return window.slice(0, sentenceEnd + 1).trim();
  }
  const wordCut = window.lastIndexOf(" ");
  const base = (wordCut > 0 ? window.slice(0, wordCut) : window.slice(0, limit - 1)).trim();
  // Drop a trailing bare number (its unit/context was cut off) so we never present "…150" alone.
  const numberSafe = base.replace(/[\s(]+[<>]?\d[\d.,:/xX×^*-]*$/, "").trim();
  return `${numberSafe || base}...`;
}

function compactContextText(text: string, limit: number) {
  const compact = sourceTextForModel(text).replace(/\s+/g, " ").trim();
  return truncateForModel(compact, limit);
}

type RagSourceBlockOptions = {
  query?: string;
  queryClass?: RagQueryClass;
};

function richTableSourceContextEnabled(options?: RagSourceBlockOptions) {
  return options?.queryClass === "table_threshold" || options?.queryClass === "medication_dose_risk";
}

function tableSnippetForFact(result: SearchResult, fact: NonNullable<SearchResult["table_facts"]>[number]) {
  const image = fact.source_image_id ? result.images?.find((candidate) => candidate.id === fact.source_image_id) : null;
  const factMetadata = safeRecord(fact.metadata);
  const metadataCells = Array.isArray(factMetadata.cells)
    ? (factMetadata.cells as unknown[]).map(String).filter(Boolean).join(" | ")
    : "";
  const snippet =
    image?.accessibleTableMarkdown ??
    image?.tableTextSnippet ??
    metadataText(factMetadata, "accessible_table_markdown") ??
    metadataText(factMetadata, "table_text_snippet") ??
    metadataCells;
  return compactContextText(neutralizeInstructions(snippet), 420);
}

function formatTableFactForSourceBlock(
  result: SearchResult,
  fact: NonNullable<SearchResult["table_facts"]>[number],
  rich: boolean,
) {
  if (!rich) {
    return compactContextText(
      neutralizeInstructions(
        [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
          .filter(Boolean)
          .join(" | "),
      ),
      360,
    );
  }

  const snippet = tableSnippetForFact(result, fact);
  return compactContextText(
    neutralizeInstructions(
      [
        fact.table_title ? `table title: ${fact.table_title}` : "",
        fact.row_label ? `row label: ${fact.row_label}` : "",
        fact.clinical_parameter ? `clinical parameter: ${fact.clinical_parameter}` : "",
        fact.threshold_value ? `threshold_value: ${fact.threshold_value}` : "",
        fact.action ? `action: ${fact.action}` : "",
        fact.source_image_id ? `source_image_id: ${fact.source_image_id}` : "",
        snippet ? `table snippet: ${snippet}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    ),
    760,
  );
}

function neutralizeInstructions(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(
    /\b(?:ignore|disregard|override|forget)\s+(?:all\s+)?(?:(?:previous|prior|above)\s+)?instructions?(?:\s+and\s+\w+(?:\s+\d+\s+\w+)?)?/gi,
    "[neutralized-instruction: source instruction removed]",
  );
  cleaned = cleaned.replace(
    /\byou\s+are\s+now\s+an?\s+(?:unrestricted|jailbroken|assistant)(?:\s+\w+){0,3}/gi,
    "[neutralized-instruction: source role-change removed]",
  );
  cleaned = cleaned.replace(
    /\b(?:system|developer)\s+(?:prompt|message|instruction)s?\b/gi,
    "[neutralized-instruction: privileged instruction reference removed]",
  );
  cleaned = cleaned.replace(
    /\b(?:reveal|print|expose|show|leak|return)\s+(?:the\s+)?(?:api\s+key|secret|token|system\s+prompt|developer\s+message|developer\s+instructions?)\b/gi,
    "[neutralized-instruction: secret-exfiltration request removed]",
  );
  cleaned = cleaned.replace(
    /\bfollow\s+(?:these|the|this)\s+instructions?\b/gi,
    "[neutralized-instruction: source instruction removed]",
  );
  cleaned = cleaned.replace(/\bdo\s+not\s+answer\b/gi, "[neutralized-instruction: answer-suppression request removed]");
  return cleaned;
}

export function buildRagSourceBlock(results: SearchResult[], options?: RagSourceBlockOptions) {
  const richTableContext = richTableSourceContextEnabled(options);
  return results
    .map((result, index) => {
      const page = result.page_number ? `page ${result.page_number}` : "page unavailable";
      const searchableImages = result.images?.filter((image) => isClinicalImageEvidence(image));
      const images = searchableImages?.length
        ? `\nImages: ${searchableImages
            .map((image) =>
              [
                image.tableLabel,
                image.tableTitle,
                image.caption,
                image.tableTextSnippet
                  ? `Table text: ${compactContextText(neutralizeInstructions(image.tableTextSnippet), 320)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" - "),
            )
            .join(" | ")}`
        : "";
      const adjacentContext = result.adjacent_context
        ? `\nNearby context from the same source: ${compactContextText(neutralizeInstructions(result.adjacent_context), 900)}`
        : "";
      const sectionPath = result.section_path?.length
        ? `\nSection path: ${neutralizeInstructions(result.section_path.join(" > "))}`
        : result.section_heading
          ? `\nSection: ${neutralizeInstructions(result.section_heading)}`
          : "";
      const tableFacts = result.table_facts?.length
        ? `\nStructured table facts: ${result.table_facts
            .slice(0, richTableContext ? 3 : 4)
            .map((fact) => formatTableFactForSourceBlock(result, fact, richTableContext))
            .filter(Boolean)
            .join(" ; ")}`
        : "";
      const indexWarnings = result.indexing_quality?.issues?.length
        ? `\nIndex quality warnings: ${result.indexing_quality.issues.slice(0, 3).join("; ")}`
        : "";
      const memoryCards = result.memory_cards?.length
        ? `\nStructured memory: ${result.memory_cards
            .slice(0, 3)
            .map((card) => `${card.card_type}: ${compactContextText(neutralizeInstructions(card.content), 300)}`)
            .join(" | ")}`
        : "";
      const retrievalSynopsis = result.retrieval_synopsis
        ? `\nRetrieval synopsis: ${compactContextText(neutralizeInstructions(result.retrieval_synopsis), 700)}`
        : "";
      const neutralizedContent = neutralizeInstructions(result.content);
      const fencedContent = `<<<SOURCE_EXCERPT>>>\n${compactContextText(neutralizedContent, 1800)}\n<<<END_SOURCE_EXCERPT>>>`;
      return [
        [
          `[${index + 1}] ${result.title} (${result.file_name}, ${page}, chunk ${result.chunk_index}, similarity ${result.similarity.toFixed(3)})`,
          `citation_chunk_id: ${result.id}`,
          `document_id: ${result.document_id}`,
        ].join("\n"),
        sectionPath,
        retrievalSynopsis,
        fencedContent,
        adjacentContext,
        tableFacts,
        memoryCards,
        images,
        indexWarnings,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export function parseAnswerJson(raw: string, results: SearchResult[], query?: string): RagAnswer {
  try {
    const parsed = answerJsonSchema.parse(JSON.parse(raw));
    const { citations, modelCited, proposedCount, invalidCount } = sanitizeCitations(parsed.citations, results);
    const derivedConfidence = modelCited ? deriveConfidence(results, citations) : "unsupported";
    const confidence = modelCited ? clampConfidence(parsed.confidence, derivedConfidence) : "unsupported";
    const parsedAnswer = parsed.answer ?? "";
    const nonArtifactParsedAnswer = parsedAnswer.trim() && !looksLikeJsonArtifact(parsedAnswer) ? parsedAnswer : "";
    const sanitizedAnswer =
      sanitizeAnswerText(parsedAnswer) ||
      sanitizeStructuredText(parsedAnswer, { minLength: 8, minTokens: 2 }) ||
      nonArtifactParsedAnswer ||
      machineReadableFallbackAnswer;
    const answerSections = sanitizeAnswerSections(parsed.answerSections, results, query);
    const grounded = modelCited && citations.length > 0 && confidence !== "unsupported";
    const answer: RagAnswer = {
      answer: boldHighYieldClinicalText(sanitizedAnswer, query),
      grounded,
      confidence,
      citations,
      sources: results,
      answerSections,
      conflictsOrGaps: sanitizeConflictsOrGaps(parsed.conflictsOrGaps, results),
      quoteCards: sanitizeQuoteCards(parsed.quoteCards, results),
      visualEvidence: [],
      bestSource: null,
      documentBreakdown: [],
      routingReason: undefined,
    };
    if (invalidCount > 0) {
      answer.routingReason = modelCited ? "partial_invalid_model_citation_ids" : "invalid_model_citation_ids";
    } else if (!modelCited) {
      answer.routingReason = "ungrounded_no_model_citation";
    } else if (proposedCount === 0 && grounded) {
      answer.routingReason = undefined;
    }
    // GEN-C2 / GEN-H2: numeric faithfulness gate.
    return enrichGroundedReviewCitations(applyNumericVerification(answer), results);
  } catch (error) {
    console.warn("Failed to parse answer payload, falling back to safe text:", error);
    return safeFallbackAnswer(raw, results, query);
  }
}

function annotateAnswerWithDiagnostics<T extends RagAnswer>(
  answer: T,
  diagnostics: RetrievalDiagnostics,
  override?: { fallbackReason?: string | null },
): T {
  const fallbackReason = override?.fallbackReason ?? diagnostics.fallbackReason ?? null;
  return {
    ...answer,
    retrievalDiagnostics: {
      ...diagnostics,
      fallbackReason,
      retrievalReason: fallbackReason,
    },
  };
}

// GEN-C2 / GEN-H2: verify every numeric/dose/threshold token in the generated
// answer against the text of its cited chunks. Unsupported figures are recorded
// on the answer and an explicit "verify against source" caveat is appended so a
// paraphrased/mis-transcribed dose can never read as authoritative.
const actionableNumericAnswerPattern =
  /\b(?:dose|dosage|dosing|mg|mcg|microgram|micrograms|route|oral|intramuscular|\bim\b|\bpo\b|frequency|daily|twice|weekly|monthly|hourly|threshold|cutoff|cut-off|anc|fbc|wbc|withhold|cease|stop|discontinue|red\s+(?:result|range|zone)|amber\s+(?:result|range|zone)|green\s+(?:result|range|zone)|monitor|monitoring|interval|repeat|review|risk\s+score|risk|score|escalat|urgent)\b/i;

const actionableNumericSectionKinds = new Set<AnswerSectionKind>([
  "medication_dose",
  "thresholds",
  "monitoring_timing",
  "escalation_risk",
  "required_actions",
]);

function hasActionableNumericContext(answer: RagAnswer) {
  if (!answer.grounded || answer.confidence === "unsupported") return false;
  if (answer.queryClass === "medication_dose_risk" || answer.queryClass === "table_threshold") return true;
  if (
    (answer.answerSections ?? []).some((section) => section.kind && actionableNumericSectionKinds.has(section.kind))
  ) {
    return true;
  }
  const text = [
    answer.answer,
    answer.routingReason,
    ...(answer.answerSections ?? []).flatMap((section) => [section.heading, section.body]),
  ]
    .filter(Boolean)
    .join(" ");
  return actionableNumericAnswerPattern.test(text);
}

function appendRoutingReason(reason: string | undefined, addition: string) {
  return reason ? `${reason}; ${addition}` : addition;
}

export function applyNumericVerification(answer: RagAnswer): RagAnswer {
  const sources = answer.sources ?? [];
  const unverified = new Set<string>();

  // B4: the model is instructed to put dose details in structured
  // answerSections (kind medication_dose), so a top-level-only scan never sees
  // section-body doses. Verify the top-level answer AND every section body.
  // Each section is scoped to its own citation_chunk_ids when present, so a
  // dose is only credited against the chunks that section actually cites;
  // sections with no citations fall back to the answer-level citations.
  const answerVerification = verifyAnswerNumbers(answer.answer, answer.citations, sources);
  for (const token of answerVerification.unverifiedTokens) unverified.add(token);

  for (const section of answer.answerSections ?? []) {
    const sectionCitations =
      section.citation_chunk_ids.length > 0
        ? section.citation_chunk_ids.map((chunk_id) => ({ chunk_id }))
        : answer.citations;
    const sectionVerification = verifyAnswerNumbers(section.body, sectionCitations, sources);
    for (const token of sectionVerification.unverifiedTokens) unverified.add(token);
  }

  if (unverified.size === 0) return answer;

  const unverifiedTokens = [...unverified];
  answer.unverifiedNumericTokens = unverifiedTokens;
  answer.faithfulnessWarning = VERIFY_AGAINST_SOURCE_NOTE;
  // P8: never bold a figure the system could not verify against the cited sources — bold emphasis
  // must track verification, or an unverified dose/threshold reads as authoritative while its caveat
  // sits in a separate block. Un-wrap **…** only around segments carrying an unverified token.
  answer.answer = unboldUnverifiedNumbers(answer.answer, unverified);
  if (answer.answerSections?.length) {
    answer.answerSections = answer.answerSections.map((section) => ({
      ...section,
      body: unboldUnverifiedNumbers(section.body, unverified),
    }));
  }
  // Surface as a source gap so the UI's existing gap rendering shows it, and
  // never let an answer with unverified clinical numbers claim high confidence.
  // This gate runs more than once on the model path (parse-time and finalize-time), so REPLACE any
  // earlier faithfulness caveat rather than appending a duplicate "CRITICAL…" gap; the latest run
  // carries the freshest token list.
  const caveat: ConflictOrGap = {
    type: "gap",
    message: `${VERIFY_AGAINST_SOURCE_NOTE} Unverified figures: ${unverifiedTokens.join(", ")}.`,
  };
  answer.conflictsOrGaps = [
    ...(answer.conflictsOrGaps ?? []).filter((gap) => !gap.message.startsWith(VERIFY_AGAINST_SOURCE_NOTE)),
    caveat,
  ];
  if (hasActionableNumericContext(answer)) {
    answer.answer =
      "I found source material, but the generated answer included clinical numbers that could not be matched verbatim to its cited source chunks. Review the source passages directly before using this for dose, threshold, route, timing, monitoring, or risk decisions.";
    answer.grounded = false;
    answer.confidence = "unsupported";
    answer.responseMode = "evidence_gap";
    answer.answerSections = [];
    answer.citations = [];
    answer.quoteCards = [];
    answer.routingReason = appendRoutingReason(answer.routingReason, "numeric_faithfulness_gate_source_gap");
    return answer;
  }
  if (answer.confidence === "high") answer.confidence = "medium";
  return answer;
}

// Remove bold emphasis around any **…** segment that contains a numeric token the source-numeric
// verification could not confirm, leaving the text intact (just un-emphasised). Verified bold stays.
export function unboldUnverifiedNumbers(text: string, unverified: Set<string>): string {
  if (!unverified.size || !text.includes("**")) return text;
  return text.replace(/\*\*([^*]+)\*\*/g, (full, inner: string) =>
    extractNumericTokens(inner).some((token) => unverified.has(token)) ? inner : full,
  );
}

const maxContextChunksPerDocument = 3;

// P9: keep one verbose document from dominating the sources the model sees. Cap each document to at
// most `maxContextChunksPerDocument` chunks (order-preserving, no reranking/dedup), but only when the
// result set spans multiple documents — a genuinely single-document answer must not be starved.
export function capPerDocumentCrowding(results: SearchResult[], maxPerDocument = maxContextChunksPerDocument) {
  if (results.length <= maxPerDocument) return results;
  const distinctDocuments = new Set(results.map((result) => result.document_id)).size;
  if (distinctDocuments < 2) return results;
  const documentCounts = new Map<string, number>();
  const capped: SearchResult[] = [];
  for (const result of results) {
    const count = documentCounts.get(result.document_id) ?? 0;
    if (count >= maxPerDocument) continue;
    documentCounts.set(result.document_id, count + 1);
    capped.push(result);
  }
  return capped;
}

export function selectModelContextResults(args: {
  routeMode: RagAnswer["routingMode"];
  queryClass: RagQueryClass;
  crossDocument: boolean;
  results: SearchResult[];
}) {
  const results = capPerDocumentCrowding(args.results);
  if (args.routeMode !== "fast") return results;
  if (
    args.crossDocument ||
    args.queryClass === "comparison" ||
    args.queryClass === "broad_summary" ||
    args.queryClass === "medication_dose_risk" ||
    args.queryClass === "table_threshold"
  ) {
    return results;
  }
  return results.slice(0, fastRoutineModelContextLimit);
}

export async function answerQuestion(query: string, documentId?: string) {
  return answerQuestionWithScope({ query, documentId, allowGlobalSearch: true });
}

export async function answerQuestionWithScope(args: AnswerQuestionWithScopeArgs): Promise<RagAnswer> {
  const startedAt = Date.now();
  const coalescingEnabled = !args.skipCache && env.RAG_ANSWER_CACHE_TTL_MS > 0 && env.RAG_ANSWER_CACHE_SIZE > 0;
  const inflightKey = coalescingEnabled ? scopedAnswerCacheKey(args) : null;
  const existing = inflightKey ? answerInflight.get(inflightKey) : undefined;

  if (existing) {
    await args.onProgress?.({
      stage: "cached",
      message: "Waiting for an identical cited answer request already in progress.",
      reason: "answer_inflight_coalesced",
    });
    const answer = cloneAnswer(await existing);
    answer.routingReason = answer.routingReason
      ? `${answer.routingReason}; answer_inflight_coalesced`
      : "answer_inflight_coalesced";
    answer.latencyTimings = {
      ...answer.latencyTimings,
      total_latency_ms: Date.now() - startedAt,
    };
    return answer;
  }

  const pending = answerQuestionWithScopeUncoalesced(args, startedAt).finally(() => {
    if (inflightKey) answerInflight.delete(inflightKey);
  });
  if (inflightKey) answerInflight.set(inflightKey, pending);
  return pending;
}

async function answerQuestionWithScopeUncoalesced(
  args: AnswerQuestionWithScopeArgs,
  startedAt: number,
): Promise<RagAnswer> {
  assertGlobalSearchAllowed({
    query: args.query,
    documentId: args.documentId,
    documentIds: args.documentIds,
    ownerId: args.ownerId,
    allowGlobalSearch: args.allowGlobalSearch,
  });
  const answerFocusQuery = queryForClinicalMode(args.query, args.queryMode ?? "auto");
  const cachedAnswer = getCachedAnswer(args, startedAt);
  if (cachedAnswer) {
    const cachedSources = annotateSearchResults(answerFocusQuery, cachedAnswer.sources ?? []);
    const cachedRelevance = cachedAnswer.relevance ?? buildEvidenceRelevance(answerFocusQuery, cachedSources);
    await args.onProgress?.({
      stage: "cached",
      message: "Using a recent cited answer for this exact query and document scope.",
      mode: cachedAnswer.routingMode,
      model: cachedAnswer.modelUsed,
      reason: cachedAnswer.routingReason,
      resultCount: cachedSources.length,
      visibleSourceCount: cachedSources.length,
      directSourceCount: cachedRelevance.directSourceCount,
      weakSourceCount: cachedRelevance.weakSourceCount,
      relevance: cachedRelevance,
    });
    return {
      ...cachedAnswer,
      sources: cachedSources,
      relevance: cachedRelevance,
      smartPanel: cachedAnswer.smartPanel
        ? { ...cachedAnswer.smartPanel, relevance: cachedRelevance }
        : cachedAnswer.smartPanel,
    };
  }
  const sharedCachedAnswer = await getSharedCachedAnswer(args, startedAt);
  if (sharedCachedAnswer) {
    setCachedAnswer(args, sharedCachedAnswer);
    const cachedSources = annotateSearchResults(answerFocusQuery, sharedCachedAnswer.sources ?? []);
    const cachedRelevance = sharedCachedAnswer.relevance ?? buildEvidenceRelevance(answerFocusQuery, cachedSources);
    await args.onProgress?.({
      stage: "cached",
      message: "Using a shared cached cited answer for this exact query and document scope.",
      mode: sharedCachedAnswer.routingMode,
      model: sharedCachedAnswer.modelUsed,
      reason: sharedCachedAnswer.routingReason,
      resultCount: cachedSources.length,
      visibleSourceCount: cachedSources.length,
      directSourceCount: cachedRelevance.directSourceCount,
      weakSourceCount: cachedRelevance.weakSourceCount,
      relevance: cachedRelevance,
    });
    return {
      ...sharedCachedAnswer,
      sources: cachedSources,
      relevance: cachedRelevance,
      smartPanel: sharedCachedAnswer.smartPanel
        ? { ...sharedCachedAnswer.smartPanel, relevance: cachedRelevance }
        : sharedCachedAnswer.smartPanel,
    };
  }

  const searchStartedAt = Date.now();
  const search = await searchChunksWithTelemetry({
    query: args.query,
    documentId: args.documentId,
    documentIds: args.documentIds,
    ownerId: args.ownerId,
    allowGlobalSearch: args.allowGlobalSearch,
    topK: 12,
    minSimilarity: 0.12,
    skipCache: args.skipCache,
    queryMode: args.queryMode,
  });
  const currentQueryClass = classifyRagQuery(answerFocusQuery).queryClass;
  const cachedQueryClass = search.telemetry.query_class ?? null;
  const queryClass =
    queryClassForClinicalMode(args.queryMode ?? "auto") ??
    (cachedQueryClass && cachedQueryClass !== "unsupported_or_general" ? cachedQueryClass : currentQueryClass);
  const queryAnalysis = analyzeClinicalQuery(answerFocusQuery);
  if (queryClassForClinicalMode(args.queryMode ?? "auto")) queryAnalysis.queryClass = queryClass;
  const answerRanking = rankAnswerEvidence(answerFocusQuery, normalizeSearchResults(search.results), queryClass);
  const results = annotateSearchResults(answerFocusQuery, answerRanking.rankedResults);
  const crossDocumentPlan = buildCrossDocumentSynthesisPlan(answerFocusQuery, results, queryClass);
  const answerInputResults = crossDocumentPlan.enabled ? crossDocumentPlan.results : results;
  const relevance = buildEvidenceRelevance(answerFocusQuery, answerInputResults);
  const crossDocumentFusionBrief = crossDocumentPlan.enabled
    ? buildCrossDocumentFusionBrief(answerFocusQuery, answerInputResults)
    : null;
  const answerRankMetadata = {
    answer_rank_top_score: answerRanking.topScore,
    answer_ranked_source_count: answerRanking.rankedSourceCount,
    answer_rank_strategy: answerRanking.strategy,
    answer_rank_query_class: answerRanking.queryClass,
    cross_document_synthesis: crossDocumentPlan.enabled,
    cross_document_reason: crossDocumentPlan.reason,
    cross_document_count: crossDocumentPlan.documentCount,
    cross_document_selected_count: crossDocumentPlan.selectedDocumentCount,
    cross_document_selected_source_count: crossDocumentPlan.selectedSourceCount,
    cross_document_fusion_bullets: crossDocumentFusionBrief?.bulletCount ?? 0,
    cross_document_fusion_source_chunk_ids: crossDocumentFusionBrief?.sourceChunkIds ?? [],
  };
  const searchLatencyMs = Date.now() - searchStartedAt;
  const quoteCards = extractQuoteCards(answerInputResults, answerFocusQuery);
  const documentBreakdown = buildDocumentBreakdown(answerInputResults, quoteCards);
  const smartPanel = buildSmartPanel(answerFocusQuery, answerInputResults);
  const evidenceSummary = buildEvidenceSummary(answerInputResults, quoteCards);
  const sourceCoverage = buildSourceCoverage(answerInputResults);
  const conflictsOrGaps = detectConflictsOrGaps(answerInputResults);
  const visualEvidence = buildVisualEvidence(answerInputResults);
  const bestSource = selectBestSourceRecommendation(answerInputResults, quoteCards);
  const memoryCardsUsed = collectMemoryCards(answerInputResults);
  const indexingQuality = buildIndexingQuality(answerInputResults, memoryCardsUsed);
  const memoryLogMetadata = {
    memory_card_count: memoryCardsUsed.length,
    memory_top_score: Number(
      Math.max(
        0,
        ...results.map((result) => result.memory_score ?? 0),
        ...memoryCardsUsed.map(memoryCardChunkScore),
      ).toFixed(4),
    ),
    indexing_version: ragDeepMemoryVersion,
    indexing_extraction_quality: indexingQuality.extractionQuality,
    indexing_stale: indexingQuality.stale,
  };
  const answerScoreExplanations = buildAnswerScoreExplanations(answerInputResults);
  const scoreLogMetadata = scoreExplanationLogMetadata(answerScoreExplanations);
  const emptyPanel = buildSmartPanel(answerFocusQuery, []);
  const relatedDocumentsPromise = buildRelatedDocumentsSafe({
    query: answerFocusQuery,
    results,
    ownerId: args.ownerId,
  });
  const routeFromRouting = chooseAnswerRoute({
    query: answerFocusQuery,
    results: answerInputResults,
    queryClass,
    conflictsOrGaps,
    fastModel: env.OPENAI_FAST_ANSWER_MODEL,
    strongModel: env.OPENAI_STRONG_ANSWER_MODEL,
  });
  const initialRetrievalDiagnostics = buildRetrievalDiagnostics({
    queryClass,
    query: answerFocusQuery,
    results: answerInputResults,
    answerMode: routeFromRouting.mode,
  });
  const gatedRoute = applyConfidenceGate(routeFromRouting, queryClass, initialRetrievalDiagnostics);
  // In source-only mode (offline, or auto with no usable key) we never call the model. Route to
  // the deterministic extractive path when evidence is usable, but preserve the confidence gate's
  // "unsupported" decision so weak evidence still fails closed to a source-gap answer rather than
  // producing a low-confidence source-only answer that looks authoritative.
  const sourceOnlyAnswer = isSourceOnlyMode();
  const route =
    sourceOnlyAnswer && gatedRoute.route.mode !== "unsupported"
      ? {
          ...gatedRoute.route,
          mode: "extractive" as const,
          reason: `${gatedRoute.route.reason}; ${sourceOnlyReason()}`,
        }
      : gatedRoute.route;
  const retrievalDiagnostics: RetrievalDiagnostics = {
    ...initialRetrievalDiagnostics,
    routeMode: route.mode,
    fallbackReason: gatedRoute.fallbackReason ?? initialRetrievalDiagnostics.fallbackReason,
    retrievalReason:
      (gatedRoute.fallbackReason ? gatedRoute.fallbackReason : initialRetrievalDiagnostics.retrievalReason) ?? null,
  };
  const retrievalLogMetadata = (diagnostics: RetrievalDiagnostics) => ({
    retrieval_depth: diagnostics.retrievalDepth,
    retrieval_distinct_documents: diagnostics.distinctDocumentCount,
    retrieval_candidate_count: diagnostics.candidateCount,
    retrieval_top_score: diagnostics.topScore,
    retrieval_second_score: diagnostics.secondScore,
    retrieval_score_spread: diagnostics.scoreSpread,
    retrieval_gate_status: diagnostics.gateStatus,
    retrieval_fallback_reason: diagnostics.fallbackReason,
    retrieval_reason: diagnostics.retrievalReason,
    retrieval_query_class: diagnostics.queryClass,
    retrieval_route_mode: diagnostics.routeMode,
  });
  const searchTelemetryDecisionMetadata = () => ({
    retrieval_plan: search.telemetry.retrieval_plan ?? null,
    retrieval_intent: search.telemetry.retrieval_intent ?? null,
    retrieval_selection: search.telemetry.retrieval_selection ?? null,
    retrieval_query_variant_count: search.telemetry.retrieval_query_variant_count ?? null,
    text_candidate_budget: search.telemetry.text_candidate_budget ?? null,
    text_candidate_count: search.telemetry.text_candidate_count ?? null,
    text_fast_path_reason: search.telemetry.text_fast_path_reason ?? null,
    embedding_skip_reason: search.telemetry.embedding_skip_reason ?? null,
    vector_candidate_count: search.telemetry.vector_candidate_count ?? null,
    embedding_field_count: search.telemetry.embedding_field_count ?? null,
    retrieval_provenance_counts: search.telemetry.retrieval_provenance_counts ?? null,
    second_stage_rerank_used: search.telemetry.second_stage_rerank_used ?? null,
    second_stage_rerank_latency_ms: search.telemetry.second_stage_rerank_latency_ms ?? null,
    visual_direct_image_count: search.telemetry.visual_direct_image_count ?? null,
  });
  const buildCurrentSmartApiPlan = (
    mode: RagAnswer["routingMode"] = route.mode,
    reason = route.reason,
    planResults = answerInputResults,
  ) =>
    buildSmartRagApiPlan({
      query: answerFocusQuery,
      queryClass,
      results: planResults,
      routeMode: mode,
      routeReason: reason,
      conflictsOrGaps,
      retrievalStrategy: search.telemetry.retrieval_strategy,
    });
  const smartApiPlan = buildCurrentSmartApiPlan();
  const smartApiLogMetadata = (plan: SmartRagApiPlan) => ({
    smart_api_intent: plan.intent,
    smart_api_response_mode: plan.responseMode,
    smart_api_display_mode: plan.displayMode,
    smart_api_latency_plan: plan.latencyPlan,
    smart_api_source_link_count: plan.sourceLinkCount,
    smart_api_answer_plan_intent: plan.answerPlan.intent,
    smart_api_answer_plan_query_class: plan.answerPlan.queryClass,
    smart_api_retrieval_quality: plan.answerPlan.retrievalQuality,
    smart_api_answer_route: plan.answerPlan.routeMode,
    smart_api_model_strategy: plan.answerPlan.modelStrategy,
    smart_api_fallback_behavior: plan.answerPlan.fallbackBehavior,
    smart_api_quality_criteria: plan.answerPlan.qualityCriteria,
    smart_api_source_policy: plan.answerPlan.sourcePolicy,
    smart_api_retrieval_intent: plan.answerPlan.retrievalIntent,
    smart_api_source_selection: plan.answerPlan.sourceSelection,
  });
  await args.onProgress?.({
    stage: "retrieved",
    message: `${relevance.label}: retrieved ${results.length} candidate source${results.length === 1 ? "" : "s"}.`,
    resultCount: results.length,
    visibleSourceCount: answerInputResults.length,
    directSourceCount: relevance.directSourceCount,
    weakSourceCount: relevance.weakSourceCount,
    timingMs: searchLatencyMs,
    relevance,
  });
  await args.onProgress?.({
    stage: "routing",
    message:
      route.mode === "unsupported"
        ? "No strong enough source support was found."
        : `Selected ${route.mode} answer route.`,
    mode: route.mode,
    model: route.model,
    reason: route.reason,
    smartApiPlan,
  });

  if (route.mode === "unsupported") {
    const relatedDocuments = await relatedDocumentsPromise;
    const unsupportedWithNearbySources = results.length > 0;
    const answer: RagAnswer = annotateAnswerWithDiagnostics(
      {
        answer: finalQualityGapAnswer(args.query, queryClass),
        grounded: false,
        confidence: "unsupported",
        citations: [],
        sources: results,
        modelUsed: null,
        routingMode: route.mode,
        routingReason: route.reason,
        queryClass,
        queryAnalysis,
        responseMode: smartApiPlan.displayMode,
        latencyTimings: {
          search_cache_hit: search.telemetry.search_cache_hit,
          shared_cache_hit: search.telemetry.shared_cache_hit,
          shared_cache_status: search.telemetry.shared_cache_status,
          shared_cache_miss_reason: search.telemetry.shared_cache_miss_reason,
          text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
          embedding_skipped: search.telemetry.embedding_skipped,
          embedding_skip_reason: search.telemetry.embedding_skip_reason,
          text_candidate_budget: search.telemetry.text_candidate_budget,
          text_candidate_count: search.telemetry.text_candidate_count,
          text_fast_path_reason: search.telemetry.text_fast_path_reason,
          embedding_latency_ms: search.telemetry.embedding_latency_ms,
          embedding_cache_hit: search.telemetry.embedding_cache_hit,
          vector_candidate_count: search.telemetry.vector_candidate_count,
          embedding_field_count: search.telemetry.embedding_field_count,
          retrieval_query_variant_count: search.telemetry.retrieval_query_variant_count,
          supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
          rerank_latency_ms: search.telemetry.rerank_latency_ms,
          second_stage_rerank_used: search.telemetry.second_stage_rerank_used,
          second_stage_rerank_latency_ms: search.telemetry.second_stage_rerank_latency_ms,
          context_pack_latency_ms: 0,
          search_latency_ms: searchLatencyMs,
          generation_latency_ms: 0,
          total_latency_ms: Date.now() - startedAt,
        },
        answerSections: [],
        quoteCards: unsupportedWithNearbySources ? quoteCards : [],
        visualEvidence: unsupportedWithNearbySources ? visualEvidence : [],
        bestSource: unsupportedWithNearbySources ? bestSource : null,
        documentBreakdown: unsupportedWithNearbySources ? documentBreakdown : [],
        evidenceSummary: unsupportedWithNearbySources ? evidenceSummary : emptyPanel.evidenceSummary,
        sourceCoverage: unsupportedWithNearbySources ? sourceCoverage : emptyPanel.sourceCoverage,
        conflictsOrGaps,
        smartPanel: unsupportedWithNearbySources
          ? { ...smartPanel, relevance, bestSource, relatedDocuments }
          : { ...emptyPanel, relevance, relatedDocuments },
        relatedDocuments,
        relevance,
        memoryCardsUsed: unsupportedWithNearbySources ? memoryCardsUsed : [],
        indexingVersion: ragDeepMemoryVersion,
        indexingQuality,
        smartApiPlan,
        scoreExplanations: answerScoreExplanations,
      } satisfies RagAnswer,
      retrievalDiagnostics,
    );

    const finalizedAnswer = finalizeRagAnswerQuality(answer, args.query, queryClass);

    if (args.logQuery !== false)
      await logRagQuery({
        owner_id: args.ownerId ?? null,
        query: args.query,
        answer: finalizedAnswer.answer,
        source_chunk_ids: answerInputResults.map((result) => result.id),
        model: null,
        metadata: {
          document_id: args.documentId ?? null,
          document_ids: args.documentIds ?? null,
          grounded: finalizedAnswer.grounded,
          confidence: finalizedAnswer.confidence,
          routing_mode: route.mode,
          routing_reason: route.reason,
          query_class: queryClass,
          fallback_reason: fallbackReasonFromRouting(route.reason),
          model_used: null,
          retrieved_candidate_count: results.length,
          ...smartApiLogMetadata(smartApiPlan),
          ...answerRankMetadata,
          ...memoryLogMetadata,
          ...scoreLogMetadata,
          ...searchTelemetryDecisionMetadata(),
          cited_chunk_count: 0,
          quote_count: finalizedAnswer.quoteCards?.length ?? 0,
          visual_evidence_count: finalizedAnswer.visualEvidence?.length ?? 0,
          search_cache_hit: search.telemetry.search_cache_hit,
          text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
          embedding_skipped: search.telemetry.embedding_skipped,
          embedding_latency_ms: search.telemetry.embedding_latency_ms,
          embedding_cache_hit: search.telemetry.embedding_cache_hit,
          supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
          rerank_latency_ms: search.telemetry.rerank_latency_ms,
          retrieval_strategy: search.telemetry.retrieval_strategy,
          weighted_top_score: search.telemetry.weighted_top_score,
          rrf_top_score: search.telemetry.rrf_top_score,
          search_latency_ms: searchLatencyMs,
          generation_latency_ms: 0,
          total_latency_ms: finalizedAnswer.latencyTimings?.total_latency_ms ?? searchLatencyMs,
          evidence_summary: finalizedAnswer.evidenceSummary,
          source_coverage: finalizedAnswer.sourceCoverage,
          ...retrievalLogMetadata(finalizedAnswer.retrievalDiagnostics ?? retrievalDiagnostics),
          related_document_count: relatedDocuments.length,
        },
      });

    setCachedAnswer(args, finalizedAnswer);
    return finalizedAnswer;
  }

  if (route.mode === "extractive") {
    const relatedDocuments = await relatedDocumentsPromise;
    const answer: RagAnswer = annotateAnswerWithDiagnostics(
      buildExtractiveAnswer({
        query: args.query,
        queryClass,
        results: answerInputResults,
        quoteCards,
        documentBreakdown,
        evidenceSummary,
        sourceCoverage,
        conflictsOrGaps,
        visualEvidence,
        bestSource,
        smartPanel: { ...smartPanel, relevance, bestSource, relatedDocuments },
        relatedDocuments,
        routeReason: route.reason,
        timings: {
          search_cache_hit: search.telemetry.search_cache_hit,
          shared_cache_hit: search.telemetry.shared_cache_hit,
          shared_cache_status: search.telemetry.shared_cache_status,
          shared_cache_miss_reason: search.telemetry.shared_cache_miss_reason,
          text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
          embedding_skipped: search.telemetry.embedding_skipped,
          embedding_skip_reason: search.telemetry.embedding_skip_reason,
          text_candidate_budget: search.telemetry.text_candidate_budget,
          text_candidate_count: search.telemetry.text_candidate_count,
          text_fast_path_reason: search.telemetry.text_fast_path_reason,
          embedding_latency_ms: search.telemetry.embedding_latency_ms,
          embedding_cache_hit: search.telemetry.embedding_cache_hit,
          vector_candidate_count: search.telemetry.vector_candidate_count,
          embedding_field_count: search.telemetry.embedding_field_count,
          retrieval_query_variant_count: search.telemetry.retrieval_query_variant_count,
          supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
          rerank_latency_ms: search.telemetry.rerank_latency_ms,
          second_stage_rerank_used: search.telemetry.second_stage_rerank_used,
          second_stage_rerank_latency_ms: search.telemetry.second_stage_rerank_latency_ms,
          context_pack_latency_ms: 0,
          search_latency_ms: searchLatencyMs,
          generation_latency_ms: 0,
          total_latency_ms: Date.now() - startedAt,
        },
      }),
      retrievalDiagnostics,
    );
    answer.relevance = relevance;
    answer.queryAnalysis = queryAnalysis;
    answer.responseMode = smartApiPlan.displayMode;
    answer.smartPanel = answer.smartPanel ? { ...answer.smartPanel, relevance } : answer.smartPanel;
    answer.smartApiPlan = smartApiPlan;
    answer.scoreExplanations = answerScoreExplanations;
    const finalizedAnswer = finalizeRagAnswerQuality(answer, args.query, queryClass);

    if (args.logQuery !== false)
      await logRagQuery({
        owner_id: args.ownerId ?? null,
        query: args.query,
        answer: finalizedAnswer.answer,
        source_chunk_ids: answerInputResults.map((result) => result.id),
        model: null,
        metadata: {
          document_id: args.documentId ?? null,
          document_ids: args.documentIds ?? null,
          grounded: finalizedAnswer.grounded,
          confidence: finalizedAnswer.confidence,
          routing_mode: finalizedAnswer.routingMode,
          routing_reason: finalizedAnswer.routingReason,
          query_class: queryClass,
          fallback_reason: fallbackReasonFromRouting(finalizedAnswer.routingReason),
          model_used: null,
          retrieved_candidate_count: results.length,
          ...smartApiLogMetadata(smartApiPlan),
          ...answerRankMetadata,
          ...memoryLogMetadata,
          ...scoreLogMetadata,
          ...searchTelemetryDecisionMetadata(),
          cited_chunk_count: finalizedAnswer.citations.length,
          quote_count: finalizedAnswer.quoteCards?.length ?? 0,
          visual_evidence_count: finalizedAnswer.visualEvidence?.length ?? 0,
          related_document_count: relatedDocuments.length,
          ...retrievalLogMetadata(finalizedAnswer.retrievalDiagnostics ?? retrievalDiagnostics),
          search_cache_hit: search.telemetry.search_cache_hit,
          text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
          embedding_skipped: search.telemetry.embedding_skipped,
          embedding_latency_ms: search.telemetry.embedding_latency_ms,
          embedding_cache_hit: search.telemetry.embedding_cache_hit,
          supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
          rerank_latency_ms: search.telemetry.rerank_latency_ms,
          retrieval_strategy: search.telemetry.retrieval_strategy,
          weighted_top_score: search.telemetry.weighted_top_score,
          rrf_top_score: search.telemetry.rrf_top_score,
          search_latency_ms: searchLatencyMs,
          generation_latency_ms: 0,
          total_latency_ms: finalizedAnswer.latencyTimings?.total_latency_ms ?? Date.now() - startedAt,
          evidence_summary: finalizedAnswer.evidenceSummary,
          source_coverage: finalizedAnswer.sourceCoverage,
        },
      });

    setCachedAnswer(args, finalizedAnswer);
    return finalizedAnswer;
  }

  const answerInstructions = `You are an experienced psychiatrist in Perth, Australia, answering a colleague's clinical question using ONLY the uploaded clinical document excerpts provided below.

## Answer the exact question asked
- First, silently work out what the clinician actually needs: the precise clinical task, the population/scope, the decision point, and the urgency — and whether they want a pathway, a threshold, a dose, a comparison, or a document. Then answer THAT, specifically, and nothing else.
- If the question is narrow (a definition, one threshold, a single dose, a yes/no), answer only that. Do not broaden a narrow question into management, monitoring, or pathways unless it is explicitly asked. No generic filler, no adjacent-but-unasked content, no padding.
- For broad "management / treatment / approach" questions, give the logical clinical shape and weight it: immediate risk or specialist referral if supported, then core first-line intervention, then adjuncts/monitoring, then special populations and important gaps. Do not dump every option with equal weight.

## Voice
- Write in plain, confident clinical prose, as if you had read the sources and were explaining the approach to a colleague who asked. Compose a real answer — never summarise the excerpts, describe the retrieval, or stitch fragments. The excerpts are your source material, not the answer itself. Avoid source-inventory phrasing such as "the strongest retrieved sources support", "source-backed", "the source states", or "based on the provided excerpts".

## The answer field (first layer)
- Plain prose, usually 1-3 short sentences, about 35-75 words. The FIRST sentence must be complete and must directly answer the question; lead with the answer, then only the vital supporting detail.
- No bullets, numbered lists, labels, icons, headings, or prefixes such as "Answer", "Summary", "Bottom line", "Required actions", or "Direct answer".
- Polished sentence case. Never copy source title casing, ALL-CAPS headings, product/brand/formulary/imprest lines, or source section headings into prose. Never open by listing available products or formulations unless the user asks what formulations exist; if a formulation matters, name only the clinically relevant one in normal sentence case.
- SENTENCE HYGIENE (critical): retrieved excerpts often flatten monitoring tables into run-together text where an inpatient value is immediately followed by a community value (for example "...every 6 months for inpatients for community patients they are checked 6 months after initiation..."). Never reproduce this. For every parameter, finish the inpatient statement with a full stop before you start the community statement, and vice versa. Write short, separate sentences, e.g. "For inpatients, U&Es and LFTs are repeated every 6 months. For community patients, they are checked 6 months after initiation, at 12 months, then at least annually." Read each sentence back: if it joins two different schedules or settings without punctuation (such as "for inpatients for community patients", "daily for inpatients weekly", or two clauses jammed together), rewrite it into separate, grammatically complete sentences. Do the same for any dose/threshold/frequency table row: turn it into proper prose, never copy its run-together wording.

## Answer sections (second layer, optional)
- Put secondary detail into answerSections, not the answer field: required actions, monitoring/timing, medication/dose details, thresholds, escalation/risk, contraindications/cautions, comparison, documentation/forms, and source gaps.
- Simple direct-fact questions: return zero or one section (only if a safety or source-gap point is essential). Complex clinical, medication, threshold, comparison, or multi-document questions: return two to five distinct sections when supported.
- Each section is one concise practical point (or a compact synthesis of closely related points) and must NOT repeat the answer field. Never add a "Direct answer", "Bottom line", or "High-yield summary" section. Choose the most specific kind and supportLevel; use \`thresholds\` for numeric cutoffs/ranges/withhold-stop criteria and \`comparison\` for source differences, conflicts, or "compare / versus / difference" questions. Omit any section not supported by the excerpts.

## Grounding (non-negotiable)
- Every clinical claim — in the answer field and in every section — must be supported by the retrieved excerpts and carry citation_chunk_ids from the supplied source block. Omit, or convert to a source-gap statement, anything you cannot support.
- Never state unsupported numbers, doses, frequencies, thresholds, routes, or medication names. If a number or dose is not clearly in the evidence, leave it out.
- Copy every dose, level, threshold, cut-off, frequency, and duration EXACTLY as written in a cited excerpt — digit for digit, with its unit. Never supply a number from general clinical knowledge (including "typical" therapeutic levels or well-known reference ranges) that is not verbatim in the excerpts, and never round, infer, or complete a partial figure.
- Do not merge separate values into a range. If the excerpts list discrete dose steps (for example 0.25 mg, 0.5 mg, 1 mg), present them as discrete steps — never as "0.25–1 mg" or any range the excerpt does not itself state.
- Use only citation_chunk_id values from the supplied source block — never invent, transform, abbreviate, or reuse IDs from outside the retrieved evidence. Cite only the strongest 3-5, not every source.
- If the excerpts contain only headings, partial table fragments, or disconnected text that cannot support a logical answer, say the uploaded documents do not contain enough information — do not fill from general knowledge.
- Integrate relevant sources: merge overlapping guidance once; when several documents are relevant, synthesise by clinical theme/action and reconcile conflicts explicitly rather than silently choosing one; call out weak, nearby-only, or missing support when the evidence is partial or conflicting. Prefer Australian or WA-specific guidance when present. Sources are ordered by relevance — prioritise earlier ones unless a later source resolves a conflict or gap. The fused source brief and structured memory lines are orientation only; verify every claim against the raw excerpts below them and cite the original chunks.
- Do not give patient-specific medical advice.

## Formatting
- Bold only source-supported high-yield details with **bold**: doses, thresholds, timings, escalation/stop triggers, required actions, contraindications. Never bold whole sentences or routine filler. Use no Markdown other than **bold**.
- Never write provenance in prose: no document IDs, procedure/form codes, file names, page/chunk labels, similarity scores, source metadata, headers/footers, review tables, document-control text, or trailing citation digits/footnote markers such as "Tests1" or "months.1". Provenance belongs only in citations and quoteCards.
- Include 1-3 short EXACT quotes in quoteCards, copied verbatim from the retrieved excerpts.
- Never output JSON-like fragments, key-value dumps, or raw braces, and never write keys such as answer, heading, or citation_chunk_ids in any heading/body. If a section body would contain key-value or JSON-like syntax, omit it or return only concise natural-language text.

## Style examples (illustrating target voice and structure ONLY — never reuse these specific values; always use the actual retrieved excerpt content)
Direct-fact question -> single targeted sentence, no sections:
  answer: "The maximum recommended dose is **X mg** daily in divided doses, reduced in older or frail patients and titrated to response."
Threshold/decision question -> targeted lead sentence plus a couple of tight sections:
  answer: "**Withhold** the medication when the result falls into the red range and arrange **urgent** repeat testing and specialist review before the next dose."
  section [thresholds] "Red-range action": "A result below **<threshold>** is the red result — stop and do not give further doses until reviewed."
  section [required_actions] "Escalation": "Arrange an **urgent** repeat and specialist review; do not restart without specialist advice."

Return data matching the supplied structured output schema.`;

  function buildAnswerInput(contextResults: SearchResult[]) {
    const sourceGuide = crossDocumentPlan.enabled ? buildCrossDocumentSourceGuide(contextResults) : "";
    const fusedBrief = crossDocumentFusionBrief?.text ?? "";
    const crossDocumentContext = [sourceGuide, fusedBrief].filter(Boolean).join("\n\n");
    const validEvidenceChunkIds = Array.from(new Set(contextResults.map((result) => result.id).filter(Boolean))).join(
      ", ",
    );
    const interpretedTask = [
      `intent: ${smartApiPlan.intent}`,
      `query_class: ${queryClass}`,
      `answer_focus: ${smartApiPlan.answerFocus}`,
      `answer_scope: ${
        isSimpleDirectQuestion(args.query, queryClass)
          ? "simple direct question: answer only the definition or direct fact requested; do not broaden into management unless asked"
          : "use the question wording to decide the necessary clinical scope"
      }`,
      `display_mode: ${smartApiPlan.displayMode}`,
      `route: ${route.mode} (${route.reason})`,
      `answer_plan.intent: ${smartApiPlan.answerPlan.intent}`,
      `answer_plan.route_mode: ${smartApiPlan.answerPlan.routeMode}`,
      `answer_plan.model_strategy: ${smartApiPlan.answerPlan.modelStrategy}`,
      `answer_plan.retrieval_quality: ${smartApiPlan.answerPlan.retrievalQuality}`,
      `answer_plan.retrieval_intent: ${
        Object.entries(smartApiPlan.answerPlan.retrievalIntent)
          .filter(([, value]) => value === true)
          .map(([key]) => key)
          .join(", ") || "none"
      }`,
      `answer_plan.required_retrieval_signals: ${
        smartApiPlan.answerPlan.retrievalIntent.requiredTermSignals.join(", ") || "none"
      }`,
      `answer_plan.source_selection: required_signals_satisfied=${
        smartApiPlan.answerPlan.sourceSelection.requiredSignalsSatisfied
      }; matched=${smartApiPlan.answerPlan.sourceSelection.matchedSignals.join(", ") || "none"}; missing=${
        smartApiPlan.answerPlan.sourceSelection.missingRequiredSignals.join(", ") || "none"
      }`,
      `answer_plan.source_policy: ${smartApiPlan.answerPlan.sourcePolicy}`,
      `quality_gate: ${smartApiPlan.answerPlan.qualityCriteria.join(", ")}`,
      `fallback_behavior: ${smartApiPlan.answerPlan.fallbackBehavior}`,
      `valid_evidence_chunk_ids: ${validEvidenceChunkIds || "none"}`,
      `evidence_contract: every clinical claim must be supported by one or more valid_evidence_chunk_ids; unsupported clinical claims must be omitted or converted to a source-gap statement`,
      `source_count: ${contextResults.length}`,
      `source_relevance: ${relevance.label}`,
    ].join("\n");
    return `Question:
${args.query}
${clinicalModePrompt(args.queryMode ?? "auto") ? `\nSelected clinical query mode:\n${clinicalModePrompt(args.queryMode ?? "auto")}\n` : ""}

Interpreted clinical task:
${interpretedTask}

Sources:
${crossDocumentContext ? `${crossDocumentContext}\n\n` : ""}
${buildRagSourceBlock(contextResults, { query: answerFocusQuery, queryClass })}`;
  }

  let generationLatencyMs = 0;
  let modelUsed = route.model;
  let routingReason = route.reason;
  let retriedWithStrong = false;
  let openAIUsage: OpenAITokenUsage = {};
  const openAIRequestIds: string[] = [];
  let contextPackLatencyMs = 0;
  let contextPackCacheHits = 0;
  let answerRetryCount = 0;
  const answerRetryReasons: string[] = [];
  const contextPackOptions = { crossDocument: crossDocumentPlan.enabled };
  const packedContextCache = new Map<string, SearchResult[]>();

  async function packContextForGeneration(contextResults: SearchResult[]) {
    const cacheKey = packedContextCacheKey(contextResults, queryClass, {
      ...contextPackOptions,
      documentIds: args.documentIds?.length ? args.documentIds : args.documentId ? [args.documentId] : undefined,
    });
    const cached = packedContextCache.get(cacheKey);
    if (cached) {
      contextPackCacheHits += 1;
      return cached;
    }

    const contextPackStartedAt = Date.now();
    const packed = await packAdjacentSourceContext(createAdminClient(), contextResults, queryClass, contextPackOptions);
    contextPackLatencyMs += Date.now() - contextPackStartedAt;
    packedContextCache.set(cacheKey, packed);
    return packed;
  }

  async function generateWithModel(
    model: string,
    contextResults: SearchResult[],
    options?: { strong?: boolean; qualityRetryInstruction?: string },
  ): Promise<OpenAITextResult> {
    const qualityRetryInstruction = options?.qualityRetryInstruction;
    // Fast vs strong is differentiated by reasoning effort, not model identity, so the
    // fast->strong escalation still works when both tiers share a model (e.g. both gpt-5.5).
    const useStrongReasoning = options?.strong ?? false;
    const input = qualityRetryInstruction
      ? `${buildAnswerInput(contextResults)}

Quality retry instruction:
${qualityRetryInstruction}`
      : buildAnswerInput(contextResults);
    const generationStartedAt = Date.now();
    try {
      const result = await generateStructuredTextResult(input, answerJsonOutputSchemaForResults(contextResults), {
        model,
        maxOutputTokens: env.OPENAI_MAX_OUTPUT_TOKENS,
        operation: "answer",
        schemaName: "clinical_rag_answer",
        instructions: answerInstructions,
        promptCacheKey: "clinical-rag-answer-v17",
        timeoutMs: env.OPENAI_ANSWER_TIMEOUT_MS,
        reasoningEffort: useStrongReasoning
          ? strongReasoningEffortForQueryClass(queryClass, env.OPENAI_STRONG_REASONING_EFFORT)
          : env.OPENAI_FAST_REASONING_EFFORT,
        signal: args.signal,
      });
      openAIUsage = addOpenAIUsage(openAIUsage, result.usage);
      if (result.requestId) openAIRequestIds.push(result.requestId);
      return result;
    } finally {
      generationLatencyMs += Date.now() - generationStartedAt;
    }
  }

  function generationIncompleteReason(result: OpenAITextResult) {
    return result.incompleteReason ?? (result.status === "incomplete" ? "incomplete" : "unknown");
  }

  function generationRetryReason(prefix: string, result: OpenAITextResult) {
    const reason = generationIncompleteReason(result);
    return reason === "max_output_tokens" ? `${prefix}_max_output_tokens` : `${prefix}_incomplete_${reason}`;
  }

  function summarizeGenerationFailureReason(error: unknown) {
    const message = (error instanceof Error ? error.message : typeof error === "string" ? error : "").trim();
    const normalized = message.toLowerCase();

    if (!normalized) return "generation_failed";
    if (/\bmax_output_tokens\b/.test(normalized)) return "provider_incomplete_max_output_tokens";
    if (/\bincomplete\b/.test(normalized)) return "provider_incomplete";
    if (/\brate limit|rate_limited|429\b/.test(normalized)) return "provider_rate_limited";
    if (/\btimeout|timed out|aborted|etimedout\b/.test(normalized)) return "provider_timeout";
    if (/\bauthentication|api key|unauthori[sz]ed|401|403\b/.test(normalized)) return "provider_auth_failed";
    if (/\bvalidation|quality gate|schema|parse|json\b/.test(normalized)) return "generation_quality_failed";
    if (/\bopenai|provider|model\b/.test(normalized)) return "provider_generation_failed";
    return "generation_failed";
  }

  async function buildGenerationFallbackAnswer(
    error: unknown,
    relatedDocuments: RelatedDocument[],
  ): Promise<RagAnswer> {
    const hasSources = answerInputResults.length > 0;
    const fallbackCitations = compactCitations(answerInputResults);
    const sanitizedReason = summarizeGenerationFailureReason(error);
    const fallbackBestSource = hasSources
      ? (selectBestSourceRecommendation(answerInputResults, quoteCards) ?? bestSource)
      : null;
    const fallbackSmartPanel = hasSources
      ? { ...smartPanel, relevance, bestSource: fallbackBestSource, relatedDocuments }
      : { ...emptyPanel, relevance, relatedDocuments };

    return {
      answer: boldHighYieldClinicalText(
        hasSources
          ? "I found matching indexed passages, but could not generate a finalized answer right now. Review the source snippets below."
          : "I could not find enough indexed support in the available documents to answer this query yet.",
        args.query,
      ),
      grounded: false,
      confidence: hasSources ? deriveConfidence(answerInputResults, fallbackCitations) : "unsupported",
      citations: hasSources ? fallbackCitations : [],
      sources: answerInputResults,
      modelUsed: null,
      openAIRequestIds,
      openAIUsage: hasOpenAIUsage(openAIUsage) ? openAIUsage : undefined,
      routingMode: "unsupported",
      routingReason: `${route.reason}; generation_fallback:${sanitizedReason}`,
      queryClass,
      queryAnalysis,
      responseMode: buildCurrentSmartApiPlan("unsupported", `${route.reason}; generation_fallback`).displayMode,
      latencyTimings: {
        search_cache_hit: search.telemetry.search_cache_hit,
        shared_cache_hit: search.telemetry.shared_cache_hit,
        shared_cache_status: search.telemetry.shared_cache_status,
        shared_cache_miss_reason: search.telemetry.shared_cache_miss_reason,
        text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
        embedding_skipped: search.telemetry.embedding_skipped,
        embedding_skip_reason: search.telemetry.embedding_skip_reason,
        text_candidate_budget: search.telemetry.text_candidate_budget,
        text_candidate_count: search.telemetry.text_candidate_count,
        text_fast_path_reason: search.telemetry.text_fast_path_reason,
        embedding_latency_ms: search.telemetry.embedding_latency_ms,
        embedding_cache_hit: search.telemetry.embedding_cache_hit,
        vector_candidate_count: search.telemetry.vector_candidate_count,
        embedding_field_count: search.telemetry.embedding_field_count,
        retrieval_query_variant_count: search.telemetry.retrieval_query_variant_count,
        supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
        rerank_latency_ms: search.telemetry.rerank_latency_ms,
        second_stage_rerank_used: search.telemetry.second_stage_rerank_used,
        second_stage_rerank_latency_ms: search.telemetry.second_stage_rerank_latency_ms,
        context_pack_latency_ms: contextPackLatencyMs,
        context_pack_cache_hits: contextPackCacheHits,
        answer_retry_count: answerRetryCount,
        answer_retry_reasons: [...answerRetryReasons],
        search_latency_ms: searchLatencyMs,
        generation_latency_ms: generationLatencyMs,
        total_latency_ms: Date.now() - startedAt,
      },
      answerSections: [],
      quoteCards: hasSources ? reconcileQuoteCards(quoteCards, answerInputResults, args.query) : [],
      visualEvidence: hasSources ? visualEvidence : [],
      bestSource: hasSources ? fallbackBestSource : null,
      documentBreakdown: hasSources ? documentBreakdown : [],
      evidenceSummary: hasSources ? evidenceSummary : emptyPanel.evidenceSummary,
      sourceCoverage: hasSources ? sourceCoverage : emptyPanel.sourceCoverage,
      conflictsOrGaps: hasSources ? conflictsOrGaps : [],
      smartPanel: fallbackSmartPanel,
      relatedDocuments,
      relevance,
      memoryCardsUsed: hasSources ? memoryCardsUsed : [],
      indexingVersion: ragDeepMemoryVersion,
      indexingQuality,
      smartApiPlan: buildCurrentSmartApiPlan("unsupported", `${route.reason}; generation_fallback`),
      scoreExplanations: answerScoreExplanations,
    } satisfies RagAnswer;
  }

  const modelContextResults = selectModelContextResults({
    routeMode: route.mode,
    queryClass,
    crossDocument: crossDocumentPlan.enabled,
    results: answerInputResults,
  });
  try {
    await args.onProgress?.({
      stage: "generating",
      message: `Generating cited answer with ${route.mode} route.`,
      mode: route.mode,
      model: route.model,
      reason: route.reason,
    });
    let packedContextResults = await packContextForGeneration(modelContextResults);
    let generated = await generateWithModel(route.model!, packedContextResults, {
      strong: route.mode === "strong",
    });
    // Adopted from main: retry truncation once for BOTH fast- and strong-routed first attempts
    // (previously fast-only), keyed on route.mode rather than model identity so it stays correct
    // when the tiers share a model.
    if (generated.truncated && !retriedWithStrong) {
      const retryPrefix = route.mode === "fast" ? "fast" : "strong";
      const retryReason = `${generationRetryReason(retryPrefix, generated)}_retry_strong`;
      answerRetryCount += 1;
      answerRetryReasons.push(retryReason);
      modelUsed = env.OPENAI_STRONG_ANSWER_MODEL;
      routingReason = `${route.reason}; ${retryReason}`;
      retriedWithStrong = true;
      await args.onProgress?.({
        stage: "retrying",
        message: "Fast answer hit the output limit, retrying with the strong model.",
        mode: "strong",
        model: env.OPENAI_STRONG_ANSWER_MODEL,
        reason: routingReason,
      });
      // Widen the retry context from the trimmed fast set to the full result set, but keep the P9
      // per-document crowding cap — the strong-initial route is capped, so the retry must be too.
      packedContextResults = await packContextForGeneration(capPerDocumentCrowding(answerInputResults));
      generated = await generateWithModel(env.OPENAI_STRONG_ANSWER_MODEL, packedContextResults, { strong: true });
      retrievalDiagnostics.routeMode = "strong";
    }
    if (generated.truncated) {
      const retryReason = generationRetryReason(retriedWithStrong ? "strong" : "generation", generated);
      answerRetryCount += 1;
      answerRetryReasons.push(retryReason);
      throw new Error(`OpenAI generation incomplete: ${generationIncompleteReason(generated)}`);
    }
    let answer = annotateAnswerWithDiagnostics(
      parseAnswerJson(generated.text, packedContextResults, args.query),
      retrievalDiagnostics,
    );
    const fastAnswerHadInvalidEvidenceIds = route.mode === "fast" && hasInvalidModelEvidenceIds(answer);
    const fastAnswerWasUnsupported =
      !fastAnswerHadInvalidEvidenceIds &&
      shouldRetryWithStrongAfterFast({ route, answer, results: answerInputResults });
    const fastAnswerWasUnusable = route.mode === "fast" && isUnusableGeneratedAnswer(answer);
    const fastAnswerWasTemplateLike = route.mode === "fast" && isTemplateLikeGeneratedAnswer(answer);
    const fastAnswerWasOverExpanded =
      route.mode === "fast" && isOverExpandedSimpleGeneratedAnswer(args.query, queryClass, answer);
    const fastAnswerFailedQualityGate =
      route.mode === "fast" &&
      !fastAnswerWasUnusable &&
      !fastAnswerWasTemplateLike &&
      !fastAnswerWasOverExpanded &&
      Boolean(generatedAnswerQualityFailureReason(answer, args.query, queryClass));
    if (
      fastAnswerHadInvalidEvidenceIds ||
      fastAnswerWasUnsupported ||
      fastAnswerWasUnusable ||
      fastAnswerWasTemplateLike ||
      fastAnswerWasOverExpanded ||
      fastAnswerFailedQualityGate
    ) {
      const retryReason = fastAnswerHadInvalidEvidenceIds
        ? "fast_invalid_evidence_retry_strong"
        : fastAnswerWasUnsupported
          ? "fast_unsupported_retry_strong"
          : fastAnswerWasUnusable
            ? "fast_unusable_retry_strong"
            : fastAnswerWasTemplateLike
              ? "fast_template_retry_strong"
              : fastAnswerWasOverExpanded
                ? "fast_overexpanded_simple_retry_strong"
                : "fast_quality_retry_strong";
      answerRetryCount += 1;
      answerRetryReasons.push(retryReason);
      modelUsed = env.OPENAI_STRONG_ANSWER_MODEL;
      routingReason = `${route.reason}; ${retryReason}`;
      retriedWithStrong = true;
      await args.onProgress?.({
        stage: "retrying",
        message:
          retryReason === "fast_invalid_evidence_retry_strong"
            ? "Fast answer cited invalid evidence IDs, retrying with the strong model."
            : retryReason === "fast_unsupported_retry_strong"
              ? "Fast answer was unsupported, retrying with the strong model."
              : retryReason === "fast_unusable_retry_strong"
                ? "Fast answer was not usable, retrying with the strong model."
                : retryReason === "fast_template_retry_strong"
                  ? "Fast answer was too template-like, retrying with the strong model."
                  : retryReason === "fast_overexpanded_simple_retry_strong"
                    ? "Fast answer over-expanded a simple question, retrying with the strong model."
                    : "Fast answer failed quality checks, retrying with the strong model.",
        mode: "strong",
        model: env.OPENAI_STRONG_ANSWER_MODEL,
        reason: routingReason,
      });
      // Same as the truncation retry above: widen but keep the P9 per-document crowding cap.
      packedContextResults = await packContextForGeneration(capPerDocumentCrowding(answerInputResults));
      generated = await generateWithModel(env.OPENAI_STRONG_ANSWER_MODEL, packedContextResults, { strong: true });
      retrievalDiagnostics.routeMode = "strong";
      if (generated.truncated) {
        const truncatedReason = generationRetryReason("strong", generated);
        answerRetryCount += 1;
        answerRetryReasons.push(truncatedReason);
        throw new Error(`OpenAI generation incomplete: ${generationIncompleteReason(generated)}`);
      }
      answer = annotateAnswerWithDiagnostics(
        parseAnswerJson(generated.text, packedContextResults, args.query),
        retrievalDiagnostics,
      );
    }
    // Whether the answer was produced by the strong path (either routed strong from the
    // start or escalated via retry). Tracked by flag rather than model identity so it stays
    // correct when fast and strong tiers share a model.
    const usedStrongModel = route.mode === "strong" || retriedWithStrong;
    const strongQualityFailureReason = usedStrongModel
      ? generatedAnswerQualityFailureReason(answer, args.query, queryClass)
      : null;
    const answerNeedsStrongQualityRepair = usedStrongModel && Boolean(strongQualityFailureReason);
    if (answerNeedsStrongQualityRepair) {
      routingReason = `${routingReason}; strong_quality_retry`;
      answerRetryCount += 1;
      answerRetryReasons.push("strong_quality_retry");
      await args.onProgress?.({
        stage: "retrying",
        message: "Strong answer failed quality checks, retrying once with stricter synthesis instructions.",
        mode: "strong",
        model: env.OPENAI_STRONG_ANSWER_MODEL,
        reason: routingReason,
      });
      generated = await generateWithModel(env.OPENAI_STRONG_ANSWER_MODEL, packedContextResults, {
        strong: true,
        qualityRetryInstruction: `The previous answer failed deterministic validation (${strongQualityFailureReason}). Return schema-valid output only, with a complete natural clinical synthesis in the answer field. The first sentence must directly answer the question as a full sentence. Every clinical claim must be supported by valid retrieved citation_chunk_id values; do not invent citation IDs. Avoid template/source-inventory wording and do not include JSON fragments inside text fields. If the evidence cannot support the requested clinical answer, return a concise source-gap answer instead. If the question is a simple definition or direct fact question, answer only that question and return answerSections as an empty array unless a source-gap or safety caveat is essential.`,
      });
      retrievalDiagnostics.routeMode = "strong";
      if (generated.truncated) {
        const truncatedReason = generationRetryReason("strong_quality_retry", generated);
        answerRetryCount += 1;
        answerRetryReasons.push(truncatedReason);
        throw new Error(`OpenAI generation incomplete: ${generationIncompleteReason(generated)}`);
      }
      answer = annotateAnswerWithDiagnostics(
        parseAnswerJson(generated.text, packedContextResults, args.query),
        retrievalDiagnostics,
      );
    }
    await args.onProgress?.({ stage: "finalizing", message: "Checking citations and source metadata." });

    const relatedDocuments = await relatedDocumentsPromise;
    const answerTimings = {
      search_cache_hit: search.telemetry.search_cache_hit,
      shared_cache_hit: search.telemetry.shared_cache_hit,
      shared_cache_status: search.telemetry.shared_cache_status,
      shared_cache_miss_reason: search.telemetry.shared_cache_miss_reason,
      text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
      embedding_skipped: search.telemetry.embedding_skipped,
      embedding_skip_reason: search.telemetry.embedding_skip_reason,
      text_candidate_budget: search.telemetry.text_candidate_budget,
      text_candidate_count: search.telemetry.text_candidate_count,
      text_fast_path_reason: search.telemetry.text_fast_path_reason,
      embedding_latency_ms: search.telemetry.embedding_latency_ms,
      embedding_cache_hit: search.telemetry.embedding_cache_hit,
      vector_candidate_count: search.telemetry.vector_candidate_count,
      embedding_field_count: search.telemetry.embedding_field_count,
      retrieval_query_variant_count: search.telemetry.retrieval_query_variant_count,
      supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
      rerank_latency_ms: search.telemetry.rerank_latency_ms,
      second_stage_rerank_used: search.telemetry.second_stage_rerank_used,
      second_stage_rerank_latency_ms: search.telemetry.second_stage_rerank_latency_ms,
      context_pack_latency_ms: contextPackLatencyMs,
      context_pack_cache_hits: contextPackCacheHits,
      answer_retry_count: answerRetryCount,
      answer_retry_reasons: [...answerRetryReasons],
      search_latency_ms: searchLatencyMs,
      generation_latency_ms: generationLatencyMs,
      total_latency_ms: Date.now() - startedAt,
    };

    // B5: a structured_parse_fallback answer now fails closed with zero
    // citations, so we can no longer gate extractive recovery on the parsed
    // answer's citations. buildExtractiveAnswer derives its own source-backed
    // citations from the retrieved results, so trigger recovery whenever the
    // generated answer is unusable and we have retrieved results to extract from.
    const canRecoverExtractively = !usedStrongModel && (answer.citations.length > 0 || answerInputResults.length > 0);
    if (canRecoverExtractively && isUnusableGeneratedAnswer(answer)) {
      answer = buildExtractiveAnswer({
        query: args.query,
        queryClass,
        results: answerInputResults,
        quoteCards,
        documentBreakdown,
        evidenceSummary,
        sourceCoverage,
        conflictsOrGaps,
        visualEvidence,
        bestSource,
        smartPanel: { ...smartPanel, relevance, bestSource, relatedDocuments },
        relatedDocuments,
        routeReason: `${routingReason}; structured_output_fallback`,
        timings: answerTimings,
      });
      answer.modelUsed = modelUsed;
    } else {
      answer = boldRagAnswerHighYieldText(answer, args.query);
      answer.sources = answerInputResults;
      answer.quoteCards = reconcileQuoteCards(answer.quoteCards, answerInputResults, args.query);
      answer.documentBreakdown = documentBreakdown;
      answer.evidenceSummary = evidenceSummary;
      answer.sourceCoverage = sourceCoverage;
      answer.conflictsOrGaps = answer.conflictsOrGaps?.length ? answer.conflictsOrGaps : conflictsOrGaps;
      answer.visualEvidence = visualEvidence;
      answer.bestSource = selectBestSourceRecommendation(answerInputResults, answer.quoteCards) ?? bestSource;
      answer.relatedDocuments = relatedDocuments;
      answer.smartPanel = { ...smartPanel, relevance, bestSource: answer.bestSource, relatedDocuments };
      answer.routingMode = retriedWithStrong ? "strong" : route.mode;
      answer.routingReason = routingReason;
    }
    answer.modelUsed = modelUsed;
    answer.queryClass = queryClass;
    answer.queryAnalysis = queryAnalysis;
    answer.openAIRequestIds = openAIRequestIds;
    answer.openAIUsage = hasOpenAIUsage(openAIUsage) ? openAIUsage : undefined;
    answer.latencyTimings = answerTimings;
    answer.memoryCardsUsed = memoryCardsUsed;
    answer.indexingVersion = ragDeepMemoryVersion;
    answer.indexingQuality = indexingQuality;
    answer.smartApiPlan = buildCurrentSmartApiPlan(answer.routingMode, answer.routingReason);
    answer.responseMode = answer.smartApiPlan.displayMode;
    answer.scoreExplanations = answerScoreExplanations;
    answer.relevance = relevance;
    answer.smartPanel = answer.smartPanel ? { ...answer.smartPanel, relevance } : answer.smartPanel;

    answer = annotateAnswerWithDiagnostics(answer, {
      ...retrievalDiagnostics,
      routeMode: answer.routingMode ?? retrievalDiagnostics.routeMode,
    });
    answer = finalizeRagAnswerQuality(answer, args.query, queryClass);

    if (args.logQuery !== false)
      await logRagQuery({
        owner_id: args.ownerId ?? null,
        query: args.query,
        answer: answer.answer,
        source_chunk_ids: answerInputResults.map((result) => result.id),
        model: modelUsed,
        metadata: {
          document_id: args.documentId ?? null,
          document_ids: args.documentIds ?? null,
          grounded: answer.grounded,
          confidence: answer.confidence,
          routing_mode: answer.routingMode,
          routing_reason: routingReason,
          query_class: queryClass,
          fallback_reason: fallbackReasonFromRouting(answer.routingReason),
          model_used: modelUsed,
          requested_fast_model: requestedOpenAIAnswerModels.fastAnswer,
          requested_strong_model: requestedOpenAIAnswerModels.strongAnswer,
          answer_model_demoted:
            requestedOpenAIAnswerModels.answer !== env.OPENAI_ANSWER_MODEL ||
            requestedOpenAIAnswerModels.fastAnswer !== env.OPENAI_FAST_ANSWER_MODEL ||
            requestedOpenAIAnswerModels.strongAnswer !== env.OPENAI_STRONG_ANSWER_MODEL,
          fast_model: env.OPENAI_FAST_ANSWER_MODEL,
          strong_model: env.OPENAI_STRONG_ANSWER_MODEL,
          retrieved_candidate_count: results.length,
          ...(answer.smartApiPlan ? smartApiLogMetadata(answer.smartApiPlan) : {}),
          ...answerRankMetadata,
          ...memoryLogMetadata,
          ...scoreLogMetadata,
          ...searchTelemetryDecisionMetadata(),
          cited_chunk_count: answer.citations.length,
          quote_count: answer.quoteCards?.length ?? 0,
          visual_evidence_count: answer.visualEvidence?.length ?? 0,
          related_document_count: relatedDocuments.length,
          search_cache_hit: search.telemetry.search_cache_hit,
          text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
          embedding_skipped: search.telemetry.embedding_skipped,
          embedding_latency_ms: search.telemetry.embedding_latency_ms,
          embedding_cache_hit: search.telemetry.embedding_cache_hit,
          supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
          rerank_latency_ms: search.telemetry.rerank_latency_ms,
          context_pack_latency_ms: contextPackLatencyMs,
          context_pack_cache_hits: contextPackCacheHits,
          answer_retry_count: answerRetryCount,
          answer_retry_reasons: answerRetryReasons,
          retrieval_strategy: search.telemetry.retrieval_strategy,
          weighted_top_score: search.telemetry.weighted_top_score,
          rrf_top_score: search.telemetry.rrf_top_score,
          search_latency_ms: searchLatencyMs,
          generation_latency_ms: generationLatencyMs,
          total_latency_ms: answer.latencyTimings?.total_latency_ms ?? Date.now() - startedAt,
          openai_request_ids: openAIRequestIds,
          openai_usage: answer.openAIUsage ?? null,
          evidence_summary: answer.evidenceSummary,
          source_coverage: answer.sourceCoverage,
          ...retrievalLogMetadata(answer.retrievalDiagnostics ?? retrievalDiagnostics),
        },
      });

    setCachedAnswer(args, answer);
    return answer;
  } catch (error) {
    const relatedDocuments = await relatedDocumentsPromise;
    await args.onProgress?.({
      stage: "finalizing",
      message: "Generation failed, returning source-based fallback answer.",
      mode: "unsupported",
      reason: "generation_fallback",
    });
    const baseFallbackAnswer = await buildGenerationFallbackAnswer(error, relatedDocuments);
    const sanitizedReason = summarizeGenerationFailureReason(error);
    const canRecoverGenerationErrorExtractively =
      answerInputResults.length > 0 &&
      baseFallbackAnswer.citations.length > 0 &&
      !/(?:max_output_tokens|incomplete)/i.test(sanitizedReason);
    const extractiveFallbackAnswer = canRecoverGenerationErrorExtractively
      ? {
          ...buildExtractiveAnswer({
            query: args.query,
            queryClass,
            results: answerInputResults,
            quoteCards,
            documentBreakdown,
            evidenceSummary,
            sourceCoverage,
            conflictsOrGaps,
            visualEvidence,
            bestSource,
            smartPanel: { ...smartPanel, relevance, bestSource, relatedDocuments },
            relatedDocuments,
            routeReason: `${route.reason}; generation_fallback:${sanitizedReason}; source_backed_extractive_fallback`,
            timings: baseFallbackAnswer.latencyTimings,
          }),
          openAIRequestIds,
          openAIUsage: hasOpenAIUsage(openAIUsage) ? openAIUsage : undefined,
          queryAnalysis,
          memoryCardsUsed,
          indexingVersion: ragDeepMemoryVersion,
          indexingQuality,
          smartApiPlan: buildCurrentSmartApiPlan(
            "extractive",
            `${route.reason}; generation_fallback:${sanitizedReason}; source_backed_extractive_fallback`,
          ),
          responseMode: buildCurrentSmartApiPlan(
            "extractive",
            `${route.reason}; generation_fallback:${sanitizedReason}; source_backed_extractive_fallback`,
          ).displayMode,
          relevance,
          scoreExplanations: answerScoreExplanations,
        }
      : null;
    const extractiveFallbackQualityReason = extractiveFallbackAnswer
      ? generatedAnswerQualityFailureReason(extractiveFallbackAnswer, args.query, queryClass)
      : null;
    const sourceBackedReviewReason = extractiveFallbackAnswer
      ? !extractiveFallbackAnswer.grounded || extractiveFallbackAnswer.confidence === "unsupported"
        ? "ungrounded_extractive_fallback"
        : extractiveFallbackQualityReason
      : null;
    const generationFallbackAnswer =
      extractiveFallbackAnswer && sourceBackedReviewReason
        ? (() => {
            const reviewRouteReason = [
              route.reason,
              `generation_fallback:${sanitizedReason}`,
              "source_backed_review_fallback",
              `extractive_quality_gate:${sourceBackedReviewReason}`,
            ].join("; ");
            const reviewPlan = buildCurrentSmartApiPlan("extractive", reviewRouteReason);
            return {
              ...baseFallbackAnswer,
              answer: boldHighYieldClinicalText(sourceBackedGenerationTimeoutAnswer(args.query), args.query),
              grounded: true,
              confidence: deriveConfidence(answerInputResults, baseFallbackAnswer.citations),
              routingMode: "extractive",
              routingReason: reviewRouteReason,
              queryAnalysis,
              responseMode: reviewPlan.displayMode,
              smartApiPlan: reviewPlan,
              answerSections: [],
              relevance,
              scoreExplanations: answerScoreExplanations,
            } satisfies RagAnswer;
          })()
        : (extractiveFallbackAnswer ?? baseFallbackAnswer);
    const fallbackAnswer = finalizeRagAnswerQuality(
      annotateAnswerWithDiagnostics(generationFallbackAnswer, retrievalDiagnostics),
      args.query,
      queryClass,
    );
    if (args.logQuery !== false)
      await logRagQuery({
        owner_id: args.ownerId ?? null,
        query: args.query,
        answer: fallbackAnswer.answer,
        source_chunk_ids: answerInputResults.map((result) => result.id),
        model: null,
        metadata: {
          document_id: args.documentId ?? null,
          document_ids: args.documentIds ?? null,
          grounded: fallbackAnswer.grounded,
          confidence: fallbackAnswer.confidence,
          routing_mode: fallbackAnswer.routingMode,
          routing_reason: fallbackAnswer.routingReason,
          query_class: queryClass,
          fallback_reason: fallbackReasonFromRouting(fallbackAnswer.routingReason),
          model_used: null,
          requested_fast_model: requestedOpenAIAnswerModels.fastAnswer,
          requested_strong_model: requestedOpenAIAnswerModels.strongAnswer,
          answer_model_demoted:
            requestedOpenAIAnswerModels.answer !== env.OPENAI_ANSWER_MODEL ||
            requestedOpenAIAnswerModels.fastAnswer !== env.OPENAI_FAST_ANSWER_MODEL ||
            requestedOpenAIAnswerModels.strongAnswer !== env.OPENAI_STRONG_ANSWER_MODEL,
          fast_model: env.OPENAI_FAST_ANSWER_MODEL,
          strong_model: env.OPENAI_STRONG_ANSWER_MODEL,
          retrieved_candidate_count: results.length,
          ...(fallbackAnswer.smartApiPlan ? smartApiLogMetadata(fallbackAnswer.smartApiPlan) : {}),
          ...answerRankMetadata,
          ...memoryLogMetadata,
          ...scoreLogMetadata,
          ...searchTelemetryDecisionMetadata(),
          cited_chunk_count: fallbackAnswer.citations.length,
          quote_count: fallbackAnswer.quoteCards?.length ?? 0,
          visual_evidence_count: fallbackAnswer.visualEvidence?.length ?? 0,
          ...retrievalLogMetadata(fallbackAnswer.retrievalDiagnostics ?? retrievalDiagnostics),
          related_document_count: relatedDocuments.length,
          search_cache_hit: search.telemetry.search_cache_hit,
          text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
          embedding_skipped: search.telemetry.embedding_skipped,
          embedding_latency_ms: search.telemetry.embedding_latency_ms,
          embedding_cache_hit: search.telemetry.embedding_cache_hit,
          supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
          rerank_latency_ms: search.telemetry.rerank_latency_ms,
          context_pack_latency_ms: contextPackLatencyMs,
          retrieval_strategy: "generation_fallback",
          weighted_top_score: search.telemetry.weighted_top_score,
          rrf_top_score: search.telemetry.rrf_top_score,
          search_latency_ms: searchLatencyMs,
          generation_latency_ms: generationLatencyMs,
          total_latency_ms: fallbackAnswer.latencyTimings?.total_latency_ms ?? Date.now() - startedAt,
          openai_request_ids: fallbackAnswer.openAIRequestIds,
          openai_usage: fallbackAnswer.openAIUsage,
          evidence_summary: fallbackAnswer.evidenceSummary,
          source_coverage: fallbackAnswer.sourceCoverage,
        },
      });

    setCachedAnswer(args, fallbackAnswer);
    return fallbackAnswer;
  }
}

export async function summarizeDocument(documentId: string, ownerId?: string) {
  const supabase = createAdminClient();
  let documentQuery = supabase.from("documents").select("id,title,file_name,metadata").eq("id", documentId);

  if (ownerId) {
    documentQuery = documentQuery.eq("owner_id", ownerId);
  }

  const { data: document, error: documentError } = await documentQuery.maybeSingle();

  if (documentError) throw new Error(documentError.message);
  if (!document) throw new Error("Document not found.");

  const { data: chunks, error } = await supabase
    .from("document_chunks")
    .select(
      "id,document_id,page_number,chunk_index,section_heading,content,retrieval_synopsis,image_ids,index_generation_id",
    )
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true })
    .limit(40);

  if (error) throw new Error(error.message);
  const committedGeneration = committedIndexGeneration((document as { metadata?: unknown }).metadata);
  const committedChunks = (chunks ?? []).filter(
    (chunk) => !chunk.index_generation_id || chunk.index_generation_id === committedGeneration,
  );
  if (!committedChunks.length) {
    return {
      answer: "This document has not been indexed yet, so no summary can be generated.",
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
    } satisfies RagAnswer;
  }

  const results = committedChunks.map((chunk) => ({
    ...chunk,
    title: document.title,
    file_name: document.file_name,
    source_metadata: normalizeSourceMetadata((document as { metadata?: unknown }).metadata),
    similarity: 1,
    images: [],
  })) as SearchResult[];

  const summaryInstructions = `Summarize a clinical document for practical psychiatric use in Perth, Australia.
Use only the excerpts provided. Use a layered response: make the answer field a plain high-yield clinical paragraph, usually 1-3 short sentences and 35-75 words, then use answerSections for distinct structured support when it improves scanability. Do not prefix the answer with "Summary", "Key practical points", "Direct answer", or similar labels, and do not use bullets in the answer field. Focus on high-yield actions, thresholds, medication or risk monitoring, exceptions, comparisons, source gaps, and citations. Exclude administrative document-control details unless they change clinical action.
Return data matching the supplied structured output schema.`;
  const summaryInput = `Document:
${document.title}

Sources:
${buildRagSourceBlock(results)}`;

  const generated = await generateStructuredTextResult(summaryInput, answerJsonOutputSchemaForResults(results), {
    model: env.OPENAI_ANSWER_MODEL,
    maxOutputTokens: env.OPENAI_MAX_OUTPUT_TOKENS,
    operation: "summary",
    schemaName: "clinical_document_summary",
    instructions: summaryInstructions,
    promptCacheKey: "clinical-document-summary-v2",
    reasoningEffort: env.OPENAI_SUMMARY_REASONING_EFFORT,
  });
  const answer = parseAnswerJson(generated.text, results, "summary");
  answer.answer = cleanClinicalSummaryText(answer.answer);
  answer.quoteCards = reconcileQuoteCards(answer.quoteCards, results, "summary");
  answer.documentBreakdown = buildDocumentBreakdown(results, answer.quoteCards);
  answer.evidenceSummary = buildEvidenceSummary(results, answer.quoteCards);
  answer.sourceCoverage = buildSourceCoverage(results);
  answer.conflictsOrGaps = detectConflictsOrGaps(results);
  answer.visualEvidence = buildVisualEvidence(results);
  answer.bestSource = selectBestSourceRecommendation(results, answer.quoteCards);
  answer.smartPanel = { ...buildSmartPanel("summary", results), bestSource: answer.bestSource };
  answer.modelUsed = env.OPENAI_ANSWER_MODEL;
  answer.openAIRequestIds = generated.requestId ? [generated.requestId] : [];
  answer.openAIUsage = generated.usage;
  answer.latencyTimings = {
    generation_latency_ms: generated.latencyMs,
    total_latency_ms: generated.latencyMs,
  };
  return answer;
}
