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
      .select(
        "id,document_id,batch_id,status,stage,progress,error_message,attempt_count,max_attempts,locked_at,locked_by,next_run_at,completed_at,documents!inner(owner_id)",
      )
      .eq("id", id)
      .eq("documents.owner_id", user.id)
      .maybeSingle();

    if (jobError) throw new Error(jobError.message);
    if (!job) return NextResponse.json({ error: "Ingestion job not found." }, { status: 404 });

    // IDX-C3 / B6: refuse to retry a job a live worker still holds, atomically.
    // A SELECT-then-UPDATE was a TOCTOU race: a worker could claim the job
    // between the read and the write, and the unguarded UPDATE would silently
    // reset the row the worker is processing → two workers ingest the same
    // document_id and interleave mixed-generation clinical chunks. We instead
    // make the reset a single conditional UPDATE whose WHERE clause refuses to
    // touch a row that is freshly 'processing'. The reset only applies when the
    // job is NOT processing, OR its lock is already stale, OR it has no lock.
    const staleThreshold = new Date(Date.now() - env.WORKER_STALE_AFTER_MINUTES * 60_000).toISOString();

    const nextRunAt = new Date().toISOString();
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
        next_run_at: nextRunAt,
        completed_at: null,
      })
      .eq("id", id)
      .or(`status.neq.processing,locked_at.is.null,locked_at.lt.${staleThreshold}`)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    // 0 rows affected means the guard rejected the reset: the job is actively
    // being processed with a fresh lock. Refuse rather than clobber it.
    if (!data) {
      return NextResponse.json(
        {
          error: "This job is still being processed by a worker. Wait for it to finish or go stale before retrying.",
        },
        { status: 409 },
      );
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
    if (documentError) {
      const { error: rollbackError } = await supabase
        .from("ingestion_jobs")
        .update({
          status: job.status,
          stage: job.stage,
          progress: job.progress,
          error_message: job.error_message,
          attempt_count: job.attempt_count,
          max_attempts: job.max_attempts,
          locked_at: job.locked_at,
          locked_by: job.locked_by,
          next_run_at: job.next_run_at,
          completed_at: job.completed_at,
        })
        .eq("id", id)
        .eq("status", "pending")
        .eq("stage", "queued")
        .eq("progress", 0)
        .eq("attempt_count", 0)
        .is("locked_at", null)
        .is("locked_by", null)
        .eq("next_run_at", nextRunAt);
      if (rollbackError) throw new Error(rollbackError.message);
      throw new Error(documentError.message);
    }

    return NextResponse.json({ job: data });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error, 400);
  }
}
