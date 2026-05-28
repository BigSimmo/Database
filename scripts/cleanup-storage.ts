import { loadEnvConfig } from "@next/env";
import { loadAdminClient } from "./eval-utils";

loadEnvConfig(process.cwd());

type CleanupArgs = {
  limit: number;
  dryRun: boolean;
};

type CleanupJob = {
  id: string;
  document_bucket: string | null;
  document_paths: string[] | null;
  image_bucket: string | null;
  image_paths: string[] | null;
  attempts: number;
};

function parseArgs(argv: string[]): CleanupArgs {
  const args: CleanupArgs = { limit: 50, dryRun: false };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--limit") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --limit");
      args.limit = Number.parseInt(value, 10);
      index += 1;
    }
  }

  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error("--limit must be a positive integer.");
  return args;
}

async function removePaths(args: { supabase: Awaited<ReturnType<typeof loadAdminClient>>; bucket: string; paths: string[] }) {
  let removed = 0;
  const warnings: string[] = [];
  const uniquePaths = Array.from(new Set(args.paths.filter(Boolean)));

  for (let start = 0; start < uniquePaths.length; start += 1000) {
    const batch = uniquePaths.slice(start, start + 1000);
    const { data, error } = await args.supabase.storage.from(args.bucket).remove(batch);
    if (error) {
      warnings.push(`${args.bucket}: ${error.message}`);
    } else {
      removed += data?.length ?? 0;
    }
  }

  return { removed, warnings };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = await loadAdminClient();
  const { data, error } = await supabase
    .from("storage_cleanup_jobs")
    .select("id,document_bucket,document_paths,image_bucket,image_paths,attempts")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(args.limit);

  if (error) throw new Error(error.message);
  const jobs = (data ?? []) as CleanupJob[];
  console.log(`Found ${jobs.length} storage cleanup job(s).`);
  if (args.dryRun || jobs.length === 0) return;

  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    const documentCleanup = await removePaths({
      supabase,
      bucket: job.document_bucket ?? "clinical-documents",
      paths: job.document_paths ?? [],
    });
    const imageCleanup = await removePaths({
      supabase,
      bucket: job.image_bucket ?? "clinical-images",
      paths: job.image_paths ?? [],
    });
    const warnings = [...documentCleanup.warnings, ...imageCleanup.warnings];
    const nextStatus = warnings.length > 0 ? "failed" : "completed";
    const { error: updateError } = await supabase
      .from("storage_cleanup_jobs")
      .update({
        status: nextStatus,
        attempts: job.attempts + 1,
        storage_removed: documentCleanup.removed + imageCleanup.removed,
        last_error: warnings.length ? warnings.join("; ") : null,
        completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
        metadata: {
          operation: "storage_cleanup_retry",
          storage_warnings: warnings,
        },
      })
      .eq("id", job.id);

    if (updateError) throw new Error(updateError.message);
    if (nextStatus === "completed") completed += 1;
    else failed += 1;
  }

  console.log(`Storage cleanup complete: ${completed} completed, ${failed} failed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
