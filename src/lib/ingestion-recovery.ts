export type IngestionRecoveryJob = {
  id: string;
  document_id: string;
  status: string | null;
  locked_at?: string | null;
  documents?: {
    status?: string | null;
    page_count?: number | null;
    chunk_count?: number | null;
  } | null;
};

export type IngestionRecoveryAction =
  | { action: "supersede"; jobId: string; documentId: string }
  | { action: "retry"; jobId: string; documentId: string; resetDocument: boolean };

function parseLockedAt(value: string | null | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function isStaleProcessingJob(job: IngestionRecoveryJob, now: Date, staleAfterMinutes: number) {
  if (job.status !== "processing" || !job.locked_at) return false;
  const lockedAt = parseLockedAt(job.locked_at);
  if (lockedAt === null) return false;
  return lockedAt < now.getTime() - staleAfterMinutes * 60_000;
}

export function isRecoverableProcessingJob(job: IngestionRecoveryJob, now: Date, staleAfterMinutes: number) {
  if (job.status !== "processing") return false;
  const lockedAt = parseLockedAt(job.locked_at);
  if (lockedAt === null) return true;
  return lockedAt < now.getTime() - staleAfterMinutes * 60_000;
}

export function isFreshProcessingJob(job: IngestionRecoveryJob, now: Date, staleAfterMinutes: number) {
  if (job.status !== "processing" || !job.locked_at) return false;
  const lockedAt = parseLockedAt(job.locked_at);
  if (lockedAt === null) return false;
  return lockedAt >= now.getTime() - staleAfterMinutes * 60_000;
}

export function buildIngestionRecoveryPlan(args: {
  jobs: IngestionRecoveryJob[];
  now?: Date;
  staleAfterMinutes: number;
}) {
  const now = args.now ?? new Date();
  const resetDocuments = new Set<string>();
  const actions: IngestionRecoveryAction[] = [];

  for (const job of args.jobs) {
    const documentStatus = job.documents?.status ?? null;
    const chunkCount = Number(job.documents?.chunk_count ?? 0);
    const isIndexedDocument = documentStatus === "indexed" && chunkCount > 0;
    const isRecoverableStatus =
      job.status === "failed" ||
      job.status === "pending" ||
      isRecoverableProcessingJob(job, now, args.staleAfterMinutes);

    if (isIndexedDocument && job.status !== "completed") {
      // Audit R22: a `pending` job on an already-indexed document is a
      // legitimately-queued reindex, not an abandoned leftover. Superseding it
      // silently cancels the reindex ("completed / superseded by successful
      // index"); routing it through the retry branch below would reset the live
      // index (R19). Leave it untouched for the worker's atomic reindex path,
      // which keeps the old generation live until the new commit swaps it.
      if (job.status === "pending") {
        continue;
      }
      actions.push({ action: "supersede", jobId: job.id, documentId: job.document_id });
      continue;
    }

    if (isRecoverableStatus) {
      // Audit I2/E2: `ingestion_jobs_one_open_per_document_uidx` forbids two OPEN
      // (pending/processing) rows for one document, but a document can legitimately arrive here
      // with several recoverable jobs at once (e.g. a `failed` row beside a `pending` row).
      // Requeue only the FIRST recoverable job per document; supersede every additional one.
      // Without this, recovery emitted two `retry` actions and tried to set both rows to
      // `pending`, tripping the unique index (23505) and leaving the queue in a self-perpetuating
      // stall that re-crashed on every subsequent run.
      if (resetDocuments.has(job.document_id)) {
        actions.push({ action: "supersede", jobId: job.id, documentId: job.document_id });
        continue;
      }
      resetDocuments.add(job.document_id);
      actions.push({ action: "retry", jobId: job.id, documentId: job.document_id, resetDocument: true });
    }
  }

  // Apply supersedes before retries. A retry flips a row to `pending`; if a redundant sibling for
  // the same document is still open when that happens, the two rows collide on the partial unique
  // index. Both consumers apply `actions` in array order, so closing the siblings first here keeps
  // recovery crash-safe regardless of the order jobs were fetched in. (Audit I2/E2)
  const orderedActions = [
    ...actions.filter((action) => action.action === "supersede"),
    ...actions.filter((action) => action.action === "retry"),
  ];

  return {
    actions: orderedActions,
    resetDocumentIds: Array.from(resetDocuments),
    supersedeCount: orderedActions.filter((action) => action.action === "supersede").length,
    retryCount: orderedActions.filter((action) => action.action === "retry").length,
  };
}
