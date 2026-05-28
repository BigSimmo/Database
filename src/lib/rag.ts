import { createAdminClient } from "@/lib/supabase/admin";
import { embedTextWithTelemetry, generateStructuredTextResult, type OpenAITextResult } from "@/lib/openai";
import { compactCitations } from "@/lib/citations";
import { buildClinicalTextSearchQuery, expandClinicalQuery, rankClinicalResults } from "@/lib/clinical-search";
import { env } from "@/lib/env";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import { chooseAnswerRoute, hasDirectTitleSupport, shouldRetryWithStrongAfterFast } from "@/lib/rag-routing";
import { fetchRelatedDocuments } from "@/lib/document-enrichment";
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
import type { AnswerSection, Citation, ConflictOrGap, OpenAITokenUsage, QuoteCard, RagAnswer, SearchResult } from "@/lib/types";

const answerJsonOutputSchema = {
  type: "object",
  description: "A source-grounded clinical answer generated only from retrieved document excerpts.",
  additionalProperties: false,
  properties: {
    answer: {
      type: "string",
      description: "The concise answer or a clear statement that the provided excerpts are insufficient.",
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
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string", description: "Short section heading." },
          body: { type: "string", description: "Section body grounded in the cited excerpts." },
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
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chunk_id: { type: "string", description: "A citation_chunk_id from the supplied source block." },
          quote: { type: "string", description: "A short exact quote from the cited source excerpt." },
          section_heading: { type: ["string", "null"], description: "Source section heading when visible." },
        },
        required: ["chunk_id", "quote", "section_heading"],
      },
    },
    conflictsOrGaps: {
      type: "array",
      description: "Important gaps or conflicts found in the retrieved excerpts.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["gap", "conflict"], description: "Whether this is missing support or conflicting support." },
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
  mode?: RagAnswer["routingMode"];
  model?: string | null;
  reason?: string;
};

export type SearchTelemetry = {
  search_cache_hit: boolean;
  text_fast_path_latency_ms: number;
  embedding_skipped: boolean;
  embedding_latency_ms: number;
  embedding_cache_hit: boolean;
  supabase_rpc_latency_ms: number;
  rerank_latency_ms: number;
  retrieval_strategy?: "search_cache" | "text_fast_path" | "hybrid" | "vector_fallback";
};

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

