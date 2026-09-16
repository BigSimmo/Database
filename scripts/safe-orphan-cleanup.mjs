#!/usr/bin/env node

/**
 * Task: #6GW95D - Safe orphan worktree pruning and reporting tool entrypoint.
 *
 * Report-only wrapper around scripts/worktree-cleanup.mjs.
 * Rejects --apply/--force so this entrypoint cannot forward destructive flags.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DESTRUCTIVE_FLAGS = new Set(["--apply", "--force", "-f"]);

const forwarded = process.argv.slice(2);
const rejected = forwarded.filter((arg) => DESTRUCTIVE_FLAGS.has(arg));
if (rejected.length > 0) {
  console.error(
    `[safe-orphan-cleanup] Refusing destructive flag(s): ${rejected.join(", ")}. ` +
      "This entrypoint is report-only; do not forward mutation flags to worktree-cleanup.mjs. " +
      "Re-run without --apply/--force (defaults to dry-run/report-only).",
  );
  process.exit(2);
}

const target = fileURLToPath(new URL("./worktree-cleanup.mjs", import.meta.url));
const result = spawnSync(process.execPath, [target, ...forwarded], {
  stdio: "inherit",
});
process.exit(result.status ?? (result.error ? 1 : 0));
