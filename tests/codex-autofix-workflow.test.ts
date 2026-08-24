import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guardPath = path.join(repoRoot, "scripts", "check-codex-autofix-workflow.mjs");
const workflowPath = path.join(repoRoot, ".github", "workflows", "codex-autofix-review-comments.yml");
const originalWorkflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
const removedRepairSecret = ["CODEX", "TRIGGER", "TOKEN"].join("_");

type Actor = {
  login: string;
  type: string;
};

type Comment = {
  body: string | null;
  id?: number;
  in_reply_to_id?: number;
  user?: Actor;
};

type GraphqlCall = {
  query: string;
  variables: Record<string, unknown>;
};

type ScriptFunction = (
  github: Record<string, unknown>,
  context: Record<string, unknown>,
  core: {
    notice: (message: string) => void;
    setFailed: (message: string) => void;
    warning: (message: string) => void;
  },
) => Promise<void>;

const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
  ...args: string[]
) => ScriptFunction;

function extractWorkflowScripts(workflow: string) {
  const scriptMarker = "          script: |\n";
  const scripts: string[] = [];
  let searchFrom = 0;

  while (true) {
    const scriptStart = workflow.indexOf(scriptMarker, searchFrom);
    if (scriptStart === -1) break;

    const scriptLines = workflow.slice(scriptStart + scriptMarker.length).split("\n");
    const extractedLines: string[] = [];
    for (const line of scriptLines) {
      if (line.length === 0) {
        extractedLines.push("");
        continue;
      }
      if (!line.startsWith("            ")) break;
      extractedLines.push(line.slice(12));
    }

    scripts.push(extractedLines.join("\n"));
    searchFrom = scriptStart + scriptMarker.length;
  }

  return scripts;
}

const workflowScripts = extractWorkflowScripts(originalWorkflow);
if (workflowScripts.length !== 1 || !workflowScripts[0]) {
  throw new Error("Expected exactly one github-script block for trusted thread resolution.");
}
const threadScript = new AsyncFunction("github", "context", "core", workflowScripts[0]);

