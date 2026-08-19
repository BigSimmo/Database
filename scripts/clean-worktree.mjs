#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
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
 * Calculate disk usage (bytes and file count) for a directory tree safely.
 */
export function getDirectoryDiskUsage(
  dirPath,
  { readdirFn = readdirSync, statFn = statSync, existsFn = existsSync } = {},
) {
  if (!dirPath || !existsFn(dirPath)) return { bytes: 0, fileCount: 0 };
  let totalBytes = 0;
  let fileCount = 0;

  function walk(current) {
    let entries;
    try {
      entries = readdirFn(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          const st = statFn(fullPath);
          totalBytes += st.size || 0;
          fileCount += 1;
        }
      } catch {
        // Skip unreadable files or transient locks
      }
    }
  }

  walk(dirPath);
  return { bytes: totalBytes, fileCount };
}

/**
 * Format byte count into human-readable string.
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let val = bytes;
  let unitIndex = -1;
  while (val >= 1024 && unitIndex < units.length - 1) {
    val /= 1024;
    unitIndex += 1;
  }
  return `${val.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Identify worktrees whose branch has already landed in origin/main and that hold no
 * unsaved work — the case `identifyOrphanedWorktrees` above structurally cannot see.
 *
 * WHY this exists. Orphan detection only fires when the directory has vanished from disk or
 * when git itself has already flagged the entry `prunable`. The dominant real-world case is
 * neither: the branch merged into origin/main weeks ago, the PR closed, and the directory is
 * still sitting there fully populated. Nothing in the previous cleanup path could ever
 * nominate it, so the fleet only ever grew. Measured on the maintainer's machine 2026-08-18:
 * `git worktree list` reported 48 registered worktrees, 41 of them carrying their own
 * `node_modules`; one measured 51,735 files / 0.89 GB, putting the fleet at roughly 36 GB and
 * ~2.1M files. `git worktree prune --dry-run -v` reported nothing prunable — every one of
 * those 41 was "healthy" by the old definition.
 *
 * WHY the fleet is worth shrinking rather than tolerating. Each stale install is an
 * independent dependency tree, so `check:installed-lock-parity` and
 * `check:playwright-browser-revision` can drift 41 different ways, and the cross-worktree run
 * coordinator (`scripts/run-heavy.mjs` -> `scripts/test-run-lock.mjs`, capped at two
 * concurrent leases) contends across all of them — that is the documented 15-minute
 * `verify:ui` admission queue.
 *
 * WHY it is dependency-injected and this conservative. This function decides what MAY be
 * deleted, so it has to be drivable from `selfTest()` with mocks and no git process at all;
 * it mirrors `identifyOrphanedWorktrees`'s injection shape for exactly that reason. Every
 * predicate below is a reason to KEEP a worktree — detached HEAD, dirty tree, unpushed
 * commit, or lock all disqualify it — because a false negative costs one more day of disk
 * and a false positive costs work that no reflog in that worktree can return.
 *
 * Returns candidates only; it never removes anything and never shells out on its own.
 */
/**
 * @param {Array<any>} worktrees
 * @param {{
 *   isMergedFn?: (branch: string, baseRef?: string) => boolean,
 *   statusFn?: (worktreePath: string) => string,
 *   aheadCountFn?: (branch: string, baseRef?: string) => number,
 *   rawAheadCountFn?: ((branch: string, baseRef?: string) => number) | null,
 *   existsFn?: (path: string) => boolean,
 *   diskUsageFn?: ((path: string) => { bytes: number, fileCount: number }) | null,
 *   mainPath?: string | null,
 *   currentPath?: string | null,
 *   baseRef?: string,
 *   drive?: string | null
 * }} [options]
 * @returns {Array<any>}
 */
