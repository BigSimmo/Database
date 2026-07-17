import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/database.types";
import { z } from "zod";
import { rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { env, isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { buildStorageCleanupJobUpdate } from "@/lib/ingestion";
import { invalidateRagCachesForDocumentMutation } from "@/lib/rag";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  DocumentDetailRateLimitError,
  documentDetailQuerySchema,
  loadAuthorizedDocumentDetail,
} from "@/lib/document-detail";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

const renameSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
  })
  .strict();
const documentRouteParamsSchema = z.object({
  id: z.string().uuid(),
});

const cleanupPageSize = 1000;

function safeMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

async function selectDocumentRowsInPages<T>(args: {
  supabase: ReturnType<typeof createAdminClient>;
  table: "document_images" | "document_chunks";
  select: string;
  documentId: string;
}) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += cleanupPageSize) {
    const { data, error } = await args.supabase
      .from(args.table)
      .select(args.select)
      .eq("document_id", args.documentId)
      .range(offset, offset + cleanupPageSize - 1);
    if (error) throw new Error(error.message);

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < cleanupPageSize) break;
  }
  return rows;
}

function storageWarningsFrom(error: unknown, label: string) {
  const message =
    error && typeof error === "object" && "message" in error ? String(error.message) : "Storage cleanup failed.";
  return `${label}: ${message}`;
}

async function removeStorageObjects(args: {
  supabase: ReturnType<typeof createAdminClient>;
  sourcePath: string | null;
  imagePaths: string[];
}) {
  const warnings: string[] = [];
  let storageRemoved = 0;

  if (args.sourcePath) {
    const sourceRemove = await args.supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).remove([args.sourcePath]);
    if (sourceRemove.error) {
      warnings.push(storageWarningsFrom(sourceRemove.error, "Source PDF"));
    } else {
      storageRemoved += sourceRemove.data?.length ?? 0;
    }
  }

  const uniqueImagePaths = Array.from(new Set(args.imagePaths.filter(Boolean)));
  for (let start = 0; start < uniqueImagePaths.length; start += 1000) {
    const paths = uniqueImagePaths.slice(start, start + 1000);
    const imageRemove = await args.supabase.storage.from(env.SUPABASE_IMAGE_BUCKET).remove(paths);
    if (imageRemove.error) {
      warnings.push(storageWarningsFrom(imageRemove.error, "Extracted images"));
    } else {
      storageRemoved += imageRemove.data?.length ?? 0;
    }
  }

  return { storageRemoved, storageWarnings: warnings };
}

