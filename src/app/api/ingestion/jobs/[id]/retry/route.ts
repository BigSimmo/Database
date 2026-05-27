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
      .select("id,document_id,batch_id,documents!inner(owner_id)")
      .eq("id", id)
      .eq("documents.owner_id", user.id)
      .maybeSingle();

    if (jobError) throw new Error(jobError.message);
    if (!job) return NextResponse.json({ error: "Ingestion job not found." }, { status: 404 });

    const { error: resetError } = await supabase.rpc("reset_document_index", { p_document_id: job.document_id });
    if (resetError) throw new Error(resetError.message);

    const { error: documentError } = await supabase
      .from("documents")
      .update({ status: "queued", error_message: null, page_count: 0, chunk_count: 0, image_count: 0 })
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