export function identifyMergedWorktrees(
  worktrees,
  {
    isMergedFn = (_branch, _baseRef) => false,
    statusFn = (_path) => "",
    aheadCountFn = (_branch, _baseRef) => 0,
    rawAheadCountFn = null,
    existsFn = existsSync,
    diskUsageFn = null,
    mainPath = null,
    currentPath = null,
    baseRef = "origin/main",
    drive = null,
  } = {},
) {
  if (!Array.isArray(worktrees) || worktrees.length === 0) return [];
  const main = mainPath ? path.resolve(mainPath) : path.resolve(worktrees[0].path);
  const current = currentPath ? path.resolve(currentPath) : null;
  const targetDrive = drive ? drive.replace(/:?$/, "").toUpperCase() : null;

  const merged = [];
  for (let i = 0; i < worktrees.length; i += 1) {
    const wt = worktrees[i];
    const resolvedPath = path.resolve(wt.path);

    // Filter by drive if requested (e.g. "D" for Dev Drive)
    if (targetDrive) {
      const match = /^([a-zA-Z]):/.exec(wt.path) || /^([a-zA-Z]):/.exec(resolvedPath);
      if (!match || match[1].toUpperCase() !== targetDrive) continue;
    }

    // Never nominate main/root, and never nominate the worktree this process is running
    // inside: removing your own cwd leaves git and the caller's shell in a broken state.
    if (i === 0 || resolvedPath === main) continue;
    if (current && resolvedPath === current) continue;

    // A lock is an explicit human "do not touch". Honour it without inspecting further.
    if (wt.locked) continue;

    // A detached HEAD has no branch to compare against origin/main, and commits made there
    // are reachable only from that HEAD. Too easy to lose work — skip unconditionally.
    if (wt.detached || !wt.branch) continue;

    // A directory missing from disk is the orphan path's job, not this one's.
    if (!existsFn(wt.path)) continue;

    // The actual "already landed" test: git merge-base --is-ancestor <branch> origin/main.
    if (!isMergedFn(wt.branch, baseRef)) continue;

    // Uncommitted or untracked work is invisible to the ancestor test above. `git worktree
    // remove` would refuse it anyway, but skipping here keeps the listing honest rather than
    // advertising a removal that will fail. A non-string/unreadable status fails closed.
    const status = statusFn(wt.path);
    if (typeof status !== "string" || status.trim() !== "") continue;

    // Under the ANCESTOR test this is belt-and-braces: refs move underneath long-lived
    // worktrees, and a non-numeric answer (git failed) must fail closed rather than read as
    // zero. Under the SQUASH test it is not a second opinion at all — `gitAheadUnlandedCount`
    // returns 0 for any branch the squash test just accepted, so the check is satisfied by
    // construction and can only fire on a candidate that was already skipped. It is kept
    // because it is the real gate in ancestor mode, not because it adds anything in squash mode.
    const ahead = aheadCountFn(wt.branch, baseRef);
    if (!Number.isFinite(ahead) || ahead !== 0) continue;

    // Report the RAW count alongside it. A squash-merged branch keeps its original commits
    if (ahead !== 0) continue;

    let rawAhead = Number.NaN;
    if (typeof rawAheadCountFn === "function") {
      rawAhead = rawAheadCountFn(wt.branch, baseRef);
    }

    let usage = null;
    if (typeof diskUsageFn === "function") {
      usage = diskUsageFn(wt.path);
    }

    const aheadNote =
      Number.isFinite(rawAhead) && rawAhead > 0 ? `(${rawAhead} upstream commits accounted for by squash); ` : "";

    merged.push({
      ...wt,
      mergedInto: baseRef,
      aheadUnlanded: ahead,
      aheadRaw: Number.isFinite(rawAhead) ? rawAhead : null,
      diskUsage: usage,
      reason: `branch merged into ${baseRef}; clean tree; ${aheadNote}0 unlanded commits${wt.head ? ` (tip ${wt.head.slice(0, 9)})` : ""}`,
    });
  }
  return merged;
}

/**
 * Re-verify safety immediately before removing a candidate worktree (#6GW95D).
 * Prevents racing with active sessions that may have switched branches, added commits,
 * or left untracked work.
 * @param {any} wt
 * @param {Object} [options]
 * @param {string | null} [options.mainPath]
 * @param {string | null} [options.currentPath]
 * @param {(path: string) => boolean} [options.existsFn]
 * @param {(path: string) => string} [options.statusFn]
 * @param {(path: string) => string | null} [options.branchFn]
 * @param {(branch: string, baseRef?: string) => number} [options.aheadCountFn]
 * @param {(wt: any, baseRef?: string) => string} [options.confidenceFn]
 * @param {string} [options.baseRef]
 * @returns {{ safe: boolean, reason?: string }}
 */
