import "server-only";
import { enqueueDocumentReindexJob, type EnqueueableDocument } from "@/lib/ingestion-enqueue";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type StrandedQueuedDocument = EnqueueableDocument & {
  created_at: string;
  updated_at: string;
};

export type StrandedQueuedRecoveryResult =
  | { documentId: string; outcome: "enqueued"; jobId?: string }
  | { documentId: string; outcome: "already_active" }
  | { documentId: string; outcome: "document_deleted" }
  | { documentId: string; outcome: "skipped_young"; ageMinutes: number }
  | { documentId: string; outcome: "error"; message: string };

export const STRANDED_QUEUED_DEFAULT_MIN_AGE_MINUTES = 15;
export const STRANDED_QUEUED_DEFAULT_LIMIT = 20;
/** Hard cap on aged-queued rows scanned while hunting for stranded ones. */
export const STRANDED_QUEUED_MAX_SCAN = 200;

function ageMinutes(iso: string, nowMs: number) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return (nowMs - time) / 60_000;
}

// Pure predicate used by the reproducer and recovery planner: a document is
// stranded when it is still `queued`, old enough that a mid-upload crash is
// plausible, and has no open pending/processing ingestion job.
export function isStrandedQueuedDocument(args: {
  document: { status: string | null; created_at: string; updated_at?: string | null };
  openJobCount: number;
  minAgeMinutes: number;
  now?: Date;
}): boolean {
  if (args.document.status !== "queued") return false;
  if (args.openJobCount > 0) return false;
  const nowMs = (args.now ?? new Date()).getTime();
  const age = ageMinutes(args.document.updated_at || args.document.created_at, nowMs);
  if (age === null) return false;
  return age >= args.minAgeMinutes;
}

export async function listStrandedQueuedDocuments(args: {
  supabase: AdminClient;
  minAgeMinutes?: number;
  limit?: number;
  ownerId?: string | null;
  now?: Date;
}): Promise<StrandedQueuedDocument[]> {
  const minAgeMinutes = args.minAgeMinutes ?? STRANDED_QUEUED_DEFAULT_MIN_AGE_MINUTES;
  const limit = args.limit ?? STRANDED_QUEUED_DEFAULT_LIMIT;
  const now = args.now ?? new Date();
  const cutoff = new Date(now.getTime() - minAgeMinutes * 60_000).toISOString();
  // Page past aged queued rows that already have open jobs so a busy queue
  // cannot starve genuinely stranded documents behind the first `limit` rows.
  const pageSize = Math.max(limit, STRANDED_QUEUED_DEFAULT_LIMIT);
  // Always allow paging up to the hard scan cap so a busy prefix of open-job
  // rows cannot exhaust the budget before `limit` stranded rows are collected.
  const maxScan = STRANDED_QUEUED_MAX_SCAN;

  const stranded: StrandedQueuedDocument[] = [];
  let offset = 0;

  while (stranded.length < limit && offset < maxScan) {
    const fetchCount = Math.min(pageSize, maxScan - offset);
    let query = args.supabase
      .from("documents")
      .select("id,owner_id,status,error_message,page_count,chunk_count,image_count,import_batch_id,created_at,updated_at")
      .eq("status", "queued")
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true });

    if (args.ownerId) {
      query = query.eq("owner_id", args.ownerId);
    }

    const { data, error } = await query.range(offset, offset + fetchCount - 1);
    if (error) throw new Error(error.message);

    const candidates = (data ?? []) as StrandedQueuedDocument[];
    if (candidates.length === 0) break;

    const documentIds = candidates.map((document) => document.id);
    const { data: openJobs, error: openJobsError } = await args.supabase
      .from("ingestion_jobs")
      .select("document_id")
      .in("document_id", documentIds)
      .in("status", ["pending", "processing"]);
    if (openJobsError) throw new Error(openJobsError.message);

    const openJobCounts = new Map<string, number>();
    for (const job of openJobs ?? []) {
      const documentId = job.document_id;
      if (!documentId) continue;
      openJobCounts.set(documentId, (openJobCounts.get(documentId) ?? 0) + 1);
    }

    for (const document of candidates) {
      if (stranded.length >= limit) break;
      if (
        isStrandedQueuedDocument({
          document: {
            status: document.status ?? null,
            created_at: document.created_at,
            updated_at: document.updated_at,
          },
          openJobCount: openJobCounts.get(document.id) ?? 0,
          minAgeMinutes,
          now,
        })
      ) {
        stranded.push(document);
      }
    }

    offset += candidates.length;
    if (candidates.length < fetchCount) break;
  }

  return stranded;
}

export async function recoverStrandedQueuedDocuments(args: {
  supabase: AdminClient;
  documents: StrandedQueuedDocument[];
}): Promise<StrandedQueuedRecoveryResult[]> {
  const results: StrandedQueuedRecoveryResult[] = [];

  for (const document of args.documents) {
    try {
      const result = await enqueueDocumentReindexJob({
        supabase: args.supabase,
        document,
      });
      if (result.outcome === "enqueued") {
        const jobId =
          result.job && typeof result.job === "object" && "id" in result.job ? String(result.job.id ?? "") : undefined;
        results.push({ documentId: document.id, outcome: "enqueued", jobId: jobId || undefined });
        continue;
      }
      results.push({ documentId: document.id, outcome: result.outcome });
    } catch (error) {
      results.push({
        documentId: document.id,
        outcome: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
