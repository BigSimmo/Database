import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const ACTIVE_BATCH_STATUSES = new Set(["queued", "processing"]);
const ACTIVE_INDEXING_POLL_MS = 5_000;

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
    if (isDemoMode()) return batchesResponse([], { demoMode: true });

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data, error } = await supabase
      .from("import_batches")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return batchesResponse((data ?? []) as unknown as BatchRow[]);
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
