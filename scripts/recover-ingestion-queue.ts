import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import type { IngestionRecoveryJob } from "@/lib/ingestion-recovery";
import { confirm } from "./cli-utils";

loadEnvConfig(process.cwd());

type RecoveryDocument = {
  status?: string | null;
  page_count?: number | null;
  chunk_count?: number | null;
  owner_id?: string | null;
};

type RawJobRow = {
  id: string;
  document_id: string;
  status: string | null;
  locked_at: string | null;
  documents: RecoveryDocument | RecoveryDocument[] | null;
};

function supabaseStageError(stage: string, error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const message =
    typeof record.message === "string" && record.message.trim().length > 0
      ? record.message
      : `Supabase operation failed during ${stage}`;
  const wrapped = new Error(message);
  wrapped.name = "SupabaseRecoveryError";
  Object.assign(wrapped, {
    stage,
    code: record.code,
    details: record.details,
    hint: record.hint,
  });
  return wrapped;
}

const booleanFlags = new Set(["--apply", "--yes", "--include-stranded-queued"]);
const valueFlags = new Set(["--stale-after-minutes", "--limit", "--stranded-min-age-minutes", "--owner-id"]);

// Audit L2 (hardened after diff review): this script mutates ingestion state,
// so argument parsing fails loudly on ANY surprise —
//   - unknown/typo'd flag names ("--limt 5" used to be ignored, silently
//     recovering up to 20 jobs instead of the intended 5),
//   - a value-flag with a missing or empty value ("--limit" at the end of the
//     line, "--limit="),
//   - provided-but-malformed numeric values ("--limit 5O").
function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  const booleans = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (booleanFlags.has(token)) {
      booleans.add(token);
      continue;
    }
    const equalsIndex = token.indexOf("=");
    const name = equalsIndex >= 0 ? token.slice(0, equalsIndex) : token;
    if (!valueFlags.has(name)) throw new Error(`Unknown argument ${token}`);
    const value = equalsIndex >= 0 ? token.slice(equalsIndex + 1) : argv[index + 1];
    if (equalsIndex < 0) index += 1;
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
    values.set(name, value);
  }
  const positiveIntFor = (name: string) => {
    const raw = values.get(`--${name}`);
    if (raw === undefined) return undefined;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== raw.trim()) {
      throw new Error(`--${name} must be a positive integer (received "${raw}").`);
    }
    return parsed;
  };
  const ownerId = values.get("--owner-id");
  if (ownerId !== undefined && ownerId.trim().length === 0) {
    throw new Error("--owner-id must be a non-empty UUID when provided.");
  }
  return {
    apply: booleans.has("--apply"),
    yes: booleans.has("--yes"),
    includeStrandedQueued: booleans.has("--include-stranded-queued"),
    staleAfterMinutes: positiveIntFor("stale-after-minutes"),
    strandedMinAgeMinutes: positiveIntFor("stranded-min-age-minutes"),
    limit: positiveIntFor("limit"),
    ownerId: ownerId?.trim(),
  };
}

