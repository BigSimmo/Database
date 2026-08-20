import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatBytes,
  getDirectoryDiskUsage,
  identifyMergedWorktrees,
  parseArgs,
  parseWorktreePorcelain,
  verifyWorktreeSafetyBeforeRemove,
} from "../scripts/clean-worktree.mjs";

const created: string[] = [];

afterEach(() => {
  for (const root of created.splice(0)) {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      // Ignore cleanup error
    }
  }
});

describe("clean-worktree parseArgs", () => {
  it("parses --help and -h flags", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  it("parses valid combination of flags", () => {
    const args = parseArgs([
      "--merged",
      "--squashed",
      "--remove",
      "--dry-run",
      "--base",
      "origin/main",
      "--drive",
      "D",
      "--batch-size",
      "5",
    ]);
    expect(args.merged).toBe(true);
    expect(args.squashed).toBe(true);
    expect(args.remove).toBe(true);
    expect(args.dryRun).toBe(true);
    expect(args.baseRef).toBe("origin/main");
    expect(args.drive).toBe("D");
    expect(args.batchSize).toBe(5);
  });

  it("parses equal-sign flags", () => {
    const args = parseArgs(["--merged", "--base=upstream/main", "--drive=D:", "--batch-size=15"]);
    expect(args.merged).toBe(true);
    expect(args.baseRef).toBe("upstream/main");
    expect(args.drive).toBe("D:");
    expect(args.batchSize).toBe(15);
  });

  it("rejects --remove without --merged", () => {
    expect(() => parseArgs(["--remove"])).toThrow(/--remove is only valid together with --merged/);
  });

  it("rejects --squashed without --merged", () => {
    expect(() => parseArgs(["--squashed"])).toThrow(/--squashed is only valid together with --merged/);
  });

  it("rejects invalid batch size", () => {
    expect(() => parseArgs(["--batch-size", "-1"])).toThrow(/Invalid --batch-size/);
    expect(() => parseArgs(["--batch-size=abc"])).toThrow(/Invalid --batch-size/);
  });

  it("rejects unknown arguments", () => {
    expect(() => parseArgs(["--unknown-flag"])).toThrow(/Unknown argument: --unknown-flag/);
  });
});

describe("clean-worktree formatBytes", () => {
  it("formats byte values cleanly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-10)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1024 * 1024 * 1.5)).toBe("1.50 MB");
    expect(formatBytes(1024 * 1024 * 1024 * 4.25)).toBe("4.25 GB");
  });
});

