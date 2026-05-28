import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSearch } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { buildSmartPanel, buildVisualEvidence, diversifySearchResults } from "@/lib/evidence";
import { fetchRelatedDocuments } from "@/lib/document-enrichment";
import { jsonError } from "@/lib/http";
import { searchChunksWithTelemetry } from "@/lib/rag";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const searchSchema = z.object({
  query: z.string().trim().min(2),
  topK: z.number().int().min(1).max(20).optional(),
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(25).optional(),
  includeRelatedDocuments: z.boolean().optional().default(true),
});

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
        demoMode: true,
      });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const search = await searchChunksWithTelemetry({
      query: body.query,
      topK: body.topK ?? 8,
      documentId: body.documentId,
      documentIds: body.documentIds,
      ownerId: user.id,
    });
    const results = diversifySearchResults(search.results, body.topK ?? 8);

    const relatedDocuments = body.includeRelatedDocuments
      ? await fetchRelatedDocuments({
          supabase,
          ownerId: user.id,
          query: body.query,
          results,
        })
      : [];
    const smartPanel = buildSmartPanel(body.query, results);

    return NextResponse.json({
      results,
      visualEvidence: buildVisualEvidence(results),
      relatedDocuments,
      smartPanel: { ...smartPanel, relatedDocuments },
      telemetry: {
        retrieval_strategy: search.telemetry.retrieval_strategy,
        search_cache_hit: search.telemetry.search_cache_hit,
        embedding_skipped: search.telemetry.embedding_skipped,
        embedding_cache_hit: search.telemetry.embedding_cache_hit,
        text_fast_path_latency_ms: search.telemetry.text_fast_path_latency_ms,
        embedding_latency_ms: search.telemetry.embedding_latency_ms,
        supabase_rpc_latency_ms: search.telemetry.supabase_rpc_latency_ms,
        rerank_latency_ms: search.telemetry.rerank_latency_ms,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error, 400);
  }
}
