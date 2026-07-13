import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildClinicalTextSearchQuery } from "@/lib/clinical-search";
import { readExpiringCacheEntry, writeBoundedExpiringCacheEntry } from "@/lib/bounded-ttl-cache";
import { ragDeepMemoryVersion } from "@/lib/deep-memory";
import { env } from "@/lib/env";
import { queryCacheKeyForStorage } from "@/lib/query-privacy";
import { ragCacheKeyMatchesOwner } from "@/lib/rag-cache-utils";
import { compactContextText } from "@/lib/rag-source-block";
import { committedIndexGeneration } from "@/lib/reindex-pipeline";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import { retrievalPlanForQueryClass, type SearchChunksArgs, type SearchTelemetry } from "@/lib/rag-contracts";
import type { Json } from "@/lib/supabase/database.types";
import type { RagAnswer, RagQueryClass, SearchResult } from "@/lib/types";

const answerCache = new Map<string, { expiresAt: number; answer: RagAnswer; indexingVersion: string }>();
export const answerInflight = new Map<string, Promise<RagAnswer>>();
const searchCache = new Map<
  string,
  { expiresAt: number; results: SearchResult[]; telemetry: SearchTelemetry; indexingVersion: string }
>();
const ragCacheDependencyVersion = "rag-cache-v12";
const cacheIndexingVersionTtlMs = 5000;
const cacheIndexingVersionMaxEntries = 512;
const cacheIndexingVersionCache = new Map<string, { expiresAt: number; value: string }>();

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

function modeKey(args: Pick<SearchChunksArgs, "queryMode">) {
  return args.queryMode ?? "auto";
}

