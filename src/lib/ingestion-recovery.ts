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
      resetDocuments.add(job.document_id);
      actions.push({ action: "retry", jobId: job.id, documentId: job.document_id, resetDocument: true });
    }
  }

  return {
    actions,
    resetDocumentIds: Array.from(resetDocuments),
    supersedeCount: actions.filter((action) => action.action === "supersede").length,
    retryCount: actions.filter((action) => action.action === "retry").length,
  };
}
