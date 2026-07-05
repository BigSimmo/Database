import { NextResponse } from "next/server";
import { z } from "zod";
import { demoDocuments } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { publicAccessContext, withOwnerReadScope } from "@/lib/public-api-access";
import { parseRequestQuery, queryBoolean, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

const DOCUMENT_LIST_COLUMNS = [
  "id",
  "owner_id",
  "title",
  "description",
  "file_name",
  "file_type",
  "file_size",
  "storage_path",
  "content_hash",
  "source_path",
  "import_batch_id",
  "status",
  "page_count",
  "chunk_count",
  "image_count",
  "error_message",
  "metadata",
  "created_at",
  "updated_at",
].join(",");

const LABEL_LIST_COLUMNS = [
  "id",
  "document_id",
  "owner_id",
  "label",
  "label_type",
  "source",
  "confidence",
  "metadata",
  "created_at",
  "updated_at",
].join(",");

const SUMMARY_LIST_COLUMNS = [
  "id",
  "document_id",
  "owner_id",
  "summary",
  "clinical_specifics",
  "source_chunk_ids",
  "source_image_ids",
  "model",
  "metadata",
  "generated_at",
  "created_at",
  "updated_at",
].join(",");

const VALID_STATUSES = new Set(["queued", "processing", "indexed", "failed"]);
const ACTIVE_DOCUMENT_STATUSES = new Set(["queued", "processing"]);
const ACTIVE_INDEXING_POLL_MS = 5_000;

type DocumentListRow = Record<string, unknown> & { id: string; status?: string | null };
type LabelListRow = Record<string, unknown> & { document_id: string };
type SummaryListRow = Record<string, unknown> & { document_id: string };

const documentListQuerySchema = z.object({
  limit: queryInteger({ fallback: 100, min: 1, max: 200 }),
  offset: queryInteger({ fallback: 0, min: 0, max: 1_000_000 }),
  q: z.string().optional().default("").transform(safeSearchTerm),
  status: z
    .string()
    .optional()
    .default("")
    .transform((value) => value.trim()),
  includeMeta: queryBoolean({ defaultValue: true }),
});

function ilikePattern(value: string) {
  return `%${value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&")}%`;
}

function safeSearchTerm(value: string) {
  return value
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function indexingState(documents: DocumentListRow[]) {
  const active = documents.some((document) => ACTIVE_DOCUMENT_STATUSES.has(String(document.status ?? "")));
  return {
    active,
    pollAfterMs: active ? ACTIVE_INDEXING_POLL_MS : null,
  };
}

function documentsResponse(payload: Record<string, unknown>, indexing: ReturnType<typeof indexingState>) {
  return NextResponse.json(
    {
      ...payload,
      indexing,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Indexing-Active": String(indexing.active),
        "X-Poll-After-Ms": String(indexing.pollAfterMs ?? ""),
      },
    },
  );
}

export async function GET(request: Request) {
  try {
    if (isDemoMode()) {
      return documentsResponse({ documents: demoDocuments, demoMode: true }, { active: false, pollAfterMs: null });
    }

    const {
      limit,
      offset,
      q: search,
      status,
      includeMeta,
    } = parseRequestQuery(request, documentListQuerySchema, "Invalid document list query.");

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);
    let query = withOwnerReadScope(
      supabase.from("documents").select(DOCUMENT_LIST_COLUMNS, { count: "exact" }),
      access.ownerId,
    )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && VALID_STATUSES.has(status)) {
      query = query.eq("status", status);
    }
    if (search) {
      const pattern = ilikePattern(search);
      query = query.or(`title.ilike.${pattern},file_name.ilike.${pattern}`);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);
    const documents = (data ?? []) as unknown as DocumentListRow[];
    const documentIds = documents.map((document) => document.id);
    const indexing = indexingState(documents);

    const pagination = {
      limit,
      offset,
      total: count ?? documents.length,
      nextOffset: offset + documents.length,
      hasMore: count === null ? documents.length === limit : offset + documents.length < count,
    };

    if (documentIds.length === 0 || !includeMeta) {
      return documentsResponse({ documents, pagination }, indexing);
    }

    const [labelsResult, summariesResult] = await Promise.all([
      supabase.from("document_labels").select(LABEL_LIST_COLUMNS).in("document_id", documentIds),
      supabase.from("document_summaries").select(SUMMARY_LIST_COLUMNS).in("document_id", documentIds),
    ]);

    if (labelsResult.error) throw new Error(labelsResult.error.message);
    if (summariesResult.error) throw new Error(summariesResult.error.message);

    const labelsByDocument = new Map<string, unknown[]>();
    for (const label of (labelsResult.data ?? []) as unknown as LabelListRow[]) {
      const existing = labelsByDocument.get(label.document_id) ?? [];
      existing.push(label);
      labelsByDocument.set(label.document_id, existing);
    }
    const summariesByDocument = new Map(
      ((summariesResult.data ?? []) as unknown as SummaryListRow[]).map((summary) => [summary.document_id, summary]),
    );

    return documentsResponse(
      {
        documents: documents.map((document) => ({
          ...document,
          labels: labelsByDocument.get(document.id) ?? [],
          summary: summariesByDocument.get(document.id) ?? null,
        })),
        pagination,
      },
      indexing,
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