export function scopedAnswerCacheKey(
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

export function cloneAnswer(answer: RagAnswer) {
  return structuredClone(answer);
}

/** Anonymous callers share no stable identity, so their PHI-bearing answers must never be cached or coalesced. */
export function answerCacheAllowedForOwner(ownerId?: string | null) {
  return Boolean(ownerId);
}

export async function getCachedAnswer(
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "skipCache" | "queryMode">,
  startedAt: number,
): Promise<RagAnswer | null> {
  if (!answerCacheAllowedForOwner(args.ownerId) || args.skipCache) return null;
  if (env.RAG_ANSWER_CACHE_TTL_MS <= 0 || env.RAG_ANSWER_CACHE_SIZE <= 0) return null;

  const key = scopedAnswerCacheKey(args);
  const cached = answerCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    answerCache.delete(key);
    return null;
  }
  const indexingVersion = await cacheIndexingVersion(args);
  if (cached.indexingVersion !== indexingVersion) {
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

export async function setCachedAnswer(
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "skipCache" | "queryMode">,
  answer: RagAnswer,
  options?: { indexingVersionAtRetrievalStart?: string | null },
): Promise<void> {
  if (!answerCacheAllowedForOwner(args.ownerId) || args.skipCache) return;
  if (env.RAG_ANSWER_CACHE_TTL_MS <= 0 || env.RAG_ANSWER_CACHE_SIZE <= 0) return;

  if (options?.indexingVersionAtRetrievalStart) {
    const currentIndexingVersion = await cacheIndexingVersion(args);
    if (currentIndexingVersion !== options.indexingVersionAtRetrievalStart) return;
  }

  const indexingVersion = await cacheIndexingVersion(args);
  const key = scopedAnswerCacheKey(args);
  answerCache.set(key, {
    expiresAt: Date.now() + env.RAG_ANSWER_CACHE_TTL_MS,
    answer: cloneAnswer(answer),
    indexingVersion,
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
    | "query"
    | "documentId"
    | "documentIds"
    | "ownerId"
    | "queryMode"
    | "topK"
    | "minSimilarity"
    | "forceEmbedding"
    | "lexicalOnly"
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
    `forceEmbedding:${args.forceEmbedding ? "1" : "0"}`,
    `lexicalOnly:${args.lexicalOnly ? "1" : "0"}`,
    `rag:${ragDeepMemoryVersion}`,
    `force:${args.forceEmbedding ? 1 : 0}`,
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

// Single source of truth for whether the process-local search cache is active
// for a request. Shared with the observability counter so a size-0 (or TTL-0 /
// skipCache) deployment records the lookup as neither hit nor miss rather than a
// false miss (the shared-cache lookup does not itself short-circuit on size).
export function isSearchCacheEnabled(args: Pick<SearchChunksArgs, "skipCache">): boolean {
  return !args.skipCache && env.RAG_SEARCH_CACHE_TTL_MS > 0 && env.RAG_SEARCH_CACHE_SIZE > 0;
}

export async function getCachedSearch(
  args: SearchChunksArgs,
  queryClass?: RagQueryClass,
  queryVariants: string[] = [],
): Promise<{ results: SearchResult[]; telemetry: SearchTelemetry } | null> {
  if (!isSearchCacheEnabled(args)) return null;

  const key = scopedSearchCacheKey(args, queryClass, queryVariants);
  const cached = searchCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }
  const indexingVersion = await cacheIndexingVersion(args);
  if (cached.indexingVersion !== indexingVersion) {
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

export async function setCachedSearch(
  args: SearchChunksArgs,
  results: SearchResult[],
  telemetry: SearchTelemetry,
  queryVariants: string[] = [],
  options?: { indexingVersionAtRetrievalStart?: string | null },
): Promise<void> {
  if (args.skipCache || env.RAG_SEARCH_CACHE_TTL_MS <= 0 || env.RAG_SEARCH_CACHE_SIZE <= 0) return;
  const cacheTelemetry = normalizeCacheStorageTelemetry(telemetry);

  const indexingVersion = await cacheIndexingVersion(args, { forceRefresh: true });
  if (options?.indexingVersionAtRetrievalStart && indexingVersion !== options.indexingVersionAtRetrievalStart) return;
  const key = scopedSearchCacheKey(args, telemetry.query_class, queryVariants);
  searchCache.set(key, {
    expiresAt: Date.now() + env.RAG_SEARCH_CACHE_TTL_MS,
    results: cloneSearchResults(results),
    telemetry: { ...cacheTelemetry },
    indexingVersion,
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
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "queryMode" | "forceEmbedding">,
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

export async function cacheIndexingVersion(
  args: Pick<SearchChunksArgs, "documentId" | "documentIds" | "ownerId">,
  options?: { forceRefresh?: boolean },
) {
  const cacheKey = cacheIndexingVersionCacheKey(args);
  if (options?.forceRefresh) cacheIndexingVersionCache.delete(cacheKey);
  const cached = readExpiringCacheEntry(cacheIndexingVersionCache, cacheKey);
  if (cached) return cached.value;

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
  writeBoundedExpiringCacheEntry(
    cacheIndexingVersionCache,
    cacheKey,
    { value, expiresAt: Date.now() + cacheIndexingVersionTtlMs },
    cacheIndexingVersionMaxEntries,
  );
  return value;
}

export async function getSharedCachedSearch(
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

export async function getSharedCachedAnswer(
  args: Pick<
    SearchChunksArgs,
    "query" | "documentId" | "documentIds" | "ownerId" | "skipCache" | "queryMode" | "forceEmbedding"
  >,
  startedAt: number,
) {
  if (!answerCacheAllowedForOwner(args.ownerId) || args.skipCache || env.RAG_ANSWER_CACHE_TTL_MS <= 0) return null;
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
  args: Pick<SearchChunksArgs, "query" | "documentId" | "documentIds" | "ownerId" | "queryMode" | "forceEmbedding">,
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
  args: Pick<
    SearchChunksArgs,
    "query" | "documentId" | "documentIds" | "ownerId" | "skipCache" | "queryMode" | "forceEmbedding"
  >,
  answer: RagAnswer,
) {
  if (!answerCacheAllowedForOwner(args.ownerId) || args.skipCache || env.RAG_ANSWER_CACHE_TTL_MS <= 0) return;
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

  const sharedCacheOwnerId = ownerId === "anonymous" ? null : ownerId;
  for (const key of answerCache.keys()) {
    if (ragCacheKeyMatchesOwner(key, ownerId)) answerCache.delete(key);
  }
  for (const key of answerInflight.keys()) {
    if (ragCacheKeyMatchesOwner(key, ownerId)) answerInflight.delete(key);
  }
  for (const key of searchCache.keys()) {
    if (ragCacheKeyMatchesOwner(key, ownerId)) searchCache.delete(key);
  }
  for (const key of cacheIndexingVersionCache.keys()) {
    if (ragCacheKeyMatchesOwner(key, ownerId)) cacheIndexingVersionCache.delete(key);
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

export async function packAdjacentSourceContext(
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

// The numeric-faithfulness gate must verify answer figures against the SAME text
// the model was shown. Generation runs on the packed context (packAdjacentSourceContext
// merges neighbour-chunk text into adjacent_context), but answer.sources is the
// unpacked answer-input set — so a dose/threshold the model faithfully copied from a
// neighbour chunk would be absent from the finalize-time verification corpus and wrongly
// flagged unverified, blanking a correct answer. Overlay the packed adjacent_context onto
// the answer-input results (by chunk id) to rebuild the exact verification corpus, WITHOUT
// mutating answer.sources itself (the route-boundary client trim and eval byte-identity
// both depend on answer.sources staying unpacked — see answer-client-payload.ts).
export function attachAdjacentContext(results: SearchResult[], packed: SearchResult[]): SearchResult[] {
  const adjacentById = new Map<string, string>();
  for (const source of packed) {
    if (source.adjacent_context) adjacentById.set(source.id, source.adjacent_context);
  }
  if (adjacentById.size === 0) return results;
  return results.map((result) => {
    const adjacent = adjacentById.get(result.id);
    return adjacent && adjacent !== result.adjacent_context ? { ...result, adjacent_context: adjacent } : result;
  });
}
