import { describe, expect, it } from "vitest";

import {
  githubShellAccess,
  providerAccessAuthorized,
  runWithTransientRetry,
  shellRun,
} from "../scripts/check-github-shell-access.mjs";

const repository = "BigSimmo/Database";
const origin = `https://github.com/${repository}.git`;
const sha = "a".repeat(40);

type FixtureOptions = {
  actionsEnabled?: boolean;
  actionLogsStatus?: number;
  actionJobsAvailable?: boolean;
  actionJobConclusion?: string;
  actionRunsAvailable?: boolean;
  afterRefPresent?: boolean;
  closedPullRequestsAvailable?: boolean;
  dryRunStatus?: number;
  identity?: string;
  mutations?: string[];
  openPullRequestsAvailable?: boolean;
  permission?: string;
  reviewThreadsHasNextPage?: boolean;
  reviewThreadsAvailable?: boolean;
  unresolvedReviewThreadCount?: number;
  viewerCanResolve?: boolean;
  scopes?: string;
};

function fixtureRun(options: FixtureOptions = {}) {
  let refReadCount = 0;
  const identity = options.identity ?? "BigSimmo";
  const permission = options.permission ?? "write";
  const scopes = options.scopes ?? "repo, workflow, read:org, gist";
  const mutations = options.mutations ?? ["addPullRequestReviewThreadReply", "resolveReviewThread"];
  const success = (stdout = "") => ({ status: 0, stdout, stderr: "" });

  return (command: string, args: string[]) => {
    const key = `${command} ${args.join(" ")}`;
    if (key === "gh --version") return success("gh version 2.80.0\n");
    if (key.includes("auth status")) {
      return success(
        JSON.stringify({
          hosts: {
            "github.com": [{ active: true, state: "success", login: identity, gitProtocol: "https", scopes }],
          },
        }),
      );
    }
    if (key === "gh api user") return success(JSON.stringify({ login: identity }));
    if (key === `gh api repos/${repository}`) {
      return success(JSON.stringify({ full_name: repository, default_branch: "main" }));
    }
    if (key.includes("/collaborators/")) return success(JSON.stringify({ permission }));
    if (key === "git branch --show-current") return success("codex/sample\n");
    if (key.includes("gh pr list") && key.includes("--state open")) {
      if (options.openPullRequestsAvailable === false) return success("[]");
      return success(
        JSON.stringify([
          {
            number: 123,
            state: "OPEN",
            headRefOid: sha,
            headRefName: "codex/sample",
            isDraft: false,
            mergeStateStatus: "CLEAN",
            labels: [],
          },
        ]),
      );
    }
    if (key.includes("gh pr list") && key.includes("--state closed")) {
      if (options.closedPullRequestsAvailable === false) return success("[]");
      return success(
        JSON.stringify([
          {
            number: 123,
            state: "MERGED",
            headRefOid: sha,
            headRefName: "codex/sample",
            isDraft: false,
            mergeStateStatus: "UNKNOWN",
            labels: [],
          },
        ]),
      );
    }
    if (key === `gh pr diff 123 --repo ${repository} --name-only`) return success("README.md\n");
    if (
      /gh api repos\/BigSimmo\/Database\/(pulls\/123\/reviews|issues\/123\/comments|pulls\/123\/comments)/u.test(key)
    ) {
      return success("[]");
    }
    if (key.includes(`/commits/${sha}/check-runs?per_page=1`)) return success('{"total_count":0,"check_runs":[]}');
    if (key === `gh api repos/${repository}/actions/permissions`) {
      return success(JSON.stringify({ enabled: options.actionsEnabled ?? true }));
    }
    if (key === `gh api repos/${repository}/actions/runs?status=success&per_page=1`) {
      return success(options.actionRunsAvailable === false ? '{"workflow_runs":[]}' : '{"workflow_runs":[{"id":456}]}');
    }
    if (key === `gh api repos/${repository}/actions/runs/456/jobs?per_page=100`) {
      return success(
        options.actionJobsAvailable === false
          ? "{}"
          : JSON.stringify({
              jobs: [{ id: 789, status: "completed", conclusion: options.actionJobConclusion ?? "success" }],
            }),
      );
    }
    if (key === `gh api --method HEAD repos/${repository}/actions/jobs/789/logs`) {
      return { status: options.actionLogsStatus ?? 0, stdout: "", stderr: "" };
    }
    if (key === "gh run rerun --help") return success("Usage: gh run rerun");
    if (key.startsWith("gh api graphql")) {
      const unresolvedReviewThreadCount = options.unresolvedReviewThreadCount ?? 0;
      return success(
        JSON.stringify({
          data: {
            __type: { fields: mutations.map((name) => ({ name })) },
            repository:
              options.reviewThreadsAvailable === false
                ? null
                : {
                    pullRequest: {
                      reviewThreads: {
                        totalCount: unresolvedReviewThreadCount,
                        nodes: Array.from({ length: unresolvedReviewThreadCount }, (_, index) => ({
                          id: `thread-${index}`,
                          isResolved: false,
                          viewerCanResolve: options.viewerCanResolve ?? true,
                        })),
                        pageInfo: { hasNextPage: options.reviewThreadsHasNextPage ?? false },
                      },
                    },
                  },
          },
        }),
      );
    }
    if (key === "git config --get remote.origin.url") return success(`${origin}\n`);
    if (key === "git ls-remote origin HEAD") return success(`${sha}\tHEAD\n`);
    if (key.startsWith("git ls-remote --heads origin refs/heads/")) {
      refReadCount += 1;
      return success(refReadCount === 2 && options.afterRefPresent ? `${sha}\trefs/heads/probe\n` : "");
    }
    if (key.startsWith("git -c core.hooksPath=/dev/null push --dry-run origin HEAD:refs/heads/")) {
      return { status: options.dryRunStatus ?? 0, stdout: "", stderr: "" };
    }
    return { status: 1, stdout: "", stderr: `unexpected fixture command: ${key}` };
  };
}

