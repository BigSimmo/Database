import type { SpawnSyncReturns } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertReadOnlyGitArgs,
  classifyLiveness,
  collectRegisteredWorktreeReport,
  inspectWindowsReparsePaths,
  parseArgs,
  parseWorktreePorcelain,
  runReadOnlyGit,
  runRegisteredWorktreeReport,
} from "../scripts/clean-worktree.mjs";

const mainPath = path.resolve("C:/repo/main");
const taskPath = path.resolve("D:/worktrees/task");

type SpawnRunner = typeof import("node:child_process").spawnSync;
type SyntheticSpawnOptions = {
  env?: NodeJS.ProcessEnv;
  input?: string;
};

function asSpawnRunner(
  runner: (file: string, args: string[], options: SyntheticSpawnOptions) => SpawnSyncReturns<string>,
): SpawnRunner {
  return runner as unknown as SpawnRunner;
}

function spawnSuccess(stdout = "", stderr = ""): SpawnSyncReturns<string> {
  return {
    pid: 1,
    output: [null, stdout, stderr],
    stdout,
    stderr,
    status: 0,
    signal: null,
  };
}

const syntheticDirectoryLstat = (() => ({
  reparsePoint: false,
  isSymbolicLink: () => false,
  isDirectory: () => true,
})) as unknown as typeof import("node:fs").lstatSync;

function porcelain() {
  return [
    `worktree ${mainPath}`,
    "HEAD 1111111111111111111111111111111111111111",
    "branch refs/heads/main",
    "",
    `worktree ${taskPath}`,
    "HEAD 2222222222222222222222222222222222222222",
    "branch refs/heads/task",
    "",
  ].join("\n");
}

function ok(stdout = "") {
  return { ok: true, code: 0, stdout };
}

describe("clean-worktree report-only argument contract", () => {
  it.each([
    ["--remove"],
    ["--merged", "--remove"],
    ["--merged", "--remove", "--dry-run"],
    ["--apply"],
    ["--apply=true"],
  ])("rejects mutation option %j before inspection", (...argv) => {
    expect(() => parseArgs(argv)).toThrow(/report-only|unsupported/i);
  });

  it("cannot be unlocked by the legacy confirmation environment variable", () => {
    const prior = process.env.CLEAN_WORKTREE_CONFIRM;
    process.env.CLEAN_WORKTREE_CONFIRM = "1";
    try {
      expect(() => parseArgs(["--merged", "--remove"])).toThrow(/report-only|unsupported/i);
    } finally {
      if (prior === undefined) delete process.env.CLEAN_WORKTREE_CONFIRM;
      else process.env.CLEAN_WORKTREE_CONFIRM = prior;
    }
  });

  it("keeps report filters while making dry-run an explicit compatibility no-op", () => {
    expect(parseArgs(["--merged", "--squashed", "--dry-run", "--base=origin/main", "--drive=D"])).toMatchObject({
      merged: true,
      squashed: true,
      dryRun: true,
      baseRef: "origin/main",
      drive: "D",
      reportOnly: true,
    });
  });

  it("rejects malformed drive filters", () => {
    expect(() => parseArgs(["--drive=DX"])).toThrow(/drive filter/i);
  });

  it("rejects every programmatic mutation-shaped option before any adapter call", () => {
    let adapterCalls = 0;
    const gitFn = () => {
      adapterCalls += 1;
      return ok();
    };

    expect(() => runRegisteredWorktreeReport({ remove: true }, { gitFn })).toThrow(/report-only|unsupported/i);
    expect(() => runRegisteredWorktreeReport({ remove: "yes" }, { gitFn })).toThrow(/report-only|unsupported/i);
    expect(() => runRegisteredWorktreeReport({ apply: false }, { gitFn })).toThrow(/report-only|unsupported/i);
    expect(() => runRegisteredWorktreeReport({ drive: "DX" }, { gitFn })).toThrow(/drive filter/i);
    expect(adapterCalls).toBe(0);
  });
});

