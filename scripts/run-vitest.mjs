#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";
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
const memoisable = !args.some((argument) => ["--coverage", "--watch", "--update", "-u", "--ui"].includes(argument));
// Consulted before the lease request so a proven run does not queue for capacity.
const receipt = memoisable
  ? consultGateReceipt({ projectRoot, gate: "vitest", args, env: process.env })
  : { reuse: false, key: null, gate: "vitest", args, reason: "artefact-producing or interactive run" };
if (receipt.reuse) {
  console.log(receipt.message);
  process.exit(0);
}

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
try {
  exitCode = await runVitest();
} finally {
  lock.release();
}

const recorded = recordGateReceipt({ projectRoot, decision: receipt, exitCode, env: process.env });
if (exitCode === 0 && recorded.recorded) {
  console.log(`[gate-receipts] recorded a pass for "vitest ${args.join(" ")}" (${receipt.fileCount} input files).`);
}

process.exit(exitCode);
