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

type ReviewComment = {
  body: string | null;
  id: number;
  in_reply_to_id?: number;
  user?: Actor;
};

type ExistingComment = {
  body: string | null;
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

type WorkflowFunction = (
  github: {
    graphql: (query: string, variables: Record<string, unknown>) => Promise<unknown>;
    paginate: (...args: unknown[]) => Promise<ExistingComment[]>;
    rest: {
      issues: {
        createComment: (request: CreateCommentRequest) => Promise<void>;
        listComments: () => void;
      };
    };
  },
  context: {
    payload: {
      comment: ReviewComment;
      pull_request: { head: { sha: string }; number: number; state: string };
    };
    repo: { owner: string; repo: string };
  },
  core: {
    notice: (message: string) => void;
    setFailed: (message: string) => void;
    warning: (message: string) => void;
  },
) => Promise<void>;

const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
  ...args: string[]
) => WorkflowFunction;

function extractWorkflowScript(workflow: string) {
  const scriptMarker = "          script: |\n";
  const scriptStart = workflow.indexOf(scriptMarker);
  if (scriptStart === -1) throw new Error("Workflow script block was not found.");

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

  return extractedLines.join("\n");
}

const workflowFunction = new AsyncFunction("github", "context", "core", extractWorkflowScript(originalWorkflow));

async function runWorkflowScript(options?: {
  createError?: unknown;
  existingComments?: ExistingComment[];
  graphqlError?: unknown;
  graphqlResults?: unknown[];
  paginateError?: unknown;
  pullRequestHeadSha?: string;
  reviewComment?: Partial<ReviewComment>;
}) {
  const createdComments: CreateCommentRequest[] = [];
  const failures: string[] = [];
  const graphqlCalls: GraphqlCall[] = [];
  const notices: string[] = [];
  const warnings: string[] = [];
  let paginateCalls = 0;
  const reviewComment: ReviewComment = {
    body: "P1: actionable review finding",
    id: 99,
    user: { login: "chatgpt-codex-connector[bot]", type: "Bot" },
    ...options?.reviewComment,
  };

  await workflowFunction(
    {
      graphql: async (query, variables) => {
        graphqlCalls.push({ query, variables });
        if (options?.graphqlError !== undefined) throw options.graphqlError;
        return options?.graphqlResults?.[graphqlCalls.length - 1] ?? {};
      },
      paginate: async () => {
        paginateCalls += 1;
        if (options?.paginateError !== undefined) throw options.paginateError;
        return options?.existingComments ?? [];
      },
      rest: {
        issues: {
          createComment: async (request) => {
            createdComments.push(request);
            if (options?.createError !== undefined) throw options.createError;
          },
          listComments: () => undefined,
        },
      },
    },
    {
      payload: {
        comment: reviewComment,
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

  return { createdComments, failures, graphqlCalls, notices, paginateCalls, warnings };
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
    expect(result.output).toContain("substring login match");
  });

  it("rejects duplicate markers from arbitrary commenters", () => {
    const workflow = originalWorkflow.replace(
      `            const trustedExistingRequests = existingComments.filter(
              (comment) =>
                comment.user?.type === "Bot" &&
                comment.user.login === "github-actions[bot]" &&
                (comment.body || "").trimStart().startsWith("<!-- codex-autoresolve"),
            );`,
      `            const trustedExistingRequests = existingComments;`,
    );
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("missing trusted duplicate-marker check");
  });

  it("rejects workflow-level concurrency that includes unrelated comments", () => {
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
    expect(result.output).toContain("immutable github-script pin");
  });

  it("rejects workflows missing models read permission", () => {
    const workflow = originalWorkflow.replace("  models: read\n", "");
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("models: read");
  });

  it("rejects workflows without pull-request write permission for thread closure", () => {
    const workflow = originalWorkflow.replace("  pull-requests: write\n", "  pull-requests: read\n");
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("pull-requests: write");
  });

  it("allows findings to quote marker text without being mistaken for requests", () => {
    const workflow = originalWorkflow.replace(
      `            const sourceBody = (reviewComment.body || "").trimStart();
            const hasAutoResolveMarker =
              sourceBody.startsWith("<!-- codex-autoresolve:") ||
              sourceBody.startsWith("<!-- codex-autoresolve-pr:");
            if (hasAutoResolveMarker && sourceBody.includes(scopedResolveCommand)) {`,
      `            const sourceBody = reviewComment.body || "";
            if (
              sourceBody.includes("codex-autoresolve:") ||
              sourceBody.includes("codex-autoresolve-pr:")
            ) {`,
    );
    expect(workflow).not.toBe(originalWorkflow);

    const result = runGuard(workflow);

    expect(result.status).toBe(1);
    expect(result.output).toContain("marker mentioned anywhere");
  });
});

