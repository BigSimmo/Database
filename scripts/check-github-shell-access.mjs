#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = "BigSimmo/Database";
const allowProviderFlag = "--allow-provider";
const allowProviderEnv = "ALLOW_GITHUB_SHELL_ACCESS";

function shellGh(command, args) {
  return spawnSync(command, args, { encoding: "utf8", shell: false });
}

/**
 * Check only the optional GitHub CLI fallback available to the current shell.
 * Hosted GitHub connector/native Cloud access is a separate capability.
 *
 * Live `gh` API calls require an explicit opt-in (`--allow-provider` or
 * `ALLOW_GITHUB_SHELL_ACCESS=true`) so the provider confirmation boundary is
 * self-enforcing rather than documentation-only. The plain npm script passes
 * `--self-test`, which stays offline unless an opt-in is also present; use
 * `npm run check:github-shell-access:live` for the dedicated provider-backed
 * entry. Opt-in always wins over `--self-test` so env/flag confirmation cannot
 * be silently swallowed by the offline stub.
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

export function providerAccessAuthorized(argv = process.argv, env = process.env) {
  return argv.includes(allowProviderFlag) || env[allowProviderEnv] === "true";
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
  if (providerAccessAuthorized(["node", "script.mjs"], {})) {
    throw new Error("provider access must fail closed without an opt-in");
  }
  if (!providerAccessAuthorized(["node", "script.mjs", allowProviderFlag], {})) {
    throw new Error("provider access must accept --allow-provider");
  }
  if (!providerAccessAuthorized(["node", "script.mjs"], { [allowProviderEnv]: "true" })) {
    throw new Error(`provider access must accept ${allowProviderEnv}=true`);
  }
  // Opt-in must beat a bundled --self-test so confirmation is never a no-op.
  if (shouldRunSelfTest(["node", "script.mjs", "--self-test", allowProviderFlag], {})) {
    throw new Error("--allow-provider must skip the offline --self-test stub");
  }
  if (shouldRunSelfTest(["node", "script.mjs", "--self-test"], { [allowProviderEnv]: "true" })) {
    throw new Error(`${allowProviderEnv}=true must skip the offline --self-test stub`);
  }
  if (!shouldRunSelfTest(["node", "script.mjs", "--self-test"], {})) {
    throw new Error("plain --self-test without opt-in must stay offline");
  }
  console.log("GITHUB_SHELL_ACCESS_SELF_TEST=PASS");
}

function shouldRunSelfTest(argv = process.argv, env = process.env) {
  return argv.includes("--self-test") && !providerAccessAuthorized(argv, env);
}

function main() {
  if (shouldRunSelfTest()) {
    selfTest();
    return;
  }
  if (!providerAccessAuthorized()) {
    console.error(
      [
        "Refusing live GitHub API calls without confirmation.",
        `Use npm run check:github-shell-access:live, or invoke node scripts/check-github-shell-access.mjs with ${allowProviderFlag} / ${allowProviderEnv}=true, only after explicit provider approval.`,
        "The plain npm run check:github-shell-access entry stays offline unless that same opt-in is present (opt-in overrides --self-test).",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }
  const result = githubShellAccess();
  console.log(`GITHUB_SHELL_ACCESS=${result.outcome}`);
  console.log("GITHUB_HOSTED_CONNECTOR=SEPARATE_UNVERIFIED_CAPABILITY");
  if (!result.ok) process.exitCode = 1;
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedDirectly) main();