export function verifyWorktreeSafetyBeforeRemove(
  wt,
  {
    mainPath = null,
    currentPath = null,
    existsFn = existsSync,
    statusFn = gitWorktreeStatus,
    branchFn = gitWorktreeBranch,
    aheadCountFn = gitAheadCount,
    confidenceFn = describeMergeConfidence,
    baseRef = "origin/main",
  } = {},
) {
  if (!wt || !wt.path) {
    return { safe: false, reason: "invalid worktree descriptor" };
  }

  const resolved = path.resolve(wt.path);
  if (mainPath && resolved === path.resolve(mainPath)) {
    return { safe: false, reason: "refusing to remove main worktree" };
  }
  if (currentPath && resolved === path.resolve(currentPath)) {
    return { safe: false, reason: "refusing to remove current working directory worktree" };
  }

  if (!existsFn(wt.path)) {
    return { safe: false, reason: "directory does not exist on disk" };
  }

  if (wt.locked) {
    return { safe: false, reason: "worktree is locked" };
  }

  // Check branch at the worktree immediately before deletion
  const currentBranch = branchFn(wt.path);
  if (!currentBranch || currentBranch === "HEAD" || currentBranch.startsWith("detached")) {
    return { safe: false, reason: "worktree has detached HEAD or invalid branch" };
  }
  const cleanBranch = currentBranch.replace(/^refs\/heads\//, "");
  const expectedBranch = (wt.branch || "").replace(/^refs\/heads\//, "");
  if (expectedBranch && cleanBranch !== expectedBranch) {
    return {
      safe: false,
      reason: `branch switched from ${expectedBranch} to ${cleanBranch} since scan`,
    };
  }

  // Check status immediately before deletion
  const status = statusFn(wt.path);
  if (typeof status !== "string" || status.trim() !== "") {
    return { safe: false, reason: "working tree has uncommitted or untracked changes" };
  }

  // Check unlanded ahead count
  const ahead = aheadCountFn(currentBranch, baseRef);
  if (!Number.isFinite(ahead) || ahead > 0) {
    return { safe: false, reason: `branch has ${ahead} unlanded commit(s) ahead of ${baseRef}` };
  }

  // Check confidence / corroboration
  const confidence = confidenceFn(wt, baseRef);
  if (typeof confidence === "string" && confidence.includes("NOT fully corroborated")) {
    return { safe: false, reason: `removal blocked: ${confidence}` };
  }

  return { safe: true, confidence };
}

/**
 * Parse CLI arguments for batch size and flags.
 *
 * `--merged` is deliberately list-only. `--remove` is a separate opt-in that is meaningless
 * on its own: allowing a bare `--remove` would make it ambiguous whether the caller meant the
 * default `git worktree prune` path or a bulk directory deletion.
 */
export function parseArgs(argv) {
  let batchSize = 10;
  let dryRun = false;
  let selfTest = false;
  let merged = false;
  let remove = false;
  let squashed = false;
  let help = false;
  let baseRef = "origin/main";
  let drive = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--self-test") {
      selfTest = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--merged") {
      merged = true;
    } else if (arg === "--remove") {
      remove = true;
    } else if (arg === "--squashed") {
      squashed = true;
    } else if (arg === "--base") {
      const val = argv[i + 1];
      if (!val || val.startsWith("-")) {
        throw new Error("Missing value for --base.");
      }
      baseRef = val;
      i += 1;
    } else if (arg.startsWith("--base=")) {
      const val = arg.slice("--base=".length);
      if (!val) throw new Error("Missing value for --base.");
      baseRef = val;
    } else if (arg === "--drive") {
      const val = argv[i + 1];
      if (!val || val.startsWith("-")) {
        throw new Error("Missing value for --drive.");
      }
      drive = val;
      i += 1;
    } else if (arg.startsWith("--drive=")) {
      const val = arg.slice("--drive=".length);
      if (!val) throw new Error("Missing value for --drive.");
      drive = val;
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
    } else {
      throw new Error(`Unknown argument: ${arg}. Run with --help for usage.`);
    }
  }

  if (remove && !merged) {
    throw new Error("--remove is only valid together with --merged. Run `--merged` alone to list candidates first.");
  }
  if (squashed && !merged) {
    throw new Error("--squashed is only valid together with --merged.");
  }
  return { batchSize, dryRun, selfTest, merged, remove, squashed, help, baseRef, drive };
}

