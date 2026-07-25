import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();

try {
  // Prune remote tracking branches
  run("git remote prune origin");

  // Get current branch
  const currentBranch = run("git rev-parse --abbrev-ref HEAD");

  // Get branches merged into main
  const mergedBranches = run("git branch --merged main")
    .split("\n")
    .map((b) => b.trim().replace(/^\*\s+/, ""))
    .filter(Boolean);

  const branchesToDelete = mergedBranches.filter(
    (b) => b !== "main" && b !== "master" && b !== currentBranch && !b.startsWith("release/")
  );

  if (branchesToDelete.length === 0) {
    console.log("No merged branches to clean up.");
    process.exit(0);
  }

  for (const branch of branchesToDelete) {
    console.log(`Deleting merged branch: ${branch}`);
    try {
      run(`git branch -d ${branch}`);
    } catch (err) {
      console.warn(`Failed to delete branch ${branch}: ${err.message}`);
    }
  }

  console.log("Branch cleanup complete.");
} catch (error) {
  console.error("Error cleaning up branches:", error.message);
  process.exit(1);
}
