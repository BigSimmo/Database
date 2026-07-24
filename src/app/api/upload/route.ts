import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { assertAllowedFile, assertFileContentSignature, jsonError, PublicApiError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";
import { consumeSubjectApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { planDocumentName, type DocumentNameSupabase } from "@/lib/document-naming";
import { inferSourceAuthorityFromIdentity } from "@/lib/source-authority-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { probeSupabaseHealth } from "@/lib/supabase/health";
import { optionalFormText, parseFormDataFields } from "@/lib/validation/form-data";
import { acquireUploadAdmission, parseUploadContentLength } from "@/lib/upload-admission";
import { assertUploadStructure } from "@/lib/upload-structure";

export const runtime = "nodejs";

const uploadMetadataSchema = z
  .object({
    title: optionalFormText(180),
    description: optionalFormText(1_000),
  })
  .strict();

function isContentHashDuplicateError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : String(error);
  return (
    /duplicate key value violates unique constraint/i.test(message) &&
    /content_hash|documents_owner_content_hash/i.test(message)
  );
}

function assertUploadNotAborted(request: Request) {
  if (request.signal.aborted) {
    throw new PublicApiError("Upload cancelled by client.", 499, { code: "client_cancelled" });
  }
}

async function duplicateUploadResponse(args: {
  supabase: ReturnType<typeof createAdminClient>;
  ownerId: string;
  contentHash: string;
  storagePath: string | null;
}) {
  if (args.storagePath) {
    const { error: cleanupStorageError } = await args.supabase.storage
      .from(env.SUPABASE_DOCUMENT_BUCKET)
      .remove([args.storagePath]);
    if (cleanupStorageError) {
      logger.warn("Duplicate upload storage cleanup failed", {
        storagePath: args.storagePath,
        message: cleanupStorageError.message,
      });
    }
  }

  const { data: duplicate, error: duplicateError } = await args.supabase
    .from("documents")
    .select("id,title,file_name,status,page_count,chunk_count,image_count,created_at")
    .eq("owner_id", args.ownerId)
    .eq("content_hash", args.contentHash)
    .maybeSingle();

  if (duplicateError) throw new Error(duplicateError.message);
  if (!duplicate?.id) {
    throw new PublicApiError(
      "Upload conflicted with an existing document but the duplicate could not be resolved.",
      409,
    );
  }

  return NextResponse.json({
    document: duplicate,
    duplicate: true,
    duplicateReason: "exact_content_hash",
    message: `Exact copy already exists as "${duplicate.title}"; no duplicate job was queued.`,
  });
}

export async function POST(request: Request) {
  let supabase: ReturnType<typeof createAdminClient> | null = null;
  let uploadedPath: string | null = null;
  let insertedDocumentId: string | null = null;
  let insertedDocumentOwnerId: string | null = null;
  let releaseAdmission: (() => void) | null = null;

  try {
    supabase = createAdminClient();
    const adminSupabase = supabase;
    const administrator = await requireAuthenticatedUser(request, adminSupabase, { administrator: true });
    const uploadOwnerId = administrator.id;

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase: adminSupabase,
      subject: { kind: "owner", ownerId: administrator.id },
      bucket: "document_upload",
      allowInMemoryFallbackOnUnavailable: false,
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse(
        "Document upload is temporarily rate limited because too many requests were received. Retry shortly.",
        rateLimit,
      );
    }

    const multipartOverheadBytes = 1024 * 1024;
    const maximumBodyBytes = env.MAX_UPLOAD_MB * 1024 * 1024 + multipartOverheadBytes;
    const contentLength = parseUploadContentLength(request.headers.get("content-length"));
    if (contentLength !== null && contentLength > maximumBodyBytes) {
      throw new PublicApiError("Upload body exceeds the configured size limit.", 413, {
        code: "upload_body_too_large",
      });
    }
    const admission = acquireUploadAdmission({
      bytes: contentLength ?? maximumBodyBytes,
      maxConcurrent: env.MAX_CONCURRENT_UPLOADS,
      maxBytes: env.MAX_IN_FLIGHT_UPLOAD_MB * 1024 * 1024,
    });
    if (!admission.ok) {
      throw new PublicApiError("Upload capacity is temporarily exhausted. Retry shortly.", 503, {
        code: admission.reason === "bytes" ? "upload_byte_budget_exhausted" : "upload_capacity_exhausted",
      });
    }
    releaseAdmission = admission.release;
    assertUploadNotAborted(request);

    const formData = await request.formData().catch((cause) => {
      throw new PublicApiError("Invalid upload form data.", 400, {
        code: "invalid_form_data",
        causeName: cause instanceof Error ? cause.name : null,
        causeMessage: cause instanceof Error ? cause.message : null,
      });
    });
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
    const storagePath = `${uploadOwnerId}/documents/${documentId}/${safeName}`;
    assertUploadNotAborted(request);
    const buffer = Buffer.from(await file.arrayBuffer());
    // The declared MIME type is client-supplied; verify the real byte signature
    // and the actual document structure before persisting a clinical document.
    assertFileContentSignature(file.type, buffer);
    await assertUploadStructure(file.type, buffer);
    const contentHash = createHash("sha256").update(buffer).digest("hex");

    const { data: duplicate, error: duplicateError } = await adminSupabase
      .from("documents")
      .select("id,title,file_name,status,page_count,chunk_count,image_count,created_at")
      .eq("owner_id", uploadOwnerId)
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

    const health = await probeSupabaseHealth(adminSupabase);
    if (!health.ok) return NextResponse.json({ error: `Upload is paused. ${health.message}` }, { status: 503 });

    assertUploadNotAborted(request);
    const upload = await adminSupabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (upload.error) throw new Error(upload.error.message);
    uploadedPath = storagePath;

    const namingSupabase: DocumentNameSupabase = {
      from: ((table) => adminSupabase.from(table)) as DocumentNameSupabase["from"],
    };
    const namePlan = await planDocumentName({
      supabase: namingSupabase,
      ownerId: uploadOwnerId,
      fileName: file.name,
      requestedTitle: uploadMetadata.title,
      contentHash,
    });
    const title = namePlan.title;
    const description = uploadMetadata.description;
    const uploadedAt = new Date().toISOString();
    const identityAuthority = inferSourceAuthorityFromIdentity({
      title,
      file_name: file.name,
      source_path: storagePath,
    });
    const canonicalAuthority = identityAuthority.conflict ? null : identityAuthority.authority;

    assertUploadNotAborted(request);
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        owner_id: uploadOwnerId,
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
          publisher_code: canonicalAuthority ? (identityAuthority.code ?? canonicalAuthority.codes[0] ?? null) : null,
          publisher: canonicalAuthority?.publisher ?? null,
          jurisdiction: canonicalAuthority?.jurisdictions[0] ?? "Australia/WA",
          version: null,
          publication_date: null,
          review_date: null,
          uploaded_at: uploadedAt,
          indexed_at: null,
          uploaded_by: uploadOwnerId,
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

    if (documentError) {
      if (isContentHashDuplicateError(documentError)) {
        insertedDocumentId = null;
        insertedDocumentOwnerId = null;
        return duplicateUploadResponse({
          supabase,
          ownerId: uploadOwnerId,
          contentHash,
          storagePath: uploadedPath,
        });
      }
      throw new Error(documentError.message);
    }
    insertedDocumentId = documentId;
    insertedDocumentOwnerId = uploadOwnerId;

    assertUploadNotAborted(request);
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
        .eq("owner_id", uploadOwnerId);
      if (rollbackDocumentError) {
        throw new Error(
          `Failed to enqueue ingestion job: ${jobError.message}; rollback failed: ${rollbackDocumentError.message}`,
        );
      }
      insertedDocumentId = null;
      insertedDocumentOwnerId = null;
      throw new Error(jobError.message);
    }

    await writeAuditLog(supabase, {
      ownerId: uploadOwnerId,
      action: "document_upload",
      resourceType: "document",
      resourceId: documentId,
      // `audit_logs` is retained indefinitely. Keep only operational facts there;
      // the user-controlled filename and content hash remain on the scoped document
      // record, not in the durable audit trail.
      metadata: { fileType: file.type, fileSize: file.size },
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
        const { error: cleanupStorageError } = await supabase.storage
          .from(env.SUPABASE_DOCUMENT_BUCKET)
          .remove([uploadedPath]);
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

    return jsonError(error);
  } finally {
    releaseAdmission?.();
  }
}
