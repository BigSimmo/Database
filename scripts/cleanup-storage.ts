import { loadEnvConfig } from "@next/env";
import {
  classifyStorageCleanupJobs,
  nonNullDocumentIds,
  uniqueCleanupPaths,
  uploadCompensationSelectionFilter,
} from "@/lib/storage-cleanup-safety";
import { loadAdminClient } from "./eval-utils";

loadEnvConfig(process.cwd());

type CleanupArgs = {
  limit: number;
  dryRun: boolean;
};

type CleanupJob = {
  id: string;
  document_id: string | null;
  document_bucket: string | null;
  document_paths: string[] | null;
  image_bucket: string | null;
  image_paths: string[] | null;
  attempts: number;
  metadata: Record<string, unknown> | null;
};

function cleanupMetadata(metadata: CleanupJob["metadata"]): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
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
  const args = parseArgs(process.argv.slice(2));
  const supabase = await loadAdminClient();
  const { data, error } = await supabase
    .from("storage_cleanup_jobs")
    .select("id,document_id,document_bucket,document_paths,image_bucket,image_paths,attempts,metadata")
    .in("status", ["pending", "failed"])
    // Upload compensation gets a grace period so an in-flight upload is never
    // raced by the janitor. Other operations and legacy rows remain immediate.
    .or(uploadCompensationSelectionFilter())
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

  // Reference checks are path-based as well as FK-based. That reconciles an
  // upload row whose document_id could not yet be populated and prevents any
  // queued path from being removed while a surviving row still owns it.
  const referencedDocumentPaths = new Set<string>();
  const candidateDocumentPaths = uniqueCleanupPaths(allJobs, "document_paths");
  for (let start = 0; start < candidateDocumentPaths.length; start += 1000) {
    const batch = candidateDocumentPaths.slice(start, start + 1000);
    const { data: liveDocs, error: liveError } = await supabase
      .from("documents")
      .select("id,storage_path")
      .in("storage_path", batch);
    if (liveError) throw new Error(liveError.message);
    for (const doc of liveDocs ?? []) {
      if (doc.id) liveDocumentIds.add(doc.id);
      if (doc.storage_path) referencedDocumentPaths.add(doc.storage_path);
    }
  }

  const referencedImagePaths = new Set<string>();
  const candidateImagePaths = uniqueCleanupPaths(allJobs, "image_paths");
  for (let start = 0; start < candidateImagePaths.length; start += 1000) {
    const batch = candidateImagePaths.slice(start, start + 1000);
    const { data: liveImages, error: liveError } = await supabase
      .from("document_images")
      .select("storage_path")
      .in("storage_path", batch);
    if (liveError) throw new Error(liveError.message);
    for (const image of liveImages ?? []) {
      if (image.storage_path) referencedImagePaths.add(image.storage_path);
    }
  }

  const {
    safe: jobs,
    skipped,
    reconciled,
  } = classifyStorageCleanupJobs(allJobs, {
    liveDocumentIds,
    referencedDocumentPaths,
    referencedImagePaths,
  });
  console.log(
    `Found ${allJobs.length} storage cleanup job(s); ${jobs.length} safe to process, ${reconciled.length} reconciled.`,
  );
  if (skipped.length > 0) {
    console.warn(
      `Skipping ${skipped.length} cleanup job(s) with surviving database references: ${skipped
        .map((job) => job.id)
        .join(", ")}`,
    );
  }
  if (args.dryRun) return;

  for (const job of reconciled) {
    const { error: updateError } = await supabase
      .from("storage_cleanup_jobs")
      .update({
        status: "completed",
        last_error: null,
        completed_at: new Date().toISOString(),
        metadata: {
          ...cleanupMetadata(job.metadata),
          reconciliation: "live_document_reference",
          reconciled_at: new Date().toISOString(),
        },
      })
      .eq("id", job.id);
    if (updateError) throw new Error(updateError.message);
  }

  if (jobs.length === 0) return;

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
          ...cleanupMetadata(job.metadata),
          cleanup_attempted_at: new Date().toISOString(),
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
