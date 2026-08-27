import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertSafeGitArgs,
  auditAndCleanWorktrees,
  checkBranchSafety,
  checkLivenessSafety,
  checkReparseSafety,
  checkStatusSafety,
  parseCleanupArgs,
  renderCleanupReport,
  selfTest,
} from "../scripts/worktree-cleanup.mjs";

type SyntheticStat = {
  reparsePoint?: boolean;
  isDirectory: () => boolean;
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
};

type SyntheticDirent = { name: string };

function directoryStat(options: { reparse?: boolean; link?: boolean } = {}): SyntheticStat {
  return {
    reparsePoint: options.reparse ?? false,
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => options.link ?? false,
  };
}

function fileStat(options: { reparse?: boolean; link?: boolean } = {}): SyntheticStat {
  return {
    reparsePoint: options.reparse ?? false,
    isDirectory: () => false,
    isFile: () => true,
    isSymbolicLink: () => options.link ?? false,
  };
}

function asLstatFn(fixture: (candidate: string) => SyntheticStat): typeof import("node:fs").lstatSync {
  return fixture as unknown as typeof import("node:fs").lstatSync;
}

function asReaddirFn(fixture: (candidate: string) => SyntheticDirent[]): typeof import("node:fs").readdirSync {
  return fixture as unknown as typeof import("node:fs").readdirSync;
}

describe("worktree-cleanup argument parser contract", () => {
  it("defaults to dry-run (report-only) mode with 0 mutations", () => {
    const parsed = parseCleanupArgs([]);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.apply).toBe(false);
    expect(parsed.force).toBe(false);
    expect(parsed.baseRef).toBe("origin/main");
    expect(parsed.remote).toBe("origin");
  });

  it("enables apply mode with --apply or --force", () => {
    const applyParsed = parseCleanupArgs(["--apply"]);
    expect(applyParsed.dryRun).toBe(false);
    expect(applyParsed.apply).toBe(true);

    const forceParsed = parseCleanupArgs(["--force"]);
    expect(forceParsed.dryRun).toBe(false);
    expect(forceParsed.apply).toBe(true);
    expect(forceParsed.force).toBe(true);
  });

  it("overrides apply mode if --dry-run is passed after", () => {
    const parsed = parseCleanupArgs(["--apply", "--dry-run"]);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.apply).toBe(false);
  });

  it("collects and deduplicates explicit roots", () => {
    const parsed = parseCleanupArgs([
      "--root",
      "D:/worktrees",
      "--root=D:/worktrees",
      "--base=origin/main",
      "--remote=upstream",
      "--json",
    ]);
    expect(parsed.roots).toEqual([path.resolve("D:/worktrees")]);
    expect(parsed.baseRef).toBe("origin/main");
    expect(parsed.remote).toBe("upstream");
    expect(parsed.json).toBe(true);
  });

  it("throws on unknown arguments or missing values", () => {
    expect(() => parseCleanupArgs(["--invalid-flag"])).toThrow(/unknown argument/i);
    expect(() => parseCleanupArgs(["--root"])).toThrow(/missing value for --root/i);
    expect(() => parseCleanupArgs(["--base="])).toThrow(/missing value for --base/i);
  });
});

