import { loadEnvConfig } from "@next/env";
import { formatSupabaseUnavailableError, isSupabaseUnavailableError, probeSupabaseHealth } from "@/lib/supabase/health";

loadEnvConfig(process.cwd());

type CountResult = {
  count: number | null;
  error: { message?: string } | null;
};

function unavailableMessage(error: unknown) {
  return isSupabaseUnavailableError(error) ? formatSupabaseUnavailableError(error) : null;
}

async function safeCount(label: string, query: PromiseLike<CountResult>) {
  try {
    const result = await query;
    if (result.error) {
      return { label, count: null, error: result.error.message ?? "Supabase query failed." };
    }
    return { label, count: result.count ?? 0, error: null };
  } catch (error) {
    return { label, count: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const [{ requireServerEnv }, { createAdminClient }] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/supabase/admin"),
  ]);
  requireServerEnv();
  const supabase = createAdminClient();

  const health = await probeSupabaseHealth(supabase);
  if (!health.ok) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          status: "supabase_unavailable",
          error: health.message,
          recommendation: "Do not run migrations, workers, or evals. Retry after Supabase can answer a trivial query.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const [
    indexed,
    queued,
    processingDocuments,
    failedDocuments,
    pendingJobs,
    processingJobs,
    failedJobs,
    chunksWithSynopsis,
  ] = await Promise.all([
    safeCount("documents_indexed", supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "indexed")),
    safeCount("documents_queued", supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "queued")),
    safeCount(
      "documents_processing",
      supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "processing"),
    ),
    safeCount("documents_failed", supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "failed")),
    safeCount("jobs_pending", supabase.from("ingestion_jobs").select("id", { count: "exact", head: true }).eq("status", "pending")),
    safeCount(
      "jobs_processing",
      supabase.from("ingestion_jobs").select("id", { count: "exact", head: true }).eq("status", "processing"),
    ),
    safeCount("jobs_failed", supabase.from("ingestion_jobs").select("id", { count: "exact", head: true }).eq("status", "failed")),
    safeCount(
      "chunks_with_retrieval_synopsis",
      supabase
        .from("document_chunks")
        .select("id", { count: "exact", head: true })
        .not("retrieval_synopsis", "is", null)
        .neq("retrieval_synopsis", ""),
    ),
  ]);

  const { data: openJobs, error: jobsError } = await supabase
    .from("ingestion_jobs")
    .select("id,document_id,status,stage,attempt_count,max_attempts,locked_at,next_run_at,error_message")
    .in("status", ["pending", "processing", "failed"])
    .order("created_at", { ascending: true })
    .limit(25);

  const counts = [
    indexed,
    queued,
    processingDocuments,
    failedDocuments,
    pendingJobs,
    processingJobs,
    failedJobs,
    chunksWithSynopsis,
  ];
  const countErrors = counts.filter((item) => item.error);
  const errors = [
    ...countErrors.map((item) => ({ label: item.label, error: unavailableMessage(item.error) ?? item.error })),
    ...(jobsError ? [{ label: "open_jobs", error: unavailableMessage(jobsError.message) ?? jobsError.message }] : []),
  ];

  console.log(
    JSON.stringify(
      {
        ok: countErrors.length === 0 && !jobsError,
        generatedAt: new Date().toISOString(),
        counts: Object.fromEntries(counts.map((item) => [item.label, item.count])),
        errors,
        openJobs: openJobs ?? [],
        recommendation:
          countErrors.length === 0 && !jobsError
            ? "If no jobs are processing unexpectedly, run npm run recover:ingestion -- --apply before resuming conservative worker:once."
            : "Fix the reported read errors before running workers or evals.",
      },
      null,
      2,
    ),
  );

  if (countErrors.length > 0 || jobsError) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
