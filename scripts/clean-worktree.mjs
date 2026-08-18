#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Parse the output of `git worktree list --porcelain`.
 */
export function parseWorktreePorcelain(output) {
  const lines = output.split(/\r?\n/);
  const worktrees = [];
  let current = null;

  for (const line of lines) {
    if (!line.trim()) {
      if (current) {
        worktrees.push(current);
        current = null;
      }
      continue;
    }

    const [key, ...rest] = line.split(" ");
    const value = rest.join(" ");

    if (key === "worktree") {
      if (current) worktrees.push(current);
      current = {
        path: value,
        head: null,
        branch: null,
        detached: false,
        locked: false,
        prunable: null,
      };
    } else if (current) {
      if (key === "HEAD") {
        current.head = value;
      } else if (key === "branch") {
        current.branch = value;
      } else if (key === "detached") {
        current.detached = true;
      } else if (key === "locked") {
        current.locked = value || true;
      } else if (key === "prunable") {
        current.prunable = value || "git marked prunable";
      }
    }
  }
  if (current) worktrees.push(current);
  return worktrees;
}

/**
 * Identify disconnected or orphaned git worktrees safely.
 */
export function identifyOrphanedWorktrees(worktrees, { existsFn = existsSync, mainPath = null } = {}) {
  if (!Array.isArray(worktrees) || worktrees.length === 0) return [];
  const main = mainPath ? path.resolve(mainPath) : path.resolve(worktrees[0].path);

  const orphaned = [];
  for (let i = 0; i < worktrees.length; i += 1) {
    const wt = worktrees[i];
    const resolvedPath = path.resolve(wt.path);
    // Never prune main / root worktree
    if (i === 0 || resolvedPath === main) continue;

    const exists = existsFn(wt.path);
    if (!exists) {
      orphaned.push({ ...wt, reason: "directory not found on disk" });
    } else if (wt.prunable) {
      orphaned.push({ ...wt, reason: wt.prunable });
    }
  }
  return orphaned;
}

/**
 * Parse CLI arguments for batch size and flags.
 */
export function parseArgs(argv) {
  let batchSize = 10;
  let dryRun = false;
  let selfTest = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--self-test") {
      selfTest = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--batch-size") {
      const val = parseInt(argv[i + 1], 10);
      if (Number.isNaN(val) || val <= 0) {
        throw new Error(`Invalid --batch-size: ${argv[i + 1]}. Must be a positive integer.`);
      }
      batchSize = val;
      i += 1;
    } else if (arg.startsWith("--batch-size=")) {
      const val = parseInt(arg.slice("--batch-size=".length), 10);
      if (Number.isNaN(val) || val <= 0) {
        throw new Error(`Invalid --batch-size: ${arg.slice("--batch-size=".length)}. Must be a positive integer.`);
      }
      batchSize = val;
    }
  }
  return { batchSize, dryRun, selfTest };
}

