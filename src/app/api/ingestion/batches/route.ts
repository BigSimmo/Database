import { z } from "zod";
import {
  ACTIVE_INDEXING_POLL_MS,
  countActiveRows,
  emptyPagination,
  indexingListResponse,
  offsetPagination,
  parseStatusRows,
  type StatusRow,
} from "@/lib/api-list-response";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

const ACTIVE_BATCH_STATUSES = new Set(["queued", "processing"]);
const ingestionBatchesQuerySchema = z.object({
  limit: queryInteger({ fallback: 20, min: 1, max: 200 }),
  offset: queryInteger({ fallback: 0, min: 0, max: 10_000 }),
});

type BatchRow = StatusRow;

function batchesResponse(batches: BatchRow[], extra: Record<string, unknown> = {}) {
  const activeBatchCount = countActiveRows(batches, ACTIVE_BATCH_STATUSES);
  const hasActiveBatches = activeBatchCount > 0;
  const pollAfterMs = hasActiveBatches ? ACTIVE_INDEXING_POLL_MS : null;
  return indexingListResponse(
    {
      batches,
      activeBatchCount,
      hasActiveBatches,
      pollAfterMs,
      ...extra,
    },
    { active: hasActiveBatches, pollAfterMs },
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
        pagination: emptyPagination(limit, offset),
      });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase, { administrator: true });
    const { data, error, count } = await supabase
      .from("import_batches")
      .select("*", { count: "exact" })
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    const batches = parseStatusRows(data);
    return batchesResponse(batches, {
      pagination: offsetPagination({ limit, offset, pageLength: batches.length, count }),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