describe("clean-worktree getDirectoryDiskUsage", () => {
  it("measures disk usage across real directory tree", () => {
    const dir = join(tmpdir(), `clean-wt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(dir, "nested"), { recursive: true });
    created.push(dir);

    writeFileSync(join(dir, "a.txt"), "hello world\n"); // 12 bytes
    writeFileSync(join(dir, "nested", "b.txt"), "test 123456\n"); // 12 bytes

    const usage = getDirectoryDiskUsage(dir);
    expect(usage.fileCount).toBe(2);
    expect(usage.bytes).toBe(24);
  });

  it("handles non-existent directory safely", () => {
    expect(getDirectoryDiskUsage("/non/existent/path/here")).toEqual({ bytes: 0, fileCount: 0 });
  });

  it("uses lstatFn rather than statFn for symbolic links", () => {
    const fakeEntries = [
      { name: "regular.txt", isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
      { name: "symlink.txt", isDirectory: () => false, isFile: () => false, isSymbolicLink: () => true },
    ];
    let statCalls = 0;
    let lstatCalls = 0;

    const usage = getDirectoryDiskUsage("fake-dir", {
      existsFn: () => true,
      readdirFn: (() => fakeEntries) as unknown as typeof import("node:fs").readdirSync,
      statFn: (() => {
        statCalls += 1;
        return { size: 100 };
      }) as unknown as typeof import("node:fs").statSync,
      lstatFn: (() => {
        lstatCalls += 1;
        return { size: 20 };
      }) as unknown as typeof import("node:fs").lstatSync,
    });

    expect(statCalls).toBe(1);
    expect(lstatCalls).toBe(1);
    expect(usage.fileCount).toBe(2);
    expect(usage.bytes).toBe(120);
  });
});

describe("clean-worktree identifyMergedWorktrees", () => {
  const porcelain = [
    "worktree C:/repo/main",
    "HEAD 1111111111111111111111111111111111111111",
    "branch refs/heads/main",
    "",
    "worktree D:/worktrees/landed-c1",
    "HEAD 2222222222222222222222222222222222222222",
    "branch refs/heads/landed-c1",
    "",
    "worktree C:/worktrees/landed-c2",
    "HEAD 3333333333333333333333333333333333333333",
    "branch refs/heads/landed-c2",
    "",
    "worktree D:/worktrees/dirty",
    "HEAD 4444444444444444444444444444444444444444",
    "branch refs/heads/dirty",
    "",
  ].join("\n");

  it("identifies clean merged candidates and can filter by drive", () => {
    const parsed = parseWorktreePorcelain(porcelain);
    const mockIsMerged = () => true;
    const mockStatus = (p: string) => (p.includes("dirty") ? " M file.ts\n" : "");
    const mockAhead = () => 0;

    const all = identifyMergedWorktrees(parsed, {
      isMergedFn: mockIsMerged,
      statusFn: mockStatus,
      aheadCountFn: mockAhead,
      existsFn: () => true,
      mainPath: "C:/repo/main",
      diskUsageFn: () => ({ bytes: 1024 * 1024, fileCount: 100 }),
    });

    expect(all).toHaveLength(2);
    expect(all[0].path).toBe("D:/worktrees/landed-c1");
    expect(all[1].path).toBe("C:/worktrees/landed-c2");
    expect(all[0].diskUsage?.bytes).toBe(1024 * 1024);

    const devDriveOnly = identifyMergedWorktrees(parsed, {
      isMergedFn: mockIsMerged,
      statusFn: mockStatus,
      aheadCountFn: mockAhead,
      existsFn: () => true,
      mainPath: "C:/repo/main",
      drive: "D",
    });

    expect(devDriveOnly).toHaveLength(1);
    expect(devDriveOnly[0].path).toBe("D:/worktrees/landed-c1");
  });
});

describe("clean-worktree verifyWorktreeSafetyBeforeRemove", () => {
  const candidate = {
    path: "D:/worktrees/feature-done",
    branch: "refs/heads/feature-done",
    head: "2222222222222222222222222222222222222222",
    detached: false,
    locked: false,
  };

  it("approves a clean landed worktree", () => {
    const result = verifyWorktreeSafetyBeforeRemove(candidate, {
      mainPath: "C:/repo/main",
      currentPath: "C:/repo/current",
      existsFn: () => true,
      statusFn: () => "",
      branchFn: () => "feature-done",
      aheadCountFn: () => 0,
      confidenceFn: () => "proven — every commit on this branch is reachable from origin/main",
    });
    expect(result.safe).toBe(true);
  });

  it("rejects deletion if working tree is dirty", () => {
    const result = verifyWorktreeSafetyBeforeRemove(candidate, {
      mainPath: "C:/repo/main",
      currentPath: "C:/repo/current",
      existsFn: () => true,
      statusFn: () => " M uncommitted.ts\n",
      branchFn: () => "feature-done",
      aheadCountFn: () => 0,
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("uncommitted or untracked");
  });

  it("rejects deletion if branch was switched since scan", () => {
    const result = verifyWorktreeSafetyBeforeRemove(candidate, {
      mainPath: "C:/repo/main",
      currentPath: "C:/repo/current",
      existsFn: () => true,
      statusFn: () => "",
      branchFn: () => "another-branch",
      aheadCountFn: () => 0,
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("branch switched");
  });

  it("rejects deletion if unlanded commits are ahead of base", () => {
    const result = verifyWorktreeSafetyBeforeRemove(candidate, {
      mainPath: "C:/repo/main",
      currentPath: "C:/repo/current",
      existsFn: () => true,
      statusFn: () => "",
      branchFn: () => "feature-done",
      aheadCountFn: () => 3,
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("3 unlanded commit(s) ahead");
  });

  it("blocks removal of NOT fully corroborated squash candidates (#6GW95D)", () => {
    const result = verifyWorktreeSafetyBeforeRemove(candidate, {
      mainPath: "C:/repo/main",
      currentPath: "C:/repo/current",
      existsFn: () => true,
      statusFn: () => "",
      branchFn: () => "feature-done",
      aheadCountFn: () => 0,
      confidenceFn: () => "inferred from patch-id, NOT fully corroborated — 2 of 21 files differ",
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("NOT fully corroborated");
  });

  it("blocks removal when the corroboration check itself fails (#6GW95D)", () => {
    const result = verifyWorktreeSafetyBeforeRemove(candidate, {
      mainPath: "C:/repo/main",
      currentPath: "C:/repo/current",
      existsFn: () => true,
      statusFn: () => "",
      branchFn: () => "feature-done",
      aheadCountFn: () => 0,
      confidenceFn: () => "inferred from patch-id; corroboration check failed — review before removing",
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("corroboration check failed");
  });

  it("blocks removal when the confidence result is not a string (#6GW95D)", () => {
    const result = verifyWorktreeSafetyBeforeRemove(candidate, {
      mainPath: "C:/repo/main",
      currentPath: "C:/repo/current",
      existsFn: () => true,
      statusFn: () => "",
      branchFn: () => "feature-done",
      aheadCountFn: () => 0,
      confidenceFn: (() => null) as unknown as () => string,
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("removal blocked");
  });
});
