import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const ACTIVE_JOB_STATUSES = new Set(["pending", "processing"]);
const ACTIVE_INDEXING_POLL_MS = 5_000;

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
    if (isDemoMode()) return jobsResponse([], { demoMode: true });

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const batchId = new URL(request.url).searchParams.get("batchId");

    let query = supabase
      .from("ingestion_jobs")
      .select("*, documents!inner(title,file_name,status,owner_id)")
      .eq("documents.owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (batchId) query = query.eq("batch_id", batchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return jobsResponse((data ?? []) as unknown as JobRow[]);
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