async function createStorageCleanupJob(args: {
  supabase: ReturnType<typeof createAdminClient>;
  ownerId: string;
  documentId: string;
  documentTitle: string;
  sourcePath: string | null;
  imagePaths: string[];
}) {
  const { data, error } = await args.supabase
    .from("storage_cleanup_jobs")
    .insert({
      owner_id: args.ownerId,
      document_id: args.documentId,
      document_title: args.documentTitle,
      document_bucket: env.SUPABASE_DOCUMENT_BUCKET,
      document_paths: args.sourcePath ? [args.sourcePath] : [],
      image_bucket: env.SUPABASE_IMAGE_BUCKET,
      image_paths: Array.from(new Set(args.imagePaths.filter(Boolean))),
      status: "pending",
      metadata: {
        operation: "permanent_document_delete",
        created_by: "api/documents/[id]",
      },
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function updateStorageCleanupJob(args: {
  supabase: ReturnType<typeof createAdminClient>;
  cleanupJobId: string;
  status: "completed" | "failed";
  storageRemoved: number;
  warnings: string[];
  // Audit R11: set on every DELETE abort path so the ledger row's storage paths
  // are cleared — the document survives the abort, so the janitor must never see
  // its live paths queued for removal.
  aborted?: boolean;
}) {
  const { error } = await args.supabase
    .from("storage_cleanup_jobs")
    .update(
      buildStorageCleanupJobUpdate({
        status: args.status,
        storageRemoved: args.storageRemoved,
        warnings: args.warnings,
        aborted: args.aborted,
      }),
    )
    .eq("id", args.cleanupJobId);

  return error ? storageWarningsFrom(error, "Cleanup ledger") : null;
}

async function deleteDocumentIndexTraceRows(args: {
  supabase: ReturnType<typeof createAdminClient>;
  ownerId: string;
  documentId: string;
  chunkIds: string[];
}) {
  const cleanupErrors: string[] = [];

  if (args.chunkIds.length > 0) {
    const chunkTraceDeletes = [
      args.supabase.from("rag_queries").delete().overlaps("source_chunk_ids", args.chunkIds),
      args.supabase.from("rag_query_misses").delete().overlaps("top_chunk_ids", args.chunkIds),
      args.supabase.from("rag_query_misses").delete().overlaps("cited_chunk_ids", args.chunkIds),
    ];

    for (const query of chunkTraceDeletes) {
      const { error } = await query;
      if (error) cleanupErrors.push(error.message);
    }
  }

  const documentTraceDeletes = [
    args.supabase
      .from("rag_query_misses")
      .delete()
      .or(`clicked_document_id.eq.${args.documentId},expected_document_id.eq.${args.documentId}`),
    args.supabase
      .from("rag_response_cache")
      .delete()
      .eq("owner_id", args.ownerId)
      .in("cache_kind", ["search", "answer"]),
  ];

  for (const query of documentTraceDeletes) {
    const { error } = await query;
    if (error) cleanupErrors.push(error.message);
  }

  if (cleanupErrors.length > 0) {
    throw new Error(`Index trace cleanup failed: ${cleanupErrors.join("; ")}`);
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const detailQuery = parseRequestQuery(request, documentDetailQuerySchema, "Invalid document detail query.");
    const payload = await loadAuthorizedDocumentDetail({ request, rawId, query: detailQuery });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof DocumentDetailRateLimitError) {
      return rateLimitJsonResponse("Document requests are rate limited. Try again shortly.", error.rateLimit);
    }
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    if (isDemoMode()) {
      return NextResponse.json({ error: "Demo documents cannot be renamed." }, { status: 400 });
    }

    const { id } = parseRouteParams({ id: rawId }, documentRouteParamsSchema, "Invalid document id.");
    const body = await parseJsonBody(request, renameSchema, "Enter a document title between 1 and 180 characters.");

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id,owner_id,title,file_name,storage_path,content_hash,metadata")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (documentError) throw new Error(documentError.message);
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    if (document.title.trim() === body.title) {
      throw new PublicApiError("Document title is unchanged.");
    }

    const metadata = safeMetadata(document.metadata);
    const { data: updated, error: updateError } = await supabase
      .from("documents")
      .update({
        title: body.title,
        metadata: {
          ...metadata,
          renamed_at: new Date().toISOString(),
          previous_title: document.title,
          original_file_name: metadata.original_file_name ?? document.file_name,
          // JSON-serializable; the inferred literal type is wider than Json.
        } as unknown as Json,
      })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message);
    invalidateRagCachesForDocumentMutation(user.id, { affectsPublicCorpus: false });
    await writeAuditLog(supabase, {
      ownerId: user.id,
      action: "document_rename",
      resourceType: "document",
      resourceId: id,
      metadata: { previousTitle: document.title, newTitle: body.title },
    });
    return NextResponse.json({ document: updated });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    if (isDemoMode()) {
      return NextResponse.json({ error: "Demo documents cannot be deleted." }, { status: 400 });
    }

    const { id } = parseRouteParams({ id: rawId }, documentRouteParamsSchema, "Invalid document id.");
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id,owner_id,title,storage_path")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (documentError) throw new Error(documentError.message);
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    // Audit M9: block deletion on PENDING jobs too, matching the reindex
    // routes' checkIngestionMutationSafety predicate. A just-queued reindex
    // job (status "pending") racing this DELETE let the worker upload a new
    // generation of image objects after the storage paths were enumerated,
    // orphaning them permanently.
    async function loadActiveJobs() {
      return supabase
        .from("ingestion_jobs")
        .select("id,status")
        .eq("document_id", id)
        .in("status", ["pending", "processing"])
        .limit(1);
    }

    const { data: activeJobs, error: activeJobsError } = await loadActiveJobs();

    if (activeJobsError) throw new Error(activeJobsError.message);
    if ((activeJobs ?? []).length > 0) {
      throw new PublicApiError(
        "Document has pending or processing indexing work. Stop or wait for the worker before deleting.",
        409,
      );
    }

    const [images, chunks] = await Promise.all([
      selectDocumentRowsInPages<{ storage_path: string | null }>({
        supabase,
        table: "document_images",
        select: "storage_path",
        documentId: id,
      }),
      selectDocumentRowsInPages<{ id: string | null }>({
        supabase,
        table: "document_chunks",
        select: "id",
        documentId: id,
      }),
    ]);

    const chunkIds = chunks.map((chunk) => chunk.id).filter(isNonEmptyString);
    const imagePaths = images.map((image) => image.storage_path).filter(isNonEmptyString);
    const cleanupJobId = await createStorageCleanupJob({
      supabase,
      ownerId: user.id,
      documentId: id,
      documentTitle: document.title,
      sourcePath: document.storage_path,
      imagePaths,
    });

    const { data: lateActiveJobs, error: lateActiveJobsError } = await loadActiveJobs();
    if (lateActiveJobsError) throw new Error(lateActiveJobsError.message);
    if ((lateActiveJobs ?? []).length > 0) {
      const message =
        "Document gained pending or processing indexing work during delete. Stop or wait for the worker before deleting.";
      const ledgerWarning = await updateStorageCleanupJob({
        supabase,
        cleanupJobId,
        status: "failed",
        storageRemoved: 0,
        warnings: [message],
        aborted: true,
      });
      throw new PublicApiError(ledgerWarning ? `${message}; ${ledgerWarning}` : message, 409);
    }

    try {
      await deleteDocumentIndexTraceRows({ supabase, ownerId: user.id, documentId: id, chunkIds });
    } catch (traceCleanupError) {
      const message = traceCleanupError instanceof Error ? traceCleanupError.message : "Index trace cleanup failed.";
      const ledgerWarning = await updateStorageCleanupJob({
        supabase,
        cleanupJobId,
        status: "failed",
        storageRemoved: 0,
        warnings: [message],
        aborted: true,
      });
      throw new Error(ledgerWarning ? `${message}; ${ledgerWarning}` : message);
    }

    const { error: deleteError } = await supabase.from("documents").delete().eq("id", id).eq("owner_id", user.id);
    if (deleteError) {
      const ledgerWarning = await updateStorageCleanupJob({
        supabase,
        cleanupJobId,
        status: "failed",
        storageRemoved: 0,
        warnings: [`Database delete: ${deleteError.message}`],
        aborted: true,
      });
      throw new Error(ledgerWarning ? `${deleteError.message}; ${ledgerWarning}` : deleteError.message);
    }

    const cleanup = await removeStorageObjects({
      supabase,
      sourcePath: document.storage_path,
      imagePaths,
    });
    const ledgerWarning = await updateStorageCleanupJob({
      supabase,
      cleanupJobId,
      status: cleanup.storageWarnings.length > 0 ? "failed" : "completed",
      storageRemoved: cleanup.storageRemoved,
      warnings: cleanup.storageWarnings,
    });
    if (ledgerWarning) cleanup.storageWarnings.push(ledgerWarning);

    invalidateRagCachesForDocumentMutation(user.id, { affectsPublicCorpus: false });
    await writeAuditLog(supabase, {
      ownerId: user.id,
      action: "document_delete",
      resourceType: "document",
      resourceId: id,
      metadata: { title: document.title, storageRemoved: cleanup.storageRemoved },
    });
    return NextResponse.json({
      deleted: true,
      documentId: id,
      storageRemoved: cleanup.storageRemoved,
      storageWarnings: cleanup.storageWarnings,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
