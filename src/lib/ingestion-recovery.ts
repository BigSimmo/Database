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

export const INGESTION_RECOVERY_JOB_STATUSES = ["pending", "processing", "failed"] as const;

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

  const jobsByDocument = new Map<string, IngestionRecoveryJob[]>();
  for (const job of args.jobs) {
    const siblings = jobsByDocument.get(job.document_id) ?? [];
    siblings.push(job);
    jobsByDocument.set(job.document_id, siblings);
  }

  for (const [documentId, jobs] of jobsByDocument) {
    const document = jobs[0]?.documents;
    const isIndexedDocument = document?.status === "indexed" && Number(document.chunk_count ?? 0) > 0;
    const activeJob =
      jobs.find((job) => job.status === "pending") ??
      jobs.find((job) => isFreshProcessingJob(job, now, args.staleAfterMinutes));

    if (activeJob) {
      // A pending or freshly processing job is already the legitimate queue owner. Keep it intact
      // and close only failed/stale siblings; retrying an older sibling would either collide with
      // the open-job unique index or silently supersede valid work depending on fetch order.
      for (const job of jobs) {
        if (job.id === activeJob.id || job.status === "completed") continue;
        actions.push({ action: "supersede", jobId: job.id, documentId });
      }
      continue;
    }

    const recoverableJobs = jobs.filter(
      (job) => job.status === "failed" || isRecoverableProcessingJob(job, now, args.staleAfterMinutes),
    );

    if (isIndexedDocument) {
      for (const job of recoverableJobs) {
        actions.push({ action: "supersede", jobId: job.id, documentId });
      }
      continue;
    }

    const retryJob = recoverableJobs.find((job) => job.status === "processing") ?? recoverableJobs[0];
    if (!retryJob) continue;

    for (const job of recoverableJobs) {
      if (job.id !== retryJob.id) actions.push({ action: "supersede", jobId: job.id, documentId });
    }
    resetDocuments.add(documentId);
    actions.push({ action: "retry", jobId: retryJob.id, documentId, resetDocument: true });
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
