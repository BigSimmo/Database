#!/usr/bin/env node
/**
 * install-git-hooks — point git at the committed .githooks/ directory.
 *
 * Runs automatically from the package.json `postinstall` script, so every
 * `npm install` / `npm ci` (local, CI, and Claude web containers) self-installs
 * the pre-push guards. The repo's SessionStart hook only runs on remote web
 * containers, so postinstall is the reliable cross-surface install point.
 *
 * Contract: this must NEVER fail an install. Every failure path swallows the
 * error and exits 0. It is idempotent — a no-op when core.hooksPath is already
 * `.githooks`.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import path from "node:path";

const HOOKS_DIR = ".githooks";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

try {
  // Only act inside a git work tree.
  let insideRepo = false;
  try {
    insideRepo = git(["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    insideRepo = false;
  }
  if (!insideRepo) process.exit(0);

  let current = "";
  try {
    current = git(["config", "--get", "core.hooksPath"]);
  } catch {
    current = "";
  }

  if (current !== HOOKS_DIR) {
    git(["config", "core.hooksPath", HOOKS_DIR]);
    console.log(`[install-git-hooks] core.hooksPath set to ${HOOKS_DIR}`);
  }

  // Best-effort: ensure the hook is executable on POSIX (harmless on Windows).
  const prePush = path.join(process.cwd(), HOOKS_DIR, "pre-push");
  if (existsSync(prePush)) {
    try {
      chmodSync(prePush, 0o755);
    } catch {
      /* non-fatal */
    }
  }
} catch (error) {
  // Never break `npm install` over hook setup.
  console.warn(`[install-git-hooks] skipped: ${error?.message ?? error}`);
}

process.exit(0);
