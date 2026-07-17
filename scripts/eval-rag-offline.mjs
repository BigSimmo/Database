#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { childProcessExitCode } from "./child-process-result.mjs";

for (const [script, args] of [
  ["scripts/check-rag-fixtures.mjs", []],
  ["scripts/test-rag-offline.mjs", process.argv.slice(2)],
]) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
  const exitCode = childProcessExitCode(result);
  if (exitCode !== 0) process.exit(exitCode);
}
console.log("Offline RAG fixture and production-contract checks passed.");
