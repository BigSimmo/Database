import type { SupabaseClient } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";
import { probeSupabaseHealth } from "@/lib/supabase/health";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

type AgentEnrichmentJobRow = {
  document_id: string | null;
  status: string | null;
  locked_at: string | null;
  updated_at: string | null;
};

type IngestionJobStatus = "pending" | "processing" | "failed" | string;

export type IngestionJobRow = {
  id: string;
  document_id: string | null;
  status: IngestionJobStatus | null;
  stage: string | null;
  locked_at: string | null;
  updated_at: string | null;
  error_message: string | null;
  attempt_count: number | null;
  max_attempts: number | null;
};

export type IngestionMutationSafetyReason = "ready" | "supabase_unavailable" | "active_jobs" | "stale_processing_jobs";

export type IngestionMutationSafetyResult =
  | {
      ok: true;
      checkedAt: string;
      reason: "ready";
      message: string;
      activeJobs: [];
      staleProcessingJobs: [];
    }
  | {
      ok: false;
      status: 409 | 503;
      checkedAt: string;
      reason: Exclude<IngestionMutationSafetyReason, "ready">;
      message: string;
      activeJobs: IngestionJobRow[];
      staleProcessingJobs: IngestionJobRow[];
    };

function minutesAgo(value: string | null, nowMs: number) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return (nowMs - time) / 60_000;
}

function isStaleProcessingJob(job: IngestionJobRow, staleAfterMinutes: number, nowMs: number) {
  if (job.status !== "processing") return false;
  const lockedAge = minutesAgo(job.locked_at, nowMs);
  const updatedAge = minutesAgo(job.updated_at, nowMs);
  const age = lockedAge ?? updatedAge;
  return age !== null && age >= staleAfterMinutes;
}

export const activeIngestionJobColumns =
  "id,document_id,status,stage,locked_at,updated_at,error_message,attempt_count,max_attempts";

function activeJobMessage(documentCount: number, staleCount: number) {
  if (staleCount > 0) {
    return staleCount === 1
      ? "A selected document has a stale processing ingestion job. Run queue recovery before reindexing."
      : "Selected documents have stale processing ingestion jobs. Run queue recovery before reindexing.";
  }
  return documentCount === 1
    ? "Document already has pending or processing indexing work."
    : "One or more selected documents already have pending or processing indexing work.";
}

// Shared by checkIngestionMutationSafety's pre-check and the reindex routes'
// post-insert 23505 handler (R17): the pre-check SELECT and the unique index
// on (document_id) where status in (pending,processing) guard the same
// invariant, so a race that slips past the pre-check and hits the index
// instead should still produce this same 409 shape, not a raw constraint error.
export function buildActiveJobsSafetyResult(
  activeJobs: IngestionJobRow[],
  staleAfterMinutes: number,
  checkedAt: string,
  now: Date = new Date(),
): Extract<IngestionMutationSafetyResult, { ok: false }> {
  const staleProcessingJobs = activeJobs.filter((job) => isStaleProcessingJob(job, staleAfterMinutes, now.getTime()));
  return {
    ok: false,
    status: 409,
    checkedAt,
    reason: staleProcessingJobs.length > 0 ? "stale_processing_jobs" : "active_jobs",
    message: activeJobMessage(activeJobs.length, staleProcessingJobs.length),
    activeJobs,
    staleProcessingJobs,
  };
}

// Rollback fence: a timestamptz value unique to this request. Queue-state
// writes stamp the row with it so the compensating rollback can run as a
// single conditional UPDATE (`.eq` on the stamp) — atomic server-side. If a
// competing request re-writes the row between our write and our rollback, the
// stamp no longer matches and the rollback affects zero rows instead of
// clobbering the newer queue state. JS Date carries only millisecond
// precision while timestamptz stores microseconds, so random microsecond
// digits keep two same-millisecond requests distinct.
export function ingestionRollbackFenceStamp(now = new Date()) {
  const microseconds = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return now.toISOString().replace("Z", `${microseconds}Z`);
}

// Audit R24d: route-mode enrichment (reindex `mode:'enrichment'`) and the
// enrichment agent (edge function) both delete-then-insert the same artifact
// families. `checkIngestionMutationSafety` only reads `ingestion_jobs`, so it
// cannot see a live agent pass — route enrichment runs freely against one and
// the interleaved deletes can leave a "completed/good" document with ZERO
// enrichment artifacts. This predicate flags a genuinely-live agent pass: a
// `processing` agent job whose lease is still fresh. The agent lease has no
// heartbeat, so a lock older than the stale threshold (or missing timestamps on
// an abandoned row) is treated as dead and does NOT block. Steady-state
// `pending`/`completed` agent jobs never block (they are not processing).
export function isActiveAgentEnrichmentJob(
  job: { status: string | null; locked_at: string | null; updated_at: string | null },
  staleAfterMinutes: number,
  nowMs: number,
): boolean {
  if (job.status !== "processing") return false;
  const lockedAge = minutesAgo(job.locked_at, nowMs);
  const updatedAge = minutesAgo(job.updated_at, nowMs);
  const age = lockedAge ?? updatedAge;
  if (age === null) return true; // just claimed / no timestamps → treat as live
  return age < staleAfterMinutes; // fresh lease → live; stale lease → dead
}