describe("GitHub shell control-plane acceptance", () => {
  it("verifies every read and non-mutating write capability", () => {
    expect(githubShellAccess(fixtureRun())).toEqual({
      ok: true,
      outcome: "GH_SHELL_ACCESS_READY",
      identity: "BigSimmo",
      permission: "write",
      repository,
      sampledPullRequest: 123,
      unresolvedReviewThreads: 0,
      reviewThreadMutations: "available",
      actionsRerun: "capability-verified",
      featureBranchPush: "dry-run-verified",
    });
  });

  it.each([
    [{ identity: "wrong-user" }, "GH_IDENTITY_MISMATCH"],
    [{ scopes: "repo" }, "GH_REQUIRED_SCOPES_MISSING"],
    [{ permission: "read" }, "GH_REPO_WRITE_MISSING"],
    [{ actionsEnabled: false }, "GH_ACTIONS_ACCESS_MISSING"],
    [{ actionRunsAvailable: false }, "GH_ACTIONS_LOG_SAMPLE_MISSING"],
    [{ actionJobsAvailable: false }, "GH_ACTIONS_JOBS_ACCESS_MISSING"],
    [{ actionJobConclusion: "skipped" }, "GH_ACTIONS_LOG_SAMPLE_MISSING"],
    [{ actionLogsStatus: 1 }, "GH_ACTIONS_LOG_ACCESS_MISSING"],
    [{ mutations: ["resolveReviewThread"] }, "GH_REVIEW_THREAD_MUTATIONS_UNAVAILABLE"],
    [{ reviewThreadsAvailable: false }, "GH_REVIEW_THREAD_READ_MISSING"],
    [{ unresolvedReviewThreadCount: 1, viewerCanResolve: false }, "GH_REVIEW_THREAD_RESOLVE_PERMISSION_MISSING"],
    [{ reviewThreadsHasNextPage: true }, "GH_REVIEW_THREAD_SAMPLE_UNBOUNDED"],
    [
      {
        openPullRequestsAvailable: false,
        closedPullRequestsAvailable: false,
      },
      "GH_PR_SAMPLE_MISSING",
    ],
    [{ dryRunStatus: 1 }, "GH_FEATURE_BRANCH_PUSH_REJECTED"],
    [{ afterRefPresent: true }, "GH_DRY_RUN_REF_MUTATED"],
  ] satisfies Array<[FixtureOptions, string]>)("fails closed for %j", (options, expectedOutcome) => {
    expect(githubShellAccess(fixtureRun(options))).toEqual({ ok: false, outcome: expectedOutcome });
  });

  it("falls back to a closed PR when no open PR is available", () => {
    expect(githubShellAccess(fixtureRun({ openPullRequestsAvailable: false }))).toMatchObject({
      ok: true,
      outcome: "GH_SHELL_ACCESS_READY",
      sampledPullRequest: 123,
    });
  });

  it("keeps live provider calls behind an explicit opt-in", () => {
    const environment = { NODE_ENV: "test" } satisfies NodeJS.ProcessEnv;

    expect(providerAccessAuthorized(["node", "script.mjs"], environment)).toBe(false);
    expect(providerAccessAuthorized(["node", "script.mjs", "--allow-provider"], environment)).toBe(true);
    expect(
      providerAccessAuthorized(["node", "script.mjs"], {
        ...environment,
        ALLOW_GITHUB_SHELL_ACCESS: "true",
      }),
    ).toBe(true);
  });

  it("retries bounded transient failures but not authorization failures", () => {
    let transientAttempts = 0;
    const transient = runWithTransientRetry(
      () => {
        transientAttempts += 1;
        return transientAttempts < 3
          ? { status: 1, stdout: "", stderr: "HTTP 503" }
          : { status: 0, stdout: "ok", stderr: "" };
      },
      "gh",
      ["api", "user"],
    );
    expect(transient.status).toBe(0);
    expect(transientAttempts).toBe(3);

    let authorizationAttempts = 0;
    const authorization = runWithTransientRetry(
      () => {
        authorizationAttempts += 1;
        return { status: 1, stdout: "", stderr: "HTTP 403: Resource not accessible" };
      },
      "gh",
      ["api", "user"],
    );
    expect(authorization.status).toBe(1);
    expect(authorizationAttempts).toBe(1);
  });

  it("bounds a stalled provider subprocess", () => {
    const result = shellRun(process.execPath, ["-e", "setTimeout(() => {}, 250)"], process.cwd(), 25);

    expect(result.status).not.toBe(0);
    expect(result.error?.message).toMatch(/ETIMEDOUT|timed out|timeout/iu);
  });
});
