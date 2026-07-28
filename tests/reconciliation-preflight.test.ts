import { describe, expect, it } from "vitest";
import {
  classifyReconciliationState,
  collectProcessDiagnostics,
  inspectReconciliationWorktrees,
  parseWorktreePorcelain,
  runReconciliationPreflightCli,
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

  it("bounds concurrent worktree inspection while preserving registration order", async () => {
    let active = 0;
    let peak = 0;
    const worktrees = Array.from({ length: 24 }, (_, index) => ({ path: `C:/repo-${index}`, head: `${index}` }));

    const result = await inspectReconciliationWorktrees(worktrees, "origin/main", "base123", {
      concurrency: 4,
      inspect: async (worktree: (typeof worktrees)[number]) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return { ...worktree, statusEntries: 0, operations: [], inspectionErrors: [] };
      },
    });

    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
    expect(result.map((item) => item.path)).toEqual(worktrees.map((item) => item.path));
  });

  it("emits parseable metadata-only JSON from an injected snapshot without scanning real worktrees", async () => {
    const output: string[] = [];
    const snapshot = {
      generatedAt: "2026-07-25T00:00:00.000Z",
      cachedRefsOnly: true,
      fetched: false,
      processDiagnostics: { skipped: true, rawCommandLinesSerialized: false },
      baseRef: "origin/main",
      baseCommit: "base123",
      primaryPath: "C:/repo",
      totals: { worktrees: 1, dirty: 0, detached: 0, activeOperations: 0, inspectionFailures: 0 },
      integrationBase: "dedicated-worktree-required",
      blocking: false,
      findings: [],
      worktrees: [],
      inspectionDiagnostics: { durationMs: 4, worktreeConcurrency: 6 },
    };
    const exitCode = await runReconciliationPreflightCli(["--json"], {
      collectState: async () => snapshot,
      writeOutput: (value) => output.push(value),
    });

    expect(exitCode).toBe(0);
    const payload = JSON.parse(output.join("\n"));
    expect(payload).toMatchObject({ cachedRefsOnly: true, fetched: false });
    expect(payload.integrationBase).toBe("dedicated-worktree-required");
    expect(payload.processDiagnostics).toMatchObject({ skipped: true, rawCommandLinesSerialized: false });
    expect(output.join("\n")).not.toContain("commandLine");
  });
});
