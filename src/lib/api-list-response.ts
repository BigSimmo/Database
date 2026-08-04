import { NextResponse } from "next/server";

/**
 * Shared shapes for the admin list endpoints (documents, jobs, ingestion jobs,
 * ingestion batches). They all page with `limit`/`offset`, report indexing
 * activity through the same `X-Indexing-Active` / `X-Poll-After-Ms` headers, and
 * must never be cached, so the pagination maths and response envelope live here
 * instead of being copied per route.
 */
export const ACTIVE_INDEXING_POLL_MS = 5_000;

export type StatusRow = Record<string, unknown> & { status?: string | null };

export type OffsetPagination = {
  limit: number;
  offset: number;
  total: number;
  nextOffset: number;
  hasMore: boolean;
};

/**
 * Builds the pagination envelope for an offset page. `count` is the PostgREST
 * exact count, which is null when the count could not be computed; in that case
 * a full page is assumed to have more rows behind it.
 */
export function offsetPagination({
  limit,
  offset,
  pageLength,
  count,
}: {
  limit: number;
  offset: number;
  pageLength: number;
  count: number | null;
}): OffsetPagination {
  return {
    limit,
    offset,
    total: count ?? pageLength,
    nextOffset: offset + pageLength,
    hasMore: count === null ? pageLength === limit : offset + pageLength < count,
  };
}

export function emptyPagination(limit: number, offset: number): OffsetPagination {
  return { limit, offset, total: 0, nextOffset: offset, hasMore: false };
}

export function countActiveRows(rows: StatusRow[], activeStatuses: ReadonlySet<string>) {
  return rows.filter((row) => activeStatuses.has(String(row.status ?? ""))).length;
}

/**
 * Wraps a list payload in the uncacheable JSON response the dashboard polls,
 * advertising whether indexing is still running and how soon to poll again.
 */
export function indexingListResponse(
  payload: Record<string, unknown>,
  indexing: { active: boolean; pollAfterMs: number | null },
) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Indexing-Active": String(indexing.active),
      "X-Poll-After-Ms": String(indexing.pollAfterMs ?? ""),
    },
  });
}
