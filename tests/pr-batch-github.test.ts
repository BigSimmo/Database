import { describe, expect, it, vi } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { GitHubBatch, controllerHash } from "../scripts/pr-batch-github.mjs";
import { createBatch, transition, verifyCanaryResults } from "../scripts/pr-batch-core.mjs";
import { applyBatchResult } from "../scripts/pr-batch-worker.mjs";
import { prBatchWorkflowFailures } from "../scripts/pr-batch-policy.mjs";

const head = "a".repeat(40),
  base = "b".repeat(40),
  now = "2026-09-09T00:00:00Z";
const repo = { owner: "BigSimmo", repo: "Database", actor: "BigSimmo", runId: 42, now: () => now };
function initial() {
  return createBatch({
    prs: [
      {
        number: 1,
        head,
        headRef: "codex/test",
        baseRef: "main",
        state: "open",
        title: "Document a safe change",
        body: "",
        labels: [],
        files: ["docs/test.md"],
        filesComplete: true,
        createdAt: now,
      },
    ],
    actor: "BigSimmo",
    authorization: "codex://threads/01a08595-0fc9-75b0-96e7-567c2c77dc2b",
    controllerHash: controllerHash(),
    id: "batch-42",
    now,
  });
}

describe("GitHub state and safety adapter", () => {
  it("keeps imported base changes out of the repair delta and seals a real resolved merge", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "pr-batch-merge-test-"));
    const git = (...args: string[]) =>
      execFileSync(
        "git",
        ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args],
        { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    try {
      git("init", "--initial-branch=main");
      writeFileSync(path.join(directory, "value.txt"), "original\n");
      git("add", ".");
      git("commit", "-m", "fixture base");
      git("switch", "-c", "feature");
      writeFileSync(path.join(directory, "value.txt"), "feature change\n");
      git("commit", "-am", "fixture feature");
      const originalHead = git("rev-parse", "HEAD");
      git("switch", "main");
      writeFileSync(path.join(directory, "value.txt"), "main change\n");
      mkdirSync(path.join(directory, ".github"));
      writeFileSync(path.join(directory, ".github", "policy.json"), "{}\n");
      git("add", ".");
      git("commit", "-m", "fixture main");
      const mainHead = git("rev-parse", "HEAD");
      git("switch", "feature");
      const merge = spawnSync(
        "git",
        [
          "-c",
          "user.name=Fixture",
          "-c",
          "user.email=fixture@example.invalid",
          "merge",
          "--no-commit",
          "--no-ff",
          mainHead,
        ],
        { cwd: directory, encoding: "utf8" },
      );
      expect(merge.status).toBe(1);
      const compareTree = git("rev-parse", "AUTO_MERGE^{tree}");
      writeFileSync(path.join(directory, "value.txt"), "feature change\nmain change\n");
      expect(git("diff", "--name-only", "--no-renames", compareTree)).toBe("value.txt");
      git("add", "-A");
      git("diff", "--cached", "--check");
      expect(git("ls-files", "-u")).toBe("");
      git("commit", "-m", "fixture resolved merge");
      expect(git("show", "-s", "--format=%P", "HEAD")).toBe(`${originalHead} ${mainHead}`);
      expect(readFileSync(path.join(directory, ".github", "policy.json"), "utf8")).toBe("{}\n");
    } finally {
      if (!path.resolve(directory).startsWith(`${path.resolve(tmpdir())}${path.sep}`))
        throw new Error("Unsafe fixture cleanup path");
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("writes orphan JSON state and records an immutable manifest/event", async () => {
    const createTree = vi
      .fn<(input: { tree: Array<{ path: string }> }) => Promise<unknown>>()
      .mockResolvedValue({ data: { sha: "tree" } });
    const createCommit = vi
      .fn<(input: { parents: string[] }) => Promise<unknown>>()
      .mockResolvedValue({ data: { sha: "commit" } });
    const createRef = vi.fn<(input: { ref: string }) => Promise<void>>().mockResolvedValue(undefined);
    const api = new GitHubBatch({ rest: { git: { createTree, createCommit, createRef } } }, repo);
    const state = initial();
    transition(state, now, "launched");
    await api.save({ sha: null, tree: null, state: null }, state);
    expect(createCommit.mock.calls[0][0].parents).toEqual([]);
    expect(createTree.mock.calls[0][0].tree.map((item) => item.path)).toEqual([
      "state.json",
      "manifests/batch-42.json",
      "events/batch-42/000001.json",
    ]);
    expect(createRef.mock.calls[0][0].ref).toBe("refs/heads/codex/pr-batch-state");
  });
  it("uses a normal child commit and refuses competing state writers", async () => {
    const createTree = vi
      .fn<(input: { tree: Array<{ path: string }> }) => Promise<unknown>>()
      .mockResolvedValue({ data: { sha: "next-tree" } });
    const createCommit = vi
      .fn<(input: { parents: string[] }) => Promise<unknown>>()
      .mockResolvedValue({ data: { sha: "next" } });
    const updateRef = vi
      .fn<(input: { force: boolean }) => Promise<void>>()
      .mockRejectedValue(Object.assign(new Error("not fast-forward"), { status: 422 }));
    const api = new GitHubBatch({ rest: { git: { createTree, createCommit, updateRef } } }, repo);
    const state = initial(),
      previous = {
        sha: "parent",
        tree: "old-tree",
        revision: state.revision,
        manifestId: state.manifest.id,
        state: structuredClone(state),
      };
    transition(state, now, "selected");
    await expect(api.save(previous, state)).rejects.toThrow("not fast-forward");
    expect(createCommit.mock.calls[0][0].parents).toEqual(["parent"]);
    expect(updateRef.mock.calls[0][0].force).toBe(false);
    expect(createTree.mock.calls[0][0].tree.every((item) => !item.path.startsWith("manifests/"))).toBe(true);
  });
  it("requires the human token rather than accepting any repository writer", async () => {
    const api = new GitHubBatch(
      { rest: { users: { getAuthenticated: async () => ({ data: { login: "github-actions[bot]", type: "Bot" } }) } } },
      repo,
    );
    await expect(api.identity()).rejects.toThrow("human operator");
  });
  it("fails disabled when the activation variable does not exist", async () => {
    const api = new GitHubBatch(
      {
        rest: {
          actions: {
            getRepoVariable: async () => {
              throw { status: 404 };
            },
          },
        },
      },
      repo,
    );
    expect(await api.enabled()).toBe(false);
  });
  it("only accepts an exact two-parent branch update", async () => {
    const api = new GitHubBatch(
      { rest: { git: { getCommit: async () => ({ data: { parents: [{ sha: head }, { sha: base }] } }) } } },
      repo,
    );
    expect(await api.verifySync({ head, base }, { head: "c".repeat(40), behind: false })).toBe(true);
    expect(await api.verifySync({ head, base: "d".repeat(40) }, { head: "c".repeat(40), behind: false })).toBe(false);
  });
  it("checks the trusted workflow contract and keeps model work out of the controller", () => {
    expect(prBatchWorkflowFailures(process.cwd())).toEqual([]);
    const workflow = readFileSync(".github/workflows/pr-batch-runner.yml", "utf8");
    expect(workflow).not.toContain("pull_request_review:");
    expect(workflow).not.toContain("codex-action@");
    expect(workflow).toContain("github.event.repository.default_branch");
    const relay = readFileSync(".github/workflows/pr-batch-review-wake.yml", "utf8");
    expect(relay).not.toContain("secrets.");
    expect(relay).not.toContain("actions/checkout");
  });
  it("requires an unchanged golden case set and zero per-case rank regressions", () => {
    const before = {
      mode: "quality",
      fixture: "golden",
      summary: { document_recall_at_5: 1, content_recall_at_5: 1, failed_cases: [] },
      results: [{ id: "one", reciprocalRankAt10: 1, contentReciprocalRankAt10: 1 }],
    };
    expect(verifyCanaryResults(before, structuredClone(before))).toBe(true);
    expect(
      verifyCanaryResults(before, {
        ...before,
        results: [{ id: "one", reciprocalRankAt10: 0.5, contentReciprocalRankAt10: 1 }],
      }),
    ).toBe(false);
    expect(verifyCanaryResults(before, { ...before, results: [] })).toBe(false);
    expect(verifyCanaryResults(before, { ...before, summary: { ...before.summary, content_recall_at_5: 0.9 } })).toBe(
      false,
    );
  });
});

describe("journaled worker effects", () => {
  function worker() {
    let state = initial();
    state.active = 1;
    state.entries[0].state = "repairing";
    state.pending = { id: "batch-42-2", kind: "repair", number: 1, head, base, runId: 42 };
    let resolved = false,
      loseReplyAcknowledgement = false;
    const comments: Array<{ id: number; body: string; user: { login: string }; in_reply_to_id: number }> = [];
    const calls: string[] = [];
    const api = {
      ...repo,
      repo: { owner: repo.owner, repo: repo.repo },
      load: async () => ({ state: structuredClone(state) }),
      save: async (_old: unknown, next: typeof state) => {
        state = structuredClone(next);
      },
      assertMutation: async () => {
        if (state.status !== "running") throw new Error("paused");
      },
      gh: {
        rest: { pulls: { listReviewComments: "comments" } },
        paginate: async () => comments,
        request: async (_route: string, values: { body: string }) => {
          calls.push("reply");
          comments.push({ id: 11, body: values.body, user: { login: "BigSimmo" }, in_reply_to_id: 10 });
          if (loseReplyAcknowledgement) {
            loseReplyAcknowledgement = false;
            throw new Error("lost acknowledgement");
          }
        },
        graphql: async (query: string) => {
          if (query.includes("mutation")) {
            calls.push("resolve");
            resolved = true;
            return { resolveReviewThread: { thread: { isResolved: true } } };
          }
          return {
            node: {
              isResolved: resolved,
              comments: { totalCount: 1 + comments.length, nodes: [{ databaseId: comments.at(-1)?.id ?? 10 }] },
            },
          };
        },
      },
    };
    const context = {
      batch: { operation_id: state.pending.id, batch_id: state.manifest.id },
      pull_request: { number: 1, head_sha: head },
      unresolved_review_threads: [{ id: "T", root_comment_id: 10, latest_comment_id: 10, comment_count: 1 }],
      failed_workflow_runs: [],
    };
    const result = {
      checks: [],
      progress_outcome: "no_change",
      thread_dispositions: [
        { thread_id: "T", action: "resolve_no_change", reply: "The current implementation already handles this case." },
      ],
      rerun_failed_run_ids: [],
    };
    return {
      api,
      context,
      result,
      calls,
      loseReply: () => {
        loseReplyAcknowledgement = true;
      },
      pause: () => {
        state.status = "paused";
      },
      comments,
    };
  }
  it("replies before resolution and replays without duplicate writes", async () => {
    const w = worker();
    await applyBatchResult(w.api, w.context, w.result, head);
    await applyBatchResult(w.api, w.context, w.result, head);
    expect(w.calls).toEqual(["reply", "resolve"]);
  });
  it("recovers a reply accepted before an acknowledgement was lost", async () => {
    const w = worker();
    w.loseReply();
    await expect(applyBatchResult(w.api, w.context, w.result, head)).rejects.toThrow("lost acknowledgement");
    await applyBatchResult(w.api, w.context, w.result, head);
    expect(w.calls).toEqual(["reply", "resolve"]);
  });
  it("refuses fixed claims without a published change and proof", async () => {
    const w = worker();
    w.result.thread_dispositions[0].action = "resolve_fixed";
    await expect(applyBatchResult(w.api, w.context, w.result, head)).rejects.toThrow("lacks published change");
    expect(w.calls).toEqual([]);
  });
  it("honors pause before any effect", async () => {
    const w = worker();
    w.pause();
    await expect(applyBatchResult(w.api, w.context, w.result, head)).rejects.toThrow("paused");
    expect(w.calls).toEqual([]);
  });
});
