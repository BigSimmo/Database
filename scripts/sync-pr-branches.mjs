#!/usr/bin/env node
/**
 * sync-pr-branches — compatibility wrapper for sync-open-pr-branches.mjs (#TF6TPJ).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runSyncOpenPrBranches } from "./sync-open-pr-branches.mjs";
export * from "./sync-open-pr-branches.mjs";

const isEntry =
  Boolean(process.argv[1]) &&
  (import.meta.url === pathToFileURL(process.argv[1]).href ||
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1]));

if (isEntry) {
  try {
    runSyncOpenPrBranches();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
