#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scopeResult = spawnSync(process.execPath, ["scripts/ci-change-scope.mjs", "--json"], {
  cwd: projectRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
if (childProcessExitCode(scopeResult) !== 0) process.exit(childProcessExitCode(scopeResult));

const changedFiles = JSON.parse(scopeResult.stdout).files.filter((file) => existsSync(path.join(projectRoot, file)));
if (changedFiles.length === 0) {
  console.log("No changed files require a formatting check.");
  process.exit(0);
}

const prettierBin = path.join(projectRoot, "node_modules", "prettier", "bin", "prettier.cjs");
const result = spawnSync(process.execPath, [prettierBin, "--check", "--ignore-unknown", "--", ...changedFiles], {
  cwd: projectRoot,
  stdio: "inherit",
});
process.exit(childProcessExitCode(result));
