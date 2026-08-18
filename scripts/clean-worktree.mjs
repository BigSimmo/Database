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
export function identifyMergedWorktrees(
  worktrees,
  {
    isMergedFn = () => false,
    statusFn = () => "",
    aheadCountFn = () => 0,
    // Raw `baseRef..branch` count, used for REPORTING only — never as a gate. See the note at
    // the ahead check below for why the two counters have to be reported separately.
    rawAheadCountFn = null,
    existsFn = existsSync,
    mainPath = null,
    currentPath = null,
    baseRef = "origin/main",
  } = {},
) {
  if (!Array.isArray(worktrees) || worktrees.length === 0) return [];
  const main = mainPath ? path.resolve(mainPath) : path.resolve(worktrees[0].path);
  const current = currentPath ? path.resolve(currentPath) : null;

  const merged = [];
  for (let i = 0; i < worktrees.length; i += 1) {
    const wt = worktrees[i];
    const resolvedPath = path.resolve(wt.path);

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
    // forever, so it stays genuinely ahead of the base — 3, 4, even 19 commits — while the
    // unlanded count is 0. Printing a bare "0 commits ahead" therefore stated something the
    // reader could disprove in one `git rev-list` and made the whole line look untrustworthy.
    // Observed 2026-08-18 reviewing a real fleet: every squash candidate read "0 commits
    // ahead" while being ahead by 3 to 19.
    const rawAhead = (rawAheadCountFn ?? aheadCountFn)(wt.branch, baseRef);
    const aheadNote = Number.isFinite(rawAhead) && rawAhead !== ahead ? `${rawAhead} ahead of ${baseRef}, ` : "";

    merged.push({
      ...wt,
      mergedInto: baseRef,
      aheadUnlanded: ahead,
      aheadRaw: Number.isFinite(rawAhead) ? rawAhead : null,
      reason: `branch merged into ${baseRef}; clean tree; ${aheadNote}0 unlanded commits${wt.head ? ` (tip ${wt.head.slice(0, 9)})` : ""}`,
    });
  }
  return merged;
}

/**
 * Parse CLI arguments for batch size and flags.
 *
 * `--merged` is deliberately list-only. `--remove` is a separate opt-in that is meaningless
 * on its own: allowing a bare `--remove` would make it ambiguous whether the caller meant the
 * default `git worktree prune` path or a bulk directory deletion, and that ambiguity is not
 * something a script holding 36 GB of other people's branches should resolve by guessing.
 */
export function parseArgs(argv) {
  let batchSize = 10;
  let dryRun = false;
  let selfTest = false;
  let merged = false;
  let remove = false;
  let squashed = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--self-test") {
      selfTest = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--merged") {
      merged = true;
    } else if (arg === "--remove") {
      remove = true;
    } else if (arg === "--squashed") {
      squashed = true;
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
  if (remove && !merged) {
    throw new Error("--remove is only valid together with --merged. Run `--merged` alone to list candidates first.");
  }
  if (squashed && !merged) {
    throw new Error("--squashed is only valid together with --merged.");
  }
  return { batchSize, dryRun, selfTest, merged, remove, squashed };
}

/**
 * Real-git adapters for `identifyMergedWorktrees`. They live outside the pure function so
 * `selfTest()` never spawns git, and each one fails CLOSED: an error while asking git a
 * question is treated as "this worktree is not a candidate", never as "it is safe to delete".
 */
