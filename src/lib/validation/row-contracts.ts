import { z } from "zod";
import { logger } from "@/lib/logger";
import type { DocumentLabel, DocumentLabelType } from "@/lib/types";

/**
 * Runtime shape contracts for database rows and RPC payloads consumed by `src/app/api/**`.
 *
 * Route handlers had been asserting these shapes with a bare `as SomeRow[]`, which is a
 * compile-time claim about a live database that is known to drift: `docs/outstanding-issues.md`
 * `#316` records 20 missing indexes and 10 retrieval RPC bodies diverging from this repo's
 * migrations, with weekly live-drift red since 2026-07-26. A renamed column or a numeric
 * returned as a string then does not fail — it silently mis-scores, mis-filters, or mis-renders.
 * This module is the `src/app/api` counterpart of `src/lib/rag/rag-row-contracts.ts` and
 * deliberately duplicates that module's small validate-log-throw core rather than importing it,
 * so that hardening an API route never edits a protected RAG ranking surface.
 *
 * Every contract here follows the same two rules:
 *
 * - **`z.looseObject`, never `z.object`.** Zod strips unknown keys by default, which would be
 *   silent data loss whenever the live column set is ahead of this repo. Unknown keys pass
 *   through untouched.
 * - **Pin only what a constraint backs.** Each required field below is `not null` or carries a
 *   `check` in `supabase/schema.sql`, cited per contract, so requiring it cannot reject a row
 *   the database would accept today. Anything unconstrained stays permissive.
 */

/** Cap on reported issues; a wholesale shape change would otherwise report one per row. */
const MAX_REPORTED_ISSUES = 5;

/**
 * Thrown when a database row or RPC payload does not satisfy its route's contract.
 *
 * The message carries only Zod issue paths and codes — never a row value. These rows carry
 * clinical document text and owner identifiers, so echoing one into a log or an error response
 * would leak content past the privacy boundary `query-privacy.ts` maintains.
 */
export class ApiRowShapeError extends Error {
  readonly source: string;
  readonly issues: string[];

  constructor(source: string, issues: string[]) {
    super(`"${source}" returned data that does not match its route contract: ${issues.join("; ")}`);
    this.name = "ApiRowShapeError";
    this.source = source;
    this.issues = issues;
  }
}

