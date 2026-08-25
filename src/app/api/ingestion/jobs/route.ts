import { z } from "zod";
import {
  ACTIVE_INDEXING_POLL_MS,
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
import { optionalUuidQuery, parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

const ACTIVE_JOB_STATUSES = ["pending", "processing"];

const ingestionJobsQuerySchema = z.object({
  batchId: optionalUuidQuery(),
  limit: queryInteger({ fallback: 100, min: 1, max: 200 }),
  offset: queryInteger({ fallback: 0, min: 0, max: 10_000 }),
});

type JobRow = StatusRow;

function jobsResponse(jobs: JobRow[], activeJobCount: number, extra: Record<string, unknown> = {}) {
  const hasActiveJobs = activeJobCount > 0;
  const pollAfterMs = hasActiveJobs ? ACTIVE_INDEXING_POLL_MS : null;
  return indexingListResponse(
    {
      jobs,
      activeJobCount,
      hasActiveJobs,
      pollAfterMs,
      ...extra,
    },
    { active: hasActiveJobs, pollAfterMs },
  );
}

export async function GET(request: Request) {
  try {
    const { batchId, limit, offset } = parseRequestQuery(
      request,
      ingestionJobsQuerySchema,
      "Invalid ingestion jobs query.",
    );
    if (isDemoMode()) {
      return jobsResponse([], 0, {
        demoMode: true,
        pagination: emptyPagination(limit, offset),
      });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase, { administrator: true });

    let query = supabase
      .from("ingestion_jobs")
      .select("*, documents!inner(title,file_name,status,owner_id)", { count: "exact" })
      .eq("documents.owner_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    let activeCountQuery = supabase
      .from("ingestion_jobs")
      .select("id, documents!inner(owner_id)", { count: "exact", head: true })
      .eq("documents.owner_id", user.id)
      .in("status", ACTIVE_JOB_STATUSES);

    if (batchId) {
      query = query.eq("batch_id", batchId);
      activeCountQuery = activeCountQuery.eq("batch_id", batchId);
    }

    const [{ data, error, count }, { error: activeCountError, count: activeJobCount }] = await Promise.all([
      query,
      activeCountQuery,
    ]);
    if (error) throw new Error(error.message);
    if (activeCountError) throw new Error(activeCountError.message);
    if (typeof activeJobCount !== "number" || !Number.isInteger(activeJobCount) || activeJobCount < 0) {
      throw new Error("The active ingestion job count was unavailable.");
    }
    const jobs = parseStatusRows(data);
    return jobsResponse(jobs, activeJobCount, {
      pagination: offsetPagination({ limit, offset, pageLength: jobs.length, count }),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
