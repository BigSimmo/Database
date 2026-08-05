#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = "BigSimmo/Database";

function shellGh(command, args) {
  return spawnSync(command, args, { encoding: "utf8", shell: false });
}

/**
 * Check only the optional GitHub CLI fallback available to the current shell.
 * Hosted GitHub connector/native Cloud access is a separate capability.
 */
export function githubShellAccess(run = shellGh) {
  if (run("gh", ["--version"]).status !== 0) {
    return { ok: false, outcome: "GH_CLI_MISSING" };
  }
  if (run("gh", ["auth", "status", "--hostname", "github.com"]).status !== 0) {
    return { ok: false, outcome: "GH_AUTH_MISSING" };
  }
  if (run("gh", ["repo", "view", repository, "--json", "nameWithOwner,viewerPermission"]).status !== 0) {
    return { ok: false, outcome: "GH_REPO_ACCESS_MISSING" };
  }
  if (
    run("gh", ["pr", "list", "--repo", repository, "--state", "open", "--limit", "1", "--json", "number"]).status !== 0
  ) {
    return { ok: false, outcome: "GH_PR_LIST_ACCESS_MISSING" };
  }
  return { ok: true, outcome: "GH_SHELL_ACCESS_READY" };
}

function fakeRun(statuses) {
  let index = 0;
  return () => ({ status: statuses[index++] ?? 0, stdout: "", stderr: "" });
}

function selfTest() {
  const cases = [
    [[1], "GH_CLI_MISSING"],
    [[0, 1], "GH_AUTH_MISSING"],
    [[0, 0, 1], "GH_REPO_ACCESS_MISSING"],
    [[0, 0, 0, 1], "GH_PR_LIST_ACCESS_MISSING"],
    [[0, 0, 0, 0], "GH_SHELL_ACCESS_READY"],
  ];
  for (const [statuses, expected] of cases) {
    const actual = githubShellAccess(fakeRun(statuses));
    if (actual.outcome !== expected || actual.ok !== (expected === "GH_SHELL_ACCESS_READY")) {
      throw new Error(`expected ${expected}, received ${actual.outcome}`);
    }
  }
  console.log("GITHUB_SHELL_ACCESS_SELF_TEST=PASS");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const result = githubShellAccess();
  console.log(`GITHUB_SHELL_ACCESS=${result.outcome}`);
  console.log("GITHUB_HOSTED_CONNECTOR=SEPARATE_UNVERIFIED_CAPABILITY");
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
