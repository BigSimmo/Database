import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

const ACTIVE_BATCH_STATUSES = new Set(["queued", "processing"]);
const ACTIVE_INDEXING_POLL_MS = 5_000;
const ingestionBatchesQuerySchema = z.object({
  limit: queryInteger({ fallback: 20, min: 1, max: 200 }),
  offset: queryInteger({ fallback: 0, min: 0, max: 10_000 }),
});

type BatchRow = Record<string, unknown> & { status?: string | null };

function batchesIndexingState(batches: BatchRow[]) {
  const activeBatchCount = batches.filter((batch) => ACTIVE_BATCH_STATUSES.has(String(batch.status ?? ""))).length;
  return {
    activeBatchCount,
    hasActiveBatches: activeBatchCount > 0,
    pollAfterMs: activeBatchCount > 0 ? ACTIVE_INDEXING_POLL_MS : null,
  };
}

function batchesResponse(batches: BatchRow[], extra: Record<string, unknown> = {}) {
  const indexing = batchesIndexingState(batches);
  return NextResponse.json(
    {
      batches,
      ...indexing,
      ...extra,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Indexing-Active": String(indexing.hasActiveBatches),
        "X-Poll-After-Ms": String(indexing.pollAfterMs ?? ""),
      },
    },
  );
}

export async function GET(request: Request) {
  try {
    const { limit, offset } = parseRequestQuery(
      request,
      ingestionBatchesQuerySchema,
      "Invalid ingestion batches query.",
    );
    if (isDemoMode()) {
      return batchesResponse([], {
        demoMode: true,
        pagination: { limit, offset, total: 0, nextOffset: offset, hasMore: false },
      });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data, error, count } = await supabase
      .from("import_batches")
      .select("*", { count: "exact" })
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    const batches = (data ?? []) as unknown as BatchRow[];
    return batchesResponse(batches, {
      pagination: {
        limit,
        offset,
        total: count ?? batches.length,
        nextOffset: offset + batches.length,
        hasMore: count === null ? batches.length === limit : offset + batches.length < count,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
