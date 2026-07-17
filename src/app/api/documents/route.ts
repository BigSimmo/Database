import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { demoDocuments } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import {
  callerOwnsDocumentRow,
  enforceDocumentReadRateLimit,
  redactNonOwnedDocumentFields,
  withOwnerReadScope,
} from "@/lib/public-api-access";
import { parseRequestQuery, queryBoolean, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

const PUBLIC_DOCUMENT_LIST_COLUMNS = [
  "id",
  "title",
  "description",
  "file_name",
  "file_type",
  "status",
  "page_count",
  "chunk_count",
  "image_count",
  "created_at",
  "updated_at",
].join(",");

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

const PUBLIC_LABEL_LIST_COLUMNS = [
  "id",
  "document_id",
  "label",
  "label_type",
  "source",
  "confidence",
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

const PUBLIC_SUMMARY_LIST_COLUMNS = ["id", "document_id", "summary", "clinical_specifics", "generated_at"].join(",");

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

type DocumentListRow = Record<string, unknown> & { id: string; owner_id?: unknown; status?: string | null };
type LabelListRow = Record<string, unknown> & { document_id: string };
type SummaryListRow = Record<string, unknown> & { document_id: string };

function projectPublicFields<T extends Record<string, unknown>>(row: T, columns: string): Partial<T> {
  const projected: Record<string, unknown> = {};
  for (const field of columns.split(",")) {
    if (Object.hasOwn(row, field)) projected[field] = row[field];
  }
  return projected as Partial<T>;
}

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
    const { access, rateLimit } = await enforceDocumentReadRateLimit(request, supabase);
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Document requests are rate limited. Try again shortly.", rateLimit);
    }

    const effectiveIncludeMeta = access.authenticated ? includeMeta : false;
    const listColumns = access.authenticated ? DOCUMENT_LIST_COLUMNS : PUBLIC_DOCUMENT_LIST_COLUMNS;
    let query = withOwnerReadScope(supabase.from("documents").select(listColumns, { count: "exact" }), access.ownerId)
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

    // An `offset` past the end of the result set makes PostgREST return PGRST103
    // ("Requested range not satisfiable"). That is an empty page, not a server
    // error, so return an empty page instead of throwing a 500.
    if (error && error.code !== "PGRST103") throw new Error(error.message);
    // An authenticated caller reads PUBLIC (owner_id IS NULL) documents alongside their own via
    // withOwnerReadScope. Redact operator-internal storage fields on the rows they do not own so a
    // shared public document never exposes its owner's storage_path/content_hash/etc. (S1/D1).
    const rawDocuments = (error ? [] : (data ?? [])) as unknown as DocumentListRow[];
    const ownedDocumentIds = new Set(
      rawDocuments.filter((document) => callerOwnsDocumentRow(document, access.ownerId)).map((document) => document.id),
    );
    const publicDocumentIds = rawDocuments
      .filter((document) => !ownedDocumentIds.has(document.id))
      .map((document) => document.id);
    const documents = rawDocuments.map((document) => redactNonOwnedDocumentFields(document, access.ownerId));
    const documentIds = documents.map((document) => document.id);
    const indexing = indexingState(documents);

    const pagination = {
      limit,
      offset,
      total: count ?? documents.length,
      nextOffset: offset + documents.length,
      hasMore: count === null ? documents.length === limit : offset + documents.length < count,
    };

    if (documentIds.length === 0 || !effectiveIncludeMeta) {
      return documentsResponse({ documents, pagination }, indexing);
    }

    const ownedIds = [...ownedDocumentIds];
    const emptyResult = () => Promise.resolve({ data: [], error: null });
    const [ownedLabelsResult, publicLabelsResult, ownedSummariesResult, publicSummariesResult] = await Promise.all([
      ownedIds.length
        ? supabase.from("document_labels").select(LABEL_LIST_COLUMNS).in("document_id", ownedIds)
        : emptyResult(),
      publicDocumentIds.length
        ? supabase.from("document_labels").select(PUBLIC_LABEL_LIST_COLUMNS).in("document_id", publicDocumentIds)
        : emptyResult(),
      ownedIds.length
        ? supabase.from("document_summaries").select(SUMMARY_LIST_COLUMNS).in("document_id", ownedIds)
        : emptyResult(),
      publicDocumentIds.length
        ? supabase.from("document_summaries").select(PUBLIC_SUMMARY_LIST_COLUMNS).in("document_id", publicDocumentIds)
        : emptyResult(),
    ]);

    for (const result of [ownedLabelsResult, publicLabelsResult, ownedSummariesResult, publicSummariesResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const labelsByDocument = new Map<string, unknown[]>();
    const labelRows = [
      ...(ownedLabelsResult.data ?? []),
      ...(publicLabelsResult.data ?? []),
    ] as unknown as LabelListRow[];
    for (const label of labelRows) {
      const existing = labelsByDocument.get(label.document_id) ?? [];
      existing.push(
        ownedDocumentIds.has(label.document_id) ? label : projectPublicFields(label, PUBLIC_LABEL_LIST_COLUMNS),
      );
      labelsByDocument.set(label.document_id, existing);
    }
    const summariesByDocument = new Map(
      [...(ownedSummariesResult.data ?? []), ...(publicSummariesResult.data ?? [])].map((value) => {
        const summary = value as unknown as SummaryListRow;
        return [
          summary.document_id,
          ownedDocumentIds.has(summary.document_id)
            ? summary
            : projectPublicFields(summary, PUBLIC_SUMMARY_LIST_COLUMNS),
        ];
      }),
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
