#!/usr/bin/env node
/**
 * sweep-branch-ledger — build the branch inventory that docs/branch-cleanup-guide.md
 * mandates, and flag deletion candidates. REPORT ONLY: it never deletes, renames, or
 * pushes anything, and it edits no files.
 *
 * With ~40 worktrees and a squash-merge flow, ancestry-based `--merged` misses
 * squash-absorbed branches, so this uses the cherry-pick-aware check from the guide
 * (`git log --right-only --cherry-pick`) to decide whether a branch still has unique
 * patch content. Branches already recorded in docs/branch-review-ledger.md are noted
 * so a follow-up review can skip them.
 *
 * Flags: --no-fetch (skip the network fetch), --json (machine-readable output).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER = path.join(root, "docs/branch-review-ledger.md");

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return "";
  }
}

/**
 * Extract branch short-names from a ledger branch/ref cell. A ref token is
 * "<namespace>/<name>" with no surrounding whitespace, so the "PR #N / " prefix and
 * prose do not produce false matches; a leading "origin/" is stripped so
 * remote-tracking rows normalize to the same short name the sweep compares against.
 */
function refTokensFromCell(cell) {
  const out = [];
  for (const m of cell.matchAll(/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+/g)) {
    out.push(m[0].replace(/^origin\//, ""));
  }
  return out;
}

/**
 * Every branch name referenced anywhere in the review ledger (any scope, any HEAD),
 * across every namespace — claude/, codex/, copilot/, cursor/, fix/, and future ones.
 */
export function parseLedgerBranches(markdown) {
  const names = new Set();
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    // | date | branch/ref | head | scope | outcome | checks |  -> column index 2
    const cell = (line.split("|")[2] ?? "").trim();
    if (!cell) continue;
    for (const name of refTokensFromCell(cell)) names.add(name);
  }
  return names;
}

/**
 * Whether the ledger records a COMPLETED cleanup review that authorizes skipping this
 * branch, per docs/branch-cleanup-guide.md: an exact row match on branch name, current
 * HEAD, and scope `branch-cleanup`. Deliberately excludes `branch-cleanup-deletion-pending`
 * (and any other scope) and stale-HEAD rows, so a pending deletion or a moved HEAD is
 * surfaced for re-evaluation rather than reported as already handled.
 */
export function hasCompletedCleanupReview(markdown, shortName, headSha) {
  if (!shortName || !headSha) return false;
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cols = line.split("|");
    if ((cols[4] ?? "").trim() !== "branch-cleanup") continue;
    if ((cols[3] ?? "").trim() !== headSha) continue;
    if (refTokensFromCell((cols[2] ?? "").trim()).includes(shortName)) return true;
  }
  return false;
}

function main() {
  const asJson = process.argv.includes("--json");
  if (!process.argv.includes("--no-fetch")) {
    try {
      execFileSync("git", ["fetch", "--prune", "--quiet", "origin"], { cwd: root, stdio: "ignore" });
    } catch {
      /* offline — use last-known refs */
    }
  }

  const ledgerText = (() => {
    try {
      return readFileSync(LEDGER, "utf8");
    } catch {
      return "";
    }
  })();

  const remoteBranches = tryGit(["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin"])
    .split("\n")
    .map((b) => b.trim())
    // `refname:short` renders refs/remotes/origin/HEAD as bare "origin"; exclude it.
    .filter((b) => b && b !== "origin" && b !== "origin/HEAD" && b !== "origin/main");

  const rows = [];
  for (const ref of remoteBranches) {
    const short = ref.replace(/^origin\//, "");
    const counts = tryGit(["rev-list", "--left-right", "--count", `origin/main...${ref}`]);
    const [behind, ahead] = counts ? counts.split(/\s+/).map((n) => Number.parseInt(n, 10) || 0) : [0, 0];
    // Cherry-pick-aware: commits on the branch NOT already in main (by patch id).
    const uniqueLog = tryGit(["log", "--oneline", "--right-only", "--cherry-pick", `origin/main...${ref}`]);
    const uniqueCommits = uniqueLog ? uniqueLog.split("\n").filter(Boolean).length : 0;
    const headSha = tryGit(["rev-parse", ref]);
    rows.push({
      branch: short,
      ahead,
      behind,
      uniqueCommits,
      // Only a completed `branch-cleanup` review at the current HEAD counts as
      // reviewed/skippable; deletion-pending rows and stale HEADs report `no`.
      reviewed: hasCompletedCleanupReview(ledgerText, short, headSha),
      deletionCandidate: uniqueCommits === 0,
    });
  }

  rows.sort((a, b) => a.uniqueCommits - b.uniqueCommits || a.branch.localeCompare(b.branch));

  if (asJson) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), branches: rows }, null, 2));
    return;
  }

  const candidates = rows.filter((r) => r.deletionCandidate);
  console.log(`Branch inventory vs origin/main (${rows.length} remote branches):\n`);
  console.log("unique  ahead  behind  review  branch");
  for (const r of rows) {
    console.log(
      `${String(r.uniqueCommits).padStart(6)}  ${String(r.ahead).padStart(5)}  ${String(r.behind).padStart(6)}  ` +
        `${r.reviewed ? "  yes " : "  no  "}  ${r.branch}`,
    );
  }
  console.log(`\n${candidates.length} deletion candidate(s) (no unique patch content — squash-merged or empty):`);
  for (const r of candidates) console.log(`  - ${r.branch}`);
  console.log(
    "\nREPORT ONLY — nothing deleted. Verify each candidate per docs/branch-cleanup-guide.md before removing.",
  );
}

const invokedDirectly = process.argv[1]?.endsWith("sweep-branch-ledger.mjs");
if (invokedDirectly) main();
