import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/database.types";
import { z } from "zod";
import { rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { getDemoDocumentPayload } from "@/lib/demo-data";
import { env, isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { buildStorageCleanupJobUpdate } from "@/lib/ingestion";
import { invalidateRagCachesForDocumentMutation } from "@/lib/rag";
import { committedIndexGeneration, isCommittedGenerationMetadata } from "@/lib/reindex-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { callerOwnsDocumentRow, enforceDocumentReadRateLimit, withOwnerReadScope } from "@/lib/public-api-access";
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
const deleteDocumentResultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("not_found") }),
  z.object({
    outcome: z.literal("active_job"),
    job_id: z.string().uuid(),
    job_status: z.enum(["pending", "processing"]),
  }),
  z.object({
    outcome: z.literal("deleted"),
    cleanup_job_id: z.string().uuid(),
    document_title: z.string(),
    source_path: z.string().nullable(),
    image_paths: z.array(z.string()),
  }),
]);

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
    const { access, rateLimit } = await enforceDocumentReadRateLimit(request, supabase);
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Document requests are rate limited. Try again shortly.", rateLimit);
    }
    const { data: document, error } = await withOwnerReadScope(
      supabase.from("documents").select("*").eq("id", id),
      access.ownerId,
    ).maybeSingle();

    if (error) throw new Error(error.message);
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    // withOwnerReadScope also returns PUBLIC (owner_id IS NULL) documents to an authenticated
    // caller. The owner-only projection (raw metadata, storage_path/content_hash, index health,
    // image storage paths) must be gated on OWNERSHIP, not merely on being authenticated, so an
    // authed non-owner viewing a shared public document gets the same redacted view as an
    // anonymous caller (S1/D1).
    const isOwner = callerOwnsDocumentRow(document, access.ownerId);

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

    const omitPublicInternalFields = (row: Record<string, unknown>) => {
      const internalKeys = new Set([
        "owner_id",
        "storage_path",
        "content_hash",
        "source_path",
        "import_batch_id",
        "error_message",
        "metadata",
        // Summary provenance: only present on document_summaries rows (fetched with select("*")).
        // A non-owner viewing a public document's summary must not see the owner's chunk/image
        // source IDs or the generation model, matching the list route's PUBLIC_SUMMARY projection.
        "source_chunk_ids",
        "source_image_ids",
        "model",
      ]);
      return Object.fromEntries(Object.entries(row).filter(([key]) => !internalKeys.has(key)));
    };
    const publicRows = <T extends Record<string, unknown>>(rows: T[]) =>
      isOwner ? rows : rows.map(omitPublicInternalFields);
    const responseDocument = isOwner ? document : omitPublicInternalFields(document as Record<string, unknown>);

    return NextResponse.json({
      document: {
        ...responseDocument,
        labels: publicRows((labelsResult.data ?? []) as Record<string, unknown>[]),
        summary:
          isOwner || !summaryResult.data
            ? (summaryResult.data ?? null)
            : omitPublicInternalFields(summaryResult.data as Record<string, unknown>),
      },
      pages: publicRows((pages ?? []) as Record<string, unknown>[]),
      images: publicRows(
        committedRows(document, images ?? []).map(withImageTableMetadata) as Record<string, unknown>[],
      ),
      tableFacts: publicRows(committedRows(document, tableFactsResult.data ?? []) as Record<string, unknown>[]),
      chunks: publicRows(committedRows(document, chunks ?? []) as Record<string, unknown>[]),
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
      ...(isOwner
        ? {
            indexHealth: {
              extractionQuality: safeMetadata(document.metadata).extraction_quality ?? null,
              indexedAt: safeMetadata(document.metadata).indexed_at ?? null,
              indexVersion: safeMetadata(document.metadata).rag_indexing_version ?? null,
              warnings: safeMetadata(document.metadata).extraction_warnings ?? [],
            },
          }
        : {}),
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
          // JSON-serializable; the inferred literal type is wider than Json.
        } as unknown as Json,
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
    const { data, error } = await supabase.rpc("delete_document_if_idle", {
      p_document_id: id,
      p_owner_id: user.id,
      p_document_bucket: env.SUPABASE_DOCUMENT_BUCKET,
      p_image_bucket: env.SUPABASE_IMAGE_BUCKET,
    });
    if (error) throw new Error(error.message);

    const parsedResult = deleteDocumentResultSchema.safeParse(data);
    if (!parsedResult.success) throw new Error("delete_document_if_idle returned an invalid result.");
    const result = parsedResult.data;
    if (result.outcome === "not_found") {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    if (result.outcome === "active_job") {
      throw new PublicApiError(
        "Document has pending or processing indexing work. Stop or wait for the worker before deleting.",
        409,
        { code: "document_indexing_active" },
      );
    }

    const cleanup = await removeStorageObjects({
      supabase,
      sourcePath: result.source_path,
      imagePaths: result.image_paths,
    });
    const ledgerWarning = await updateStorageCleanupJob({
      supabase,
      cleanupJobId: result.cleanup_job_id,
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
      metadata: { title: result.document_title, storageRemoved: cleanup.storageRemoved },
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
