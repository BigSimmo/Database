import { z } from "zod";
import { logger } from "@/lib/logger";
import { normalizeOptionalSourceMetadata } from "@/lib/source-metadata";
import type { SearchResult } from "@/lib/types";

/**
 * Runtime shape contract for a row returned by a retrieval RPC.
 *
 * Retrieval rows are untrusted external data, not a compile-time guarantee. The RPCs are
 * versioned (`*_v2` with a legacy fallback) and the live database has been observed to
 * drift from the migrations in this repo — `docs/outstanding-issues.md` `#316` records ten
 * retrieval RPC bodies diverging, with weekly live-drift red since 2026-07-26. Before this
 * contract existed, `rag.ts` asserted those rows straight into the ranking pipeline with a
 * bare `as SearchResult[]`, so a renamed column or a numeric returned as a string did not
 * fail — it misranked or mis-cited silently, which is the worst failure mode for a clinical
 * reference surface.
 *
 * The schema is deliberately asymmetric:
 *
 * - **Strict on the ranking, citation, and evidence fields.** Every required field except
 *   `source_metadata` is `not null` in `supabase/schema.sql`, so requiring it cannot reject a
 *   row that works today. `source_metadata` is the exception: `documents.metadata` is `not null`
 *   `jsonb default '{}'::jsonb` without a `check (jsonb_typeof(metadata) = 'object')` constraint,
 *   so bare `jsonb` in postgres permits arrays and scalars. Pinning it to an object via this
 *   contract guarantees structural object validation at runtime rather than relying solely on
 *   database column constraints. Measured 2026-08-15, all 2851 live documents are objects.
 *   The four score fields are `.nullish()` — absent or
 *   null already flows through the downstream `?? 0` handling unchanged — but a *string where
 *   a number belongs* is rejected, which is precisely the silent-misranking case this exists
 *   to catch.
 * - **Loose about everything else.** Column sets genuinely differ between RPC versions
 *   (`retrieval_synopsis` is absent from the older base hybrid function; `document_labels`
 *   and `document_summary` only appear on `match_document_chunks_v2`). `z.looseObject`
 *   preserves unknown keys rather than stripping them, so a harmless schema difference
 *   never becomes an outage or silent data loss.
 */
const retrievalImageSchema = z.looseObject({
  id: z.string().min(1),
  page_number: z.number().int().nullable(),
  storage_path: z.string(),
  caption: z.string(),
});

// Deliberately `.nullable()`, not `.nullish()`: the key must be PRESENT (object or null).
// This is the one field pinned stricter than the rest so an RPC whose column set drifts
// (source_metadata dropped from the SELECT) fails loudly as RetrievalRowShapeError instead
// of silently degrading every citation to "unknown" governance defaults. Tranche 1 decision
// (PR #1946, "throw on mismatch"); PR #2107 loosened it to `.nullish()` and this PR
// restores it. See docs/outstanding-issues.md #343 for the constraint-backing follow-up.
const sourceMetadataSchema = z
  .record(z.string(), z.unknown(), {
    message: "source_metadata must be a JSON object",
  })
  .nullable();

const retrievalRowSchema = z.looseObject({
  id: z.string().min(1),
  document_id: z.string().min(1),
  title: z.string(),
  file_name: z.string(),
  page_number: z.number().int().nullable(),
  chunk_index: z.number().int(),
  section_heading: z.string().nullable(),
  content: z.string(),
  image_ids: z.array(z.string()),
  source_metadata: sourceMetadataSchema,
  images: z.array(retrievalImageSchema),
  similarity: z.number().nullish(),
  text_rank: z.number().nullish(),
  hybrid_score: z.number().nullish(),
  rrf_score: z.number().nullish(),
});

const retrievalRowsSchema = z.array(retrievalRowSchema);

/** Cap on reported issues; a wholesale shape change would otherwise report one per row. */
const MAX_REPORTED_ISSUES = 5;

/**
 * Thrown when a retrieval RPC returns rows that do not satisfy the ranking contract.
 *
 * The message carries only Zod issue paths and codes — never a row value. Retrieval rows
 * contain clinical document text, so echoing one into a log or an error response would
 * leak source content past the privacy boundary that `query-privacy.ts` maintains.
 */
export class RetrievalRowShapeError extends Error {
  readonly rpc: string;
  readonly issues: string[];

