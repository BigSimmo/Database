import { NextResponse } from "next/server";
import { z } from "zod";
import { demoJobs } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_JOB_STATUSES = new Set(["pending", "processing"]);
const ACTIVE_INDEXING_POLL_MS = 5_000;
const jobsQuerySchema = z.object({
  limit: queryInteger({ fallback: 30, min: 1, max: 200 }),
  offset: queryInteger({ fallback: 0, min: 0, max: 10_000 }),
});

type JobRow = Record<string, unknown> & { status?: string | null };

function jobsIndexingState(jobs: JobRow[]) {
  const activeJobCount = jobs.filter((job) => ACTIVE_JOB_STATUSES.has(String(job.status ?? ""))).length;
  return {
    activeJobCount,
    hasActiveJobs: activeJobCount > 0,
    pollAfterMs: activeJobCount > 0 ? ACTIVE_INDEXING_POLL_MS : null,
  };
}

function jobsResponse(jobs: JobRow[], extra: Record<string, unknown> = {}) {
  const indexing = jobsIndexingState(jobs);
  return NextResponse.json(
    {
      jobs,
      ...indexing,
      ...extra,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Indexing-Active": String(indexing.hasActiveJobs),
        "X-Poll-After-Ms": String(indexing.pollAfterMs ?? ""),
      },
    },
  );
}

export async function GET(request: Request) {
  try {
    const { limit, offset } = parseRequestQuery(request, jobsQuerySchema, "Invalid jobs query.");
    if (isDemoMode()) {
      const jobs = demoJobs.slice(offset, offset + limit);
      return jobsResponse(jobs, {
        demoMode: true,
        pagination: {
          limit,
          offset,
          total: demoJobs.length,
          nextOffset: offset + jobs.length,
          hasMore: offset + jobs.length < demoJobs.length,
        },
      });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data, error, count } = await supabase
      .from("ingestion_jobs")
      .select("*, documents!inner(title,file_name,status)", { count: "exact" })
      .eq("documents.owner_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    const jobs = (data ?? []) as unknown as JobRow[];
    return jobsResponse(jobs, {
      pagination: {
        limit,
        offset,
        total: count ?? jobs.length,
        nextOffset: offset + jobs.length,
        hasMore: count === null ? jobs.length === limit : offset + jobs.length < count,
      },
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
