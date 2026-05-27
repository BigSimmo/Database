import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode()) return NextResponse.json({ error: "Reindex is unavailable in demo mode." }, { status: 400 });

    const { id } = await params;
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id,import_batch_id")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (documentError) throw new Error(documentError.message);
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const { error: resetError } = await supabase.rpc("reset_document_index", { p_document_id: id });
    if (resetError) throw new Error(resetError.message);

    const { error: updateError } = await supabase
      .from("documents")
      .update({ status: "queued", error_message: null, page_count: 0, chunk_count: 0, image_count: 0 })
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
