import path from "node:path";
import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  inspectPathSegmentsForReparse,
  parseInventoryArgs,
  scanInventoryRoots,
} from "../scripts/worktree-inventory.mjs";

function directoryStat(options: { reparse?: boolean; link?: boolean } = {}) {
  return {
    reparsePoint: options.reparse ?? false,
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => options.link ?? false,
  };
}

function fileStat(options: { reparse?: boolean; link?: boolean } = {}) {
  return {
    reparsePoint: options.reparse ?? false,
    isDirectory: () => false,
    isFile: () => true,
    isSymbolicLink: () => options.link ?? false,
  };
}

describe("worktree inventory argument contract", () => {
  it("requires explicit roots", () => {
    expect(() => parseInventoryArgs([])).toThrow(/at least one --root/i);
  });

  it("collects, deduplicates, and sorts explicit roots", () => {
    const parsed = parseInventoryArgs([
      "--root",
      "D:/z-root",
      "--root=D:/a-root",
      "--root",
      "D:/z-root",
      "--repository",
      "D:/repo",
      "--max-depth",
      "6",
      "--json",
    ]);
    expect(parsed.roots).toEqual([path.resolve("D:/a-root"), path.resolve("D:/z-root")]);
    expect(parsed.repositoryRoot).toBe(path.resolve("D:/repo"));
    expect(parsed.maxDepth).toBe(6);
    expect(parsed.json).toBe(true);
  });

  it.each([["--remove"], ["--apply"], ["--apply=true"], ["--root", "D:/safe", "--remove"]])(
    "rejects mutation option %j",
    (...argv) => {
      expect(() => parseInventoryArgs(argv)).toThrow(/report-only|unsupported/i);
    },
  );

  it("refuses filesystem and home-wide roots", () => {
    expect(() => parseInventoryArgs(["--root", path.parse(process.cwd()).root])).toThrow(/too broad/i);
    expect(() => parseInventoryArgs(["--root", homedir()])).toThrow(/too broad/i);
  });

  it("rejects programmatic mutation-shaped options and broad roots before adapters", () => {
    let adapterCalls = 0;
    const inspectPathSegmentsFn = () => {
      adapterCalls += 1;
      return { state: "safe" };
    };
    const inspectRepositoryFn = () => {
      adapterCalls += 1;
      return { complete: true, classification: "repository-unknown" };
    };

    expect(() =>
      scanInventoryRoots({ roots: ["D:/safe"], remove: "yes" }, { inspectPathSegmentsFn, inspectRepositoryFn }),
    ).toThrow(/report-only|unsupported/i);
    expect(() =>
      scanInventoryRoots({ roots: ["D:/safe"], apply: false }, { inspectPathSegmentsFn, inspectRepositoryFn }),
    ).toThrow(/report-only|unsupported/i);
    expect(() =>
      scanInventoryRoots({ roots: [path.parse(process.cwd()).root] }, { inspectPathSegmentsFn, inspectRepositoryFn }),
    ).toThrow(/too broad/i);
    expect(adapterCalls).toBe(0);
  });
});

