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
 * - **Strict on the ranking, citation, and evidence fields.** The required chunk identity,
 *   provenance, and visual fields are `not null` in `supabase/schema.sql`, so requiring them
 *   cannot reject a row that works today. The four score fields are `.nullish()` — absent or
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
  source_metadata: z.record(z.string(), z.unknown()).nullable(),
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
  const parsed = retrievalRowsSchema.safeParse(rows);
  if (parsed.success) return;
  const issues = describeIssues(parsed.error);
  logger.error("retrieval_row_shape_mismatch", {
    rpc,
    issues,
    rowCount: Array.isArray(rows) ? rows.length : null,
  });
  throw new RetrievalRowShapeError(rpc, issues);
}

/** Build and validate the locally retrieved rows used as document-summary context. */
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
    images: [],
  }));
  assertRetrievalRows(results, "document_summary_context");
  return results;
}
