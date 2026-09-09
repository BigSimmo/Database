import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/codex-run-pr-operator.yml", import.meta.url), "utf8");

function job(name: string, nextName?: string) {
  const start = workflow.indexOf(`  ${name}:`);
  expect(start).toBeGreaterThan(-1);
  const end = nextName ? workflow.indexOf(`  ${nextName}:`, start + name.length + 3) : workflow.length;
  expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

function extractWorkflowScripts(source: string) {
  const marker = "          script: |\n";
  const scripts: string[] = [];
  let searchFrom = 0;
  while (true) {
    const start = source.indexOf(marker, searchFrom);
    if (start === -1) break;
    const extracted: string[] = [];
    for (const line of source.slice(start + marker.length).split("\n")) {
      if (line === "") {
        extracted.push("");
      } else if (line.startsWith("            ")) {
        extracted.push(line.slice(12));
      } else {
        break;
      }
    }
    scripts.push(extracted.join("\n"));
    searchFrom = start + marker.length;
  }
  return scripts;
}

const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
  ...args: string[]
) => (...values: unknown[]) => Promise<void>;
const workflowScripts = extractWorkflowScripts(workflow);
const mutateScriptSource = workflowScripts.at(-1);
if (!mutateScriptSource) throw new Error("Expected a github-script mutation block in the workflow.");
const mutateScript = new AsyncFunction("github", "context", "core", "process", "require", mutateScriptSource);

type Disposition = {
  action: "leave_open" | "resolve_fixed" | "resolve_no_change";
  reply: string;
  thread_id: string;
};

async function runMutationScript(options?: {
  changedThreadId?: string;
  dispositions?: Disposition[];
  rerun?: boolean;
  summary?: string;
}) {
  const expectedHead = "1".repeat(40);
  const threads = [
    { id: "THREAD_1", root_comment_id: 101, latest_comment_id: 111, comment_count: 1 },
    { id: "THREAD_2", root_comment_id: 202, latest_comment_id: 222, comment_count: 1 },
  ];
  const contextData = {
    failed_workflow_runs: options?.rerun
      ? [{ head_sha: expectedHead, id: 999, name: "CI", conclusion: "failure" }]
      : [],
    unresolved_review_threads: threads,
  };
  const result = {
    checks: [],
    rerun_failed_run_ids: options?.rerun ? [999] : [],
    summary: options?.summary ?? "Completed the bounded repair.",
    thread_dispositions:
      options?.dispositions ??
      threads.map((thread) => ({
        action: "resolve_no_change" as const,
        reply: "Dispositioned after verification.",
        thread_id: thread.id,
      })),
  };
  const contextBytes = Buffer.from(`${JSON.stringify(contextData)}\n`);
  const resultBytes = Buffer.from(`${JSON.stringify(result)}\n`);
  const failures: string[] = [];
  const requests: Array<{ route: string; values: Record<string, unknown> }> = [];
  const comments: string[] = [];
  let workflowRunReads = 0;

  const github = {
    graphql: async (query: string, variables: { threadId: string }) => {
      if (query.includes("query CurrentThread")) {
        const thread = threads.find((candidate) => candidate.id === variables.threadId)!;
        const changed = options?.changedThreadId === thread.id;
        return {
          node: {
            comments: {
              nodes: [{ databaseId: thread.latest_comment_id }],
              totalCount: changed ? thread.comment_count + 1 : thread.comment_count,
            },
            id: thread.id,
            isResolved: false,
          },
        };
      }
      if (query.includes("mutation ResolveThread")) {
        return { resolveReviewThread: { thread: { id: variables.threadId, isResolved: true } } };
      }
      throw new Error("Unexpected GraphQL operation");
    },
    request: async (route: string, values: Record<string, unknown>) => {
      requests.push({ route, values });
      return { data: {} };
    },
    rest: {
      actions: {
        getWorkflowRun: async () => {
          workflowRunReads += 1;
          return {
            data: {
              conclusion: workflowRunReads < 3 ? "failure" : null,
              head_sha: expectedHead,
              run_attempt: workflowRunReads < 3 ? 1 : 2,
              status: workflowRunReads < 3 ? "completed" : "queued",
            },
          };
        },
      },
      issues: {
        createComment: async ({ body }: { body: string }) => comments.push(body),
      },
      pulls: {
        get: async () => ({ data: { head: { sha: expectedHead }, state: "open" } }),
      },
      users: {
        getAuthenticated: async () => ({ data: { login: "BigSimmo", type: "User" } }),
      },
    },
  };
  const fakeRequire = (moduleName: string) => {
    if (moduleName === "node:crypto") return { createHash };
    if (moduleName === "node:fs") {
      return {
        readFileSync: (file: string, encoding?: string) => {
          const bytes = file.endsWith("context.json") ? contextBytes : resultBytes;
          return encoding ? bytes.toString(encoding as BufferEncoding) : bytes;
        },
      };
    }
    throw new Error(`Unexpected require: ${moduleName}`);
  };

  await mutateScript(
    github,
    { repo: { owner: "BigSimmo", repo: "Database" }, runId: 123, serverUrl: "https://github.com" },
    { setFailed: (message: string) => failures.push(message) },
    {
      env: {
        CHANGED: "false",
        CONTEXT_SHA256: createHash("sha256").update(contextBytes).digest("hex"),
        EXPECTED_HEAD: expectedHead,
        PR_NUMBER: "42",
        PUBLISHED_SHA: expectedHead,
      },
    },
    fakeRequire,
  );

  return { comments, failures, requests };
}

