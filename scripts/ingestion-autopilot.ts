import { spawnSync } from "node:child_process";

// ingestion-autopilot — self-healing loop for a stuck ingestion queue.
//
// Silent ingestion stalls are invisible product damage: documents just quietly
// stop becoming searchable. This chains the existing read-only probe
// (reindex-health) to a decision, and — only when a stuck-queue signal is present
// and --apply is passed — runs the existing recovery path (recover-ingestion-queue
// --apply). It ALERTS (non-zero exit) only when Supabase is unreachable or recovery
// fails; a healthy or merely-idle queue exits 0.
//
// Decision is based purely on reindex-health's JSON (a clean read-only probe).
// check-indexing is intentionally NOT chained here: it additionally requires the
// OpenAI + Python/PDF stack and is a strict corpus-readiness gate, so folding it in
// would make the autopilot fragile and noisy. It remains the operator's separate
// readiness check.
//
// Dry-run by default (reports what it WOULD recover). Provider-touching, so it runs
// only in the disabled scheduled workflow or a manual operator run — never in PR CI.

export type IngestionHealth = {
  ok?: boolean;
  status?: string;
  counts?: Record<string, number | null>;
  openJobs?: Array<{
    id?: string;
    status?: string;
    stage?: string | null;
    attempt_count?: number | null;
    max_attempts?: number | null;
    locked_at?: string | null;
    error_message?: string | null;
  }>;
};

export type IngestionAssessment = {
  available: boolean;
  stuck: boolean;
  reasons: string[];
  failedJobs: number;
  staleProcessingJobs: number;
  strandedQueuedDocuments: number;
};

/**
 * Pure assessment of a reindex-health JSON payload. `stuck` is true when there are
 * failed jobs, any open job already in the `failed` state, or a `processing` job
 * whose lock is older than staleAfterMinutes (a worker died mid-job). Env-free and
 * unit-tested.
 */
export function assessIngestionHealth(
  health: IngestionHealth,
  options: { staleAfterMinutes?: number; now?: number } = {},
): IngestionAssessment {
  const staleAfterMinutes = options.staleAfterMinutes ?? 30;
  const now = options.now ?? Date.now();

  if (health.ok === false || health.status === "supabase_unavailable") {
    return {
      available: false,
      stuck: false,
      reasons: ["supabase unavailable"],
      failedJobs: 0,
      staleProcessingJobs: 0,
      strandedQueuedDocuments: 0,
    };
  }

  const reasons: string[] = [];
  const failedJobs = Number(health.counts?.jobs_failed ?? 0) || 0;
  if (failedJobs > 0) reasons.push(`${failedJobs} failed job(s)`);

  const openJobs = health.openJobs ?? [];
  const staleThresholdMs = staleAfterMinutes * 60_000;
  let staleProcessingJobs = 0;
  for (const job of openJobs) {
    if (job.status === "failed") continue; // already counted via jobs_failed
    if (job.status === "processing" && job.locked_at) {
      const lockedAt = Date.parse(job.locked_at);
      if (Number.isFinite(lockedAt) && now - lockedAt > staleThresholdMs) staleProcessingJobs += 1;
    }
  }
  if (staleProcessingJobs > 0) {
    reasons.push(`${staleProcessingJobs} processing job(s) locked > ${staleAfterMinutes}m (stale worker)`);
  }
  const strandedQueuedDocuments = Number(health.counts?.documents_stranded_queued ?? 0) || 0;
  if (strandedQueuedDocuments > 0) {
    reasons.push(`${strandedQueuedDocuments} stranded queued document(s)`);
  }

  return {
    available: true,
    stuck: reasons.length > 0,
    reasons,
    failedJobs,
    staleProcessingJobs,
    strandedQueuedDocuments,
  };
}

function parseIntFlag(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number.parseInt(process.argv[index + 1] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function runTsxScript(script: string, args: string[] = []) {
  return spawnSync(process.execPath, ["scripts/run-tsx.mjs", script, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function main() {
  const apply = process.argv.includes("--apply");
  const alertOnStuck = process.argv.includes("--alert-on-stuck");
  const staleAfterMinutes = parseIntFlag("--stale-after-minutes", 30);
  const limit = parseIntFlag("--limit", 20);

  const probe = runTsxScript("scripts/reindex-health.ts");
  const stdout = probe.stdout ?? "";
  process.stdout.write(stdout);

  let health: IngestionHealth;
  try {
    health = JSON.parse(stdout);
  } catch {
    console.error("[autopilot] could not parse reindex-health output — aborting");
    process.exitCode = 1;
    return;
  }

  const assessment = assessIngestionHealth(health, { staleAfterMinutes });
  if (!assessment.available) {
    console.error("[autopilot] Supabase unavailable — not attempting recovery. Alerting.");
    process.exitCode = 1;
    return;
  }

  if (!assessment.stuck) {
    console.log("[autopilot] queue healthy — nothing to recover.");
    return;
  }

  console.log(`[autopilot] stuck-queue signal: ${assessment.reasons.join("; ")}`);

  if (!apply) {
    console.log(
      `[autopilot] DRY RUN — would run: npm run recover:ingestion -- --apply --yes ` +
        `--include-stranded-queued --stale-after-minutes ${staleAfterMinutes} --limit ${limit}\n` +
        `[autopilot] pass --apply to recover.`,
    );
    if (alertOnStuck) {
      console.error("[autopilot] scheduled probe detected recoverable ingestion work — alerting.");
      process.exitCode = 2;
    }
    return;
  }

  console.log("[autopilot] applying recovery…");
  const recover = runTsxScript("scripts/recover-ingestion-queue.ts", [
    "--apply",
    "--yes",
    "--include-stranded-queued",
    "--stale-after-minutes",
    String(staleAfterMinutes),
    "--limit",
    String(limit),
  ]);
  if (recover.stdout) process.stdout.write(recover.stdout);
  if (recover.stderr) process.stderr.write(recover.stderr);
  if ((recover.status ?? 1) !== 0) {
    console.error("[autopilot] recovery FAILED — alerting.");
    process.exitCode = 1;
    return;
  }
  console.log("[autopilot] recovery applied. Re-probe with npm run reindex:health to confirm.");
}

// Only run as a CLI when invoked directly — importing (tests) must not execute.
const invokedDirectly = process.argv[1]?.endsWith("ingestion-autopilot.ts");
if (invokedDirectly) {
  main();
}