  constructor(rpc: string, issues: string[]) {
    super(`Retrieval RPC "${rpc}" returned rows that do not match the ranking contract: ${issues.join("; ")}`);
    this.name = "RetrievalRowShapeError";
    this.rpc = rpc;
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
 * Validate retrieval RPC rows before they enter the ranking pipeline.
 *
 * This asserts rather than transforms: on success the caller keeps the original array and
 * row objects, so object identity, key order, and nested `images` / `source_metadata`
 * references are unchanged from what the RPC returned. That matters because ranking is a
 * live-validated protected surface (`docs/rag-behaviour/`) — validation must be observable
 * only when the data is already wrong.
 *
 * Logs before throwing so drift stays visible even where a caller degrades: the vector
 * fallback in `rag.ts` catches retrieval failures and falls back to lexical results when it
 * has them, which would otherwise swallow the signal entirely.
 */
export function assertRetrievalRows(rows: unknown, rpc: string): asserts rows is SearchResult[] {
  assertRowsAgainst(retrievalRowsSchema, rows, rpc);
}

/** Shared validate-log-throw step. Kept separate so every row contract fails identically. */
function assertRowsAgainst(schema: z.ZodType, rows: unknown, rpc: string): void {
  const parsed = schema.safeParse(rows);
  if (parsed.success) return;
  const issues = describeIssues(parsed.error);
  logger.error("retrieval_row_shape_mismatch", {
    rpc,
    issues,
    rowCount: Array.isArray(rows) ? rows.length : null,
  });
  throw new RetrievalRowShapeError(rpc, issues);
}

/**
 * Signal rows from `match_document_embedding_fields_hybrid` — not `SearchResult`s.
 *
 * These carry a chunk id plus scores; `loadChunksForSignalMatches` then loads the real chunk.
 * A wrong `source_chunk_id` loads the wrong evidence, and the mapping coerces scores with
 * `Number(row.similarity ?? 0)`, which turns a stringified score into a silently different
 * number rather than an error. Both are validated here; `field_type` is only a provenance
 * label, so it stays permissive.
 */
const embeddingFieldRowSchema = z.looseObject({
  source_chunk_id: z.string().nullable(),
  field_type: z.string().nullable(),
  similarity: z.number().nullish(),
  text_rank: z.number().nullish(),
  hybrid_score: z.number().nullish(),
});

export type EmbeddingFieldSignalRow = z.infer<typeof embeddingFieldRowSchema>;

/** Validate embedding-field signal rows before they select chunks and scores. */
export function assertEmbeddingFieldRows(rows: unknown, rpc: string): asserts rows is EmbeddingFieldSignalRow[] {
  assertRowsAgainst(z.array(embeddingFieldRowSchema), rows, rpc);
}

/**
 * Index-unit rows from `match_document_index_units_hybrid`.
 *
 * The fields that select a chunk, control scoring, or label extraction are backed by
 * constraints on `public.document_index_units` in `supabase/schema.sql`: `unit_type`, `title`,
 * `content` and `extraction_mode` are `not null`, and both `unit_type` and `extraction_mode`
 * carry `check` constraints — so the enum below cannot reject a row the database would accept.
 * `source_span` and `metadata` are unconstrained `jsonb`, so they accept any JSON value rather
 * than turning a non-object provenance value into a retrieval outage. `heading_path` and
 * `normalized_terms` stay `.nullish()` to match the `?? []` handling the caller already applies.
 */
const indexUnitRowSchema = z.looseObject({
  id: z.string().min(1),
  document_id: z.string().min(1),
  source_chunk_id: z.string().nullable(),
  source_image_id: z.string().nullable(),
  unit_type: z.string().min(1),
  title: z.string(),
  content: z.string(),
  page_start: z.number().int().nullable(),
  page_end: z.number().int().nullable(),
  heading_path: z.array(z.string()).nullish(),
  normalized_terms: z.array(z.string()).nullish(),
  source_span: z.json().nullish(),
  quality_score: z.number().nullable(),
  extraction_mode: z.enum(["deterministic", "model_heavy", "hybrid"]),
  metadata: z.json().nullish(),
  similarity: z.number().nullish(),
  text_rank: z.number().nullish(),
  hybrid_score: z.number().nullish(),
});

export type IndexUnitSignalRow = z.infer<typeof indexUnitRowSchema>;

/** Validate index-unit signal rows before they select chunks, scores, and unit provenance. */
export function assertIndexUnitRows(rows: unknown, rpc: string): asserts rows is IndexUnitSignalRow[] {
  assertRowsAgainst(z.array(indexUnitRowSchema), rows, rpc);
}

/**
 * Build and validate the locally retrieved rows used as document-summary context.
 *
 * `similarity: 1` here is a constant, not a measured cosine: `summarizeDocument` loads every
 * committed chunk of one document, so there is no query to score against — the document IS the
 * query. The `similarity_origin: "document_context"` tag makes that provenance explicit rather
 * than leaving a fabricated 1.0 indistinguishable from a perfect vector match (H5a live
 * residual, `docs/clinical-hazard-analysis.md`; owner decision 2026-08-17, Option B).
 *
 * The tag is deliberately NOT `"synthetic_text"`. That value marks scores imputed from lexical
 * or structural match strength on the general answer path, where a title hit can masquerade as
 * semantic evidence; `deriveConfidence` (`rag-answer-support.ts`) therefore excludes it from the
 * "high" bar. This route has no match strength to inflate and its citations are verified by the
 * same grounding pipeline, so the confidence derivation is unchanged and the "high" label stays.
 * Reusing `"synthetic_text"` here would silently cap every document summary at "medium" —
 * recorded as rejected Option A. `tests/rag-score.test.ts` pins both halves of that split.
 */
export function buildDocumentSummaryResults(
  chunks: unknown[],
  document: { title: string; file_name: string; metadata?: unknown },
): SearchResult[] {
  const results = chunks.map((chunk) => ({
    ...(chunk as object),
    title: document.title,
    file_name: document.file_name,
    source_metadata: normalizeOptionalSourceMetadata(document.metadata),
    similarity: 1,
    similarity_origin: "document_context" as const,
    images: [],
  }));
  assertRetrievalRows(results, "document_summary_context");
  return results;
}
