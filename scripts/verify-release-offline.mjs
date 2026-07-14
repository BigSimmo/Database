#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;
const dryRun = process.argv.includes("--dry-run");
const steps = [
  "check:runtime",
  "lint",
  "typecheck",
  "test",
  "build",
  "test:e2e",
  "check:production-readiness",
  "governance:release",
  "eval:quality:release:offline",
];
const offlineEnv = {
  ...process.env,
  RAG_PROVIDER_MODE: "offline",
  // Empty values prevent framework env loading from restoring credentials.
  // eval-quality deletes these keys again before importing the RAG runtime.
  OPENAI_API_KEY: "",
  OPENAI_ORG_ID: "",
  OPENAI_PROJECT_ID: "",
};

for (const step of steps) {
  console.log(`[verify:release:offline] npm run ${step}`);
  if (dryRun) continue;
  if (!npmCli) {
    console.error("[verify:release:offline] npm_execpath is unavailable; invoke this through npm run.");
    process.exit(1);
  }
  const result = spawnSync(process.execPath, [npmCli, "run", step], {
    cwd: process.cwd(),
    env: offlineEnv,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    console.error(`[verify:release:offline] Could not run ${step}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[verify:release:offline] ${step} failed with exit code ${result.status ?? 1}.`);
    process.exit(result.status ?? 1);
  }
}

console.log(
  dryRun
    ? "[verify:release:offline] Dry run complete; no checks were executed."
    : "[verify:release:offline] All offline release checks passed.",
);