export async function hasActiveAgentEnrichmentJob(args: {
  supabase: SupabaseAdminClient;
  documentId: string;
  staleAfterMinutes: number;
  now?: Date;
}): Promise<boolean> {
  const blocked = await listDocumentsWithActiveAgentEnrichment({
    supabase: args.supabase,
    documentIds: [args.documentId],
    staleAfterMinutes: args.staleAfterMinutes,
    now: args.now,
  });
  return blocked.length > 0;
}

// Batch form used by bulk reindex preflight so one query covers the selection
// set instead of N round-trips. Fresh `processing` leases block; stale leases
// and non-processing statuses do not (same predicate as the single-document
// helper).
export async function listDocumentsWithActiveAgentEnrichment(args: {
  supabase: SupabaseAdminClient;
  documentIds: string[];
  staleAfterMinutes: number;
  now?: Date;
}): Promise<string[]> {
  const uniqueDocumentIds = Array.from(new Set(args.documentIds.filter(Boolean)));
  if (uniqueDocumentIds.length === 0) return [];

  // indexing_v3_agent_jobs is not in the generated Database types (it is a
  // worker-state table added by migration), so query it through an untyped
  // client the same way the reindex route paginates dynamic tables.
  const client = args.supabase as unknown as SupabaseClient;
  const { data, error } = await client
    .from("indexing_v3_agent_jobs")
    .select("document_id,status,locked_at,updated_at")
    .in("document_id", uniqueDocumentIds)
    .eq("status", "processing");
  if (error) throw new Error(error.message);

  const nowMs = (args.now ?? new Date()).getTime();
  return Array.from(
    new Set(
      ((data ?? []) as AgentEnrichmentJobRow[])
        .filter((job) => isActiveAgentEnrichmentJob(job, args.staleAfterMinutes, nowMs))
        .map((job) => job.document_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

export async function checkIngestionMutationSafety(args: {
  supabase: SupabaseAdminClient;
  documentIds: string[];
  action: string;
  checkActiveJobs?: boolean;
  staleAfterMinutes: number;
  now?: Date;
}): Promise<IngestionMutationSafetyResult> {
  const uniqueDocumentIds = Array.from(new Set(args.documentIds.filter(Boolean)));
  const health = await probeSupabaseHealth(args.supabase);

  if (!health.ok) {
    return {
      ok: false,
      status: 503,
      checkedAt: health.checkedAt,
      reason: "supabase_unavailable",
      message: `${args.action} is paused. ${health.message}`,
      activeJobs: [],
      staleProcessingJobs: [],
    };
  }

  if (!args.checkActiveJobs || uniqueDocumentIds.length === 0) {
    return {
      ok: true,
      checkedAt: health.checkedAt,
      reason: "ready",
      message: `${args.action} is safe to run now.`,
      activeJobs: [],
      staleProcessingJobs: [],
    };
  }

  const { data, error } = await args.supabase
    .from("ingestion_jobs")
    .select(activeIngestionJobColumns)
    .in("document_id", uniqueDocumentIds)
    .in("status", ["pending", "processing"]);
  if (error) throw new Error(error.message);

  const activeJobs = ((data ?? []) as IngestionJobRow[]).filter(
    (job) => job.status === "pending" || job.status === "processing",
  );

  if (activeJobs.length > 0) {
    return buildActiveJobsSafetyResult(activeJobs, args.staleAfterMinutes, health.checkedAt, args.now);
  }

  return {
    ok: true,
    checkedAt: health.checkedAt,
    reason: "ready",
    message: `${args.action} is safe to run now.`,
    activeJobs: [],
    staleProcessingJobs: [],
  };
}

export function ingestionMutationSafetyPayload(safety: IngestionMutationSafetyResult) {
  return {
    error: safety.ok ? undefined : safety.message,
    safety: {
      safeToRun: safety.ok,
      checkedAt: safety.checkedAt,
      reason: safety.reason,
      message: safety.message,
      activeJobCount: safety.activeJobs.length,
      staleProcessingJobCount: safety.staleProcessingJobs.length,
      activeJobs: safety.activeJobs.map((job) => ({
        id: job.id,
        documentId: job.document_id,
        status: job.status,
        stage: job.stage,
        lockedAt: job.locked_at,
        updatedAt: job.updated_at,
        errorMessage: job.error_message,
        attemptCount: job.attempt_count,
        maxAttempts: job.max_attempts,
      })),
    },
  };
}
