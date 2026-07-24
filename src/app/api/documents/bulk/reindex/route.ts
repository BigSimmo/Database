import { NextResponse } from "next/server";
import { z } from "zod";
import { env, isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import {
  activeIngestionJobColumns,
  buildActiveJobsSafetyResult,
  checkIngestionMutationSafety,
  ingestionMutationSafetyPayload,
  ingestionRollbackFenceStamp,
  listDocumentsWithActiveAgentEnrichment,
  type IngestionJobRow,
} from "@/lib/ingestion-mutation-safety";
import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { invalidateRagCachesForOwner } from "@/lib/rag/rag";
import { isAtomicReindexCandidate } from "@/lib/reindex-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

const bulkReindexSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(10),
  mode: z.enum(["enrichment", "full", "retry_failed"]).default("enrichment"),
});

export async function POST(request: Request) {
  try {
    if (isDemoMode()) return NextResponse.json({ error: "Bulk reindex is unavailable in demo mode." }, { status: 400 });

    const parsed = await parseJsonBody(request, bulkReindexSchema, "Bulk reindex payload is invalid.");

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase, { administrator: true });
    const rateLimit = await consumeApiRateLimit({ supabase, ownerId: user.id, bucket: "bulk_reindex" });
    if (rateLimit.limited) return rateLimitJsonResponse("Too many bulk reindex requests. Retry shortly.", rateLimit);

    const documentIds = Array.from(new Set(parsed.documentIds));
    const { data: documents, error: documentError } = await supabase
      .from("documents")
      .select(
        "id,owner_id,title,file_name,source_path,import_batch_id,status,error_message,page_count,chunk_count,image_count,metadata",
      )
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

    // Preflight conflict (same all-or-nothing shape as active ingestion jobs):
    // full/retry rebuilds clash with a live agent enrichment pass. Enrichment
    // mode is unchanged and uses its own RPC guard.
    if (parsed.mode !== "enrichment") {
      const blockedDocumentIds = await listDocumentsWithActiveAgentEnrichment({
        supabase,
        documentIds: documents.map((document) => document.id),
        staleAfterMinutes: env.WORKER_STALE_AFTER_MINUTES,
      });
      if (blockedDocumentIds.length > 0) {
        return NextResponse.json(
          {
            error: "Bulk reindex is paused while enrichment is active for one or more selected documents.",
            blockedDocumentIds,
          },
          { status: 409 },
        );
      }
    }

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
          const { data: queued, error: queueError } = await supabase.rpc("request_indexing_v3_enrichment", {
            p_document_id: document.id,
            p_owner_id: user.id,
          });
          if (queueError) throw new Error("Enrichment is already active or could not be queued safely.");
          results.push({
            documentId: document.id,
            mode: parsed.mode,
            ok: true,
            jobId: queued && typeof queued === "object" && "job_id" in queued ? String(queued.job_id ?? "") : undefined,
          });
          continue;
        }

        const atomicReindex = isAtomicReindexCandidate(document);
        // Rollback fence: same pattern as the single-document reindex route —
        // the queue-state write stamps updated_at and the rollback matches on
        // the stamp, so a stale rollback cannot revert a newer queue state
        // written by an overlapping reindex/retry. The competing-job SELECT is
        // only a fast path; the fence closes the check-then-write race.
        const rollbackFence = ingestionRollbackFenceStamp();
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
              ? { error_message: null, updated_at: rollbackFence }
              : {
                  status: "queued",
                  error_message: null,
                  page_count: 0,
                  chunk_count: 0,
                  image_count: 0,
                  updated_at: rollbackFence,
                },
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
          if (jobError.code === "23503") {
            throw new Error("Document was deleted while reindexing. Refresh the document list and retry.");
          }
          // R17: same race as the single-document reindex route — a unique
          // index on ingestion_jobs(document_id) where status in
          // (pending,processing) can reject this insert with 23505 when a
          // concurrent request won the race after the pre-check ran. Surface
          // the friendly "already queued" message instead of the raw
          // constraint-violation text.
          if (jobError.code === "23505") {
            const { data: raceJobs, error: raceJobsError } = await supabase
              .from("ingestion_jobs")
              .select(activeIngestionJobColumns)
              .eq("document_id", document.id)
              .in("status", ["pending", "processing"]);
            if (!raceJobsError && (raceJobs?.length ?? 0) > 0) {
              const safety = buildActiveJobsSafetyResult(
                raceJobs as IngestionJobRow[],
                env.WORKER_STALE_AFTER_MINUTES,
                new Date().toISOString(),
              );
              throw new Error(safety.message);
            }
          }
          const { data: competingJobs, error: competingJobsError } = await supabase
            .from("ingestion_jobs")
            .select("id")
            .eq("document_id", document.id)
            .in("status", ["pending", "processing"])
            .limit(1);
          if (competingJobsError) {
            throw new Error(
              `Failed to enqueue bulk reindex job: ${jobError.message}; competing-job check failed: ${competingJobsError.message}`,
            );
          }
          if ((competingJobs?.length ?? 0) === 0) {
            const { error: rollbackError } = await supabase
              .from("documents")
              .update(rollbackDocumentPayload)
              .eq("id", document.id)
              .eq("owner_id", user.id)
              .eq("updated_at", rollbackFence);
            if (rollbackError) {
              throw new Error(
                `Failed to enqueue bulk reindex job: ${jobError.message}; rollback failed: ${rollbackError.message}`,
              );
            }
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
    const missingDocumentIds = documentIds.filter((id) => !documents.some((document) => document.id === id));
    return NextResponse.json({
      ok: missingDocumentIds.length === 0 && results.every((result) => result.ok),
      results,
      missingDocumentIds,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    if (error instanceof PublicApiError) return jsonError(error, error.status);
    return jsonError(error, 500);
  }
}
