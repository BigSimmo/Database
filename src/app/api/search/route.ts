import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSearch } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { buildSmartPanel, buildVisualEvidence, diversifySearchResults } from "@/lib/evidence";
import { annotateDocumentMatches, annotateSearchResults, buildEvidenceRelevance } from "@/lib/evidence-relevance";
import { fetchRelatedDocuments, toDocumentMatch } from "@/lib/document-enrichment";
import { jsonError, PublicApiError } from "@/lib/http";
import { isClinicalImageEvidence } from "@/lib/image-filtering";
import { searchChunksWithTelemetry } from "@/lib/rag";
import { classifyRagQuery, normalizedClinicalSearchTokens } from "@/lib/clinical-search";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
import { createAdminClient } from "@/lib/supabase/admin";
import * as serverAuth from "@/lib/supabase/auth";
import { consumePublicSearchRateLimit } from "@/lib/public-rate-limit";
import { clinicalQueryModeSchema, queryClassForClinicalMode, queryForClinicalMode } from "@/lib/clinical-query-mode";
import { resolveSearchScope, searchScopeFiltersSchema } from "@/lib/search-scope";
import { sourceGovernanceWarnings } from "@/lib/source-governance";
import { normalizeQueryText, queryPrivacyMetadata, queryTextForStorage } from "@/lib/query-privacy";
import type { ChunkImage, ClinicalSourceMetadata, SearchResult } from "@/lib/types";

export const runtime = "nodejs";

const searchSchema = z.object({
  query: z.string().trim().min(1),
  topK: z.number().int().min(1).max(20).optional(),
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(25).optional(),
  filters: searchScopeFiltersSchema.optional(),
  queryMode: clinicalQueryModeSchema.optional().default("auto"),
  mode: z.enum(["answer", "documents"]).optional().default("answer"),
  documentLimit: z.number().int().min(1).max(50).optional().default(20),
  includeRelatedDocuments: z.boolean().optional().default(true),
});

type SearchRequestBody = z.infer<typeof searchSchema>;

const scopedSearchInflight = new Map<string, Promise<unknown>>();

function scopedSearchKey(body: SearchRequestBody, ownerId: string) {
  return JSON.stringify({
    ownerId,
    query: body.query.toLowerCase().replace(/\s+/g, " ").trim(),
    topK: body.topK ?? null,
    documentId: body.documentId ?? null,
    documentIds: body.documentIds?.length ? [...body.documentIds].sort() : [],
    filters: body.filters ?? {},
    queryMode: body.queryMode,
    mode: body.mode,
    documentLimit: body.documentLimit,
    includeRelatedDocuments: body.includeRelatedDocuments,
  });
}

async function coalesceScopedSearch<T extends Record<string, unknown>>(key: string, producer: () => Promise<T>) {
  const existing = scopedSearchInflight.get(key) as Promise<T> | undefined;
  if (existing) return { payload: await existing, coalesced: true };

  const pending = producer().finally(() => {
    scopedSearchInflight.delete(key);
  });
  scopedSearchInflight.set(key, pending);
  return { payload: await pending, coalesced: false };
}

