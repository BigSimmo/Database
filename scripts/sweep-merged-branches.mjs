#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
    throw new Error(stderr || `git ${args.join(" ")} failed with status ${result.status}`);
  }
  return (result.stdout || "").trim();
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const prune = !argv.includes("--no-prune");
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`Usage: node scripts/sweep-merged-branches.mjs [--apply] [--no-prune]

Dry-run by default. Lists local branches already merged into main.
Pass --apply to delete those local branches with git branch -d.
Remote branches are never deleted.`);
    process.exit(0);
  }
  return { apply, prune };
}

function main() {
  const { apply, prune } = parseArgs(process.argv.slice(2));

  if (prune) {
    runGit(["remote", "prune", "origin"]);
  }

  const currentBranch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  const mergedBranches = runGit(["branch", "--merged", "main"])
    .split("\n")
    .map((line) => line.trim().replace(/^\*\s+/, ""))
    .filter(Boolean);

  const protectedBranches = new Set(["main", "master", "develop", currentBranch]);
  const branchesToDelete = mergedBranches.filter(
    (branch) => !protectedBranches.has(branch) && !branch.startsWith("release/"),
  );

  if (branchesToDelete.length === 0) {
    console.log("No merged local branches to clean up.");
    return;
  }

  if (!apply) {
    console.log("Dry-run only. Candidates that would be deleted with --apply:");
    for (const branch of branchesToDelete) console.log(`- ${branch}`);
    console.log(`\nRe-run with --apply to delete ${branchesToDelete.length} local branch(es).`);
    return;
  }

  for (const branch of branchesToDelete) {
    console.log(`Deleting merged branch: ${branch}`);
    try {
      runGit(["branch", "-d", branch]);
    } catch (error) {
      console.warn(`Failed to delete branch ${branch}: ${error.message}`);
    }
  }

  console.log("Branch cleanup complete.");
}

try {
  main();
} catch (error) {
  console.error(`Error cleaning up branches: ${error.message}`);
  process.exit(1);
}
