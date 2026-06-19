import { loadEnvConfig } from "@next/env";
import type { IngestionRecoveryJob } from "@/lib/ingestion-recovery";

loadEnvConfig(process.cwd());

type RecoveryDocument = {
  status?: string | null;
  page_count?: number | null;
  chunk_count?: number | null;
};

function supabaseStageError(stage: string, error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const message =
    typeof record.message === "string" && record.message.trim().length > 0
      ? record.message
      : `Supabase operation failed during ${stage}`;
  const wrapped = new Error(message);
  wrapped.name = "SupabaseRecoveryError";
  Object.assign(wrapped, {
    stage,
    code: record.code,
    details: record.details,
    hint: record.hint,
  });
  return wrapped;
}

function parseArgs(argv: string[]) {
  const valueFor = (name: string) => {
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
    if (inline) return inline;
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    apply: argv.includes("--apply"),
    staleAfterMinutes: Number.parseInt(valueFor("stale-after-minutes") ?? "", 10),
    limit: Number.parseInt(valueFor("limit") ?? "", 10),
  };
}

async function main() {
  const [
    { env, requireServerEnv },
    { buildIngestionRecoveryPlan },
    { createAdminClient },
    { assertSupabaseHealthy, probeSupabaseHealth },
  ] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/ingestion-recovery"),
    import("@/lib/supabase/admin"),
    import("@/lib/supabase/health"),
  ]);
  requireServerEnv();
  const args = parseArgs(process.argv.slice(2));
  const staleAfterMinutes = Number.isFinite(args.staleAfterMinutes)
    ? args.staleAfterMinutes
    : env.WORKER_STALE_AFTER_MINUTES;
  const limit = Number.isFinite(args.limit) ? args.limit : 20;
  const supabase = createAdminClient();
  assertSupabaseHealthy(await probeSupabaseHealth(supabase), "Ingestion queue recovery");
  const { data, error } = await supabase
    .from("ingestion_jobs")
    .select("id,document_id,status,locked_at,documents(status,page_count,chunk_count)")
    .in("status", ["processing", "failed"])
    .order("created_at", { ascending: true });

  if (error) throw supabaseStageError("load open ingestion jobs", error);

  const jobs = (data ?? []).map((job) => ({
    ...job,
    documents: Array.isArray(job.documents) ? (job.documents[0] as RecoveryDocument | undefined) : job.documents,
  })) as IngestionRecoveryJob[];
  const plan = buildIngestionRecoveryPlan({ jobs, staleAfterMinutes });
  const actions = plan.actions.slice(0, limit);
  const resetDocumentIds = Array.from(
    new Set(actions.filter((action) => action.action === "retry").map((action) => action.documentId)),
  );

  console.log(
    JSON.stringify(
      {
        mode: args.apply ? "apply" : "dry-run",
        staleAfterMinutes,
        limit,
        scannedJobs: jobs.length,
        resetDocuments: resetDocumentIds.length,
        supersedeJobs: actions.filter((action) => action.action === "supersede").length,
        retryJobs: actions.filter((action) => action.action === "retry").length,
        remainingActions: Math.max(0, plan.actions.length - actions.length),
      },
      null,
      2,
    ),
  );

  if (!args.apply) {
    console.log("Dry run only. Re-run with --apply to mutate the ingestion queue.");
    return;
  }

  for (const documentId of resetDocumentIds) {
    const { error: resetError } = await supabase.rpc("reset_document_index", { p_document_id: documentId });
    if (resetError) throw supabaseStageError("reset document index", resetError);
    const { error: documentError } = await supabase
      .from("documents")
      .update({ status: "queued", error_message: null, page_count: 0, chunk_count: 0, image_count: 0 })
      .eq("id", documentId);
    if (documentError) throw supabaseStageError("reset document status", documentError);
  }

  for (const action of actions) {
    if (action.action === "supersede") {
      const { error: supersedeError } = await supabase
        .from("ingestion_jobs")
        .update({
          status: "completed",
          stage: "superseded by successful index",
          progress: 100,
          error_message: null,
          locked_at: null,
          locked_by: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", action.jobId);
      if (supersedeError) throw supabaseStageError("supersede sibling ingestion job", supersedeError);
      continue;
    }

    const { error: retryError } = await supabase
      .from("ingestion_jobs")
      .update({
        status: "pending",
        stage: "queued after recovery",
        progress: 0,
        attempt_count: 0,
        error_message: null,
        locked_at: null,
        locked_by: null,
        next_run_at: new Date().toISOString(),
        completed_at: null,
      })
      .eq("id", action.jobId);
    if (retryError) throw supabaseStageError("requeue ingestion job", retryError);
  }

  console.log("Ingestion queue recovery applied.");
}

main().catch((error) => {
  import("@/lib/privacy")
    .then(({ safeErrorLogDetails }) => {
      console.error("Ingestion queue recovery failed", safeErrorLogDetails(error));
      process.exitCode = 1;
    })
    .catch(() => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
});
