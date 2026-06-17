import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode()) return NextResponse.json({ error: "Retry is unavailable in demo mode." }, { status: 400 });

    const { id } = await params;
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);

    const { data: job, error: jobError } = await supabase
      .from("ingestion_jobs")
      .select("id,document_id,batch_id,status,locked_at,documents!inner(owner_id)")
      .eq("id", id)
      .eq("documents.owner_id", user.id)
      .maybeSingle();

    if (jobError) throw new Error(jobError.message);
    if (!job) return NextResponse.json({ error: "Ingestion job not found." }, { status: 404 });

    // IDX-C3: refuse to retry a job a live worker still holds. The claim RPC uses
    // SKIP LOCKED + stale recovery; resetting here while status='processing' with a fresh
    // lock would make the row claimable by a second worker, so two runs would insert against
    // the same document_id concurrently and interleave mixed-generation clinical chunks.
    if (job.status === "processing" && job.locked_at) {
      const lockedAtMs = new Date(job.locked_at).getTime();
      const staleAfterMs = env.WORKER_STALE_AFTER_MINUTES * 60_000;
      const lockIsFresh = Number.isFinite(lockedAtMs) && Date.now() - lockedAtMs < staleAfterMs;
      if (lockIsFresh) {
        return NextResponse.json(
          {
            error:
              "This job is still being processed by a worker. Wait for it to finish or go stale before retrying.",
          },
          { status: 409 },
        );
      }
    }

    // IDX-H1: do NOT reset the document index here. The worker calls resetDocumentIndex at
    // job start (worker/main.ts), so resetting before enqueue would leave a previously-good
    // clinical document with zero index if the worker never runs or fails permanently. We
    // only re-queue; the prior index stays live until the worker commits a fresh one.
    const { error: documentError } = await supabase
      .from("documents")
      .update({ status: "queued", error_message: null })
      .eq("id", job.document_id)
      .eq("owner_id", user.id);
    if (documentError) throw new Error(documentError.message);

    const { data, error } = await supabase
      .from("ingestion_jobs")
      .update({
        status: "pending",
        stage: "queued",
        progress: 0,
        error_message: null,
        attempt_count: 0,
        max_attempts: env.WORKER_MAX_ATTEMPTS,
        locked_at: null,
        locked_by: null,
        next_run_at: new Date().toISOString(),
        completed_at: null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ job: data });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error, 400);
  }
}
