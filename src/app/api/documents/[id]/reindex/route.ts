import { NextResponse } from "next/server";
import { z } from "zod";
import { env, isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import {
  activeIngestionJobColumns,
  buildActiveJobsSafetyResult,
  checkIngestionMutationSafety,
  hasActiveAgentEnrichmentJob,
  ingestionMutationSafetyPayload,
  type IngestionJobRow,
} from "@/lib/ingestion-mutation-safety";
import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
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
const reindexRequestResultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("not_found") }),
  z.object({ outcome: z.literal("agent_enrichment_active") }),
  z.object({ outcome: z.literal("ingestion_active") }),
  z.object({ outcome: z.literal("queued"), job: z.object({ id: z.string() }).passthrough() }),
]);

async function readMode(request: Request) {
  const parsed = await parseJsonBodyOrDefault(request, reindexModeSchema, { mode: "full" });
  return parsed.mode;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode())
      return publicErrorResponse("Reindex is unavailable in demo mode.", 400, { code: "demo_mode_unavailable" });

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
    if (!document) return publicErrorResponse("Document not found.", 404, { code: "document_not_found" });

    const safety = await checkIngestionMutationSafety({
      supabase,
      documentIds: [id],
      action: "Reindex",
      checkActiveJobs: true,
      checkActiveAgentEnrichmentJobs: mode !== "enrichment",
      staleAfterMinutes: env.WORKER_STALE_AFTER_MINUTES,
    });
    if (!safety.ok) return NextResponse.json(ingestionMutationSafetyPayload(safety), { status: safety.status });

    // Full reindex deletes/rebuilds the same enrichment artifact families the
    // agent writes. Block only while a fresh agent lease is live; enrichment
    // mode keeps its own RPC concurrency (`request_indexing_v3_enrichment`).
    if (mode !== "enrichment") {
      const enrichmentActive = await hasActiveAgentEnrichmentJob({
        supabase,
        documentId: id,
        staleAfterMinutes: env.WORKER_STALE_AFTER_MINUTES,
      });
      if (enrichmentActive) {
        return publicErrorResponse("Reindex is paused while enrichment is active.", 409, { code: "enrichment_active" });
      }
    }

    if (mode === "enrichment") {
      const { data: queued, error: queueError } = await supabase.rpc("request_indexing_v3_enrichment", {
        p_document_id: id,
        p_owner_id: user.id,
      });
      if (queueError) {
        return publicErrorResponse("Enrichment is already active or could not be queued safely.", 409, {
          code: "enrichment_queue_conflict",
        });
      }
      return NextResponse.json({ mode, queued }, { status: 202 });
    }

    const staleBefore = new Date(Date.now() - env.WORKER_STALE_AFTER_MINUTES * 60_000).toISOString();
    const { data: reindexResult, error: reindexError } = await supabase.rpc("request_ingestion_reindex_if_agent_idle", {
      p_document_id: id,
      p_owner_id: user.id,
      p_stale_before: staleBefore,
      p_max_attempts: env.WORKER_MAX_ATTEMPTS,
    });
    if (reindexError) throw new Error(reindexError.message);

    const parsedResult = reindexRequestResultSchema.safeParse(reindexResult);
    if (!parsedResult.success) throw new Error("request_ingestion_reindex_if_agent_idle returned an invalid result.");
    if (parsedResult.data.outcome === "not_found") {
      return publicErrorResponse("Document was deleted while reindexing. Refresh the document list and retry.", 409, {
        code: "document_deleted_during_reindex",
      });
    }
    if (parsedResult.data.outcome === "agent_enrichment_active") {
      return publicErrorResponse(
        "Document has active agent enrichment work. Wait for it to finish before reindexing.",
        409,
        { code: "enrichment_active" },
      );
    }
    if (parsedResult.data.outcome === "ingestion_active") {
      const { data: competingJobs, error: competingJobsError } = await supabase
        .from("ingestion_jobs")
        .select(activeIngestionJobColumns)
        .eq("document_id", id)
        .in("status", ["pending", "processing"]);
      if (competingJobsError) {
        throw new Error(`Atomic reindex found competing work but could not load it: ${competingJobsError.message}`);
      }
      if ((competingJobs?.length ?? 0) > 0) {
        const safety = buildActiveJobsSafetyResult(
          competingJobs as IngestionJobRow[],
          env.WORKER_STALE_AFTER_MINUTES,
          new Date().toISOString(),
        );
        return NextResponse.json(ingestionMutationSafetyPayload(safety), { status: 409 });
      }
      return publicErrorResponse("Document already has active indexing work.", 409, { code: "indexing_active" });
    }
    return NextResponse.json({ job: parsedResult.data.job }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
