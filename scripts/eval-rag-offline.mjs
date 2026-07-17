#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const [script, args] of [
  ["scripts/check-rag-fixtures.mjs", []],
  ["scripts/test-rag-offline.mjs", process.argv.slice(2)],
]) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: projectRoot, stdio: "inherit" });
  const exitCode = childProcessExitCode(result);
  if (exitCode !== 0) process.exit(exitCode);
}
console.log("Offline RAG fixture and production-contract checks passed.");