describe("worktree inventory reparse boundary", () => {
  it("refuses an explicit root whose path crosses a reparse segment", () => {
    const target = path.resolve("D:/fleet/root");
    const reparse = path.resolve("D:/fleet");
    const visited: string[] = [];
    const result = inspectPathSegmentsForReparse(target, {
      platform: "win32",
      reparseBatchFn: (candidates: string[]) => {
        for (const candidate of candidates) {
          visited.push(path.resolve(candidate));
          if (path.resolve(candidate) === reparse) {
            return [...visited.slice(0, -1).map(() => ({ state: "safe" })), { state: "reparse" }];
          }
        }
        return candidates.map(() => ({ state: "safe" }));
      },
    });
    expect(result).toMatchObject({ state: "excluded-reparse" });
    expect(visited).not.toContain(target);
  });

  it("uses one sibling attribute batch and refuses an opaque Windows reparse child", () => {
    const root = path.resolve("D:/fleet");
    const linked = path.join(root, "opaque-reparse");
    const batches: string[][] = [];
    const opaqueDirectoryStat = {
      isDirectory: () => true,
      isFile: () => false,
      isSymbolicLink: () => false,
    };
    const report = scanInventoryRoots(
      { roots: [root], repositoryRoot: path.resolve("D:/repo"), maxDepth: 3 },
      {
        platform: "win32",
        inspectPathSegmentsFn: () => ({ state: "safe" }),
        inspectRepositoryFn: () => ({ complete: true, classification: "repository-unknown" }),
        lstatFn: () => opaqueDirectoryStat,
        readdirFn: (candidate: string) => (path.resolve(candidate) === root ? [{ name: "opaque-reparse" }] : []),
        reparseBatchFn: (candidates: string[]) => {
          batches.push(candidates.map((candidate) => path.resolve(candidate)));
          return candidates.map((candidate) =>
            path.resolve(candidate) === linked ? { state: "reparse", code: "REPARSE" } : { state: "safe" },
          );
        },
      },
    );

    expect(batches).toEqual([[linked]]);
    expect(report.complete).toBe(false);
    expect(report.excludedBoundaries).toContainEqual(
      expect.objectContaining({ path: linked, category: "reparse-boundary" }),
    );
  });

  it("never traverses or inspects a child link/junction/reparse boundary", () => {
    const root = path.resolve("D:/fleet");
    const linked = path.join(root, "linked-session");
    const checkout = path.join(root, "checkout");
    const gitMarker = path.join(checkout, ".git");
    const readdirCalls: string[] = [];
    const repoInspections: string[] = [];

    const report = scanInventoryRoots(
      { roots: [root], repositoryRoot: path.resolve("D:/repo"), maxDepth: 3 },
      {
        inspectPathSegmentsFn: () => ({ state: "safe" }),
        lstatFn: (candidate: string) => {
          const normalized = path.resolve(candidate);
          if (normalized === linked) return directoryStat({ link: true, reparse: true });
          if (normalized === gitMarker) return fileStat();
          return directoryStat();
        },
        readdirFn: (candidate: string) => {
          const normalized = path.resolve(candidate);
          readdirCalls.push(normalized);
          if (normalized === root) return [{ name: "linked-session" }, { name: "checkout" }];
          if (normalized === checkout) return [{ name: ".git" }];
          throw new Error(`unexpected traversal into ${normalized}`);
        },
        inspectRepositoryFn: (candidate: string) => {
          repoInspections.push(path.resolve(candidate));
          return { complete: true, classification: "registered-worktree" };
        },
      },
    );

    expect(readdirCalls).not.toContain(linked);
    expect(repoInspections).toEqual([checkout]);
    expect(report.excludedBoundaries).toEqual([
      expect.objectContaining({ path: linked, category: "reparse-boundary" }),
    ]);
    expect(report.complete).toBe(false);
    expect(report.inspectionErrors).toContainEqual(
      expect.objectContaining({ path: linked, category: "reparse-boundary-excluded" }),
    );
    expect(report.mutations).toEqual({ cleaned: 0, pruned: 0, removed: 0, deregistered: 0 });
  });

  it("marks an excluded explicit reparse root incomplete", () => {
    const root = path.resolve("D:/fleet/root");
    const boundary = path.resolve("D:/fleet");
    const report = scanInventoryRoots(
      { roots: [root], repositoryRoot: path.resolve("D:/repo"), maxDepth: 3 },
      {
        inspectPathSegmentsFn: () => ({ state: "excluded-reparse", path: boundary }),
        inspectRepositoryFn: () => {
          throw new Error("must not inspect an excluded root");
        },
      },
    );

    expect(report.complete).toBe(false);
    expect(report.roots).toEqual([
      expect.objectContaining({ path: root, complete: false, boundary: "excluded-reparse" }),
    ]);
    expect(report.inspectionErrors).toEqual([
      expect.objectContaining({ path: boundary, category: "reparse-boundary-excluded" }),
    ]);
  });

  it("refuses a reparse-crossing repository anchor before any Git inspection", () => {
    const root = path.resolve("D:/fleet");
    const anchor = path.resolve("D:/anchor/link/repo");
    const boundary = path.resolve("D:/anchor/link");
    let gitCalls = 0;
    const report = scanInventoryRoots(
      { roots: [root], repositoryRoot: anchor, maxDepth: 3 },
      {
        inspectPathSegmentsFn: (candidate: string) =>
          path.resolve(candidate) === anchor ? { state: "excluded-reparse", path: boundary } : { state: "safe" },
        gitFn: () => {
          gitCalls += 1;
          return { ok: false, code: 1, stdout: "" };
        },
        lstatFn: () => directoryStat(),
        readdirFn: () => [],
      },
    );

    expect(gitCalls).toBe(0);
    expect(report.complete).toBe(false);
    expect(report.inspectionErrors).toContainEqual(
      expect.objectContaining({ path: boundary, category: "anchor-reparse-boundary-excluded" }),
    );
  });

  it("marks every overlapping root incomplete when they encounter the same reparse boundary", () => {
    const root = path.resolve("D:/fleet");
    const nestedRoot = path.join(root, "sub");
    const linked = path.join(nestedRoot, "linked");
    const report = scanInventoryRoots(
      { roots: [nestedRoot, root], repositoryRoot: path.resolve("D:/repo"), maxDepth: 3 },
      {
        inspectPathSegmentsFn: () => ({ state: "safe" }),
        inspectRepositoryFn: () => ({ complete: true, classification: "repository-unknown" }),
        lstatFn: (candidate: string) =>
          path.resolve(candidate) === linked ? directoryStat({ reparse: true }) : directoryStat(),
        readdirFn: (candidate: string) => {
          const resolved = path.resolve(candidate);
          if (resolved === root) return [{ name: "sub" }];
          if (resolved === nestedRoot) return [{ name: "linked" }];
          throw new Error(`unexpected traversal into ${resolved}`);
        },
      },
    );

    expect(report.roots).toEqual([
      expect.objectContaining({ path: root, complete: false }),
      expect.objectContaining({ path: nestedRoot, complete: false }),
    ]);
    expect(report.excludedBoundaries).toEqual([
      expect.objectContaining({ root, path: linked }),
      expect.objectContaining({ root: nestedRoot, path: linked }),
    ]);
  });
});

