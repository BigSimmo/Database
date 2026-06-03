import { createAdminClient } from "@/lib/supabase/admin";
import { embedTextWithTelemetry, generateStructuredTextResult, type OpenAITextResult } from "@/lib/openai";
import { compactCitations } from "@/lib/citations";
import {
  buildClinicalTextSearchQuery,
  classifyRagQuery,
  expandClinicalQuery,
  hasDoseEvidenceSupport,
  rankClinicalResults,
} from "@/lib/clinical-search";
import { env } from "@/lib/env";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import { isClinicalImageEvidence } from "@/lib/image-filtering";
import { chooseAnswerRoute, hasDirectTitleSupport, shouldRetryWithStrongAfterFast } from "@/lib/rag-routing";
import { fetchRelatedDocumentMetadata, fetchRelatedDocuments } from "@/lib/document-enrichment";
import { boldHighYieldClinicalText, boldRagAnswerHighYieldText, rankAnswerEvidence } from "@/lib/answer-ranking";
import { applyMemoryCardBoosts, fetchMemoryCardsForQuery, ragDeepMemoryVersion } from "@/lib/deep-memory";
import { cleanClinicalSummaryText, sourceTextForDisplay, sourceTextForModel } from "@/lib/source-text-sanitizer";
import {
  buildCrossDocumentFusionBrief,
  buildCrossDocumentSourceGuide,
  buildCrossDocumentSynthesisPlan,
} from "@/lib/cross-document-synthesis";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
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
  ChunkImage,
  ClinicalImageUseClass,
  Citation,
  ConflictOrGap,
  DocumentIndexQuality,
  DocumentMemoryCard,
  EvidenceRelevance,
  RelatedDocument,
  OpenAITokenUsage,
  QuoteCard,
  RagQueryClass,
  RagAnswer,
  SearchResult,
  SmartRagApiPlan,
} from "@/lib/types";

