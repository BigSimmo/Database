import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { assertAllowedFile, jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let supabase: ReturnType<typeof createAdminClient> | null = null;
  let uploadedPath: string | null = null;

  try {
    supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field." }, { status: 400 });
    }

    assertAllowedFile(file, env.MAX_UPLOAD_MB);

    const documentId = randomUUID();
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
    const storagePath = `${user.id}/documents/${documentId}/${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentHash = createHash("sha256").update(buffer).digest("hex");

    const { data: duplicate, error: duplicateError } = await supabase
      .from("documents")
      .select("id,title,file_name,status,page_count,chunk_count,image_count,created_at")
      .eq("owner_id", user.id)
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate?.id) {
      return NextResponse.json({
        document: duplicate,
        duplicate: true,
        duplicateReason: "exact_content_hash",
        message: `Exact copy already exists as "${duplicate.title}"; no duplicate job was queued.`,
      });
    }

    const upload = await supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (upload.error) throw new Error(upload.error.message);
    uploadedPath = storagePath;

    const title = String(formData.get("title") || file.name.replace(/\.[^.]+$/, ""));
    const description = formData.get("description") ? String(formData.get("description")) : null;
    const uploadedAt = new Date().toISOString();

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        owner_id: user.id,
        title,
        description,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        content_hash: contentHash,
        status: "queued",
        metadata: {
          source_title: title,
          publisher: null,
          jurisdiction: "Australia/WA",
          version: null,
          publication_date: null,
          review_date: null,
          uploaded_at: uploadedAt,
          indexed_at: null,
          uploaded_by: user.id,
          document_status: "unknown",
          clinical_validation_status: "unverified",
          extraction_quality: "unknown",
          max_upload_mb: env.MAX_UPLOAD_MB,
          confidentiality_scope: "guidelines-only",
          content_hash: contentHash,
        },
      })
      .select()
      .single();

    if (documentError) throw new Error(documentError.message);

    const { data: job, error: jobError } = await supabase
      .from("ingestion_jobs")
      .insert({
        document_id: documentId,
        batch_id: null,
        status: "pending",
        stage: "queued",
        progress: 0,
        max_attempts: env.WORKER_MAX_ATTEMPTS,
      })
      .select()
      .single();

    if (jobError) throw new Error(jobError.message);

    return NextResponse.json({ document, job }, { status: 201 });
  } catch (error) {
    if (uploadedPath && supabase) {
      try {
        await supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).remove([uploadedPath]);
      } catch {
        // Preserve the original upload error response; cleanup is best-effort.
      }
    }

    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }

    return jsonError(error, 400);
  }
}