function matchingThreadResults({
  headRefOid = "head-sha-4",
  isResolved = false,
  state = "OPEN",
}: { headRefOid?: string; isResolved?: boolean; state?: string } = {}) {
  return [
    {
      repository: {
        pullRequest: {
          headRefOid,
          state,
          reviewThreads: {
            nodes: [
              {
                comments: {
                  nodes: [{ databaseId: 41 }, { databaseId: 99 }],
                  pageInfo: { endCursor: null, hasNextPage: false },
                },
                id: "thread-1",
                isResolved,
              },
            ],
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        },
      },
    },
    { repository: { pullRequest: { headRefOid, state } } },
    { resolveReviewThread: { thread: { id: "thread-1", isResolved: true } } },
    {
      node: { id: "thread-1", isResolved: true },
      repository: { pullRequest: { headRefOid, state } },
    },
  ];
}

async function runThreadScript(options?: {
  comment?: Partial<Comment>;
  graphqlError?: unknown;
  graphqlResults?: unknown[];
  pullRequestHeadSha?: string;
}) {
  const failures: string[] = [];
  const graphqlCalls: GraphqlCall[] = [];
  const notices: string[] = [];
  const warnings: string[] = [];
  const comment: Comment = {
    body: "<!-- codex-thread-disposition:resolved -->\n<!-- codex-thread-result:no-change -->\n\nDispositioned.",
    id: 99,
    in_reply_to_id: 41,
    user: { login: "chatgpt-codex-connector[bot]", type: "Bot" },
    ...options?.comment,
  };

  const github = {
    graphql: async (query: string, variables: Record<string, unknown>) => {
      graphqlCalls.push({ query, variables });
      if (options?.graphqlError !== undefined) throw options.graphqlError;
      const result = options?.graphqlResults?.[graphqlCalls.length - 1] ?? {};
      if (result instanceof Error) throw result;
      return result;
    },
  };

  await threadScript(
    github,
    {
      payload: {
        comment,
        pull_request: { head: { sha: options?.pullRequestHeadSha ?? "head-sha-4" }, number: 42, state: "open" },
      },
      repo: { owner: "clinical-kb", repo: "database" },
    },
    {
      notice: (message) => notices.push(message),
      setFailed: (message) => failures.push(message),
      warning: (message) => warnings.push(message),
    },
  );

  return { failures, graphqlCalls, notices, warnings };
}

function runGuard(workflow: string) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "codex-thread-resolution-"));
  const tempWorkflowPath = path.join(tempDir, "workflow.yml");

  try {
    writeFileSync(tempWorkflowPath, workflow, "utf8");
    const result = spawnSync(process.execPath, [guardPath, tempWorkflowPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    return { output: `${result.stdout}${result.stderr}`, status: result.status };
  } finally {
    rmSync(tempDir, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
  }
}

describe("Codex thread-resolution workflow guard", () => {
  it("accepts the hardened resolution-only workflow", () => {
    const result = runGuard(originalWorkflow);

    expect(result.status).toBe(0);
    expect(result.output).toContain("Codex thread-resolution workflow guard passed.");
  });

  it("keeps repair invocation human-authored", () => {
    expect(originalWorkflow).not.toContain(removedRepairSecret);
    expect(originalWorkflow).not.toContain("@codex");
    expect(originalWorkflow).not.toContain("request-codex-autoresolve:");
    expect(originalWorkflow).not.toContain("  pull_request_review:\n");
    expect(originalWorkflow).not.toContain("  issue_comment:\n");
    expect(originalWorkflow).not.toContain("createComment");
    expect(originalWorkflow).not.toContain("routeReasons");
    expect(workflowScripts).toHaveLength(1);
  });

  it("rejects the removed repair secret", () => {
    const workflow = originalWorkflow.replace(
      "    steps:\n",
      `    env:\n      ${removedRepairSecret}: secret\n    steps:\n`,
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("removed repair-trigger secret");
  });

  it("rejects a workflow-authored Codex repair command", () => {
    const workflow = originalWorkflow.replace("    steps:\n", "    steps:\n      # @codex fix\n");
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("repair invocation is human-authored");
  });

  it("rejects submitted-review and issue-comment triggers", () => {
    for (const trigger of [
      "  pull_request_review:\n    types: [submitted]\n",
      "  issue_comment:\n    types: [created]\n",
    ]) {
      const workflow = originalWorkflow.replace(
        "  pull_request_review_comment:\n",
        `${trigger}  pull_request_review_comment:\n`,
      );
      const result = runGuard(workflow);

      expect(result.status).toBe(1);
      expect(result.output).toMatch(/must not trigger|not an authorized/);
    }
  });

  it("rejects automatic request and risk-routing logic", () => {
    for (const injected of ["const routeReasons = [];", "await github.rest.issues.createComment({});"]) {
      const workflow = originalWorkflow.replace(
        "            const pr =",
        `            ${injected}\n            const pr =`,
      );
      const result = runGuard(workflow);

      expect(result.status).toBe(1);
    }
  });

  it("rejects substring-based connector authorization", () => {
    const workflow = originalWorkflow.replace(
      `      github.event.comment.user.type == 'Bot' &&
      (github.event.comment.user.login == 'chatgpt-codex-connector' ||
      github.event.comment.user.login == 'chatgpt-codex-connector[bot]')`,
      "      contains(github.event.comment.user.login, 'chatgpt-codex-connector')",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("substring login match");
  });

  it("rejects a mutable action tag", () => {
    const workflow = originalWorkflow.replace(
      "uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0",
      "uses: actions/github-script@v9",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("mutable github-script tag");
  });

  it("rejects excessive or insufficient permissions", () => {
    for (const workflow of [
      originalWorkflow.replace("      pull-requests: write\n", "      pull-requests: read\n"),
      originalWorkflow.replace("  contents: read\n", "  contents: write\n"),
    ]) {
      const result = runGuard(workflow);
      expect(result.status).toBe(1);
    }
  });

  it("rejects an unrelated job write permission", () => {
    const workflow = originalWorkflow.replace(
      "      pull-requests: write\n",
      "      pull-requests: write\n      issues: write\n",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("effective permission allowlist");
  });

  it("rejects an extra job even when its scalar permission is syntactically valid YAML", () => {
    const workflow = `${originalWorkflow}\n  unrelated-write:\n    runs-on: ubuntu-24.04\n    permissions: write-all\n    steps: []\n`;
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("exact job set");
  });

  it("rejects an explicit unrelated-write key carrying write-all permissions", () => {
    const workflow = originalWorkflow.replace(
      "jobs:\n",
      "jobs:\n  ? unrelated-write\n  :\n    runs-on: ubuntu-24.04\n    permissions: write-all\n    steps: []\n",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("unsupported explicit YAML mapping key");
  });

  it("rejects quoted trigger, job, and permission mapping keys instead of ignoring them", () => {
    const adversaries = [
      originalWorkflow.replace("  pull_request_review_comment:\n", '  "pull_request_review_comment":\n'),
      `${originalWorkflow}\n  "unrelated-write":\n    runs-on: ubuntu-24.04\n    permissions: write-all\n    steps: []\n`,
      originalWorkflow.replace("      pull-requests: write\n", '      "pull-requests": write\n'),
    ];

    for (const workflow of adversaries) {
      const result = runGuard(workflow);
      expect(result.status).toBe(1);
      expect(result.output).toContain("unsupported quoted mapping key");
    }
  });

  it("rejects duplicate YAML mapping keys", () => {
    const workflow = originalWorkflow.replace(
      "  pull_request_review_comment:\n    types: [created]\n",
      "  pull_request_review_comment:\n    types: [created]\n  pull_request_review_comment:\n    types: [created]\n",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("duplicate YAML mapping key");
  });

  it("rejects YAML anchors, aliases, and merge keys", () => {
    const adversaries = [
      originalWorkflow.replace(
        "permissions:\n  contents: read\n",
        "permissions: &workflowPermissions\n  contents: read\n",
      ),
      originalWorkflow.replace(
        "    permissions:\n      contents: read\n      pull-requests: write\n",
        "    permissions: *workflowPermissions\n",
      ),
      originalWorkflow.replace("      contents: read\n", "      <<: *workflowPermissions\n      contents: read\n"),
    ];

    for (const workflow of adversaries) {
      const result = runGuard(workflow);
      expect(result.status).toBe(1);
      expect(result.output).toContain("anchors, aliases, and merge keys");
    }
  });

  it("rejects scalar write-all permissions on the resolution job", () => {
    const workflow = originalWorkflow.replace(
      "    permissions:\n      contents: read\n      pull-requests: write\n",
      "    permissions: write-all\n",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("effective permission allowlist");
  });

  it("rejects the lossy single-PR concurrency group", () => {
    const workflow = originalWorkflow.replace(
      "group: codex-thread-resolution-${{ github.event.pull_request.number }}-${{ github.event.comment.in_reply_to_id || github.event.comment.id }}",
      "group: codex-thread-resolution-${{ github.event.pull_request.number }}",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("PR-namespaced parent-thread concurrency group");
  });

  it("rejects a run-id key that prevents parent-thread serialization", () => {
    const workflow = originalWorkflow.replace(
      "group: codex-thread-resolution-${{ github.event.pull_request.number }}-${{ github.event.comment.in_reply_to_id || github.event.comment.id }}",
      "group: codex-thread-resolution-${{ github.event.pull_request.number }}-${{ github.run_id }}",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("PR-namespaced parent-thread concurrency group");
  });

  it("rejects a prefix-only disposition-marker check", () => {
    const workflow = originalWorkflow.replace(
      "dispositionLine !== resolvedDispositionMarker",
      "!dispositionLine.startsWith(resolvedDispositionMarker)",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("exact first marker line");
  });

  it("rejects mapping a reply when only one relationship id is present", () => {
    const workflow = originalWorkflow.replaceAll(
      "targetCommentIds.every((commentId) => threadCommentIds.has(commentId))",
      "targetCommentIds.some((commentId) => threadCommentIds.has(commentId))",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("reply and parent relationship validation");
  });

  it("rejects silent success when GitHub does not confirm resolution", () => {
    const workflow = originalWorkflow.replace(
      "resolution.resolveReviewThread?.thread?.isResolved !== true",
      "resolution.resolveReviewThread?.thread?.isResolved === true",
    );
    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("resolution confirmation");
  });
});

describe("Codex thread-resolution script", () => {
  it.each([
    { login: "attacker-chatgpt-codex-connector", type: "Bot" },
    { login: "chatgpt-codex-connector[bot]", type: "User" },
  ])("rejects an untrusted review-comment author: $login / $type", async (user) => {
    const result = await runThreadScript({
      comment: { user },
    });

    expect(result.graphqlCalls).toHaveLength(0);
    expect(result.warnings).toContainEqual(expect.stringContaining("not the trusted Codex connector bot"));
  });

  it("skips a non-reply review comment", async () => {
    const result = await runThreadScript({ comment: { body: "P1: actionable finding", in_reply_to_id: undefined } });

    expect(result.graphqlCalls).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("human-authored"));
  });

  it.each([
    "Explanation first.\n<!-- codex-thread-disposition:resolved -->\n<!-- codex-thread-result:no-change -->",
    "<!-- codex-thread-disposition:resolved --> extra\n<!-- codex-thread-result:no-change -->",
  ])("ignores a reply without the exact disposition marker first line", async (body) => {
    const result = await runThreadScript({ comment: { body } });

    expect(result.graphqlCalls).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("exact trusted resolved disposition marker"));
  });

  it.each([
    " <!-- codex-thread-disposition:resolved -->\n<!-- codex-thread-result:no-change -->",
    "\n<!-- codex-thread-disposition:resolved -->\n<!-- codex-thread-result:no-change -->",
  ])("rejects a disposition marker preceded by whitespace", async (body) => {
    const result = await runThreadScript({ comment: { body } });

    expect(result.graphqlCalls).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("exact trusted resolved disposition marker"));
  });

  it("rejects a result marker outside the exact second line", async () => {
    const result = await runThreadScript({
      comment: {
        body: "<!-- codex-thread-disposition:resolved -->\nExplanation.\n<!-- codex-thread-result:no-change -->",
      },
    });

    expect(result.graphqlCalls).toHaveLength(0);
    expect(result.failures).toContainEqual(expect.stringContaining("exactly one result on the second line"));
  });

  it("rejects conflicting result markers", async () => {
    const result = await runThreadScript({
      comment: {
        body: `<!-- codex-thread-disposition:resolved -->\n<!-- codex-thread-result:no-change -->\n<!-- codex-thread-result:fixed-head:${"a".repeat(40)} -->`,
      },
    });

    expect(result.graphqlCalls).toHaveLength(0);
    expect(result.failures).toContainEqual(expect.stringContaining("exactly one result"));
  });

  it("leaves a fixed thread open when the reported commit is not the live pull request head", async () => {
    const liveHead = "b".repeat(40);
    const result = await runThreadScript({
      comment: {
        body: `<!-- codex-thread-disposition:resolved -->\n<!-- codex-thread-result:fixed-head:${"a".repeat(40)} -->`,
      },
      graphqlResults: matchingThreadResults({ headRefOid: liveHead }),
      pullRequestHeadSha: liveHead,
    });

    expect(result.graphqlCalls).toHaveLength(1);
    expect(result.failures).toContainEqual(expect.stringContaining("leaving the thread open"));
  });

  it("accepts a fixed result only when the reported commit is the current head", async () => {
    const head = "a".repeat(40);
    const result = await runThreadScript({
      comment: {
        body: `<!-- codex-thread-disposition:resolved -->\n<!-- codex-thread-result:fixed-head:${head} -->`,
      },
      graphqlResults: matchingThreadResults({ headRefOid: head }),
      pullRequestHeadSha: head,
    });

    expect(result.failures).toHaveLength(0);
    expect(result.graphqlCalls).toHaveLength(4);
  });

  it("leaves a fixed thread open when the live pull-request head changed after the event", async () => {
    const eventHead = "a".repeat(40);
    const liveHead = "b".repeat(40);
    const result = await runThreadScript({
      comment: {
        body: `<!-- codex-thread-disposition:resolved -->\n<!-- codex-thread-result:fixed-head:${eventHead} -->`,
      },
      graphqlResults: matchingThreadResults({ headRefOid: liveHead }),
      pullRequestHeadSha: eventHead,
    });

    expect(result.graphqlCalls).toHaveLength(1);
    expect(result.graphqlCalls[0]?.query).toContain("headRefOid");
    expect(result.graphqlCalls.some((call) => call.query.includes("mutation ResolveReviewThread"))).toBe(false);
    expect(result.failures).toContainEqual(expect.stringContaining("live pull request head"));
  });

  it("requires the reply and its parent to belong to the same review thread", async () => {
    const result = await runThreadScript({
      graphqlResults: [
        {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  { comments: { nodes: [{ databaseId: 41 }] }, id: "thread-parent", isResolved: false },
                  { comments: { nodes: [{ databaseId: 99 }] }, id: "thread-reply", isResolved: false },
                ],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          },
        },
      ],
    });

    expect(result.graphqlCalls).toHaveLength(1);
    expect(result.failures).toContainEqual(expect.stringContaining("validate the disposition reply relationship"));
  });

  it("resolves the exact related review thread", async () => {
    const result = await runThreadScript({ graphqlResults: matchingThreadResults() });

    expect(result.failures).toHaveLength(0);
    expect(result.graphqlCalls).toHaveLength(4);
    expect(result.graphqlCalls[1]?.query).toContain("query ResolutionPreflight");
    expect(result.graphqlCalls[2]?.query).toContain("resolveReviewThread");
    expect(result.graphqlCalls[2]?.variables).toEqual({ threadId: "thread-1" });
    expect(result.graphqlCalls[3]?.query).toContain("query ResolutionPostflight");
    expect(result.notices).toContainEqual(expect.stringContaining("Resolved the Codex review thread"));
  });

  it("walks paginated review threads before resolving", async () => {
    const [matchingThreads, preflight, resolution, postflight] = matchingThreadResults();
    const result = await runThreadScript({
      graphqlResults: [
        {
          repository: {
            pullRequest: {
              headRefOid: "head-sha-4",
              state: "OPEN",
              reviewThreads: {
                nodes: [],
                pageInfo: { endCursor: "next-page", hasNextPage: true },
              },
            },
          },
        },
        matchingThreads,
        preflight,
        resolution,
        postflight,
      ],
    });

    expect(result.failures).toHaveLength(0);
    expect(result.graphqlCalls).toHaveLength(5);
    expect(result.graphqlCalls[1]?.variables.cursor).toBe("next-page");
  });

  it("paginates comments within a candidate thread before mapping a reply beyond 100 comments", async () => {
    const [, preflight, resolution, postflight] = matchingThreadResults();
    const result = await runThreadScript({
      graphqlResults: [
        {
          repository: {
            pullRequest: {
              headRefOid: "head-sha-4",
              state: "OPEN",
              reviewThreads: {
                nodes: [
                  {
                    comments: {
                      nodes: [{ databaseId: 41 }],
                      pageInfo: { endCursor: "comment-page-2", hasNextPage: true },
                    },
                    id: "thread-1",
                    isResolved: false,
                  },
                ],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          },
        },
        {
          node: {
            comments: {
              nodes: [{ databaseId: 99 }],
              pageInfo: { endCursor: null, hasNextPage: false },
            },
            id: "thread-1",
            isResolved: false,
          },
        },
        preflight,
        resolution,
        postflight,
      ],
    });

    expect(result.failures).toHaveLength(0);
    expect(result.graphqlCalls).toHaveLength(5);
    expect(result.graphqlCalls[1]?.query).toContain("comments(first: 100, after: $commentsCursor)");
    expect(result.graphqlCalls[1]?.variables).toMatchObject({
      commentsCursor: "comment-page-2",
      threadId: "thread-1",
    });
  });

  it("does not resolve when the live head changes immediately before mutation", async () => {
    const initialHead = "a".repeat(40);
    const changedHead = "b".repeat(40);
    const [threads] = matchingThreadResults({ headRefOid: initialHead });
    const result = await runThreadScript({
      comment: {
        body: `<!-- codex-thread-disposition:resolved -->\n<!-- codex-thread-result:fixed-head:${initialHead} -->`,
      },
      graphqlResults: [threads, { repository: { pullRequest: { headRefOid: changedHead, state: "OPEN" } } }],
    });

    expect(result.graphqlCalls).toHaveLength(2);
    expect(result.graphqlCalls.some((call) => call.query.includes("mutation ResolveReviewThread"))).toBe(false);
    expect(result.failures).toContainEqual(expect.stringContaining("changed immediately before resolution"));
  });

  it("compensates when the live head changes after resolution", async () => {
    const initialHead = "a".repeat(40);
    const changedHead = "b".repeat(40);
    const [threads, preflight, resolution] = matchingThreadResults({ headRefOid: initialHead });
    const result = await runThreadScript({
      comment: {
        body: `<!-- codex-thread-disposition:resolved -->\n<!-- codex-thread-result:fixed-head:${initialHead} -->`,
      },
      graphqlResults: [
        threads,
        preflight,
        resolution,
        {
          node: { id: "thread-1", isResolved: true },
          repository: { pullRequest: { headRefOid: changedHead, state: "OPEN" } },
        },
        { unresolveReviewThread: { thread: { id: "thread-1", isResolved: false } } },
      ],
    });

    expect(result.graphqlCalls).toHaveLength(5);
    expect(result.graphqlCalls[4]?.query).toContain("unresolveReviewThread");
    expect(result.failures).toContainEqual(expect.stringContaining("changed during resolution"));
  });

  it("does not resolve a pull request that closes immediately before mutation", async () => {
    const [threads] = matchingThreadResults();
    const result = await runThreadScript({
      graphqlResults: [threads, { repository: { pullRequest: { headRefOid: "head-sha-4", state: "CLOSED" } } }],
    });

    expect(result.graphqlCalls).toHaveLength(2);
    expect(result.graphqlCalls.some((call) => call.query.includes("mutation ResolveReviewThread"))).toBe(false);
    expect(result.failures).toContainEqual(expect.stringContaining("no longer open"));
  });

  it("compensates when the pull request closes after resolution", async () => {
    const [threads, preflight, resolution] = matchingThreadResults();
    const result = await runThreadScript({
      graphqlResults: [
        threads,
        preflight,
        resolution,
        {
          node: { id: "thread-1", isResolved: true },
          repository: { pullRequest: { headRefOid: "head-sha-4", state: "CLOSED" } },
        },
        { unresolveReviewThread: { thread: { id: "thread-1", isResolved: false } } },
      ],
    });

    expect(result.graphqlCalls[4]?.query).toContain("unresolveReviewThread");
    expect(result.failures).toContainEqual(expect.stringContaining("changed during resolution"));
  });

  it.each([
    ["missing", null],
    ["unconfirmed", { id: "thread-1", isResolved: false }],
  ])("compensates when the post-resolution thread node is %s", async (_case, node) => {
    const [threads, preflight, resolution] = matchingThreadResults();
    const result = await runThreadScript({
      graphqlResults: [
        threads,
        preflight,
        resolution,
        { node, repository: { pullRequest: { headRefOid: "head-sha-4", state: "OPEN" } } },
        { unresolveReviewThread: { thread: { id: "thread-1", isResolved: false } } },
      ],
    });

    expect(result.graphqlCalls).toHaveLength(5);
    expect(result.graphqlCalls[4]?.query).toContain("unresolveReviewThread");
    expect(result.failures).toContainEqual(expect.stringContaining("Post-resolution validation"));
  });

  it("compensates when the post-resolution query fails after the mutation attempt", async () => {
    const [threads, preflight, resolution] = matchingThreadResults();
    const result = await runThreadScript({
      graphqlResults: [
        threads,
        preflight,
        resolution,
        new Error("postflight unavailable"),
        { unresolveReviewThread: { thread: { id: "thread-1", isResolved: false } } },
      ],
    });

    expect(result.graphqlCalls[4]?.query).toContain("unresolveReviewThread");
    expect(result.failures).toContainEqual(expect.stringContaining("postflight unavailable"));
  });

  it("does not mutate an already resolved thread", async () => {
    const result = await runThreadScript({ graphqlResults: matchingThreadResults({ isResolved: true }) });

    expect(result.failures).toHaveLength(0);
    expect(result.graphqlCalls).toHaveLength(1);
    expect(result.notices).toContainEqual(expect.stringContaining("already resolved"));
  });

  it("fails visibly when the disposition reply relationship cannot be validated", async () => {
    const result = await runThreadScript({
      graphqlResults: [
        {
          repository: {
            pullRequest: {
              reviewThreads: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } },
            },
          },
        },
      ],
    });

    expect(result.failures).toContainEqual(expect.stringContaining("validate the disposition reply relationship"));
  });

  it("fails visibly when GitHub does not confirm resolution", async () => {
    const [threads, preflight] = matchingThreadResults();
    const result = await runThreadScript({
      graphqlResults: [
        threads,
        preflight,
        { resolveReviewThread: { thread: { id: "thread-1", isResolved: false } } },
        { unresolveReviewThread: { thread: { id: "thread-1", isResolved: false } } },
      ],
    });

    expect(result.graphqlCalls[3]?.query).toContain("unresolveReviewThread");
    expect(result.failures).toContainEqual(expect.stringContaining("did not confirm"));
  });

  it("fails visibly when GitHub rejects direct review-thread resolution", async () => {
    const result = await runThreadScript({ graphqlError: new Error("permission denied") });

    expect(result.failures).toContainEqual(expect.stringContaining("permission denied"));
    expect(result.warnings).toContainEqual(expect.stringContaining("permission denied"));
  });
});
