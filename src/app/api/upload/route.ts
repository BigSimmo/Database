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

type UploadCleanupState = {
  cleanupJobId: string;
  documentId: string;
  ownerId: string;
  storagePath: string;
};

function uploadCleanupMetadata(state: UploadCleanupState) {
  return {
    operation: "upload_compensation",
    expected_document_id: state.documentId,
  };
}

async function createUploadCleanupJob(args: {
  supabase: ReturnType<typeof createAdminClient>;
  documentId: string;
  ownerId: string;
  storagePath: string;
}): Promise<UploadCleanupState> {
  const state: UploadCleanupState = {
    cleanupJobId: randomUUID(),
    documentId: args.documentId,
    ownerId: args.ownerId,
    storagePath: args.storagePath,
  };
  const { error } = await args.supabase.from("storage_cleanup_jobs").insert({
    id: state.cleanupJobId,
    owner_id: state.ownerId,
    // The document row does not exist yet, so the expected id lives in metadata
    // until the atomic upload RPC succeeds and the FK can be populated safely.
    document_id: null,
    document_bucket: env.SUPABASE_DOCUMENT_BUCKET,
    document_paths: [state.storagePath],
    image_bucket: env.SUPABASE_IMAGE_BUCKET,
    image_paths: [],
    status: "pending",
    metadata: uploadCleanupMetadata(state),
  });
  if (error) throw new Error(`Upload cleanup ledger insert failed: ${error.message}`);
  return state;
}

async function completeUploadCleanupForLiveDocument(args: {
  supabase: ReturnType<typeof createAdminClient>;
  state: UploadCleanupState;
}) {
  const { error } = await args.supabase
    .from("storage_cleanup_jobs")
    .update({
      document_id: args.state.documentId,
      status: "completed",
      last_error: null,
      completed_at: new Date().toISOString(),
      metadata: {
        ...uploadCleanupMetadata(args.state),
        live_document_id: args.state.documentId,
        reconciliation: "live_document_committed",
      },
    })
    .eq("id", args.state.cleanupJobId)
    .eq("owner_id", args.state.ownerId);
  if (error) {
    // The pending row remains durable. The janitor reconciles it against the
    // exact live documents.storage_path and completes it without deletion.
    logger.warn("Upload cleanup ledger completion failed", {
      cleanupJobId: args.state.cleanupJobId,
      documentId: args.state.documentId,
      message: error.message,
    });
  }
}

async function compensateUploadStorage(args: {
  supabase: ReturnType<typeof createAdminClient>;
  state: UploadCleanupState;
}) {
  let removed = 0;
  let cleanupError: string | null = null;
  try {
    const cleanup = await args.supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).remove([args.state.storagePath]);
    removed = cleanup.data?.length ?? 0;
    cleanupError = cleanup.error?.message ?? null;
  } catch (error) {
    cleanupError = error instanceof Error ? error.message : String(error);
  }

  const status = cleanupError ? "failed" : "completed";
  const { error: ledgerError } = await args.supabase
    .from("storage_cleanup_jobs")
    .update({
      status,
      attempts: 1,
      storage_removed: removed,
      last_error: cleanupError,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      metadata: {
        ...uploadCleanupMetadata(args.state),
        reconciliation: cleanupError ? "immediate_removal_failed" : "immediate_removal_completed",
      },
    })
    .eq("id", args.state.cleanupJobId)
    .eq("owner_id", args.state.ownerId);
  if (ledgerError) {
    logger.error("Upload cleanup ledger update failed", {
      cleanupJobId: args.state.cleanupJobId,
      documentId: args.state.documentId,
      message: ledgerError.message,
    });
  }
  if (cleanupError) {
    logger.warn("Upload storage compensation failed", {
      cleanupJobId: args.state.cleanupJobId,
      documentId: args.state.documentId,
      message: cleanupError,
    });
  }
}

