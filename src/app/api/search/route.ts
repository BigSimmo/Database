import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSearch } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { buildSmartPanel, buildVisualEvidence, diversifySearchResults } from "@/lib/evidence";
import { fetchRelatedDocuments, toDocumentMatch } from "@/lib/document-enrichment";
import { jsonError, PublicApiError } from "@/lib/http";
import { isClinicalImageEvidence } from "@/lib/image-filtering";
import { searchChunksWithTelemetry } from "@/lib/rag";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const searchSchema = z.object({
  query: z.string().trim().min(1),
  topK: z.number().int().min(1).max(20).optional(),
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(25).optional(),
  mode: z.enum(["answer", "documents"]).optional().default("answer"),
  documentLimit: z.number().int().min(1).max(50).optional().default(20),
  includeRelatedDocuments: z.boolean().optional().default(true),
});

function buildDocumentMatchesFromResults(results: Awaited<ReturnType<typeof demoSearch>>, limit: number) {
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

export async function POST(request: Request) {
  try {
    const body = searchSchema.parse(await request.json());
    if (isDemoMode()) {
      const results = demoSearch(body.query, body.topK ?? 8, body.documentId, body.documentIds);
      return NextResponse.json({
        results,
        visualEvidence: buildVisualEvidence(results),
        smartPanel: buildSmartPanel(body.query, results),
        relatedDocuments: [],
        documentMatches: body.mode === "documents" ? buildDocumentMatchesFromResults(results, body.documentLimit) : [],
        demoMode: true,
      });
    }

    const supabase = createAdminClient();
    const search = await searchChunksWithTelemetry({
      query: body.query,
      topK: body.mode === "documents" ? Math.max(body.topK ?? 12, Math.min(20, body.documentLimit)) : (body.topK ?? 8),
      documentId: body.documentId,
      documentIds: body.documentIds,
      ownerId: undefined,
    });
    const resultLimit =
      body.mode === "documents" ? Math.max(body.topK ?? 12, Math.min(20, body.documentLimit)) : (body.topK ?? 8);
    const results = diversifySearchResults(search.results, resultLimit, 4, true);

    const relatedDocuments = body.includeRelatedDocuments
      ? await fetchRelatedDocuments({
          supabase,
          ownerId: undefined,
          query: body.query,
          results,
          limit: body.mode === "documents" ? body.documentLimit : undefined,
        })
      : [];
    const smartPanel = buildSmartPanel(body.query, results);
    const documentMatches = body.mode === "documents" ? relatedDocuments.map(toDocumentMatch) : [];

    return NextResponse.json({
      results,
      visualEvidence: buildVisualEvidence(results),
      relatedDocuments,
      documentMatches,
      smartPanel: { ...smartPanel, relatedDocuments },
      telemetry: {
        query_class: search.telemetry.query_class,
        retrieval_strategy: search.telemetry.retrieval_strategy,
        search_cache_hit: search.telemetry.search_cache_hit,
        embedding_skipped: search.telemetry.embedding_skipped,
        embedding_cache_hit: search.telemetry.embedding_cache_hit,
        text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
        embedding_latency_ms: search.telemetry.embedding_latency_ms,
        supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
        rerank_latency_ms: search.telemetry.rerank_latency_ms,
        memory_card_count: search.telemetry.memory_card_count,
        memory_top_score: search.telemetry.memory_top_score,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error, 400);
    }
    if (error instanceof Error && error.message.trim()) {
      return jsonError(
        new PublicApiError("Search failed. Retry with a narrower question.", 500, { code: error.name }),
        500,
      );
    }
    return jsonError(error, 500);
  }
}
