#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";
import { arbitrate, recordGateOutcome } from "./gate-arbiter.mjs";
import { consultGateReceipt, recordGateReceipt } from "./gate-receipts.mjs";
import { offlineTestEnvironment } from "./test-environment.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import { vitestLeaseMode } from "./test-run-selection.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitestBin = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const args = process.argv.slice(2);
const mode = vitestLeaseMode(args);

// Only plain result-producing runs are memoisable. A coverage run's artefact IS
// part of its output, watch mode has no terminal result to record, and snapshot
// updates mutate the tree they were keyed on.
//
// Matched by prefix, not by equality: Vitest accepts `--coverage.enabled` and
// `--coverage=true` as well as the bare `--coverage`, and an exact-match list let a
// dotted invocation be memoised — after which a later identical run would skip and
// leave `coverage/` stale or missing for the gates that read it. Reported by Codex
// review on PR #2216. `--no-coverage` correctly does not match, so it stays
// memoisable; an explicit `--coverage=false` merely runs the gate, which is the safe
// direction.
const NON_MEMOISABLE_ARGUMENT = /^--(?:coverage|watch|update|ui)(?:[.=]|$)/;
export const vitestRunIsMemoisable = (argumentList) =>
  !argumentList.some((argument) => argument === "-u" || NON_MEMOISABLE_ARGUMENT.test(argument));
const memoisable = vitestRunIsMemoisable(args);
// Consulted before the lease request so a proven run does not queue for capacity.
const receipt = memoisable
  ? consultGateReceipt({ projectRoot, gate: "vitest", args, env: process.env })
  : { reuse: false, key: null, gate: "vitest", args, reason: "artefact-producing or interactive run" };
if (receipt.reuse) {
  console.log(receipt.message);
  process.exit(0);
}

// Weighed BEFORE the lease request, for the same reason the receipt is: a run the
// arbiter would defer must not first queue for cross-worktree capacity. Advisory
// unless GATE_ARBITER=enforce, so a gate a human typed still runs by default.
const verdict = memoisable
  ? arbitrate({ projectRoot, gate: "vitest", env: process.env })
  : { action: "run", enforce: false, message: null };
if (verdict.message && verdict.action !== "run") console.log(verdict.message);
if (verdict.enforce) process.exit(0);

const lock = acquireHeavyRunLock({ projectRoot, command: `vitest ${args.join(" ")}`, mode });
const configuredWorkers = Number(process.env.VITEST_MAX_WORKERS);
const sharedWorkers = Number.isFinite(configuredWorkers) && configuredWorkers > 0 ? Math.min(configuredWorkers, 2) : 2;
const environment = offlineTestEnvironment(lock.environment, {
  NODE_ENV: "test",
  ...(mode === "shared" ? { VITEST_MAX_WORKERS: String(sharedWorkers) } : {}),
});

function runVitest() {
  const child = spawn(process.execPath, [vitestBin, ...args], {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
  });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status, signal) => resolve(childProcessExitCode({ status, signal })));
  });
}

let exitCode = 1;
const startedAt = Date.now();
try {
  exitCode = await runVitest();
} finally {
  lock.release();
}

// Pure observation: this never changes what the run did, it only tells the arbiter
// whether this gate is still catching anything on this class of change.
recordGateOutcome({ projectRoot, gate: "vitest", exitCode, durationMs: Date.now() - startedAt, env: process.env });

const recorded = recordGateReceipt({ projectRoot, decision: receipt, exitCode, env: process.env });
if (exitCode === 0 && recorded.recorded) {
  console.log(`[gate-receipts] recorded a pass for "vitest ${args.join(" ")}" (${receipt.fileCount} input files).`);
}

process.exit(exitCode);
