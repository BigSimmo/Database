#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";
import { offlineTestEnvironment } from "./test-environment.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitestBin = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const args = process.argv.slice(2);
const lock = acquireHeavyRunLock({ projectRoot, command: `vitest ${args.join(" ")}` });
let exitCode = 1;
try {
  const result = spawnSync(process.execPath, [vitestBin, ...args], {
    cwd: projectRoot,
    env: offlineTestEnvironment(lock.environment, { NODE_ENV: "test" }),
    stdio: "inherit",
  });
  exitCode = childProcessExitCode(result);
} finally {
  lock.release();
}
process.exit(exitCode);
