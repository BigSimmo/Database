#!/usr/bin/env node
/**
 * install-git-hooks — point git at the committed .githooks/ directory and install
 * the branch-review-ledger custom merge driver.
 *
 * Runs automatically from the package.json `postinstall` script, so every
 * `npm install` / `npm ci` (local, CI, and Claude web containers) self-installs
 * the pre-push guards. The repo's SessionStart hook only runs on remote web
 * containers, so postinstall is the reliable cross-surface install point.
 *
 * Contract: this must NEVER fail an install. Every failure path swallows the
 * error and exits 0. It is idempotent — a no-op when core.hooksPath is already
 * `.githooks` and merge.ledger.driver is already set.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import path from "node:path";

const HOOKS_DIR = ".githooks";
const LEDGER_MERGE_DRIVER = "node scripts/merge-branch-review-ledger.mjs %O %A %B";
const LEDGER_MERGE_NAME = "branch-review-ledger union with exact-row dedupe";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function gitConfigGet(key) {
  try {
    return git(["config", "--get", key]);
  } catch {
    return "";
  }
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

  const current = gitConfigGet("core.hooksPath");
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

  if (gitConfigGet("merge.ledger.driver") !== LEDGER_MERGE_DRIVER) {
    git(["config", "merge.ledger.driver", LEDGER_MERGE_DRIVER]);
    console.log("[install-git-hooks] merge.ledger.driver installed");
  }
  if (gitConfigGet("merge.ledger.name") !== LEDGER_MERGE_NAME) {
    git(["config", "merge.ledger.name", LEDGER_MERGE_NAME]);
  }
} catch (error) {
  // Never break `npm install` over hook setup.
  console.warn(`[install-git-hooks] skipped: ${error?.message ?? error}`);
}

process.exit(0);
