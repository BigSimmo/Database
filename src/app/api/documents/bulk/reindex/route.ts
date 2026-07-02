import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertDocumentDeepMemory } from "@/lib/deep-memory";
import { upsertDocumentEnrichment } from "@/lib/document-enrichment";
import { env, isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { checkIngestionMutationSafety, ingestionMutationSafetyPayload } from "@/lib/ingestion-mutation-safety";
import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { invalidateRagCachesForOwner } from "@/lib/rag";
import {
  committedIndexGeneration,
  isAtomicReindexCandidate,
  isCommittedGenerationMetadata,
} from "@/lib/reindex-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

const bulkReindexSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(10),
  mode: z.enum(["enrichment", "full", "retry_failed"]).default("enrichment"),
});

const pageSize = 1000;

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

async function selectRowsInPages<T>(args: {
  supabase: ReturnType<typeof createAdminClient>;
  table: "document_chunks" | "document_images";
  select: string;
  documentId: string;
  searchableOnly?: boolean;
}) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const query =
      args.table === "document_images" && args.searchableOnly
        ? args.supabase.from("document_images").select(args.select).eq("document_id", args.documentId).eq("searchable", true)
        : args.supabase.from(args.table).select(args.select).eq("document_id", args.documentId);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) return NextResponse.json({ error: "Bulk reindex is unavailable in demo mode." }, { status: 400 });

    const parsed = await parseJsonBody(request, bulkReindexSchema, "Bulk reindex payload is invalid.");

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const rateLimit = await consumeApiRateLimit({ supabase, ownerId: user.id, bucket: "bulk_reindex" });
    if (rateLimit.limited) return rateLimitJsonResponse("Too many bulk reindex requests. Retry shortly.", rateLimit);

    const documentIds = Array.from(new Set(parsed.documentIds));
    const { data: documents, error: documentError } = await supabase
      .from("documents")
      .select("id,owner_id,title,file_name,source_path,import_batch_id,status,error_message,page_count,chunk_count,image_count,metadata")
      .eq("owner_id", user.id)
      .in("id", documentIds);
    if (documentError) throw new Error(documentError.message);
    if (!documents?.length) return NextResponse.json({ error: "No selected documents were found." }, { status: 404 });

    const safety = await checkIngestionMutationSafety({
      supabase,
      documentIds: documents.map((document) => document.id),
      action: "Bulk reindex",
      checkActiveJobs: true,
      staleAfterMinutes: env.WORKER_STALE_AFTER_MINUTES,
    });
    if (!safety.ok) return NextResponse.json(ingestionMutationSafetyPayload(safety), { status: safety.status });

    const results: Array<{ documentId: string; mode: string; ok: boolean; jobId?: string; error?: string }> = [];

    for (const document of documents) {
      try {
        if (parsed.mode === "retry_failed" && document.status !== "failed") {
          results.push({
            documentId: document.id,
            mode: parsed.mode,
            ok: false,
            error: "Document is not failed.",
          });
          continue;
        }

        if (parsed.mode === "enrichment") {
          const [chunks, images] = await Promise.all([
            selectRowsInPages<ReindexChunk>({
              supabase,
              table: "document_chunks",
              select: "id,document_id,page_number,chunk_index,section_heading,content,image_ids,metadata",
              documentId: document.id,
            }),
            selectRowsInPages<ReindexImage>({
              supabase,
              table: "document_images",
              select: "id,page_number,caption,image_type,labels,source_kind,clinical_relevance_score,metadata",
              documentId: document.id,
              searchableOnly: true,
            }),
          ]);
          const committedChunks = committedReindexRows(document, chunks);
          const committedImages = committedReindexRows(document, images);
          if (!committedChunks.length) throw new Error("Document has no indexed chunks to enrich.");
          committedChunks.sort((a, b) => Number(a.chunk_index ?? 0) - Number(b.chunk_index ?? 0));
          committedImages.sort(
            (a, b) => Number(b.clinical_relevance_score ?? 0) - Number(a.clinical_relevance_score ?? 0),
          );
          const enrichment = await upsertDocumentEnrichment({
            supabase,
            document,
            chunks: committedChunks,
            images: committedImages,
          });
          const memory = await upsertDocumentDeepMemory({
            supabase,
            document,
            chunks: committedChunks,
            images: committedImages,
            summary: enrichment.summary.summary,
          });
          results.push({
            documentId: document.id,
            mode: parsed.mode,
            ok: true,
            jobId: `${enrichment.labels.length}:${memory.memoryCards.length}:${memory.indexUnits.length}`,
          });
          continue;
        }

        const atomicReindex = isAtomicReindexCandidate(document);
        const rollbackDocumentPayload = atomicReindex
          ? { error_message: document.error_message ?? null }
          : {
              status: document.status ?? null,
              error_message: document.error_message ?? null,
              page_count: document.page_count ?? 0,
              chunk_count: document.chunk_count ?? 0,
              image_count: document.image_count ?? 0,
            };
        const { error: updateError } = await supabase
          .from("documents")
          .update(
            atomicReindex
              ? { error_message: null }
              : { status: "queued", error_message: null, page_count: 0, chunk_count: 0, image_count: 0 },
          )
          .eq("id", document.id)
          .eq("owner_id", user.id);
        if (updateError) throw new Error(updateError.message);
        const { data: job, error: jobError } = await supabase
          .from("ingestion_jobs")
          .insert({
            document_id: document.id,
            batch_id: document.import_batch_id ?? null,
            status: "pending",
            stage: "queued",
            progress: 0,
            max_attempts: env.WORKER_MAX_ATTEMPTS,
          })
          .select("id")
          .single();
        if (jobError) {
          const { error: rollbackError } = await supabase
            .from("documents")
            .update(rollbackDocumentPayload)
            .eq("id", document.id)
            .eq("owner_id", user.id);
          if (rollbackError) {
            throw new Error(`Failed to enqueue bulk reindex job: ${jobError.message}; rollback failed: ${rollbackError.message}`);
          }
          throw new Error(jobError.message);
        }
        results.push({ documentId: document.id, mode: parsed.mode, ok: true, jobId: job.id });
      } catch (error) {
        results.push({
          documentId: document.id,
          mode: parsed.mode,
          ok: false,
          error: error instanceof Error ? error.message : "Reindex failed.",
        });
      }
    }

    invalidateRagCachesForOwner(user.id);
    return NextResponse.json({
      ok: results.every((result) => result.ok),
      results,
      missingDocumentIds: documentIds.filter((id) => !documents.some((document) => document.id === id)),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    if (error instanceof PublicApiError) return jsonError(error, error.status);
    return jsonError(error, 500);
  }
}