function describeIssues(error: z.ZodError): string[] {
  const described = error.issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`);
  const remaining = error.issues.length - described.length;
  return remaining > 0 ? [...described, `and ${remaining} more`] : described;
}

/**
 * Shared validate-log-throw step. Kept separate so every contract fails identically, and logs
 * before throwing so drift stays visible even where a caller catches and degrades.
 */
function assertAgainst(schema: z.ZodType, value: unknown, source: string): void {
  const parsed = schema.safeParse(value);
  if (parsed.success) return;
  const issues = describeIssues(parsed.error);
  logger.error("api_row_shape_mismatch", {
    source,
    issues,
    rowCount: Array.isArray(value) ? value.length : null,
  });
  throw new ApiRowShapeError(source, issues);
}

/**
 * Columns shared by both in-document search paths, backed by `public.document_chunks`
 * in `supabase/schema.sql`: `chunk_index` and `content` are `not null`, `image_ids` is
 * `not null default '{}'`, and `id` is the primary key. `page_number` and `section_heading`
 * are nullable columns and stay `.nullable()`.
 *
 * The two score fields are `.nullish()` — absent or null already flows through the caller's
 * `Number(row.text_rank ?? 0)` handling unchanged — but a *string where a number belongs* is
 * rejected. That is the case worth catching: `scoreChunk` coerces with `Number(...)`, so a
 * stringified rank becomes a silently different score rather than an error, and `score`
 * orders the snippets a clinician reads.
 */
const documentChunkSearchBase = z.looseObject({
  id: z.string().min(1),
  page_number: z.number().int().nullable(),
  chunk_index: z.number().int(),
  section_heading: z.string().nullable(),
  content: z.string(),
  image_ids: z.array(z.string()).nullish(),
  text_rank: z.number().nullish(),
  trigram_score: z.number().nullish(),
});

/**
 * Rows from the `search_document_chunks` RPC.
 *
 * The RPC's `returns table (...)` in `supabase/schema.sql` lists exactly the eight columns
 * above — it returns neither `metadata` nor `index_generation_id`, because migration
 * `20260717130000_filter_search_document_chunks_committed_generation.sql` moved the
 * committed-generation filter into the SQL body itself. The route's client-side
 * `isCommittedGenerationMetadata` pass over these rows is therefore inert (it fails open on
 * absent generation data) and load-bearing only on the table fallback below. That is left
 * exactly as it behaves today; this contract only stops the shape claim from being unchecked.
 */
const documentChunkSearchRpcRowsSchema = z.array(documentChunkSearchBase);

/**
 * Rows from the `document_chunks` table fallback used when the RPC is unavailable.
 *
 * This path selects `metadata` and `index_generation_id` explicitly, and here the
 * committed-generation filter genuinely gates which chunks a clinician sees. `metadata` is
 * `not null` on the table but is bare `jsonb` with no `jsonb_typeof` check, so it is
 * deliberately **not** pinned to an object — the caller passes it to `committedIndexGeneration`,
 * which already accepts `unknown`. `index_generation_id` is a nullable `uuid` column.
 */
const documentChunkSearchTableRowsSchema = z.array(
  documentChunkSearchBase.extend({
    metadata: z.unknown(),
    index_generation_id: z.string().nullish(),
  }),
);

export type DocumentChunkSearchRow = z.infer<typeof documentChunkSearchBase> & {
  metadata?: unknown;
  index_generation_id?: string | null;
};

/** Validate `search_document_chunks` RPC rows before they are scored and ordered. */
export function assertDocumentChunkSearchRpcRows(rows: unknown): asserts rows is DocumentChunkSearchRow[] {
  assertAgainst(documentChunkSearchRpcRowsSchema, rows, "search_document_chunks");
}

/** Validate `document_chunks` fallback rows before generation filtering, scoring, and ordering. */
export function assertDocumentChunkSearchTableRows(rows: unknown): asserts rows is DocumentChunkSearchRow[] {
  assertAgainst(documentChunkSearchTableRowsSchema, rows, "document_chunks.portable_ilike_fallback");
}

/**
 * Rows from `public.document_labels`.
 *
 * The two enum pins are exactly the table's `check` constraints in `supabase/schema.sql`:
 * `label_type` is checked against the same fourteen values as `DocumentLabelType` in
 * `src/lib/types.ts`, and `source` against `('generated', 'manual')`. Both columns are plain
 * `text not null`, so the hand-written union in `DocumentLabel` was previously an unchecked
 * narrowing — an out-of-union `label_type` would have flowed straight into the clinical badge
 * and filter surfaces that switch on it. `confidence` is `real not null check (0..1)`, and
 * `label`/`document_id`/`id` are all `not null`.
 *
 * `metadata` is `not null` but is bare `jsonb` with no `jsonb_typeof` check, so it is left
 * unpinned rather than asserted to be an object. `DocumentLabel` types it as
 * `Record<string, unknown> | null`; that remains an unproven narrowing, unchanged by this
 * contract and flagged here rather than silently blessed.
 */
const documentLabelRowsSchema = z.array(
  z.looseObject({
    id: z.string().min(1),
    document_id: z.string().min(1),
    owner_id: z.string().nullish(),
    label: z.string(),
    // `satisfies` pins this list to `DocumentLabelType`, so widening the union without
    // widening the database `check` (or the reverse) fails the build rather than silently
    // admitting a label type the badge surfaces cannot render.
    label_type: z.enum([
      "site",
      "topic",
      "document_type",
      "medication",
      "risk",
      "setting",
      "workflow",
      "population",
      "service",
      "clinical_action",
      "care_phase",
      "document_intent",
      "content_feature",
      "custom",
    ] satisfies [DocumentLabelType, ...DocumentLabelType[]]),
    source: z.enum(["generated", "manual"]),
    confidence: z.number().min(0).max(1),
  }),
);

/** Validate `document_labels` rows before they reach clinical badge and filter surfaces. */
export function assertDocumentLabelRows(rows: unknown): asserts rows is DocumentLabel[] {
  assertAgainst(documentLabelRowsSchema, rows, "document_labels");
}

/**
 * The `search_schema_health` RPC payload.
 *
 * This RPC is declared `Returns: Json` in `src/lib/supabase/database.types.ts` — genuinely
 * unstructured as far as the client is concerned — so the route's previous
 * `(data ?? {}) as SearchSchemaHealth` was a structure claim with nothing behind it. The
 * function's `jsonb_build_object` in `supabase/schema.sql` always emits `ok`, `missing`,
 * `vector_extension_schema` and `checked_at`, so pinning them cannot reject a healthy
 * response. `vector_extension_schema` is a nullable local, and `checked_at` stays permissive
 * because the route never reads it.
 *
 * The caller already wraps this read in a `try`/`catch` that reports `needs_setup`, so a
 * mismatch degrades to the same status a falsy `ok` produces today — with a logged issue path
 * instead of a silent `Missing or stale search schema items: unknown.`
 */
const searchSchemaHealthSchema = z.looseObject({
  ok: z.boolean(),
  missing: z.array(z.string()),
  vector_extension_schema: z.string().nullish(),
  checked_at: z.unknown(),
});

export type SearchSchemaHealth = z.infer<typeof searchSchemaHealthSchema>;

/** Validate the `search_schema_health` payload before it drives the setup-status verdict. */
export function assertSearchSchemaHealth(value: unknown): asserts value is SearchSchemaHealth {
  assertAgainst(searchSchemaHealthSchema, value, "search_schema_health");
}
