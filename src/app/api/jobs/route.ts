import { z } from "zod";
import {
  ACTIVE_INDEXING_POLL_MS,
  countActiveRows,
  indexingListResponse,
  offsetPagination,
  parseStatusRows,
  type StatusRow,
} from "@/lib/api-list-response";
import { demoJobs } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_JOB_STATUSES = new Set(["pending", "processing"]);
const jobsQuerySchema = z.object({
  limit: queryInteger({ fallback: 30, min: 1, max: 200 }),
  offset: queryInteger({ fallback: 0, min: 0, max: 10_000 }),
});

type JobRow = StatusRow;

function jobsResponse(jobs: JobRow[], extra: Record<string, unknown> = {}) {
  const activeJobCount = countActiveRows(jobs, ACTIVE_JOB_STATUSES);
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
    const { limit, offset } = parseRequestQuery(request, jobsQuerySchema, "Invalid jobs query.");
    if (isDemoMode()) {
      const jobs = demoJobs.slice(offset, offset + limit);
      return jobsResponse(jobs, {
        demoMode: true,
        pagination: offsetPagination({ limit, offset, pageLength: jobs.length, count: demoJobs.length }),
      });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase, { administrator: true });
    const { data, error, count } = await supabase
      .from("ingestion_jobs")
      .select("*, documents!inner(title,file_name,status)", { count: "exact" })
      .eq("documents.owner_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    const jobs = parseStatusRows(data);
    return jobsResponse(jobs, {
      pagination: offsetPagination({ limit, offset, pageLength: jobs.length, count }),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    // A partially-configured production (isDemoMode() false but createAdminClient throws
    // "Missing server environment") must surface as a real error rather than silently serving
    // unauthenticated demo jobs, which masked the misconfiguration and returned fake data (S11/H6).
    return jsonError(error);
  }
}
