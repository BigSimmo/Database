export type StorageCleanupCandidate = {
  id: string;
  document_id: string | null;
};

// Audit R11: the DELETE route creates a storage_cleanup_jobs row (carrying the
// live document's source-PDF + image paths) BEFORE its final guards; if the
// delete then aborts, the row is left behind still pointing at a document that
// was never deleted. The janitor removes those paths, permanently destroying a
// live document's storage. The precise signal is the ledger FK
// (storage_cleanup_jobs.document_id -> documents, ON DELETE SET NULL): a
// genuinely-deleted document has its ledger document_id nulled, so a non-null
// document_id that STILL resolves to a live document proves the delete did not
// complete. Skip those rows instead of executing them.
export function partitionStorageCleanupJobs<T extends StorageCleanupCandidate>(
  jobs: T[],
  liveDocumentIds: ReadonlySet<string>,
): { safe: T[]; skipped: T[] } {
  const safe: T[] = [];
  const skipped: T[] = [];
  for (const job of jobs) {
    if (job.document_id && liveDocumentIds.has(job.document_id)) {
      skipped.push(job);
    } else {
      safe.push(job);
    }
  }
  return { safe, skipped };
}

export function nonNullDocumentIds(jobs: StorageCleanupCandidate[]): string[] {
  return Array.from(new Set(jobs.map((job) => job.document_id).filter((id): id is string => Boolean(id))));
}
