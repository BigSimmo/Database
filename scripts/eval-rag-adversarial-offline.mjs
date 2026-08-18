#!/usr/bin/env node
// Offline adversarial regression harness runner — programme packet B2
// (docs/rag-improvement/README.md §B2). Step 1 validates the fixture contract and
// fails closed on a missing or invalid fixture before any test runs; step 2 runs the
// Vitest harness through the repository's offline test wrapper, which blanks provider
// credentials and forces RAG_PROVIDER_MODE=offline. The harness itself additionally
// rejects network attempts (stubbed fetch) and Supabase round-trip budget breaches.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const [script, args] of [
  ["scripts/check-rag-adversarial-fixtures.mjs", []],
  ["scripts/run-vitest.mjs", ["run", "tests/rag-adversarial-harness.test.ts", ...process.argv.slice(2)]],
]) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: projectRoot, stdio: "inherit" });
  const exitCode = childProcessExitCode(result);
  if (exitCode !== 0) process.exit(exitCode);
}
console.log("Offline adversarial fixture validation and regression harness passed.");
