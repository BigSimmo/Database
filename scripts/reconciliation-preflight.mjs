#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listRepoNodeProcesses } from "./run-eval-safe.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const operationMarkers = [
  "MERGE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
  "BISECT_LOG",
  "rebase-merge",
  "rebase-apply",
  "sequencer",
];

function normalizePath(value) {
  const resolved = path.resolve(String(value ?? ""));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function git(args, cwd = repositoryRoot, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    if (allowFailure) return "";
    throw error;
  }
}

function tryGit(args, cwd) {
  try {
    return { ok: true, output: git(args, cwd) };
  } catch {
    return { ok: false, output: "" };
  }
}

export function parseWorktreePorcelain(text) {
  const worktrees = [];
  let current;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    if (!line) {
      if (current?.path) worktrees.push(current);
      current = undefined;
      continue;
    }
    const separator = line.indexOf(" ");
    const key = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? true : line.slice(separator + 1);
    if (key === "worktree") {
      if (current?.path) worktrees.push(current);
      current = { path: value };
    } else if (current) {
      if (key === "HEAD") current.head = value;
      else if (key === "branch") current.branch = String(value).replace(/^refs\/heads\//, "");
      else if (key === "detached") current.detached = true;
      else if (key === "locked") current.locked = value;
      else if (key === "prunable") current.prunable = value;
    }
  }
  if (current?.path) worktrees.push(current);
  return worktrees;
}

export function classifyReconciliationState({ baseCommit, baseRef, worktrees }) {
  const primary = worktrees[0];
  const dirtyWorktrees = worktrees.filter((item) => item.statusEntries > 0);
  const operationWorktrees = worktrees.filter((item) => item.operations.length > 0);
  const unreadableWorktrees = worktrees.filter((item) => item.inspectionErrors?.length > 0);
  const findings = [];

  if (!baseCommit) {
    findings.push({ code: "base-missing", severity: "blocker", detail: `${baseRef} is not locally resolvable.` });
  }
  if (primary?.statusEntries > 0) {
    findings.push({
      code: "primary-dirty",
      severity: "blocker",
      detail: "The primary checkout must be preserved and must not be used as the integration base.",
    });
  }
  if (baseCommit && primary?.head && primary.head !== baseCommit) {
    findings.push({
      code: "primary-base-mismatch",
      severity: "blocker",
      detail: `Primary HEAD differs from cached ${baseRef}.`,
    });
  }
  if (operationWorktrees.length > 0) {
    findings.push({
      code: "active-git-operation",
      severity: "blocker",
      detail: `${operationWorktrees.length} worktree(s) have an active Git operation.`,
    });
  }
  if (unreadableWorktrees.length > 0) {
    findings.push({
      code: "worktree-inspection-failed",
      severity: "blocker",
      detail: `${unreadableWorktrees.length} worktree(s) could not be inspected completely.`,
    });
  }
  if (dirtyWorktrees.length > 0) {
    findings.push({
      code: "preserve-dirty-worktrees",
      severity: "preserve",
      detail: `${dirtyWorktrees.length} worktree(s) contain tracked or untracked changes and require individual disposition.`,
    });
  }

  return {
    baseRef,
    baseCommit: baseCommit || null,
    primaryPath: primary?.path ?? null,
    totals: {
      worktrees: worktrees.length,
      dirty: dirtyWorktrees.length,
      detached: worktrees.filter((item) => item.detached).length,
      activeOperations: operationWorktrees.length,
      inspectionFailures: unreadableWorktrees.length,
    },
    integrationBase: "dedicated-worktree-required",
    blocking: findings.some((item) => item.severity === "blocker"),
    findings,
    worktrees,
  };
}

function resolveBaseRef(explicitBaseRef) {
  if (explicitBaseRef) return explicitBaseRef;
  const remoteHead = git(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], repositoryRoot, {
    allowFailure: true,
  });
  if (remoteHead) return remoteHead;
  if (git(["rev-parse", "--verify", "--quiet", "origin/main"], repositoryRoot, { allowFailure: true })) {
    return "origin/main";
  }
  return "main";
}

