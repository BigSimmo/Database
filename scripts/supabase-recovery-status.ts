import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type CountResult = {
  count: number | null;
  error: { message?: string } | null;
};

async function safeCount(label: string, query: PromiseLike<CountResult>) {
  try {
    const result = await query;
    return { label, count: result.error ? null : (result.count ?? 0), error: result.error?.message ?? null };
  } catch (error) {
    return { label, count: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const [{ env, requireServerEnv }, { createAdminClient }, { probeSupabaseHealth }] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/supabase/admin"),
    import("@/lib/supabase/health"),
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
          checkedAt: health.checkedAt,
          error: health.message,
          recommendation:
            "Do not run migrations, imports, workers, recovery mutations, or evals. Retry later or contact Supabase support if this persists for more than 30 minutes with local workers stopped.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const staleCutoff = new Date(Date.now() - env.WORKER_STALE_AFTER_MINUTES * 60_000).toISOString();
  const [pendingJobs, processingJobs, failedJobs, staleJobs, queuedDocuments, failedDocuments] = await Promise.all([
    safeCount("jobs_pending", supabase.from("ingestion_jobs").select("id", { count: "exact", head: true }).eq("status", "pending")),
    safeCount(
      "jobs_processing",
      supabase.from("ingestion_jobs").select("id", { count: "exact", head: true }).eq("status", "processing"),
    ),
    safeCount("jobs_failed", supabase.from("ingestion_jobs").select("id", { count: "exact", head: true }).eq("status", "failed")),
    safeCount(
      "jobs_stale_processing",
      supabase
        .from("ingestion_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "processing")
        .lt("locked_at", staleCutoff),
    ),
    safeCount("documents_queued", supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "queued")),
    safeCount("documents_failed", supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "failed")),
  ]);

  const counts = [pendingJobs, processingJobs, failedJobs, staleJobs, queuedDocuments, failedDocuments];
  const errors = counts.filter((item) => item.error);
  const openJobs = (pendingJobs.count ?? 0) + (processingJobs.count ?? 0) + (failedJobs.count ?? 0);
  const recommendation = errors.length
    ? "Fix reported read errors before running workers or recovery."
    : openJobs === 0
      ? "Queue is clear. Run indexing checks or resume imports in small waves."
      : (staleJobs.count ?? 0) > 0 || (failedJobs.count ?? 0) > 0
        ? "Run npm run recover:ingestion -- --apply --limit 20, then npm run worker:once."
        : "Run npm run worker:once with conservative defaults.";

  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        status: errors.length ? "read_errors" : "ready",
        checkedAt: health.checkedAt,
        counts: Object.fromEntries(counts.map((item) => [item.label, item.count])),
        errors,
        recommendation,
      },
      null,
      2,
    ),
  );

  if (errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