export function printHelp() {
  console.log(`clean-worktree — safely identify and prune disconnected, orphaned, and landed worktrees.

Usage:
  node scripts/clean-worktree.mjs [options]
  npm run clean:worktree [-- options]

Options:
  --help, -h          Show this help message.
  --merged            List clean worktrees whose branch has landed in origin/main (ancestor test).
  --squashed          Pair with --merged to include branches squash-merged into origin/main (patch-id test).
  --remove            Execute removal of eligible worktrees (requires --merged; defaults to list-only).
  --dry-run           Preview actions without deleting anything (wins over --remove).
  --base <ref>        Base ref to compare against (default: origin/main).
  --drive <letter>    Filter candidates to a specific drive (e.g., D: or D for Dev Drive).
  --batch-size <N>    Maximum number of worktrees to prune in one run (default: 10).
  --self-test         Run offline self-test assertions.

Safety Rules:
  - Main/root worktree and the current worktree are never pruned.
  - Worktrees with uncommitted/untracked changes, detached HEAD, or locks are skipped.
  - Re-verifies every candidate immediately before deletion to prevent racing active sessions (#6GW95D).
  - Candidates marked 'NOT fully corroborated' are skipped during removal unless explicitly reviewed.
  - Never passes --force to git worktree remove.
`);
}

/**
 * Real-git adapters for `identifyMergedWorktrees`. They live outside the pure function so
 * `selfTest()` never spawns git, and each one fails CLOSED using argument arrays.
 */
function gitBranchIsAncestor(branch, baseRef) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", branch, baseRef], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const squashMergeVerdictCache = new Map();

function gitBranchSquashMerged(branch, baseRef) {
  const key = `${baseRef}\u0000${branch}`;
  if (squashMergeVerdictCache.has(key)) return squashMergeVerdictCache.get(key);
  const verdict = computeBranchSquashMerged(branch, baseRef);
  squashMergeVerdictCache.set(key, verdict);
  return verdict;
}

