import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guardPath = path.join(repoRoot, "scripts", "check-codex-autofix-workflow.mjs");
const workflowPath = path.join(repoRoot, ".github", "workflows", "codex-autofix-review-comments.yml");
const originalWorkflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");

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

type ExistingComment = {
  body: string | null;
  user?: Actor;
};

type ReviewComment = {
  id: number;
};

type Review = {
  id: number;
  state: string;
  user?: Actor;
};

type CreateCommentRequest = {
  body: string;
  issue_number: number;
  owner: string;
  repo: string;
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

// Sentinel functions passed to github.paginate so the mock can tell which list
// endpoint the workflow requested.
const listCommentsForReviewFn = () => undefined;
const listIssueCommentsFn = () => undefined;

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

const [requestScriptSource, threadScriptSource] = extractWorkflowScripts(originalWorkflow);
if (!requestScriptSource || !threadScriptSource) {
  throw new Error("Expected exactly two github-script blocks (request + thread resolution) in the workflow.");
}

const requestScript = new AsyncFunction("github", "context", "core", requestScriptSource);
const threadScript = new AsyncFunction("github", "context", "core", threadScriptSource);

async function runRequestScript(options?: {
  createError?: unknown;
  existingComments?: ExistingComment[];
  existingCommentsError?: unknown;
  getAuthenticatedError?: unknown;
  pullRequestHeadSha?: string;
  review?: Partial<Review>;
  reviewComments?: ReviewComment[];
  reviewCommentsError?: unknown;
  triggerLogin?: string;
}) {
  const createdComments: CreateCommentRequest[] = [];
  const failures: string[] = [];
  const notices: string[] = [];
  const warnings: string[] = [];
  let paginateCalls = 0;

  const review: Review = {
    id: 7,
    state: "commented",
    user: { login: "chatgpt-codex-connector[bot]", type: "Bot" },
    ...options?.review,
  };
  const reviewComments = options?.reviewComments ?? [{ id: 501 }];
  const triggerLogin = options?.triggerLogin ?? "codex-trigger-bot";

  const github = {
    paginate: async (fn: unknown) => {
      paginateCalls += 1;
      if (fn === listCommentsForReviewFn) {
        if (options?.reviewCommentsError !== undefined) throw options.reviewCommentsError;
        return reviewComments;
      }
      if (fn === listIssueCommentsFn) {
        if (options?.existingCommentsError !== undefined) throw options.existingCommentsError;
        return options?.existingComments ?? [];
      }
      throw new Error("Unexpected paginate target");
    },
    rest: {
      issues: {
        createComment: async (request: CreateCommentRequest) => {
          createdComments.push(request);
          if (options?.createError !== undefined) throw options.createError;
        },
        listComments: listIssueCommentsFn,
      },
      pulls: {
        listCommentsForReview: listCommentsForReviewFn,
      },
      users: {
        getAuthenticated: async () => {
          if (options?.getAuthenticatedError !== undefined) throw options.getAuthenticatedError;
          return { data: { login: triggerLogin } };
        },
      },
    },
  };

  await requestScript(
    github,
    {
      payload: {
        review,
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

  return { createdComments, failures, notices, paginateCalls, warnings };
}

async function runThreadScript(options?: {
  comment?: Partial<Comment>;
  graphqlError?: unknown;
  graphqlResults?: unknown[];
}) {
  const failures: string[] = [];
  const graphqlCalls: GraphqlCall[] = [];
  const notices: string[] = [];
  const warnings: string[] = [];

  const comment: Comment = {
    body: "<!-- codex-thread-disposition:resolved -->\n\nFixed.",
    id: 99,
    in_reply_to_id: 41,
    user: { login: "chatgpt-codex-connector[bot]", type: "Bot" },
    ...options?.comment,
  };

  const github = {
    graphql: async (query: string, variables: Record<string, unknown>) => {
      graphqlCalls.push({ query, variables });
      if (options?.graphqlError !== undefined) throw options.graphqlError;
      return options?.graphqlResults?.[graphqlCalls.length - 1] ?? {};
    },
  };

  await threadScript(
    github,
    {
      payload: {
        comment,
        pull_request: { head: { sha: "head-sha-4" }, number: 42, state: "open" },
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
  const tempDir = mkdtempSync(path.join(tmpdir(), "codex-autofix-"));
  const tempWorkflowPath = path.join(tempDir, "workflow.yml");

  try {
    writeFileSync(tempWorkflowPath, workflow, "utf8");
    const result = spawnSync(process.execPath, [guardPath, tempWorkflowPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

describe("Codex auto-resolve workflow guard", () => {
  it("accepts the hardened workflow", () => {
    const result = runGuard(originalWorkflow);

    expect(result.status).toBe(0);
    expect(result.output).toContain("Codex auto-resolve workflow guard passed.");
  });

  it("rejects an issue_comment trigger", () => {
    const workflow = originalWorkflow.replace(
      "  pull_request_review:\n    types: [submitted]\n",
      "  pull_request_review:\n    types: [submitted]\n  issue_comment:\n    types: [created]\n",
    );
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("issue_comment");
  });

  it("rejects removing the submitted-review trigger", () => {
    const workflow = originalWorkflow.replace("  pull_request_review:\n    types: [submitted]\n", "");
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("types: [submitted]");
  });

  it("rejects substring-based connector authorization", () => {
    const workflow = originalWorkflow.replace(
      `      github.event.comment.user.type == 'Bot' &&
      (github.event.comment.user.login == 'chatgpt-codex-connector' ||
      github.event.comment.user.login == 'chatgpt-codex-connector[bot]')`,
      "      contains(github.event.comment.user.login, 'chatgpt-codex-connector')",
    );
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("substring comment-login match");
  });

  it("rejects a bot-authored trigger token", () => {
    const workflow = originalWorkflow.replace(
      "          github-token: ${{ secrets.CODEX_TRIGGER_TOKEN }}",
      "          github-token: ${{ github.token }}",
    );
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("secrets.CODEX_TRIGGER_TOKEN");
  });

  it("rejects dropping the completed-review findings gate", () => {
    const workflow = originalWorkflow.replace(
      `            if (reviewComments.length === 0) {`,
      `            if (false) {`,
    );
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("completed-review findings gate");
  });

  it("rejects duplicate markers trusted from arbitrary commenters", () => {
    const workflow = originalWorkflow.replace(
      `            const trustedExistingRequests = existingComments.filter(
              (comment) =>
                comment.user?.login === triggerLogin &&
                (comment.body || "").trimStart().startsWith("<!-- codex-autoresolve"),
            );`,
      `            const trustedExistingRequests = existingComments;`,
    );
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("missing trusted duplicate-marker check");
  });

  it("rejects workflow-level concurrency that includes unrelated events", () => {
    const workflow = originalWorkflow.replace(
      `    concurrency:
      group: codex-autoresolve-\${{ github.event.pull_request.number }}
      cancel-in-progress: false`,
      `concurrency:
  group: codex-autoresolve-\${{ github.event.pull_request.number }}
  cancel-in-progress: false`,
    );
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("whole workflow");
  });

  it("rejects a mutable github-script major tag", () => {
    const workflow = originalWorkflow.replace(
      "uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0",
      "uses: actions/github-script@v9",
    );
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("mutable github-script tag");
  });

  it("rejects workflows without pull-request write permission for thread closure", () => {
    const workflow = originalWorkflow.replace("      pull-requests: write\n", "      pull-requests: read\n");
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("pull-requests: write");
  });
});

describe("Codex auto-resolve request script", () => {
  it("rejects an untrusted look-alike review author before calling GitHub", async () => {
    const result = await runRequestScript({
      review: { user: { login: "attacker-chatgpt-codex-connector", type: "User" } },
    });

    expect(result.paginateCalls).toBe(0);
    expect(result.createdComments).toHaveLength(0);
    expect(result.warnings).toContainEqual(expect.stringContaining("not the trusted Codex connector bot"));
  });

  it("skips an approved review with no findings", async () => {
    const result = await runRequestScript({ review: { state: "approved" } });

    expect(result.paginateCalls).toBe(0);
    expect(result.createdComments).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("no actionable findings"));
  });

  it("skips a completed review that left no inline findings", async () => {
    const result = await runRequestScript({ reviewComments: [] });

    expect(result.createdComments).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("no inline findings"));
  });

  it("ignores a deduplication marker posted by an untrusted commenter", async () => {
    const result = await runRequestScript({
      existingComments: [
        {
          body: "<!-- codex-autoresolve-pr:42 -->",
          user: { login: "attacker", type: "User" },
        },
      ],
    });

    expect(result.createdComments).toHaveLength(1);
    expect(result.createdComments[0]?.body).toContain("<!-- codex-autoresolve-pr:42 -->");
  });

  it("honors a deduplication marker posted by the trigger-token account", async () => {
    const result = await runRequestScript({
      triggerLogin: "codex-trigger-bot",
      existingComments: [
        {
          body: "<!-- codex-autoresolve-pr:42 -->",
          user: { login: "codex-trigger-bot", type: "Bot" },
        },
      ],
    });

    expect(result.createdComments).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("Skipping duplicate"));
  });

  it("stops automatic repair after one trusted request for another head", async () => {
    const result = await runRequestScript({
      triggerLogin: "codex-trigger-bot",
      existingComments: [
        {
          body: "<!-- codex-autoresolve:legacy-head-sha -->",
          user: { login: "codex-trigger-bot", type: "Bot" },
        },
      ],
    });

    expect(result.createdComments).toHaveLength(0);
    expect(result.warnings).toContainEqual(expect.stringContaining("single automatic repair pass"));
  });

  it("emits a single-pass prompt with the thread disposition marker", async () => {
    const result = await runRequestScript();

    expect(result.createdComments).toHaveLength(1);
    expect(result.createdComments[0]?.body).toContain("single automatic repair pass");
    expect(result.createdComments[0]?.body).toContain("<!-- codex-thread-disposition:resolved -->");
    expect(result.createdComments[0]?.body).toContain("do not perform a fresh review");
  });

  it("fails visibly when it cannot identify the trigger-token account", async () => {
    const result = await runRequestScript({ getAuthenticatedError: new Error("no user") });

    expect(result.createdComments).toHaveLength(0);
    expect(result.failures).toContainEqual(expect.stringContaining("could not identify the trigger token's account"));
  });

  it("fails visibly on a permission failure while listing review comments", async () => {
    const result = await runRequestScript({ reviewCommentsError: { status: 403 } });

    expect(result.createdComments).toHaveLength(0);
    expect(result.failures).toContainEqual(expect.stringContaining("cannot read review comments"));
  });

  it("fails visibly on a permission failure while listing issue comments", async () => {
    const result = await runRequestScript({ existingCommentsError: { status: 403 } });

    expect(result.createdComments).toHaveLength(0);
    expect(result.failures).toContainEqual(expect.stringContaining("denied permission to list issue comments"));
    expect(result.warnings).toContainEqual(expect.stringContaining("denied permission to list issue comments"));
  });

  it("fails visibly on a permission failure while creating the request", async () => {
    const result = await runRequestScript({ createError: { status: 403 } });

    expect(result.createdComments).toHaveLength(1);
    expect(result.failures).toContainEqual(expect.stringContaining("cannot comment on the pull request"));
    expect(result.warnings).toContainEqual(expect.stringContaining("cannot comment on the pull request"));
  });

  it("rethrows unexpected failures while listing issue comments", async () => {
    await expect(runRequestScript({ existingCommentsError: { status: 500 } })).rejects.toEqual({ status: 500 });
  });
});

describe("Codex auto-resolve thread-resolution script", () => {
  it("rejects an untrusted look-alike review-comment author", async () => {
    const result = await runThreadScript({
      comment: { user: { login: "attacker-chatgpt-codex-connector", type: "User" } },
    });

    expect(result.graphqlCalls).toHaveLength(0);
    expect(result.warnings).toContainEqual(expect.stringContaining("not the trusted Codex connector bot"));
  });

  it("skips a non-reply review comment", async () => {
    const result = await runThreadScript({
      comment: { body: "P1: actionable finding", in_reply_to_id: undefined },
    });

    expect(result.graphqlCalls).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("driven by the submitted review"));
  });

  it("ignores a reply without the resolved disposition marker", async () => {
    const result = await runThreadScript({
      comment: { body: "Fixed in the latest commit." },
    });

    expect(result.graphqlCalls).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("without the trusted resolved disposition marker"));
  });

  it("resolves the exact review thread after a trusted disposition reply", async () => {
    const result = await runThreadScript({
      graphqlResults: [
        {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    comments: { nodes: [{ databaseId: 41 }, { databaseId: 99 }] },
                    id: "thread-1",
                    isResolved: false,
                  },
                ],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          },
        },
        { resolveReviewThread: { thread: { id: "thread-1", isResolved: true } } },
      ],
    });

    expect(result.graphqlCalls).toHaveLength(2);
    expect(result.graphqlCalls[1]?.query).toContain("resolveReviewThread");
    expect(result.graphqlCalls[1]?.variables).toEqual({ threadId: "thread-1" });
    expect(result.notices).toContainEqual(expect.stringContaining("Resolved the Codex review thread"));
  });

  it("fails visibly when a disposition reply cannot be mapped to a review thread", async () => {
    const result = await runThreadScript({
      graphqlResults: [
        {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          },
        },
      ],
    });

    expect(result.failures).toContainEqual(expect.stringContaining("could not find the review thread"));
  });

  it("fails visibly when GitHub rejects direct review-thread resolution", async () => {
    const result = await runThreadScript({ graphqlError: new Error("permission denied") });

    expect(result.failures).toContainEqual(expect.stringContaining("permission denied"));
    expect(result.warnings).toContainEqual(expect.stringContaining("permission denied"));
  });
});