async function duplicateUploadResponse(args: {
  supabase: ReturnType<typeof createAdminClient>;
  ownerId: string;
  contentHash: string;
  cleanupState: UploadCleanupState;
}) {
  await compensateUploadStorage({ supabase: args.supabase, state: args.cleanupState });

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
  let uploadCleanupState: UploadCleanupState | null = null;
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
    uploadCleanupState = await createUploadCleanupJob({
      supabase: adminSupabase,
      documentId,
      ownerId: uploadOwnerId,
      storagePath,
    });
    // Treat the exact path as potentially materialized once the upload starts,
    // even if the storage API ultimately reports an error.
    uploadedPath = storagePath;
    const upload = await adminSupabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (upload.error) throw new Error(upload.error.message);

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
    // Upload filename/title/storage-path identity is user-controlled and must not mint
    // Official/Trusted publisher_code. Authority is set later via registry-validated admin
    // correction or approval-gated locality backfill against authenticated source metadata.

    assertUploadNotAborted(request);
    const documentPayload = {
      id: documentId,
      owner_id: uploadOwnerId,
      title,
      description,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      content_hash: contentHash,
      metadata: {
        source_title: title,
        publisher_code: null,
        publisher: null,
        jurisdiction: "Australia/WA",
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
    };

    assertUploadNotAborted(request);
    const { data: uploadRecord, error: uploadRecordError } = await supabase.rpc(
      "create_uploaded_document_with_ingestion_job",
      {
        p_document: documentPayload,
        p_max_attempts: env.WORKER_MAX_ATTEMPTS,
      },
    );

    if (uploadRecordError) {
      if (isContentHashDuplicateError(uploadRecordError)) {
        insertedDocumentId = null;
        insertedDocumentOwnerId = null;
        const cleanupState = uploadCleanupState;
        if (!cleanupState) throw new Error("Upload cleanup ledger state is missing.");
        uploadedPath = null;
        uploadCleanupState = null;
        return duplicateUploadResponse({
          supabase,
          ownerId: uploadOwnerId,
          contentHash,
          cleanupState,
        });
      }
      throw new Error(uploadRecordError.message);
    }

    const document = (uploadRecord as { document?: unknown } | null)?.document;
    const job = (uploadRecord as { job?: unknown } | null)?.job;
    if (!document || !job) {
      throw new Error("Upload enqueue RPC returned an invalid response.");
    }
    insertedDocumentId = documentId;
    insertedDocumentOwnerId = uploadOwnerId;
    assertUploadNotAborted(request);

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

    if (uploadCleanupState) {
      await completeUploadCleanupForLiveDocument({ supabase, state: uploadCleanupState });
      uploadCleanupState = null;
      uploadedPath = null;
    }

    return NextResponse.json({ document, job }, { status: 201 });
  } catch (error) {
    let documentRowRemoved = true;
    if (insertedDocumentId && insertedDocumentOwnerId && supabase) {
      try {
        const { error: cleanupDeleteError } = await supabase
          .from("documents")
          .delete()
          .eq("id", insertedDocumentId)
          .eq("owner_id", insertedDocumentOwnerId);
        if (cleanupDeleteError) {
          documentRowRemoved = false;
          logger.error("Upload cleanup failed; document row may be orphaned", {
            documentId: insertedDocumentId,
            ownerId: insertedDocumentOwnerId,
            message: cleanupDeleteError.message,
          });
        }
      } catch (cleanupError) {
        documentRowRemoved = false;
        logger.error("Upload cleanup failed; document row may be orphaned", {
          documentId: insertedDocumentId,
          ownerId: insertedDocumentOwnerId,
          message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }

    if (uploadedPath && supabase && uploadCleanupState && documentRowRemoved) {
      await compensateUploadStorage({ supabase, state: uploadCleanupState });
    }

    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }

    return jsonError(error);
  } finally {
    releaseAdmission?.();
  }
}
