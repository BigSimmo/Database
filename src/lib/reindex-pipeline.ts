export type ReindexQueueSnapshot = {
  openJobs: number;
  queuedDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
};

export type AbandonedReindexGenerationCounts = {
  document_chunks?: number;
  document_images?: number;
  document_table_facts?: number;
  document_embedding_fields?: number;
  document_index_units?: number;
  document_memory_cards?: number;
  document_sections?: number;
};

export function isReindexQueueClear(snapshot: ReindexQueueSnapshot) {
  return (
    snapshot.openJobs === 0 &&
    snapshot.queuedDocuments === 0 &&
    snapshot.processingDocuments === 0 &&
    snapshot.failedDocuments === 0
  );
}

export function hasIncompleteDocumentsWithoutOpenJobs(snapshot: ReindexQueueSnapshot) {
  return (
    snapshot.openJobs === 0 &&
    snapshot.queuedDocuments === 0 &&
    (snapshot.processingDocuments > 0 || snapshot.failedDocuments > 0)
  );
}

export function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
}

export function committedIndexGeneration(metadata: unknown) {
  const generation = metadataRecord(metadata).index_generation_id;
  return typeof generation === "string" && generation.trim() ? generation.trim() : null;
}

export function isAtomicReindexCandidate(document: { status?: string | null; metadata?: unknown }) {
  return document.status === "indexed";
}

export function isCommittedGenerationMetadata(args: { rowMetadata?: unknown; committedGeneration?: string | null }) {
  const rowGeneration = committedIndexGeneration(args.rowMetadata);
  if (!rowGeneration) return true;
  if (!args.committedGeneration) return true;
  return rowGeneration === args.committedGeneration;
}

export function imageRowNeedsGenerationRestamp(args: {
  indexGenerationId: string | null;
  metadata: unknown;
  committedGeneration: string;
}) {
  if (args.indexGenerationId !== args.committedGeneration) return true;
  return committedIndexGeneration(args.metadata) !== args.committedGeneration;
}

export function isAbandonedStagedGeneration(args: {
  rowMetadata?: unknown;
  rowGenerationId?: string | null;
  committedGeneration?: string | null;
}) {
  const rowGeneration =
    typeof args.rowGenerationId === "string" && args.rowGenerationId.trim()
      ? args.rowGenerationId.trim()
      : committedIndexGeneration(args.rowMetadata);
  if (!rowGeneration) return false;
  return rowGeneration !== (args.committedGeneration ?? null);
}

export function abandonedReindexGenerationTotal(counts: AbandonedReindexGenerationCounts) {
  return Object.values(counts).reduce((total, value) => total + (Number.isFinite(value) ? Number(value) : 0), 0);
}

export function hasAbandonedReindexGenerations(counts: AbandonedReindexGenerationCounts) {
  return abandonedReindexGenerationTotal(counts) > 0;
}

/**
 * Exit code for a read-only (dry-run) pass of the abandoned-generation cleanup.
 *
 * A dry run that finds abandoned staged rows still exits 0 today, so a scheduled
 * probe could not tell "nothing to reap" from "rows are leaking". `--alert-on-abandoned`
 * makes detection loud: non-zero so `.github/workflows/reindex-reaper.yml` can open an
 * alert issue. Mirrors `--alert-on-stuck` in `scripts/ingestion-autopilot.ts`.
 *
 * Detection only — this never deletes anything, and it does NOT close `#Q4Y7TR`.
 * The recorded fix there is for the commit RPC to enqueue `storage_cleanup_jobs`
 * rows for superseded generations at commit time; that is a migration and ships
 * in a separate batch.
 */
export function abandonedReindexGenerationAlertExitCode(args: {
  counts: AbandonedReindexGenerationCounts;
  alertOnAbandoned: boolean;
  apply: boolean;
}) {
  // Never re-purpose the apply path's exit code: --apply already reports its own
  // success/failure, and an alert exit there would mask a real cleanup failure.
  if (!args.alertOnAbandoned || args.apply) return 0;
  return hasAbandonedReindexGenerations(args.counts) ? 2 : 0;
}