function buildDocumentMatchesFromResults(results: SearchResult[], limit: number) {
  const grouped = new Map<
    string,
    {
      document_id: string;
      title: string;
      file_name: string;
      bestPages: number[];
      bestChunkIds: string[];
      imageCount: number;
      tableCount: number;
      score: number;
    }
  >();
  for (const result of results) {
    const current = grouped.get(result.document_id);
    const score = result.hybrid_score ?? result.similarity;
    const page = result.page_number ?? null;
    const clinicalImages = result.images?.filter((image) => isClinicalImageEvidence(image)) ?? [];
    const tableCount = clinicalImages.filter((image) => image.source_kind === "table_crop").length;
    const imageCount = clinicalImages.length;
    if (!current) {
      grouped.set(result.document_id, {
        document_id: result.document_id,
        title: result.title,
        file_name: result.file_name,
        bestPages: page ? [page] : [],
        bestChunkIds: [result.id],
        imageCount,
        tableCount,
        score,
      });
      continue;
    }
    current.score = Math.max(current.score, score);
    if (page && !current.bestPages.includes(page)) current.bestPages.push(page);
    if (!current.bestChunkIds.includes(result.id)) current.bestChunkIds.push(result.id);
    current.imageCount += imageCount;
    current.tableCount += tableCount;
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((document) => ({
      ...document,
      labels: [],
      summarySnippet: null,
      matchReason: `Matched ${document.bestChunkIds.length} indexed passage${
        document.bestChunkIds.length === 1 ? "" : "s"
      }`,
    }));
}

function compactText(value: string, limit = 900) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 3).trim()}...`;
}

function compactSourceMetadata(metadata: SearchResult["source_metadata"]): Partial<ClinicalSourceMetadata> | undefined {
  if (!metadata) return undefined;
  return {
    source_title: metadata.source_title,
    publisher: metadata.publisher,
    jurisdiction: metadata.jurisdiction,
    version: metadata.version,
    review_date: metadata.review_date,
    publication_date: metadata.publication_date,
    document_status: metadata.document_status,
    clinical_validation_status: metadata.clinical_validation_status,
    extraction_quality: metadata.extraction_quality,
    indexed_at: metadata.indexed_at,
  };
}

function compactImage(image: ChunkImage) {
  return {
    id: image.id,
    page_number: image.page_number,
    source_kind: image.source_kind,
    sourceKind: image.sourceKind,
    image_type: image.image_type,
    clinicalUseClass: image.clinicalUseClass,
    caption: image.caption ? compactText(image.caption, 240) : "",
    storage_path: image.storage_path,
    searchable: image.searchable,
    clinical_relevance_score: image.clinical_relevance_score,
    tableLabel: image.tableLabel,
    tableTitle: image.tableTitle,
  };
}

function buildMatchExplanation(query: string, result: SearchResult) {
  if (result.match_explanation) return result.match_explanation;
  const queryTerms = new Set(normalizedClinicalSearchTokens(query));
  const titleText = `${result.title} ${result.file_name}`.toLowerCase();
  const sectionText = `${result.section_heading ?? ""} ${(result.section_path ?? []).join(" ")}`.toLowerCase();
  const labelText = (result.document_labels ?? []).map((label) => label.label.toLowerCase()).join(" ");
  const contentText = `${result.retrieval_synopsis ?? ""} ${result.content}`.toLowerCase();
  const tableHit = Boolean(
    result.table_facts?.length ||
    result.images?.some((image) => image.source_kind === "table_crop" || image.sourceKind === "table_crop"),
  );
  const titleHit = Array.from(queryTerms).some((term) => titleText.includes(term));
  const sectionHit = Array.from(queryTerms).some((term) => sectionText.includes(term));
  const labelHit = Array.from(queryTerms).some((term) => labelText.includes(term));
  const contentHit = Array.from(queryTerms).some((term) => contentText.includes(term));
  const metadata = result.source_metadata;
  return {
    titleHit,
    labelHit,
    sectionHit,
    contentHit,
    tableHit,
    indexUnitType: result.index_unit?.unit_type ?? null,
    vectorSimilarity: result.similarity ?? null,
    textRank: result.text_rank ?? null,
    freshness: metadata?.document_status ?? null,
    extractionQuality: metadata?.extraction_quality ?? null,
    indexQualityScore: result.indexing_quality?.quality_score ?? null,
    indexQualityIssues: result.indexing_quality?.issues?.slice(0, 4) ?? [],
    reasons: [
      titleHit ? "title" : "",
      labelHit ? "label" : "",
      sectionHit ? "section" : "",
      contentHit ? "content" : "",
      tableHit ? "table" : "",
      result.index_unit?.unit_type ? `unit:${result.index_unit.unit_type}` : "",
      metadata?.document_status ? `status:${metadata.document_status}` : "",
      metadata?.extraction_quality ? `extraction:${metadata.extraction_quality}` : "",
      result.indexing_quality?.quality_score !== undefined
        ? `index:${Number(result.indexing_quality.quality_score).toFixed(2)}`
        : "",
    ].filter(Boolean),
  };
}

function compactSearchResult(query: string, result: SearchResult) {
  const evidenceImages = result.images?.filter((image) => isClinicalImageEvidence(image)).slice(0, 3) ?? [];
  return {
    id: result.id,
    document_id: result.document_id,
    title: result.title,
    file_name: result.file_name,
    page_number: result.page_number,
    chunk_index: result.chunk_index,
    section_heading: result.section_heading,
    section_path: result.section_path ?? [],
    heading_level: result.heading_level ?? null,
    parent_heading: result.parent_heading ?? null,
    anchor_id: result.anchor_id ?? null,
    content: compactText(result.content),
    retrieval_synopsis: result.retrieval_synopsis ? compactText(result.retrieval_synopsis, 520) : null,
    image_ids: result.image_ids?.slice(0, 8) ?? [],
    similarity: result.similarity,
    text_rank: result.text_rank,
    hybrid_score: result.hybrid_score,
    rrf_score: result.rrf_score,
    source_strength: result.source_strength,
    score_explanation: result.score_explanation,
    source_metadata: compactSourceMetadata(result.source_metadata),
    relevance: result.relevance,
    match_explanation: buildMatchExplanation(query, result),
    index_unit: result.index_unit
      ? {
          id: result.index_unit.id,
          unit_type: result.index_unit.unit_type,
          title: result.index_unit.title,
          content: compactText(result.index_unit.content, 360),
          page_start: result.index_unit.page_start,
          page_end: result.index_unit.page_end,
          heading_path: result.index_unit.heading_path?.slice(0, 6) ?? [],
          quality_score: result.index_unit.quality_score,
          extraction_mode: result.index_unit.extraction_mode,
          source_span: result.index_unit.source_span ?? null,
          hybrid_score: result.index_unit.hybrid_score ?? null,
        }
      : null,
    table_facts: result.table_facts?.slice(0, 4).map((fact) => ({
      id: fact.id,
      source_chunk_id: fact.source_chunk_id,
      source_image_id: fact.source_image_id,
      page_number: fact.page_number,
      table_title: fact.table_title,
      row_label: fact.row_label,
      clinical_parameter: fact.clinical_parameter,
      threshold_value: fact.threshold_value,
      action: fact.action,
      match_reason: fact.match_reason,
    })),
    indexing_quality: result.indexing_quality ?? null,
    images: evidenceImages.map(compactImage),
  };
}

function compactSearchResults(query: string, results: SearchResult[]) {
  return results.map((result) => compactSearchResult(query, result));
}

function facetCounts(values: Array<string | null | undefined>, limit = 12) {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function buildSearchFacets(results: SearchResult[]) {
  return {
    status: facetCounts(results.map((result) => result.source_metadata?.document_status)),
    validation: facetCounts(results.map((result) => result.source_metadata?.clinical_validation_status)),
    extractionQuality: facetCounts(results.map((result) => result.source_metadata?.extraction_quality)),
    sections: facetCounts(results.map((result) => result.section_heading)),
    labels: facetCounts(results.flatMap((result) => result.document_labels?.map((label) => label.label) ?? [])),
    documentTypes: facetCounts(
      results.flatMap(
        (result) =>
          result.document_labels?.filter((label) => label.label_type === "document_type").map((label) => label.label) ??
          [],
      ),
    ),
    evidence: [
      { value: "has_images", count: results.filter((result) => result.images?.length).length },
      {
        value: "has_tables",
        count: results.filter(
          (result) =>
            result.table_facts?.length ||
            result.images?.some((image) => image.source_kind === "table_crop" || image.sourceKind === "table_crop"),
        ).length,
      },
    ].filter((facet) => facet.count > 0),
  };
}

function candidatePromotions(query: string, results: SearchResult[]) {
  const queryTerms = normalizedClinicalSearchTokens(query);
  const topLabels = results
    .flatMap((result) => result.document_labels ?? [])
    .filter((label) => label.confidence >= 0.55)
    .slice(0, 8)
    .map((label) => ({
      label: label.label,
      label_type: label.label_type,
      document_id: label.document_id,
      confidence: label.confidence,
    }));
  return {
    aliases: Array.from(new Set(queryTerms)).slice(0, 10),
    labels: topLabels,
  };
}

function logWeakSearch(args: {
  supabase: ReturnType<typeof createAdminClient>;
  ownerId: string;
  query: string;
  queryClass: string;
  route?: string | null;
  retrievalStrategy?: string | null;
  relevance: ReturnType<typeof buildEvidenceRelevance>;
  results: SearchResult[];
}) {
  const topScore = Math.max(
    0,
    ...args.results
      .slice(0, 5)
      .map((result) => result.score_explanation?.finalScore ?? result.hybrid_score ?? result.similarity ?? 0),
  );
  const weak =
    args.results.length === 0 ||
    args.relevance.verdict === "none" ||
    args.relevance.verdict === "nearby" ||
    topScore < 0.48;
  if (!weak) return;
  const promotions = candidatePromotions(args.query, args.results);
  void args.supabase
    .from("rag_query_misses")
    .insert({
      owner_id: args.ownerId,
      query: queryTextForStorage(args.query),
      normalized_query: normalizeQueryText(args.query),
      query_class: args.queryClass,
      route: args.route ?? null,
      retrieval_strategy: args.retrievalStrategy ?? null,
      top_score: topScore,
      top_files: Array.from(new Set(args.results.slice(0, 5).map((result) => result.file_name))),
      top_chunk_ids: args.results
        .slice(0, 8)
        .map((result) => result.id)
        .filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
      miss_reason: args.results.length === 0 ? "no_results" : `weak_${args.relevance.verdict}`,
      candidate_aliases: promotions.aliases,
      candidate_labels: promotions.labels,
      metadata: {
        relevance_score: args.relevance.score,
        direct_source_count: args.relevance.directSourceCount,
        weak_source_count: args.relevance.weakSourceCount,
        ...queryPrivacyMetadata(args.query),
      },
    })
    .then(undefined, () => undefined);
}

function telemetryLatencyMs(telemetry: Record<string, unknown>) {
  const keys = ["text_fast_path_latency_ms", "embedding_latency_ms", "supabase_rpc_latency_ms", "rerank_latency_ms"];
  return keys.reduce((sum, key) => {
    const value = telemetry[key];
    return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
}

function latencyBucket(ms: number) {
  if (ms < 500) return "lt_500ms";
  if (ms < 1500) return "500_1500ms";
  if (ms < 5000) return "1500_5000ms";
  return "gte_5000ms";
}

function logSearchObservation(args: {
  supabase: ReturnType<typeof createAdminClient>;
  ownerId: string;
  query: string;
  results: SearchResult[];
  payload: Record<string, unknown>;
  failure?: { code: string; causeName?: string | null; causeMessage?: string | null; sqlState?: string | null };
}) {
  void (async () => {
    try {
      const telemetry =
        args.payload.telemetry && typeof args.payload.telemetry === "object"
          ? (args.payload.telemetry as Record<string, unknown>)
          : {};
      const payloadBytes = Buffer.byteLength(JSON.stringify(args.payload), "utf8");
      const topResult = args.results[0] ?? null;
      const latencyMs = telemetryLatencyMs(telemetry);
      await args.supabase.from("rag_queries").insert({
        owner_id: args.ownerId,
        query: queryTextForStorage(args.query),
        answer: null,
        source_chunk_ids: args.results.map((result) => result.id),
        model: "search",
        metadata: {
          ...queryPrivacyMetadata(args.query),
          event_type: args.failure ? "private_search_failure" : "private_search",
          failure_code: args.failure?.code ?? null,
          failure_cause_name: args.failure?.causeName ?? null,
          failure_cause_message: args.failure?.causeMessage ?? null,
          failure_sql_state: args.failure?.sqlState ?? null,
          query_class: telemetry.query_class ?? null,
          retrieval_strategy: telemetry.retrieval_strategy ?? null,
          payload_bytes: payloadBytes,
          result_count: args.results.length,
          top_document_id: topResult?.document_id ?? null,
          top_document_title: topResult?.title ?? null,
          top_file_name: topResult?.file_name ?? null,
          top_score: topResult ? (topResult.hybrid_score ?? topResult.similarity ?? null) : null,
          latency_ms: latencyMs,
          latency_bucket: latencyBucket(latencyMs),
          search_cache_hit: telemetry.search_cache_hit ?? null,
          embedding_skipped: telemetry.embedding_skipped ?? null,
        },
      });
    } catch {
      // Search telemetry must not affect the user-facing search path.
    }
  })();
}

async function buildScopedSearchPayload(
  body: SearchRequestBody,
  supabase: ReturnType<typeof createAdminClient>,
  ownerId: string,
) {
  const searchFocusQuery = queryForClinicalMode(body.query, body.queryMode);
  const effectiveQueryClass =
    queryClassForClinicalMode(body.queryMode) ?? classifyRagQuery(searchFocusQuery).queryClass;
  const scope = await resolveSearchScope({
    supabase,
    ownerId,
    documentIds: body.documentIds ?? (body.documentId ? [body.documentId] : undefined),
    filters: body.filters,
  });
  if (scope.documentIds?.length === 0) {
    const relevance = buildEvidenceRelevance(searchFocusQuery, []);
    const payload = {
      results: [],
      facets: buildSearchFacets([]),
      visualEvidence: [],
      relevance,
      relatedDocuments: [],
      documentMatches: [],
      smartPanel: { ...buildSmartPanel(body.query, []), relevance, relatedDocuments: [] },
      smartApiPlan: buildSmartRagApiPlan({
        query: searchFocusQuery,
        queryClass: effectiveQueryClass,
        results: [],
        retrievalStrategy: "unknown",
        routeMode: "unsupported",
        preferredResponseMode: body.mode === "documents" ? "document_lookup" : undefined,
      }),
      scope: { ...scope, queryMode: body.queryMode },
      sourceGovernanceWarnings: sourceGovernanceWarnings({ results: [], relevance }),
      telemetry: {
        query_class: effectiveQueryClass,
        relevance_verdict: relevance.verdict,
        relevance_score: relevance.score,
        direct_source_count: 0,
        weak_source_count: 0,
      },
    };
    logSearchObservation({ supabase, ownerId, query: body.query, results: [], payload });
    return payload;
  }
  const search = await searchChunksWithTelemetry({
    query: body.query,
    topK: body.mode === "documents" ? Math.max(body.topK ?? 12, Math.min(20, body.documentLimit)) : (body.topK ?? 8),
    documentIds: scope.documentIds ?? body.documentIds ?? (body.documentId ? [body.documentId] : undefined),
    ownerId,
    queryMode: body.queryMode,
  });
  const resultLimit =
    body.mode === "documents" ? Math.max(body.topK ?? 12, Math.min(20, body.documentLimit)) : (body.topK ?? 8);
  const results = annotateSearchResults(searchFocusQuery, diversifySearchResults(search.results, resultLimit, 4, true));

  const relatedDocuments = body.includeRelatedDocuments
    ? await fetchRelatedDocuments({
        supabase,
        ownerId,
        query: searchFocusQuery,
        results,
        limit: body.mode === "documents" ? body.documentLimit : undefined,
      })
    : [];
  const smartPanel = buildSmartPanel(searchFocusQuery, results);
  const relevance = buildEvidenceRelevance(searchFocusQuery, results);
  const documentMatches =
    body.mode === "documents"
      ? annotateDocumentMatches(searchFocusQuery, relatedDocuments.map(toDocumentMatch), results)
      : [];
  const smartApiPlan = buildSmartRagApiPlan({
    query: searchFocusQuery,
    queryClass: effectiveQueryClass,
    results,
    retrievalStrategy: search.telemetry.retrieval_strategy,
    routeMode: body.mode === "documents" ? undefined : "fast",
    preferredResponseMode: body.mode === "documents" ? "document_lookup" : undefined,
  });
  logWeakSearch({
    supabase,
    ownerId,
    query: body.query,
    queryClass: effectiveQueryClass,
    route: body.mode,
    retrievalStrategy: search.telemetry.retrieval_strategy,
    relevance,
    results,
  });

  const payload = {
    results: compactSearchResults(searchFocusQuery, results),
    facets: buildSearchFacets(results),
    visualEvidence: buildVisualEvidence(results),
    relevance,
    relatedDocuments: relatedDocuments.map((document) => ({
      document_id: document.document_id,
      title: document.title,
      file_name: document.file_name,
      score: document.score,
      best_pages: document.best_pages,
      best_chunk_ids: document.best_chunk_ids,
      image_count: document.image_count,
      table_count: document.table_count ?? 0,
      match_reason: document.match_reason,
      summary: document.summary ? compactText(document.summary, 360) : null,
      labels: document.labels?.slice(0, 6) ?? [],
    })),
    documentMatches,
    smartPanel: { ...smartPanel, relevance, relatedDocuments },
    smartApiPlan,
    scope: { ...scope, queryMode: body.queryMode },
    sourceGovernanceWarnings: sourceGovernanceWarnings({ results, relevance }),
    telemetry: {
      query_class: effectiveQueryClass,
      relevance_verdict: relevance.verdict,
      relevance_score: relevance.score,
      direct_source_count: relevance.directSourceCount,
      weak_source_count: relevance.weakSourceCount,
      retrieval_strategy: search.telemetry.retrieval_strategy,
      smart_api_intent: smartApiPlan.intent,
      smart_api_response_mode: smartApiPlan.responseMode,
      smart_api_display_mode: smartApiPlan.displayMode,
      smart_api_source_link_count: smartApiPlan.sourceLinkCount,
      search_cache_hit: search.telemetry.search_cache_hit,
      embedding_skipped: search.telemetry.embedding_skipped,
      embedding_cache_hit: search.telemetry.embedding_cache_hit,
      text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
      embedding_latency_ms: search.telemetry.embedding_latency_ms,
      supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
      rerank_latency_ms: search.telemetry.rerank_latency_ms,
      memory_card_count: search.telemetry.memory_card_count,
      memory_top_score: search.telemetry.memory_top_score,
      index_unit_count: search.telemetry.index_unit_count,
      index_unit_top_score: search.telemetry.index_unit_top_score,
      weighted_top_score: search.telemetry.weighted_top_score,
      rrf_top_score: search.telemetry.rrf_top_score,
    },
  };
  logSearchObservation({ supabase, ownerId, query: body.query, results, payload });
  return payload;
}

function classifySearchFailure(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const sqlState = extractSqlState(error);
  if (message.includes("rate limit") || message.includes("429")) return "search_rate_limited";
  if (message.includes("type ") && message.includes("does not exist")) return "search_schema_type_missing";
  if (message.includes("public.vector") || message.includes("extensions.vector")) return "search_vector_type_mismatch";
  if (sqlState) return `search_sqlstate_${sqlState}`;
  if (message.includes("pgrst")) return "search_postgrest_failure";
  if (message.includes("embedding") || message.includes("openai")) return "embedding_or_model_failure";
  if (message.includes("rpc") || message.includes("function") || message.includes("match_document"))
    return "supabase_rpc_failure";
  if (message.includes("timeout") || message.includes("timed out") || message.includes("network"))
    return "search_timeout";
  if (message.includes("permission") || message.includes("jwt") || message.includes("auth"))
    return "search_auth_context_failure";
  if (message.includes("schema") || message.includes("column") || message.includes("relation"))
    return "search_schema_mismatch";
  return error instanceof Error && error.name !== "Error" ? error.name : "search_unknown_failure";
}

function extractSqlState(error: unknown) {
  const value = error as { code?: unknown; details?: unknown; message?: unknown };
  const candidates = [value?.code, value?.details, value?.message, error instanceof Error ? error.message : null]
    .filter((item): item is string => typeof item === "string")
    .join(" ");
  const match = candidates.match(/\b([0-9A-Z]{5})\b/);
  return match?.[1]?.toLowerCase() ?? null;
}

export async function POST(request: Request) {
  let supabase: ReturnType<typeof createAdminClient> | null = null;
  let ownerId: string | null = null;

  try {
    const body = searchSchema.parse(await request.json());
    if (isDemoMode()) {
      const searchFocusQuery = queryForClinicalMode(body.query, body.queryMode);
      const queryClass = queryClassForClinicalMode(body.queryMode) ?? classifyRagQuery(searchFocusQuery).queryClass;
      const results = annotateSearchResults(
        searchFocusQuery,
        demoSearch(body.query, body.topK ?? 8, body.documentId, body.documentIds),
      );
      const relevance = buildEvidenceRelevance(searchFocusQuery, results);
      const documentMatches =
        body.mode === "documents"
          ? annotateDocumentMatches(
              searchFocusQuery,
              buildDocumentMatchesFromResults(results, body.documentLimit),
              results,
            )
          : [];
      return NextResponse.json({
        results: compactSearchResults(searchFocusQuery, results),
        facets: buildSearchFacets(results),
        visualEvidence: buildVisualEvidence(results),
        relevance,
        smartPanel: { ...buildSmartPanel(searchFocusQuery, results), relevance },
        smartApiPlan: buildSmartRagApiPlan({
          query: searchFocusQuery,
          queryClass,
          results,
          retrievalStrategy: "hybrid",
          routeMode: body.mode === "documents" ? undefined : "fast",
          preferredResponseMode: body.mode === "documents" ? "document_lookup" : undefined,
        }),
        relatedDocuments: [],
        documentMatches,
        demoMode: true,
      });
    }

    supabase = createAdminClient();
    const user = await serverAuth.requireAuthenticatedUser(request, supabase);
    ownerId = user.id;

    const rateLimit = consumePublicSearchRateLimit(request.headers);
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: "Search is temporarily rate limited because too many requests were received. Retry shortly.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const key = scopedSearchKey(body, ownerId);
    const { payload, coalesced } = await coalesceScopedSearch(key, () =>
      buildScopedSearchPayload(body, supabase!, ownerId!),
    );
    return NextResponse.json({
      ...payload,
      telemetry: {
        ...payload.telemetry,
        coalesced,
      },
    });
  } catch (error) {
    if (error instanceof serverAuth.AuthenticationError) {
      return serverAuth.unauthorizedResponse(error);
    }
    if (error instanceof z.ZodError) {
      return jsonError(error, 400);
    }
    if (error instanceof Error && error.message.trim()) {
      const code = classifySearchFailure(error);
      const failurePayload = {
        results: [],
        telemetry: {
          query_class: classifyRagQuery(error.message).queryClass,
          retrieval_strategy: null,
          failure_code: code,
        },
      };
      if (ownerId && supabase) {
        logSearchObservation({
          supabase,
          ownerId,
          query: "unknown",
          results: [],
          payload: failurePayload,
          failure: {
            code,
            causeName: error.name,
            causeMessage: error.message,
            sqlState: extractSqlState(error),
          },
        });
      }
      return jsonError(
        new PublicApiError("Search failed. Retry with a narrower question.", 500, {
          code,
          causeName: error.name,
          causeMessage: error.message,
          sqlState: extractSqlState(error),
        }),
        500,
      );
    }
    return jsonError(error, 500);
  }
}
