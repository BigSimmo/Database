#!/usr/bin/env node

/**
 * Task: #6GW95D - Safe orphan worktree pruning and reporting tool entrypoint.
 * Forwards to scripts/worktree-cleanup.mjs.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(new URL("./worktree-cleanup.mjs", import.meta.url));
const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? (result.error ? 1 : 0));
