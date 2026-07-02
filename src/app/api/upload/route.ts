import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { assertAllowedFile, assertFileContentSignature, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";
import { planDocumentName } from "@/lib/document-naming";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { probeSupabaseHealth } from "@/lib/supabase/health";
import { optionalFormText, parseFormDataFields } from "@/lib/validation/form-data";

export const runtime = "nodejs";

const uploadMetadataSchema = z
  .object({
    title: optionalFormText(180),
    description: optionalFormText(1_000),
  })
  .strict();

export async function POST(request: Request) {
  let supabase: ReturnType<typeof createAdminClient> | null = null;
  let uploadedPath: string | null = null;
  let insertedDocumentId: string | null = null;
  let insertedDocumentOwnerId: string | null = null;

  try {
    supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field." }, { status: 400 });
    }

    assertAllowedFile(file, env.MAX_UPLOAD_MB);
    const uploadMetadata = parseFormDataFields(
      formData,
      uploadMetadataSchema,
      ["title", "description"],
      "Upload metadata is invalid.",
    );

    const documentId = randomUUID();
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
    const storagePath = `${user.id}/documents/${documentId}/${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    // The declared MIME type is client-supplied; verify the real byte signature
    // before persisting a clinical document.
    assertFileContentSignature(file.type, buffer);
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

    const health = await probeSupabaseHealth(supabase);
    if (!health.ok) return NextResponse.json({ error: `Upload is paused. ${health.message}` }, { status: 503 });

    const upload = await supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (upload.error) throw new Error(upload.error.message);
    uploadedPath = storagePath;

    const namePlan = await planDocumentName({
      supabase,
      ownerId: user.id,
      fileName: file.name,
      requestedTitle: uploadMetadata.title,
      contentHash,
    });
    const title = namePlan.title;
    const description = uploadMetadata.description;
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
          original_file_name: namePlan.originalFileName,
          original_title: namePlan.originalTitle,
          smart_title_base: namePlan.baseTitle,
          smart_title_group_key: namePlan.duplicateGroupKey,
          smart_title_duplicate_index: namePlan.duplicateIndex,
          smart_title_duplicate_reason: namePlan.duplicateReason,
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
    insertedDocumentId = documentId;
    insertedDocumentOwnerId = user.id;

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

    if (jobError) {
      const { error: rollbackDocumentError } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId)
        .eq("owner_id", user.id);
      if (rollbackDocumentError) {
        throw new Error(`Failed to enqueue ingestion job: ${jobError.message}; rollback failed: ${rollbackDocumentError.message}`);
      }
      insertedDocumentId = null;
      insertedDocumentOwnerId = null;
      throw new Error(jobError.message);
    }

    await writeAuditLog(supabase, {
      ownerId: user.id,
      action: "document_upload",
      resourceType: "document",
      resourceId: documentId,
      metadata: { fileName: file.name, fileType: file.type, fileSize: file.size, contentHash },
    });

    return NextResponse.json({ document, job }, { status: 201 });
  } catch (error) {
    if (insertedDocumentId && insertedDocumentOwnerId && supabase) {
      try {
        const { error: cleanupDeleteError } = await supabase
          .from("documents")
          .delete()
          .eq("id", insertedDocumentId)
          .eq("owner_id", insertedDocumentOwnerId);
        if (cleanupDeleteError) {
          logger.error("Upload cleanup failed; document row may be orphaned", {
            documentId: insertedDocumentId,
            ownerId: insertedDocumentOwnerId,
            message: cleanupDeleteError.message,
          });
        }
      } catch (cleanupError) {
        logger.error("Upload cleanup failed; document row may be orphaned", {
          documentId: insertedDocumentId,
          ownerId: insertedDocumentOwnerId,
          message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }

    if (uploadedPath && supabase) {
      try {
        const { error: cleanupStorageError } = await supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).remove([uploadedPath]);
        if (cleanupStorageError) {
          logger.error("Upload cleanup failed; storage object may be orphaned", {
            storagePath: uploadedPath,
            message: cleanupStorageError.message,
          });
        }
      } catch (cleanupError) {
        // Cleanup is best-effort, but a silent failure leaves an orphaned storage
        // object. Record the path so it can be reconciled instead of dropping it.
        logger.error("Upload cleanup failed; storage object may be orphaned", {
          storagePath: uploadedPath,
          message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }

    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }

    return jsonError(error, 400);
  }
}
