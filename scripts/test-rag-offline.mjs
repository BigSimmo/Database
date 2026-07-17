#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractTests = JSON.parse(
  readFileSync(path.join(projectRoot, "scripts/fixtures/rag-offline-contract-tests.json"), "utf8"),
);
const result = spawnSync(
  process.execPath,
  [path.join(projectRoot, "scripts/run-vitest.mjs"), "run", ...contractTests, ...process.argv.slice(2)],
  { cwd: projectRoot, stdio: "inherit" },
);
process.exit(childProcessExitCode(result));
