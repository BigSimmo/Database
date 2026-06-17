import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";
import { upsertDocumentEnrichment } from "@/lib/document-enrichment";
import { upsertDocumentDeepMemory } from "@/lib/deep-memory";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const reindexPageSize = 1000;

type ReindexChunk = {
  id: string;
  document_id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  content: string;
  image_ids?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

type ReindexImage = {
  id: string;
  page_number: number | null;
  caption: string | null;
  image_type: string | null;
  labels?: string[] | null;
  source_kind?: string | null;
  clinical_relevance_score?: number | null;
  metadata?: Record<string, unknown> | null;
};

async function readMode(request: Request) {
  try {
    const body = await request.json();
    return body?.mode === "enrichment" ? "enrichment" : "full";
  } catch {
    return "full";
  }
}

async function selectReindexRowsInPages<T>(args: {
  supabase: ReturnType<typeof createAdminClient>;
  table: "document_chunks" | "document_images";
  select: string;
  documentId: string;
  searchableOnly?: boolean;
}) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += reindexPageSize) {
    let query = args.supabase.from(args.table).select(args.select).eq("document_id", args.documentId);
    if (args.searchableOnly) query = query.eq("searchable", true);
    const { data, error } = await query.range(offset, offset + reindexPageSize - 1);
    if (error) throw new Error(error.message);

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < reindexPageSize) break;
  }
  return rows;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode()) return NextResponse.json({ error: "Reindex is unavailable in demo mode." }, { status: 400 });

    const { id } = await params;
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const mode = await readMode(request);

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id,owner_id,title,file_name,source_path,import_batch_id,metadata")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (documentError) throw new Error(documentError.message);
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    if (mode === "enrichment") {
      const [chunks, images] = await Promise.all([
        selectReindexRowsInPages<ReindexChunk>({
          supabase,
          table: "document_chunks",
          select: "id,document_id,page_number,chunk_index,section_heading,content,image_ids,metadata",
          documentId: id,
        }),
        selectReindexRowsInPages<ReindexImage>({
          supabase,
          table: "document_images",
          select: "id,page_number,caption,image_type,labels,source_kind,clinical_relevance_score,metadata",
          documentId: id,
          searchableOnly: true,
        }),
      ]);

      chunks.sort((a, b) => Number(a.chunk_index ?? 0) - Number(b.chunk_index ?? 0));
      images.sort((a, b) => Number(b.clinical_relevance_score ?? 0) - Number(a.clinical_relevance_score ?? 0));

      if (!chunks.length) {
        return NextResponse.json({ error: "Document has no indexed chunks to enrich." }, { status: 400 });
      }

      const enrichment = await upsertDocumentEnrichment({
        supabase,
        document,
        chunks,
        images,
      });
      const deepMemory = await upsertDocumentDeepMemory({
        supabase,
        document,
        chunks,
        images,
        summary: enrichment.summary.summary,
      });
      return NextResponse.json({
        mode,
        enrichment,
        deepMemory: {
          sectionCount: deepMemory.sections.length,
          memoryCardCount: deepMemory.memoryCards.length,
          indexUnitCount: deepMemory.indexUnits.length,
        },
      });
    }

    // IDX-H1: enqueue the job first, then mark queued. Do NOT reset the index here — the
    // worker calls resetDocumentIndex at job start (worker/main.ts). Resetting before the
    // job is committed would leave a previously-searchable clinical document with zero index
    // if job creation failed or the worker never ran (silent availability regression). The
    // existing index stays live until the worker commits a fresh one.
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

    const { error: updateError } = await supabase
      .from("documents")
      .update({ status: "queued", error_message: null })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error, 400);
  }
}
