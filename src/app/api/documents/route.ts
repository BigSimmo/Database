import { z } from "zod";
import {
  ACTIVE_INDEXING_POLL_MS,
  indexingListResponse,
  offsetPagination,
  parseListRows,
  type OffsetPagination,
} from "@/lib/api-list-response";
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
  type OwnerScopedQuery,
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

const documentListRowSchema = z
  .object({
    id: z.string(),
    owner_id: z.unknown().optional(),
    status: z.string().nullable().optional(),
  })
  .passthrough();
const labelListRowSchema = z.object({ document_id: z.string() }).passthrough();
const summaryListRowSchema = z.object({ document_id: z.string() }).passthrough();

type DocumentListRow = z.infer<typeof documentListRowSchema>;

function projectPublicFields<T extends Record<string, unknown>>(row: T, columns: string): Partial<T> {
  const projected: Record<string, unknown> = {};
  for (const field of columns.split(",")) {
    if (Object.hasOwn(row, field)) projected[field] = row[field];
  }
  return projected as Partial<T>;
}

const documentListQuerySchema = z.object({
  limit: queryInteger({ fallback: 100, min: 1, max: 200 }),
  // Cap the offset at 10k (matching the jobs list) so a deep-offset request cannot force
  // PostgREST to skip through a million rows as a slow-query/DoS lever. `queryInteger` clamps.
  offset: queryInteger({ fallback: 0, min: 0, max: 10_000 }),
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
  return indexingListResponse({ ...payload, indexing }, indexing);
}

type DocumentListFilters = { ownerId: string | undefined; status: string; search: string };

/**
 * The two optional list filters, applied to whichever builder is passed in. The page read and
 * the total below are two separate PostgREST requests, so they share this one definition rather
 * than spelling the same filters out twice and risking a count over a different set of rows than
 * the page it belongs to.
 *
 * The owner scope is deliberately NOT folded in here: `withOwnerReadScope` stays written on each
 * `.from("documents")` chain itself, where the tenancy scan (`scripts/lib/tenancy-scan.mjs`) can
 * see it as the wrapper proof for that query. A scope hidden behind a helper reads to that scan
 * as an unscoped document read.
 */
function withDocumentListFilters<T extends OwnerScopedQuery<T>>(
  query: T,
  filters: Pick<DocumentListFilters, "status" | "search">,
): T {
  let filtered = query;
  if (filters.status && VALID_STATUSES.has(filters.status)) {
    filtered = filtered.eq("status", filters.status);
  }
  if (filters.search) {
    const pattern = ilikePattern(filters.search);
    filtered = filtered.or(`title.ilike.${pattern},file_name.ilike.${pattern}`);
  }
  return filtered;
}

/**
 * The exact number of documents the filters match, as the row-free `head: true` count this
 * repository uses elsewhere for a total (`/api/ingestion/jobs`, corpus health).
 *
 * Called only for the two pages whose total cannot be derived from the page itself (see the call
 * site), so it is a second round trip in those cases only. Being a second statement, it can be a
 * row or two out of step with the page beside it under a concurrent upload; that moves the
 * "Showing 150 of N" line and nothing else. A failed count degrades to `null`, which travels to
 * the client as an unknown total rather than failing a list request whose rows were read
 * successfully.
 */
async function exactDocumentListCount(
  supabase: ReturnType<typeof createAdminClient>,
  filters: DocumentListFilters,
): Promise<number | null> {
  const { count, error } = await withDocumentListFilters(
    withOwnerReadScope(supabase.from("documents").select("id", { count: "exact", head: true }), filters.ownerId),
    filters,
  );
  return error ? null : (count ?? null);
}

/**
 * The page's pagination envelope, with one deliberate difference from `offsetPagination`: a total
 * that could not be read stays `null` on the wire instead of collapsing to the length of the page
 * in hand.
 *
 * "Total unknown" and "total equals this page" are different claims, and only one of them is true
 * when a count read fails. A 5000-document corpus asked for `limit=150` would otherwise answer
 * `total: 150`, which the dashboard renders as "Showing 150 of 150" — a specific wrong number a
 * reader has no way to doubt. With `null` that line does not render at all, and `hasMore` still
 * carries the honest signal that a full page may have more behind it.
 */
function documentListPagination(args: {
  limit: number;
  offset: number;
  pageLength: number;
  count: number | null;
}): Omit<OffsetPagination, "total"> & { total: number | null } {
  return { ...offsetPagination(args), total: args.count };
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
    const listFilters: DocumentListFilters = { ownerId: access.ownerId, status, search };
    const query = withDocumentListFilters(
      withOwnerReadScope(supabase.from("documents").select(listColumns), access.ownerId),
      listFilters,
    )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;

    // PGRST103 ("Requested range not satisfiable") is an empty page, not a server error, so it
    // returns an empty page instead of throwing a 500. It is now a defensive branch rather than
    // the way an over-range offset arrives: PostgREST only rejects a range it can compare against
    // a total, and it has a total only when the request asked for a count. This page read no
    // longer does (see the count below), so an offset past the end comes back as an ordinary 200
    // with an empty array, handled where the total is derived.
    if (error && error.code !== "PGRST103") throw new Error(error.message);
    // An authenticated caller reads PUBLIC (owner_id IS NULL) documents alongside their own via
    // withOwnerReadScope. Redact operator-internal storage fields on the rows they do not own so a
    // shared public document never exposes its owner's storage_path/content_hash/etc. (S1/D1).
    const rawDocuments = parseListRows(error ? [] : data, documentListRowSchema);
    const ownedDocumentIds = new Set(
      rawDocuments.filter((document) => callerOwnsDocumentRow(document, access.ownerId)).map((document) => document.id),
    );
    const publicDocumentIds = rawDocuments
      .filter((document) => !ownedDocumentIds.has(document.id))
      .map((document) => document.id);
    const documents = rawDocuments.map((document) => redactNonOwnedDocumentFields(document, access.ownerId));
    const documentIds = documents.map((document) => document.id);
    const indexing = indexingState(documents);

    // `count: "exact"` used to ride along on the page read, which made PostgREST run a second
    // full aggregate over the filtered set on EVERY request — including the common one where a
    // caller's whole corpus fits inside a single page and the total was already known. A short
    // page that starts inside the result set IS its end, so its exact total is `offset` plus the
    // rows returned, and that page needs no count at all.
    //
    // Two pages cannot describe themselves, and both still pay for one. A FULL page may have rows
    // behind it. An EMPTY page at a non-zero offset is past the end: `offset + 0` would report
    // that the corpus ends exactly where the caller happened to look, so a 320-document corpus
    // read at `offset=1000` would answer `total: 1000`. Deep paging past the end is rare enough
    // that counting there costs almost nothing, and it is the only way to answer it correctly.
    const count = error
      ? // The only error reaching here is the range rejection handled above, which carries no count.
        null
      : documents.length === limit || (documents.length === 0 && offset > 0)
        ? await exactDocumentListCount(supabase, listFilters)
        : offset + documents.length;
    const pagination = documentListPagination({ limit, offset, pageLength: documents.length, count });

    if (documentIds.length === 0 || !effectiveIncludeMeta) {
      return documentsResponse({ documents, pagination }, indexing);
    }

    const ownedIds = [...ownedDocumentIds];
    const ownedLabelsPromises = [];
    for (let i = 0; i < ownedIds.length; i += 100) {
      ownedLabelsPromises.push(
        supabase
          .from("document_labels")
          .select(LABEL_LIST_COLUMNS)
          .in("document_id", ownedIds.slice(i, i + 100)),
      );
    }
    const publicLabelsPromises = [];
    for (let i = 0; i < publicDocumentIds.length; i += 100) {
      publicLabelsPromises.push(
        supabase
          .from("document_labels")
          .select(PUBLIC_LABEL_LIST_COLUMNS)
          .in("document_id", publicDocumentIds.slice(i, i + 100)),
      );
    }
    const ownedSummariesPromises = [];
    for (let i = 0; i < ownedIds.length; i += 100) {
      ownedSummariesPromises.push(
        supabase
          .from("document_summaries")
          .select(SUMMARY_LIST_COLUMNS)
          .in("document_id", ownedIds.slice(i, i + 100)),
      );
    }
    const publicSummariesPromises = [];
    for (let i = 0; i < publicDocumentIds.length; i += 100) {
      publicSummariesPromises.push(
        supabase
          .from("document_summaries")
          .select(PUBLIC_SUMMARY_LIST_COLUMNS)
          .in("document_id", publicDocumentIds.slice(i, i + 100)),
      );
    }

    const [ownedLabelsResults, publicLabelsResults, ownedSummariesResults, publicSummariesResults] = await Promise.all([
      Promise.all(ownedLabelsPromises),
      Promise.all(publicLabelsPromises),
      Promise.all(ownedSummariesPromises),
      Promise.all(publicSummariesPromises),
    ]);

    for (const res of [
      ...ownedLabelsResults,
      ...publicLabelsResults,
      ...ownedSummariesResults,
      ...publicSummariesResults,
    ]) {
      if (res.error) throw new Error(res.error.message);
    }

    const labelsByDocument = new Map<string, unknown[]>();
    const labelRows = parseListRows(
      [...ownedLabelsResults.flatMap((res) => res.data ?? []), ...publicLabelsResults.flatMap((res) => res.data ?? [])],
      labelListRowSchema,
    );
    for (const label of labelRows) {
      const existing = labelsByDocument.get(label.document_id) ?? [];
      existing.push(
        ownedDocumentIds.has(label.document_id) ? label : projectPublicFields(label, PUBLIC_LABEL_LIST_COLUMNS),
      );
      labelsByDocument.set(label.document_id, existing);
    }
    const summaryRows = parseListRows(
      [
        ...ownedSummariesResults.flatMap((res) => res.data ?? []),
        ...publicSummariesResults.flatMap((res) => res.data ?? []),
      ],
      summaryListRowSchema,
    );
    const summariesByDocument = new Map(
      summaryRows.map((summary) => [
        summary.document_id,
        ownedDocumentIds.has(summary.document_id) ? summary : projectPublicFields(summary, PUBLIC_SUMMARY_LIST_COLUMNS),
      ]),
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