describe("safe Git command allowlist", () => {
  it("allows safe read-only queries", () => {
    expect(() => assertSafeGitArgs(["worktree", "list", "--porcelain", "-z"])).not.toThrow();
    expect(() => assertSafeGitArgs(["worktree", "prune", "--dry-run", "-v"])).not.toThrow();
    expect(() => assertSafeGitArgs(["rev-parse", "HEAD"])).not.toThrow();
    expect(() =>
      assertSafeGitArgs(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"]),
    ).not.toThrow();
  });

  it("rejects unauthorized prune unless allowPrune is explicitly granted", () => {
    expect(() => assertSafeGitArgs(["worktree", "prune", "-v"], { allowPrune: false })).toThrow(
      /rejected by safe git boundary/i,
    );
    expect(() => assertSafeGitArgs(["worktree", "prune", "-v"], { allowPrune: true })).not.toThrow();
  });

  it("rejects arbitrary destructive git commands", () => {
    expect(() => assertSafeGitArgs(["reset", "--hard", "HEAD"])).toThrow(/rejected by safe git boundary/i);
    expect(() => assertSafeGitArgs(["clean", "-fdx"])).toThrow(/rejected by safe git boundary/i);
  });
});

describe("Safety Invariant 1: Branch check", () => {
  const headCommit = "1111111111111111111111111111111111111111";
  const baseCommit = "2222222222222222222222222222222222222222";

  it("fails safety check if HEAD commit cannot be determined", () => {
    const gitFn = vi.fn().mockReturnValue({ ok: false, code: 1, stdout: "" });
    const result = checkBranchSafety("D:/repo/orphan", { gitFn });
    expect(result.safe).toBe(false);
    expect(result.state).toBe("unknown-or-corrupt-git");
  });

  it("passes safety check when branch is merged into base", () => {
    const gitFn = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "rev-parse" && args[1] === "HEAD") {
        return { ok: true, stdout: headCommit };
      }
      if (args[0] === "rev-parse" && args.includes("--verify")) {
        return { ok: true, stdout: baseCommit };
      }
      if (args[0] === "merge-base" && args[1] === "--is-ancestor") {
        return { ok: true, stdout: "" }; // Ancestor proof
      }
      return { ok: false, code: 1, stdout: "" };
    });

    const result = checkBranchSafety("D:/repo/orphan", { gitFn, baseRef: "origin/main" });
    expect(result.safe).toBe(true);
    expect(result.state).toBe("merged-to-base");
    expect(result.basis).toContain("Merged into origin/main");
  });

  it("passes safety check when branch is pushed to upstream remote", () => {
    const gitFn = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "rev-parse" && args[1] === "HEAD") {
        return { ok: true, stdout: headCommit };
      }
      if (args[0] === "rev-parse" && args.includes("--verify")) {
        return { ok: true, stdout: baseCommit };
      }
      if (args[0] === "merge-base" && args[1] === "--is-ancestor") {
        return { ok: false, code: 1, stdout: "" }; // Not merged
      }
      if (args[0] === "branch" && args[1] === "-r" && args[2] === "--contains") {
        return { ok: true, stdout: "  origin/feature-task-123\n" }; // Pushed to remote
      }
      return { ok: false, code: 1, stdout: "" };
    });

    const result = checkBranchSafety("D:/repo/orphan", { gitFn, baseRef: "origin/main", remote: "origin" });
    expect(result.safe).toBe(true);
    expect(result.state).toBe("pushed-to-remote");
    expect(result.basis).toContain("Pushed to upstream remote");
  });

  it("fails safety check when branch is neither merged nor pushed", () => {
    const gitFn = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "rev-parse" && args[1] === "HEAD") {
        return { ok: true, stdout: headCommit };
      }
      if (args[0] === "rev-parse" && args.includes("--verify")) {
        return { ok: true, stdout: baseCommit };
      }
      if (args[0] === "merge-base" && args[1] === "--is-ancestor") {
        return { ok: false, code: 1, stdout: "" }; // Not merged
      }
      if (args[0] === "branch" && args[1] === "-r" && args[2] === "--contains") {
        return { ok: true, stdout: "" }; // Not pushed
      }
      return { ok: false, code: 1, stdout: "" };
    });

    const result = checkBranchSafety("D:/repo/orphan", { gitFn, baseRef: "origin/main", remote: "origin" });
    expect(result.safe).toBe(false);
    expect(result.state).toBe("unmerged-unpushed");
    expect(result.reason).toContain("neither merged into origin/main nor found on remote origin");
  });
});

