import { loadEnvConfig } from "@next/env";
import { pathToFileURL } from "node:url";
import { nonNullDocumentIds, partitionStorageCleanupJobs } from "@/lib/storage-cleanup-safety";
import { loadAdminClient } from "./eval-utils";

type CleanupArgs = {
  limit: number;
  dryRun: boolean;
};

export type CleanupJob = {
  id: string;
  document_id: string | null;
  document_bucket: string | null;
  document_paths: string[] | null;
  image_bucket: string | null;
  image_paths: string[] | null;
  attempts: number;
  public_source_reservation_id: string | null;
  public_source_storage_bucket: string | null;
  public_source_storage_path: string | null;
  public_source_cleanup_not_before: string | null;
};

export function publicSourceCleanupIdentityError(job: CleanupJob) {
  if (job.public_source_reservation_id === null) return null;
  if (
    !job.public_source_storage_bucket ||
    !job.public_source_storage_path ||
    job.document_bucket !== job.public_source_storage_bucket ||
    job.document_paths?.length !== 1 ||
    job.document_paths[0] !== job.public_source_storage_path
  ) {
    return "Controlled public source cleanup identity is inconsistent.";
  }
  return null;
}

export function isPublicSourceCleanupReady(job: CleanupJob, now = Date.now()) {
  if (!job.public_source_cleanup_not_before) return true;
  const notBefore = Date.parse(job.public_source_cleanup_not_before);
  return Number.isFinite(notBefore) && notBefore <= now;
}

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

async function removePaths(args: {
  supabase: Awaited<ReturnType<typeof loadAdminClient>>;
  bucket: string;
  paths: string[];
}) {
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
  loadEnvConfig(process.cwd());
  const args = parseArgs(process.argv.slice(2));
  const supabase = await loadAdminClient();
  const { data, error } = await supabase
    .from("storage_cleanup_jobs")
    .select(
      "id,document_id,document_bucket,document_paths,image_bucket,image_paths,attempts,public_source_reservation_id,public_source_storage_bucket,public_source_storage_path,public_source_cleanup_not_before",
    )
    .in("status", ["pending", "failed"])
    .or(`public_source_cleanup_not_before.is.null,public_source_cleanup_not_before.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(args.limit);

  if (error) throw new Error(error.message);
  const allJobs = (data ?? []) as CleanupJob[];

  // Audit R11 guard: never remove storage for a ledger row whose document still
  // exists — a genuinely-deleted document has its ledger document_id nulled by
  // the ON DELETE SET NULL FK, so a live document_id means the delete aborted
  // and these paths still belong to a live document.
  const candidateDocumentIds = nonNullDocumentIds(allJobs);
  const liveDocumentIds = new Set<string>();
  for (let start = 0; start < candidateDocumentIds.length; start += 1000) {
    const batch = candidateDocumentIds.slice(start, start + 1000);
    const { data: liveDocs, error: liveError } = await supabase.from("documents").select("id").in("id", batch);
    if (liveError) throw new Error(liveError.message);
    for (const doc of liveDocs ?? []) liveDocumentIds.add(doc.id);
  }

  const { safe: ownershipSafeJobs, skipped } = partitionStorageCleanupJobs(allJobs, liveDocumentIds);
  const jobs = ownershipSafeJobs.filter((job) => isPublicSourceCleanupReady(job));
  console.log(`Found ${allJobs.length} storage cleanup job(s); ${jobs.length} safe to process.`);
  if (skipped.length > 0) {
    console.warn(
      `Skipping ${skipped.length} cleanup job(s) whose document still exists (aborted delete; would destroy live storage): ${skipped
        .map((job) => job.id)
        .join(", ")}`,
    );
  }
  if (args.dryRun || jobs.length === 0) return;

  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    const identityError = publicSourceCleanupIdentityError(job);
    if (identityError) {
      const { error: identityUpdateError } = await supabase
        .from("storage_cleanup_jobs")
        .update({
          status: "failed",
          attempts: job.attempts + 1,
          last_error: identityError,
          completed_at: null,
          metadata: { operation: "storage_cleanup_identity_rejected" },
        })
        .eq("id", job.id);
      if (identityUpdateError) throw new Error(identityUpdateError.message);
      failed += 1;
      continue;
    }
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
