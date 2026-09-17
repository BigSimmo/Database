#!/usr/bin/env node
/**
 * Read-only measurement: how often did a "hot file" (default
 * `src/data/source-acquisitions.json`) actually produce merge conflicts
 * between consecutive merged PRs in a date window, and how many merge/resolve
 * commits did that cost?
 *
 * This does not fix anything and is not wired into CI or any gate. It exists
 * to measure whether the sha1(id)-ordering fix (see
 * `scripts/merge-source-acquisitions.ts`) is worth doing, and later, whether
 * it worked.
 *
 * Usage: node scripts/measure-hot-file-conflicts.mjs --since 2026-08-01 [--file <path>]
 *
 * Talks to GitHub via `gh pr list` and to local git via `git merge-tree` —
 * both real provider/repo reads, gated behind the CLI entrypoint below. The
 * counting logic itself (exported) takes plain data and is unit-testable
 * without either.
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DEFAULT_FILE_PATH = "src/data/source-acquisitions.json";

// ---------------------------------------------------------------------------
// Pure counting logic — no network, no git
// ---------------------------------------------------------------------------

/** PRs whose changed-file list includes `filePath`. */
export function prsTouchingFile(prs, filePath) {
  return prs.filter((pr) => Array.isArray(pr.files) && pr.files.some((file) => file.path === filePath));
}

/** Consecutive (adjacent, in list order) pairs — the order the caller supplies is the order compared. */
export function consecutivePairs(items) {
  const pairs = [];
  for (let i = 0; i + 1 < items.length; i++) {
    pairs.push([items[i], items[i + 1]]);
  }
  return pairs;
}

/**
 * `git merge-tree --write-tree --name-only <A> <B>` prints the resulting
 * tree's OID on the first line, and — only when there is a conflict — the
 * conflicted paths one per line immediately after, terminated by a blank
 * line and then human-readable messages. No blank line at all means no
 * conflicts. This parses exactly that shape; it takes the already-captured
 * stdout, not a live process, so it needs neither network nor git to test.
 */
export function parseMergeTreeConflicts(output) {
  const lines = output.split("\n");
  const paths = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "") break;
    paths.push(lines[i]);
  }
  return paths;
}

/**
 * Counts how many of `pairs` conflict on `filePath`, per `mergeTreeConflicts`
 * — an injected `(headA, headB) => string[]` so this stays pure for tests.
 */
export function countHotFileConflicts(pairs, filePath, mergeTreeConflicts) {
  const details = pairs.map(([a, b]) => {
    const conflicts = mergeTreeConflicts(a.headRefOid, b.headRefOid);
    return { a: a.number, b: b.number, conflictedFiles: conflicts, conflict: conflicts.includes(filePath) };
  });
  return {
    total: pairs.length,
    conflicting: details.filter((entry) => entry.conflict).length,
    details,
  };
}

/** A commit headline that looks like a merge or a conflict-resolution commit. */
export function isMergeOrResolveHeadline(headline) {
  return /^merge|resolv/i.test(headline ?? "");
}

export function countMergeCommits(pr) {
  const commits = Array.isArray(pr.commits) ? pr.commits : [];
  return commits.filter((commit) => isMergeOrResolveHeadline(commit.messageHeadline)).length;
}

export function countMergeCommitsAcrossPRs(prs) {
  const perPr = prs.map((pr) => ({ number: pr.number, mergeCommits: countMergeCommits(pr) }));
  return {
    total: perPr.reduce((sum, entry) => sum + entry.mergeCommits, 0),
    perPr,
  };
}

// ---------------------------------------------------------------------------
// CLI — provider-backed, kept out of the pure functions above
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { file: DEFAULT_FILE_PATH };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--since") flags.since = argv[++i];
    else if (arg === "--file") flags.file = argv[++i];
    else throw new Error(`Unrecognized argument: ${arg}`);
  }
  if (!flags.since) throw new Error("Usage: measure-hot-file-conflicts.mjs --since YYYY-MM-DD [--file <path>]");
  return flags;
}

function fetchMergedPRs(since) {
  const raw = execFileSync(
    "gh",
    [
      "pr",
      "list",
      "--state",
      "merged",
      "--search",
      `merged:>=${since}`,
      "--json",
      "number,headRefOid,files,commits",
      "--limit",
      "500",
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(raw);
}

function gitMergeTreeConflicts(headA, headB) {
  try {
    execFileSync("git", ["merge-tree", "--write-tree", "--name-only", headA, headB], { encoding: "utf8" });
    return [];
  } catch (error) {
    const output = typeof error.stdout === "string" ? error.stdout : (error.stdout?.toString() ?? "");
    return parseMergeTreeConflicts(output);
  }
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const allMerged = fetchMergedPRs(flags.since);
  const touching = prsTouchingFile(allMerged, flags.file);
  const pairs = consecutivePairs(touching);
  const conflicts = countHotFileConflicts(pairs, flags.file, gitMergeTreeConflicts);
  const mergeCommits = countMergeCommitsAcrossPRs(touching);

  console.log(`Merged PRs since ${flags.since}: ${allMerged.length}`);
  console.log(`Merged PRs touching ${flags.file}: ${touching.length}`);
  console.log(`Consecutive pairs both touching it: ${conflicts.total}`);
  console.log(`Pairs that actually conflict on it: ${conflicts.conflicting}`);
  console.log(`Merge/resolve-headline commits across those PRs: ${mergeCommits.total}`);
  if (mergeCommits.total > 0) {
    for (const entry of mergeCommits.perPr) {
      if (entry.mergeCommits > 0) console.log(`  - PR #${entry.number}: ${entry.mergeCommits}`);
    }
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
