import { NextResponse } from "next/server";
import { z } from "zod";
import { env, isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { ingestionJobRetryRejectionReason } from "@/lib/ingestion";
import { ingestionRollbackFenceStamp } from "@/lib/ingestion-mutation-safety";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRouteParams } from "@/lib/validation/params";

export const runtime = "nodejs";

const ingestionRetryRouteParamsSchema = z.object({
  id: z.string().uuid(),
});
const ingestionRetryResultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("not_found") }),
  z.object({ outcome: z.literal("completed") }),
  z.object({ outcome: z.literal("active_worker") }),
  z.object({ outcome: z.literal("queued"), job: z.object({}).passthrough() }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode())
      return publicErrorResponse("Retry is unavailable in demo mode.", 400, { code: "demo_mode_unavailable" });

    const { id: rawId } = await params;
    const { id } = parseRouteParams({ id: rawId }, ingestionRetryRouteParamsSchema, "Invalid ingestion job id.");
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase, { administrator: true });

    const staleThreshold = new Date(Date.now() - env.WORKER_STALE_AFTER_MINUTES * 60_000).toISOString();
    const resetNextRunAt = ingestionRollbackFenceStamp();
    const { data, error } = await supabase.rpc("retry_ingestion_job_if_idle", {
      p_job_id: id,
      p_owner_id: user.id,
      p_stale_before: staleThreshold,
      p_max_attempts: env.WORKER_MAX_ATTEMPTS,
      p_next_run_at: resetNextRunAt,
      p_document_updated_at: ingestionRollbackFenceStamp(),
    });
    if (error) throw new Error(error.message);

    const parsed = ingestionRetryResultSchema.safeParse(data);
    if (!parsed.success) throw new Error("retry_ingestion_job_if_idle returned an invalid result.");
    if (parsed.data.outcome === "not_found") {
      return publicErrorResponse("Ingestion job not found.", 404, { code: "ingestion_job_not_found" });
    }
    if (parsed.data.outcome === "completed") {
      return publicErrorResponse(
        ingestionJobRetryRejectionReason("completed") ?? "Completed ingestion jobs cannot be retried.",
        409,
        { code: "ingestion_job_completed" },
      );
    }
    if (parsed.data.outcome === "active_worker") {
      return publicErrorResponse(
        "This job is still being processed by a worker. Wait for it to finish or go stale before retrying.",
        409,
        { code: "ingestion_job_active" },
      );
    }

    return NextResponse.json({ job: parsed.data.job });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
