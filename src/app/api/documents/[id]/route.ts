import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoDocumentPayload } from "@/lib/demo-data";
import { env, isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { invalidateRagCachesForDocumentMutation } from "@/lib/rag";
import { committedIndexGeneration, isCommittedGenerationMetadata } from "@/lib/reindex-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";
import { optionalQueryString, parseRequestQuery, queryInteger } from "@/lib/validation/query";

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
const defaultPageWindow = 9;
const maxPageWindow = 40;
const defaultChunkWindow = 16;
const maxChunkWindow = 80;
const selectedChunkNeighborCount = 3;

const documentDetailQuerySchema = z.object({
  chunk: optionalQueryString({ maxLength: 80 }),
  page: queryInteger({ fallback: 1, min: 1, max: 1_000_000 }),
  pageLimit: queryInteger({ fallback: defaultPageWindow, min: 1, max: maxPageWindow }),
  chunkLimit: queryInteger({ fallback: defaultChunkWindow, min: 1, max: maxChunkWindow }),
  chunkOffset: queryInteger({ fallback: 0, min: 0, max: 1_000_000 }),
});

function pageWindowAround(pageNumber: number, limit: number, maxPage?: number | null) {
  const half = Math.floor(limit / 2);
  const max = Math.max(1, maxPage ?? Number.MAX_SAFE_INTEGER);
  const from = Math.max(1, Math.min(pageNumber - half, Math.max(1, max - limit + 1)));
  const to = Math.min(max, from + limit - 1);
  return { from, to };
}

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

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compactTableText(value: string | null, limit = 500) {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return compact.length > limit ? `${compact.slice(0, limit - 3).trim()}...` : compact;
}

function metadataStringArrayRows(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (!Array.isArray(value)) return null;
  const rows = value
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => String(cell ?? "").trim()));
  return rows.length ? rows : null;
}

function metadataStringArray(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (!Array.isArray(value)) return null;
  const items = value.map((item) => String(item ?? "").trim()).filter(Boolean);
  return items.length ? items : null;
}

function withImageTableMetadata<T extends { metadata?: unknown }>(image: T) {
  const metadata = safeMetadata(image.metadata);
  const rawTableText = metadataText(metadata, "table_text");
  const tableText = rawTableText ?? metadataText(metadata, "table_text_snippet");
  const publicImage = { ...image };
  delete publicImage.metadata;
  return {
    ...publicImage,
    tableLabel: metadataText(metadata, "table_label"),
    tableTitle: metadataText(metadata, "table_title"),
    tableRole: metadataText(metadata, "table_role"),
    tableTextSnippet: compactTableText(tableText),
    clinicalUseClass: metadataText(metadata, "clinical_use_class"),
    clinicalUseReason: metadataText(metadata, "clinical_use_reason"),
    accessibleTableMarkdown: metadataText(metadata, "accessible_table_markdown") ?? rawTableText,
    tableRows: metadataStringArrayRows(metadata, "table_rows"),
    tableColumns: metadataStringArray(metadata, "table_columns"),
  };
}

