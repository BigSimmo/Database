import { createAdminClient } from "@/lib/supabase/admin";
import { embedTextWithTelemetry, generateStructuredTextResult, type OpenAITextResult } from "@/lib/openai";
import { compactCitations } from "@/lib/citations";
import { VERIFY_AGAINST_SOURCE_NOTE, verifyAnswerNumbers } from "@/lib/answer-verification";
import {
  buildClinicalTextSearchQuery,
  classifyRagQuery,
  analyzeClinicalQuery,
  expandClinicalQuery,
  hasDoseEvidenceSupport,
  hasStructuredThresholdEvidence,
  normalizedClinicalSearchTokens,
  rankClinicalResults,
} from "@/lib/clinical-search";
import { env, isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { queryPrivacyMetadata, queryTextForStorage } from "@/lib/query-privacy";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import { isReviewedTablePromotable } from "@/lib/table-review";
import { isClinicalImageEvidence } from "@/lib/image-filtering";
import { chooseAnswerRoute, hasDirectTitleSupport, shouldRetryWithStrongAfterFast } from "@/lib/rag-routing";
import { fetchRelatedDocumentMetadata, fetchRelatedDocuments } from "@/lib/document-enrichment";
import { boldHighYieldClinicalText, boldRagAnswerHighYieldText, rankAnswerEvidence } from "@/lib/answer-ranking";
import { applyMemoryCardBoosts, fetchMemoryCardsForQuery, ragDeepMemoryVersion } from "@/lib/deep-memory";
import {
  cleanClinicalSummaryText,
  clinicalProseUsefulness,
  isLowYieldClinicalText,
  sourceTextForClinicalProse,
  sourceTextForDisplay,
  sourceTextForModel,
} from "@/lib/source-text-sanitizer";
import {
  buildCrossDocumentFusionBrief,
  buildCrossDocumentSourceGuide,
  buildCrossDocumentSynthesisPlan,
} from "@/lib/cross-document-synthesis";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
import { clinicalModePrompt, queryClassForClinicalMode, queryForClinicalMode } from "@/lib/clinical-query-mode";
import { annotateSearchResults, buildEvidenceRelevance } from "@/lib/evidence-relevance";
import { z } from "zod";
import {
  buildDocumentBreakdown,
  buildEvidenceSummary,
  buildSmartPanel,
  buildSourceCoverage,
  buildVisualEvidence,
  detectConflictsOrGaps,
  diversifySearchResults,
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
  description: "A source-grounded clinical answer generated only from retrieved document excerpts.",
  additionalProperties: false,
  properties: {
    answer: {
      type: "string",
      description:
        "The first-layer response: a concise direct answer that can stand alone before structured supporting sections.",
      maxLength: 1200,
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
            maxLength: 420,
          },
          citation_chunk_ids: {
            type: "array",
            description: "Retrieved chunk IDs that directly support this section.",
            items: { type: "string" },
          },
        },
        required: ["heading", "kind", "supportLevel", "body", "citation_chunk_ids"],
      },
    },
    citations: {
      type: "array",
      description: "The strongest retrieved chunk IDs that directly support the answer.",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chunk_id: { type: "string", description: "A citation_chunk_id from the supplied source block." },
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
          chunk_id: { type: "string", description: "A citation_chunk_id from the supplied source block." },
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

const likelyFragmentPhrases =
  /\b(?:answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|conflictsOrGaps|quoteCards?|source_chunk_ids|chunk_id)\b/i;
const answerSectionArtifactPattern =
  /"?(answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|conflictsOrGaps|quoteCards?|source_chunk_ids|chunk_id)"?\s*:\s*/i;

function normalizeSectionText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function splitBalancedWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function looksLikeJsonArtifact(value: string) {
  const normalized = normalizeSectionText(value);
  if (!normalized) return true;
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasJsonStructure = /[{}\[\]]/.test(normalized);
  const quoteCount = (normalized.match(/"/g) ?? []).length;
  const colonCount = (normalized.match(/:/g) ?? []).length;
  const keyValuePairs = (normalized.match(/"[^"]+"\s*:\s*/g) ?? []).length;
  const keyPairDensity = tokenCount > 0 ? keyValuePairs / tokenCount : 0;
  const hasKnownKeys = likelyFragmentPhrases.test(normalized);
  const hasBalancedBraces = (normalized.match(/[{}\[\]]/g) ?? []).length >= 2;
  const hasBalancedBrackets = (normalized.match(/[\[\]]/g) ?? []).length >= 2;
  const tokenDensity = splitBalancedWords(normalized);
  const isMostlyPunctuationNoise = tokenDensity.length >= 6 && tokenDensity.every((word) => word.length <= 2);
  const hasBracketKeyPairs =
    /"\s*(?:answer|heading|body|grounded|confidence|citation_chunk_ids|conflictsOrGaps|quoteCards?|source_chunk_ids|chunk_id)\s*"/i.test(
      normalized,
    );

  if (normalized.startsWith("{") && normalized.endsWith("}") && (hasKnownKeys || quoteCount >= 4)) {
    return true;
  }

  if (
    hasJsonStructure &&
    hasBalancedBraces &&
    keyValuePairs >= 2 &&
    quoteCount >= 4 &&
    colonCount >= 2 &&
    hasKnownKeys &&
    (tokenCount <= 70 || keyPairDensity > 0.2)
  ) {
    return true;
  }

  if (
    normalized.includes("}") &&
    normalized.includes("{") &&
    hasKnownKeys &&
    /"[^"]+":\s*"/.test(normalized) &&
    tokenCount <= 40
  ) {
    return true;
  }

  if (isMostlyPunctuationNoise) return true;
  if (
    hasBracketKeyPairs &&
    hasJsonStructure &&
    (quoteCount >= 2 || colonCount >= 2 || hasBalancedBrackets) &&
    tokenCount <= 70
  ) {
    return true;
  }

  return false;
}

function sanitizeStructuredText(
  value: string,
  options: { minLength?: number; minTokens?: number; keepLeading?: boolean } = {},
) {
  const { minLength = 2, minTokens = 1, keepLeading = false } = options;
  const normalized = normalizeSectionText(sourceTextForClinicalProse(value));
  if (!normalized) return "";

  const trimmed =
    normalized.search(answerSectionArtifactPattern) === 0
      ? normalized.replace(answerSectionArtifactPattern, "").trim()
      : normalized.search(answerSectionArtifactPattern) > 0
        ? normalized.slice(0, normalized.search(answerSectionArtifactPattern)).trim()
        : normalized;

  const finalText = keepLeading ? trimmed : trimmed.trim();
  if (!finalText) return "";
  if (finalText.length < minLength) return "";
  if (looksLikeJsonArtifact(finalText)) return "";
  const tokenCount = finalText.split(/\s+/).filter(Boolean).length;
  if (tokenCount < minTokens) return "";
  if (!/[A-Za-z]{2,}/.test(finalText)) return "";
  const usefulness = clinicalProseUsefulness(finalText);
  if (!usefulness.useful && isLowYieldClinicalText(finalText)) return "";
  return usefulness.text || finalText;
}

function sanitizeAnswerText(value: string) {
  return sanitizeStructuredText(value, { minLength: 8, minTokens: 2, keepLeading: true });
}

function isUsableAnswerSectionText(value: string, options: { minTokens?: number; minLength?: number } = {}) {
  return Boolean(sanitizeStructuredText(value, options));
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

export type SearchTelemetry = {
  search_cache_hit: boolean;
  shared_cache_hit?: boolean;
  query_class?: RagQueryClass;
  retrieval_query_variant_count?: number;
  rag_alias_count?: number;
  rag_alias_expansion_count?: number;
  text_fast_path_latency_ms: number;
  embedding_skipped: boolean;
  embedding_latency_ms: number;
  embedding_cache_hit: boolean;
  supabase_rpc_latency_ms: number;
  rerank_latency_ms: number;
  memory_card_count?: number;
  memory_top_score?: number;
  index_unit_count?: number;
  index_unit_top_score?: number;
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

function recordSearchScoreTelemetry(telemetry: SearchTelemetry, results: SearchResult[]) {
  if (!results.length) {
    telemetry.top_score = 0;
    telemetry.second_top_score = 0;
    telemetry.score_spread = 0;
    telemetry.weighted_top_score = 0;
    telemetry.rrf_top_score = 0;
    telemetry.score_distinct_documents = 0;
    telemetry.retrieval_candidate_count = results.length;
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

function deriveConfidence(results: SearchResult[], acceptedCitationCount: number): RagAnswer["confidence"] {
  if (acceptedCitationCount === 0 || results.length === 0) return "unsupported";
  const strongest = results.reduce((max, result) => Math.max(max, result.similarity), 0);
  if (strongest >= 0.82 && acceptedCitationCount >= 2) return "high";
  if (strongest >= 0.64) return "medium";
  return "low";
}

function scoreValue(result: SearchResult) {
  return result.hybrid_score ?? result.similarity ?? 0;
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
};

function sanitizeCitations(proposed: Array<{ chunk_id: string }> | undefined, results: SearchResult[]): SanitizedCitations {
  const chunks = allowedChunkMap(results);
  const citations: Citation[] = [];
  const seen = new Set<string>();

  for (const citation of proposed ?? []) {
    const source = chunks.get(citation.chunk_id);
    if (!source || seen.has(source.id)) continue;
    seen.add(source.id);
    citations.push(resultCitation(source));
  }

  if (citations.length > 0) return { citations, modelCited: true };
  return { citations: [], modelCited: false };
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

function sanitizeAnswerSections(
  sections: AnswerSection[] | undefined,
  results: SearchResult[],
  query?: string,
): AnswerSection[] {
  const allowed = allowedChunkMap(results);
  const seen = new Set<string>();

  return (sections ?? [])
    .map((section) => {
      const heading = sanitizeStructuredText(section.heading, { minLength: 1, minTokens: 1 });
      const body = removeIncompleteTrailingSentence(
        sanitizeStructuredText(section.body, { minLength: 8, minTokens: 2 }),
      );
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
      if (isLowYieldClinicalText(`${section.heading}. ${section.body}`)) return false;
      const key = `${section.heading.toLowerCase()}||${section.body.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
        /fallback|unsupported|no_|limited_retrieval|gap|conflict|failed|confidence_gate|low_signal/i.test(part),
      ) ?? null
  );
}

const answerCache = new Map<string, { expiresAt: number; answer: RagAnswer }>();
const searchCache = new Map<string, { expiresAt: number; results: SearchResult[]; telemetry: SearchTelemetry }>();
const ragCacheDependencyVersion = "rag-cache-v8";
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
        reasoningEffort: "minimal",
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
  return JSON.parse(JSON.stringify(answer)) as RagAnswer;
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

function scopedSearchCacheKey(args: SearchChunksArgs) {
  return [
    args.ownerId ?? "anonymous",
    scopeKey(args),
    modeKey(args),
    normalizedCacheQuery(args.query),
    args.topK ?? 8,
    args.minSimilarity ?? 0.15,
  ].join("|");
}

function cloneSearchResults(results: SearchResult[]) {
  return JSON.parse(JSON.stringify(results)) as SearchResult[];
}

function getCachedSearch(args: SearchChunksArgs) {
  if (args.skipCache || env.RAG_SEARCH_CACHE_TTL_MS <= 0 || env.RAG_SEARCH_CACHE_SIZE <= 0) return null;

  const key = scopedSearchCacheKey(args);
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
    },
  };
}

function setCachedSearch(args: SearchChunksArgs, results: SearchResult[], telemetry: SearchTelemetry) {
  if (args.skipCache || env.RAG_SEARCH_CACHE_TTL_MS <= 0 || env.RAG_SEARCH_CACHE_SIZE <= 0) return;

  const key = scopedSearchCacheKey(args);
  searchCache.set(key, {
    expiresAt: Date.now() + env.RAG_SEARCH_CACHE_TTL_MS,
    results: cloneSearchResults(results),
    telemetry: { ...telemetry },
  });

  while (searchCache.size > env.RAG_SEARCH_CACHE_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    if (!oldestKey) break;
    searchCache.delete(oldestKey);
  }
  setSharedCachedSearch(args, results, telemetry);
}

type SharedCacheKind = "search" | "answer";

function sharedCacheSelector(
  supabase: ReturnType<typeof createAdminClient>,
  kind: SharedCacheKind,
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "queryMode">,
  indexingVersion: string,
) {
  let query = supabase
    .from("rag_response_cache")
    .select("payload")
    .eq("cache_kind", kind)
    .eq("scope_key", scopeKey(args))
    .eq("normalized_query", normalizedCacheQuery(`${modeKey(args)} ${args.query}`))
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

async function getSharedCachedSearch(args: SearchChunksArgs) {
  if (args.skipCache || env.RAG_SEARCH_CACHE_TTL_MS <= 0) return null;
  try {
    const indexingVersion = await cacheIndexingVersion(args);
    const { data, error } = await sharedCacheSelector(
      createAdminClient(),
      "search",
      args,
      indexingVersion,
    ).maybeSingle();
    if (error || !data?.payload) return null;
    const payload = data.payload as { results?: SearchResult[]; telemetry?: Partial<SearchTelemetry> };
    if (!Array.isArray(payload.results)) return null;
    return {
      results: cloneSearchResults(payload.results),
      telemetry: {
        search_cache_hit: true,
        shared_cache_hit: true,
        query_class: payload.telemetry?.query_class,
        retrieval_query_variant_count: payload.telemetry?.retrieval_query_variant_count ?? 0,
        text_fast_path_latency_ms: 0,
        embedding_skipped: true,
        embedding_latency_ms: 0,
        embedding_cache_hit: false,
        supabase_rpc_latency_ms: 0,
        rerank_latency_ms: 0,
        memory_card_count: payload.telemetry?.memory_card_count ?? 0,
        memory_top_score: payload.telemetry?.memory_top_score ?? 0,
        index_unit_count: payload.telemetry?.index_unit_count ?? 0,
        index_unit_top_score: payload.telemetry?.index_unit_top_score ?? 0,
        weighted_top_score: payload.telemetry?.weighted_top_score ?? 0,
        rrf_top_score: payload.telemetry?.rrf_top_score ?? 0,
        retrieval_strategy: "search_cache" as const,
      },
    };
  } catch {
    return null;
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
      .eq("normalized_query", normalizedCacheQuery(`${modeKey(args)} ${args.query}`))
      .eq("indexing_version", indexingVersion)
      .eq("dependency_version", ragCacheDependencyVersion);
    deleteQuery = args.ownerId ? deleteQuery.eq("owner_id", args.ownerId) : deleteQuery.is("owner_id", null);
    await deleteQuery;
    await supabase.from("rag_response_cache").insert({
      owner_id: args.ownerId ?? null,
      cache_kind: kind,
      scope_key: scopeKey(args),
      normalized_query: normalizedCacheQuery(`${modeKey(args)} ${args.query}`),
      indexing_version: indexingVersion,
      dependency_version: ragCacheDependencyVersion,
      payload,
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
    });
  } catch {
    // Shared cache must never be part of the correctness path.
  }
}

function setSharedCachedSearch(args: SearchChunksArgs, results: SearchResult[], telemetry: SearchTelemetry) {
  if (args.skipCache || env.RAG_SEARCH_CACHE_TTL_MS <= 0) return;
  void replaceSharedCacheRow(
    "search",
    args,
    { results: cloneSearchResults(results), telemetry },
    env.RAG_SEARCH_CACHE_TTL_MS,
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
    searchCache.clear();
    cacheIndexingVersionCache.clear();
    void (async () => {
      try {
        await createAdminClient().from("rag_response_cache").delete().in("cache_kind", ["search", "answer"]);
      } catch {
        // Shared cache invalidation is best effort.
      }
    })();
    return;
  }

  const prefix = `${ownerId}|`;
  const sharedCacheOwnerId = ownerId === "anonymous" ? null : ownerId;
  for (const key of answerCache.keys()) {
    if (key.startsWith(prefix)) answerCache.delete(key);
  }
  for (const key of searchCache.keys()) {
    if (key.startsWith(prefix)) searchCache.delete(key);
  }
  for (const key of cacheIndexingVersionCache.keys()) {
    if (key.startsWith(prefix)) cacheIndexingVersionCache.delete(key);
  }
  void (async () => {
    try {
      await createAdminClient()
        .from("rag_response_cache")
        .delete()
        [sharedCacheOwnerId ? "eq" : "is"]("owner_id", sharedCacheOwnerId)
        .in("cache_kind", ["search", "answer"]);
    } catch {
      // Shared cache invalidation is best effort.
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
    } catch {
      // Shared cache invalidation is best effort.
    }
  })();
}

export function invalidateRagCachesForDocumentMutation(ownerId: string) {
  invalidateRagCachesForOwner(ownerId);
  invalidateAnonymousSharedRagCaches();
}

async function insertRagQuery(row: Record<string, unknown>) {
  const supabase = createAdminClient();
  // Redact potential-PHI raw query text centrally so every logRagQuery caller is
  // covered, and fold a stable hash + retention flag into metadata (RET-H4).
  const rawQuery = typeof row.query === "string" ? row.query : "";
  const existingMetadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
  const safeRow = {
    ...row,
    query: queryTextForStorage(rawQuery),
    metadata: { ...existingMetadata, ...queryPrivacyMetadata(rawQuery) },
  };
  await supabase.from("rag_queries").insert(safeRow);
}

async function logRagQuery(row: Record<string, unknown>) {
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
    const nullableQuery = query as typeof query & { is?: (column: string, value: null) => typeof query };
    query = scopeOwnerId
      ? query.eq("owner_id", scopeOwnerId)
      : nullableQuery.is
        ? nullableQuery.is("owner_id", null)
        : query.eq("owner_id", null);
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

async function searchTextChunkCandidates(args: {
  supabase: ReturnType<typeof createAdminClient>;
  queryVariants: string[];
  ownerId?: string;
  documentIds?: string[];
  matchCount: number;
}) {
  const variants = args.queryVariants.slice(0, maxTextRpcQueryVariants);
  const resultSets = await Promise.all(
    variants.map(async (variant, index) => {
      const { data, error } = await args.supabase.rpc("match_document_chunks_text", {
        query_text: variant,
        match_count: index === 0 ? args.matchCount : Math.min(args.matchCount, 32),
        document_filters: args.documentIds ?? null,
        owner_filter: args.ownerId ?? null,
      });
      if (error || !data?.length) return [] as SearchResult[];
      return data as SearchResult[];
    }),
  );
  return resultSets.reduce((merged, resultSet) => mergeSearchResults(resultSet, merged), [] as SearchResult[]);
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
}) {
  const terms = documentLookupChunkTerms(args.query);
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
        owner_filter: args.ownerId ?? null,
      });
      if (error || !data?.length) return [] as DocumentLookupRow[];
      return data as DocumentLookupRow[];
    }),
  );
  const documentsById = new Map<string, DocumentLookupRow>();
  for (const document of documentSets.flat()) {
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
      "id,document_id,page_number,chunk_index,section_heading,section_path,heading_level,parent_heading,anchor_id,content,retrieval_synopsis,image_ids",
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
      "id,document_id,page_number,chunk_index,section_heading,section_path,heading_level,parent_heading,anchor_id,content,retrieval_synopsis,image_ids",
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
        document_filters: args.documentIds ?? null,
        owner_filter: args.ownerId ?? null,
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
}) {
  const { data, error } = await args.supabase.rpc("match_document_embedding_fields_hybrid", {
    query_embedding: args.queryEmbedding,
    query_text: buildClinicalTextSearchQuery(args.query),
    match_count: args.matchCount,
    min_similarity: 0.12,
    document_filters: args.documentIds ?? null,
    owner_filter: args.ownerId ?? null,
  });
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
}) {
  const { data, error } = await args.supabase.rpc("match_document_index_units_hybrid", {
    query_embedding: args.queryEmbedding,
    query_text: buildClinicalTextSearchQuery(args.query),
    match_count: args.matchCount,
    min_similarity: 0.1,
    document_filters: args.documentIds ?? null,
    owner_filter: args.ownerId ?? null,
  });
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

async function withMemoryBoostedCandidates(args: {
  supabase: ReturnType<typeof createAdminClient>;
  query: string;
  candidates: SearchResult[];
  queryEmbedding?: number[];
  ownerId?: string;
  documentIds?: string[];
  matchCount: number;
}) {
  const cards = await fetchMemoryCardsForQuery({
    supabase: args.supabase,
    query: args.query,
    queryEmbedding: args.queryEmbedding,
    ownerId: args.ownerId,
    documentIds: args.documentIds,
    matchCount: Math.max(args.matchCount, 48),
  });
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
) {
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
      indexing_quality: qualityByDocument.get(result.document_id) ?? result.indexing_quality ?? null,
    }));
  } catch {
    return results;
  }
}

async function packAdjacentSourceContext(
  supabase: ReturnType<typeof createAdminClient>,
  results: SearchResult[],
  queryClass: RagQueryClass,
  options: { crossDocument?: boolean } = {},
) {
  const contextLimit = options.crossDocument || queryClass === "comparison" || queryClass === "broad_summary" ? 8 : 5;
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
      .select("id,document_id,page_number,chunk_index,section_heading,content,retrieval_synopsis")
      .in("document_id", documentIds)
      .in("chunk_index", chunkIndexes)
      .order("chunk_index", { ascending: true })
      .limit(80);

    if (error || !data?.length) return results;

    const chunksByDocumentAndIndex = new Map<
      string,
      { id: string; section_heading: string | null; content: string; retrieval_synopsis?: string | null }
    >();
    for (const chunk of data) {
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
  if (documentIds.length === 0 || pageNumbers.length === 0) return results;

  const { data, error } = await supabase
    .from("document_images")
    .select(
      "id,document_id,page_number,storage_path,caption,bbox,image_type,searchable,clinical_relevance_score,source_kind,width,height,labels,metadata",
    )
    .in("document_id", documentIds)
    .in("page_number", pageNumbers)
    .eq("searchable", true)
    .neq("image_type", "logo_decorative")
    .order("clinical_relevance_score", { ascending: false })
    .limit(80);

  if (error || !data?.length) return results;

  const imagesByPage = new Map<string, ChunkImage[]>();
  for (const image of data) {
    const metadata = safeRecord(image.metadata);
    const rawTableText = metadataText(metadata, "table_text");
    const tableText = metadataText(metadata, "table_text_snippet") ?? rawTableText;
    const publicImage: ChunkImage = {
      id: image.id,
      page_number: image.page_number,
      storage_path: image.storage_path,
      caption: image.caption,
      bbox: image.bbox,
      image_type: image.image_type,
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
    const key = `${image.document_id}:${image.page_number}`;
    imagesByPage.set(key, [...(imagesByPage.get(key) ?? []), publicImage]);
  }

  return results.map((result) => {
    const pageImages = imagesByPage.get(`${result.document_id}:${result.page_number}`) ?? [];
    if (pageImages.length === 0) return result;
    const seen = new Set((result.images ?? []).map((image) => image.id));
    const mergedImages = [...(result.images ?? []), ...pageImages.filter((image) => !seen.has(image.id))].slice(0, 4);
    return { ...result, images: mergedImages };
  });
}

function shouldReturnTextFastPath(query: string, results: SearchResult[]) {
  if (results.length === 0) return false;

  const queryClass = classifyRagQuery(query).queryClass;
  if (queryClass === "comparison") return false;
  if (
    queryClass === "table_threshold" &&
    !results.slice(0, 5).some((result) => hasStructuredThresholdEvidence(result))
  ) {
    return false;
  }
  if (queryClass === "medication_dose_risk" && !results.slice(0, 5).some((result) => hasDoseEvidenceSupport(result))) {
    return false;
  }

  const strongestScore = results.reduce((max, result) => Math.max(max, result.hybrid_score ?? result.similarity), 0);
  const topTextRank = Math.max(...results.map((result) => result.text_rank ?? 0));
  return (
    strongestScore >= 0.56 ||
    topTextRank >= 0.05 ||
    (hasDirectTitleSupport(query, results) && strongestScore >= 0.4) ||
    (queryClass === "document_lookup" && hasDirectTitleSupport(query, results) && strongestScore >= 0.35)
  );
}

function shouldAttemptDocumentLookupFastPath(queryClass: RagQueryClass) {
  return queryClass === "document_lookup" || queryClass === "table_threshold";
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

function memoryCardAnswerLabel(card: DocumentMemoryCard) {
  if (card.card_type === "table_row") return "Table evidence";
  if (card.card_type === "threshold") return "Threshold/action";
  if (card.card_type === "medication") return "Medication point";
  if (card.card_type === "risk") return "Risk/escalation";
  if (card.card_type === "workflow") return "Workflow step";
  if (card.card_type === "section_summary") return "Section summary";
  return "Source point";
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

function selectDiverseMemoryCards(cards: DocumentMemoryCard[], limit: number) {
  const selected: Array<{ card: DocumentMemoryCard; tokens: Set<string> }> = [];
  for (const card of cards) {
    const tokens = new Set(
      splitBalancedWords(card.content).filter((token) => token.length > 3 && !/^\d+$/.test(token)),
    );
    const duplicate = selected.some((item) => {
      if (tokens.size === 0 || item.tokens.size === 0) return false;
      const overlap = Array.from(tokens).filter((token) => item.tokens.has(token)).length;
      return overlap / Math.min(tokens.size, item.tokens.size) >= 0.72;
    });
    if (duplicate) continue;
    selected.push({ card, tokens });
    if (selected.length >= limit) break;
  }
  return selected.map((item) => item.card);
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

type ExtractiveAnswerPoint = {
  label: string;
  text: string;
  citationChunkIds: string[];
  source: "dose" | "memory" | "quote";
};

function cleanExtractiveLine(line: string) {
  return sourceTextForClinicalProse(line)
    .replace(/^[-•]\s*/, "")
    .replace(/^Agitation and Arousal:?\s+Pharmacological Management Guideline\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const extractiveLabelPattern =
  /\b(?:Medication point|Table evidence|Threshold\/action|Risk\/escalation|Workflow step|Section summary|Source point|Dose detail|Monitoring)\s*:\s*/gi;

function cleanExtractivePointText(value: string) {
  return sourceTextForClinicalProse(value)
    .replace(extractiveLabelPattern, " ")
    .replace(/^[\s\-•:]+/, "")
    .replace(/^(?:monitoring|dose|dosing|source|section|table|guideline)\s*[.;:,-]\s*/i, "")
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
  /\b(?:arrange|assess|cease|check|complete|contact|continue|discontinue|escalate|notify|prescribe|record|refer|report|review|stop|withhold|must|required|requires?|should)\b/i;

function isLowValueExtractiveCaption(clause: string) {
  const descriptor =
    /^(?:clinical\s+table|table|figure|image)\s+(?:showing|detailing|listing|outlining|describing|with|of)\b/i.test(
      clause,
    ) || /\btable\s+(?:showing|detailing|listing|outlining|describing)\b/i.test(clause);
  if (!descriptor) return false;
  return !extractiveClinicalDirectivePattern.test(clause);
}

function sourcePointClauses(value: string, query: string) {
  const tokens = splitBalancedWords(query).filter((token) => token.length > 3);
  const clauses = cleanExtractivePointText(value)
    .split(/(?<=[.!?])\s+|\s+[•]\s+|\s+\|\s+/)
    .map((clause) => cleanExtractivePointText(clause))
    .filter((clause) => clause.length >= 18 && !looksLikeJsonArtifact(clause) && !isLowValueExtractiveCaption(clause));

  return clauses
    .map((clause, index) => {
      const lower = clause.toLowerCase();
      const tokenHits = tokens.filter((token) => lower.includes(token)).length;
      const clinicalSignal =
        /\b(?:monitor|blood test|fbc|anc|level|baseline|review|urgent|escalat|dose|mg|withhold|cease|form|consent|commence|annual)\b/i.test(
          clause,
        )
          ? 1
          : 0;
      const lengthPenalty = clause.length > 260 ? 0.8 : clause.length > 190 ? 0.25 : 0;
      return { clause, score: tokenHits + clinicalSignal - lengthPenalty, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => (item.clause.length <= 240 ? item.clause : `${item.clause.slice(0, 237).trim()}...`));
}

function bestNaturalSourcePoint(value: string, query: string) {
  return sourcePointClauses(value, query)[0] ?? "";
}

function uniqueExtractivePoints(points: ExtractiveAnswerPoint[], limit: number) {
  const seen = new Set<string>();
  const selected: ExtractiveAnswerPoint[] = [];
  for (const point of points) {
    const normalized = cleanExtractivePointText(point.text).toLowerCase();
    const key = normalized.slice(0, 140);
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    selected.push({ ...point, text: cleanExtractivePointText(point.text) });
    if (selected.length >= limit) break;
  }
  return selected;
}

function extractMedicationDosePoints(results: SearchResult[], query: string, limit = 4): ExtractiveAnswerPoint[] {
  const seen = new Set<string>();
  const points: ExtractiveAnswerPoint[] = [];
  const coreQueryTokens = splitBalancedWords(query).filter(
    (token) =>
      token.length > 3 &&
      !["dose", "dosing", "dosage", "medication", "medicine", "patient", "patients", "please"].includes(token),
  );

  for (const result of results) {
    const resultText = `${result.title} ${result.content}`.toLowerCase();
    if (coreQueryTokens.length && !coreQueryTokens.some((token) => resultText.includes(token))) continue;
    const lines = sourceTextForClinicalProse(result.content)
      .split(/\r?\n+|(?<=[.!?])\s+/)
      .map(cleanExtractiveLine)
      .filter((line) => line.length >= 24);
    const candidates = lines.flatMap((line) => {
      if (
        /\b(?:supporting information|relevant standards|references|document owner|authorisation|published date|amendment)\b/i.test(
          line,
        )
      )
        return [];
      if (/\b(?:warnings? on the use|black box warning|food and drug administration|ann emerg med)\b/i.test(line))
        return [];
      const isMonitoring = /\b(?:monitor(?:ing)?|observations?|ecg|respiratory|every \d+|minutes?|hours?)\b/i.test(
        line,
      );
      const doseAnchor = line.search(
        /\b(?:lorazepam|clonazepam|midazolam|risperidone|haloperidol|olanzapine|quetiapine|chlorpromazine|droperidol|promethazine|diazepam|\d+(?:\.\d+)?\s?mg|maximum\s+\d)/i,
      );
      const hasDoseAction =
        /\b(?:repeat(?:ing)? doses?|first dose|second dose|oral medication|im medication|maximum doses?|post im dose)\b/i.test(
          line,
        );
      if (doseAnchor < 0 && !isMonitoring && !hasDoseAction) return [];
      const headingMatch = [
        ...line.matchAll(
          /\b(?:Recommended pharmacological treatment options|Repeating doses|Reviewing response|Monitoring|Oral Intramuscular)\s*:/gi,
        ),
      ]
        .filter((match) => (match.index ?? 0) < Math.max(doseAnchor, 0))
        .at(-1);
      const focused =
        headingMatch?.index !== undefined
          ? line.slice(headingMatch.index)
          : doseAnchor > 80
            ? line.slice(Math.max(0, doseAnchor - 60))
            : line;
      return [focused.replace(/^[^A-Za-z0-9]*(?:Appendix|Step)\s*\d*:?[^A-Za-z0-9]*/i, "").trim()];
    });

    for (const candidate of candidates) {
      for (const clause of sourcePointClauses(candidate, query).slice(0, 3)) {
        const text = clause.length <= 280 ? clause : `${clause.slice(0, 277).trim()}...`;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const hasDrugDose =
          /\b(?:lorazepam|clonazepam|midazolam|risperidone|haloperidol|olanzapine|quetiapine|chlorpromazine|droperidol|promethazine|diazepam|\d+(?:\.\d+)?\s?mg|maximum\s+\d)\b/i.test(
            text,
          );
        const label =
          !hasDrugDose && /\b(?:monitor|observe|ecg|physiological|respiratory|minutes?|hours?)\b/i.test(text)
            ? "Monitoring"
            : "Dose detail";
        points.push({ label, text, citationChunkIds: [result.id], source: "dose" });
        if (points.length >= limit) return points;
      }
    }
  }

  return points;
}

function memoryCardToExtractivePoint(card: DocumentMemoryCard, query: string): ExtractiveAnswerPoint | null {
  const text = bestNaturalSourcePoint(card.content, query);
  if (!text) return null;
  return {
    label: memoryCardAnswerLabel(card),
    text,
    citationChunkIds: card.source_chunk_ids ?? [],
    source: "memory",
  };
}

function quoteToExtractivePoint(quote: QuoteCard, query: string): ExtractiveAnswerPoint | null {
  const text = bestNaturalSourcePoint(
    `${quote.section_heading ? `${quote.section_heading}: ` : ""}${quote.quote}`,
    query,
  );
  if (!text) return null;
  return {
    label: quote.section_heading ?? "Source quote",
    text,
    citationChunkIds: [quote.chunk_id],
    source: "quote",
  };
}

function naturalAnswerLead(query: string, queryClass: RagQueryClass, points: ExtractiveAnswerPoint[]) {
  if (/\bclozapine\b/i.test(query) && /\bmonitor/i.test(query)) {
    return "The retrieved clozapine sources support a monitoring-focused answer, but the selected excerpts are strongest for specific source points rather than a full monitoring schedule.";
  }
  if (queryClass === "medication_dose_risk") {
    return "The retrieved medication/risk sources support these practical points.";
  }
  if (queryClass === "table_threshold") {
    return "The retrieved table or threshold evidence supports these points.";
  }
  if (points.length === 1) return "The strongest retrieved source supports this point.";
  return "The strongest retrieved sources support these points.";
}

function formatNaturalPoint(point: ExtractiveAnswerPoint) {
  const text = cleanExtractivePointText(point.text).replace(/[.;,\s]+$/, "");
  if (!text) return "";
  if (
    /^(the|this|these|there|monitor|review|ensure|commence|copy|prescribe|annual|time since|blood test)\b/i.test(text)
  ) {
    return `${text}.`;
  }
  if (point.label === "Monitoring") return `Monitoring evidence: ${text}.`;
  if (point.label === "Dose detail") return `Dose evidence: ${text}.`;
  return `${text}.`;
}

function buildNaturalExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  points: ExtractiveAnswerPoint[];
  sourceCount: number;
}) {
  const points = uniqueExtractivePoints(args.points, 3);
  if (!points.length) {
    return {
      answer:
        "The indexed source passages matched the question, but no concise source sentence could be extracted. Open the cited sources before relying on this result.",
      body: "No concise source sentence could be extracted from the selected passages. Use the linked citations to inspect the source text.",
      citationChunkIds: [] as string[],
    };
  }

  const lead = naturalAnswerLead(args.query, args.queryClass, points);
  const pointSentences = points.map(formatNaturalPoint).filter(Boolean);
  const caveat =
    args.queryClass === "medication_dose_risk" && /\bmonitor/i.test(args.query)
      ? "If you need the complete monitoring schedule, open the linked source pages and check the surrounding table or section."
      : "";
  const answer = [lead, ...pointSentences, caveat].filter(Boolean).join(" ");
  const body = [lead, ...pointSentences].filter(Boolean).join(" ");

  return {
    answer: boldHighYieldClinicalText(answer, args.query),
    body: boldHighYieldClinicalText(body, args.query),
    citationChunkIds: Array.from(new Set(points.flatMap((point) => point.citationChunkIds))),
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
    if (!citationIds.has(quote.chunk_id))
      citations.push(resultCitation(args.results.find((result) => result.id === quote.chunk_id)!));
    citationIds.add(quote.chunk_id);
  }

  const dosePoints =
    args.queryClass === "medication_dose_risk" ? extractMedicationDosePoints(args.results, args.query, 4) : [];
  const remainingPointSlots = Math.max(0, 5 - dosePoints.length);
  const memoryPointLimit = Math.min(remainingPointSlots, memoryCards.length >= 4 ? 3 : 2);
  const memoryPoints = selectDiverseMemoryCards(memoryCards, memoryPointLimit)
    .map((card) => memoryCardToExtractivePoint(card, args.query))
    .filter((point): point is ExtractiveAnswerPoint => Boolean(point));
  const quotePoints = quoteCards
    .slice(0, Math.max(0, 5 - dosePoints.length - memoryPoints.length))
    .map((quote) => quoteToExtractivePoint(quote, args.query))
    .filter((point): point is ExtractiveAnswerPoint => Boolean(point));
  const naturalAnswer = buildNaturalExtractiveAnswer({
    query: args.query,
    queryClass: args.queryClass,
    points: [...dosePoints, ...memoryPoints, ...quotePoints],
    sourceCount: args.results.length,
  });

  return {
    answer: naturalAnswer.answer,
    grounded: citations.length > 0,
    confidence: deriveConfidence(args.results, citations.length),
    citations: citations.slice(0, 5),
    sources: args.results,
    modelUsed: null,
    routingMode: "extractive",
    routingReason: args.routeReason,
    queryClass: args.queryClass,
    latencyTimings: args.timings,
    answerSections: naturalAnswer.citationChunkIds.length
      ? [
          {
            heading: "Direct source-backed answer",
            body: naturalAnswer.body,
            citation_chunk_ids: naturalAnswer.citationChunkIds,
          },
        ]
      : [],
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

function simplifySimpleGeneratedAnswer(answer: RagAnswer, query: string, queryClass: RagQueryClass) {
  if (!isSimpleDirectQuestion(query, queryClass)) return answer;
  const sections = answer.answerSections ?? [];
  if (sections.length === 0) return answer;

  const essentialSection = sections.find((section) => isEssentialSimpleQuestionSection(section));
  answer.answerSections = essentialSection ? [essentialSection] : [];
  return answer;
}

export async function searchChunksWithTelemetry(args: SearchChunksArgs) {
  assertGlobalSearchAllowed(args);
  const cached = getCachedSearch(args);
  if (cached) return cached;
  const sharedCached = await getSharedCachedSearch(args);
  if (sharedCached) {
    setCachedSearch(args, sharedCached.results, sharedCached.telemetry);
    return sharedCached;
  }

  const supabase = createAdminClient();
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
    retrieval_query_variant_count: 0,
    rag_alias_count: 0,
    rag_alias_expansion_count: 0,
    text_fast_path_latency_ms: 0,
    embedding_skipped: false,
    embedding_latency_ms: 0,
    embedding_cache_hit: false,
    supabase_rpc_latency_ms: 0,
    rerank_latency_ms: 0,
    memory_card_count: 0,
    memory_top_score: 0,
    index_unit_count: 0,
    index_unit_top_score: 0,
    weighted_top_score: 0,
    rrf_top_score: 0,
  };

  const ragAliases = await fetchEnabledRagAliases(supabase, args.ownerId);
  const ragAliasExpansions = selectRagAliasExpansions(retrievalQuery, ragAliases);
  telemetry.rag_alias_count = ragAliases.length;
  telemetry.rag_alias_expansion_count = ragAliasExpansions.length;

  if (shouldApplyUnsupportedSearchShortCircuit(retrievalQuery, queryAnalysis, ragAliasExpansions)) {
    telemetry.embedding_skipped = true;
    telemetry.retrieval_strategy = "unsupported_short_circuit";
    recordSearchScoreTelemetry(telemetry, []);
    setCachedSearch(args, [], telemetry);
    return { results: [] as SearchResult[], telemetry };
  }

  let expandedQuery = normalizeRetrievalVariant([expandClinicalQuery(retrievalQuery), ...ragAliasExpansions].join(" "));
  const queryVariants = buildRetrievalQueryVariants(retrievalQuery, queryAnalysis, ragAliases);
  telemetry.retrieval_query_variant_count = queryVariants.length;
  const textSearchQuery = queryVariants[0] ?? buildClinicalTextSearchQuery(retrievalQuery);
  const candidateMultiplier = queryClassification.queryClass === "comparison" ? 7 : 5;
  const candidateFloor = queryClassification.queryClass === "comparison" ? 72 : 48;
  const candidateCount = Math.max((args.topK ?? 8) * candidateMultiplier, candidateFloor);
  const maxResultsPerDocument = queryClassification.queryClass === "comparison" ? 2 : 4;
  const minSimilarity = args.minSimilarity ?? 0.15;
  let embeddingStartedAt = 0;
  const preloadedEmbedding = shouldPreloadEmbedding(queryAnalysis)
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
    matchCount: candidateCount,
  });
  telemetry.text_fast_path_latency_ms = Date.now() - textRpcStartedAt;
  telemetry.supabase_rpc_latency_ms += telemetry.text_fast_path_latency_ms;

  if (textData.length) {
    const rerankStartedAt = Date.now();
    const textCandidates = await attachDocumentRankingMetadata(supabase, textData as SearchResult[], args.ownerId);
    if (!preloadedEmbedding) {
      expandedQuery = expandClinicalQueryWithCandidateMetadata(args.query, expandedQuery, textCandidates);
    }
    const baseTextResults = diversifySearchResults(
      rankClinicalResults(retrievalQuery, textCandidates),
      args.topK ?? 8,
      maxResultsPerDocument,
      true,
    );

    if (
      shouldReturnTextFastPath(args.query, baseTextResults) &&
      !shouldUseMemoryBeforeFastPath(queryClassification.queryClass)
    ) {
      textFastResults = await attachPageVisualEvidence(supabase, baseTextResults);
      telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;
      telemetry.embedding_skipped = true;
      telemetry.retrieval_strategy = "text_fast_path";
      recordSearchScoreTelemetry(telemetry, textFastResults);
      setCachedSearch(args, textFastResults, telemetry);
      return { results: textFastResults, telemetry };
    }

    const memoryBoost = await withMemoryBoostedCandidates({
      supabase,
      query: retrievalQuery,
      candidates: textCandidates,
      ownerId: args.ownerId,
      documentIds: documentFilterList,
      matchCount: candidateCount,
    });
    telemetry.memory_card_count = Math.max(telemetry.memory_card_count ?? 0, memoryBoost.cards.length);
    telemetry.memory_top_score = Math.max(
      telemetry.memory_top_score ?? 0,
      ...memoryBoost.cards.map(memoryCardChunkScore),
    );
    textFastResults = diversifySearchResults(
      rankClinicalResults(retrievalQuery, memoryBoost.results),
      args.topK ?? 8,
      maxResultsPerDocument,
      true,
    );
    textFastResults = await attachPageVisualEvidence(supabase, textFastResults);
    telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;

    if (shouldReturnTextFastPath(args.query, textFastResults)) {
      telemetry.embedding_skipped = true;
      telemetry.retrieval_strategy = "text_fast_path";
      recordSearchScoreTelemetry(telemetry, textFastResults);
      setCachedSearch(args, textFastResults, telemetry);
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
    telemetry.supabase_rpc_latency_ms += Date.now() - tableFactStartedAt;
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
    telemetry.supabase_rpc_latency_ms += Date.now() - documentLookupStartedAt;

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
      });
      telemetry.memory_card_count = Math.max(telemetry.memory_card_count ?? 0, memoryBoost.cards.length);
      telemetry.memory_top_score = Math.max(
        telemetry.memory_top_score ?? 0,
        ...memoryBoost.cards.map(memoryCardChunkScore),
      );
      const documentLookupResults = await attachPageVisualEvidence(
        supabase,
        diversifySearchResults(
          rankClinicalResults(retrievalQuery, memoryBoost.results),
          args.topK ?? 8,
          maxResultsPerDocument,
          true,
        ),
      );
      telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;

      if (shouldReturnTextFastPath(args.query, documentLookupResults)) {
        telemetry.embedding_skipped = true;
        telemetry.retrieval_strategy = "document_lookup_fast_path";
        recordSearchScoreTelemetry(telemetry, documentLookupResults);
        setCachedSearch(args, documentLookupResults, telemetry);
        return { results: documentLookupResults, telemetry };
      }
      textFastResults = mergeSearchResults(documentLookupResults, textFastResults);
    }
  }

  if (!embeddingStartedAt) embeddingStartedAt = Date.now();
  let embeddingResult = await preloadedEmbedding;
  if (!embeddingResult) {
    embeddingStartedAt = Date.now();
    embeddingResult = await embedTextWithTelemetry(expandedQuery);
  }
  const { embedding, cacheHit } = embeddingResult;
  telemetry.embedding_latency_ms = Date.now() - embeddingStartedAt;
  telemetry.embedding_cache_hit = cacheHit;

  const embeddingFieldStartedAt = Date.now();
  const embeddingFieldCandidates = await searchEmbeddingFieldCandidates({
    supabase,
    query: args.query,
    queryEmbedding: embedding,
    ownerId: args.ownerId,
    documentIds: documentFilterList,
    matchCount: Math.min(candidateCount, 48),
  });
  telemetry.supabase_rpc_latency_ms += Date.now() - embeddingFieldStartedAt;
  if (embeddingFieldCandidates.length > 0) {
    textFastResults = mergeSearchResults(embeddingFieldCandidates, textFastResults);
  }

  const indexUnitStartedAt = Date.now();
  const indexUnitCandidates = await searchIndexUnitCandidates({
    supabase,
    query: args.query,
    queryEmbedding: embedding,
    ownerId: args.ownerId,
    documentIds: documentFilterList,
    matchCount: Math.min(candidateCount, 64),
  });
  telemetry.supabase_rpc_latency_ms += Date.now() - indexUnitStartedAt;
  telemetry.index_unit_count = indexUnitCandidates.length;
  telemetry.index_unit_top_score = Number(
    Math.max(0, ...indexUnitCandidates.map((result) => result.hybrid_score ?? result.similarity ?? 0)).toFixed(4),
  );
  if (indexUnitCandidates.length > 0) {
    textFastResults = mergeSearchResults(indexUnitCandidates, textFastResults);
  }

  const hybridRpcStartedAt = Date.now();
  const { data: hybridData, error: hybridError } = await supabase.rpc("match_document_chunks_hybrid", {
    query_embedding: embedding,
    query_text: textSearchQuery,
    match_count: candidateCount,
    min_similarity: minSimilarity,
    document_filters: documentFilterList ?? null,
    owner_filter: args.ownerId ?? null,
  });
  telemetry.supabase_rpc_latency_ms += Date.now() - hybridRpcStartedAt;

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
    });
    telemetry.memory_card_count = Math.max(telemetry.memory_card_count ?? 0, memoryBoost.cards.length);
    telemetry.memory_top_score = Math.max(
      telemetry.memory_top_score ?? 0,
      ...memoryBoost.cards.map(memoryCardChunkScore),
    );
    const results = await attachPageVisualEvidence(
      supabase,
      diversifySearchResults(
        rankClinicalResults(retrievalQuery, memoryBoost.results),
        args.topK ?? 8,
        maxResultsPerDocument,
        true,
      ),
    );
    telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;
    telemetry.retrieval_strategy = "hybrid";
    recordSearchScoreTelemetry(telemetry, results);
    setCachedSearch(args, results, telemetry);
    return { results, telemetry };
  }

  const vectorFilters = documentFilterList?.length ? documentFilterList : [null];

  const fallbackRpcStartedAt = Date.now();
  const resultSets = await Promise.all(
    vectorFilters.map(async (documentFilter) => {
      const { data, error } = await supabase.rpc("match_document_chunks", {
        query_embedding: embedding,
        match_count: candidateCount,
        min_similarity: minSimilarity,
        document_filter: documentFilter,
        owner_filter: args.ownerId ?? null,
      });

      if (error) throw new Error(error.message);
      return (data ?? []) as SearchResult[];
    }),
  ).catch((error) => {
    if (textFastResults.length > 0) return [] as SearchResult[][];
    throw error;
  });
  telemetry.supabase_rpc_latency_ms += Date.now() - fallbackRpcStartedAt;

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
  });
  telemetry.memory_card_count = Math.max(telemetry.memory_card_count ?? 0, memoryBoost.cards.length);
  telemetry.memory_top_score = Math.max(
    telemetry.memory_top_score ?? 0,
    ...memoryBoost.cards.map(memoryCardChunkScore),
  );
  const results = await attachPageVisualEvidence(
    supabase,
    diversifySearchResults(
      rankClinicalResults(retrievalQuery, memoryBoost.results),
      args.topK ?? 8,
      maxResultsPerDocument,
      true,
    ),
  );
  telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;
  telemetry.retrieval_strategy = "vector_fallback";
  recordSearchScoreTelemetry(telemetry, results);
  setCachedSearch(args, results, telemetry);
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

function compactContextText(text: string, limit: number) {
  const compact = sourceTextForModel(text).replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 3).trim()}...`;
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
  return compactContextText(snippet, 420);
}

function formatTableFactForSourceBlock(
  result: SearchResult,
  fact: NonNullable<SearchResult["table_facts"]>[number],
  rich: boolean,
) {
  if (!rich) {
    return compactContextText(
      [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
        .filter(Boolean)
        .join(" | "),
      360,
    );
  }

  const snippet = tableSnippetForFact(result, fact);
  return compactContextText(
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
    760,
  );
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
                image.tableTextSnippet ? `Table text: ${compactContextText(image.tableTextSnippet, 320)}` : "",
              ]
                .filter(Boolean)
                .join(" - "),
            )
            .join(" | ")}`
        : "";
      const adjacentContext = result.adjacent_context
        ? `\nNearby context from the same source: ${compactContextText(result.adjacent_context, 900)}`
        : "";
      const sectionPath = result.section_path?.length
        ? `\nSection path: ${result.section_path.join(" > ")}`
        : result.section_heading
          ? `\nSection: ${result.section_heading}`
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
            .map((card) => `${card.card_type}: ${compactContextText(card.content, 300)}`)
            .join(" | ")}`
        : "";
      const retrievalSynopsis = result.retrieval_synopsis
        ? `\nRetrieval synopsis: ${compactContextText(result.retrieval_synopsis, 700)}`
        : "";
      return [
        [
          `[${index + 1}] ${result.title} (${result.file_name}, ${page}, chunk ${result.chunk_index}, similarity ${result.similarity.toFixed(3)})`,
          `citation_chunk_id: ${result.id}`,
          `document_id: ${result.document_id}`,
        ].join("\n"),
        sectionPath,
        retrievalSynopsis,
        compactContextText(result.content, 1800),
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
    const { citations, modelCited } = sanitizeCitations(parsed.citations, results);
    const derivedConfidence = modelCited ? deriveConfidence(results, citations.length) : "unsupported";
    const confidence = modelCited ? clampConfidence(parsed.confidence, derivedConfidence) : "unsupported";
    const parsedAnswer = parsed.answer ?? "";
    const nonArtifactParsedAnswer = parsedAnswer.trim() && !looksLikeJsonArtifact(parsedAnswer) ? parsedAnswer : "";
    const sanitizedAnswer =
      sanitizeStructuredText(parsedAnswer, { minLength: 8, minTokens: 2 }) ||
      nonArtifactParsedAnswer ||
      machineReadableFallbackAnswer;
    const answerSections = sanitizeAnswerSections(parsed.answerSections, results, query);
    const grounded = modelCited && citations.length > 0 && confidence !== "unsupported";
    const answer = {
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
    };
    if (!modelCited) {
      answer.routingReason = "ungrounded_no_model_citation";
    }
    // GEN-C2 / GEN-H2: numeric faithfulness gate.
    return applyNumericVerification(answer);
  } catch {
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
function applyNumericVerification(answer: RagAnswer): RagAnswer {
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
  // Surface as a source gap so the UI's existing gap rendering shows it, and
  // never let an answer with unverified clinical numbers claim high confidence.
  const caveat: ConflictOrGap = {
    type: "gap",
    message: `${VERIFY_AGAINST_SOURCE_NOTE} Unverified figures: ${unverifiedTokens.join(", ")}.`,
  };
  answer.conflictsOrGaps = [...(answer.conflictsOrGaps ?? []), caveat];
  if (answer.confidence === "high") answer.confidence = "medium";
  return answer;
}

export async function answerQuestion(query: string, documentId?: string) {
  return answerQuestionWithScope({ query, documentId, allowGlobalSearch: true });
}

export async function answerQuestionWithScope(args: {
  query: string;
  documentId?: string;
  documentIds?: string[];
  ownerId?: string;
  allowGlobalSearch?: boolean;
  logQuery?: boolean;
  skipCache?: boolean;
  queryMode?: ClinicalQueryMode;
  onProgress?: (event: AnswerProgressEvent) => void | Promise<void>;
}): Promise<RagAnswer> {
  const startedAt = Date.now();
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
  const route =
    gatedRoute.route.mode === "extractive"
      ? {
          ...gatedRoute.route,
          mode: "fast" as const,
          model: env.OPENAI_FAST_ANSWER_MODEL,
          reason: `${gatedRoute.route.reason}; upgraded_to_model_synthesis`,
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
      retrievalStrategy: search.telemetry.retrieval_strategy,
    });
  const smartApiPlan = buildCurrentSmartApiPlan();
  const smartApiLogMetadata = (plan: SmartRagApiPlan) => ({
    smart_api_intent: plan.intent,
    smart_api_response_mode: plan.responseMode,
    smart_api_display_mode: plan.displayMode,
    smart_api_latency_plan: plan.latencyPlan,
    smart_api_source_link_count: plan.sourceLinkCount,
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
        answer: unsupportedWithNearbySources
          ? "I found nearby indexed passages, but they are not strong enough to support a reliable answer. Try refining the query or selecting a more relevant document."
          : "I could not find enough support in the indexed documents to answer this query. Upload or index a relevant guideline, then search again.",
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
          text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
          embedding_skipped: search.telemetry.embedding_skipped,
          embedding_latency_ms: search.telemetry.embedding_latency_ms,
          embedding_cache_hit: search.telemetry.embedding_cache_hit,
          supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
          rerank_latency_ms: search.telemetry.rerank_latency_ms,
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

    if (args.logQuery !== false)
      await logRagQuery({
        owner_id: args.ownerId ?? null,
        query: args.query,
        answer: answer.answer,
        source_chunk_ids: answerInputResults.map((result) => result.id),
        model: null,
        metadata: {
          document_id: args.documentId ?? null,
          document_ids: args.documentIds ?? null,
          grounded: answer.grounded,
          confidence: answer.confidence,
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
          cited_chunk_count: 0,
          quote_count: answer.quoteCards?.length ?? 0,
          visual_evidence_count: answer.visualEvidence?.length ?? 0,
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
          total_latency_ms: answer.latencyTimings?.total_latency_ms ?? searchLatencyMs,
          evidence_summary: answer.evidenceSummary,
          source_coverage: answer.sourceCoverage,
          ...retrievalLogMetadata(answer.retrievalDiagnostics ?? retrievalDiagnostics),
          related_document_count: relatedDocuments.length,
        },
      });

    setCachedAnswer(args, answer);
    return answer;
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
          text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
          embedding_skipped: search.telemetry.embedding_skipped,
          embedding_latency_ms: search.telemetry.embedding_latency_ms,
          embedding_cache_hit: search.telemetry.embedding_cache_hit,
          supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
          rerank_latency_ms: search.telemetry.rerank_latency_ms,
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

    if (args.logQuery !== false)
      await logRagQuery({
        owner_id: args.ownerId ?? null,
        query: args.query,
        answer: answer.answer,
        source_chunk_ids: answerInputResults.map((result) => result.id),
        model: null,
        metadata: {
          document_id: args.documentId ?? null,
          document_ids: args.documentIds ?? null,
          grounded: answer.grounded,
          confidence: answer.confidence,
          routing_mode: answer.routingMode,
          routing_reason: answer.routingReason,
          query_class: queryClass,
          fallback_reason: fallbackReasonFromRouting(answer.routingReason),
          model_used: null,
          retrieved_candidate_count: results.length,
          ...smartApiLogMetadata(smartApiPlan),
          ...answerRankMetadata,
          ...memoryLogMetadata,
          ...scoreLogMetadata,
          cited_chunk_count: answer.citations.length,
          quote_count: answer.quoteCards?.length ?? 0,
          visual_evidence_count: answer.visualEvidence?.length ?? 0,
          related_document_count: relatedDocuments.length,
          ...retrievalLogMetadata(answer.retrievalDiagnostics ?? retrievalDiagnostics),
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
          total_latency_ms: answer.latencyTimings?.total_latency_ms ?? Date.now() - startedAt,
          evidence_summary: answer.evidenceSummary,
          source_coverage: answer.sourceCoverage,
        },
      });

    setCachedAnswer(args, answer);
    return answer;
  }

  const answerInstructions = `You are answering for a psychiatrist in Perth, Australia using only uploaded clinical document excerpts.

Rules:
- Answer directly from the provided excerpts only.
- Use a layered response. The answer field is the first layer: write a short, high-yield clinical paragraph that can stand alone before any structured sections.
- The answer field must be plain prose, usually 1-3 short sentences and 35-75 words. Do not use bullets, numbered lists, labels, icons, headings, or prefixes such as "Answer", "Summary", "Bottom line", "Required actions", or "Direct answer" inside the answer field.
- Start the answer field with the direct clinical answer in the first sentence. Keep only the vital and most relevant information there.
- First, silently interpret what the clinician is really asking: clinical task, population/scope, likely decision point, urgency/risk, and whether they need a pathway, threshold, comparison, or document lookup. Use that interpretation to shape the answer.
- Write like a clinician who has read the source material and is explaining the logical clinical approach. Avoid template language, source-inventory wording, and generic phrases such as "the strongest retrieved sources support", "source-backed", "the source states", or "based on the provided excerpts".
- For broad management, treatment, care, pathway, or approach questions, organize the synthesis naturally: immediate risk/specialist referral if supported, core first-line intervention, adjunctive medication or monitoring when supported, special populations, and important gaps. Do not dump every treatment option with equal weight.
- For simple definition or direct fact questions, answer only the direct question. Do not broaden into management, treatment, monitoring, or pathway content unless the user explicitly asks for it. Return no answerSections unless one source-gap or safety caveat is essential.
- Use model-generated clinical synthesis by default; do not stitch disconnected source quotes into the answer.
- Treat retrieval as source selection, not the final answer. The final answer must be a coherent clinical synthesis of the supplied excerpts, never a concatenation of chunk fragments.
- If the retrieved excerpts contain only headings, partial table fragments, or disconnected text that cannot support a logical response, state the source gap instead of filling from general knowledge.
- Integrate all relevant retrieved sources intelligently: merge overlapping guidance, prioritize stronger/direct support, and call out weak, nearby, or missing support.
- Put supporting detail, secondary caveats, thresholds, monitoring timing, actions, risks, comparisons, documentation, and source gaps into answerSections rather than the answer field.
- Use answerSections as the second layer when they add scanability, decision support, or verification value. Good sections include Required actions, Monitoring/timing, Medication/dose details, Thresholds, Escalation/risk, Contraindications/cautions, Comparison, Documentation/forms, and Source gaps.
- For simple questions, return zero or one answerSections item unless a safety or source-gap section is needed. For complex clinical, medication, threshold, comparison, or multi-document questions, return two to five distinct sections when supported.
- Keep answerSections non-redundant with the answer field. Do not add a "Direct answer", "Bottom line", or "High-yield summary" section that merely repeats the top answer. Each section should contain one concise practical point or one compact synthesis of closely related points.
- For each answerSections item, choose the most specific kind and supportLevel. A section is direct only when the cited chunks directly answer that section.
- Use thresholds for numeric cutoffs, ranges, score boundaries, withhold/stop criteria, or table-like criteria. Use comparison for source differences, conflicting guidance, or when the query asks "compare", "versus", or "difference".
- Omit sections that are not supported by the retrieved excerpts.
- Do not include low-yield provenance in answer or answerSections: no document IDs, procedure codes, page labels, file names, chunk numbers, similarity scores, source metadata, headers, footers, review tables, or document-control text.
- Keep provenance only in citations and quoteCards via chunk IDs. If source titles or page numbers are useful, leave them to the UI citations rather than writing them in prose.
- Be concise: usually 1-3 short sentences in the answer field and about 35-75 words. Use answerSections for extra detail instead of lengthening the answer field.
- Prefer Australian or WA-specific guidance when present in the sources.
- Do not provide patient-specific medical advice.
- If the excerpts do not support a direct answer, say that the uploaded documents do not contain enough information.
- Use practical clinical wording, but keep every claim tied to retrieved source content.
- Put the grounded synthesis first in the answer field. Then include supported detail sections only when they add clinically useful detail and do not merely repeat the answer.
- Compare sources when several documents are relevant. Mention gaps or weak support when the evidence is narrow.
- Include clinically practical details and caveats only when supported.
- Use only the strongest 3-5 citations, not every source.
- Do not copy source headings as clinical content unless the heading itself answers the question.
- Sources are ordered by answer relevance. Prioritize earlier sources unless a later source directly resolves a conflict or gap.
- When sources come from multiple documents, synthesize by clinical theme/action. Do not list each document separately unless the question asks for a comparison.
- For multi-document answers, merge overlapping guidance once, then call out document-specific differences, conflicts, or gaps only when supported.
- Keep multi-document answers fast and focused: use the fused source brief and balanced source guide to cite at least two documents when the answer combines them.
- Treat the fused source brief as an orientation layer only. Verify every claim against the raw source excerpts below it.
- Structured memory lines are indexing-time source facts mapped back to source chunks. Use them to focus the answer, but cite the original chunks.
- Start with the direct answer. Omit tangential background, administrative details, source titles, file names, page labels, and provenance from the answer field even when they appear in retrieved sources.
- Bold only source-supported high-yield details using **bold**: medications, thresholds, timing, escalation triggers, required actions, contraindications, and terms central to the question.
- Do not bold whole sentences or routine filler wording.
- Do not use Markdown other than **bold** inside answer or answerSections.
    - Include 1-3 short exact quotes in quoteCards; quotes must be copied from the retrieved source excerpts.
    - Do not insert JSON-like fragments, key-value dumps, or objects in heading or body fields. Do not output strings containing keys such as answer, heading, citation_chunk_ids, or raw braces.
- If a heading/body would include key-value pairs or JSON-like syntax, omit that section or return only concise natural language text.
- Return data matching the supplied structured output schema.`;

  function buildAnswerInput(contextResults: SearchResult[]) {
    const sourceGuide = crossDocumentPlan.enabled ? buildCrossDocumentSourceGuide(contextResults) : "";
    const fusedBrief = crossDocumentFusionBrief?.text ?? "";
    const crossDocumentContext = [sourceGuide, fusedBrief].filter(Boolean).join("\n\n");
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

  async function generateWithModel(
    model: string,
    contextResults: SearchResult[],
    qualityRetryInstruction?: string,
  ): Promise<OpenAITextResult> {
    const input = qualityRetryInstruction
      ? `${buildAnswerInput(contextResults)}

Quality retry instruction:
${qualityRetryInstruction}`
      : buildAnswerInput(contextResults);
    const generationStartedAt = Date.now();
    try {
      const result = await generateStructuredTextResult(input, answerJsonOutputSchema, {
        model,
        maxOutputTokens: env.OPENAI_MAX_OUTPUT_TOKENS,
        operation: "answer",
        schemaName: "clinical_rag_answer",
        instructions: answerInstructions,
        promptCacheKey: "clinical-rag-answer-v11",
        reasoningEffort:
          model === env.OPENAI_STRONG_ANSWER_MODEL
            ? env.OPENAI_STRONG_REASONING_EFFORT
            : env.OPENAI_FAST_REASONING_EFFORT,
      });
      openAIUsage = addOpenAIUsage(openAIUsage, result.usage);
      if (result.requestId) openAIRequestIds.push(result.requestId);
      return result;
    } finally {
      generationLatencyMs += Date.now() - generationStartedAt;
    }
  }

  function summarizeGenerationFailureReason(error: unknown) {
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    if (typeof error === "string" && error.trim()) return error.trim();
    return "generation encountered an error";
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
      confidence: hasSources ? deriveConfidence(answerInputResults, fallbackCitations.length) : "unsupported",
      citations: hasSources ? fallbackCitations : [],
      sources: answerInputResults,
      modelUsed: null,
      routingMode: "unsupported",
      routingReason: `${route.reason}; generation_fallback:${sanitizedReason}`,
      queryClass,
      queryAnalysis,
      responseMode: buildCurrentSmartApiPlan("unsupported", `${route.reason}; generation_fallback`).displayMode,
      latencyTimings: {
        search_cache_hit: search.telemetry.search_cache_hit,
        text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
        embedding_skipped: search.telemetry.embedding_skipped,
        embedding_latency_ms: search.telemetry.embedding_latency_ms,
        embedding_cache_hit: search.telemetry.embedding_cache_hit,
        supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
        rerank_latency_ms: search.telemetry.rerank_latency_ms,
        context_pack_latency_ms: contextPackLatencyMs,
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

  const fastContextResults =
    route.mode === "fast" && !crossDocumentPlan.enabled ? answerInputResults.slice(0, 4) : answerInputResults;
  try {
    await args.onProgress?.({
      stage: "generating",
      message: `Generating cited answer with ${route.mode} route.`,
      mode: route.mode,
      model: route.model,
      reason: route.reason,
    });
    const contextPackStartedAt = Date.now();
    let packedContextResults = await packAdjacentSourceContext(createAdminClient(), fastContextResults, queryClass, {
      crossDocument: crossDocumentPlan.enabled,
    });
    contextPackLatencyMs += Date.now() - contextPackStartedAt;
    let generated = await generateWithModel(route.model!, packedContextResults);
    let answer = annotateAnswerWithDiagnostics(
      parseAnswerJson(generated.text, packedContextResults, args.query),
      retrievalDiagnostics,
    );
    const fastAnswerWasUnsupported = shouldRetryWithStrongAfterFast({ route, answer, results: answerInputResults });
    const fastAnswerWasUnusable = route.mode === "fast" && isUnusableGeneratedAnswer(answer);
    const fastAnswerWasTemplateLike = route.mode === "fast" && isTemplateLikeGeneratedAnswer(answer);
    const fastAnswerWasOverExpanded =
      route.mode === "fast" && isOverExpandedSimpleGeneratedAnswer(args.query, queryClass, answer);
    if (fastAnswerWasUnsupported || fastAnswerWasUnusable || fastAnswerWasTemplateLike || fastAnswerWasOverExpanded) {
      const retryReason = fastAnswerWasUnsupported
        ? "fast_unsupported_retry_strong"
        : fastAnswerWasUnusable
          ? "fast_unusable_retry_strong"
          : fastAnswerWasTemplateLike
            ? "fast_template_retry_strong"
            : "fast_overexpanded_simple_retry_strong";
      modelUsed = env.OPENAI_STRONG_ANSWER_MODEL;
      routingReason = `${route.reason}; ${retryReason}`;
      retriedWithStrong = true;
      await args.onProgress?.({
        stage: "retrying",
        message:
          retryReason === "fast_unsupported_retry_strong"
            ? "Fast answer was unsupported, retrying with the strong model."
            : retryReason === "fast_unusable_retry_strong"
              ? "Fast answer was not usable, retrying with the strong model."
              : retryReason === "fast_template_retry_strong"
                ? "Fast answer was too template-like, retrying with the strong model."
                : "Fast answer over-expanded a simple question, retrying with the strong model.",
        mode: "strong",
        model: env.OPENAI_STRONG_ANSWER_MODEL,
        reason: routingReason,
      });
      const retryContextPackStartedAt = Date.now();
      packedContextResults = await packAdjacentSourceContext(createAdminClient(), answerInputResults, queryClass, {
        crossDocument: crossDocumentPlan.enabled,
      });
      contextPackLatencyMs += Date.now() - retryContextPackStartedAt;
      generated = await generateWithModel(env.OPENAI_STRONG_ANSWER_MODEL, packedContextResults);
      retrievalDiagnostics.routeMode = "strong";
      answer = annotateAnswerWithDiagnostics(
        parseAnswerJson(generated.text, packedContextResults, args.query),
        retrievalDiagnostics,
      );
    }
    const answerNeedsStrongQualityRepair =
      modelUsed === env.OPENAI_STRONG_ANSWER_MODEL &&
      (isUnusableGeneratedAnswer(answer) ||
        isTemplateLikeGeneratedAnswer(answer) ||
        isOverExpandedSimpleGeneratedAnswer(args.query, queryClass, answer));
    if (answerNeedsStrongQualityRepair) {
      routingReason = `${routingReason}; strong_quality_retry`;
      await args.onProgress?.({
        stage: "retrying",
        message: "Strong answer failed quality checks, retrying once with stricter synthesis instructions.",
        mode: "strong",
        model: env.OPENAI_STRONG_ANSWER_MODEL,
        reason: routingReason,
      });
      generated = await generateWithModel(
        env.OPENAI_STRONG_ANSWER_MODEL,
        packedContextResults,
        "The previous answer failed validation. Return schema-valid output only, with a natural clinical synthesis in the answer field. Avoid template/source-inventory wording and do not include JSON fragments inside text fields. If the question is a simple definition or direct fact question, answer only that question and return answerSections as an empty array unless a source-gap or safety caveat is essential.",
      );
      retrievalDiagnostics.routeMode = "strong";
      answer = annotateAnswerWithDiagnostics(
        parseAnswerJson(generated.text, packedContextResults, args.query),
        retrievalDiagnostics,
      );
    }
    await args.onProgress?.({ stage: "finalizing", message: "Checking citations and source metadata." });

    const relatedDocuments = await relatedDocumentsPromise;
    const answerTimings = {
      search_cache_hit: search.telemetry.search_cache_hit,
      text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
      embedding_skipped: search.telemetry.embedding_skipped,
      embedding_latency_ms: search.telemetry.embedding_latency_ms,
      embedding_cache_hit: search.telemetry.embedding_cache_hit,
      supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
      rerank_latency_ms: search.telemetry.rerank_latency_ms,
      context_pack_latency_ms: contextPackLatencyMs,
      search_latency_ms: searchLatencyMs,
      generation_latency_ms: generationLatencyMs,
      total_latency_ms: Date.now() - startedAt,
    };

    // B5: a structured_parse_fallback answer now fails closed with zero
    // citations, so we can no longer gate extractive recovery on the parsed
    // answer's citations. buildExtractiveAnswer derives its own source-backed
    // citations from the retrieved results, so trigger recovery whenever the
    // generated answer is unusable and we have retrieved results to extract from.
    const canRecoverExtractively = answer.citations.length > 0 || answerInputResults.length > 0;
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
      answer.routingReason = `${routingReason}; structured_output_fallback`;
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
          fast_model: env.OPENAI_FAST_ANSWER_MODEL,
          strong_model: env.OPENAI_STRONG_ANSWER_MODEL,
          retrieved_candidate_count: results.length,
          ...(answer.smartApiPlan ? smartApiLogMetadata(answer.smartApiPlan) : {}),
          ...answerRankMetadata,
          ...memoryLogMetadata,
          ...scoreLogMetadata,
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
    const fallbackAnswer = annotateAnswerWithDiagnostics(
      await buildGenerationFallbackAnswer(error, relatedDocuments),
      retrievalDiagnostics,
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
          fast_model: env.OPENAI_FAST_ANSWER_MODEL,
          strong_model: env.OPENAI_STRONG_ANSWER_MODEL,
          retrieved_candidate_count: results.length,
          ...(fallbackAnswer.smartApiPlan ? smartApiLogMetadata(fallbackAnswer.smartApiPlan) : {}),
          ...answerRankMetadata,
          ...memoryLogMetadata,
          ...scoreLogMetadata,
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
    .select("id,document_id,page_number,chunk_index,section_heading,content,retrieval_synopsis,image_ids")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true })
    .limit(40);

  if (error) throw new Error(error.message);
  if (!chunks?.length) {
    return {
      answer: "This document has not been indexed yet, so no summary can be generated.",
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
    } satisfies RagAnswer;
  }

  const results = chunks.map((chunk) => ({
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

  const generated = await generateStructuredTextResult(summaryInput, answerJsonOutputSchema, {
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