describe("clean-worktree read-only Git boundary", () => {
  it.each([
    ["clean", "-fdx"],
    ["worktree", "prune", "--expire", "now"],
    ["worktree", "remove", taskPath],
    ["commit-tree", "abc123"],
    ["update-ref", "refs/heads/main", "abc123"],
  ])("rejects mutating Git invocation %j", (...args) => {
    expect(() => assertReadOnlyGitArgs(args)).toThrow(/read-only Git boundary/i);
  });

  it("permits only the dry-run worktree prune form", () => {
    expect(() => assertReadOnlyGitArgs(["worktree", "prune", "--dry-run", "-v"])).not.toThrow();
    expect(() => assertReadOnlyGitArgs(["worktree", "prune", "-v", "--dry-run"])).toThrow(/read-only Git boundary/i);
  });

  it("pins exact read-only caller shapes and refuses write-capable lookalikes", () => {
    const left = "a".repeat(40);
    const right = "b".repeat(40);
    expect(() => assertReadOnlyGitArgs(["merge-base", "--is-ancestor", left, right])).not.toThrow();
    expect(() =>
      assertReadOnlyGitArgs([
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--no-renames",
        "--name-only",
        "-z",
        left,
        right,
        "--",
      ]),
    ).not.toThrow();
    expect(() => assertReadOnlyGitArgs(["symbolic-ref", "HEAD", "refs/heads/evil"])).toThrow(/read-only Git boundary/i);
    expect(() =>
      assertReadOnlyGitArgs(["diff", "--no-ext-diff", "--no-textconv", `--output=${taskPath}`, left, right]),
    ).toThrow(/read-only Git boundary/i);
    expect(() => assertReadOnlyGitArgs(["rev-parse", "--verify", "--quiet", "main^{commit}"])).toThrow(
      /read-only Git boundary/i,
    );
  });

  it("suppresses optional index writes and lazy object fetches", () => {
    let invocation: { args?: string[]; env?: NodeJS.ProcessEnv } = {};
    const runner = asSpawnRunner((_file, args, options) => {
      invocation = { args, env: options.env };
      return spawnSuccess("ok\n");
    });

    expect(runReadOnlyGit(["rev-parse", "HEAD"], { runner }).stdout).toBe("ok");
    expect(invocation.args?.[0]).toBe("--no-optional-locks");
    expect(invocation.args).toContain("--literal-pathspecs");
    expect(invocation.env?.GIT_OPTIONAL_LOCKS).toBe("0");
    expect(invocation.env?.GIT_NO_LAZY_FETCH).toBe("1");
    expect(invocation.env?.GIT_LITERAL_PATHSPECS).toBe("1");
  });

  it("preserves byte-delimited path output, including leading whitespace", () => {
    const left = "a".repeat(40);
    const right = "b".repeat(40);
    const result = runReadOnlyGit(
      ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--name-only", "-z", left, right, "--"],
      { runner: asSpawnRunner(() => spawnSuccess(" leading-space.ts\0")) },
    );

    expect(result.stdout).toBe(" leading-space.ts\0");
  });

  it("contains no direct fleet mutation command in the implementation", () => {
    const source = readFileSync(path.resolve("scripts/clean-worktree.mjs"), "utf8");
    expect(source).not.toMatch(/execFileSync\(\s*["']git["']/);
    expect(source).not.toContain('"commit-tree"');
    expect(source).not.toContain('["clean",');
    expect(source).not.toContain('["worktree", "remove"');
    expect(source).not.toContain('["worktree", "prune", "--expire"');
  });
});

describe("Windows reparse attribute probe", () => {
  it("batches literal paths through a fixed read-only script without command interpolation", () => {
    const candidates = [path.resolve("D:/fleet/one"), path.resolve("D:/fleet/two")];
    let invocation: { file?: string; args?: string[]; input?: string } = {};
    const result = inspectWindowsReparsePaths(candidates, {
      platform: "win32",
      runner: asSpawnRunner((file, args, options) => {
        invocation = { file, args, input: options.input };
        return spawnSuccess(
          JSON.stringify([
            { state: "safe", code: "OK" },
            { state: "reparse", code: "REPARSE" },
          ]),
        );
      }),
    });

    expect(result).toEqual([{ state: "safe" }, { state: "reparse", code: "REPARSE" }]);
    expect(invocation.file).toBe("powershell.exe");
    expect(invocation.args?.join(" ")).toContain("Get-Item -LiteralPath");
    expect(invocation.args?.join(" ")).not.toContain(candidates[0]);
    expect(JSON.parse(invocation.input ?? "{}")).toEqual({ paths: candidates, stopOnBoundary: false });
  });

  it("fails closed when batch output is malformed or incomplete", () => {
    const candidates = [path.resolve("D:/fleet/one"), path.resolve("D:/fleet/two")];
    expect(
      inspectWindowsReparsePaths(candidates, {
        platform: "win32",
        runner: asSpawnRunner(() => spawnSuccess(JSON.stringify([{ state: "safe" }]))),
      }),
    ).toEqual([
      { state: "unknown", code: "MALFORMED_PROBE" },
      { state: "unknown", code: "MALFORMED_PROBE" },
    ]);
  });
});

describe("clean-worktree fail-closed reporting", () => {
  it("parses both newline and NUL-delimited porcelain deterministically", () => {
    const expected = parseWorktreePorcelain(porcelain());
    const nul = porcelain().split(/\r?\n/).filter(Boolean).join("\0");
    expect(parseWorktreePorcelain(`${nul}\0`)).toEqual(expected);
    expect(
      parseWorktreePorcelain("worktree D:/trailing-space \0HEAD 1111111111111111111111111111111111111111\0"),
    ).toEqual([expect.objectContaining({ path: "D:/trailing-space " })]);
  });

  it("treats absent liveness evidence as unknown, never inactive", () => {
    expect(classifyLiveness()).toMatchObject({ state: "unknown" });
    expect(classifyLiveness({ matchingProcesses: 0, probeComplete: true })).toMatchObject({ state: "unknown" });
    expect(classifyLiveness({ matchingProcesses: 2, probeComplete: true })).toMatchObject({ state: "active" });
    expect(classifyLiveness({ state: "inactive", authoritative: false })).toMatchObject({ state: "unknown" });
    expect(
      classifyLiveness({
        state: "inactive",
        authoritative: true,
        source: "owner-registry",
        checkedAt: "2026-08-23T00:00:00.000Z",
      }),
    ).toMatchObject({ state: "inactive" });
  });

  it("returns an incomplete report when dry-run prune inspection fails", () => {
    const gitFn = (args: string[], options?: { cwd?: string }) => {
      if (args.join(" ") === "worktree list --porcelain -z") return ok(porcelain());
      if (args.join(" ") === "worktree prune --dry-run -v") {
        return { ok: false, code: 2, stdout: "", category: "git-exit", errorCode: "2" };
      }
      if (args.join(" ") === "rev-parse --show-toplevel") return ok(options?.cwd ?? mainPath);
      if (args.join(" ") === "rev-parse --path-format=absolute --git-common-dir") {
        return ok(path.join(mainPath, ".git"));
      }
      if (args[0] === "status") return ok("");
      if (args.join(" ") === "rev-parse HEAD") {
        return ok(options?.cwd === taskPath ? "2222222222222222222222222222222222222222" : "1".repeat(40));
      }
      if (args[0] === "symbolic-ref") return ok(options?.cwd === taskPath ? "task" : "main");
      throw new Error(`unexpected synthetic git call: ${args.join(" ")}`);
    };

    const report = collectRegisteredWorktreeReport(
      {},
      {
        gitFn,
        cwd: mainPath,
        lstatFn: syntheticDirectoryLstat,
      },
    );

    expect(report.complete).toBe(false);
    expect(report.inspectionErrors).toContainEqual(expect.objectContaining({ category: "prune-preview-unavailable" }));
    expect(report.mutations).toEqual({ cleaned: 0, pruned: 0, removed: 0, deregistered: 0 });
    expect(report.worktrees.every((item) => item.liveness.state === "unknown")).toBe(true);
  });

  it("detects an attached-to-detached race instead of reusing the listed branch", () => {
    const commit = "1".repeat(40);
    const gitFn = (args: string[], options?: { cwd?: string }) => {
      if (args.join(" ") === "worktree list --porcelain -z") {
        return ok([`worktree ${mainPath}`, `HEAD ${commit}`, "branch refs/heads/main", ""].join("\n"));
      }
      if (args.join(" ") === "worktree prune --dry-run -v") return ok("");
      if (args.join(" ") === "rev-parse --show-toplevel") return ok(options?.cwd ?? mainPath);
      if (args.join(" ") === "rev-parse --path-format=absolute --git-common-dir") {
        return ok(path.join(mainPath, ".git"));
      }
      if (args.join(" ") === "rev-parse HEAD") return ok(commit);
      if (args.join(" ") === "symbolic-ref --quiet --short HEAD") {
        return { ok: false, code: 1, stdout: "", category: "git-exit", errorCode: "1" };
      }
      if (args[0] === "status") return ok("");
      throw new Error(`unexpected synthetic git call: ${args.join(" ")}`);
    };

    const report = collectRegisteredWorktreeReport(
      {},
      {
        gitFn,
        cwd: mainPath,
        lstatFn: syntheticDirectoryLstat,
      },
    );

    expect(report.complete).toBe(false);
    expect(report.worktrees[0]).toMatchObject({ branch: null, detached: true });
    expect(report.inspectionErrors).toContainEqual(
      expect.objectContaining({ category: "branch-state-changed-during-report" }),
    );
  });

  it("refuses rather than returning an empty success when worktree listing fails", () => {
    expect(() =>
      collectRegisteredWorktreeReport(
        {},
        {
          gitFn: () => ({ ok: false, code: 2, stdout: "", category: "git-exit", errorCode: "2" }),
        },
      ),
    ).toThrow(/worktree-list-unavailable/);
  });

  it("resolves a dash-prefixed base after --end-of-options and only compares object IDs", () => {
    const baseCommit = "b".repeat(40);
    const mainCommit = "1".repeat(40);
    const calls: string[][] = [];
    const mergeCwds: Array<string | undefined> = [];
    const gitFn = (args: string[], options?: { cwd?: string }) => {
      calls.push(args);
      if (args.join(" ") === "worktree list --porcelain -z") {
        return ok([`worktree ${mainPath}`, `HEAD ${mainCommit}`, "branch refs/heads/main", ""].join("\n"));
      }
      if (args.join(" ") === "worktree prune --dry-run -v") return ok("");
      if (args.join(" ") === "rev-parse --is-shallow-repository") return ok("false");
      if (args.join(" ") === "rev-parse --show-toplevel") return ok(options?.cwd ?? mainPath);
      if (args.join(" ") === "rev-parse --path-format=absolute --git-common-dir") {
        return ok(path.join(mainPath, ".git"));
      }
      if (args.join(" ") === "rev-parse HEAD") return ok(mainCommit);
      if (args.join(" ") === "symbolic-ref --quiet --short HEAD") return ok("main");
      if (args[0] === "status") return ok("");
      if (args.join(" ") === "rev-parse --verify --quiet --end-of-options --evil^{commit}") {
        return ok(baseCommit);
      }
      if (args.join(" ") === "rev-parse --verify --quiet --end-of-options refs/heads/main^{commit}") {
        return ok(mainCommit);
      }
      if (args[0] === "merge-base" && args[1] === "--is-ancestor") {
        mergeCwds.push(options?.cwd);
        return ok("");
      }
      throw new Error(`unexpected synthetic git call: ${args.join(" ")}`);
    };

    const report = collectRegisteredWorktreeReport(
      { merged: true, baseRef: "--evil" },
      {
        gitFn,
        cwd: mainPath,
        lstatFn: syntheticDirectoryLstat,
      },
    );

    expect(report.complete).toBe(true);
    expect(calls).toContainEqual(["rev-parse", "--verify", "--quiet", "--end-of-options", "--evil^{commit}"]);
    const comparison = calls.find((args) => args[0] === "merge-base");
    expect(comparison).toEqual(["merge-base", "--is-ancestor", mainCommit, baseCommit]);
    expect(mergeCwds).toEqual([mainPath]);
  });
});

describe("package report-only routing", () => {
  it("routes preflight through the explicit report command while retaining a safe compatibility alias", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["worktrees:report"]).toBe("node scripts/clean-worktree.mjs");
    expect(packageJson.scripts["worktrees:inventory"]).toBe("node scripts/worktree-inventory.mjs");
    expect(packageJson.scripts["clean:worktree"]).toBe("npm run worktrees:report");
    expect(packageJson.scripts["verify:preflight"]).toContain("npm run worktrees:report -- --self-test");
    expect(packageJson.scripts["verify:preflight"]).not.toContain("npm run clean:worktree");
  });
});
