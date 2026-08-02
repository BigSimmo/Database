import { safeErrorLogDetails } from "../src/lib/privacy";
import type { JobRow } from "./types";
import { WorkerRuntimeControl, WorkerAbortError } from "./runtime-control";

export type WorkerRunLoopDeps = {
  once: boolean;
  pollMs: number;
  healthBackoffMs: number;
  maxClaimFailures: number;
  claim: () => Promise<JobRow[]>;
  process: (job: JobRow) => Promise<void>;
  probe: () => Promise<{ ok: boolean; message?: string }>;
  backoff: (consecutiveFailures: number) => number;
  controller: WorkerRuntimeControl;
  log: (message: string, level: "info" | "warn" | "error", extra?: Record<string, unknown>) => void;
};

export async function runWorkerLoop(deps: WorkerRunLoopDeps): Promise<void> {
  const { once, pollMs, healthBackoffMs, maxClaimFailures, claim, process, probe, backoff, controller, log } = deps;
  let consecutiveClaimFailures = 0;
  let active = 0;

  while (!controller.isStopped || active > 0) {
    let jobs: JobRow[] = [];
    try {
      const health = await probe();
      if (!health.ok) {
        log("Supabase health check failed; worker is backing off", "warn", { message: health.message });
        if (once) {
          throw new WorkerAbortError("Supabase health check failed in --once mode", 1);
        }
        if (controller.isStopped) break;
        await controller.sleep(healthBackoffMs);
        continue;
      }
      jobs = await claim();
      consecutiveClaimFailures = 0;
    } catch (error) {
      if (error instanceof WorkerAbortError) throw error;

      consecutiveClaimFailures += 1;
      log("Ingestion job claim failed", "warn", safeErrorLogDetails(error));
      if (once) throw new WorkerAbortError("Ingestion job claim failed in --once mode", 1);
      if (consecutiveClaimFailures >= maxClaimFailures) {
        if (controller.isStopped) break;
        await controller.sleep(healthBackoffMs);
        continue;
      }
      if (controller.isStopped) break;
      await controller.sleep(backoff(consecutiveClaimFailures));
      continue;
    }

    if (jobs.length > 0) {
      active += jobs.length;
      try {
        await Promise.all(
          jobs.map(async (job) => {
            try {
              await process(job);
            } catch (error) {
              log("Ingestion job processing failed", "error", safeErrorLogDetails(error));
              // Do not rethrow: processJob already applies the configured
              // retry/fail decision; rethrowing would short-circuit the batch
              // and does not honour the per-job semantics.
            }
          }),
        );
      } finally {
        active -= jobs.length;
      }

      if (once) break;
      // If stop was requested while the batch ran, we drain first, then exit.
      continue;
    }

    if (once) break;
    if (controller.isStopped) break;
    await controller.sleep(pollMs);
  }
}
