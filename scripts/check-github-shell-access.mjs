#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const repository = "BigSimmo/Database";
const expectedIdentity = "BigSimmo";
const expectedOrigin = `https://github.com/${repository}.git`;
const allowProviderFlag = "--allow-provider";
const allowProviderEnv = "ALLOW_GITHUB_SHELL_ACCESS";
const writablePermissions = new Set(["admin", "maintain", "write"]);
const requiredScopes = new Set(["repo", "workflow"]);
const requiredReviewMutations = new Set(["addPullRequestReviewThreadReply", "resolveReviewThread"]);

function shellRun(command, args, cwd = process.cwd()) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
}

const transientFailurePattern =
  /(?:HTTP\s+(?:429|5\d\d)|timed?\s*out|timeout|connection reset|connection refused|temporary failure|TLS handshake|unexpected EOF|remote end hung up|could not resolve host)/iu;

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function runWithTransientRetry(run, command, args, attempts = 3) {
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = run(command, args);
    if (result.status === 0) return result;
    const diagnostic = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (attempt === attempts || !transientFailurePattern.test(diagnostic)) return result;
    wait(250 * 2 ** (attempt - 1));
  }
  return result;
}

function resilientShellRun(command, args) {
  return runWithTransientRetry(shellRun, command, args);
}

function failure(outcome) {
  return { ok: false, outcome };
}

