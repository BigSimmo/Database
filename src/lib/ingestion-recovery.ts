export type IngestionRecoveryJob = {
  id: string;
  document_id: string;
  status: string | null;
  locked_at?: string | null;
  documents?: {
    status?: string | null;
    page_count?: number | null;
    chunk_count?: number | null;
    owner_id?: string | null;
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

export type IngestionRecoverySkipReason =
  /** The job left the open-recovery statuses entirely (completed, or the row was deleted). */
  | "job_closed"
  /** The job is still open, but the re-derived plan no longer prescribes this action for it. */
  | "state_changed";

export type IngestionRecoveryRowState = {
  jobStatus: string | null;
  jobLockedAt: string | null;
  documentStatus: string | null;
  documentOwnerId: string | null;
};

export type ReconciledIngestionRecoveryAction = {
  action: IngestionRecoveryAction;
  /**
   * Row state observed in the re-read. Every write is guarded on these values so a row that
   * moved again between the re-read and the write is left alone instead of being overwritten.
   */
  expected: IngestionRecoveryRowState;
};

export type IngestionRecoveryReconciliation = {
  applicable: ReconciledIngestionRecoveryAction[];
  skipped: Array<{ action: IngestionRecoveryAction; reason: IngestionRecoverySkipReason }>;
};

function recoveryActionKey(action: IngestionRecoveryAction) {
  return `${action.action}:${action.jobId}`;
}

/**
 * Re-validate a previously computed recovery plan against a fresh read of the queue.
 *
 * `buildIngestionRecoveryPlan` runs against a point-in-time snapshot, and the operator then
 * spends unbounded wall-clock time reading the preview before confirming. In that window a job
 * can finish normally, a worker can re-claim it, or a document can become `indexed` — and the
 * plan's retry branch is destructive (`reset_document_index` deletes every chunk, page, image and
 * section for the document with no guard of its own). Applying a stale plan therefore destroys a
 * freshly committed index or races a live worker.
 *
 * This re-derives the plan from the fresh rows and keeps only actions the queue still asks for,
 * carrying the observed row state forward so the caller can guard each write on it.
 */
export function reconcileIngestionRecoveryPlan(args: {
  planned: IngestionRecoveryAction[];
  jobs: IngestionRecoveryJob[];
  now?: Date;
  staleAfterMinutes: number;
}): IngestionRecoveryReconciliation {
  const fresh = buildIngestionRecoveryPlan({
    jobs: args.jobs,
    now: args.now,
    staleAfterMinutes: args.staleAfterMinutes,
  });
  const freshKeys = new Set(fresh.actions.map(recoveryActionKey));
  const jobsById = new Map(args.jobs.map((job) => [job.id, job] as const));

  const applicable: ReconciledIngestionRecoveryAction[] = [];
  const skipped: IngestionRecoveryReconciliation["skipped"] = [];

  for (const action of args.planned) {
    const job = jobsById.get(action.jobId);
    if (!job) {
      skipped.push({ action, reason: "job_closed" });
      continue;
    }
    if (!freshKeys.has(recoveryActionKey(action))) {
      skipped.push({ action, reason: "state_changed" });
      continue;
    }
    applicable.push({
      action,
      expected: {
        jobStatus: job.status ?? null,
        jobLockedAt: job.locked_at ?? null,
        documentStatus: job.documents?.status ?? null,
        documentOwnerId: job.documents?.owner_id ?? null,
      },
    });
  }

  return { applicable, skipped };
}