describe("Safety Invariant 2: Status check", () => {
  it("fails safety check if directory does not exist or is not a directory", () => {
    const lstatFn = asLstatFn(() => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    });
    const result = checkStatusSafety("D:/repo/missing", { lstatFn });
    expect(result.safe).toBe(false);
    expect(result.state).toBe("missing");
  });

  it("passes safety check when git status is completely clean (0 changes)", () => {
    const lstatFn = asLstatFn(() => directoryStat());
    const gitFn = vi.fn().mockReturnValue({ ok: true, stdout: "" });
    const result = checkStatusSafety("D:/repo/clean", { lstatFn, gitFn });
    expect(result.safe).toBe(true);
    expect(result.state).toBe("clean");
    expect(result.dirtyCount).toBe(0);
  });

  it("fails safety check when working tree has uncommitted or untracked changes", () => {
    const lstatFn = asLstatFn(() => directoryStat());
    const gitFn = vi.fn().mockReturnValue({ ok: true, stdout: " M src/index.ts\0?? untracked.txt\0" });
    const result = checkStatusSafety("D:/repo/dirty", { lstatFn, gitFn });
    expect(result.safe).toBe(false);
    expect(result.state).toBe("dirty");
    expect(result.dirtyCount).toBe(2);
    expect(result.reason).toContain("2 uncommitted or untracked changes");
  });

  it("passes for empty non-git directory and fails for non-empty non-git directory", () => {
    const lstatFn = asLstatFn(() => directoryStat());
    const gitFn = vi.fn().mockReturnValue({ ok: false, code: 128 }); // Not a git repo

    const emptyReaddir = asReaddirFn(() => []);
    const emptyResult = checkStatusSafety("D:/repo/empty", { lstatFn, gitFn, readdirFn: emptyReaddir });
    expect(emptyResult.safe).toBe(true);
    expect(emptyResult.state).toBe("clean-empty-directory");

    const fullReaddir = asReaddirFn(() => [{ name: "notes.txt" }]);
    const fullResult = checkStatusSafety("D:/repo/nonempty", { lstatFn, gitFn, readdirFn: fullReaddir });
    expect(fullResult.safe).toBe(false);
    expect(fullResult.state).toBe("non-git-with-files");
    expect(fullResult.dirtyCount).toBe(1);
  });
});

describe("Safety Invariant 3: Liveness check", () => {
  it("fails closed on current working directory", () => {
    const result = checkLivenessSafety(process.cwd(), { currentCwd: process.cwd() });
    expect(result.safe).toBe(false);
    expect(result.state).toBe("active");
    expect(result.reason).toContain("Current active process");
  });

  it("fails closed when liveness is unknown (no authoritative proof)", () => {
    const result = checkLivenessSafety("D:/repo/worktree-a", {
      currentCwd: "D:/repo/main",
      livenessResolver: () => undefined,
    });
    expect(result.safe).toBe(false);
    expect(result.state).toBe("unknown");
    expect(result.reason).toContain("fail-closed");
  });

  it("fails closed when active process is detected", () => {
    const result = checkLivenessSafety("D:/repo/worktree-a", {
      currentCwd: "D:/repo/main",
      livenessResolver: () => ({ state: "active", source: "pid-1234" }),
    });
    expect(result.safe).toBe(false);
    expect(result.state).toBe("active");
  });

  it("passes only when authoritative proof of inactivity is provided", () => {
    const result = checkLivenessSafety("D:/repo/worktree-a", {
      currentCwd: "D:/repo/main",
      livenessResolver: () => ({
        state: "inactive",
        authoritative: true,
        source: "session-registry",
        checkedAt: "2026-08-28T00:00:00Z",
      }),
    });
    expect(result.safe).toBe(true);
    expect(result.state).toBe("inactive");
  });
});

