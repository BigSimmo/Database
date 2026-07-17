#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";

const isWindows = process.platform === "win32";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseScripts = ["check:runtime", "format:changed", "lint", "typecheck", "test"];

function parseArgs(args) {
  const options = { dryRun: false, extended: false, files: undefined };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (token === "--extended") {
      options.extended = true;
      continue;
    }
    if (token === "--files") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--files requires a comma-separated path list.");
      options.files = value;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log(
        "Usage: npm run verify:pr-local -- [--dry-run] [--files pathA,pathB] [--extended]\n" +
          "  --dry-run  Print the selected checks without running them.\n" +
          "  --files    Classify an explicit comma-separated changed-file list.\n" +
          "  --extended Add the local Chromium UI gate when UI files changed.",
      );
      process.exit(0);
    }
    throw new Error(`Unknown option: ${token}`);
  }

  if (options.extended && !options.dryRun && process.env.ALLOW_EXTENDED_PR_LOCAL !== "true") {
    throw new Error("--extended execution requires ALLOW_EXTENDED_PR_LOCAL=true; use --dry-run to inspect the plan.");
  }

  return options;
}

function runNpmScript(script, environment) {
  console.log(`\n> npm run ${script}`);
  const result = isWindows
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npm run ${script}`], { env: environment, stdio: "inherit" })
    : spawnSync("npm", ["run", script], { env: environment, stdio: "inherit" });
  return childProcessExitCode(result);
}

function readScope(files) {
  const args = ["scripts/ci-change-scope.mjs", "--json"];
  if (files) args.push("--files", files);
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (childProcessExitCode(result) !== 0) process.exit(childProcessExitCode(result));
  return JSON.parse(result.stdout);
}

function selectedScripts(scope, extended) {
  const scripts = [...baseScripts];
  if (scope.build_changed) scripts.push("build");
  // Full unit testing already includes every offline RAG contract suite.
  if (scope.rag_eval_changed) scripts.push("check:rag:fixtures");
  if (extended && scope.ui_changed) scripts.push("verify:ui");
  return scripts;
}

const options = parseArgs(process.argv.slice(2));
const scope = readScope(options.files);
const scripts = selectedScripts(scope, options.extended);
console.log(`Changed files: ${scope.files.length > 0 ? scope.files.join(", ") : "(none detected)"}`);

if (options.dryRun) {
  console.log("\nPR-local verification plan (dry run):");
  for (const script of scripts) console.log(`- npm run ${script}`);
  if (!scope.build_changed) console.log("- build skipped: no build-affecting changes detected");
  if (!scope.rag_eval_changed)
    console.log("- offline RAG fixture validation skipped: no RAG-affecting changes detected");
  if (options.extended && !scope.ui_changed)
    console.log("- Chromium UI gate skipped: no UI-affecting changes detected");
  process.exit(0);
}

const lock = acquireHeavyRunLock({ projectRoot, command: "npm run verify:pr-local" });
let exitCode = 0;
try {
  for (const script of scripts) {
    exitCode = runNpmScript(script, lock.environment);
    if (exitCode !== 0) break;
  }
} finally {
  lock.release();
}

if (exitCode !== 0) process.exit(exitCode);

if (!scope.build_changed)
  console.log("\nSkipping build: no build-affecting source, config, package, or container changes detected.");