const answerJsonOutputSchema = {
  type: "object",
  description: "A source-grounded clinical answer generated only from retrieved document excerpts.",
  additionalProperties: false,
  properties: {
    answer: {
      type: "string",
      description: "The concise answer or a clear statement that the provided excerpts are insufficient.",
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
      description: "Optional clinically useful sections. Omit unsupported detail by returning an empty array.",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string", description: "Short section heading.", maxLength: 48 },
          body: { type: "string", description: "Section body grounded in the cited excerpts.", maxLength: 420 },
          citation_chunk_ids: {
            type: "array",
            description: "Retrieved chunk IDs that directly support this section.",
            items: { type: "string" },
          },
        },
        required: ["heading", "body", "citation_chunk_ids"],
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
  const normalized = normalizeSectionText(sourceTextForDisplay(value));
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
  return finalText;
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
  skipCache?: boolean;
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
  query_class?: RagQueryClass;
  text_fast_path_latency_ms: number;
  embedding_skipped: boolean;
  embedding_latency_ms: number;
  embedding_cache_hit: boolean;
  supabase_rpc_latency_ms: number;
  rerank_latency_ms: number;
  memory_card_count?: number;
  memory_top_score?: number;
  weighted_top_score?: number;
  rrf_top_score?: number;
  retrieval_strategy?: "search_cache" | "text_fast_path" | "document_lookup_fast_path" | "hybrid" | "vector_fallback";
};

function recordSearchScoreTelemetry(telemetry: SearchTelemetry, results: SearchResult[]) {
  telemetry.weighted_top_score = Number(
    Math.max(0, ...results.map((result) => result.hybrid_score ?? result.similarity ?? 0)).toFixed(4),
  );
  telemetry.rrf_top_score = Number(Math.max(0, ...results.map((result) => result.rrf_score ?? 0)).toFixed(4));
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

function clampConfidence(
  proposed: RagAnswer["confidence"] | undefined,
  derived: RagAnswer["confidence"],
): RagAnswer["confidence"] {
  if (!proposed) return derived;
  return confidenceOrder[proposed] < confidenceOrder[derived] ? proposed : derived;
}

function sanitizeCitations(proposed: Array<{ chunk_id: string }> | undefined, results: SearchResult[]) {
  const chunks = allowedChunkMap(results);
  const citations: Citation[] = [];
  const seen = new Set<string>();

  for (const citation of proposed ?? []) {
    const source = chunks.get(citation.chunk_id);
    if (!source || seen.has(source.id)) continue;
    seen.add(source.id);
    citations.push(resultCitation(source));
  }

  if (proposed && proposed.length > 0) return citations;
  return compactCitations(results);
}

function sanitizeAnswerSections(
  sections: AnswerSection[] | undefined,
  results: SearchResult[],
  query?: string,
): AnswerSection[] {
  const allowed = new Set(results.map((result) => result.id));
  const seen = new Set<string>();

  return (sections ?? [])
    .map((section) => ({
      heading: sanitizeStructuredText(section.heading, { minLength: 1, minTokens: 1 }),
      body: boldHighYieldClinicalText(sanitizeStructuredText(section.body, { minLength: 8, minTokens: 2 }), query),
      citation_chunk_ids: [...new Set(section.citation_chunk_ids.filter((id) => allowed.has(id)))],
    }))
    .filter((section) => {
      if (!section.heading || !section.body || section.citation_chunk_ids.length === 0) return false;
      if (!isUsableAnswerSectionText(section.heading, { minTokens: 1, minLength: 1 })) return false;
      if (!isUsableAnswerSectionText(section.body, { minTokens: 2, minLength: 8 })) return false;
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
  const citations = compactCitations(results);
  const confidence = deriveConfidence(results, citations.length);
  return {
    answer: boldHighYieldClinicalText(sanitizeAnswerText(raw) || machineReadableFallbackAnswer, query),
    grounded: citations.length > 0 && confidence !== "unsupported",
    confidence,
    citations,
    sources: results,
    routingReason: "structured_parse_fallback",
    answerSections: [],
    conflictsOrGaps: detectConflictsOrGaps(results),
    visualEvidence: buildVisualEvidence(results),
    bestSource: selectBestSourceRecommendation(results),
  };
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
      .find((part) => /fallback|unsupported|no_|limited_retrieval|gap|conflict|failed/i.test(part)) ?? null
  );
}

const answerCache = new Map<string, { expiresAt: number; answer: RagAnswer }>();
const searchCache = new Map<string, { expiresAt: number; results: SearchResult[]; telemetry: SearchTelemetry }>();

function scopedAnswerCacheKey(args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId">) {
  const scope = args.documentIds?.length
    ? [...args.documentIds].sort().join(",")
    : args.documentId
      ? args.documentId
      : "all-documents";
  return [args.ownerId ?? "anonymous", scope, args.query.trim().toLowerCase().replace(/\s+/g, " ")].join("|");
}

function cloneAnswer(answer: RagAnswer) {
  return JSON.parse(JSON.stringify(answer)) as RagAnswer;
}

function getCachedAnswer(
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "skipCache">,
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
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "skipCache">,
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
}

function scopedSearchCacheKey(args: SearchChunksArgs) {
  const scope = args.documentIds?.length
    ? [...args.documentIds].sort().join(",")
    : args.documentId
      ? args.documentId
      : "all-documents";
  const normalizedQuery = buildClinicalTextSearchQuery(args.query).toLowerCase().replace(/\s+/g, " ");
  return [args.ownerId ?? "anonymous", scope, normalizedQuery, args.topK ?? 8, args.minSimilarity ?? 0.15].join("|");
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
}

export function invalidateRagCachesForOwner(ownerId?: string | null) {
  if (!ownerId) {
    answerCache.clear();
    searchCache.clear();
    return;
  }

  const prefix = `${ownerId}|`;
  for (const key of answerCache.keys()) {
    if (key.startsWith(prefix)) answerCache.delete(key);
  }
  for (const key of searchCache.keys()) {
    if (key.startsWith(prefix)) searchCache.delete(key);
  }
}

export function invalidateRagCachesForDocumentMutation(ownerId: string) {
  invalidateRagCachesForOwner(ownerId);
  invalidateRagCachesForOwner("anonymous");
}

async function insertRagQuery(row: Record<string, unknown>) {
  const supabase = createAdminClient();
  await supabase.from("rag_queries").insert(row);
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
  content: string;
  image_ids: string[] | null;
};

async function searchDocumentLookupFastPath(args: {
  supabase: ReturnType<typeof createAdminClient>;
  query: string;
  ownerId?: string;
  documentIds?: string[];
  matchCount: number;
}) {
  const { data: documents, error: documentsError } = await args.supabase.rpc("match_documents_for_query", {
    query_text: buildClinicalTextSearchQuery(args.query),
    match_count: 12,
    owner_filter: args.ownerId ?? null,
  });
  if (documentsError || !documents?.length) return [];

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
  const { data: chunks, error: chunksError } = await args.supabase
    .from("document_chunks")
    .select("id,document_id,page_number,chunk_index,section_heading,content,image_ids")
    .in(
      "document_id",
      rankedDocuments.map((item) => item.document.id),
    )
    .order("chunk_index", { ascending: true })
    .limit(Math.max(args.matchCount, rankedDocuments.length * 4));

  if (chunksError || !chunks?.length) return [];

  const results: SearchResult[] = [];
  for (const chunk of chunks as DocumentLookupChunkRow[]) {
    const document = documentById.get(chunk.document_id);
    if (!document) continue;
    const documentScore = scoreByDocument.get(chunk.document_id) ?? 0;
    const similarity = Math.min(0.92, 0.6 + documentScore);
    results.push({
      id: chunk.id,
      document_id: chunk.document_id,
      title: document.title,
      file_name: document.file_name,
      page_number: chunk.page_number,
      chunk_index: chunk.chunk_index,
      section_heading: chunk.section_heading,
      content: chunk.content,
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
  const extractionQuality = sourceMetadata.some((metadata) => metadata.extraction_quality === "poor")
    ? "poor"
    : sourceMetadata.some((metadata) => metadata.extraction_quality === "partial")
      ? "partial"
      : sourceMetadata.length > 0
        ? "good"
        : "unknown";
  return {
    indexingVersion: ragDeepMemoryVersion,
    memoryVersion: ragDeepMemoryVersion,
    extractionQuality,
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
    .select("id,document_id,page_number,chunk_index,section_heading,content,image_ids")
    .in("id", chunkIds)
    .limit(chunkIds.length);
  if (chunksError || !chunks?.length) return [] as SearchResult[];

  const documentIds = Array.from(new Set(chunks.map((chunk) => chunk.document_id)));
  let documentQuery = supabase.from("documents").select("id,title,file_name,metadata,owner_id").in("id", documentIds);
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
        content: chunk.content,
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

  try {
    const metadataRows = await fetchRelatedDocumentMetadata({
      supabase,
      ownerId,
      documentIds,
    });
    const metadataByDocument = new Map(metadataRows.map((row) => [row.document_id, row]));
    return results.map((result) => {
      const metadata = metadataByDocument.get(result.document_id);
      if (!metadata) return result;
      return {
        ...result,
        document_labels: metadata.labels,
        document_summary: metadata.summary,
      };
    });
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
      .select("id,document_id,page_number,chunk_index,section_heading,content")
      .in("document_id", documentIds)
      .in("chunk_index", chunkIndexes)
      .order("chunk_index", { ascending: true })
      .limit(80);

    if (error || !data?.length) return results;

    const chunksByDocumentAndIndex = new Map<string, { id: string; section_heading: string | null; content: string }>();
    for (const chunk of data) {
      chunksByDocumentAndIndex.set(`${chunk.document_id}:${chunk.chunk_index}`, {
        id: chunk.id,
        section_heading: chunk.section_heading,
        content: chunk.content,
      });
    }

    const targetIds = new Set(targetResults.map((result) => result.id));
    return results.map((result) => {
      if (!targetIds.has(result.id)) return result;
      const adjacent = [result.chunk_index - 1, result.chunk_index + 1]
        .map((index) => chunksByDocumentAndIndex.get(`${result.document_id}:${index}`))
        .filter((chunk): chunk is { id: string; section_heading: string | null; content: string } =>
          Boolean(chunk && chunk.id !== result.id && chunk.content.trim()),
        )
        .map((chunk) => {
          const heading = chunk.section_heading ? `${chunk.section_heading}: ` : "";
          return compactContextText(`${heading}${chunk.content}`, 520);
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
  return sourceTextForDisplay(line)
    .replace(/^[-•]\s*/, "")
    .replace(/^Agitation and Arousal:?\s+Pharmacological Management Guideline\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const extractiveLabelPattern =
  /\b(?:Medication point|Table evidence|Threshold\/action|Risk\/escalation|Workflow step|Section summary|Source point|Dose detail|Monitoring)\s*:\s*/gi;

function cleanExtractivePointText(value: string) {
  return sourceTextForDisplay(value)
    .replace(extractiveLabelPattern, " ")
    .replace(/^[\s\-•:]+/, "")
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

function sourcePointClauses(value: string, query: string) {
  const tokens = splitBalancedWords(query).filter((token) => token.length > 3);
  const clauses = cleanExtractivePointText(value)
    .split(/(?<=[.!?])\s+|\s+[•]\s+|\s+\|\s+/)
    .map((clause) => cleanExtractivePointText(clause))
    .filter((clause) => clause.length >= 18 && !looksLikeJsonArtifact(clause));

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
    const lines = sourceTextForDisplay(result.content)
      .split(/\r?\n+/)
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

export async function searchChunksWithTelemetry(args: SearchChunksArgs) {
  const cached = getCachedSearch(args);
  if (cached) return cached;

  const supabase = createAdminClient();
  const queryClassification = classifyRagQuery(args.query);
  const documentFilterList = args.documentIds?.length
    ? args.documentIds
    : args.documentId
      ? [args.documentId]
      : undefined;
  const telemetry: SearchTelemetry = {
    search_cache_hit: false,
    query_class: queryClassification.queryClass,
    text_fast_path_latency_ms: 0,
    embedding_skipped: false,
    embedding_latency_ms: 0,
    embedding_cache_hit: false,
    supabase_rpc_latency_ms: 0,
    rerank_latency_ms: 0,
    memory_card_count: 0,
    memory_top_score: 0,
    weighted_top_score: 0,
    rrf_top_score: 0,
  };

  const expandedQuery = expandClinicalQuery(args.query);
  const textSearchQuery = buildClinicalTextSearchQuery(args.query);
  const candidateMultiplier = queryClassification.queryClass === "comparison" ? 7 : 5;
  const candidateFloor = queryClassification.queryClass === "comparison" ? 72 : 48;
  const candidateCount = Math.max((args.topK ?? 8) * candidateMultiplier, candidateFloor);
  const maxResultsPerDocument = queryClassification.queryClass === "comparison" ? 2 : 4;
  const minSimilarity = args.minSimilarity ?? 0.15;

  let textFastResults: SearchResult[] = [];
  const textRpcStartedAt = Date.now();
  const { data: textData, error: textError } = await supabase.rpc("match_document_chunks_text", {
    query_text: textSearchQuery,
    match_count: candidateCount,
    document_filters: documentFilterList ?? null,
    owner_filter: args.ownerId ?? null,
  });
  telemetry.text_fast_path_latency_ms = Date.now() - textRpcStartedAt;
  telemetry.supabase_rpc_latency_ms += telemetry.text_fast_path_latency_ms;

  if (!textError && textData?.length) {
    const rerankStartedAt = Date.now();
    const textCandidates = await attachDocumentRankingMetadata(supabase, textData as SearchResult[], args.ownerId);
    const baseTextResults = diversifySearchResults(
      rankClinicalResults(args.query, textCandidates),
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
      query: args.query,
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
      rankClinicalResults(args.query, memoryBoost.results),
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

  if (shouldAttemptDocumentLookupFastPath(queryClassification.queryClass)) {
    const documentLookupStartedAt = Date.now();
    const documentLookupData = await searchDocumentLookupFastPath({
      supabase,
      query: args.query,
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
          rankClinicalResults(args.query, memoryBoost.results),
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

  const embeddingStartedAt = Date.now();
  const { embedding, cacheHit } = await embedTextWithTelemetry(expandedQuery);
  telemetry.embedding_latency_ms = Date.now() - embeddingStartedAt;
  telemetry.embedding_cache_hit = cacheHit;

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
      query: args.query,
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
        rankClinicalResults(args.query, memoryBoost.results),
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
  );
  telemetry.supabase_rpc_latency_ms += Date.now() - fallbackRpcStartedAt;

  const rerankStartedAt = Date.now();
  const mergedWithMetadata = await attachDocumentRankingMetadata(
    supabase,
    mergeSearchResults(resultSets.flat(), textFastResults),
    args.ownerId,
  );
  const memoryBoost = await withMemoryBoostedCandidates({
    supabase,
    query: args.query,
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
      rankClinicalResults(args.query, memoryBoost.results),
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

export function buildRagSourceBlock(results: SearchResult[]) {
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
      const memoryCards = result.memory_cards?.length
        ? `\nStructured memory: ${result.memory_cards
            .slice(0, 3)
            .map((card) => `${card.card_type}: ${compactContextText(card.content, 300)}`)
            .join(" | ")}`
        : "";
      return [
        [
          `[${index + 1}] ${result.title} (${result.file_name}, ${page}, chunk ${result.chunk_index}, similarity ${result.similarity.toFixed(3)})`,
          `citation_chunk_id: ${result.id}`,
          `document_id: ${result.document_id}`,
        ].join("\n"),
        compactContextText(result.content, 1800),
        adjacentContext,
        memoryCards,
        images,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export function parseAnswerJson(raw: string, results: SearchResult[], query?: string): RagAnswer {
  try {
    const parsed = answerJsonSchema.parse(JSON.parse(raw));
    const citations = sanitizeCitations(parsed.citations, results);
    const derivedConfidence = parsed.citations.length
      ? deriveConfidence(results, citations.length)
      : clampConfidence("low", deriveConfidence(results, citations.length));
    const confidence = clampConfidence(parsed.confidence, derivedConfidence);
    const parsedAnswer = parsed.answer ?? "";
    const nonArtifactParsedAnswer = parsedAnswer.trim() && !looksLikeJsonArtifact(parsedAnswer) ? parsedAnswer : "";
    const sanitizedAnswer =
      sanitizeStructuredText(parsedAnswer, { minLength: 8, minTokens: 2 }) ||
      nonArtifactParsedAnswer ||
      machineReadableFallbackAnswer;
    const answerSections = sanitizeAnswerSections(parsed.answerSections, results, query);
    return {
      answer: boldHighYieldClinicalText(sanitizedAnswer, query),
      grounded: citations.length > 0 && confidence !== "unsupported",
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
  } catch {
    return safeFallbackAnswer(raw, results, query);
  }
}

export async function answerQuestion(query: string, documentId?: string) {
  return answerQuestionWithScope({ query, documentId });
}

export async function answerQuestionWithScope(args: {
  query: string;
  documentId?: string;
  documentIds?: string[];
  ownerId?: string;
  logQuery?: boolean;
  skipCache?: boolean;
  onProgress?: (event: AnswerProgressEvent) => void | Promise<void>;
}): Promise<RagAnswer> {
  const startedAt = Date.now();
  const cachedAnswer = getCachedAnswer(args, startedAt);
  if (cachedAnswer) {
    const cachedSources = annotateSearchResults(args.query, cachedAnswer.sources ?? []);
    const cachedRelevance = cachedAnswer.relevance ?? buildEvidenceRelevance(args.query, cachedSources);
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

  const searchStartedAt = Date.now();
  const search = await searchChunksWithTelemetry({
    query: args.query,
    documentId: args.documentId,
    documentIds: args.documentIds,
    ownerId: args.ownerId,
    topK: 12,
    minSimilarity: 0.12,
    skipCache: args.skipCache,
  });
  const queryClass = search.telemetry.query_class ?? classifyRagQuery(args.query).queryClass;
  const answerRanking = rankAnswerEvidence(args.query, normalizeSearchResults(search.results), queryClass);
  const results = annotateSearchResults(args.query, answerRanking.rankedResults);
  const crossDocumentPlan = buildCrossDocumentSynthesisPlan(args.query, results, queryClass);
  const answerInputResults = crossDocumentPlan.enabled ? crossDocumentPlan.results : results;
  const relevance = buildEvidenceRelevance(args.query, answerInputResults);
  const crossDocumentFusionBrief = crossDocumentPlan.enabled
    ? buildCrossDocumentFusionBrief(args.query, answerInputResults)
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
  const quoteCards = extractQuoteCards(answerInputResults, args.query);
  const documentBreakdown = buildDocumentBreakdown(answerInputResults, quoteCards);
  const smartPanel = buildSmartPanel(args.query, answerInputResults);
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
  const emptyPanel = buildSmartPanel(args.query, []);
  const relatedDocumentsPromise = buildRelatedDocumentsSafe({
    query: args.query,
    results,
    ownerId: args.ownerId,
  });
  const route = chooseAnswerRoute({
    query: args.query,
    results: answerInputResults,
    queryClass,
    conflictsOrGaps,
    fastModel: env.OPENAI_FAST_ANSWER_MODEL,
    strongModel: env.OPENAI_STRONG_ANSWER_MODEL,
  });
  const buildCurrentSmartApiPlan = (
    mode: RagAnswer["routingMode"] = route.mode,
    reason = route.reason,
    planResults = answerInputResults,
  ) =>
    buildSmartRagApiPlan({
      query: args.query,
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
    const answer = {
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
    } satisfies RagAnswer;

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
          total_latency_ms: answer.latencyTimings.total_latency_ms,
          evidence_summary: answer.evidenceSummary,
          source_coverage: answer.sourceCoverage,
          related_document_count: relatedDocuments.length,
        },
      });

    setCachedAnswer(args, answer);
    return answer;
  }

  if (route.mode === "extractive") {
    const relatedDocuments = await relatedDocumentsPromise;
    const answer: RagAnswer = buildExtractiveAnswer({
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
    });
    answer.relevance = relevance;
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
- Use model-generated clinical synthesis by default; do not stitch disconnected source quotes into the answer.
- Format the answer as concise clinical sections when supported: Bottom line, Required actions, Monitoring/timing, Medication/dose details, Escalation/risk, Documentation/forms, Source gaps.
- Omit sections that are not supported by the retrieved excerpts.
- Be concise: usually 3-6 high-yield bullets total and about 120-180 words unless source complexity requires more.
- Prefer Australian or WA-specific guidance when present in the sources.
- Do not provide patient-specific medical advice.
- If the excerpts do not support a direct answer, say that the uploaded documents do not contain enough information.
- Use practical clinical wording, but keep every claim tied to retrieved source content.
- Put the grounded synthesis first. Then include supported detail sections only when they add clinically useful detail.
- Compare sources when several documents are relevant. Mention gaps or weak support when the evidence is narrow.
- Include clinically practical details and caveats only when supported.
- Use only the strongest 3-5 citations, not every source.
- Sources are ordered by answer relevance. Prioritize earlier sources unless a later source directly resolves a conflict or gap.
- When sources come from multiple documents, synthesize by clinical theme/action. Do not list each document separately unless the question asks for a comparison.
- For multi-document answers, merge overlapping guidance once, then call out document-specific differences, conflicts, or gaps only when supported.
- Keep multi-document answers fast and focused: use the fused source brief and balanced source guide to cite at least two documents when the answer combines them.
- Treat the fused source brief as an orientation layer only. Verify every claim against the raw source excerpts below it.
- Structured memory lines are indexing-time source facts mapped back to source chunks. Use them to focus the answer, but cite the original chunks.
- Start with the direct answer. Omit tangential background even when it appears in retrieved sources.
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
    return `Question:
${args.query}

Sources:
${crossDocumentContext ? `${crossDocumentContext}\n\n` : ""}
${buildRagSourceBlock(contextResults)}`;
  }

  let generationLatencyMs = 0;
  let modelUsed = route.model;
  let routingReason = route.reason;
  let retriedWithStrong = false;
  let openAIUsage: OpenAITokenUsage = {};
  const openAIRequestIds: string[] = [];
  let contextPackLatencyMs = 0;

  async function generateWithModel(model: string, contextResults: SearchResult[]): Promise<OpenAITextResult> {
    const input = buildAnswerInput(contextResults);
    const generationStartedAt = Date.now();
    try {
      const result = await generateStructuredTextResult(input, answerJsonOutputSchema, {
        model,
        maxOutputTokens: env.OPENAI_MAX_OUTPUT_TOKENS,
        operation: "answer",
        schemaName: "clinical_rag_answer",
        instructions: answerInstructions,
        promptCacheKey: "clinical-rag-answer-v5",
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
    let answer = parseAnswerJson(generated.text, packedContextResults, args.query);
    if (shouldRetryWithStrongAfterFast({ route, answer, results: answerInputResults })) {
      modelUsed = env.OPENAI_STRONG_ANSWER_MODEL;
      routingReason = `${route.reason}; fast_unsupported_retry_strong`;
      retriedWithStrong = true;
      await args.onProgress?.({
        stage: "retrying",
        message: "Fast answer was unsupported, retrying with the strong model.",
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
      answer = parseAnswerJson(generated.text, packedContextResults, args.query);
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

    if (answer.citations.length > 0 && isUnusableGeneratedAnswer(answer)) {
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
    answer.openAIRequestIds = openAIRequestIds;
    answer.openAIUsage = hasOpenAIUsage(openAIUsage) ? openAIUsage : undefined;
    answer.latencyTimings = answerTimings;
    answer.memoryCardsUsed = memoryCardsUsed;
    answer.indexingVersion = ragDeepMemoryVersion;
    answer.indexingQuality = indexingQuality;
    answer.smartApiPlan = buildCurrentSmartApiPlan(answer.routingMode, answer.routingReason);
    answer.scoreExplanations = answerScoreExplanations;
    answer.relevance = relevance;
    answer.smartPanel = answer.smartPanel ? { ...answer.smartPanel, relevance } : answer.smartPanel;

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
          ...smartApiLogMetadata(answer.smartApiPlan),
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
          total_latency_ms: answer.latencyTimings.total_latency_ms,
          openai_request_ids: openAIRequestIds,
          openai_usage: answer.openAIUsage ?? null,
          evidence_summary: answer.evidenceSummary,
          source_coverage: answer.sourceCoverage,
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
    const fallbackAnswer = await buildGenerationFallbackAnswer(error, relatedDocuments);
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
    .select("id,document_id,page_number,chunk_index,section_heading,content,image_ids")
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
Use only the excerpts provided. Start directly with the most useful clinical point; do not prefix the answer with "Summary", "Key practical points", or similar labels. Focus on high-yield actions, thresholds, medication or risk monitoring, exceptions, and citations. Exclude administrative document-control details unless they change clinical action.
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
    promptCacheKey: "clinical-document-summary-v1",
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