async function main() {
  const [
    { env, requireServerEnv },
    { buildIngestionRecoveryPlan, reconcileIngestionRecoveryPlan, INGESTION_RECOVERY_JOB_STATUSES },
    { createAdminClient },
    { assertSupabaseHealthy, probeSupabaseHealth },
  ] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/ingestion-recovery"),
    import("@/lib/supabase/admin"),
    import("@/lib/supabase/health"),
  ]);
  requireServerEnv();
  const args = parseArgs(process.argv.slice(2));
  const staleAfterMinutes = args.staleAfterMinutes ?? env.WORKER_STALE_AFTER_MINUTES;
  const limit = args.limit ?? 20;
  const supabase = createAdminClient();

  console.log("=== Ingestion Queue Recovery ===");
  console.log(`Checking Supabase health...`);
  assertSupabaseHealthy(await probeSupabaseHealth(supabase), "Ingestion queue recovery");
  console.log("  Supabase is healthy.\n");

  // Built as a function, not a one-shot query: the plan is re-derived against a second read of
  // these same rows immediately before anything is written. (Audit R20/R21)
  const openJobsQuery = () => {
    const query = supabase
      .from("ingestion_jobs")
      .select("id,document_id,status,locked_at,documents!inner(status,page_count,chunk_count,owner_id)")
      .in("status", [...INGESTION_RECOVERY_JOB_STATUSES])
      .order("created_at", { ascending: true });
    return args.ownerId ? query.eq("documents.owner_id", args.ownerId) : query;
  };

  const normaliseJobRows = (rows: RawJobRow[] | null) =>
    (rows ?? []).map((job) => ({
      ...job,
      documents: Array.isArray(job.documents) ? (job.documents[0] as RecoveryDocument | undefined) : job.documents,
    })) as IngestionRecoveryJob[];

  const { data, error } = await openJobsQuery();
  if (error) throw supabaseStageError("load open ingestion jobs", error);

  const jobs = normaliseJobRows(data as RawJobRow[] | null);
  const plan = buildIngestionRecoveryPlan({ jobs, staleAfterMinutes });
  const actions = plan.actions.slice(0, limit);
  const resetDocumentIds = Array.from(
    new Set(actions.filter((action) => action.action === "retry").map((action) => action.documentId)),
  );
  const supersedeCount = actions.filter((action) => action.action === "supersede").length;
  const retryCount = actions.filter((action) => action.action === "retry").length;
  const remainingCount = Math.max(0, plan.actions.length - actions.length);

  console.log(`Stale-after threshold : ${staleAfterMinutes} min`);
  console.log(`Action limit          : ${limit}`);
  console.log(`Scanned jobs          : ${jobs.length}`);
  console.log(`Documents to reset    : ${resetDocumentIds.length}`);
  console.log(`Jobs to supersede     : ${supersedeCount}`);
  console.log(`Jobs to retry         : ${retryCount}`);
  if (remainingCount > 0) {
    console.log(`Remaining (over limit): ${remainingCount}`);
  }

  let stranded: Awaited<
    ReturnType<(typeof import("@/lib/stranded-queued-recovery"))["listStrandedQueuedDocuments"]>
  > | null = null;
  if (args.includeStrandedQueued) {
    const { listStrandedQueuedDocuments, STRANDED_QUEUED_DEFAULT_MIN_AGE_MINUTES } =
      await import("@/lib/stranded-queued-recovery");
    const strandedMinAgeMinutes = args.strandedMinAgeMinutes ?? STRANDED_QUEUED_DEFAULT_MIN_AGE_MINUTES;
    stranded = await listStrandedQueuedDocuments({
      supabase,
      minAgeMinutes: strandedMinAgeMinutes,
      limit,
      ownerId: args.ownerId ?? null,
    });
    console.log("\n=== Stranded queued-without-job recovery ===");
    console.log(`Min age                 : ${strandedMinAgeMinutes} min`);
    console.log(`Owner scope             : ${args.ownerId ?? "(all owners)"}`);
    console.log(`Stranded candidates     : ${stranded.length}`);
    for (const document of stranded) {
      console.log(`  - ${document.id} owner=${document.owner_id ?? "null"} updated_at=${document.updated_at}`);
    }
  }

  if (actions.length === 0 && (stranded?.length ?? 0) === 0) {
    console.log("\nNothing to recover. Queue looks healthy.");
    return;
  }

  let shouldApply = args.apply;
  if (!shouldApply) {
    if (args.yes) {
      shouldApply = true;
    } else {
      console.log("");
      shouldApply = await confirm("Apply these changes?");
    }
  }

  if (!shouldApply) {
    console.log("\nNo changes applied. Re-run with --apply or confirm interactively to mutate the ingestion queue.");
    return;
  }

  if (actions.length > 0) {
    // The plan above is a point-in-time snapshot and the operator may have spent minutes reading it
    // at the confirmation prompt. In that window a job can complete, a worker can re-claim it, or a
    // document can reach `indexed` — and the retry branch is destructive, because
    // `reset_document_index` deletes every chunk, page, image and section for the document with no
    // guard of its own. Re-derive the plan against current rows, then guard every write on the state
    // just observed so a row that moved again is left alone rather than overwritten. (Audit R20/R21)
    console.log("\nRe-reading the queue before applying...");
    const { data: freshData, error: freshError } = await openJobsQuery();
    if (freshError) throw supabaseStageError("re-read open ingestion jobs", freshError);

    const { applicable, skipped } = reconcileIngestionRecoveryPlan({
      planned: actions,
      jobs: normaliseJobRows(freshData as RawJobRow[] | null),
      staleAfterMinutes,
    });

    for (const entry of skipped) {
      const because = entry.reason === "job_closed" ? "job closed before apply" : "queue state changed before apply";
      console.log(
        `  skipped ${entry.action.action} job ${entry.action.jobId} (document ${entry.action.documentId}): ${because}`,
      );
    }

    if (applicable.length === 0) {
      console.log("\nNothing left to apply. The queue moved on while the plan awaited confirmation.");
    } else {
      console.log(`\nApplying job recovery (${applicable.length} of ${actions.length} planned action(s))...`);

      // Recovery holds the job under its own worker id while the index is reset. `claim_ingestion_jobs`
      // only claims `pending` rows or `processing` rows whose lock has gone stale, so a fresh lock keeps
      // the worker off this document for the whole destructive window.
      const recoveryWorkerId = `recovery:${randomUUID()}`;

      // Drops the recovery lock, guarded on this run owning it. Every post-claim exit goes through
      // here: a job left `processing` under a fresh lock reads to the planner as an active job, so
      // neither the worker nor the next recovery run would touch it until the lock aged past the
      // stale threshold.
      const releaseRecoveryClaim = async (jobId: string, stage: string, patch: Record<string, unknown>) => {
        const { error } = await supabase
          .from("ingestion_jobs")
          .update({ ...patch, stage, locked_by: null })
          .eq("id", jobId)
          .eq("locked_by", recoveryWorkerId);
        return error;
      };
      const lostRace = (action: { action: string; jobId: string; documentId: string }, what: string) =>
        console.log(`  skipped ${action.action} job ${action.jobId} (document ${action.documentId}): ${what}`);

      let supersededCount = 0;
      let retriedCount = 0;

      // Supersedes first: a retry flips its row to an open status, which would collide with a still-open
      // sibling on ingestion_jobs_one_open_per_document_uidx. (Audit I2/E2, preserved.)
      for (const { action, expected } of applicable) {
        if (action.action !== "supersede") continue;
        if (!expected.jobStatus) {
          lostRace(action, "job status was unreadable at re-read");
          continue;
        }

        const supersede = supabase
          .from("ingestion_jobs")
          .update({
            status: "completed",
            stage: "superseded by successful index",
            progress: 100,
            error_message: null,
            locked_at: null,
            locked_by: null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", action.jobId)
          .eq("status", expected.jobStatus);
        const guarded =
          expected.jobLockedAt === null
            ? supersede.is("locked_at", null)
            : supersede.eq("locked_at", expected.jobLockedAt);

        const { data: rows, error: supersedeError } = await guarded.select("id");
        if (supersedeError) throw supabaseStageError("supersede sibling ingestion job", supersedeError);
        if ((rows ?? []).length === 0) {
          lostRace(action, "job changed state before the write");
          continue;
        }
        supersededCount += 1;
      }

      for (const { action, expected } of applicable) {
        if (action.action !== "retry") continue;
        if (!expected.jobStatus) {
          lostRace(action, "job status was unreadable at re-read");
          continue;
        }

        // Phase 1 — take the recovery lock, guarded on the exact row state observed at re-read.
        const claim = supabase
          .from("ingestion_jobs")
          .update({
            status: "processing",
            stage: "recovery: resetting index",
            error_message: null,
            locked_by: recoveryWorkerId,
            locked_at: new Date().toISOString(),
          })
          .eq("id", action.jobId)
          .eq("status", expected.jobStatus);
        const guardedClaim =
          expected.jobLockedAt === null ? claim.is("locked_at", null) : claim.eq("locked_at", expected.jobLockedAt);

        const { data: claimed, error: claimError } = await guardedClaim.select("id");
        if (claimError) {
          // 23505 = another open job for this document appeared after the re-read. Leave it to that job.
          if ((claimError as { code?: string }).code === "23505") {
            lostRace(action, "another open job for this document appeared before the write");
            continue;
          }
          throw supabaseStageError("claim ingestion job for recovery", claimError);
        }
        if ((claimed ?? []).length === 0) {
          lostRace(action, "job changed state before the write");
          continue;
        }

        // Everything from here is compensated on failure, because the recovery lock is now held.
        let indexWasCleared = false;
        try {
          // Phase 2 — reset the document, guarded on the document status observed at re-read, so a
          // document that reached `indexed` in the meantime keeps its committed index.
          const documentUpdate = supabase
            .from("documents")
            .update({ status: "queued", error_message: null, page_count: 0, chunk_count: 0, image_count: 0 })
            .eq("id", action.documentId);
          const scopedDocument = expected.documentOwnerId
            ? documentUpdate.eq("owner_id", expected.documentOwnerId)
            : documentUpdate.is("owner_id", null);
          const guardedDocument =
            expected.documentStatus === null
              ? scopedDocument.is("status", null)
              : scopedDocument.eq("status", expected.documentStatus);

          const { data: documentRows, error: documentError } = await guardedDocument.select("id");
          if (documentError) throw supabaseStageError("reset document status", documentError);

          if ((documentRows ?? []).length === 0) {
            // The document moved on. Release the lock back to the state we found it in and touch nothing.
            const releaseError = await releaseRecoveryClaim(
              action.jobId,
              "recovery: released, document changed state",
              {
                status: expected.jobStatus,
                locked_at: expected.jobLockedAt,
              },
            );
            if (releaseError) throw supabaseStageError("release recovery lock", releaseError);
            lostRace(action, "document changed state before the write; index left intact");
            continue;
          }

          // Past this point the document row is already zeroed, so a failure cannot be rolled back to
          // the pre-recovery state — the compensation below carries it forward to a retryable one.
          indexWasCleared = true;

          const { error: resetError } = await supabase.rpc("reset_document_index", {
            p_document_id: action.documentId,
          });
          if (resetError) throw supabaseStageError("reset document index", resetError);

          // Phase 3 — release the recovery lock back into the queue for the worker to claim.
          const retryError = await releaseRecoveryClaim(action.jobId, "queued after recovery", {
            status: "pending",
            progress: 0,
            attempt_count: 0,
            error_message: null,
            locked_at: null,
            next_run_at: new Date().toISOString(),
            completed_at: null,
          });
          if (retryError) throw supabaseStageError("requeue ingestion job", retryError);
          retriedCount += 1;
        } catch (error) {
          // Never rethrow while still holding the lock. If the document was not touched, put the job
          // back exactly as it was found. If its index was already cleared, the document genuinely
          // needs a rebuild now, so mark the job `failed` — which the planner treats as recoverable —
          // rather than restoring a status that no longer describes the document.
          const compensationError = indexWasCleared
            ? await releaseRecoveryClaim(action.jobId, "recovery: interrupted after index reset", {
                status: "failed",
                locked_at: null,
                error_message:
                  "Ingestion queue recovery was interrupted after the document index was cleared. Re-run recovery to rebuild.",
              })
            : await releaseRecoveryClaim(action.jobId, "recovery: released after failure", {
                status: expected.jobStatus,
                locked_at: expected.jobLockedAt,
              });

          if (compensationError) {
            // Report and keep going to the throw: the original failure is the more useful one, and a
            // still-locked job ages out of the lock on its own after the stale threshold.
            console.error(
              `  failed to release the recovery lock on job ${action.jobId}; it will free itself once the lock goes stale.`,
            );
          }
          throw error;
        }
      }

      console.log(`Ingestion queue recovery applied (superseded ${supersededCount}, requeued ${retriedCount}).`);
    }

    if (remainingCount > 0) {
      console.log(`\n${remainingCount} action(s) remain over the limit. Re-run to process the next batch.`);
    }
  }

  if (stranded && stranded.length > 0) {
    const { recoverStrandedQueuedDocuments } = await import("@/lib/stranded-queued-recovery");
    const strandedResults = await recoverStrandedQueuedDocuments({ supabase, documents: stranded });
    const enqueued = strandedResults.filter((result) => result.outcome === "enqueued").length;
    const alreadyActive = strandedResults.filter((result) => result.outcome === "already_active").length;
    const errors = strandedResults.filter((result) => result.outcome === "error");
    console.log(`\nStranded enqueued       : ${enqueued}`);
    console.log(`Stranded already active : ${alreadyActive}`);
    if (errors.length > 0) {
      console.log(`Stranded errors         : ${errors.length}`);
      for (const error of errors) {
        console.log(`  - ${error.documentId}: ${error.message}`);
      }
      throw new Error(`Stranded queued recovery reported ${errors.length} error(s).`);
    }
  }
}

main().catch((error) => {
  import("@/lib/privacy")
    .then(({ safeErrorLogDetails }) => {
      console.error("Ingestion queue recovery failed", safeErrorLogDetails(error));
      process.exitCode = 1;
    })
    .catch(() => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
});
