import { describe, expect, it } from "vitest";
import {
  classifyReconciliationState,
  collectReconciliationState,
  collectProcessDiagnostics,
  parseWorktreePorcelain,
} from "../scripts/reconciliation-preflight.mjs";

describe("reconciliation preflight", () => {
  it("parses clean, detached, locked, and prunable worktree records", () => {
    const parsed = parseWorktreePorcelain(
      [
        "worktree C:/repo",
        "HEAD abc123",
        "branch refs/heads/main",
        "",
        "worktree C:/repo-review",
        "HEAD def456",
        "detached",
        "locked active review",
        "prunable missing directory",
        "",
      ].join("\n"),
    );

    expect(parsed).toEqual([
      { path: "C:/repo", head: "abc123", branch: "main" },
      {
        path: "C:/repo-review",
        head: "def456",
        detached: true,
        locked: "active review",
        prunable: "missing directory",
      },
    ]);
  });

  it("blocks integration from a dirty or divergent primary while preserving dirty worktrees", () => {
    const result = classifyReconciliationState({
      baseRef: "origin/main",
      baseCommit: "base123",
      worktrees: [
        {
          path: "C:/repo",
          head: "old123",
          branch: "main",
          statusEntries: 2,
          operations: [],
        },
        {
          path: "C:/repo-task",
          head: "task123",
          branch: "codex/task",
          statusEntries: 1,
          operations: [],
        },
      ],
    });

    expect(result.blocking).toBe(true);
    expect(result.integrationBase).toBe("dedicated-worktree-required");
    expect(result.findings.map((item) => item.code)).toEqual([
      "primary-dirty",
      "primary-base-mismatch",
      "preserve-dirty-worktrees",
    ]);
  });

  it("fails closed on unreadable worktree state without calling it an active Git operation", () => {
    const result = classifyReconciliationState({
      baseRef: "origin/main",
      baseCommit: "base123",
      worktrees: [
        {
          path: "C:/repo",
          head: "base123",
          branch: "main",
          statusEntries: null,
          operations: [],
          inspectionErrors: ["status-unreadable", "git-directory-unresolved"],
        },
      ],
    });

    expect(result.blocking).toBe(true);
    expect(result.totals).toMatchObject({ activeOperations: 0, inspectionFailures: 1 });
    expect(result.findings.map((item) => item.code)).toEqual(["worktree-inspection-failed"]);
  });

  it("checks process ownership across every registered worktree", () => {
    let inspectedRoots: string[] = [];
    const diagnostics = collectProcessDiagnostics(
      [{ path: "C:/repo" }, { path: "C:/repo-task" }],
      (roots: string[]) => {
        inspectedRoots = roots;
        return [{ pid: 123, parentPid: 1, createdAtMs: null }];
      },
    );

    expect(inspectedRoots).toEqual(["C:/repo", "C:/repo-task"]);
    expect(diagnostics).toEqual({ matchingWorktreeNodeProcesses: 1, rawCommandLinesSerialized: false });
  });

  it("emits parseable metadata-only JSON without fetching", () => {
    // Exercise the exported collector in-process. Spawning a second Node/Vite
    // module graph here made this otherwise synchronous contract contend with
    // the full suite for CPU and occasionally exceed the global test timeout.
    const stdout = JSON.stringify(collectReconciliationState());
    const payload = JSON.parse(stdout);
    expect(payload).toMatchObject({ cachedRefsOnly: true, fetched: false });
    expect(payload.integrationBase).toBe("dedicated-worktree-required");
    expect(payload.processDiagnostics).toMatchObject({ skipped: true, rawCommandLinesSerialized: false });
    expect(stdout).not.toContain("commandLine");
  });
});
