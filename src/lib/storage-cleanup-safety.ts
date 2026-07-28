export type StorageCleanupCandidate = {
  id: string;
  document_id: string | null;
  document_paths?: string[] | null;
  image_paths?: string[] | null;
  metadata?: unknown;
};

export const UPLOAD_COMPENSATION_GRACE_MS = 15 * 60 * 1000;

export type StorageCleanupSafetyContext = {
  liveDocumentIds: ReadonlySet<string>;
  referencedDocumentPaths: ReadonlySet<string>;
  referencedImagePaths: ReadonlySet<string>;
};

export function storageCleanupOperation(job: StorageCleanupCandidate): string | null {
  const metadata = job.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const operation = (metadata as Record<string, unknown>).operation;
  return typeof operation === "string" && operation.trim() ? operation.trim() : null;
}

export function uploadCompensationSelectionFilter(now = Date.now()): string {
  const cutoff = new Date(now - UPLOAD_COMPENSATION_GRACE_MS).toISOString();
  return [
    "metadata->>operation.is.null",
    "metadata->>operation.neq.upload_compensation",
    `and(metadata->>operation.eq.upload_compensation,created_at.lt.${cutoff})`,
  ].join(",");
}

function hasReferencedPath(paths: string[] | null | undefined, referenced: ReadonlySet<string>): boolean {
  return (paths ?? []).some((path) => Boolean(path) && referenced.has(path));
}

/**
 * Classify durable cleanup rows without weakening permanent-delete safety.
 * Upload compensation rows that now point at a live document path are settled
 * as reconciled, while obsolete-generation rows may proceed alongside a live
 * document only after every queued image path is proven unreferenced.
 */
export function classifyStorageCleanupJobs<T extends StorageCleanupCandidate>(
  jobs: T[],
  context: StorageCleanupSafetyContext,
): { safe: T[]; skipped: T[]; reconciled: T[] } {
  const safe: T[] = [];
  const skipped: T[] = [];
  const reconciled: T[] = [];

  for (const job of jobs) {
    const operation = storageCleanupOperation(job);
    const documentPathIsReferenced = hasReferencedPath(job.document_paths, context.referencedDocumentPaths);
    const imagePathIsReferenced = hasReferencedPath(job.image_paths, context.referencedImagePaths);

    if (operation === "upload_compensation") {
      if (documentPathIsReferenced) {
        reconciled.push(job);
      } else if (imagePathIsReferenced) {
        skipped.push(job);
      } else {
        safe.push(job);
      }
      continue;
    }

    if (operation === "obsolete_index_generation") {
      if (documentPathIsReferenced || imagePathIsReferenced) {
        skipped.push(job);
      } else {
        safe.push(job);
      }
      continue;
    }

    // Preserve the legacy/permanent-delete contract: a document FK that still
    // resolves means deletion aborted, so none of its storage may be touched.
    if (
      (job.document_id && context.liveDocumentIds.has(job.document_id)) ||
      documentPathIsReferenced ||
      imagePathIsReferenced
    ) {
      skipped.push(job);
    } else {
      safe.push(job);
    }
  }

  return { safe, skipped, reconciled };
}

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
  const { safe, skipped } = classifyStorageCleanupJobs(jobs, {
    liveDocumentIds,
    referencedDocumentPaths: new Set(),
    referencedImagePaths: new Set(),
  });
  return { safe, skipped };
}

export function nonNullDocumentIds(jobs: StorageCleanupCandidate[]): string[] {
  return Array.from(new Set(jobs.map((job) => job.document_id).filter((id): id is string => Boolean(id))));
}

export function uniqueCleanupPaths(jobs: StorageCleanupCandidate[], key: "document_paths" | "image_paths"): string[] {
  return Array.from(new Set(jobs.flatMap((job) => job[key] ?? []).filter((path) => Boolean(path))));
}