function sanitizeAnswerSections(sections: AnswerSection[] | undefined, results: SearchResult[]): AnswerSection[] {
  const allowed = new Set(results.map((result) => result.id));
  return (sections ?? [])
    .map((section) => ({
      heading: section.heading,
      body: section.body,
      citation_chunk_ids: section.citation_chunk_ids.filter((id) => allowed.has(id)),
    }))
    .filter((section) => section.citation_chunk_ids.length > 0);
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
      return {
        ...resultCitation(source),
        quote: card.quote,
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
      message: item.message,
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

function safeFallbackAnswer(raw: string, results: SearchResult[]): RagAnswer {
  const citations = compactCitations(results);
  const confidence = deriveConfidence(results, citations.length);
  return {
    answer: raw || "The model returned an invalid response. Verify the retrieved sources before using this answer.",
    grounded: citations.length > 0 && confidence !== "unsupported",
    confidence,
    citations,
    sources: results,
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
  return [
    args.ownerId ?? "anonymous",
    scope,
    normalizedQuery,
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

function shouldReturnTextFastPath(query: string, results: SearchResult[]) {
  if (results.length === 0) return false;

  const strongestScore = results.reduce((max, result) => Math.max(max, result.hybrid_score ?? result.similarity), 0);
  const topTextRank = Math.max(...results.map((result) => result.text_rank ?? 0));
  return strongestScore >= 0.56 || topTextRank >= 0.05 || (hasDirectTitleSupport(query, results) && strongestScore >= 0.4);
}

function boldClinicalSpecifics(input: string) {
  return input.replace(
    /\b(clozapine|lithium|ECT|FBC|ANC|myocarditis|neutropenia|metabolic|constipation|blood pressure|ECG|urgent|escalat\w*|withhold|cease|stop|\d+(?:\.\d+)?\s?(?:mg|mcg|g|mmol\/L|days?|weeks?|months?|hours?|minutes?|%))\b/gi,
    (match) => `**${match}**`,
  );
}

function buildExtractiveAnswer(args: {
  query: string;
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
  const quoteCards = args.quoteCards.length ? args.quoteCards.slice(0, 5) : extractQuoteCards(args.results, args.query, 5);
  const citations = compactCitations(args.results).slice(0, Math.max(quoteCards.length, 1));
  const citationIds = new Set(citations.map((citation) => citation.chunk_id));
  for (const quote of quoteCards) {
    if (!citationIds.has(quote.chunk_id)) citations.push(resultCitation(args.results.find((result) => result.id === quote.chunk_id)!));
    citationIds.add(quote.chunk_id);
  }

  const bullets = quoteCards.slice(0, 5).map((quote) => {
    const section = quote.section_heading ? `${quote.section_heading}: ` : "";
    return `- ${boldClinicalSpecifics(`${section}${quote.quote}`)}`;
  });

  const answer = bullets.length
    ? bullets.join("\n")
    : "The indexed source passages matched the question, but no concise source sentence could be extracted. Open the cited sources before relying on this result.";

  return {
    answer,
    grounded: citations.length > 0,
    confidence: deriveConfidence(args.results, citations.length),
    citations: citations.slice(0, 5),
    sources: args.results,
    modelUsed: null,
    routingMode: "extractive",
    routingReason: args.routeReason,
    latencyTimings: args.timings,
    answerSections: bullets.length
      ? [
          {
            heading: "High-yield source points",
            body: bullets.join("\n"),
            citation_chunk_ids: quoteCards.map((quote) => quote.chunk_id),
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
  } satisfies RagAnswer;
}

export async function searchChunksWithTelemetry(args: SearchChunksArgs) {
  const cached = getCachedSearch(args);
  if (cached) return cached;

  const supabase = createAdminClient();
  const documentFilterList = args.documentIds?.length ? args.documentIds : args.documentId ? [args.documentId] : undefined;
  const telemetry: SearchTelemetry = {
    search_cache_hit: false,
    text_fast_path_latency_ms: 0,
    embedding_skipped: false,
    embedding_latency_ms: 0,
    embedding_cache_hit: false,
    supabase_rpc_latency_ms: 0,
    rerank_latency_ms: 0,
  };

  const expandedQuery = expandClinicalQuery(args.query);
  const textSearchQuery = buildClinicalTextSearchQuery(args.query);
  const candidateCount = Math.max((args.topK ?? 8) * 5, 48);
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
    textFastResults = diversifySearchResults(rankClinicalResults(args.query, textData as SearchResult[]), args.topK ?? 8);
    telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;

    if (shouldReturnTextFastPath(args.query, textFastResults)) {
      telemetry.embedding_skipped = true;
      telemetry.retrieval_strategy = "text_fast_path";
      setCachedSearch(args, textFastResults, telemetry);
      return { results: textFastResults, telemetry };
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
    const results = diversifySearchResults(rankClinicalResults(args.query, merged), args.topK ?? 8);
    telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;
    telemetry.retrieval_strategy = "hybrid";
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
  const results = diversifySearchResults(rankClinicalResults(args.query, mergeSearchResults(resultSets.flat(), textFastResults)), args.topK ?? 8);
  telemetry.rerank_latency_ms += Date.now() - rerankStartedAt;
  telemetry.retrieval_strategy = "vector_fallback";
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

export function buildRagSourceBlock(results: SearchResult[]) {
  return results
    .map((result, index) => {
      const page = result.page_number ? `page ${result.page_number}` : "page unavailable";
      const searchableImages = result.images?.filter(
        (image) => image.searchable !== false && image.image_type !== "logo_decorative",
      );
      const images = searchableImages?.length
        ? `\nImages: ${searchableImages.map((image) => image.caption).join(" | ")}`
        : "";
      return [
        [
          `[${index + 1}] ${result.title} (${result.file_name}, ${page}, chunk ${result.chunk_index}, similarity ${result.similarity.toFixed(3)})`,
          `citation_chunk_id: ${result.id}`,
          `document_id: ${result.document_id}`,
        ].join("\n"),
        result.content,
        images,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export function parseAnswerJson(raw: string, results: SearchResult[]): RagAnswer {
  try {
    const parsed = answerJsonSchema.parse(JSON.parse(raw));
    const citations = sanitizeCitations(parsed.citations, results);
    const derivedConfidence = parsed.citations.length
      ? deriveConfidence(results, citations.length)
      : clampConfidence("low", deriveConfidence(results, citations.length));
    const confidence = clampConfidence(parsed.confidence, derivedConfidence);
    return {
      answer: parsed.answer ?? raw,
      grounded: citations.length > 0 && confidence !== "unsupported",
      confidence,
      citations,
      sources: results,
      answerSections: sanitizeAnswerSections(parsed.answerSections, results),
      conflictsOrGaps: sanitizeConflictsOrGaps(parsed.conflictsOrGaps, results),
      quoteCards: sanitizeQuoteCards(parsed.quoteCards, results),
      visualEvidence: [],
      bestSource: null,
      documentBreakdown: [],
    };
  } catch {
    return safeFallbackAnswer(raw, results);
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
    await args.onProgress?.({
      stage: "cached",
      message: "Using a recent cited answer for this exact query and document scope.",
      mode: cachedAnswer.routingMode,
      model: cachedAnswer.modelUsed,
      reason: cachedAnswer.routingReason,
    });
    return cachedAnswer;
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
  const results = normalizeSearchResults(search.results);
  const searchLatencyMs = Date.now() - searchStartedAt;
  const quoteCards = extractQuoteCards(results, args.query);
  const documentBreakdown = buildDocumentBreakdown(results, quoteCards);
  const smartPanel = buildSmartPanel(args.query, results);
  const evidenceSummary = buildEvidenceSummary(results, quoteCards);
  const sourceCoverage = buildSourceCoverage(results);
  const conflictsOrGaps = detectConflictsOrGaps(results);
  const visualEvidence = buildVisualEvidence(results);
  const bestSource = selectBestSourceRecommendation(results, quoteCards);
  const relatedDocumentsPromise = buildRelatedDocumentsSafe({
    query: args.query,
    results,
    ownerId: args.ownerId,
  });
  const route = chooseAnswerRoute({
    query: args.query,
    results,
    conflictsOrGaps,
    fastModel: env.OPENAI_FAST_ANSWER_MODEL,
    strongModel: env.OPENAI_STRONG_ANSWER_MODEL,
  });
  await args.onProgress?.({
    stage: "retrieved",
    message: `Retrieved ${results.length} candidate source${results.length === 1 ? "" : "s"}.`,
    resultCount: results.length,
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
  });

  if (route.mode === "unsupported") {
    const relatedDocuments = await relatedDocumentsPromise;
    const emptyPanel = buildSmartPanel(args.query, []);
    const unsupportedWithNearbySources = results.length > 0;
    const answer = {
      answer: unsupportedWithNearbySources
        ? "I found nearby indexed passages, but they are not strong enough to support a reliable answer. Try rephrasing the question or selecting a more relevant document."
        : "I could not find enough support in the indexed documents to answer this question. Upload or index a relevant guideline, then search again.",
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: results,
      modelUsed: null,
      routingMode: route.mode,
      routingReason: route.reason,
      latencyTimings: {
        search_cache_hit: search.telemetry.search_cache_hit,
        text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
        embedding_skipped: search.telemetry.embedding_skipped,
        embedding_latency_ms: search.telemetry.embedding_latency_ms,
        embedding_cache_hit: search.telemetry.embedding_cache_hit,
        supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
        rerank_latency_ms: search.telemetry.rerank_latency_ms,
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
        ? { ...smartPanel, bestSource, relatedDocuments }
        : { ...emptyPanel, relatedDocuments },
      relatedDocuments,
    } satisfies RagAnswer;

    if (args.logQuery !== false) await logRagQuery({
      owner_id: args.ownerId ?? null,
      query: args.query,
      answer: answer.answer,
      source_chunk_ids: results.map((result) => result.id),
      model: null,
      metadata: {
        document_id: args.documentId ?? null,
        document_ids: args.documentIds ?? null,
        grounded: answer.grounded,
        confidence: answer.confidence,
        routing_mode: route.mode,
        routing_reason: route.reason,
        model_used: null,
        retrieved_candidate_count: results.length,
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
        search_latency_ms: searchLatencyMs,
        generation_latency_ms: 0,
        total_latency_ms: answer.latencyTimings.total_latency_ms,
        evidence_summary: answer.evidenceSummary,
        related_document_count: relatedDocuments.length,
      },
    });

    setCachedAnswer(args, answer);
    return answer;
  }

  if (route.mode === "extractive") {
    const relatedDocuments = await relatedDocumentsPromise;
    const answer = buildExtractiveAnswer({
      query: args.query,
      results,
      quoteCards,
      documentBreakdown,
      evidenceSummary,
      sourceCoverage,
      conflictsOrGaps,
      visualEvidence,
      bestSource,
      smartPanel: { ...smartPanel, bestSource, relatedDocuments },
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
        search_latency_ms: searchLatencyMs,
        generation_latency_ms: 0,
        total_latency_ms: Date.now() - startedAt,
      },
    });

    if (args.logQuery !== false) await logRagQuery({
      owner_id: args.ownerId ?? null,
      query: args.query,
      answer: answer.answer,
      source_chunk_ids: results.map((result) => result.id),
      model: null,
      metadata: {
        document_id: args.documentId ?? null,
        document_ids: args.documentIds ?? null,
        grounded: answer.grounded,
        confidence: answer.confidence,
        routing_mode: answer.routingMode,
        routing_reason: answer.routingReason,
        model_used: null,
        retrieved_candidate_count: results.length,
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
        search_latency_ms: searchLatencyMs,
        generation_latency_ms: 0,
        total_latency_ms: answer.latencyTimings?.total_latency_ms ?? Date.now() - startedAt,
        evidence_summary: answer.evidenceSummary,
      },
    });

    setCachedAnswer(args, answer);
    return answer;
  }

  const answerInstructions = `You are answering for a psychiatrist in Perth, Australia using only uploaded clinical document excerpts.

Rules:
- Answer directly from the provided excerpts only.
- Be concise: usually 1-2 short paragraphs or 4-8 bullets unless source complexity requires more.
- Prefer concise, high-yield clinical bullets. Avoid generic background.
- Prefer Australian or WA-specific guidance when present in the sources.
- Do not provide patient-specific medical advice.
- If the excerpts do not support a direct answer, say that the uploaded documents do not contain enough information.
- Use wording close to the retrieved source text.
- Put the grounded synthesis first. Then include supported detail sections only when they add clinically useful detail.
- Compare sources when several documents are relevant. Mention gaps or weak support when the evidence is narrow.
- Include clinically practical details and caveats only when supported.
- Use only the strongest 3-5 citations, not every source.
- Bold only source-supported clinical specifics using **bold**: medications, thresholds, timing, escalation triggers, required actions, contraindications.
- Do not use Markdown other than **bold** inside answer or answerSections.
- Include 2-4 short exact quotes in quoteCards; quotes must be copied from the retrieved source excerpts.
- Return data matching the supplied structured output schema.`;

  function buildAnswerInput(contextResults: SearchResult[]) {
    return `Question:
${args.query}

Sources:
${buildRagSourceBlock(contextResults)}`;
  }

  let generationLatencyMs = 0;
  let modelUsed = route.model;
  let routingReason = route.reason;
  let retriedWithStrong = false;
  let openAIUsage: OpenAITokenUsage = {};
  const openAIRequestIds: string[] = [];

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
        promptCacheKey: "clinical-rag-answer-v2",
        reasoningEffort:
          model === env.OPENAI_STRONG_ANSWER_MODEL ? env.OPENAI_STRONG_REASONING_EFFORT : env.OPENAI_FAST_REASONING_EFFORT,
      });
      openAIUsage = addOpenAIUsage(openAIUsage, result.usage);
      if (result.requestId) openAIRequestIds.push(result.requestId);
      return result;
    } finally {
      generationLatencyMs += Date.now() - generationStartedAt;
    }
  }

  const fastContextResults = route.mode === "fast" ? results.slice(0, 4) : results;
  await args.onProgress?.({
    stage: "generating",
    message: `Generating cited answer with ${route.mode} route.`,
    mode: route.mode,
    model: route.model,
    reason: route.reason,
  });
  let generated = await generateWithModel(route.model!, fastContextResults);
  let answer = parseAnswerJson(generated.text, fastContextResults);
  if (shouldRetryWithStrongAfterFast({ route, answer, results })) {
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
    generated = await generateWithModel(env.OPENAI_STRONG_ANSWER_MODEL, results);
    answer = parseAnswerJson(generated.text, results);
  }
  await args.onProgress?.({ stage: "finalizing", message: "Checking citations and source metadata." });

  const relatedDocuments = await relatedDocumentsPromise;
  answer.sources = results;
  answer.quoteCards = reconcileQuoteCards(answer.quoteCards, results, args.query);
  answer.documentBreakdown = documentBreakdown;
  answer.evidenceSummary = evidenceSummary;
  answer.sourceCoverage = sourceCoverage;
  answer.conflictsOrGaps = answer.conflictsOrGaps?.length ? answer.conflictsOrGaps : conflictsOrGaps;
  answer.visualEvidence = visualEvidence;
  answer.bestSource = selectBestSourceRecommendation(results, answer.quoteCards) ?? bestSource;
  answer.relatedDocuments = relatedDocuments;
  answer.smartPanel = { ...smartPanel, bestSource: answer.bestSource, relatedDocuments };
  answer.modelUsed = modelUsed;
  answer.routingMode = retriedWithStrong ? "strong" : route.mode;
  answer.routingReason = routingReason;
  answer.openAIRequestIds = openAIRequestIds;
  answer.openAIUsage = hasOpenAIUsage(openAIUsage) ? openAIUsage : undefined;
  answer.latencyTimings = {
    search_cache_hit: search.telemetry.search_cache_hit,
    text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
    embedding_skipped: search.telemetry.embedding_skipped,
    embedding_latency_ms: search.telemetry.embedding_latency_ms,
    embedding_cache_hit: search.telemetry.embedding_cache_hit,
    supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
    rerank_latency_ms: search.telemetry.rerank_latency_ms,
    search_latency_ms: searchLatencyMs,
    generation_latency_ms: generationLatencyMs,
    total_latency_ms: Date.now() - startedAt,
  };

  if (args.logQuery !== false) await logRagQuery({
    owner_id: args.ownerId ?? null,
    query: args.query,
    answer: answer.answer,
    source_chunk_ids: results.map((result) => result.id),
    model: modelUsed,
    metadata: {
      document_id: args.documentId ?? null,
      document_ids: args.documentIds ?? null,
      grounded: answer.grounded,
      confidence: answer.confidence,
      routing_mode: answer.routingMode,
      routing_reason: routingReason,
      model_used: modelUsed,
      fast_model: env.OPENAI_FAST_ANSWER_MODEL,
      strong_model: env.OPENAI_STRONG_ANSWER_MODEL,
      retrieved_candidate_count: results.length,
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
      search_latency_ms: searchLatencyMs,
      generation_latency_ms: generationLatencyMs,
      total_latency_ms: answer.latencyTimings.total_latency_ms,
      openai_request_ids: openAIRequestIds,
      openai_usage: answer.openAIUsage ?? null,
      evidence_summary: answer.evidenceSummary,
    },
  });

  setCachedAnswer(args, answer);
  return answer;
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
Use only the excerpts provided. Focus on high-yield actions, thresholds, medication or risk monitoring, exceptions, and citations.
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
  const answer = parseAnswerJson(generated.text, results);
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