describe("Codex Run PR operator workflow", () => {
  const prepare = job("prepare", "repair");
  const repair = job("repair", "publish");
  const publish = job("publish", "mutate");
  const mutate = job("mutate");

  it("requires a deliberate human dispatch tied to an authorizing Codex task", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("issue_comment:");
    expect(prepare).toContain('test "$DISPATCH_ACTOR" = "BigSimmo"');
    expect(prepare).toContain("I authorized this PR in the linked Codex task");
    expect(prepare).toContain("taskUrlPattern");
    expect(prepare).toContain("pr.head.repo?.full_name !== `${owner}/${repo}`");
    expect(prepare).toContain("protectedBranch");
    expect(prepare).toContain('"skip-codex-review"');
    expect(prepare).toContain('pr.state !== "open" || pr.merged');
    expect(prepare).toContain("ref: `heads/${pr.base.ref}`");
    expect(prepare).toContain("const baseSha = currentBaseRef.object.sha");
    expect(prepare).toContain("const { data: revalidatedPr } = await github.rest.pulls.get");
    expect(prepare).toContain("revalidatedPr.base.ref !== pr.base.ref");
    expect(prepare).toContain("The PR changed while its live base ref was being resolved.");
    expect(prepare).toContain("basehead: `${pr.head.sha}...${baseSha}`");
    expect(prepare).toContain("base_sha: baseSha");
    expect(prepare).not.toContain("base_sha: pr.base.sha");
  });

  it("accepts genuine Codex task IDs without allowing URL suffix injection", () => {
    const patternSource = prepare.match(/const taskUrlPattern = \/(.+?)\/u;/u)?.[1];
    expect(patternSource).toBeDefined();
    const taskUrlPattern = new RegExp(patternSource!, "u");

    const taskUrl = "https://chatgpt.com/codex/cloud/tasks/task_e_6a7c91a549cc8322b0491687053bf902";
    expect(taskUrlPattern.test(taskUrl)).toBe(true);
    expect(taskUrlPattern.test(`${taskUrl}/`)).toBe(true);
    expect(taskUrlPattern.test(`${taskUrl}?redirect=https://example.com`)).toBe(false);
    expect(taskUrlPattern.test(`${taskUrl}#fragment`)).toBe(false);
  });

  it("collects the complete bounded Run PR control-plane evidence", () => {
    expect(prepare).toContain("open_pull_requests: openPullRequests");
    expect(prepare).toContain("unresolved_review_thread_count: unresolvedThreadCount");
    expect(prepare).toContain("reviews,");
    expect(prepare).toContain("issue_comments: issueComments");
    expect(prepare).toContain("required_checks: requiredChecks");
    expect(prepare).toContain("check_runs: checkRuns");
    expect(prepare).toContain("workflow_runs: workflowRuns");
    expect(prepare).toContain("bounded_log_tail: boundedLog");
    expect(prepare).toContain('if (run.conclusion !== "failure") continue;');
    expect(prepare).toContain("latest_comment_id: thread.latestComment.nodes[0]?.databaseId");
    expect(prepare).toContain("comment_count: thread.comments.totalCount");
  });

  it("keeps GitHub credentials out of the unprivileged Codex repair job", () => {
    expect(repair).toContain("openai/codex-action@86365089eb2b84e0a8fb0717b304f8bdcb13b20e # v1");
    expect(repair).toContain("safety-strategy: unprivileged-user");
    expect(repair).toContain("persist-credentials: false");
    expect(repair).toContain("npm ci --ignore-scripts");
    expect(repair).toContain('git show "$BASE_SHA:.github/codex/prompts/run-pr-operator.md"');
    expect(repair).toContain("${{ runner.temp }}/codex-run-pr-trusted/prompt.md");
    expect(repair).toContain("CONTEXT_SHA256: ${{ needs.prepare.outputs.context_sha256 }}");
    expect(repair).toContain("! -name .git");
    expect(repair).toContain("sudo usermod --append --groups runner codex-operator");
    expect(repair).toContain('sudo -u codex-operator git config --global --add safe.directory "$GITHUB_WORKSPACE"');
    expect(repair).toContain('sudo -u codex-operator test -r "$GITHUB_WORKSPACE/.git/HEAD"');
    expect(repair).toContain('sudo -u codex-operator test -w "$GITHUB_WORKSPACE/.codex-run-pr"');
    expect(repair).toContain('if sudo -u codex-operator test -w "$GITHUB_WORKSPACE/.git/HEAD"; then');
    expect(repair).toContain('sudo -u codex-operator git -C "$GITHUB_WORKSPACE" rev-parse --verify HEAD >/dev/null');
    expect(repair).toContain('"+$BASE_SHA:refs/remotes/codex-run-pr/base"');
    expect(repair).toContain("git rev-parse refs/remotes/codex-run-pr/base");
    expect(repair).not.toContain("The base branch advanced after evidence collection");
    expect(repair).toContain('git merge-tree --write-tree HEAD "$BASE_SHA"');
    expect(repair).toContain('git merge --no-edit "$BASE_SHA"');
    expect(repair).toContain("operator policy requires a human resolution");
    expect(repair).toContain('if [ -e "$RUNNER_TEMP/codex-run-pr-trusted" ]; then');
    expect(repair).not.toContain("secrets.GH_TOKEN");
    expect(repair).not.toContain("github-token:");
    expect(repair).not.toContain("./.github/actions/");
  });

  it("seals only bounded descendants and excludes policy or credential-bearing paths", () => {
    expect(repair).toContain('git merge-base --is-ancestor "$EXPECTED_HEAD" HEAD');
    expect(repair).toContain("OPERATOR_START_SHA=$operator_start_sha");
    expect(repair).toContain('git diff --name-only --no-renames -z "$OPERATOR_START_SHA"');
    expect(repair).toContain("mapfile -d '' -t changed_paths");
    expect(repair).toContain(".github/*|.codex/*|.claude/*|.agents/*");
    expect(repair).toContain("supabase/*|.env|.env.*");
    expect(repair).toContain(".npmrc|*/.npmrc");
    expect(repair).toContain('git diff --cached --raw "$OPERATOR_START_SHA"');
    expect(repair).toContain('git diff --cached --binary "$OPERATOR_START_SHA"');
    expect(repair).toContain("(120000|160000)");
    expect(repair).toContain("sha256sum .codex-run-pr/context.json");
    expect(repair).toContain('keys == ["checks", "rerun_failed_run_ids", "summary", "thread_dispositions"]');
    expect(repair).toContain("1048576");
    expect(repair).toContain("git bundle create");
  });

  it("publishes only an exact, race-free, ordinary feature-branch update as BigSimmo", () => {
    expect(publish).toContain("secrets.GH_TOKEN");
    expect(publish).toContain('test "$identity" = "BigSimmo"');
    expect(publish).toContain('test "$remote_head" = "$EXPECTED_HEAD"');
    expect(publish).toContain('gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/$HEAD_REF"');
    expect(publish).not.toContain("git ls-remote origin");
    expect(publish).toContain('git push origin "$RESULT_SHA:refs/heads/$HEAD_REF"');
    expect(publish).not.toMatch(/--force|--delete|push\s+origin\s+:(?:refs\/heads\/)?/u);
  });

  it("revalidates bounded review threads and failed runs before remote mutations", () => {
    expect(mutate).toContain("secrets.GH_TOKEN");
    expect(mutate).toContain("Duplicate review-thread disposition");
    expect(mutate).toContain("The bounded PR context changed after collection.");
    expect(mutate).toContain("allowedActions");
    expect(mutate).toContain("Review thread ${disposition.thread_id} changed after evidence collection.");
    expect(mutate).toContain("currentThread.node.comments.totalCount !== thread.comment_count");
    expect(mutate).toContain("currentThread.node.comments.nodes[0]?.databaseId !== thread.latest_comment_id");
    expect(mutate).toContain("const mutationPlan = []");
    expect(mutate.indexOf("mutationPlan.push")).toBeLessThan(mutate.indexOf("for (const plannedMutation"));
    expect(mutate).toContain('replaceAll("@", "@\\u200b")');
    expect(mutate).not.toContain("codex-thread-disposition");
    expect(mutate).not.toContain("codex-thread-result");
    expect(mutate).toContain("resolveReviewThread");
    expect(mutate).toContain("rerun-failed-jobs");
    expect(mutate).toContain('currentRun.conclusion !== "failure"');
    expect(mutate).toContain("runAfterRerun.run_attempt > rerunPlan.runAttempt");
    expect(mutate).not.toContain("pulls.merge");
    expect(mutate).not.toContain("pulls.update");
    expect(mutate).not.toContain("pulls.delete");
  });

  it("preflights every review thread before posting any reply", async () => {
    const result = await runMutationScript({ changedThreadId: "THREAD_2" });

    expect(result.failures).toEqual(["Review thread THREAD_2 changed after evidence collection."]);
    expect(result.requests).toEqual([]);
    expect(result.comments).toEqual([]);
  });

  it("neutralizes generated mentions and comment directives before posting", async () => {
    const result = await runMutationScript({
      dispositions: [
        {
          action: "resolve_no_change",
          reply: "Notify @codex and preserve <!-- untrusted-directive --> as text.",
          thread_id: "THREAD_1",
        },
      ],
      summary: "Notify @team and preserve <!-- untrusted-summary --> as text.",
    });

    expect(result.failures).toEqual([]);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]?.values.body).toContain("@\u200bcodex");
    expect(result.requests[0]?.values.body).toContain("<\u200b!-- untrusted-directive -->");
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]).toContain("@\u200bteam");
    expect(result.comments[0]).toContain("<\u200b!-- untrusted-summary -->");
  });

  it("reruns only a still-failed run and verifies a new observable attempt", async () => {
    const result = await runMutationScript({ dispositions: [], rerun: true });

    expect(result.failures).toEqual([]);
    expect(result.requests).toEqual([
      {
        route: "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs",
        values: { owner: "BigSimmo", repo: "Database", run_id: 999 },
      },
    ]);
    expect(result.comments[0]).toContain("Failed workflow reruns: 1");
  });
});
