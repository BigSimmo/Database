import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env, isDemoMode } from "@/lib/env";
import { upsertDocumentEnrichment } from "@/lib/document-enrichment";
import { upsertDocumentDeepMemory } from "@/lib/deep-memory";
import { jsonError } from "@/lib/http";
import { checkIngestionMutationSafety, ingestionMutationSafetyPayload } from "@/lib/ingestion-mutation-safety";
import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import {
  committedIndexGeneration,
  isAtomicReindexCandidate,
  isCommittedGenerationMetadata,
} from "@/lib/reindex-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBodyOrDefault } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";

export const runtime = "nodejs";

const reindexPageSize = 1000;
const reindexModeSchema = z
  .object({
    mode: z.preprocess((value) => (value === "enrichment" ? "enrichment" : "full"), z.enum(["full", "enrichment"])),
  })
  .default({ mode: "full" });
const reindexRouteParamsSchema = z.object({
  id: z.string().uuid(),
});

type ReindexChunk = {
  id: string;
  document_id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  content: string;
  image_ids?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

type ReindexImage = {
  id: string;
  page_number: number | null;
  caption: string | null;
  image_type: string | null;
  labels?: string[] | null;
  source_kind?: string | null;
  clinical_relevance_score?: number | null;
  metadata?: Record<string, unknown> | null;
};

function committedReindexRows<T extends { metadata?: unknown }>(document: { metadata?: unknown }, rows: T[]) {
  const committedGeneration = committedIndexGeneration(document.metadata);
  return rows.filter((row) =>
    isCommittedGenerationMetadata({
      rowMetadata: row.metadata,
      committedGeneration,
    }),
  );
}

async function readMode(request: Request) {
  const parsed = await parseJsonBodyOrDefault(request, reindexModeSchema, { mode: "full" });
  return parsed.mode;
}

async function selectReindexRowsInPages<T>(args: {
  supabase: ReturnType<typeof createAdminClient>;
  table: "document_chunks" | "document_images";
  select: string;
  documentId: string;
  searchableOnly?: boolean;
}) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += reindexPageSize) {
    // Dynamic table/select strings need the untyped client surface.
    let query = (args.supabase as unknown as SupabaseClient)
      .from(args.table)
      .select(args.select)
      .eq("document_id", args.documentId);
    if (args.searchableOnly) query = query.eq("searchable", true);
    const { data, error } = await query.range(offset, offset + reindexPageSize - 1);
    if (error) throw new Error(error.message);

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < reindexPageSize) break;
  }
  return rows;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode()) return NextResponse.json({ error: "Reindex is unavailable in demo mode." }, { status: 400 });

    const { id: rawId } = await params;
    const { id } = parseRouteParams({ id: rawId }, reindexRouteParamsSchema, "Invalid document id.");
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const mode = await readMode(request);
    const rateLimit = await consumeApiRateLimit({ supabase, ownerId: user.id, bucket: "document_reindex" });
    if (rateLimit.limited)
      return rateLimitJsonResponse("Too many document reindex requests. Retry shortly.", rateLimit);

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id,owner_id,title,file_name,source_path,import_batch_id,status,metadata")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (documentError) throw new Error(documentError.message);
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const safety = await checkIngestionMutationSafety({
      supabase,
      documentIds: [id],
      action: "Reindex",
      checkActiveJobs: true,
      staleAfterMinutes: env.WORKER_STALE_AFTER_MINUTES,
    });
    if (!safety.ok) return NextResponse.json(ingestionMutationSafetyPayload(safety), { status: safety.status });

    if (mode === "enrichment") {
      const [chunks, images] = await Promise.all([
        selectReindexRowsInPages<ReindexChunk>({
          supabase,
          table: "document_chunks",
          select: "id,document_id,page_number,chunk_index,section_heading,content,image_ids,metadata",
          documentId: id,
        }),
        selectReindexRowsInPages<ReindexImage>({
          supabase,
          table: "document_images",
          select: "id,page_number,caption,image_type,labels,source_kind,clinical_relevance_score,metadata",
          documentId: id,
          searchableOnly: true,
        }),
      ]);

      const committedChunks = committedReindexRows(document, chunks);
      const committedImages = committedReindexRows(document, images);

      committedChunks.sort((a, b) => Number(a.chunk_index ?? 0) - Number(b.chunk_index ?? 0));
      committedImages.sort((a, b) => Number(b.clinical_relevance_score ?? 0) - Number(a.clinical_relevance_score ?? 0));

      if (!committedChunks.length) {
        return NextResponse.json({ error: "Document has no indexed chunks to enrich." }, { status: 400 });
      }

      const enrichment = await upsertDocumentEnrichment({
        supabase,
        document: document as Parameters<typeof upsertDocumentEnrichment>[0]["document"],
        chunks: committedChunks,
        images: committedImages,
      });
      const deepMemory = await upsertDocumentDeepMemory({
        supabase,
        document: document as Parameters<typeof upsertDocumentDeepMemory>[0]["document"],
        chunks: committedChunks,
        images: committedImages,
        summary: enrichment.summary.summary,
      });
      return NextResponse.json({
        mode,
        enrichment,
        deepMemory: {
          sectionCount: deepMemory.sections.length,
          memoryCardCount: deepMemory.memoryCards.length,
          indexUnitCount: deepMemory.indexUnits.length,
        },
      });
    }

    const atomicReindex = isAtomicReindexCandidate(document);
    const { error: updateError } = await supabase
      .from("documents")
      .update(
        atomicReindex
          ? { error_message: null }
          : { status: "queued", error_message: null, page_count: 0, chunk_count: 0, image_count: 0 },
      )
      .eq("id", id)
      .eq("owner_id", user.id);
    if (updateError) throw new Error(updateError.message);

    const { data: job, error: jobError } = await supabase
      .from("ingestion_jobs")
      .insert({
        document_id: id,
        batch_id: document.import_batch_id ?? null,
        status: "pending",
        stage: "queued",
        progress: 0,
        max_attempts: env.WORKER_MAX_ATTEMPTS,
      })
      .select()
      .single();

    if (jobError) throw new Error(jobError.message);
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error, 400);
  }
}