describe("worktree inventory deterministic fail-closed report", () => {
  it.each([
    ["worktree-list", "anchor-worktree-list-unavailable"],
    ["remote", "anchor-remote-identity-unavailable"],
  ])("keeps classifications unknown when anchor %s evidence is unavailable", (failure, category) => {
    const root = path.resolve("D:/fleet");
    const anchor = path.resolve("D:/repo");
    const checkout = path.join(root, "checkout");
    const marker = path.join(checkout, ".git");
    const gitFn = (args: string[], options?: { cwd?: string }) => {
      const cwd = path.resolve(options?.cwd ?? anchor);
      if (args.join(" ") === "rev-parse --show-toplevel") return { ok: true, code: 0, stdout: cwd };
      if (args.join(" ") === "rev-parse --path-format=absolute --git-common-dir") {
        return {
          ok: true,
          code: 0,
          stdout:
            cwd === anchor || failure === "worktree-list" ? path.join(anchor, ".git") : path.join(checkout, ".git"),
        };
      }
      if (args.join(" ") === "worktree list --porcelain -z") {
        if (failure === "worktree-list") {
          return { ok: false, code: 2, stdout: "", category: "git-exit", errorCode: "2" };
        }
        return { ok: true, code: 0, stdout: `worktree ${anchor}\0HEAD ${"1".repeat(40)}\0branch refs/heads/main\0` };
      }
      if (args.join(" ") === "remote get-url origin") {
        if (failure === "remote" && cwd === anchor) {
          return { ok: false, code: 2, stdout: "", category: "git-exit", errorCode: "2" };
        }
        return { ok: true, code: 0, stdout: "https://example.invalid/database.git" };
      }
      throw new Error(`unexpected synthetic git call: ${args.join(" ")}`);
    };

    const report = scanInventoryRoots(
      { roots: [root], repositoryRoot: anchor, maxDepth: 3 },
      {
        inspectPathSegmentsFn: () => ({ state: "safe" }),
        gitFn,
        lstatFn: (candidate: string) => (path.resolve(candidate) === marker ? fileStat() : directoryStat()),
        readdirFn: (candidate: string) => {
          const resolved = path.resolve(candidate);
          if (resolved === root) return [{ name: "checkout" }];
          if (resolved === checkout) return [{ name: ".git" }];
          return [];
        },
      },
    );

    expect(report.complete).toBe(false);
    expect(report.checkouts).toEqual([
      expect.objectContaining({ path: checkout, classification: "repository-unknown" }),
    ]);
    expect(report.inspectionErrors).toContainEqual(expect.objectContaining({ category }));
  });

  it("keeps root classifications separated and absence liveness unknown", () => {
    const rootA = path.resolve("D:/a-root");
    const rootB = path.resolve("D:/b-root");
    const registered = path.join(rootA, "registered");
    const clone = path.join(rootB, "clone");
    const empty = path.join(rootB, "empty-leftover");
    const markerA = path.join(registered, ".git");
    const markerB = path.join(clone, ".git");

    const entries = new Map<string, Array<{ name: string }>>([
      [rootA, [{ name: "registered" }]],
      [registered, [{ name: ".git" }]],
      [rootB, [{ name: "clone" }, { name: "empty-leftover" }]],
      [clone, [{ name: ".git" }]],
      [empty, []],
    ]);

    const report = scanInventoryRoots(
      { roots: [rootB, rootA], repositoryRoot: path.resolve("D:/repo"), maxDepth: 3 },
      {
        inspectPathSegmentsFn: () => ({ state: "safe" }),
        lstatFn: (candidate: string) =>
          [markerA, markerB].includes(path.resolve(candidate)) ? fileStat() : directoryStat(),
        readdirFn: (candidate: string) => entries.get(path.resolve(candidate)) ?? [],
        inspectRepositoryFn: (candidate: string) => ({
          complete: true,
          classification: path.resolve(candidate) === registered ? "registered-worktree" : "separate-clone",
        }),
      },
    );

    expect(report.complete).toBe(true);
    expect(report.roots.map((item) => item.path)).toEqual([rootA, rootB]);
    expect(report.checkouts.map((item) => [item.classification, item.path, item.liveness.state])).toEqual([
      ["registered-worktree", registered, "unknown"],
      ["separate-clone", clone, "unknown"],
    ]);
    expect(report.emptyDirectories).toEqual([
      expect.objectContaining({ path: empty, root: rootB, liveness: { state: "unknown", reason: expect.any(String) } }),
    ]);
  });

  it("marks unreadable paths incomplete without serializing raw errors", () => {
    const root = path.resolve("D:/fleet");
    const blocked = path.join(root, "blocked");
    const report = scanInventoryRoots(
      { roots: [root], repositoryRoot: path.resolve("D:/repo"), maxDepth: 2 },
      {
        inspectPathSegmentsFn: () => ({ state: "safe" }),
        lstatFn: (candidate: string) => {
          if (path.resolve(candidate) === blocked) {
            const error = new Error("SECRET raw path details") as NodeJS.ErrnoException;
            error.code = "EACCES";
            throw error;
          }
          return directoryStat();
        },
        readdirFn: (candidate: string) => (path.resolve(candidate) === root ? [{ name: "blocked" }] : []),
        inspectRepositoryFn: () => {
          throw new Error("must not inspect unreadable path");
        },
      },
    );

    expect(report.complete).toBe(false);
    expect(report.inspectionErrors).toEqual([
      expect.objectContaining({ path: blocked, category: "lstat-unavailable", code: "EACCES" }),
    ]);
    expect(JSON.stringify(report)).not.toContain("SECRET raw path details");
  });
});
