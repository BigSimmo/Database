import { NextResponse } from "next/server";
import { demoJobs } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    if (isDemoMode()) {
      return jobsResponse(demoJobs, { demoMode: true });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data, error } = await supabase
      .from("ingestion_jobs")
      .select("*, documents!inner(title,file_name,status)")
      .eq("documents.owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);
    return jobsResponse((data ?? []) as unknown as JobRow[]);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    if (error instanceof Error && error.message.includes("Missing server environment")) {
      return jobsResponse(demoJobs, {
        demoMode: true,
        error: "Server environment is not configured; demo jobs are being served.",
      });
    }
    return jsonError(error);
  }
}
