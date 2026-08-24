#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";
import { DEV_SERVER_BUILD_REFUSED_EXIT_CODE, findRunningProjectServer } from "./guard-next-build.mjs";

const isWindows = process.platform === "win32";
// Live Supabase audits (check:locality-metadata) stay out of this unconditional gate.
const commonScripts = ["check:runtime", "check:installed-lock-parity", "format:changed"];
const docsScripts = [
  "sitemap:check",
  "docs:check-index",
  "docs:check-inventory",
  "docs:check-scripts",
  "docs:check-links",
  "check:branch-review-ledger",
  "check:outstanding-issues",
  "check:ledger-write-discipline",
];
const workflowScripts = [
  "check:github-actions",
  "check:ci-scope",
  "check:gitleaks-pinned",
  "check:ci-triage",
  "check:pr-policy",
  "check:agent-policy",
  "check:gate-manifest",
  "check:skills",
  "check:pr-mergeability",
  "check:verification-plan",
];
const focusedWorkflowTestScript = "test:ci-workflows";
const staticHeavyScripts = ["lint", "typecheck", "test"];

function dependencyManifestChanged(scope) {
  if (scope.lockfile_changed) return true;
  return (scope.files ?? []).some((file) => {
    const normalized = String(file).replaceAll("\\", "/");
    return /(^|\/)package(?:-lock)?\.json$/.test(normalized);
  });
}

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

export function selectedScripts(scope, extended) {
  const scripts = [];
  const add = (...items) => {
    for (const item of items) if (!scripts.includes(item)) scripts.push(item);
  };

  add(...commonScripts);
  // #204: fail locally in seconds instead of reddening every install-owning CI job.
  if (dependencyManifestChanged(scope)) add("check:npm-ci-dry-run");
  if (scope.docs_changed) add(...docsScripts);
  if (scope.workflow_changed) {
    add(...workflowScripts);
    // The full unit suite already contains every workflow-reading contract.
    // Keep the focused invocation only for recognised lightweight workflow scope.
    if (!scope.static_heavy_changed) add(focusedWorkflowTestScript);
  }
  if (scope.codex_autofix_changed) add("check:codex-autofix-workflow");
  if (scope.static_heavy_changed) add(...staticHeavyScripts);
  if (scope.build_changed) scripts.push("build");
  // Full offline RAG contracts remain mandatory for retrieval/answer surfaces.
  // Other executable changes retain the cheap fixture-integrity guard, while
  // recognised docs and workflow-only changes avoid an unrelated RAG scan.
  if (scope.rag_eval_changed) add("eval:rag:offline", "eval:rag:adversarial:offline");
  else if (scope.static_heavy_changed) add("check:rag:fixtures");
  // `data/medication-interaction-index.json` is generated from the medication
  // snapshot plus the curated lexicon, and the UI reads it to decide whether a
  // drug can be shown as clear. A stale artefact therefore silently serves an
  // old safety verdict. Cheap and deterministic, so it rides every executable
  // scope rather than needing its own path classification.
  if (scope.static_heavy_changed) add("check:medication-interactions");
  // The lexicon review sheet is the artefact a clinician signs off; if it does
  // not describe the current lexicon, the sign-off covers something else.
  if (scope.static_heavy_changed) add("check:medication-lexicon-report");
  if (extended && scope.ui_changed) add("verify:ui");
  return scripts;
}

/**
 * Closing summary so a selected-but-not-executed step cannot look like a green pass (#167).
 * @param {string[]} scripts
 * @param {{ completed: string[], failedScript: string | null, failedExitCode: number }} progress
 */
export function summarizePrLocalRun(scripts, progress) {
  const completed = progress.completed ?? [];
  const failedScript = progress.failedScript ?? null;
  const failedExitCode = progress.failedExitCode ?? 0;
  const notReached = failedScript
    ? scripts.slice(scripts.indexOf(failedScript) + 1)
    : scripts.filter((script) => !completed.includes(script));

  const lines = ["", "PR-local verification summary:"];
  lines.push(`- completed: ${completed.length ? completed.join(", ") : "(none)"}`);
  if (failedScript) {
    lines.push(`- failed: ${failedScript} (exit ${failedExitCode})`);
    if (failedScript === "build" && failedExitCode === DEV_SERVER_BUILD_REFUSED_EXIT_CODE) {
      lines.push(
        `- note: production build was refused while the Clinical KB dev server is running (BUILD_REFUSED_DEV_SERVER). This is a failed gate, not a skip. Advice: Stop the dev server process, clear .next, and re-run verify:pr-local (or set ALLOW_BUILD_WITH_DEV_SERVER=1).`,
      );
    }
  } else {
    lines.push("- failed: (none)");
  }
  lines.push(`- not reached: ${notReached.length ? notReached.join(", ") : "(none)"}`);
  return lines.join("\n");
}

/**
 * Pre-check for running dev server before executing PR-local build step (#G4M3DV).
 * Warns early with actionable advice so an active `npm run ensure` / dev server
 * process doesn't cause a surprising BUILD_REFUSED_DEV_SERVER failure.
 */