describe("Codex auto-resolve workflow script", () => {
  it("rejects an untrusted look-alike author before calling GitHub", async () => {
    const result = await runWorkflowScript({
      reviewComment: {
        user: { login: "attacker-chatgpt-codex-connector", type: "User" },
      },
    });

    expect(result.paginateCalls).toBe(0);
    expect(result.createdComments).toHaveLength(0);
    expect(result.warnings).toContainEqual(expect.stringContaining("not the trusted Codex connector bot"));
  });

  it("ignores a deduplication marker posted by an untrusted commenter", async () => {
    const result = await runWorkflowScript({
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

  it("honors a deduplication marker posted by GitHub Actions", async () => {
    const result = await runWorkflowScript({
      existingComments: [
        {
          body: "<!-- codex-autoresolve-pr:42 -->",
          user: { login: "github-actions[bot]", type: "Bot" },
        },
      ],
    });

    expect(result.createdComments).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("Skipping duplicate"));
  });

  it("does not create a follow-up repair pass when Codex reviews a new pull request head", async () => {
    const result = await runWorkflowScript({
      existingComments: [
        {
          body: "<!-- codex-autoresolve-pr:42 -->\n\n<!-- codex-autoresolve-head:head-sha-3 -->",
          user: { login: "github-actions[bot]", type: "Bot" },
        },
      ],
    });

    expect(result.createdComments).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("Skipping duplicate"));
  });

  it("stops automatic repair after one trusted legacy request", async () => {
    const result = await runWorkflowScript({
      existingComments: [
        {
          body: "<!-- codex-autoresolve:legacy-head-sha -->",
          user: { login: "github-actions[bot]", type: "Bot" },
        },
      ],
    });

    expect(result.createdComments).toHaveLength(0);
    expect(result.warnings).toContainEqual(expect.stringContaining("single automatic repair pass"));
  });

  it("emits a single-pass prompt with the thread disposition marker", async () => {
    const result = await runWorkflowScript();

    expect(result.createdComments).toHaveLength(1);
    expect(result.createdComments[0]?.body).toContain("single automatic repair pass");
    expect(result.createdComments[0]?.body).toContain("<!-- codex-thread-disposition:resolved -->");
    expect(result.createdComments[0]?.body).toContain("do not perform a fresh review");
  });

  it("does not skip a finding that merely quotes the marker and command", async () => {
    const result = await runWorkflowScript({
      reviewComment: {
        body: [
          "This finding quotes <!-- codex-autoresolve:head-sha-4 --> in the middle of a sentence.",
          "It also quotes @codex resolve actionable Codex review findings for this pull request and current head.",
        ].join(" "),
      },
    });

    expect(result.createdComments).toHaveLength(1);
  });

  it("ignores review-thread replies without the resolved disposition marker", async () => {
    const result = await runWorkflowScript({
      reviewComment: { body: "Fixed in the latest commit.", in_reply_to_id: 41 },
    });

    expect(result.graphqlCalls).toHaveLength(0);
    expect(result.createdComments).toHaveLength(0);
    expect(result.notices).toContainEqual(expect.stringContaining("without the trusted resolved disposition marker"));
  });

  it("resolves the exact review thread after a trusted disposition reply", async () => {
    const result = await runWorkflowScript({
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
      reviewComment: {
        body: "<!-- codex-thread-disposition:resolved -->\n\nFixed and verified.",
        in_reply_to_id: 41,
      },
    });

    expect(result.graphqlCalls).toHaveLength(2);
    expect(result.graphqlCalls[1]?.query).toContain("resolveReviewThread");
    expect(result.graphqlCalls[1]?.variables).toEqual({ threadId: "thread-1" });
    expect(result.notices).toContainEqual(expect.stringContaining("Resolved the Codex review thread"));
  });

  it("fails visibly when a disposition reply cannot be mapped to a review thread", async () => {
    const result = await runWorkflowScript({
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
      reviewComment: {
        body: "<!-- codex-thread-disposition:resolved -->\n\nDispositioned.",
        in_reply_to_id: 41,
      },
    });

    expect(result.failures).toContainEqual(expect.stringContaining("could not find the review thread"));
  });

  it("fails visibly when GitHub rejects direct review-thread resolution", async () => {
    const result = await runWorkflowScript({
      graphqlError: new Error("permission denied"),
      reviewComment: {
        body: "<!-- codex-thread-disposition:resolved -->\n\nFixed.",
        in_reply_to_id: 41,
      },
    });

    expect(result.failures).toContainEqual(expect.stringContaining("permission denied"));
    expect(result.warnings).toContainEqual(expect.stringContaining("permission denied"));
  });

  it("fails visibly on a permission failure while listing comments", async () => {
    const result = await runWorkflowScript({ paginateError: { status: 403 } });

    expect(result.createdComments).toHaveLength(0);
    expect(result.failures).toContainEqual(expect.stringContaining("denied permission to list issue comments"));
    expect(result.warnings).toContainEqual(expect.stringContaining("denied permission to list issue comments"));
  });

  it("fails visibly on a permission failure while creating the request", async () => {
    const result = await runWorkflowScript({ createError: { status: 403 } });

    expect(result.createdComments).toHaveLength(1);
    expect(result.failures).toContainEqual(expect.stringContaining("cannot comment on the pull request"));
    expect(result.warnings).toContainEqual(expect.stringContaining("cannot comment on the pull request"));
  });

  it("rethrows unexpected failures while listing comments", async () => {
    await expect(runWorkflowScript({ paginateError: { status: 500 } })).rejects.toEqual({ status: 500 });
  });
});
