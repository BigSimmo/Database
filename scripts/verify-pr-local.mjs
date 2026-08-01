#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { childProcessExitCode } from "./child-process-result.mjs";

const isWindows = process.platform === "win32";
// Live Supabase audits (check:locality-metadata) stay out of this unconditional gate.
const commonScripts = ["check:runtime", "check:installed-lock-parity", "format:changed"];
const docsScripts = [
  "sitemap:check",
  "docs:check-index",
  "docs:check-inventory",
  "docs:check-scripts",
  "docs:check-links",
];
const workflowScripts = [
  "check:github-actions",
  "check:ci-scope",
  "check:gitleaks-pinned",
  "check:ci-triage",
  "check:pr-policy",
  "check:gate-manifest",
  "check:pr-mergeability",
  "check:verification-plan",
  "test:ci-workflows",
];
const staticHeavyScripts = ["lint", "typecheck", "test"];

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
  const scripts = [];
  const add = (...items) => {
    for (const item of items) if (!scripts.includes(item)) scripts.push(item);
  };

  add(...commonScripts);
  if (scope.docs_changed) add(...docsScripts);
  if (scope.workflow_changed) add(...workflowScripts);
  if (scope.codex_autofix_changed) add("check:codex-autofix-workflow");
  if (scope.static_heavy_changed) add(...staticHeavyScripts);
  if (scope.build_changed) scripts.push("build");
  // Full offline RAG contracts remain mandatory for retrieval/answer surfaces.
  // Other executable changes retain the cheap fixture-integrity guard, while
  // recognised docs and workflow-only changes avoid an unrelated RAG scan.
  if (scope.rag_eval_changed) add("eval:rag:offline");
  else if (scope.static_heavy_changed) add("check:rag:fixtures");
  if (extended && scope.ui_changed) add("verify:ui");
  return scripts;
}

function assertPlan(name, scope, expected, extended = false) {
  const actual = selectedScripts(scope, extended);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}: expected ${expected.join(", ")}; received ${actual.join(", ")}`);
  }
}

function selfTest() {
  assertPlan("docs-only", { docs_changed: true }, [...commonScripts, ...docsScripts]);
  assertPlan("workflow-only", { workflow_changed: true }, [...commonScripts, ...workflowScripts]);
  assertPlan("unknown-or-product-change-fails-heavy", { static_heavy_changed: true }, [
    ...commonScripts,
    ...staticHeavyScripts,
    "check:rag:fixtures",
  ]);
  assertPlan("rag-change", { static_heavy_changed: true, rag_eval_changed: true }, [
    ...commonScripts,
    ...staticHeavyScripts,
    "eval:rag:offline",
  ]);
  assertPlan(
    "ui-extended",
    { static_heavy_changed: true, ui_changed: true },
    [...commonScripts, ...staticHeavyScripts, "check:rag:fixtures", "verify:ui"],
    true,
  );
  console.log("PR-local verification plan self-test passed.");
}

if (process.argv.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

const options = parseArgs(process.argv.slice(2));
const scope = readScope(options.files);
const scripts = selectedScripts(scope, options.extended);
console.log(`Changed files: ${scope.files.length > 0 ? scope.files.join(", ") : "(none detected)"}`);

if (options.dryRun) {
  console.log("\nPR-local verification plan (dry run):");
  for (const script of scripts) console.log(`- npm run ${script}`);
  if (!scope.static_heavy_changed)
    console.log("- lint, typecheck, full unit suite and RAG fixture scan skipped: recognised low-risk scope");
  if (!scope.build_changed) console.log("- build skipped: no build-affecting changes detected");
  if (!scope.static_heavy_changed) console.log("- offline RAG checks skipped: no executable product scope");
  else if (!scope.rag_eval_changed)
    console.log("- offline RAG production contracts skipped: no RAG-scoped changes (fixtures still selected)");
  if (options.extended && !scope.ui_changed)
    console.log("- Chromium UI gate skipped: no UI-affecting changes detected");
  process.exit(0);
}

let exitCode = 0;
for (const script of scripts) {
  exitCode = runNpmScript(script);
  if (exitCode !== 0) break;
}

if (exitCode !== 0) process.exit(exitCode);

if (!scope.build_changed)
  console.log("\nSkipping build: no build-affecting source, config, package, or container changes detected.");