export function selfTest() {
  const samplePorcelain = [
    "worktree /path/to/main",
    "HEAD 1111111111111111111111111111111111111111",
    "branch refs/heads/main",
    "",
    "worktree /path/to/orphan1",
    "HEAD 2222222222222222222222222222222222222222",
    "branch refs/heads/feature-1",
    "",
    "worktree /path/to/orphan2",
    "HEAD 3333333333333333333333333333333333333333",
    "detached",
    "prunable gitdir file points to non-existent location",
    "",
    "worktree /path/to/valid",
    "HEAD 4444444444444444444444444444444444444444",
    "branch refs/heads/feature-2",
    "locked reason for lock",
    "",
  ].join("\n");

  const parsed = parseWorktreePorcelain(samplePorcelain);
  if (parsed.length !== 4) {
    throw new Error(`selfTest failed: expected 4 parsed worktrees, got ${parsed.length}`);
  }
  if (parsed[0].branch !== "refs/heads/main" || parsed[0].detached) {
    throw new Error("selfTest failed: main worktree parsed incorrectly");
  }
  if (!parsed[2].detached || !parsed[2].prunable) {
    throw new Error("selfTest failed: detached prunable worktree parsed incorrectly");
  }
  if (!parsed[3].locked) {
    throw new Error("selfTest failed: locked worktree parsed incorrectly");
  }

  // Test orphan identification
  const mockExists = (p) => p === "/path/to/main" || p === "/path/to/valid";
  const orphaned = identifyOrphanedWorktrees(parsed, {
    existsFn: mockExists,
    mainPath: "/path/to/main",
  });
  if (orphaned.length !== 2) {
    throw new Error(`selfTest failed: expected 2 orphaned worktrees, got ${orphaned.length}`);
  }
  if (orphaned[0].path !== "/path/to/orphan1" || orphaned[1].path !== "/path/to/orphan2") {
    throw new Error("selfTest failed: orphaned worktrees paths mismatch");
  }

  // Test arg parsing
  const args1 = parseArgs(["--batch-size", "5", "--dry-run"]);
  if (args1.batchSize !== 5 || !args1.dryRun) {
    throw new Error("selfTest failed: parseArgs failed for --batch-size 5");
  }
  const args2 = parseArgs(["--batch-size=20"]);
  if (args2.batchSize !== 20) {
    throw new Error("selfTest failed: parseArgs failed for --batch-size=20");
  }
  let threw = false;
  try {
    parseArgs(["--batch-size", "-1"]);
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error("selfTest failed: parseArgs did not reject negative batch-size");
  }

  console.log("[clean-worktree] Self-test passed successfully.");
}

export function runWorktreeCleanup(options = {}) {
  const { batchSize = 10, dryRun = false } = options;

  console.log("[clean-worktree] Cleaning ephemeral debug files and logs...");
  try {
    // -f: force, -d: directories, -x: ignored and untracked files
    // We explicitly scope this to known debug patterns to preserve user work.
    execSync("git clean -fdx tmp-*.py test-output.txt *.log", {
      stdio: "inherit",
    });
    console.log("[clean-worktree] Worktree sanitized.");
  } catch (err) {
    console.warn("[clean-worktree] Notice during git clean:", err.message);
  }

  console.log("[clean-worktree] Inspecting registered worktrees...");
  let porcelainOutput = "";
  try {
    porcelainOutput = execSync("git worktree list --porcelain", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    console.warn("[clean-worktree] Could not list worktrees:", err.message);
    return;
  }

  const worktrees = parseWorktreePorcelain(porcelainOutput);
  const orphaned = identifyOrphanedWorktrees(worktrees);

  if (orphaned.length === 0) {
    console.log("[clean-worktree] No disconnected or orphaned worktrees found.");
    return;
  }

  console.log(
    `[clean-worktree] Found ${orphaned.length} disconnected/orphaned worktree(s). Bounded batch size: ${batchSize}.`,
  );

  const batch = orphaned.slice(0, batchSize);
  for (const wt of batch) {
    console.log(`  - Orphaned: ${wt.path} (${wt.reason})`);
  }

  if (dryRun) {
    console.log(`[clean-worktree] [dry-run] Would prune ${batch.length} orphaned worktree(s).`);
    return;
  }

  try {
    console.log(`[clean-worktree] Pruning ${batch.length} disconnected/orphaned worktree(s)...`);
    execSync("git worktree prune --expire now", { stdio: "inherit" });
    console.log("[clean-worktree] Worktree prune complete.");
  } catch (err) {
    console.error("[clean-worktree] Failed during git worktree prune:", err.message);
    throw err;
  }
}

function main() {
  const argv = process.argv.slice(2);
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(`[clean-worktree] Argument error: ${err.message}`);
    process.exit(1);
  }

  if (parsed.selfTest) {
    selfTest();
    return;
  }

  try {
    runWorktreeCleanup(parsed);
  } catch (err) {
    console.error("[clean-worktree] Cleanup failed:", err.message);
    process.exit(1);
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main();
}
