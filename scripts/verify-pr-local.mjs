#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const baseScripts = ["check:runtime", "format:check", "lint", "typecheck", "test"];

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

function runNpmScript(script) {
  console.log(`\n> npm run ${script}`);
  const result = isWindows
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npm run ${script}`], { stdio: "inherit" })
    : spawnSync("npm", ["run", script], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readScope(files) {
  const args = ["scripts/ci-change-scope.mjs", "--json"];
  if (files) args.push("--files", files);
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return JSON.parse(result.stdout);
}

function selectedScripts(scope, extended) {
  const scripts = [...baseScripts];
  if (scope.build_changed) scripts.push("build");
  if (scope.rag_eval_changed) scripts.push("eval:rag:offline");
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
  if (!scope.rag_eval_changed) console.log("- offline RAG evaluation skipped: no RAG-affecting changes detected");
  if (options.extended && !scope.ui_changed)
    console.log("- Chromium UI gate skipped: no UI-affecting changes detected");
  process.exit(0);
}

for (const script of scripts) runNpmScript(script);

if (!scope.build_changed)
  console.log("\nSkipping build: no build-affecting source, config, package, or container changes detected.");
