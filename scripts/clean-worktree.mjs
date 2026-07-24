#!/usr/bin/env node

import { execSync } from "node:child_process";

try {
  console.log("[clean-worktree] Cleaning ephemeral debug files and logs...");
  // -f: force, -d: directories, -x: ignored and untracked files
  // We explicitly scope this to known debug patterns to preserve user work.
  execSync("git clean -fdx tmp-*.py test-output.txt *.log", { stdio: "inherit" });
  console.log("[clean-worktree] Worktree sanitized.");
} catch (err) {
  console.error("[clean-worktree] Failed to clean worktree:", err.message);
  process.exit(1);
}
