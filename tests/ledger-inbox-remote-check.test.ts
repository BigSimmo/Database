import { describe, expect, it } from "vitest";

import { assertSafeRemoteReconciliation, findUnmergedRemoteReconciliations } from "../scripts/ledger-inbox.mjs";

describe("ledger inbox pre-flight remote reconciliation check", () => {
  it("fails open and returns empty list when offline or runner throws", () => {
    const result = findUnmergedRemoteReconciliations({
      runner: () => {
        throw new Error("fatal: unable to access 'https://github.com/BigSimmo/Database.git/': Could not resolve host");
      },
    });
    expect(result).toEqual([]);
  });

  it("returns empty list when remote heads only include main and current branch", () => {
    const lsRemoteOutput = [
      `${"a".repeat(40)}\trefs/heads/main`,
      `${"b".repeat(40)}\trefs/heads/gemini/safe-ledger-and-ui-swarm-batch`,
    ].join("\n");

    const result = findUnmergedRemoteReconciliations({
      lsRemoteOutput,
      currentBranch: "gemini/safe-ledger-and-ui-swarm-batch",
    });
    expect(result).toEqual([]);
  });

  it("detects remote reconcile branches when unfetched by branch name pattern", () => {
    const lsRemoteOutput = [
      `${"a".repeat(40)}\trefs/heads/main`,
      `${"1".repeat(40)}\trefs/heads/claude/issues-reconcile-20260818`,
      `${"2".repeat(40)}\trefs/heads/claude/ledger-reconcile-issues-c1trbj`,
      `${"3".repeat(40)}\trefs/heads/feature/ordinary-feature`,
    ].join("\n");

    const result = findUnmergedRemoteReconciliations({
      lsRemoteOutput,
      currentBranch: "feature/ordinary-feature",
    });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.branch)).toEqual([
      "claude/issues-reconcile-20260818",
      "claude/ledger-reconcile-issues-c1trbj",
    ]);
  });

  it("assertSafeRemoteReconciliation throws an error when unmerged reconcile branches exist", () => {
    const lsRemoteOutput = [
      `${"a".repeat(40)}\trefs/heads/main`,
      `${"1".repeat(40)}\trefs/heads/claude/issues-reconcile-20260818`,
    ].join("\n");

    expect(() =>
      assertSafeRemoteReconciliation([], {
        lsRemoteOutput,
        currentBranch: "my-branch",
      }),
    ).toThrow(/detected unmerged branch\(es\) on origin carrying pending inbox reconciliations/);
  });

  it("assertSafeRemoteReconciliation warns loudly instead of throwing when --allow-concurrent is passed", () => {
    const lsRemoteOutput = [
      `${"a".repeat(40)}\trefs/heads/main`,
      `${"1".repeat(40)}\trefs/heads/claude/issues-reconcile-20260818`,
    ].join("\n");

    const warnings: string[] = [];
    assertSafeRemoteReconciliation(["--allow-concurrent"], {
      lsRemoteOutput,
      currentBranch: "my-branch",
      warn: (msg: string) => warnings.push(msg),
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("claude/issues-reconcile-20260818");
    expect(warnings[0]).toContain("warning: detected unmerged branch");
  });

  it("assertSafeRemoteReconciliation warns loudly when --force is passed", () => {
    const lsRemoteOutput = [
      `${"a".repeat(40)}\trefs/heads/main`,
      `${"1".repeat(40)}\trefs/heads/claude/issues-reconcile-20260818`,
    ].join("\n");

    const warnings: string[] = [];
    assertSafeRemoteReconciliation(["--force"], {
      lsRemoteOutput,
      currentBranch: "my-branch",
      warn: (msg: string) => warnings.push(msg),
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("claude/issues-reconcile-20260818");
  });

  it("skips remote check when --skip-remote-check or --no-remote-check is provided", () => {
    const lsRemoteOutput = [
      `${"a".repeat(40)}\trefs/heads/main`,
      `${"1".repeat(40)}\trefs/heads/claude/issues-reconcile-20260818`,
    ].join("\n");

    let called = false;
    assertSafeRemoteReconciliation(["--skip-remote-check"], {
      get lsRemoteOutput() {
        called = true;
        return lsRemoteOutput;
      },
      currentBranch: "my-branch",
    });
    expect(called).toBe(false);
  });
});
