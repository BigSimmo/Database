import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoDocumentPayload } from "@/lib/demo-data";
import { env, isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { invalidateRagCachesForOwner } from "@/lib/rag";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const renameSchema = z.object({
  title: z.string().trim().min(1).max(180),
});

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (isDemoMode()) {
      const chunkId = new URL(request.url).searchParams.get("chunk");
      const payload = getDemoDocumentPayload(id, chunkId);
      if (!payload) {
        return NextResponse.json({ error: "Demo document not found." }, { status: 404 });
      }
      return NextResponse.json({ ...payload, demoMode: true });
    }

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

    const { data: pages, error: pagesError } = await supabase
      .from("document_pages")
      .select("id,page_number,text,ocr_used,metadata")
      .eq("document_id", id)
      .order("page_number", { ascending: true })
      .limit(80);

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

    const chunkId = new URL(request.url).searchParams.get("chunk");
    const chunkQuery = supabase
      .from("document_chunks")
      .select("id,page_number,chunk_index,section_heading,content,image_ids")
      .eq("document_id", id)
      .order("chunk_index", { ascending: true });

    const { data: chunks, error: chunksError } = chunkId
      ? await chunkQuery.eq("id", chunkId).limit(1)
      : await chunkQuery.limit(30);

    if (chunksError) throw new Error(chunksError.message);

    const [labelsResult, summaryResult] = await Promise.all([
      supabase.from("document_labels").select("*").eq("document_id", id).order("confidence", { ascending: false }),
      supabase.from("document_summaries").select("*").eq("document_id", id).maybeSingle(),
    ]);

    if (labelsResult.error) throw new Error(labelsResult.error.message);
    if (summaryResult.error) throw new Error(summaryResult.error.message);

    return NextResponse.json({
      document: {
        ...document,
        labels: labelsResult.data ?? [],
        summary: summaryResult.data ?? null,
      },
      pages: pages ?? [],
      images: (images ?? []).map(withImageTableMetadata),
      chunks: chunks ?? [],
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
    const { id } = await params;
    if (isDemoMode()) {
      return NextResponse.json({ error: "Demo documents cannot be renamed." }, { status: 400 });
    }

    const parsed = renameSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new PublicApiError("Enter a document title between 1 and 180 characters.");
    }

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
    if (document.title.trim() === parsed.data.title) {
      throw new PublicApiError("Document title is unchanged.");
    }

    const metadata = safeMetadata(document.metadata);
    const { data: updated, error: updateError } = await supabase
      .from("documents")
      .update({
        title: parsed.data.title,
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
    invalidateRagCachesForOwner(user.id);
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
    const { id } = await params;
    if (isDemoMode()) {
      return NextResponse.json({ error: "Demo documents cannot be deleted." }, { status: 400 });
    }

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

    const { data: activeJobs, error: activeJobsError } = await supabase
      .from("ingestion_jobs")
      .select("id,status")
      .eq("document_id", id)
      .eq("status", "processing")
      .limit(1);

    if (activeJobsError) throw new Error(activeJobsError.message);
    if ((activeJobs ?? []).length > 0) {
      throw new PublicApiError("Document is currently indexing. Stop or wait for the worker before deleting.", 409);
    }

    const [{ data: images, error: imagesError }, { data: chunks, error: chunksError }] = await Promise.all([
      supabase.from("document_images").select("storage_path").eq("document_id", id),
      supabase.from("document_chunks").select("id").eq("document_id", id),
    ]);

    if (imagesError) throw new Error(imagesError.message);
    if (chunksError) throw new Error(chunksError.message);

    const chunkIds = (chunks ?? []).map((chunk) => chunk.id).filter(Boolean);
    const imagePaths = (images ?? []).map((image) => image.storage_path).filter(Boolean);
    const cleanupJobId = await createStorageCleanupJob({
      supabase,
      ownerId: user.id,
      documentId: id,
      documentTitle: document.title,
      sourcePath: document.storage_path,
      imagePaths,
    });

    if (chunkIds.length > 0) {
      const { error: queryDeleteError } = await supabase
        .from("rag_queries")
        .delete()
        .eq("owner_id", user.id)
        .overlaps("source_chunk_ids", chunkIds);
      if (queryDeleteError) {
        const ledgerWarning = await updateStorageCleanupJob({
          supabase,
          cleanupJobId,
          status: "failed",
          storageRemoved: 0,
          warnings: [`Query log delete: ${queryDeleteError.message}`],
        });
        throw new Error(ledgerWarning ? `${queryDeleteError.message}; ${ledgerWarning}` : queryDeleteError.message);
      }
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

    invalidateRagCachesForOwner(user.id);
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
