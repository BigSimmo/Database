#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { childProcessExitCode } from "./child-process-result.mjs";
import { requireProviderTestPermission } from "./test-environment.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitestBin = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(projectRoot);

try {
  requireProviderTestPermission();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const lock = acquireHeavyRunLock({ projectRoot, command: "vitest live provider tests" });
let exitCode = 1;
try {
  const result = spawnSync(process.execPath, [vitestBin, "run", ...process.argv.slice(2)], {
    cwd: projectRoot,
    env: { ...lock.environment, NODE_ENV: "test" },
    stdio: "inherit",
  });
  exitCode = childProcessExitCode(result);
} finally {
  lock.release();
}
process.exit(exitCode);