export async function checkDevServerPreflight(
  scripts,
  { findServer = findRunningProjectServer, warn = console.warn, env = process.env } = {},
) {
  if (!scripts.includes("build") || env.ALLOW_BUILD_WITH_DEV_SERVER === "1") {
    return null;
  }

  const runningPort = await findServer();
  if (runningPort) {
    warn(
      [
        `\n[verify:pr-local] WARNING: Clinical KB dev server is running on http://localhost:${runningPort}.`,
        "The upcoming 'build' step will fail with BUILD_REFUSED_DEV_SERVER (exit 76).",
        "Advice: Stop the running dev server process before the build step, or set ALLOW_BUILD_WITH_DEV_SERVER=1.",
      ].join("\n"),
    );
    return runningPort;
  }
  return null;
}

export function runPrLocalScripts(
  scripts,
  { runScript = runNpmScript, log = console.log, error = console.error } = {},
) {
  const completed = [];
  let failedScript = null;
  let failedExitCode = 0;

  for (const script of scripts) {
    const exitCode = runScript(script);
    if (exitCode !== 0) {
      failedScript = script;
      failedExitCode = exitCode;
      break;
    }
    completed.push(script);
  }

  const summary = summarizePrLocalRun(scripts, { completed, failedScript, failedExitCode });
  if (failedExitCode !== 0) error(summary);
  else log(summary);

  return failedExitCode;
}

function assertPlan(name, scope, expected, extended = false) {
  const actual = selectedScripts(scope, extended);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}: expected ${expected.join(", ")}; received ${actual.join(", ")}`);
  }
}

async function selfTest() {
  assertPlan("docs-only", { docs_changed: true }, [...commonScripts, ...docsScripts]);
  assertPlan("workflow-only", { workflow_changed: true }, [
    ...commonScripts,
    ...workflowScripts,
    focusedWorkflowTestScript,
  ]);
  assertPlan(
    "mixed-workflow-heavy-does-not-repeat-workflow-tests",
    {
      workflow_changed: true,
      static_heavy_changed: true,
    },
    [
      ...commonScripts,
      ...workflowScripts,
      ...staticHeavyScripts,
      "check:rag:fixtures",
      "check:medication-interactions",
      "check:medication-lexicon-report",
    ],
  );
  assertPlan("unknown-or-product-change-fails-heavy", { static_heavy_changed: true }, [
    ...commonScripts,
    ...staticHeavyScripts,
    "check:rag:fixtures",
    "check:medication-interactions",
    "check:medication-lexicon-report",
  ]);
  assertPlan("rag-change", { static_heavy_changed: true, rag_eval_changed: true }, [
    ...commonScripts,
    ...staticHeavyScripts,
    "eval:rag:offline",
    "eval:rag:adversarial:offline",
    "check:medication-interactions",
    "check:medication-lexicon-report",
  ]);
  assertPlan(
    "ui-extended",
    { static_heavy_changed: true, ui_changed: true },
    [
      ...commonScripts,
      ...staticHeavyScripts,
      "check:rag:fixtures",
      "check:medication-interactions",
      "check:medication-lexicon-report",
      "verify:ui",
    ],
    true,
  );
  assertPlan(
    "lockfile-change-adds-npm-ci-dry-run",
    { lockfile_changed: true, static_heavy_changed: true, build_changed: true },
    [
      ...commonScripts,
      "check:npm-ci-dry-run",
      ...staticHeavyScripts,
      "build",
      "check:rag:fixtures",
      "check:medication-interactions",
      "check:medication-lexicon-report",
    ],
  );
  assertPlan(
    "package-json-change-adds-npm-ci-dry-run",
    { files: ["package.json"], static_heavy_changed: true, build_changed: true },
    [
      ...commonScripts,
      "check:npm-ci-dry-run",
      ...staticHeavyScripts,
      "build",
      "check:rag:fixtures",
      "check:medication-interactions",
      "check:medication-lexicon-report",
    ],
  );

  const warnings = [];
  const warn = (msg) => warnings.push(msg);

  const noBuildPort = await checkDevServerPreflight(["lint", "test"], {
    findServer: async () => 3000,
    warn,
  });
  if (noBuildPort !== null || warnings.length !== 0) {
    throw new Error("checkDevServerPreflight: expected null and no warning when build is absent");
  }

  const allowedPort = await checkDevServerPreflight(["build"], {
    findServer: async () => 3000,
    warn,
    env: { ALLOW_BUILD_WITH_DEV_SERVER: "1" },
  });
  if (allowedPort !== null || warnings.length !== 0) {
    throw new Error("checkDevServerPreflight: expected null and no warning when ALLOW_BUILD_WITH_DEV_SERVER=1");
  }

  const runningPort = await checkDevServerPreflight(["build"], {
    findServer: async () => 3000,
    warn,
    env: {},
  });
  if (runningPort !== 3000 || warnings.length === 0 || !warnings[0].includes("BUILD_REFUSED_DEV_SERVER")) {
    throw new Error("checkDevServerPreflight: expected port 3000 and warning when dev server is running");
  }

  console.log("PR-local verification plan self-test passed.");
}

if (process.argv.includes("--self-test")) {
  await selfTest();
  process.exit(0);
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
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

  await checkDevServerPreflight(scripts);

  const exitCode = runPrLocalScripts(scripts);

  if (exitCode !== 0) process.exit(exitCode);

  if (!scope.build_changed)
    console.log("\nSkipping build: no build-affecting source, config, package, or container changes detected.");
}