function inspectWorktree(item, baseRef, baseCommit) {
  const statusResult = tryGit(["status", "--porcelain=v1", "--untracked-files=normal"], item.path);
  const gitDirectoryResult = tryGit(["rev-parse", "--path-format=absolute", "--git-dir"], item.path);
  const countsResult = baseCommit
    ? tryGit(["rev-list", "--left-right", "--count", `${baseRef}...${item.head}`], item.path)
    : { ok: true, output: "" };
  const inspectionErrors = [];
  if (!statusResult.ok) inspectionErrors.push("status-unreadable");
  if (!gitDirectoryResult.ok || !gitDirectoryResult.output) inspectionErrors.push("git-directory-unresolved");
  if (baseCommit && !countsResult.ok) inspectionErrors.push("divergence-unreadable");
  const operations = gitDirectoryResult.ok
    ? operationMarkers.filter((marker) => existsSync(path.join(gitDirectoryResult.output, marker)))
    : [];
  const parsedCounts = countsResult.ok
    ? countsResult.output.split(/\s+/).map((value) => Number.parseInt(value, 10))
    : [];
  const behind = Number.isFinite(parsedCounts[0]) ? parsedCounts[0] : null;
  const ahead = Number.isFinite(parsedCounts[1]) ? parsedCounts[1] : null;
  return {
    path: path.resolve(item.path),
    head: item.head ?? null,
    branch: item.branch ?? null,
    detached: Boolean(item.detached),
    locked: item.locked ?? null,
    prunable: item.prunable ?? null,
    statusEntries: statusResult.ok ? statusResult.output.split(/\r?\n/).filter(Boolean).length : null,
    operations,
    inspectionErrors,
    behind,
    ahead,
  };
}

/**
 * @param {Array<{ path: string }>} worktrees
 * @param {(roots: string[]) => Array<{ pid: number, parentPid: number, createdAtMs: number | null }>} [listProcesses]
 */
export function collectProcessDiagnostics(worktrees, listProcesses = listRepoNodeProcesses) {
  const roots = worktrees.map((item) => item.path).filter(Boolean);
  return {
    matchingWorktreeNodeProcesses: listProcesses(roots).length,
    rawCommandLinesSerialized: false,
  };
}

export function collectReconciliationState({ baseRef: explicitBaseRef, includeProcesses = false } = {}) {
  const baseRef = resolveBaseRef(explicitBaseRef);
  const baseCommit = git(["rev-parse", "--verify", "--quiet", baseRef], repositoryRoot, { allowFailure: true });
  const rawWorktrees = parseWorktreePorcelain(git(["worktree", "list", "--porcelain"]));
  const worktrees = rawWorktrees.map((item) => inspectWorktree(item, baseRef, baseCommit));
  const summary = classifyReconciliationState({ baseCommit, baseRef, worktrees });
  return {
    generatedAt: new Date().toISOString(),
    cachedRefsOnly: true,
    fetched: false,
    processDiagnostics: includeProcesses
      ? collectProcessDiagnostics(worktrees)
      : { skipped: true, rawCommandLinesSerialized: false },
    ...summary,
  };
}

function render(result) {
  console.log("Reconciliation preflight (read-only, cached refs; no fetch)\n");
  console.log(`Base: ${result.baseRef} ${result.baseCommit ?? "(unresolved)"}`);
  console.log(`Primary: ${result.primaryPath ?? "(unknown)"}`);
  console.log(
    `Worktrees: ${result.totals.worktrees} total, ${result.totals.dirty} dirty, ` +
      `${result.totals.detached} detached, ${result.totals.activeOperations} with active Git operations`,
  );
  console.log("Integration base: create a dedicated clean worktree from the freshly fetched remote base.");
  if (result.processDiagnostics.skipped) {
    console.log("Process check: skipped (add --include-processes when ownership could block cleanup).");
  } else {
    console.log(
      `Process check: ${result.processDiagnostics.matchingWorktreeNodeProcesses} registered-worktree Node process(es); ` +
        "raw command lines were not serialized.",
    );
  }
  console.log("\nFindings:");
  if (!result.findings.length) console.log("- none");
  for (const finding of result.findings) console.log(`- [${finding.severity}] ${finding.code}: ${finding.detail}`);
  console.log(
    "\nNext: obtain fetch approval, refresh the remote base, classify by ownership/PR/ledger/ancestry, " +
      "then inspect patch-unique content only for the remaining candidates.",
  );
}

function parseArgs(argv) {
  const options = { json: false, strict: false, includeProcesses: false, baseRef: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") options.json = true;
    else if (token === "--strict") options.strict = true;
    else if (token === "--include-processes") options.includeProcesses = true;
    else if (token === "--base-ref") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) throw new Error("Missing value for --base-ref");
      options.baseRef = value;
      index += 1;
    } else if (token === "--help" || token === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/reconciliation-preflight.mjs [--json] [--strict] [--include-processes] [--base-ref <ref>]",
    );
    return;
  }
  const result = collectReconciliationState(options);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else render(result);
  if (options.strict && result.blocking) process.exitCode = 2;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(`[reconciliation-preflight] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

export const reconciliationPreflightInternals = { normalizePath, operationMarkers };