function parseJson(result) {
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function normalizedScopes(value) {
  const scopes = Array.isArray(value) ? value : String(value ?? "").split(",");
  return new Set(scopes.map((scope) => String(scope).trim()).filter(Boolean));
}

function exactRemoteRef(run, ref) {
  const result = run("git", ["ls-remote", "--heads", "origin", ref]);
  if (result.status !== 0) return { ok: false, present: false };
  return { ok: true, present: result.stdout.trim().length > 0 };
}

/**
 * Verify the optional authenticated GitHub shell control plane without making a
 * remote mutation. The final dry-run push reaches GitHub's receive path, then
 * the exact probe ref is checked again to prove that it was not created.
 */
export function githubShellAccess(run = resilientShellRun) {
  if (run("gh", ["--version"]).status !== 0) return failure("GH_CLI_MISSING");

  const auth = parseJson(run("gh", ["auth", "status", "--hostname", "github.com", "--json", "hosts"]));
  const activeHost = auth?.hosts?.["github.com"]?.find((host) => host.active && host.state === "success");
  if (!activeHost) return failure("GH_AUTH_MISSING");
  if (activeHost.login !== expectedIdentity) return failure("GH_IDENTITY_MISMATCH");
  if (activeHost.gitProtocol !== "https") return failure("GH_GIT_PROTOCOL_UNSAFE");
  const scopes = normalizedScopes(activeHost.scopes);
  if ([...requiredScopes].some((scope) => !scopes.has(scope))) return failure("GH_REQUIRED_SCOPES_MISSING");

  const user = parseJson(run("gh", ["api", "user"]));
  if (user?.login !== expectedIdentity) return failure("GH_IDENTITY_MISMATCH");

  const repo = parseJson(run("gh", ["api", `repos/${repository}`]));
  if (repo?.full_name !== repository || !repo?.default_branch) return failure("GH_REPO_ACCESS_MISSING");

  const permission = parseJson(run("gh", ["api", `repos/${repository}/collaborators/${expectedIdentity}/permission`]));
  if (!writablePermissions.has(String(permission?.permission ?? "").toLowerCase())) {
    return failure("GH_REPO_WRITE_MISSING");
  }

  const pullRequests = parseJson(
    run("gh", ["pr", "list", "--repo", repository, "--state", "open", "--limit", "1", "--json", "number,headRefOid"]),
  );
  if (!Array.isArray(pullRequests)) return failure("GH_PR_LIST_ACCESS_MISSING");
  let selectedPullRequestNumber = null;
  if (pullRequests.length > 0) {
    const number = pullRequests[0]?.number;
    const sha = pullRequests[0]?.headRefOid;
    if (!Number.isInteger(number) || !/^[0-9a-f]{40}$/u.test(String(sha ?? ""))) {
      return failure("GH_PR_METADATA_INVALID");
    }
    selectedPullRequestNumber = number;
    for (const endpoint of [
      `repos/${repository}/pulls/${number}/reviews?per_page=1`,
      `repos/${repository}/issues/${number}/comments?per_page=1`,
      `repos/${repository}/pulls/${number}/comments?per_page=1`,
      `repos/${repository}/commits/${sha}/check-runs?per_page=1`,
    ]) {
      if (run("gh", ["api", endpoint]).status !== 0) return failure("GH_PR_DETAIL_ACCESS_MISSING");
    }
  }

  const actionsPermission = parseJson(run("gh", ["api", `repos/${repository}/actions/permissions`]));
  if (actionsPermission?.enabled !== true) return failure("GH_ACTIONS_ACCESS_MISSING");
  const actionsRuns = parseJson(run("gh", ["api", `repos/${repository}/actions/runs?status=success&per_page=1`]));
  if (!Array.isArray(actionsRuns?.workflow_runs)) return failure("GH_ACTIONS_ACCESS_MISSING");
  if (actionsRuns.workflow_runs.length === 0) return failure("GH_ACTIONS_LOG_SAMPLE_MISSING");
  const runId = actionsRuns.workflow_runs[0]?.id;
  if (!Number.isInteger(runId)) return failure("GH_ACTIONS_RUN_METADATA_INVALID");
  const jobs = parseJson(run("gh", ["api", `repos/${repository}/actions/runs/${runId}/jobs?per_page=100`]));
  if (!Array.isArray(jobs?.jobs)) return failure("GH_ACTIONS_JOBS_ACCESS_MISSING");
  const completedJob = jobs.jobs.find(
    (job) =>
      Number.isInteger(job?.id) &&
      job?.status === "completed" &&
      (job?.conclusion === "success" || job?.conclusion === "failure"),
  );
  if (!completedJob) return failure("GH_ACTIONS_LOG_SAMPLE_MISSING");
  if (run("gh", ["api", "--method", "HEAD", `repos/${repository}/actions/jobs/${completedJob.id}/logs`]).status !== 0) {
    return failure("GH_ACTIONS_LOG_ACCESS_MISSING");
  }
  if (run("gh", ["run", "rerun", "--help"]).status !== 0) return failure("GH_ACTIONS_RERUN_UNAVAILABLE");

  const pullRequestSelection = selectedPullRequestNumber
    ? `repository(owner: "BigSimmo", name: "Database") { pullRequest(number: ${selectedPullRequestNumber}) { reviewThreads(first: 1) { totalCount nodes { id isResolved } } } }`
    : "";
  const mutationQuery = `query { __type(name: "Mutation") { fields { name } } ${pullRequestSelection} }`;
  const mutationSchema = parseJson(run("gh", ["api", "graphql", "-f", `query=${mutationQuery}`]));
  const mutationNames = new Set(mutationSchema?.data?.__type?.fields?.map((field) => field.name) ?? []);
  if ([...requiredReviewMutations].some((name) => !mutationNames.has(name))) {
    return failure("GH_REVIEW_THREAD_MUTATIONS_UNAVAILABLE");
  }
  if (
    selectedPullRequestNumber &&
    !Number.isInteger(mutationSchema?.data?.repository?.pullRequest?.reviewThreads?.totalCount)
  ) {
    return failure("GH_REVIEW_THREAD_READ_MISSING");
  }

  const origin = run("git", ["config", "--get", "remote.origin.url"]);
  if (origin.status !== 0 || origin.stdout.trim() !== expectedOrigin) return failure("GH_ORIGIN_UNSAFE");
  const remoteHead = run("git", ["ls-remote", "origin", "HEAD"]);
  const headSha = remoteHead.stdout.trim().split(/\s+/u)[0] ?? "";
  if (remoteHead.status !== 0 || !/^[0-9a-f]{40}$/u.test(headSha)) return failure("GH_GIT_FETCH_ACCESS_MISSING");

  const probeRef = `refs/heads/codex/cloud-control-plane-dry-run-${headSha.slice(0, 12)}-${randomBytes(8).toString("hex")}`;
  const before = exactRemoteRef(run, probeRef);
  if (!before.ok || before.present) return failure("GH_DRY_RUN_REF_NOT_ABSENT");
  // A dry-run still invokes pre-push hooks. Those guards intentionally run
  // broad, commit-scoped verification and can take minutes, but they cannot
  // improve this no-write transport probe. Disable hooks for this command only;
  // every real push retains the repository's configured hooks.
  if (run("git", ["-c", "core.hooksPath=/dev/null", "push", "--dry-run", "origin", `HEAD:${probeRef}`]).status !== 0) {
    return failure("GH_FEATURE_BRANCH_PUSH_REJECTED");
  }
  const after = exactRemoteRef(run, probeRef);
  if (!after.ok || after.present) return failure("GH_DRY_RUN_REF_MUTATED");

  return {
    ok: true,
    outcome: "GH_SHELL_ACCESS_READY",
    identity: expectedIdentity,
    permission: String(permission.permission).toLowerCase(),
    repository,
    reviewThreadMutations: "available",
    actionsRerun: "capability-verified",
    featureBranchPush: "dry-run-verified",
  };
}

export function providerAccessAuthorized(argv = process.argv, env = process.env) {
  return argv.includes(allowProviderFlag) || env[allowProviderEnv] === "true";
}

function fakeSuccessfulRun(command, args) {
  const key = `${command} ${args.join(" ")}`;
  const success = (stdout = "") => ({ status: 0, stdout, stderr: "" });
  if (key === "gh --version") return success("gh version 2.80.0\n");
  if (key.includes("auth status")) {
    return success(
      JSON.stringify({
        hosts: {
          "github.com": [
            {
              active: true,
              state: "success",
              login: expectedIdentity,
              gitProtocol: "https",
              scopes: "repo, workflow",
            },
          ],
        },
      }),
    );
  }
  if (key === "gh api user") return success(JSON.stringify({ login: expectedIdentity }));
  if (key === `gh api repos/${repository}`) {
    return success(JSON.stringify({ full_name: repository, default_branch: "main" }));
  }
  if (key.includes("/collaborators/")) return success(JSON.stringify({ permission: "write" }));
  if (key.startsWith("gh pr list")) return success("[]");
  if (key === `gh api repos/${repository}/actions/permissions`) return success('{"enabled":true}');
  if (key === `gh api repos/${repository}/actions/runs?status=success&per_page=1`) {
    return success('{"workflow_runs":[{"id":456}]}');
  }
  if (key === `gh api repos/${repository}/actions/runs/456/jobs?per_page=100`) {
    return success('{"jobs":[{"id":789,"status":"completed","conclusion":"success"}]}');
  }
  if (key === `gh api --method HEAD repos/${repository}/actions/jobs/789/logs`) return success();
  if (key === "gh run rerun --help") return success("Usage: gh run rerun");
  if (key.startsWith("gh api graphql")) {
    return success(
      JSON.stringify({ data: { __type: { fields: [...requiredReviewMutations].map((name) => ({ name })) } } }),
    );
  }
  if (key === "git config --get remote.origin.url") return success(`${expectedOrigin}\n`);
  if (key === "git ls-remote origin HEAD") return success(`${"a".repeat(40)}\tHEAD\n`);
  if (key.startsWith("git ls-remote --heads origin refs/heads/")) return success("");
  if (key.startsWith("git -c core.hooksPath=/dev/null push --dry-run origin HEAD:refs/heads/")) {
    return success("dry run");
  }
  return { status: 1, stdout: "", stderr: "unexpected fake command" };
}

function selfTest() {
  const successful = githubShellAccess(fakeSuccessfulRun);
  if (!successful.ok || successful.outcome !== "GH_SHELL_ACCESS_READY") {
    throw new Error(`expected GH_SHELL_ACCESS_READY, received ${successful.outcome}`);
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
  if (!shouldRunSelfTest(["node", "script.mjs", "--self-test", allowProviderFlag])) {
    throw new Error("--self-test must stay offline when --allow-provider is also present");
  }
  console.log("GITHUB_SHELL_ACCESS_SELF_TEST=PASS");
}

function shouldRunSelfTest(argv = process.argv) {
  return argv.includes("--self-test");
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
        `Use npm run check:github-shell-access:live, or invoke node scripts/check-github-shell-access.mjs with ${allowProviderFlag} / ${allowProviderEnv}=true (and without --self-test), only after explicit provider approval.`,
        "The plain npm run check:github-shell-access entry always stays offline (--self-test); ambient opt-in cannot override it.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }
  const result = githubShellAccess();
  console.log(`GITHUB_SHELL_ACCESS=${result.outcome}`);
  console.log("GITHUB_HOSTED_CONNECTOR=SEPARATE_UNVERIFIED_CAPABILITY");
  if (result.ok) {
    console.log(`GITHUB_IDENTITY=${result.identity}`);
    console.log(`GITHUB_REPOSITORY=${result.repository}`);
    console.log(`GITHUB_REPOSITORY_PERMISSION=${result.permission}`);
    console.log(`GITHUB_FEATURE_BRANCH_PUSH=${result.featureBranchPush}`);
    console.log(`GITHUB_REVIEW_THREAD_MUTATIONS=${result.reviewThreadMutations}`);
    console.log(`GITHUB_ACTIONS_RERUN=${result.actionsRerun}`);
  } else {
    process.exitCode = 1;
  }
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedDirectly) main();
