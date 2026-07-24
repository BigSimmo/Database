import { NextResponse } from "next/server";
import { z } from "zod";
import { env, isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import {
  activeIngestionJobColumns,
  buildActiveJobsSafetyResult,
  checkIngestionMutationSafety,
  hasActiveAgentEnrichmentJob,
  ingestionMutationSafetyPayload,
  ingestionRollbackFenceStamp,
  type IngestionJobRow,
} from "@/lib/ingestion-mutation-safety";
import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { isAtomicReindexCandidate } from "@/lib/reindex-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBodyOrDefault } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";

export const runtime = "nodejs";

const reindexModeSchema = z
  .object({
    mode: z.preprocess((value) => (value === "enrichment" ? "enrichment" : "full"), z.enum(["full", "enrichment"])),
  })
  .default({ mode: "full" });
const reindexRouteParamsSchema = z.object({
  id: z.string().uuid(),
});

async function readMode(request: Request) {
  const parsed = await parseJsonBodyOrDefault(request, reindexModeSchema, { mode: "full" });
  return parsed.mode;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode()) return NextResponse.json({ error: "Reindex is unavailable in demo mode." }, { status: 400 });

    const { id: rawId } = await params;
    const { id } = parseRouteParams({ id: rawId }, reindexRouteParamsSchema, "Invalid document id.");
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase, { administrator: true });
    const mode = await readMode(request);
    const rateLimit = await consumeApiRateLimit({ supabase, ownerId: user.id, bucket: "document_reindex" });
    if (rateLimit.limited)
      return rateLimitJsonResponse("Too many document reindex requests. Retry shortly.", rateLimit);

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select(
        "id,owner_id,title,file_name,source_path,import_batch_id,status,error_message,page_count,chunk_count,image_count,metadata",
      )
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

    if (
      mode !== "enrichment" &&
      (await hasActiveAgentEnrichmentJob({
        supabase,
        documentId: id,
        staleAfterMinutes: env.WORKER_STALE_AFTER_MINUTES,
      }))
    ) {
      return NextResponse.json(
        { error: "Document has active agent enrichment work. Wait for it to finish before reindexing." },
        { status: 409 },
      );
    }

    if (mode === "enrichment") {
      const { data: queued, error: queueError } = await supabase.rpc("request_indexing_v3_enrichment", {
        p_document_id: id,
        p_owner_id: user.id,
      });
      if (queueError) {
        return NextResponse.json(
          { error: "Enrichment is already active or could not be queued safely." },
          { status: 409 },
        );
      }
      return NextResponse.json({ mode, queued }, { status: 202 });
    }

    const atomicReindex = isAtomicReindexCandidate(document);
    // Rollback fence: the queue-state write stamps updated_at with a
    // per-request value and the rollback below matches on that stamp, making
    // it a single conditional UPDATE that is atomic server-side. An
    // overlapping reindex/retry re-stamps the row before enqueueing its own
    // job, so a stale rollback from this request matches zero rows instead of
    // reverting the newer queue state. The competing-job SELECT below is only
    // a cheap fast path; the fence is what closes the check-then-write race.
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

    if (jobError) {
      // A concurrent transactional delete holds the parent row lock while it
      // removes the document. Once deletion commits, the FK check for this job
      // fails with 23503. That is a normal lifecycle conflict, not a server
      // fault, and there is no surviving document state to roll back.
      if (jobError.code === "23503") {
        return NextResponse.json(
          { error: "Document was deleted while reindexing. Refresh the document list and retry." },
          { status: 409 },
        );
      }
      // R17: a unique index on ingestion_jobs(document_id) where status in
      // (pending,processing) can reject this insert with 23505 when a
      // concurrent request won the race between the pre-check above and this
      // insert. That is the same "already queued" condition the pre-check
      // reports, so surface it the same way (409, not a raw constraint 500).
      if (jobError.code === "23505") {
        const { data: raceJobs, error: raceJobsError } = await supabase
          .from("ingestion_jobs")
          .select(activeIngestionJobColumns)
          .eq("document_id", id)
          .in("status", ["pending", "processing"]);
        if (!raceJobsError && (raceJobs?.length ?? 0) > 0) {
          const safety = buildActiveJobsSafetyResult(
            raceJobs as IngestionJobRow[],
            env.WORKER_STALE_AFTER_MINUTES,
            new Date().toISOString(),
          );
          return NextResponse.json(ingestionMutationSafetyPayload(safety), { status: 409 });
        }
      }
      const { data: competingJobs, error: competingJobsError } = await supabase
        .from("ingestion_jobs")
        .select("id")
        .eq("document_id", id)
        .in("status", ["pending", "processing"])
        .limit(1);
      if (competingJobsError) {
        throw new Error(
          `Failed to enqueue reindex job: ${jobError.message}; competing-job check failed: ${competingJobsError.message}`,
        );
      }
      if ((competingJobs?.length ?? 0) === 0) {
        const { error: rollbackError } = await supabase
          .from("documents")
          .update(rollbackDocumentPayload)
          .eq("id", id)
          .eq("owner_id", user.id)
          .eq("updated_at", rollbackFence);
        if (rollbackError) {
          throw new Error(
            `Failed to enqueue reindex job: ${jobError.message}; rollback failed: ${rollbackError.message}`,
          );
        }
      }
      throw new Error(jobError.message);
    }
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