function committedRows<T extends { metadata?: unknown }>(document: { metadata?: unknown }, rows: T[]) {
  const committedGeneration = committedIndexGeneration(document.metadata);
  return rows.filter((row) => isCommittedGenerationMetadata({ rowMetadata: row.metadata, committedGeneration }));
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
}) {
  const { error } = await args.supabase
    .from("storage_cleanup_jobs")
    .update({
      status: args.status,
      attempts: 1,
      storage_removed: args.storageRemoved,
      last_error: args.warnings.length ? args.warnings.join("; ") : null,
      completed_at: args.status === "completed" ? new Date().toISOString() : null,
      metadata: {
        operation: "permanent_document_delete",
        storage_warnings: args.warnings,
      },
    })
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
    if (isDemoMode()) {
      const payload = getDemoDocumentPayload(rawId, detailQuery.chunk ?? null);
      if (!payload) {
        return NextResponse.json({ error: "Demo document not found." }, { status: 404 });
      }
      return NextResponse.json({ ...payload, demoMode: true });
    }

    const { id } = parseRouteParams({ id: rawId }, documentRouteParamsSchema, "Invalid document id.");
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data: document, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const chunkId = detailQuery.chunk ?? null;
    const requestedPage = Math.min(detailQuery.page, Math.max(1, document.page_count ?? 1));
    const pageLimit = detailQuery.pageLimit;
    const chunkLimit = detailQuery.chunkLimit;
    const chunkOffset = detailQuery.chunkOffset;

    let selectedChunk: {
      id: string;
      page_number: number | null;
      chunk_index: number;
      section_heading: string | null;
      content: string;
      image_ids: string[];
    } | null = null;

    if (chunkId) {
      const { data, error: selectedChunkError } = await supabase
        .from("document_chunks")
        .select("id,page_number,chunk_index,section_heading,content,image_ids,metadata")
        .eq("document_id", id)
        .eq("id", chunkId)
        .maybeSingle();

      if (selectedChunkError) throw new Error(selectedChunkError.message);
      selectedChunk = data && committedRows(document, [data]).length > 0 ? data : null;
    }

    const effectivePage = selectedChunk?.page_number ?? requestedPage;
    const pageWindow = pageWindowAround(effectivePage, pageLimit, document.page_count);
    const { data: pages, error: pagesError } = await supabase
      .from("document_pages")
      .select("id,page_number,text,ocr_used,metadata")
      .eq("document_id", id)
      .gte("page_number", pageWindow.from)
      .lte("page_number", pageWindow.to)
      .order("page_number", { ascending: true });

    if (pagesError) throw new Error(pagesError.message);

    const { data: images, error: imagesError } = await supabase
      .from("document_images")
      .select(
        "id,page_number,storage_path,caption,bbox,mime_type,image_type,searchable,clinical_relevance_score,source_kind,width,height,labels,metadata",
      )
      .eq("document_id", id)
      .neq("image_type", "logo_decorative")
      .or("searchable.eq.true,source_kind.eq.table_crop")
      .order("page_number", { ascending: true });

    if (imagesError) throw new Error(imagesError.message);

    const chunkQuery = supabase
      .from("document_chunks")
      .select("id,page_number,chunk_index,section_heading,content,image_ids,metadata")
      .eq("document_id", id)
      .order("chunk_index", { ascending: true });

    const chunkRangeStart = selectedChunk
      ? Math.max(0, selectedChunk.chunk_index - selectedChunkNeighborCount)
      : chunkOffset;
    const chunkRangeEnd = selectedChunk
      ? selectedChunk.chunk_index + selectedChunkNeighborCount
      : chunkOffset + chunkLimit - 1;

    const { data: chunks, error: chunksError } = selectedChunk
      ? await chunkQuery.gte("chunk_index", chunkRangeStart).lte("chunk_index", chunkRangeEnd)
      : await chunkQuery.range(chunkRangeStart, chunkRangeEnd);

    if (chunksError) throw new Error(chunksError.message);

    const [labelsResult, summaryResult, tableFactsResult] = await Promise.all([
      supabase.from("document_labels").select("*").eq("document_id", id).order("confidence", { ascending: false }),
      supabase.from("document_summaries").select("*").eq("document_id", id).maybeSingle(),
      supabase
        .from("document_table_facts")
        .select("*")
        .eq("document_id", id)
        .order("page_number", { ascending: true })
        .limit(200),
    ]);

    if (labelsResult.error) throw new Error(labelsResult.error.message);
    if (summaryResult.error) throw new Error(summaryResult.error.message);
    if (tableFactsResult.error) throw new Error(tableFactsResult.error.message);

    return NextResponse.json({
      document: {
        ...document,
        labels: labelsResult.data ?? [],
        summary: summaryResult.data ?? null,
      },
      pages: pages ?? [],
      images: committedRows(document, images ?? []).map(withImageTableMetadata),
      tableFacts: committedRows(document, tableFactsResult.data ?? []),
      chunks: committedRows(document, chunks ?? []),
      pageWindow: {
        from: pageWindow.from,
        to: pageWindow.to,
        limit: pageLimit,
        total: document.page_count ?? null,
        hasBefore: pageWindow.from > 1,
        hasAfter: Boolean(document.page_count && pageWindow.to < document.page_count),
      },
      chunkWindow: {
        offset: chunkRangeStart,
        limit: selectedChunk ? chunkRangeEnd - chunkRangeStart + 1 : chunkLimit,
        total: document.chunk_count ?? null,
        hasBefore: chunkRangeStart > 0,
        hasAfter: Boolean(document.chunk_count && chunkRangeEnd + 1 < document.chunk_count),
        selectedChunkId: selectedChunk?.id ?? null,
      },
      indexHealth: {
        extractionQuality: safeMetadata(document.metadata).extraction_quality ?? null,
        indexedAt: safeMetadata(document.metadata).indexed_at ?? null,
        indexVersion: safeMetadata(document.metadata).rag_indexing_version ?? null,
        warnings: safeMetadata(document.metadata).extraction_warnings ?? [],
      },
    });
  } catch (error) {
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
        },
      })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message);
    invalidateRagCachesForDocumentMutation(user.id);
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
    const { data: activeJobs, error: activeJobsError } = await supabase
      .from("ingestion_jobs")
      .select("id,status")
      .eq("document_id", id)
      .in("status", ["pending", "processing"])
      .limit(1);

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

    invalidateRagCachesForDocumentMutation(user.id);
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