describe("Reparse Point and Directory Junction Safety", () => {
  it("rejects candidate if candidate is a junction or symbolic link", () => {
    const lstatFn = asLstatFn(() => directoryStat({ link: true }));
    const reparseProbeFn = vi.fn().mockReturnValue({ state: "reparse", code: "REPARSE" });
    const result = checkReparseSafety("D:/repo/junction-dir", { lstatFn, reparseProbeFn });
    expect(result.safe).toBe(false);
    expect(result.state).toBe("reparse-boundary");
  });

  it("rejects candidate if ancestor path contains a reparse boundary", () => {
    const lstatFn = asLstatFn(() => directoryStat());
    const reparseProbeFn = vi.fn().mockReturnValue({ state: "safe" });
    const inspectPathSegmentsFn = vi.fn().mockReturnValue({ state: "excluded-reparse", code: "REPARSE" });
    const result = checkReparseSafety("D:/reparse-root/nested/dir", {
      lstatFn,
      reparseProbeFn,
      inspectPathSegmentsFn,
    });
    expect(result.safe).toBe(false);
    expect(result.state).toBe("ancestor-reparse-boundary");
  });
});

describe("auditAndCleanWorktrees integration and classification", () => {
  const mainPath = path.resolve("D:/repos/Database");
  const activeWorktreePath = path.resolve("D:/worktrees/task-active");
  const staleWorktreePath = path.resolve("D:/worktrees/task-stale");
  const safeOrphanPath = path.resolve("D:/worktrees/orphan-safe");
  const dirtyOrphanPath = path.resolve("D:/worktrees/orphan-dirty");

  function porcelainOutput() {
    return [
      `worktree ${mainPath}`,
      "HEAD 1111111111111111111111111111111111111111",
      "branch refs/heads/main",
      "",
      `worktree ${activeWorktreePath}`,
      "HEAD 2222222222222222222222222222222222222222",
      "branch refs/heads/task-active",
      "",
      `worktree ${staleWorktreePath}`,
      "HEAD 3333333333333333333333333333333333333333",
      "branch refs/heads/task-stale",
      "prunable gitdir file points to non-existent location",
      "",
    ].join("\n");
  }

  it("classifies registered active, stale registered, and untracked orphan directories in dry-run mode", () => {
    const lstatFn = asLstatFn((cand: string) => {
      const resolved = path.resolve(cand);
      if (resolved === staleWorktreePath) {
        const err = new Error("ENOENT") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      }
      return directoryStat();
    });

    const readdirFn = asReaddirFn((dir: string) => {
      const resolved = path.resolve(dir);
      if (resolved === path.resolve("D:/worktrees")) {
        return [{ name: "task-active" }, { name: "orphan-safe" }, { name: "orphan-dirty" }];
      }
      return [];
    });

    const gitFn = vi.fn().mockImplementation((args: string[], opts?: { cwd?: string }) => {
      if (args[0] === "worktree" && args[1] === "list") {
        return { ok: true, stdout: porcelainOutput() };
      }
      if (args[0] === "worktree" && args[1] === "prune" && args[2] === "--dry-run") {
        return { ok: true, stdout: `Removing ${staleWorktreePath}: gitdir file points to non-existent location` };
      }
      if (args[0] === "rev-parse" && args[1] === "HEAD") {
        return { ok: true, stdout: "4444444444444444444444444444444444444444" };
      }
      if (args[0] === "rev-parse" && args.includes("--verify")) {
        return { ok: true, stdout: "1111111111111111111111111111111111111111" };
      }
      if (args[0] === "merge-base" && args[1] === "--is-ancestor") {
        return { ok: true, stdout: "" }; // Merged
      }
      if (args[0] === "status") {
        if (opts?.cwd === dirtyOrphanPath) {
          return { ok: true, stdout: " M dirty-file.ts\0" };
        }
        return { ok: true, stdout: "" }; // Clean
      }
      return { ok: true, stdout: "" };
    });

    const livenessResolver = vi.fn().mockImplementation((cand: string) => {
      if (path.resolve(cand) === safeOrphanPath) {
        return {
          state: "inactive",
          authoritative: true,
          source: "test-authority",
          checkedAt: "2026-08-28T00:00:00Z",
        };
      }
      return { state: "unknown" };
    });

    const inspectPathSegmentsFn = vi.fn().mockReturnValue({ state: "safe" });
    const reparseProbeFn = vi.fn().mockReturnValue({ state: "safe" });
    const rmFn = vi.fn();

    const report = auditAndCleanWorktrees(
      {
        dryRun: true,
        roots: ["D:/worktrees"],
        repositoryRoot: mainPath,
      },
      {
        gitFn,
        lstatFn,
        readdirFn,
        livenessResolver,
        inspectPathSegmentsFn,
        reparseProbeFn,
        rmFn,
      },
    );

    // Verify summary
    expect(report.mode).toBe("dry-run");
    expect(report.summary.registeredActive).toBe(2); // main + task-active
    expect(report.summary.staleRegistered).toBe(1); // task-stale
    expect(report.summary.untrackedOrphans).toBe(2); // orphan-safe + orphan-dirty
    expect(report.summary.pruned).toBe(0); // 0 mutations in dry-run
    expect(report.summary.removed).toBe(0); // 0 mutations in dry-run
    expect(rmFn).not.toHaveBeenCalled();

    // Verify classification of categories
    const active = report.registeredActive.find((w: any) => w.path === activeWorktreePath);
    expect(active?.classification).toBe("registered-active");
    expect(active?.eligibleForCleanup).toBe(false);

    const stale = report.staleRegistered.find((w: any) => w.path === staleWorktreePath);
    expect(stale?.classification).toBe("stale-registered");
    expect(stale?.eligibleForCleanup).toBe(true);
    expect(stale?.action).toBe("dry-run-prune");

    const safeOrphan = report.untrackedOrphans.find((w: any) => w.path === safeOrphanPath);
    expect(safeOrphan?.classification).toBe("untracked-orphan");
    expect(safeOrphan?.eligibleForCleanup).toBe(true);
    expect(safeOrphan?.action).toBe("dry-run-remove");

    const dirtyOrphan = report.untrackedOrphans.find((w: any) => w.path === dirtyOrphanPath);
    expect(dirtyOrphan?.classification).toBe("untracked-orphan");
    expect(dirtyOrphan?.eligibleForCleanup).toBe(false);
    expect(dirtyOrphan?.action).toBe("refuse-cleanup");
    expect(dirtyOrphan?.disposition).toContain("Status invariant");
  });

  it("performs mutations in apply mode ONLY for stale worktrees and verified-safe orphan directories", () => {
    const lstatFn = asLstatFn((cand: string) => {
      const resolved = path.resolve(cand);
      if (resolved === staleWorktreePath) {
        const err = new Error("ENOENT") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      }
      return directoryStat();
    });

    const readdirFn = asReaddirFn((dir: string) => {
      const resolved = path.resolve(dir);
      if (resolved === path.resolve("D:/worktrees")) {
        return [{ name: "task-active" }, { name: "orphan-safe" }, { name: "orphan-dirty" }];
      }
      return [];
    });

    const gitFn = vi.fn().mockImplementation((args: string[], opts?: { cwd?: string }) => {
      if (args[0] === "worktree" && args[1] === "list") {
        return { ok: true, stdout: porcelainOutput() };
      }
      if (args[0] === "worktree" && args[1] === "prune" && args[2] === "--dry-run") {
        return { ok: true, stdout: `Removing ${staleWorktreePath}: gitdir file points to non-existent location` };
      }
      if (args[0] === "worktree" && args[1] === "prune") {
        return { ok: true, stdout: "" }; // git prune execution
      }
      if (args[0] === "rev-parse" && args[1] === "HEAD") {
        return { ok: true, stdout: "4444444444444444444444444444444444444444" };
      }
      if (args[0] === "rev-parse" && args.includes("--verify")) {
        return { ok: true, stdout: "1111111111111111111111111111111111111111" };
      }
      if (args[0] === "merge-base" && args[1] === "--is-ancestor") {
        return { ok: true, stdout: "" }; // Merged
      }
      if (args[0] === "status") {
        if (opts?.cwd === dirtyOrphanPath) {
          return { ok: true, stdout: " M dirty-file.ts\0" };
        }
        return { ok: true, stdout: "" }; // Clean
      }
      return { ok: true, stdout: "" };
    });

    const livenessResolver = vi.fn().mockImplementation((cand: string) => {
      if (path.resolve(cand) === safeOrphanPath) {
        return {
          state: "inactive",
          authoritative: true,
          source: "test-authority",
          checkedAt: "2026-08-28T00:00:00Z",
        };
      }
      return { state: "unknown" };
    });

    const inspectPathSegmentsFn = vi.fn().mockReturnValue({ state: "safe" });
    const reparseProbeFn = vi.fn().mockReturnValue({ state: "safe" });
    const rmFn = vi.fn();

    const report = auditAndCleanWorktrees(
      {
        apply: true,
        roots: ["D:/worktrees"],
        repositoryRoot: mainPath,
      },
      {
        gitFn,
        lstatFn,
        readdirFn,
        livenessResolver,
        inspectPathSegmentsFn,
        reparseProbeFn,
        rmFn,
      },
    );

    expect(report.mode).toBe("apply");
    expect(report.summary.pruned).toBe(1); // Stale worktree pruned
    expect(report.summary.removed).toBe(1); // Safe orphan removed
    expect(rmFn).toHaveBeenCalledTimes(1);
    expect(rmFn).toHaveBeenCalledWith(safeOrphanPath, { recursive: true, force: false });

    // Ensure dirty orphan was NOT removed
    expect(rmFn).not.toHaveBeenCalledWith(dirtyOrphanPath, expect.anything());
    // Ensure active worktree was NOT removed
    expect(rmFn).not.toHaveBeenCalledWith(activeWorktreePath, expect.anything());
  });

  it("renders report to stdout without throwing", () => {
    let captured = "";
    const fakeStdout = {
      write: (str: string) => {
        captured += str;
        return true;
      },
    };

    const report = {
      mode: "dry-run" as const,
      dryRun: true,
      baseRef: "origin/main",
      remote: "origin",
      timestamp: "2026-08-28T00:00:00Z",
      summary: {
        totalScanned: 3,
        registeredActive: 1,
        staleRegistered: 1,
        untrackedOrphans: 1,
        eligibleForCleanup: 2,
        pruned: 0,
        removed: 0,
        refused: 0,
      },
      registeredActive: [
        {
          path: "D:/worktree/active",
          classification: "registered-active" as const,
          primary: true,
          branch: "main",
          head: "11111111",
          locked: false,
          existsOnDisk: true,
          eligibleForCleanup: false,
          action: "retain",
          disposition: "Active registered worktree retained",
        },
      ],
      staleRegistered: [
        {
          path: "D:/worktree/stale",
          classification: "stale-registered" as const,
          branch: "old-branch",
          head: "22222222",
          existsOnDisk: false,
          prunableReason: "Directory missing",
          eligibleForCleanup: true,
          action: "dry-run-prune",
          disposition: "Would prune stale git worktree registration via git worktree prune",
        },
      ],
      untrackedOrphans: [
        {
          path: "D:/worktree/orphan",
          classification: "untracked-orphan" as const,
          branchSafety: { safe: true, state: "merged-to-base" },
          statusSafety: { safe: true, state: "clean" },
          livenessSafety: { safe: true, state: "inactive" },
          reparseSafety: { safe: true, state: "safe" },
          safetyPassed: true,
          eligibleForCleanup: true,
          action: "dry-run-remove",
          disposition: "Would remove safe orphan directory",
        },
      ],
      inspectionErrors: [],
    };

    renderCleanupReport(report, { stdout: fakeStdout as any });
    expect(captured).toContain("[worktree-cleanup] MODE: DRY-RUN");
    expect(captured).toContain("Registered Active Worktrees");
    expect(captured).toContain("Stale Registered Worktrees");
    expect(captured).toContain("Untracked / Orphan Workspace Directories");
    expect(captured).toContain("Mutations summary: pruned=0, removed=0");
  });

  it("passes pure selfTest", () => {
    expect(() => selfTest()).not.toThrow();
  });
});