function revParseOrNull(spec) {
  try {
    return execFileSync("git", ["rev-parse", spec], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function describeMergeConfidence(wt, baseRef) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", wt.branch, baseRef], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    return `proven — every commit on this branch is reachable from ${baseRef}`;
  } catch {
    // Not an ancestor, so this candidate can only have come from the patch-id test below.
  }

  try {
    const base = execFileSync("git", ["merge-base", baseRef, wt.branch], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const files = execFileSync("git", ["diff", "--name-only", base, wt.branch], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 8 * 1024 * 1024,
    })
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    const differing = files.filter((f) => revParseOrNull(`${wt.branch}:${f}`) !== revParseOrNull(`${baseRef}:${f}`));

    if (files.length === 0) {
      return "inferred from patch-id; branch changed no files vs its merge base";
    }
    if (differing.length === 0) {
      return `inferred from patch-id, corroborated — all ${files.length} changed file(s) are byte-identical to ${baseRef}`;
    }
    return (
      `inferred from patch-id, NOT fully corroborated — ${differing.length} of ${files.length} changed file(s) ` +
      `still differ from ${baseRef} (${differing.slice(0, 3).join(", ")}${differing.length > 3 ? ", …" : ""}); ` +
      `usually just churn on the base since it landed, but review before removing`
    );
  } catch {
    return "inferred from patch-id; corroboration check failed — review before removing";
  }
}

function computeBranchSquashMerged(branch, baseRef) {
  if (gitBranchIsAncestor(branch, baseRef)) return true;
  try {
    const run = (...args) =>
      execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const mergeBase = run("merge-base", baseRef, branch);
    const tree = run("rev-parse", `${branch}^{tree}`);
    if (!mergeBase || !tree) return false;
    const synthetic = run("commit-tree", tree, "-p", mergeBase, "-m", "squash-merge-probe");
    if (!synthetic) return false;
    const verdict = run("cherry", baseRef, synthetic, mergeBase);
    return verdict.startsWith("-");
  } catch {
    return false;
  }
}

function gitWorktreeStatus(worktreePath) {
  try {
    return execFileSync("git", ["-C", worktreePath, "status", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    return `?? status unavailable (${err.message})`;
  }
}

function gitWorktreeBranch(worktreePath) {
  try {
    return execFileSync("git", ["-C", worktreePath, "rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function gitAheadCount(branch, baseRef) {
  try {
    const out = execFileSync("git", ["rev-list", "--count", `${baseRef}..${branch}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsedCount = parseInt(out.trim(), 10);
    return Number.isNaN(parsedCount) ? Number.NaN : parsedCount;
  } catch {
    return Number.NaN;
  }
}

function gitAheadUnlandedCount(branch, baseRef) {
  if (gitBranchSquashMerged(branch, baseRef)) return 0;
  return gitAheadCount(branch, baseRef);
}

function gitCurrentWorktreePath() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.cwd();
  }
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
  const helpArgs = parseArgs(["--help"]);
  if (!helpArgs.help) {
    throw new Error("selfTest failed: parseArgs failed for --help");
  }
  const args1 = parseArgs(["--batch-size", "5", "--dry-run"]);
  if (args1.batchSize !== 5 || !args1.dryRun) {
    throw new Error("selfTest failed: parseArgs failed for --batch-size 5");
  }
  const args2 = parseArgs(["--batch-size=20", "--base=upstream/main", "--drive=D"]);
  if (args2.batchSize !== 20 || args2.baseRef !== "upstream/main" || args2.drive !== "D") {
    throw new Error("selfTest failed: parseArgs failed for --batch-size=20, --base=upstream/main, --drive=D");
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

  const args3 = parseArgs(["--merged"]);
  if (!args3.merged || args3.remove) {
    throw new Error("selfTest failed: --merged must default to list-only (remove=false)");
  }
  const args4 = parseArgs(["--merged", "--remove"]);
  if (!args4.merged || !args4.remove) {
    throw new Error("selfTest failed: --merged --remove did not set both flags");
  }
  let removeThrew = false;
  try {
    parseArgs(["--remove"]);
  } catch {
    removeThrew = true;
  }
  if (!removeThrew) {
    throw new Error("selfTest failed: parseArgs accepted a bare --remove without --merged");
  }
  const args5 = parseArgs(["--merged", "--squashed"]);
  if (!args5.squashed || args5.remove) {
    throw new Error("selfTest failed: --merged --squashed must stay list-only");
  }
  let squashThrew = false;
  try {
    parseArgs(["--squashed"]);
  } catch {
    squashThrew = true;
  }
  if (!squashThrew) {
    throw new Error("selfTest failed: parseArgs accepted a bare --squashed without --merged");
  }

  // Test formatBytes
  if (formatBytes(0) !== "0 B" || formatBytes(1024) !== "1.00 KB" || formatBytes(1024 * 1024 * 5.5) !== "5.50 MB") {
    throw new Error(`selfTest failed: formatBytes returned unexpected results: ${formatBytes(1024)}`);
  }

  // Test disk usage mock
  const mockReaddir = (dir) => {
    if (dir === "/mock") {
      return [
        { name: "file1.txt", isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        { name: "sub", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
      ];
    }
    if (dir === path.join("/mock", "sub")) {
      return [{ name: "file2.txt", isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }];
    }
    return [];
  };
  const mockStat = (p) => ({ size: p.includes("file1") ? 1000 : 2000 });
  const usage = getDirectoryDiskUsage("/mock", {
    readdirFn: mockReaddir,
    statFn: mockStat,
    existsFn: () => true,
  });
  if (usage.bytes !== 3000 || usage.fileCount !== 2) {
    throw new Error(`selfTest failed: getDirectoryDiskUsage got bytes=${usage.bytes}, files=${usage.fileCount}`);
  }

  // Merged-worktree identification
  const mergedPorcelain = [
    "worktree /path/to/main",
    "HEAD 1111111111111111111111111111111111111111",
    "branch refs/heads/main",
    "",
    "worktree /path/to/merged-clean",
    "HEAD 2222222222222222222222222222222222222222",
    "branch refs/heads/merged-clean",
    "",
    "worktree /path/to/merged-dirty",
    "HEAD 3333333333333333333333333333333333333333",
    "branch refs/heads/merged-dirty",
    "",
    "worktree /path/to/merged-ahead",
    "HEAD 4444444444444444444444444444444444444444",
    "branch refs/heads/merged-ahead",
    "",
    "worktree /path/to/detached",
    "HEAD 5555555555555555555555555555555555555555",
    "detached",
    "",
    "worktree /path/to/merged-locked",
    "HEAD 6666666666666666666666666666666666666666",
    "branch refs/heads/merged-locked",
    "locked in-flight release rehearsal",
    "",
    "worktree /path/to/unmerged",
    "HEAD 7777777777777777777777777777777777777777",
    "branch refs/heads/unmerged",
    "",
    "worktree /path/to/current",
    "HEAD 8888888888888888888888888888888888888888",
    "branch refs/heads/current",
    "",
  ].join("\n");

  const mergedParsed = parseWorktreePorcelain(mergedPorcelain);
  if (mergedParsed.length !== 8) {
    throw new Error(`selfTest failed: expected 8 parsed merged-mode worktrees, got ${mergedParsed.length}`);
  }

  const mockIsMerged = (branch) => branch !== "refs/heads/unmerged";
  const mockStatus = (p) => (p === "/path/to/merged-dirty" ? " M src/lib/rag/rag.ts\n?? scratch.txt\n" : "");
  const mockAhead = (branch) => (branch === "refs/heads/merged-ahead" ? 2 : 0);

  const candidates = identifyMergedWorktrees(mergedParsed, {
    isMergedFn: mockIsMerged,
    statusFn: mockStatus,
    aheadCountFn: mockAhead,
    existsFn: () => true,
    mainPath: "/path/to/main",
    currentPath: "/path/to/current",
  });

  if (candidates.length !== 1) {
    const paths = candidates.map((c) => c.path).join(", ");
    throw new Error(`selfTest failed: expected exactly 1 merged candidate, got ${candidates.length} [${paths}]`);
  }
  if (candidates[0].path !== "/path/to/merged-clean") {
    throw new Error(`selfTest failed: expected /path/to/merged-clean, got ${candidates[0].path}`);
  }

  // Pre-removal safety verification assertions (#6GW95D)
  const safeResult = verifyWorktreeSafetyBeforeRemove(candidates[0], {
    mainPath: "/path/to/main",
    currentPath: "/path/to/current",
    existsFn: () => true,
    statusFn: () => "",
    branchFn: () => "merged-clean",
    aheadCountFn: () => 0,
    confidenceFn: () => "proven — every commit on this branch is reachable from origin/main",
  });
  if (!safeResult.safe) {
    throw new Error(`selfTest failed: clean candidate marked unsafe: ${safeResult.reason}`);
  }

  // Switched branch detection
  const switchedBranch = verifyWorktreeSafetyBeforeRemove(candidates[0], {
    mainPath: "/path/to/main",
    currentPath: "/path/to/current",
    existsFn: () => true,
    statusFn: () => "",
    branchFn: () => "feature-switched",
    aheadCountFn: () => 0,
  });
  if (switchedBranch.safe) {
    throw new Error("selfTest failed: switched branch was not caught by pre-removal safety check");
  }

  // Dirty working tree detection
  const dirtySafety = verifyWorktreeSafetyBeforeRemove(candidates[0], {
    mainPath: "/path/to/main",
    currentPath: "/path/to/current",
    existsFn: () => true,
    statusFn: () => " M file.ts\n",
    branchFn: () => "merged-clean",
    aheadCountFn: () => 0,
  });
  if (dirtySafety.safe) {
    throw new Error("selfTest failed: dirty tree was not caught by pre-removal safety check");
  }

  // Uncorroborated candidate blocked
  const uncorroborated = verifyWorktreeSafetyBeforeRemove(candidates[0], {
    mainPath: "/path/to/main",
    currentPath: "/path/to/current",
    existsFn: () => true,
    statusFn: () => "",
    branchFn: () => "merged-clean",
    aheadCountFn: () => 0,
    confidenceFn: () => "inferred from patch-id, NOT fully corroborated — 2 of 21 files differ",
  });
  if (uncorroborated.safe) {
    throw new Error("selfTest failed: uncorroborated candidate was not blocked by pre-removal safety check");
  }

  console.log("[clean-worktree] Self-test passed successfully.");
}

export function runWorktreeCleanup(options = {}) {
  const { batchSize = 10, dryRun = false } = options;

  console.log("[clean-worktree] Cleaning ephemeral debug files and logs...");
  try {
    execFileSync("git", ["clean", "-fdx", "tmp-*.py", "test-output.txt", "*.log"], {
      stdio: "inherit",
    });
    console.log("[clean-worktree] Worktree sanitized.");
  } catch (err) {
    console.warn("[clean-worktree] Notice during git clean:", err.message);
  }

  console.log("[clean-worktree] Inspecting registered worktrees...");
  let porcelainOutput = "";
  try {
    porcelainOutput = execFileSync("git", ["worktree", "list", "--porcelain"], {
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
    execFileSync("git", ["worktree", "prune", "--expire", "now"], { stdio: "inherit" });
    console.log("[clean-worktree] Worktree prune complete.");
  } catch (err) {
    console.error("[clean-worktree] Failed during git worktree prune:", err.message);
    throw err;
  }
}

/**
 * `--merged` mode: report (and only on explicit `--remove`, delete) worktrees whose branch
 * already landed in origin/main.
 */
export function runMergedWorktreeReport(options = {}) {
  const {
    batchSize = 10,
    remove = false,
    squashed = false,
    dryRun = false,
    baseRef = "origin/main",
    drive = null,
  } = options;

  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", baseRef], { stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    console.error(`[clean-worktree] Base ref ${baseRef} not found. Fetch it first; refusing to guess merge state.`);
    throw new Error(`Base ref ${baseRef} is unavailable`);
  }

  let porcelainOutput = "";
  try {
    porcelainOutput = execFileSync("git", ["worktree", "list", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    console.warn("[clean-worktree] Could not list worktrees:", err.message);
    return;
  }

  const worktrees = parseWorktreePorcelain(porcelainOutput);
  const currentPath = gitCurrentWorktreePath();
  const mainPath = worktrees[0]?.path ?? null;
  const mode = squashed ? "ancestor-or-squash (--squashed)" : "ancestor-only";
  const driveFilterNote = drive ? ` (filtered to drive ${drive.toUpperCase()})` : "";
  console.log(
    `[clean-worktree] ${worktrees.length} registered worktree(s); base ref ${baseRef}; merge test: ${mode}${driveFilterNote}.`,
  );

  const candidates = identifyMergedWorktrees(worktrees, {
    isMergedFn: squashed ? gitBranchSquashMerged : gitBranchIsAncestor,
    statusFn: gitWorktreeStatus,
    aheadCountFn: squashed ? gitAheadUnlandedCount : gitAheadCount,
    rawAheadCountFn: gitAheadCount,
    existsFn: existsSync,
    diskUsageFn: (p) => getDirectoryDiskUsage(p),
    mainPath,
    currentPath,
    baseRef,
    drive,
  });

  if (candidates.length === 0) {
    console.log("[clean-worktree] No merged, clean, unlocked worktrees found. Nothing to report.");
    if (!squashed) {
      console.log("[clean-worktree] Note: squash-merged branches are invisible to the ancestor test. Try --squashed.");
    }
    return;
  }

  let totalReclaimableBytes = 0;
  let totalFiles = 0;
  const driveBreakdown = new Map();

  for (const wt of candidates) {
    const bytes = wt.diskUsage?.bytes ?? 0;
    const files = wt.diskUsage?.fileCount ?? 0;
    totalReclaimableBytes += bytes;
    totalFiles += files;

    const driveMatch = /^([a-zA-Z]):/.exec(path.resolve(wt.path));
    const driveKey = driveMatch ? `${driveMatch[1].toUpperCase()}:` : "Other";
    const currentDriveStats = driveBreakdown.get(driveKey) || { bytes: 0, count: 0 };
    driveBreakdown.set(driveKey, {
      bytes: currentDriveStats.bytes + bytes,
      count: currentDriveStats.count + 1,
    });
  }

  console.log(
    `\n[clean-worktree] ${candidates.length} merged worktree(s) eligible for removal (reclaimable: ${formatBytes(totalReclaimableBytes)}, ${totalFiles.toLocaleString()} files):`,
  );
  for (const wt of candidates) {
    const sizeStr = wt.diskUsage
      ? ` [${formatBytes(wt.diskUsage.bytes)}, ${wt.diskUsage.fileCount.toLocaleString()} files]`
      : "";
    console.log(`  - ${wt.path}${sizeStr}`);
    console.log(`      branch: ${wt.branch}`);
    console.log(`      reason: ${wt.reason}`);
    console.log(`      confidence: ${describeMergeConfidence(wt, baseRef)}`);
  }

  if (driveBreakdown.size > 1 || driveBreakdown.has("D:")) {
    console.log("\n[clean-worktree] Drive usage breakdown:");
    for (const [drv, stats] of driveBreakdown) {
      console.log(`  - ${drv} ${formatBytes(stats.bytes)} across ${stats.count} worktree(s)`);
    }
  }

  if (!remove || dryRun) {
    console.log(
      `\n[clean-worktree] Listed ${candidates.length} candidate(s) (${formatBytes(totalReclaimableBytes)}). Nothing was removed.`,
    );
    if (dryRun) {
      console.log(
        `[clean-worktree] [dry-run] Would prune up to ${Math.min(batchSize, candidates.length)} worktree(s) in next batch.`,
      );
    } else {
      console.log(
        `[clean-worktree] Re-run with \`--merged${squashed ? " --squashed" : ""} --remove\` to delete these.`,
      );
    }
    if (!squashed) {
      console.log("[clean-worktree] Note: squash-merged branches are invisible to the ancestor test. Try --squashed.");
    }
    return;
  }

  const batch = candidates.slice(0, batchSize);
  console.log(
    `\n[clean-worktree] Removing ${batch.length} of ${candidates.length} candidate(s) (batch size ${batchSize})...`,
  );

  let removed = 0;
  let skipped = 0;
  let freedBytes = 0;

  for (const wt of batch) {
    const safety = verifyWorktreeSafetyBeforeRemove(wt, {
      mainPath,
      currentPath,
      existsFn: existsSync,
      statusFn: gitWorktreeStatus,
      branchFn: gitWorktreeBranch,
      aheadCountFn: squashed ? gitAheadUnlandedCount : gitAheadCount,
      confidenceFn: describeMergeConfidence,
      baseRef,
    });

    if (!safety.safe) {
      skipped += 1;
      console.warn(`  - SKIPPED (safety re-verification failed): ${wt.path} — ${safety.reason}`);
      continue;
    }

    const sizeBefore = wt.diskUsage?.bytes ?? getDirectoryDiskUsage(wt.path).bytes;

    try {
      execFileSync("git", ["worktree", "remove", wt.path], { stdio: ["ignore", "pipe", "pipe"] });
      removed += 1;
      freedBytes += sizeBefore;
      console.log(`  - removed: ${wt.path} (freed ${formatBytes(sizeBefore)})`);
    } catch (err) {
      skipped += 1;
      console.warn(`  - SKIPPED (git refused): ${wt.path} — ${err.message.trim()}`);
    }
  }

  console.log(
    `[clean-worktree] Removed ${removed} worktrees (freed ${formatBytes(freedBytes)}), skipped ${skipped}, remaining candidates ${candidates.length - batch.length}.`,
  );
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

  if (parsed.help) {
    printHelp();
    return;
  }

  if (parsed.selfTest) {
    selfTest();
    return;
  }

  if (parsed.merged) {
    try {
      runMergedWorktreeReport(parsed);
    } catch (err) {
      console.error("[clean-worktree] Merged-worktree report failed:", err.message);
      process.exit(1);
    }
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