function gitBranchIsAncestor(branch, baseRef) {
  try {
    // Exit 0 = ancestor, exit 1 = not, anything else = error. All non-zero throws here.
    execSync(`git merge-base --is-ancestor "${branch}" "${baseRef}"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Opt-in (`--merged --squashed`) content-equality test, for branches this repo SQUASH-merged.
 *
 * WHY this is needed at all. `gitBranchIsAncestor` above is the strictly correct test and it
 * is the default, but it answers "is this exact commit reachable from origin/main" — and a
 * squash merge never leaves the branch tip reachable. This repo squash-merges as its normal
 * path (AGENTS.md: "this repo's normal squash-merge folds every commit into one on `main`"),
 * so the ancestor test alone barely fires. Measured here 2026-08-18 across the 49 registered
 * worktrees: ancestor-only nominated 1; of the 40 it rejected, 8 were in fact fully landed via
 * squash. That is the difference between a cleanup that reclaims nothing and one that does.
 *
 * HOW it decides. Replay the branch's ENTIRE diff from its merge-base as one synthetic commit,
 * then ask `git cherry` whether origin/main already contains a commit with that patch-id
 * ("-" = already upstream). Comparing the whole-branch patch is what makes it match a single
 * squashed commit, which per-commit `git cherry` cannot do.
 *
 * WHY it is still conservative. Patch-id equality is exact. If main moved on and altered those
 * same lines afterwards, the ids stop matching and the branch is reported NOT merged — a false
 * negative, which costs disk, never work. `commit-tree` writes one dangling object that
 * ordinary `git gc` reclaims; it mutates no ref and touches no remote.
 */
const squashMergeVerdictCache = new Map();

function gitBranchSquashMerged(branch, baseRef) {
  // Memoised because the ahead-count guard below asks the same question a second time, and
  // each answer costs a `git cherry` patch-id scan. On this fleet that halves the wall clock.
  //
  // The separator below is NUL because a git ref may contain almost any byte except NUL, so it is
  // the one delimiter that cannot collide with a ref name. Always write it as the six-character
  // JS escape, never as a literal NUL byte in the source. A raw NUL makes every text tool treat
  // this file as binary: `grep` suppresses matches and prints only "Binary file matches", and
  // `file` reports "binary data". Git still diffs it as text, so the damage never shows up in
  // review — it shows up in verification, where a `git diff … | grep <pattern>` check returns
  // empty whether or not the pattern is present. That is a check that cannot fail, and it
  // produced a false "this function is untouched" result during this file's own review on
  // 2026-08-18.
  const key = `${baseRef}\u0000${branch}`;
  if (squashMergeVerdictCache.has(key)) return squashMergeVerdictCache.get(key);
  const verdict = computeBranchSquashMerged(branch, baseRef);
  squashMergeVerdictCache.set(key, verdict);
  return verdict;
}

function revParseOrNull(spec) {
  try {
    return execSync(`git rev-parse "${spec}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/**
 * Describe HOW strong the "already landed" evidence is for one candidate.
 *
 * The two merge tests are not equally trustworthy and the listing must not present them as
 * though they were. `merge-base --is-ancestor` is proof: every commit is reachable from the base
 * ref, full stop. The patch-id test behind `--squashed` is an *inference* — it says the branch's
 * combined diff matched something that landed, which is the right call for a squash-merging repo
 * but is not the same claim.
 *
 * Why it matters concretely: reviewing this fleet on 2026-08-18, one squash-inferred candidate
 * (`claude/rag-d4-reconcile-inbox`, 21 changed files) still had 2 files differing from
 * origin/main. Both were high-churn append-only documents — `docs/outstanding-issues.md` and a
 * handover doc — so the difference is almost certainly main moving on after the branch landed,
 * not lost work. "Almost certainly" is exactly the distinction this line exists to surface: the
 * operator, not the script, decides. That is also why `--remove` stays a separate opt-in.
 *
 * Cost is bounded — this runs over the candidate list, never the whole fleet.
 */
function describeMergeConfidence(wt, baseRef) {
  try {
    execSync(`git merge-base --is-ancestor "${wt.branch}" "${baseRef}"`, {
      stdio: ["ignore", "ignore", "ignore"],
    });
    return `proven — every commit on this branch is reachable from ${baseRef}`;
  } catch {
    // Not an ancestor, so this candidate can only have come from the patch-id test below.
  }

  try {
    const base = execSync(`git merge-base "${baseRef}" "${wt.branch}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const files = execSync(`git diff --name-only ${base} "${wt.branch}"`, {
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
    const run = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const mergeBase = run(`git merge-base "${baseRef}" "${branch}"`);
    const tree = run(`git rev-parse "${branch}^{tree}"`);
    if (!mergeBase || !tree) return false;
    const synthetic = run(`git commit-tree "${tree}" -p "${mergeBase}" -m squash-merge-probe`);
    if (!synthetic) return false;
    // The third argument bounds the scan to `mergeBase..baseRef`. Without it `git cherry`
    // patch-ids every commit in origin/main's whole history for every branch examined, which
    // on a 48-worktree fleet is thousands of redundant diffs; a squash of THIS branch can only
    // exist after its own merge-base, so the bound is free correctness-wise.
    const verdict = run(`git cherry "${baseRef}" "${synthetic}" "${mergeBase}"`);
    // "- <sha>" means the patch is already upstream; "+ <sha>" means it is not.
    return verdict.startsWith("-");
  } catch {
    return false;
  }
}

function gitWorktreeStatus(worktreePath) {
  try {
    return execSync(`git -C "${worktreePath}" status --porcelain`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    // An unreadable status is not a clean status; return a non-empty sentinel so the caller
    // treats the worktree as dirty and keeps it.
    return `?? status unavailable (${err.message})`;
  }
}

function gitAheadCount(branch, baseRef) {
  try {
    const out = execSync(`git rev-list --count "${baseRef}..${branch}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsedCount = parseInt(out.trim(), 10);
    return Number.isNaN(parsedCount) ? Number.NaN : parsedCount;
  } catch {
    return Number.NaN;
  }
}

/**
 * Ahead-count companion used only in `--squashed` mode.
 *
 * WHY the plain `gitAheadCount` cannot be reused here. It asks "how many commits are in
 * origin/main..branch", a commit-graph proxy for "how much work is unlanded". Squash merging
 * breaks that proxy: a fully-landed branch keeps every one of its original commits, so it
 * reports ahead > 0 forever. Pairing it with the squash test cancels the squash test out —
 * measured 2026-08-18 on the 48-worktree fleet, that combination nominated 1 worktree while 8
 * more were provably landed.
 *
 * WHY it is not a per-commit patch-id count either. That was the first attempt and it is a
 * subtler version of the same bug: a squash commit's patch-id matches the branch's COMBINED
 * diff, never the individual commits it folded, so `git cherry` marks every commit of a
 * multi-commit landed branch "+". It rescued only the accidental single-commit cases — 4 of
 * the 8 — and silently vetoed the rest.
 *
 * WHAT it does instead, and why redundancy is the honest answer. Whole-branch patch-id
 * equality (`gitBranchSquashMerged`) already proves the branch's entire diff is upstream,
 * which is strictly stronger than any commit count. So in this mode the guard is subsumed by
 * the merge test and returns 0; a branch that is NOT content-equal falls back to the real
 * graph count. Keeping a check that can only produce false negatives would be worse than
 * admitting it is redundant here. The cached verdict makes the extra call free.
 *
 * Blast radius either way: `git worktree remove` deletes the working directory, not the
 * branch. The ref and its commits survive in the repo, so a wrong call costs a re-checkout.
 */
function gitAheadUnlandedCount(branch, baseRef) {
  if (gitBranchSquashMerged(branch, baseRef)) return 0;
  return gitAheadCount(branch, baseRef);
}

function gitCurrentWorktreePath() {
  try {
    return execSync("git rev-parse --show-toplevel", {
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

  // Merged-worktree identification. Every fixture below is a worktree that a naive
  // "is it merged?" check would happily delete; only `merged-clean` may actually qualify.
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

  // Everything is merged except refs/heads/unmerged; the detached entry has no branch at all.
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
  if (!candidates[0].reason || !candidates[0].reason.includes("origin/main")) {
    throw new Error("selfTest failed: merged candidate is missing a human-readable merge reason");
  }
  if (candidates[0].mergedInto !== "origin/main") {
    throw new Error("selfTest failed: merged candidate did not record its base ref");
  }

  const candidatePaths = new Set(candidates.map((c) => c.path));
  for (const mustSkip of [
    ["/path/to/main", "main worktree"],
    ["/path/to/merged-dirty", "dirty working tree"],
    ["/path/to/merged-ahead", "commits ahead of origin/main"],
    ["/path/to/detached", "detached HEAD"],
    ["/path/to/merged-locked", "locked worktree"],
    ["/path/to/unmerged", "branch not merged"],
    ["/path/to/current", "current worktree"],
  ]) {
    if (candidatePaths.has(mustSkip[0])) {
      throw new Error(`selfTest failed: ${mustSkip[1]} (${mustSkip[0]}) must never be a merged candidate`);
    }
  }

  // A missing directory belongs to the orphan path, not the merged path.
  const missingDirCandidates = identifyMergedWorktrees(mergedParsed, {
    isMergedFn: mockIsMerged,
    statusFn: mockStatus,
    aheadCountFn: mockAhead,
    existsFn: () => false,
    mainPath: "/path/to/main",
    currentPath: "/path/to/current",
  });
  if (missingDirCandidates.length !== 0) {
    throw new Error("selfTest failed: worktrees missing from disk must not be merged candidates");
  }

  // Fail-closed contract: git errors surface as NaN/non-empty status and must keep the worktree.
  const failClosed = identifyMergedWorktrees(mergedParsed, {
    isMergedFn: mockIsMerged,
    statusFn: () => "?? status unavailable (git exploded)",
    aheadCountFn: () => Number.NaN,
    existsFn: () => true,
    mainPath: "/path/to/main",
    currentPath: "/path/to/current",
  });
  if (failClosed.length !== 0) {
    throw new Error("selfTest failed: unreadable git state must fail closed to zero candidates");
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

/**
 * `--merged` mode: report (and only on explicit `--remove`, delete) worktrees whose branch
 * already landed in origin/main.
 *
 * This is strictly additive and opt-in. `runWorktreeCleanup()` above is what
 * `npm run clean:worktree` — and therefore `verify:preflight` — invokes, and its behaviour is
 * deliberately untouched: nothing on the preflight path may start deleting directories.
 *
 * Listing is the default and removal is the exception, because the population this walks is
 * 41 populated worktrees on the maintainer's machine (~36 GB, ~2.1M files, one measured at
 * 51,735 files / 0.89 GB) and a wrong bulk delete there is not recoverable from the deleted
 * worktree's own reflog.
 */
export function runMergedWorktreeReport(options = {}) {
  const { batchSize = 10, remove = false, squashed = false, baseRef = "origin/main" } = options;

  // Without the base ref every ancestor test would answer "not merged" and the mode would
  // silently report nothing. Say so instead of returning a misleading empty list.
  try {
    execSync(`git rev-parse --verify --quiet "${baseRef}"`, { stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    console.error(`[clean-worktree] Base ref ${baseRef} not found. Fetch it first; refusing to guess merge state.`);
    throw new Error(`Base ref ${baseRef} is unavailable`);
  }

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
  const currentPath = gitCurrentWorktreePath();
  const mode = squashed ? "ancestor-or-squash (--squashed)" : "ancestor-only";
  console.log(`[clean-worktree] ${worktrees.length} registered worktree(s); base ref ${baseRef}; merge test: ${mode}.`);

  const candidates = identifyMergedWorktrees(worktrees, {
    isMergedFn: squashed ? gitBranchSquashMerged : gitBranchIsAncestor,
    statusFn: gitWorktreeStatus,
    aheadCountFn: squashed ? gitAheadUnlandedCount : gitAheadCount,
    rawAheadCountFn: gitAheadCount,
    existsFn: existsSync,
    currentPath,
    baseRef,
  });

  if (candidates.length === 0) {
    console.log("[clean-worktree] No merged, clean, unlocked worktrees found. Nothing to report.");
    if (!squashed) {
      console.log("[clean-worktree] Note: squash-merged branches are invisible to the ancestor test. Try --squashed.");
    }
    return;
  }

  console.log(`[clean-worktree] ${candidates.length} merged worktree(s) eligible for removal:`);
  for (const wt of candidates) {
    console.log(`  - ${wt.path}`);
    console.log(`      branch: ${wt.branch}`);
    console.log(`      reason: ${wt.reason}`);
    console.log(`      confidence: ${describeMergeConfidence(wt, baseRef)}`);
  }

  if (!remove) {
    console.log(`[clean-worktree] Listed ${candidates.length} candidate(s). Nothing was removed.`);
    console.log(`[clean-worktree] Re-run with \`--merged${squashed ? " --squashed" : ""} --remove\` to delete these.`);
    if (!squashed) {
      console.log("[clean-worktree] Note: squash-merged branches are invisible to the ancestor test. Try --squashed.");
    }
    return;
  }

  const batch = candidates.slice(0, batchSize);
  console.log(
    `[clean-worktree] Removing ${batch.length} of ${candidates.length} candidate(s) (batch size ${batchSize})...`,
  );

  let removed = 0;
  let skipped = 0;
  for (const wt of batch) {
    try {
      // Never `--force`. If git refuses — a submodule, a lock we failed to see, or state that
      // appeared after the scan — that refusal is information, not an obstacle to override.
      execSync(`git worktree remove "${wt.path}"`, { stdio: ["ignore", "pipe", "pipe"] });
      removed += 1;
      console.log(`  - removed: ${wt.path}`);
    } catch (err) {
      skipped += 1;
      console.warn(`  - SKIPPED (git refused): ${wt.path} — ${err.message.trim()}`);
    }
  }

  console.log(
    `[clean-worktree] Removed ${removed}, skipped ${skipped}, remaining candidates ${candidates.length - batch.length}.`,
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

  if (parsed.selfTest) {
    selfTest();
    return;
  }

  if (parsed.merged) {
    try {
      // --dry-run is an explicit alias for list-only, and it wins over --remove so that a
      // habitual `--dry-run` can never be defeated by a stray --remove on the same line.
      runMergedWorktreeReport({ ...parsed, remove: parsed.remove && !parsed.dryRun });
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
