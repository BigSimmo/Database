#!/usr/bin/env node
/**
 * check-base-freshness — advisory stale-base tripwire.
 *
 * main moves fast (claude/* branches auto-merge on green), so a worktree branched
 * a while ago can be many commits behind origin/main — which is how duplicate work
 * gets built against a stale base. This fetches origin/main and reports how far
 * behind the current branch is, warning loudly past a threshold.
 *
 * ADVISORY ONLY — never exits non-zero on staleness, so it is safe to wire into a
 * SessionStart hook or statusline without ever blocking work. Exit is non-zero
 * only on a genuine tooling error under `--strict` (off by default).
 *
 * Env:
 *   STALE_BASE_THRESHOLD  commits-behind that triggers the loud warning (default 10)
 *   BASE_FRESHNESS_NO_FETCH=1  skip the network fetch (use last-known origin/main)
 * Flags:
 *   --json    machine-readable output
 *   --strict  exit 1 when the base ref cannot be resolved (default: exit 0)
 */
import { execFileSync } from "node:child_process";

const threshold = Number.parseInt(process.env.STALE_BASE_THRESHOLD ?? "10", 10) || 10;
const asJson = process.argv.includes("--json");
const strict = process.argv.includes("--strict");

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return undefined;
  }
}

function finish(result) {
  if (asJson) {
    console.log(JSON.stringify(result));
  } else if (result.error) {
    console.error(`[base-freshness] ${result.error}`);
  } else if (result.behind > threshold) {
    console.error(
      `\n⚠  [base-freshness] ${result.branch} is ${result.behind} commits BEHIND origin/main ` +
        `(ahead ${result.ahead}).\n` +
        `   You may be building on a stale base — rebase/merge origin/main before starting new work.\n`,
    );
  } else {
    console.error(
      `[base-freshness] ${result.branch}: behind ${result.behind}, ahead ${result.ahead} vs origin/main — ok`,
    );
  }
  process.exit(result.error && strict ? 1 : 0);
}

const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "(unknown)";

if (process.env.BASE_FRESHNESS_NO_FETCH !== "1") {
  try {
    execFileSync("git", ["fetch", "--quiet", "origin", "main"], { stdio: "ignore" });
  } catch {
    // Offline or no remote — fall back to whatever origin/main we already have.
  }
}

if (!tryGit(["rev-parse", "--verify", "--quiet", "origin/main"])) {
  finish({ branch, error: "origin/main not resolvable (no remote or never fetched)", behind: 0, ahead: 0 });
}

const counts = tryGit(["rev-list", "--left-right", "--count", "origin/main...HEAD"]);
if (!counts) {
  finish({ branch, error: "could not compute ahead/behind vs origin/main", behind: 0, ahead: 0 });
}

const [behind, ahead] = counts.split(/\s+/).map((n) => Number.parseInt(n, 10) || 0);
finish({ branch, behind, ahead, threshold });
