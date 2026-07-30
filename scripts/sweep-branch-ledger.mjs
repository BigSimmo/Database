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
 * Split a ledger row into cells. Prose pipes are escaped as `\|` and must not be
 * treated as separators, or every column after them shifts and the cleanup lookup
 * reads the wrong cell.
 */
const CELL_SPLIT = /(?<!\\)\|/;

/**
 * Every branch name referenced anywhere in the review ledger (any scope, any HEAD),
 * across every namespace — claude/, codex/, copilot/, cursor/, fix/, and future ones.
 */
export function parseLedgerBranches(markdown) {
  const names = new Set();
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    // | date | branch/ref | head | scope | outcome | checks |  -> column index 2
    const cell = (line.split(CELL_SPLIT)[2] ?? "").trim();
    if (!cell) continue;
    for (const name of refTokensFromCell(cell)) names.add(name);
  }
  return names;
}

/**
 * Whether the ledger records a COMPLETED cleanup review that authorizes skipping this
 * branch, per docs/branch-cleanup-guide.md: a row match on branch name, current HEAD, and
 * scope `branch-cleanup`. Deliberately excludes `branch-cleanup-deletion-pending` (and any
 * other scope) and stale-HEAD rows, so a pending deletion or a moved HEAD is surfaced for
 * re-evaluation rather than reported as already handled.
 *
 * Historical rows recorded abbreviated SHAs, so an abbreviation of at least 7 characters
 * that prefixes the current HEAD counts as the same commit. Anything shorter, or prose such
 * as `see PR head`, matches nothing and forces a re-review.
 */
export function hasCompletedCleanupReview(markdown, shortName, headSha) {
  if (!shortName || !headSha) return false;
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cols = line.split(CELL_SPLIT);
    if ((cols[4] ?? "").trim() !== "branch-cleanup") continue;
    const recorded = (cols[3] ?? "").trim().replace(/`/g, "");
    const sameCommit = recorded === headSha || (/^[0-9a-f]{7,40}$/.test(recorded) && headSha.startsWith(recorded));
    if (!sameCommit) continue;
    if (refTokensFromCell((cols[2] ?? "").trim()).includes(shortName)) return true;
  }
  return false;
}

/**
 * Refusal message for a shallow clone, or "" when the history is complete.
 *
 * Every signal this sweep reports — ahead/behind, `--cherry-pick` patch-uniqueness,
 * and therefore `deletionCandidate` — is computed from merge-bases. A shallow clone has
 * a grafted root, so merge-bases are missing or wrong and those numbers are silently
 * fiction rather than an error. On 2026-07-29 a remote session swept this repo with 74
 * of 2829 commits present and got `90 of 91` branches reported as carrying unmerged
 * work, while a stale local `main` read as `ahead 52` with "unrelated histories"
 * (ledger `#109`). Acting on that meant either deleting live branches or abandoning
 * cleanup as impossible, so this fails closed: no inventory is printed at all, because a
 * partial inventory is what invites someone to act on it.
 *
 * Takes the raw `git rev-parse --is-shallow-repository` output rather than a boolean, because
 * the decision is three-way and only ONE branch may proceed:
 *
 *   "false" -> complete history, sweep is trustworthy, return ""
 *   "true"  -> shallow, refuse
 *   anything else (including "" from a failed `tryGit`) -> INDETERMINATE, refuse
 *
 * The third case is the subtle one. `tryGit` swallows every error into "", so an unverifiable
 * precondition is indistinguishable from a healthy one unless it is treated as its own
 * failure. Proceeding there would emit merge-base-derived numbers while unable to establish
 * that the merge-bases are real, which is precisely the #109 defect wearing a different hat.
 * Note that "false" is a truthy string, so this must compare the exact value both ways —
 * coercing on truthiness would refuse on every healthy clone instead.
 */
export function shallowCloneRefusal(isShallowOutput) {
  const status = String(isShallowOutput ?? "").trim();
  if (status === "false") return "";
  const why =
    status === "true"
      ? "this is a SHALLOW clone, so every merge-base is unreliable."
      : `could not determine whether this clone is shallow (git reported ${JSON.stringify(status)}).`;
  return [
    `refusing to report: ${why}`,
    "",
    "Branch signals — ahead/behind, --cherry-pick patch-uniqueness, deletion candidates —",
    "are all derived from merge-bases. With a grafted root they are wrong without erroring:",
    "see ledger #109, where a shallow sweep reported 90 of 91 branches as unmerged.",
    "",
    "Fix: git fetch --unshallow --tags origin",
    "Then re-run, from a real git checkout, and confirm `git rev-parse",
    "--is-shallow-repository` prints false. Never delete a branch, or report one as",
    "unmerged, without that confirmation.",
  ].join("\n");
}

function main() {
  const asJson = process.argv.includes("--json");

  // Fail closed BEFORE the fetch and before any branch maths: a shallow clone cannot
  // produce a trustworthy inventory, and an untrustworthy inventory is worse than none.
  const refusal = shallowCloneRefusal(tryGit(["rev-parse", "--is-shallow-repository"]));
  if (refusal) {
    if (asJson) {
      console.log(JSON.stringify({ error: "history-not-verified", message: refusal, branches: null }, null, 2));
    } else {
      console.error(refusal);
    }
    process.exitCode = 1;
    return;
  }

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
